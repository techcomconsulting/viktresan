// Startsida för den som inte är inloggad: vad är Viktresan?
import { icon } from '../ui.js';
import { COMPANY, CONTACT, SITE } from '../brand.js';
import { socialButtons } from '../invite.js';

// Små bilder av appen, ritade med kod.
const phone = (inner, tilt = 0) => `<div aria-hidden="true" style="width:100%;max-width:260px;margin:0 auto;border-radius:34px;background:#1B1D1C;padding:8px;box-shadow:0 18px 40px rgba(62,42,92,.25);transform:rotate(${tilt}deg)">
  <div style="border-radius:27px;background:var(--bg);padding:16px 12px 14px;display:flex;flex-direction:column;gap:10px;min-height:300px">${inner}</div></div>`;

const mini = (html, extra = '') => `<div style="background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:12px;${extra}">${html}</div>`;

const spark = `<svg viewBox="0 0 200 60" width="100%" height="60" aria-hidden="true">
  <path d="M0 12 C30 14 40 22 60 24 S100 30 120 38 S170 46 200 50 L200 60 L0 60 Z" fill="#F3EEFA"/>
  <path d="M0 12 C30 14 40 22 60 24 S100 30 120 38 S170 46 200 50" fill="none" stroke="#7B5EA7" stroke-width="3" stroke-linecap="round"/>
  <circle cx="200" cy="50" r="4" fill="#7B5EA7"/></svg>`;

const heroPhone = phone(`
  <div class="between"><b style="font-size:15px">Hej Anna!</b><span class="chip good" style="font-size:11px">Vecka 6</span></div>
  ${mini(`<span class="small muted">Sedan start</span>
    <div style="font-size:30px;font-weight:700;color:var(--accent-dark);letter-spacing:-.02em">−4,2 %</div>${spark}`)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${mini('<span class="small muted" style="font-size:11px">Midja</span><div style="font-weight:700">−5 cm</div>')}
    ${mini('<span class="small muted" style="font-size:11px">Kvar idag</span><div style="font-weight:700;color:#2E7A5C">640 kcal</div>')}
  </div>
  ${mini(`<div class="row" style="gap:8px"><span style="width:28px;height:28px;border-radius:14px;background:var(--pink-soft);color:var(--pink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">M</span>
    <span class="small" style="line-height:1.3"><b>Martin</b> peppade dig 💪</span></div>`)}`, -2);

const ring = `<svg viewBox="0 0 80 80" width="74" height="74" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="#F0EDE8" stroke-width="9"/>
  <circle cx="40" cy="40" r="32" fill="none" stroke="#2E7A5C" stroke-width="9" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="70" transform="rotate(-90 40 40)"/>
  <text x="40" y="44" text-anchor="middle" font-size="15" font-weight="700" fill="#1B1D1C">640</text></svg>`;

const barcode = `<svg viewBox="0 0 120 50" width="120" height="50" aria-hidden="true">${[3,2,1,3,1,2,2,1,3,1,1,2,3,1,2,1,3,2,1,1,2,3,1,2].reduce((a, w, i) => {
  a.s += i % 2 === 0 ? `<rect x="${a.x}" y="0" width="${w * 1.6}" height="50" fill="#1B1D1C"/>` : ''; a.x += w * 1.6 + 0.6; return a; }, { x: 2, s: '' }).s}</svg>`;

const FEATURES = [
  ['Vikt och mått', 'Väg dig och mät midja, höft, arm och lår. Se hur det går i en graf.',
    mini(`<span class="small muted">Vikt</span>${spark}`)],
  ['Kost och vatten', 'Räkna kalorier, protein och vatten. Få förslag på ett kalorimål som passar dig.',
    mini(`<div class="row" style="gap:12px">${ring}<div class="stack" style="gap:2px"><b>kcal kvar</b><span class="small muted">💧 1,25 liter vatten</span></div></div>`)],
  ['Skanna streckkoden', 'Håll kameran mot förpackningen. Appen hittar maten direkt.',
    mini(`<div class="row" style="gap:12px;justify-content:center"><div style="border:2.5px solid var(--accent);border-radius:12px;padding:6px 8px">${barcode}</div></div>`)],
  ['Träning', 'Lägg in promenad, gym eller kalorier från klockan. Då får du äta lite mer.',
    mini(`<div class="row" style="gap:10px"><span style="width:34px;height:34px;border-radius:10px;background:#EAF4EE;color:#1F5A41;display:flex;align-items:center;justify-content:center">${icon('run', 18, 2)}</span><span class="grow"><b>Promenad</b><br><span class="small muted">45 min</span></span><b style="color:#2E7A5C">+223</b></div>`)],
  ['Peppa varandra', 'Dela med familj och vänner. Skriv inlägg, kommentera och ge hjärtan.',
    mini(`<div class="small" style="line-height:1.4"><b>Anna</b> · nytt inlägg<br>Ner 1 % den här veckan! 🎉</div><div class="row" style="gap:6px;margin-top:8px;font-size:15px">❤️ 💪 👏 <span class="small muted">3 kommentarer</span></div>`)],
  ['Bilder och behandling', 'Spara före- och efterbilder. Håll koll på mediciner och behandlingar.',
    mini(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${['Före', 'Nu'].map((t) => `<div style="aspect-ratio:4/3;border-radius:10px;background:linear-gradient(160deg,var(--accent-soft),var(--pink-soft));display:flex;align-items:flex-end;padding:6px"><span class="chip neutral" style="font-size:11px;padding:3px 8px">${t}</span></div>`).join('')}</div>`)]
];

export const FAQ = [
  ['Kostar det något?', 'Nej. Viktresan är gratis att använda.'],
  ['Vem ser mina uppgifter?', 'Bara du. Andra ser bara det du själv väljer att dela. Vi säljer aldrig dina uppgifter och visar ingen reklam.'],
  ['Måste jag visa hur mycket jag väger?', 'Nej. Du kan välja att bara dela <b>procent</b>, till exempel "−4 %". Eller inte dela något alls.'],
  ['Fungerar det på Android?', 'Ja. Viktresan fungerar på iPhone, Android och dator. Du behöver inte ladda ner något från App Store eller Google Play.'],
  ['Hur lägger jag appen på hemskärmen?', '<b>iPhone:</b> öppna i Safari, tryck på dela-knappen och välj <b>Lägg till på hemskärmen</b>.<br><b>Android:</b> öppna i Chrome, tryck på menyn ⋮ och välj <b>Lägg till på startskärmen</b>.'],
  ['Kan jag radera allt?', 'Ja. Under Profil kan du ladda ner eller radera alla dina uppgifter. Då försvinner allt direkt.'],
  ['Ersätter appen läkare eller dietist?', 'Nej. Kalorier och mål är uppskattningar. Prata med vården innan du gör stora förändringar.']
];

export async function landingView(el) {
  const cta = (big) => `<div class="stack" style="gap:10px">
    <a class="btn primary block" href="#/registrera" style="${big ? 'height:56px;font-size:18px' : ''}">Skapa konto gratis</a>
    <a class="btn outline block" href="#/login">Jag har redan ett konto</a></div>`;

  el.innerHTML = `<div class="screen no-nav" style="gap:28px;max-width:560px">
    <section class="stack-lg" style="gap:18px">
      <div class="row" style="gap:10px"><img src="icons/icon-192.png" alt="" width="40" height="40" style="border-radius:12px"><b style="font-size:20px">Viktresan</b>
        <a href="#/login" class="btn ghost sm" style="margin-left:auto">Logga in</a></div>
      <h1 style="font-size:36px;line-height:1.08">Gå ner i vikt.<br><span style="color:var(--accent)">Tillsammans.</span></h1>
      <p style="font-size:18px;line-height:1.45;color:var(--muted)">Följ din vikt, dina mått och din kost. Peppa varandra i familjen. Du väljer själv vad du delar.</p>
      ${cta(true)}
      <div class="row" style="gap:14px;flex-wrap:wrap;font-size:14px;color:var(--muted)">
        <span class="row" style="gap:4px">${icon('check', 16, 2.4)}Gratis</span>
        <span class="row" style="gap:4px">${icon('check', 16, 2.4)}Privat</span>
        <span class="row" style="gap:4px">${icon('check', 16, 2.4)}Ingen reklam</span>
      </div>
    </section>

    <div style="padding:6px 0 10px">${heroPhone}</div>

    <section class="stack-lg">
      <h2 style="font-size:24px">Så fungerar det</h2>
      ${[['1', 'Skapa ett konto', 'Det tar en minut. Ingen app att ladda ner.'],
         ['2', 'Väg och mät dig', 'Skriv in din vikt och dina mått när du vill.'],
         ['3', 'Dela om du vill', 'Bjud in familj och vänner. Peppa varandra.']].map(([n, t, d]) => `
        <div class="row" style="gap:14px;align-items:flex-start">
          <span style="width:40px;height:40px;border-radius:20px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0">${n}</span>
          <div class="stack" style="gap:2px"><b style="font-size:17px">${t}</b><span class="muted" style="font-size:15px">${d}</span></div></div>`).join('')}
    </section>

    <section class="stack-lg">
      <h2 style="font-size:24px">Det här kan du göra</h2>
      ${FEATURES.map(([t, d, pic]) => `<div class="card stack" style="gap:12px;background:linear-gradient(180deg,#fff,#FBF9FD)">
        ${pic}
        <div class="stack" style="gap:4px"><b style="font-size:18px">${t}</b><span class="muted" style="font-size:15px;line-height:1.45">${d}</span></div></div>`).join('')}
    </section>

    <section class="card stack-lg" style="background:var(--accent-soft);box-shadow:none">
      <div class="row" style="gap:10px;color:var(--accent-ink)">${icon('lock', 26)}<h2 style="font-size:22px;color:var(--accent-ink)">Tryggt och privat</h2></div>
      ${['Allt du sparar är <b>privat</b> från början.',
         'Du väljer <b>vem</b> som får se <b>vad</b>. Vikt, mått, kost, bilder – var för sig.',
         'Du kan dela <b>bara procent</b>, utan att visa kilo.',
         'Vi följer <b>GDPR</b>. Du kan ladda ner och radera allt när du vill.'].map((t) => `
        <div class="row" style="gap:10px;align-items:flex-start;font-size:16px;line-height:1.45;color:var(--accent-ink)"><span style="flex-shrink:0;margin-top:2px">${icon('check', 20, 2.4)}</span><span>${t}</span></div>`).join('')}
      <a href="#/integritet" style="font-weight:600">Läs mer om integritet</a>
    </section>

    <section class="stack-lg">
      <h2 style="font-size:24px">Vanliga frågor</h2>
      <div class="card flush">
        ${FAQ.map(([q, a], i) => `<details style="${i ? 'border-top:1px solid var(--line);' : ''}">
          <summary style="list-style:none;cursor:pointer;padding:16px 18px;font-weight:600;font-size:16px;display:flex;justify-content:space-between;gap:10px;align-items:center">${q}<span aria-hidden="true" style="color:var(--accent);font-size:22px;line-height:1">+</span></summary>
          <p style="padding:0 18px 16px;font-size:15px;line-height:1.5;color:var(--muted)">${a}</p></details>`).join('')}
      </div>
    </section>

    <section class="card stack-lg" style="text-align:center;background:linear-gradient(135deg,#F6EEFA,#FCEFF4);box-shadow:none">
      <h2 style="font-size:24px">Redo att börja?</h2>
      <p class="muted" style="font-size:16px">Det är gratis och tar en minut.</p>
      ${cta(false)}
    </section>

    <section class="stack-lg">
      <h2 style="font-size:20px">Känner du någon som vill följa med?</h2>
      ${socialButtons(SITE, 'Viktresan – en gratis app för att gå ner i vikt tillsammans 💜')}
    </section>

    <footer class="stack" style="gap:6px;text-align:center;font-size:13px;color:var(--muted);padding-bottom:12px">
      <span>Viktresan görs av ${COMPANY}</span>
      <span><a href="#/villkor">Villkor</a> · <a href="#/integritet">Integritet</a> · <a href="mailto:${CONTACT}">Kontakt</a></span>
    </footer>
  </div>`;
}
