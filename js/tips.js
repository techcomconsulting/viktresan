// Tips och prylar: reklamlänkar till butiker (affiliate).
// Regler: bara saker som hjälper på riktigt. Inga piller, pulver som lovar viktnedgång eller "mirakelmedel".
// Alla länkar märks "Reklamlänk". Ingen data om användaren skickas med.
//
// Länkarna läggs in på adminsidan (#/admin) och sparas i Firestore (samlingen "tips").
// Listan nedan är standardtipsen. Tom url = tipset visas inte för användarna.
import { db, collection, getDocs, doc, setDoc, serverTimestamp, increment } from './firebase.js';
import { esc, icon } from './ui.js';

export const TIP_CATS = [
  ['mata', 'Mäta', 'chart'],
  ['trana', 'Träna', 'run'],
  ['ata', 'Äta och dricka', 'food']
];

export const DEFAULT_TIPS = [
  { id: 'vag', cat: 'mata', title: 'Personvåg', why: 'Väg dig samma tid varje vecka, gärna på morgonen. En enkel digital våg räcker gott.', store: '', url: '' },
  { id: 'kroppsvag', cat: 'mata', title: 'Våg som mäter fett och muskler', why: 'Bra om du vill se mer än bara kilon. Siffrorna är ungefärliga, men visar hur det går över tid.', store: '', url: '' },
  { id: 'mattband', cat: 'mata', title: 'Måttband för kroppen', why: 'Midjan kan minska fast vikten står still. Ett mjukt måttband gör det lätt att mäta själv.', store: '', url: '' },
  { id: 'koksvag', cat: 'mata', title: 'Köksvåg', why: 'Gör det mycket lättare att räkna kalorier rätt. Väg maten några gånger, sedan lär du dig ögonmåttet.', store: '', url: '' },
  { id: 'skor', cat: 'trana', title: 'Bra promenadskor', why: 'Promenader är den enklaste träningen. Sköna skor gör att du orkar gå längre.', store: '', url: '' },
  { id: 'klocka', cat: 'trana', title: 'Aktivitetsklocka', why: 'Räknar steg och kalorier. Skriv in siffran under Träning, så får du äta lite mer.', store: '', url: '' },
  { id: 'gummiband', cat: 'trana', title: 'Träningsband', why: 'Styrketräning hemma utan gym. Billigt, tar ingen plats och passar alla nivåer.', store: '', url: '' },
  { id: 'flaska', cat: 'ata', title: 'Vattenflaska', why: 'Lättare att dricka tillräckligt när flaskan alltid står framme.', store: '', url: '' },
  { id: 'matlador', cat: 'ata', title: 'Matlådor', why: 'Laga mat i förväg, så blir det lättare att äta bra även stressiga dagar.', store: '', url: '' },
  { id: 'matkasse', cat: 'ata', title: 'Matkasse', why: 'Färdiga recept och rätt mängd råvaror hem till dörren. Många har kalorisnåla alternativ.', store: '', url: '' }
];

// Aktuella tips: standardtipsen plus det som admin har ändrat eller lagt till.
let live = DEFAULT_TIPS.map((t) => ({ ...t, visible: true }));
export const tipsNow = () => live;

export async function loadTips() {
  try {
    const s = await getDocs(collection(db, 'tips'));
    const saved = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
    const merged = DEFAULT_TIPS.map((t) => ({ ...t, visible: true, ...(saved[t.id] || {}), id: t.id }));
    const extra = s.docs.filter((d) => !DEFAULT_TIPS.some((t) => t.id === d.id)).map((d) => ({ visible: true, ...d.data(), id: d.id }))
      .sort((a, b) => (a.created?.toMillis?.() || 0) - (b.created?.toMillis?.() || 0));
    live = [...merged, ...extra].filter((t) => !t.deleted);
  } catch { /* behåll det vi har */ }
  return live;
}

// Bara säkra länkar (https).
export const validUrl = (u) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim());

export async function saveTip(t) {
  const id = t.id || ('t' + Date.now().toString(36));
  const data = { cat: t.cat, title: t.title, why: t.why || '', store: t.store || '', url: validUrl(t.url) ? t.url.trim() : '', visible: t.visible !== false, deleted: false, updated: serverTimestamp() };
  if (!t.id) data.created = serverTimestamp();
  await setDoc(doc(db, 'tips', id), data, { merge: true });
  return id;
}
export async function removeTip(id) {
  await setDoc(doc(db, 'tips', id), { deleted: true, updated: serverTimestamp() }, { merge: true });
}

export const tipById = (id) => live.find((t) => t.id === id);

// Räknar klick på en reklamlänk (bara antal, inte vem).
export function recordTipClick(id) {
  try { setDoc(doc(db, 'tipClicks', String(id)), { count: increment(1) }, { merge: true }).catch(() => {}); } catch { /* ok */ }
}

// Ett litet, diskret tips på rätt ställe i appen. Visas bara om länken finns.
export function tipLink(id, text) {
  const t = tipById(id);
  if (!t || !t.url || t.visible === false) return '';
  return `<a href="${esc(t.url)}" data-tip="${esc(t.id)}" target="_blank" rel="sponsored noopener" class="small" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none">
    ${icon('sparkle', 14)}<span>${text} <span style="text-decoration:underline">${esc(t.title)}</span></span>
    <span class="chip neutral" style="font-size:10px;padding:2px 6px">Reklamlänk</span></a>`;
}
