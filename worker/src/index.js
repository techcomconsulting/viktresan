// Viktresan AI – Cloudflare Worker.
// POST /analyze  – appen skickar ett foto av maten, AI:n (Claude) uppskattar kalorier och näring.
// GET  /stats    – antal foton (bara för admin).
// Bilden sparas inte. Inloggningen kontrolleras med Firebase-token.

const PROJECT = 'viktresan-25170';
const MODEL = 'claude-haiku-4-5-20251001';
const PER_USER_PER_DAY = 15;
const TOTAL_PER_DAY = 400;          // gratisnivån i Cloudflare tål ca 500 foton per dag
const MAX_IMAGE_CHARS = 2_000_000;  // ca 1,5 MB
const ORIGINS = ['https://viktresan.online', 'https://www.viktresan.online', 'https://admin.viktresan.online', 'http://localhost:8765'];

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
            name: { type: 'string' }, grams: { type: 'number' }, liquid: { type: 'boolean' },
            kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }
          },
          required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat']
        }
      }
    },
    required: ['is_food', 'items']
  }
};

// ---------- Hjälpare ----------
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
const dayOffset = (n) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date(Date.now() - n * 864e5));
const clamp = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const r1 = (n) => Math.round(n * 10) / 10;

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });
const fail = (req, status, code, message) => json(req, { error: { code, message } }, status);

// ---------- Kontrollera Firebase-inloggningen ----------
let keyCache = { at: 0, keys: [] };
async function googleKeys() {
  if (Date.now() - keyCache.at < 3600e3 && keyCache.keys.length) return keyCache.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const j = await r.json();
  keyCache = { at: Date.now(), keys: j.keys || [] };
  return keyCache.keys;
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(new TextDecoder().decode(b64u(parts[0]))); body = JSON.parse(new TextDecoder().decode(b64u(parts[1]))); } catch { return null; }
  if (head.alg !== 'RS256') return null;
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || body.aud !== PROJECT || body.iss !== `https://securetoken.google.com/${PROJECT}` || !body.sub || body.exp < now || body.iat > now + 300) return null;
  return body.sub;
}

// Läs ett dokument i Firestore som den inloggade användaren (reglerna gäller).
async function readDoc(token, path) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  return (await r.json()).fields || {};
}

// ---------- Fotoanalys ----------
async function analyze(req, env, uid, token) {
  let data;
  try { data = await req.json(); } catch { return fail(req, 400, 'invalid-argument', 'Fel i anropet.'); }
  const image = String(data.image || '');
  const mime = String(data.mime || 'image/jpeg');
  const hint = String(data.hint || '').slice(0, 200);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return fail(req, 400, 'invalid-argument', 'Fel bildformat.');
  if (image.length < 1000 || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return fail(req, 400, 'invalid-argument', 'Bilden gick inte att läsa.');

  const cfg = await readDoc(token, 'config/app');
  if (!cfg || !cfg.aiPhoto || cfg.aiPhoto.booleanValue !== true) return fail(req, 403, 'failed-precondition', 'Fotoanalys är avstängd just nu.');
  if (!env.ANTHROPIC_API_KEY) return fail(req, 503, 'unavailable', 'Fotoanalysen är inte klar än.');

  // Räkna foton per person och totalt (sparas i högst 2 dagar).
  const day = today();
  const uKey = `u:${uid}:${day}`, sKey = `s:${day}`;
  const used = Number(await env.KV.get(uKey)) || 0;
  const total = Number(await env.KV.get(sKey)) || 0;
  if (used >= PER_USER_PER_DAY) return fail(req, 429, 'resource-exhausted', `Du har använt dagens ${PER_USER_PER_DAY} foton. Prova igen i morgon.`);
  if (total >= TOTAL_PER_DAY) return fail(req, 429, 'resource-exhausted', 'Fotoanalysen har nått dagens gräns. Prova igen i morgon.');

  const text = hint ? `${PROMPT}\n\nAnvändaren berättar: "${hint}"` : PROMPT;
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1200, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
          { type: 'text', text }
        ] }]
      })
    });
  } catch (e) {
    console.error('AI-anrop misslyckades', String(e));
    return fail(req, 503, 'unavailable', 'Kunde inte nå AI-tjänsten. Prova igen.');
  }
  if (!res.ok) {
    console.error('AI svarade', res.status, (await res.text()).slice(0, 400));
    return fail(req, 503, 'unavailable', 'AI-tjänsten svarade inte. Prova igen om en stund.');
  }
  // Räkna bara foton som faktiskt analyserades.
  await Promise.all([
    env.KV.put(uKey, String(used + 1), { expirationTtl: 172800 }),
    env.KV.put(sKey, String(total + 1), { expirationTtl: 40 * 86400 })
  ]);
  const out = await res.json();
  const use = (out.content || []).find((c) => c.type === 'tool_use');
  const d = use?.input || {};
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 10).map((i) => ({
    name: String(i.name || 'Okänd').slice(0, 60),
    grams: Math.round(clamp(i.grams, 1, 3000)),
    liquid: !!i.liquid,
    kcal: Math.round(clamp(i.kcal, 0, 5000)),
    p: r1(clamp(i.protein, 0, 400)), c: r1(clamp(i.carbs, 0, 600)), f: r1(clamp(i.fat, 0, 400))
  }));
  return json(req, { isFood: d.is_food !== false && items.length > 0, note: String(d.note || '').slice(0, 200), items, left: PER_USER_PER_DAY - used - 1 });
}

// ---------- Statistik för admin ----------
async function stats(req, env, uid, token) {
  const admin = await readDoc(token, `admins/${uid}`);
  if (!admin) return fail(req, 403, 'permission-denied', 'Bara för admin.');
  const days = await Promise.all(Array.from({ length: 30 }, (_, i) => env.KV.get(`s:${dayOffset(i)}`).then((v) => Number(v) || 0)));
  const sum = (n) => days.slice(0, n).reduce((a, b) => a + b, 0);
  return json(req, { today: days[0], d7: sum(7), d30: sum(30), keyOk: !!env.ANTHROPIC_API_KEY, perUser: PER_USER_PER_DAY, perDay: TOTAL_PER_DAY });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') return json(req, { ok: true, service: 'viktresan-ai' });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const uid = await verifyToken(token).catch(() => null);
    if (!uid) return fail(req, 401, 'unauthenticated', 'Du måste vara inloggad.');
    if (url.pathname === '/analyze' && req.method === 'POST') return analyze(req, env, uid, token);
    if (url.pathname === '/stats' && req.method === 'GET') return stats(req, env, uid, token);
    return fail(req, 404, 'not-found', 'Finns inte.');
  }
};
