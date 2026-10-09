// Server för Viktresan: fotoanalys av mat.
// Appen skickar ett foto. Servern frågar en AI (Claude) vad det är och svarar med en uppskattning.
// Bilden sparas inte. AI-nyckeln ligger i Google Secret Manager, aldrig i koden.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const AI_KEY = defineSecret('ANTHROPIC_API_KEY');

const MODEL = 'claude-haiku-4-5-20251001';
const PER_USER_PER_DAY = 15;   // max foton per person och dag
const TOTAL_PER_DAY = 1000;    // max foton för hela appen per dag (skyddar plånboken)
const MAX_IMAGE_CHARS = 2_000_000; // ca 1,5 MB bild

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());

const PROMPT = `Du är en erfaren svensk dietist. Titta på bilden av en måltid.
- Dela upp måltiden i de livsmedel som syns (högst 10). Använd korta svenska namn, t.ex. "Kokt pasta", "Köttfärssås", "Mellanmjölk".
- Uppskatta vikten i gram för varje del. För drycker: ange ml i fältet grams och sätt liquid till true.
- Använd tallriken, besticken och glaset för att bedöma storleken. Var realistisk, inte snål.
- Räkna med synlig olja, smör, dressing och sås.
- Ange energi (kcal), protein, kolhydrater och fett i gram för HELA den uppskattade mängden (inte per 100 g).
- Om bilden inte visar mat eller dryck: sätt is_food till false och lämna items tom.
- note: en kort mening på svenska om något är osäkert (t.ex. "Svårt att se hur mycket sås det är."). Annars tom.`;

const TOOL = {
  name: 'maltid',
  description: 'Resultatet av analysen av måltiden.',
  input_schema: {
    type: 'object',
    properties: {
      is_food: { type: 'boolean' },
      note: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            grams: { type: 'number' },
            liquid: { type: 'boolean' },
            kcal: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' }
          },
          required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat']
        }
      }
    },
    required: ['is_food', 'items']
  }
};

const clamp = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const r1 = (n) => Math.round(n * 10) / 10;

exports.analyzeMeal = onCall(
  { region: 'europe-west1', secrets: [AI_KEY], memory: '256MiB', timeoutSeconds: 60, maxInstances: 5 },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Du måste vara inloggad.');
    const uid = req.auth.uid;
    const image = String(req.data?.image || '');
    const mime = String(req.data?.mime || 'image/jpeg');
    const hint = String(req.data?.hint || '').slice(0, 200);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new HttpsError('invalid-argument', 'Fel bildformat.');
    if (image.length < 1000 || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) {
      throw new HttpsError('invalid-argument', 'Bilden gick inte att läsa.');
    }

    // Är funktionen påslagen?
    const cfg = (await db.doc('config/app').get()).data() || {};
    if (!cfg.aiPhoto) throw new HttpsError('failed-precondition', 'Fotoanalys är avstängd just nu.');

    // Räkna foton: per person och totalt per dag.
    const day = today();
    const userRef = db.doc(`aiUsage/${uid}`);
    const statRef = db.doc(`aiStats/${day}`);
    let left = 0;
    await db.runTransaction(async (tx) => {
      const [u, st] = await Promise.all([tx.get(userRef), tx.get(statRef)]);
      const used = u.exists && u.data().day === day ? u.data().n || 0 : 0;
      const total = st.exists ? st.data().n || 0 : 0;
      if (used >= PER_USER_PER_DAY) throw new HttpsError('resource-exhausted', `Du har använt dagens ${PER_USER_PER_DAY} foton. Prova igen i morgon.`);
      if (total >= TOTAL_PER_DAY) throw new HttpsError('resource-exhausted', 'Fotoanalysen har nått dagens gräns. Prova igen i morgon.');
      tx.set(userRef, { day, n: used + 1 });
      tx.set(statRef, { n: total + 1 }, { merge: true });
      left = PER_USER_PER_DAY - used - 1;
    });

    const text = hint ? `${PROMPT}\n\nAnvändaren berättar: "${hint}"` : PROMPT;
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': AI_KEY.value(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1200,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text }
          ] }]
        })
      });
    } catch (e) {
      console.error('AI-anrop misslyckades', e);
      throw new HttpsError('unavailable', 'Kunde inte nå AI-tjänsten. Prova igen.');
    }
    if (!res.ok) {
      console.error('AI svarade', res.status, (await res.text()).slice(0, 500));
      throw new HttpsError('unavailable', 'AI-tjänsten svarade inte. Prova igen om en stund.');
    }
    const out = await res.json();
    const use = (out.content || []).find((c) => c.type === 'tool_use');
    const data = use?.input || {};
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 10).map((i) => ({
      name: String(i.name || 'Okänd').slice(0, 60),
      grams: Math.round(clamp(i.grams, 1, 3000)),
      liquid: !!i.liquid,
      kcal: Math.round(clamp(i.kcal, 0, 5000)),
      p: r1(clamp(i.protein, 0, 400)),
      c: r1(clamp(i.carbs, 0, 600)),
      f: r1(clamp(i.fat, 0, 400))
    }));
    return { isFood: data.is_food !== false && items.length > 0, note: String(data.note || '').slice(0, 200), items, left };
  }
);
