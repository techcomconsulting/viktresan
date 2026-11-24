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
  <path class="line" d="M0 12 C30 14 40 22 60 24 S100 30 120 38 S170 46 200 50" fill="none" stroke="#7B5EA7" stroke-width="3" stroke-linecap="round"/>
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
  ['Märken och utmaningar', 'Få märken och konfetti när du klarar ett delmål. Utmana familjen – vem går ner flest procent? Appen visar också när du når ditt mål.',
    mini(`<div class="row" style="gap:8px;font-size:26px;justify-content:center">🌱 💪 ⭐ 📏 🔥</div>
      <div class="stack" style="gap:4px;margin-top:8px">${[['🥇', 'Anna', '−4,1 %'], ['🥈', 'Martin', '−3,6 %'], ['🥉', 'Bo', '−2,2 %']].map(([m, n, v]) => `<div class="between" style="font-size:14px"><span>${m} ${n}</span><b style="color:var(--accent)">${v}</b></div>`).join('')}</div>`)],
  ['Blodvärden och blodtryck', 'Skriv in blodsocker, kolesterol, blodtryck och puls. Följ hur värdena ändras över tid.',
    mini(`<div class="between" style="align-items:baseline"><span class="small muted">Långtidssocker</span><span class="chip" style="background:#E6F2EC;color:#1F5A41;font-size:11px">Inom normal</span></div>
      <div style="font-size:24px;font-weight:700">40 <span class="small muted">mmol/mol</span></div>
      <svg viewBox="0 0 200 50" style="width:100%;height:auto;display:block" aria-hidden="true"><rect x="0" y="22" width="200" height="28" rx="6" fill="#E6F2EC"/><polyline points="8,8 100,20 192,34" fill="none" stroke="#7B5EA7" stroke-width="3" stroke-linecap="round"/><circle cx="192" cy="34" r="4.5" fill="#fff" stroke="#7B5EA7" stroke-width="3"/></svg>`)],
  ['Rapport till vården', 'Gör en snygg sammanfattning till läkaren. Spara som PDF eller skicka en länk som slutar gälla av sig själv.',
    mini(`<div class="stack" style="gap:6px"><span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--accent)">HÄLSORAPPORT</span>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${[['Vikt', '−10 kg'], ['BMI', '29,7'], ['Midja', '−12 cm']].map(([l, v]) => `<div style="background:var(--accent-soft);border-radius:8px;padding:6px"><div style="font-size:10px;color:var(--accent-ink)">${l}</div><b style="font-size:13px">${v}</b></div>`).join('')}</div>
      <div class="row" style="gap:6px"><span class="chip neutral" style="font-size:11px">PDF</span><span class="chip neutral" style="font-size:11px">Länk i 7 dagar</span></div></div>`)],
  ['Bilder och behandling', 'Spara före- och efterbilder. Håll koll på mediciner och behandlingar.',
    mini(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${['Före', 'Nu'].map((t) => `<div style="aspect-ratio:4/3;border-radius:10px;background:linear-gradient(160deg,var(--accent-soft),var(--pink-soft));display:flex;align-items:flex-end;padding:6px"><span class="chip neutral" style="font-size:11px;padding:3px 8px">${t}</span></div>`).join('')}</div>`)]
];

export const FAQ = [
  ['Kostar det något?', 'Nej. Viktresan är gratis att använda.'],
  ['Vem ser mina uppgifter?', 'Bara du. Andra ser bara det du själv väljer att dela. Vi säljer aldrig dina uppgifter och följer inte vad du gör på andra sidor.'],
  ['Hur tjänar ni pengar?', 'Under <b>Tips och prylar</b> finns tydligt märkta reklamlänkar till butiker. Köper du något där får vi en liten ersättning. Det kostar inget extra för dig, och vi lämnar aldrig ut uppgifter om dig.'],
  ['Måste jag visa hur mycket jag väger?', 'Nej. Du kan välja att bara dela <b>procent</b>, till exempel "−4 %". Eller inte dela något alls.'],
  ['Fungerar det på Android?', 'Ja. Viktresan fungerar på iPhone, Android och dator. Du behöver inte ladda ner något från App Store eller Google Play.'],
  ['Hur lägger jag appen på hemskärmen?', '<b>iPhone:</b> öppna i Safari, tryck på dela-knappen och välj <b>Lägg till på hemskärmen</b>.<br><b>Android:</b> öppna i Chrome, tryck på menyn ⋮ och välj <b>Lägg till på startskärmen</b>.'],
  ['Kan jag radera allt?', 'Ja. Under Profil kan du ladda ner eller radera alla dina uppgifter. Då försvinner allt direkt.'],
  ['Kan jag visa mina värden för läkaren?', 'Ja. Under <b>Rapport till vården</b> gör du en sammanfattning av vikt, BMI, mått och blodvärden. Spara den som PDF eller skicka en länk. Länken slutar gälla av sig själv och kan stängas av när du vill.'],
  ['Ersätter appen läkare eller dietist?', 'Nej. Kalorier och mål är uppskattningar. Prata med vården innan du gör stora förändringar.']
];


// ---------- Ny startsida (premium) ----------
// En riktig bild eller film kan läggas in här senare, t.ex. 'assets/hero.webp'. Tomt = tecknad natur.
const HERO_PHOTO = '';

const tick = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const arrow = `<svg class="arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

// Tecknat landskap: en stig genom gröna kullar, en prick som vandrar längs stigen.
const scene = `<svg class="scene" viewBox="0 0 400 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="lpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4EFE3"/><stop offset="1" stop-color="#E3EFE3"/></linearGradient>
    <linearGradient id="lpH1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9D3BC"/><stop offset="1" stop-color="#8CC2A5"/></linearGradient>
    <linearGradient id="lpH2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9C7C"/><stop offset="1" stop-color="#4A8566"/></linearGradient>
    <linearGradient id="lpH3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E5C47"/><stop offset="1" stop-color="#1E3B2F"/></linearGradient>
  </defs>
  <rect width="400" height="440" fill="url(#lpSky)"/>
  <circle class="sun" cx="300" cy="92" r="38" fill="#F6D9A8" opacity=".9"/>
  <g class="cloud" opacity=".9"><ellipse cx="60" cy="70" rx="38" ry="12" fill="#fff"/><ellipse cx="82" cy="62" rx="22" ry="12" fill="#fff"/></g>
  <g class="cloud c2" opacity=".75"><ellipse cx="40" cy="128" rx="30" ry="9" fill="#fff"/><ellipse cx="58" cy="122" rx="16" ry="9" fill="#fff"/></g>
  <path d="M0 230 C70 190 140 205 210 220 S340 185 400 200 L400 440 L0 440 Z" fill="url(#lpH1)"/>
  <path d="M0 290 C90 250 170 270 250 285 S360 262 400 272 L400 440 L0 440 Z" fill="url(#lpH2)"/>
  <g fill="#2E5C47">${[[46, 262], [70, 256], [330, 252], [356, 258], [304, 260]].map(([x, y]) => `<path d="M${x} ${y} l9 -26 l9 26 z"/><rect x="${x + 7.5}" y="${y}" width="3" height="7"/>`).join('')}</g>
  <path d="M0 350 C110 320 200 345 290 360 S370 350 400 352 L400 440 L0 440 Z" fill="url(#lpH3)"/>
  <path id="lpPath" d="M40 440 C90 400 200 395 170 350 S120 300 210 285 S300 262 268 238" fill="none" stroke="#F4EFE3" stroke-width="7" stroke-linecap="round" opacity=".85" stroke-dasharray="1 12"/>
  <g class="walker"><circle r="7" fill="#fff"/><circle r="4" fill="#1E3B2F"/>
    <animateMotion dur="14s" repeatCount="indefinite" rotate="0" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#lpPath"/></animateMotion></g>
</svg>`;

// Rörlig bild: laddas först när den syns, utan ljud. Stillbilden visas tills filmen är redo.
// Klippen kommer från Mixkit (fri licens) och ligger i assets/video/.
const video = (name, cls = '') => `<video class="lp-video ${cls}" muted playsinline loop preload="none" aria-hidden="true" tabindex="-1"
  data-video="${name}" data-poster="assets/video/${name}.jpg"></video>`;

const featureRow = (kicker, title, points, art, flip) => `
  <div class="lp-feature${flip ? ' flip' : ''}">
    <div class="lp-feature-art draw" data-reveal><span class="lp-tag">Exempel</span>${art}</div>
    <div data-reveal>
      <span class="lp-kicker">${kicker}</span>
      <h3>${title}</h3>
      <ul>${points.map((p) => `<li>${tick}<span>${p}</span></li>`).join('')}</ul>
    </div>
  </div>`;

export async function landingView(el) {
  const F = Object.fromEntries(FEATURES.map(([t, d, pic]) => [t, { d, pic }]));
  el.innerHTML = `<div class="lp">
  <header class="lp-top"><div class="lp-wrap lp-top-in">
    <a class="lp-logo" href="#/valkommen"><img src="icons/icon-192.png" alt="" width="36" height="36">Viktresan</a>
    <a href="/butik/" class="lp-link hide-s">Butik</a>
    <a href="#/login" class="lp-link">Logga in</a>
  </div></header>

  <div class="lp-wrap">
    <section class="lp-hero">
      <div data-reveal>
        <span class="lp-eyebrow"><i></i>Webbapp för iPhone, Android och dator</span>
        <h1>Din viktresa.<br><span>Ditt tempo.</span></h1>
        <p class="lp-lead">Följ vikt, kost, mått och hälsa på ett och samma ställe. Samla dina framsteg och gör resan enklare tillsammans.</p>
        <div class="lp-ctas">
          <a class="lp-btn primary" href="#/registrera">Börja din resa ${arrow}</a>
          <a class="lp-btn ghost" href="#/login">Jag har redan ett konto</a>
        </div>
        <div class="lp-trust"><span>${tick}Privat från början</span><span>${tick}Data sparas i EU</span><span>${tick}Ingen spårning</span></div>
      </div>
      <div class="lp-art" data-reveal>
        ${HERO_PHOTO ? `<img class="photo" src="${HERO_PHOTO}" alt="" loading="eager" decoding="async">` : scene}
        ${video('jogga', 'hero')}<span class="lp-shade" aria-hidden="true"></span>
        <span class="lp-tag">Exempel</span>
        <div class="lp-float a">🏅 Nytt märke</div>
        <div class="lp-float b">💚 Peppad av familjen</div>
        <div class="lp-phone">${heroPhone}</div>
      </div>
    </section>

    <section class="lp-sec" style="padding-top:24px">
      <div data-reveal><span class="lp-kicker">Viktresan i korthet</span>
        <h2 class="lp-h2">Allt du behöver för resan, på ett ställe.</h2></div>
      <div class="lp-pillars">
        ${[['1', 'Följ din vikt och utveckling', 'Väg dig och mät dig när du vill. Se hela resan i grafer och procent.'],
           ['2', 'Registrera kost och hälsovärden', 'Skriv in dina måltider, vatten och träning. Följ blodtryck och andra värden över tid.'],
           ['3', 'Gör resan tillsammans', 'Bjud in familj och vänner. Peppa varandra och välj själv vad ni delar.']]
          .map(([n, t, d]) => `<div class="lp-pillar" data-reveal><span class="n">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
      </div>
    </section>

    <section class="lp-sec" style="padding-top:8px">
      ${featureRow('Viktutveckling', 'Se din resa ta form.',
        ['Väg dig och mät midja, höft, arm och lår.', 'Följ utvecklingen i en tydlig graf.', 'Lägg in en mätning i efterhand om du hamnat efter.'], F['Vikt och mått'].pic, false)}
      ${featureRow('Framsteg och mål', 'Fira varje steg på vägen.',
        ['Märken och konfetti när du når ett delmål.', 'Utmana familjen – vem går ner flest procent?', 'Se när du beräknas nå ditt mål.'], F['Märken och utmaningar'].pic, true)}
      ${featureRow('Kost och registrering', 'Koll på maten, utan krångel.',
        ['Registrera dina måltider och följ kalorier, protein och vatten.', 'Skanna streckkoden på förpackningen.', 'Saknas en vara? Lägg till den själv på några sekunder.'],
        `${F['Kost och vatten'].pic}${F['Skanna streckkoden'].pic}`, false)}
      ${featureRow('Hälsa och statistik', 'Dina värden, samlade över tid.',
        ['Följ blodsocker, kolesterol, blodtryck och puls.', 'Gör en sammanfattning till vården som PDF eller länk.', 'Du bestämmer själv vad som tas med.'],
        `${F['Blodvärden och blodtryck'].pic}${F['Rapport till vården'].pic}`, true)}
      ${featureRow('Tillsammans', 'Lättare när man inte är ensam.',
        ['Dela med familj och vänner – bara det du väljer.', 'Skriv inlägg, kommentera och ge hjärtan.', 'Dela bara procent om du inte vill visa kilo.'], F['Peppa varandra'].pic, false)}

      <div data-reveal style="margin-top:24px"><h3 style="font-size:24px;font-weight:800">Och lite till</h3></div>
      <div class="lp-more">
        ${['Träning', 'Bilder och behandling'].map((t) => `<div data-reveal><b>${t}</b><span>${F[t].d}</span></div>`).join('')}
        <div data-reveal><b>Recept och mediciner</b><span>Spara dina recept och kryssa i när du har tagit din medicin.</span></div>
      </div>
    </section>

    <section class="lp-moment" data-reveal>
      ${video('trana')}
      <span class="lp-shade" aria-hidden="true"></span>
      <div class="lp-moment-text">
        <span class="lp-kicker" style="color:var(--lp-mint)">Rörelse på ditt sätt</span>
        <h2>Promenad, löpning eller gym.</h2>
        <p>Lägg in din träning och se hur den påverkar dagen. Allt räknas.</p>
      </div>
    </section>

    <section class="lp-story" data-reveal>
      <span class="glow" aria-hidden="true"></span>
      <span class="lp-kicker" style="color:var(--lp-mint)">Varför Viktresan</span>
      <h2 style="margin-top:10px">Det handlar inte bara om kilon. <em>Det handlar om att må bättre.</em></h2>
      <p class="lp-sub">Varje resa ser olika ut. Viktresan hjälper dig att se dina framsteg, hitta vanor som håller och få stöd av dem du tycker om.</p>
      <div class="lp-values">
        ${[['🌱', 'Små framsteg', 'Varje litet steg räknas – och syns.'], ['🔁', 'Hållbara vanor', 'Vanor du kan leva med, i ditt eget tempo.'],
           ['🔥', 'Motivation', 'Märken, mål och pepp från familjen.'], ['🧭', 'Din egen resa', 'Ingen jämför – det är din väg.']]
          .map(([i, t, d]) => `<div data-reveal><span class="ic">${i}</span><b>${t}</b><span>${d}</span></div>`).join('')}
      </div>
    </section>

    <section class="lp-sec">
      <div data-reveal><span class="lp-kicker">Kom igång</span><h2 class="lp-h2">Tre steg. En minut.</h2></div>
      <div class="lp-steps">
        ${[['Skapa ett konto', 'Det tar en minut. Inget att ladda ner.'], ['Väg och mät dig', 'Skriv in din vikt och dina mått när du vill.'], ['Dela om du vill', 'Bjud in familj och vänner och peppa varandra.']]
          .map(([t, d]) => `<div class="lp-step" data-reveal><b>${t}</b><span>${d}</span></div>`).join('')}
      </div>
    </section>

    <section class="lp-safe" data-reveal>
      <div><span class="lp-kicker">Tryggt och privat</span><h2 class="lp-h2" style="font-size:clamp(28px,4vw,44px)">Dina uppgifter är dina.</h2>
        <p class="lp-sub" style="font-size:17px"><a href="#/integritet" style="font-weight:700">Läs integritetspolicyn</a> · <a href="#/villkor" style="font-weight:700">Villkor</a></p></div>
      <ul>
        ${['Allt du sparar är <b>privat</b> från början.', 'Du väljer <b>vem</b> som får se <b>vad</b> – vikt, mått, kost och bilder var för sig.',
           'Du kan dela <b>bara procent</b>, utan att visa kilo.', 'Vi följer <b>GDPR</b>. Allt sparas i <b>EU</b>, och du kan ladda ner och radera allt när du vill.']
          .map((t) => `<li>${tick}<span>${t}</span></li>`).join('')}
      </ul>
    </section>

    <section class="lp-sec">
      <div data-reveal><span class="lp-kicker">Webbapp</span><h2 class="lp-h2">Lägg appen på hemskärmen.</h2>
        <p class="lp-sub">Viktresan är en webbapp. Den fungerar direkt i webbläsaren och kan läggas på hemskärmen som en vanlig app.</p></div>
      <div class="lp-install">
        <div data-reveal><b> iPhone och iPad</b><span>Öppna viktresan.online i <b>Safari</b>, tryck på dela-knappen och välj <b>Lägg till på hemskärmen</b>.</span></div>
        <div data-reveal><b>Android</b><span>Öppna viktresan.online i <b>Chrome</b>, tryck på menyn ⋮ och välj <b>Lägg till på startskärmen</b>.</span></div>
      </div>
    </section>

    <section class="lp-sec" style="padding-top:8px">
      <div data-reveal><span class="lp-kicker">Frågor och svar</span><h2 class="lp-h2">Vanliga frågor</h2></div>
      <div class="lp-faq" data-reveal>
        ${FAQ.map(([q, a]) => `<details><summary>${q}<i aria-hidden="true">+</i></summary><p>${a}</p></details>`).join('')}
      </div>
    </section>

    <section class="lp-final">
      <div data-reveal><span class="lp-kicker">Redo?</span><h2 class="lp-h2">Börja din resa idag.</h2>
        <p class="lp-sub">Det tar en minut att komma igång.</p>
        <div class="lp-ctas"><a class="lp-btn primary" href="#/registrera">Börja din resa ${arrow}</a><a class="lp-btn ghost" href="#/login">Logga in</a></div></div>
      <div class="lp-share" data-reveal><b style="font-size:17px">Känner du någon som vill följa med?</b>
        ${socialButtons(SITE, 'Viktresan – en app för att gå ner i vikt tillsammans 💜')}</div>
    </section>
  </div>

  <footer class="lp-foot"><div class="lp-wrap">
    <span>Viktresan görs av ${COMPANY}</span><br>
    <span><a href="#/villkor">Villkor</a> · <a href="#/integritet">Integritet</a> · <a href="mailto:${CONTACT}">Kontakt</a> · <a href="/butik/">Butik</a></span><br><span style="font-size:12px">Filmer: Mixkit</span>
  </div></footer>
  </div>`;
  if (typeof window !== 'undefined' && el.querySelector) wireLanding(el);
}

// Mjuka animationer när delar kommer in i bild. Respekterar "minska rörelse".
function wireLanding(el) {
  const root = el.querySelector('.lp');
  if (!root) return;
  root.classList.add('js');
  const top = root.querySelector('.lp-top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  wireVideos(root);
  const items = root.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((x) => x.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  items.forEach((x, i) => { x.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`; io.observe(x); });
}

// Filmerna startar först när de syns och pausas när de inte syns (sparar batteri och data).
// Ingen film om man valt "minska rörelse" eller "spara data" – då visas bara stillbilden.
function wireVideos(root) {
  const vids = [...root.querySelectorAll('video[data-video]')];
  if (!vids.length) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  const load = (v) => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.poster = v.dataset.poster;
    const img = new Image();
    img.onload = () => v.classList.add('poster-ok');
    img.src = v.dataset.poster;
    if (calm) return;
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) {
      const src = document.createElement('source');
      src.src = `assets/video/${v.dataset.video}.${ext}`; src.type = type;
      v.appendChild(src);
    }
    v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
    v.load();
  };
  if (!('IntersectionObserver' in window)) { vids.forEach((v) => { load(v); if (!calm) v.play().catch(() => {}); }); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { load(v); if (!calm) v.play().catch(() => {}); }
    else if (!v.paused) v.pause();
  }), { rootMargin: '200px 0px', threshold: 0.01 });
  vids.forEach((v) => io.observe(v));
}
