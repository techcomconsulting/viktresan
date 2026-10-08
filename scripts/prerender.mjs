// Lägger startsidans text direkt i index.html så att Google ser den utan att köra appen.
// Kör: node scripts/prerender.mjs   (görs automatiskt av GitHub när startsidan ändras)
import fs from 'fs';
import { landingView, FAQ } from '../js/views/landing.js';

const el = { innerHTML: '' };
await landingView(el);
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const ld = [
  {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Viktresan', url: 'https://viktresan.online/',
    applicationCategory: 'HealthApplication', operatingSystem: 'iOS, Android, Windows, macOS', inLanguage: 'sv',
    description: 'Gratis viktapp för hela familjen. Följ vikt, mått, kalorier, träning och blodvärden. Peppa varandra och välj själv vad du delar.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
    publisher: { '@type': 'Organization', name: 'Techcom Consulting AB' }
  },
  {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } }))
  }
];
let html = fs.readFileSync('index.html', 'utf8');
const put = (name, body) => {
  const re = new RegExp(`<!--${name}-->[\\s\\S]*?<!--/${name}-->`);
  if (!re.test(html)) throw new Error('Saknar markering ' + name);
  html = html.replace(re, `<!--${name}-->${body}<!--/${name}-->`);
};
put('LANDING', `<div id="seo">${el.innerHTML}</div>`);
put('JSONLD', ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n'));
fs.writeFileSync('index.html', html);
console.log('index.html uppdaterad', el.innerHTML.length, 'tecken');
