// Hämtar produkter och butiksinställningar från Firestore (utan inloggning).
// Använder Firestores vanliga webbadress i stället för Firebase-koden, så sidan laddar snabbt.
const PROJECT = 'viktresan-25170';
const KEY = 'AIzaSyCsiVgbTHXX-SUDGNXGP09RfXOdFTOVP3Q';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// Gör om Firestores format till vanliga värden.
function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return fields(v.mapValue.fields || {});
  return null;
}
const fields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));
const fromDoc = (d) => ({ id: d.name.split('/').pop(), ...fields(d.fields) });

let cache = null;
export async function loadProducts() {
  if (cache) return cache;
  if (new URLSearchParams(location.search).has('demo')) {
    cache = (await import('./demo.js')).DEMO_PRODUCTS;
    return cache;
  }
  const r = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'products' }],
      where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } },
      limit: 300
    } })
  });
  if (!r.ok) throw new Error('Kunde inte hämta produkterna.');
  const rows = await r.json();
  cache = rows.filter((x) => x.document).map((x) => fromDoc(x.document))
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.title).localeCompare(String(b.title), 'sv'));
  return cache;
}

export const DEFAULT_SETTINGS = { freeShippingOver: 499, shippingPrice: 49, open: false, notice: '', categories: [] };
let settings = null;
export async function loadSettings() {
  if (settings) return settings;
  if (new URLSearchParams(location.search).has('demo')) return (settings = { ...DEFAULT_SETTINGS, ...(await import('./demo.js')).DEMO_SETTINGS });
  try {
    const r = await fetch(`${BASE}/shop/settings?key=${KEY}`);
    settings = r.ok ? { ...DEFAULT_SETTINGS, ...fromDoc(await r.json()) } : { ...DEFAULT_SETTINGS };
  } catch { settings = { ...DEFAULT_SETTINGS }; }
  return settings;
}
