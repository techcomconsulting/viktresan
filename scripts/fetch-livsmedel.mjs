// Hämtar Livsmedelsverkets livsmedelsdatabas och sparar en liten fil till appen.
// Körs av GitHub (se .github/workflows/livsmedel.yml). Källa: Livsmedelsverket, CC BY 4.0.
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) return r.json();
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
}

const list = [];
for (let offset = 0; ; offset += 500) {
  const page = await get(`${BASE}/livsmedel?offset=${offset}&limit=500&sprak=1`);
  list.push(...page.livsmedel);
  if (page.livsmedel.length < 500) break;
}
console.log('Livsmedel:', list.length);

const pick = (rows, code) => {
  const r = rows.find((x) => x.euroFIRkod === code && (code !== 'ENERC' || x.enhet === 'kcal'));
  return r ? Math.round(Number(r.varde) * 10) / 10 : null;
};

const out = [];
let i = 0;
async function worker() {
  while (i < list.length) {
    const item = list[i++];
    try {
      const rows = await get(`${BASE}/livsmedel/${item.nummer}/naringsvarden?sprak=1`);
      const kcal = pick(rows, 'ENERC');
      if (kcal == null) continue;
      out.push([item.nummer, item.namn, kcal, pick(rows, 'PROT') ?? 0, pick(rows, 'CHO') ?? 0, pick(rows, 'FAT') ?? 0]);
    } catch (e) {
      console.warn('Hoppar över', item.nummer, e.message);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
out.sort((a, b) => a[1].localeCompare(b[1], 'sv'));

await mkdir('data', { recursive: true });
await writeFile('data/livsmedel.json', JSON.stringify({
  source: 'Livsmedelsverkets livsmedelsdatabas, CC BY 4.0',
  updated: new Date().toISOString().slice(0, 10),
  fields: ['nummer', 'namn', 'kcal', 'protein', 'kolhydrater', 'fett'],
  items: out
}));
console.log('Sparade', out.length, 'livsmedel');
