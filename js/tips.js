// Tips och prylar: reklamlänkar till butiker (affiliate).
// Regler: bara saker som hjälper på riktigt. Inga piller, pulver som lovar viktnedgång eller "mirakelmedel".
// Alla länkar märks "Reklamlänk". Ingen data om användaren skickas med.
//
// Lägg in länken från Adtraction/Awin/Partner-ads i "url". Tom url = tipset visas inte för användarna.
import { esc, icon } from './ui.js';

export const TIP_CATS = [
  ['mata', 'Mäta', 'chart'],
  ['trana', 'Träna', 'run'],
  ['ata', 'Äta och dricka', 'food']
];

export const TIPS = [
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

export const tipById = (id) => TIPS.find((t) => t.id === id);

// Ett litet, diskret tips på rätt ställe i appen. Visas bara om länken finns.
export function tipLink(id, text) {
  const t = tipById(id);
  if (!t || !t.url) return '';
  return `<a href="${esc(t.url)}" target="_blank" rel="sponsored noopener" class="small" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none">
    ${icon('sparkle', 14)}<span>${text} <span style="text-decoration:underline">${esc(t.title)}</span></span>
    <span class="chip neutral" style="font-size:10px;padding:2px 6px">Reklamlänk</span></a>`;
}
