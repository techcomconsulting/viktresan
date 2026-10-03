// Användarvillkor, integritetspolicy (GDPR) och godkännande.
import { auth, signOut } from '../firebase.js';
import { acceptTerms, exportMyData, deleteEverything, TERMS_VERSION } from '../data.js';
import { icon, openSheet, toast, busy, errorText } from '../ui.js';

export const COMPANY = 'Techcom Consulting AB';
export const CONTACT = 'techcomconsultingab@gmail.com';
const UPDATED = '3 oktober 2026';

const sec = (title, body) => `<section class="card stack" style="gap:8px"><h2 style="font-size:18px">${title}</h2>${body}</section>`;
const ul = (items) => `<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:15px;line-height:1.45">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const p = (t) => `<p style="margin:0;font-size:15px;line-height:1.45">${t}</p>`;

function back(ctx) {
  const to = ctx.state.user ? (ctx.state.profile?.termsVersion === TERMS_VERSION ? '#/profil' : '#/godkann') : '#/valkommen';
  return `<a class="back" href="${to}" onclick="if(history.length>1){history.back();return false}">‹ Tillbaka</a>`;
}

export async function termsView(el, ctx) {
  el.innerHTML = `<div class="screen no-nav">
    ${back(ctx)}
    <h1>Användarvillkor</h1>
    <p class="small muted">Gäller från ${UPDATED}. Version ${TERMS_VERSION}.</p>
    ${sec('Om appen', p(`Viktresan görs av <b>${COMPANY}</b>. Appen hjälper dig att följa din vikt, dina mått och din kost. Du kan dela din resa med familj och vänner om du vill.`))}
    ${sec('Inte medicinsk rådgivning', ul([
      'Kalorier, kostmål och förslag är <b>uppskattningar</b>.',
      'Appen ersätter inte läkare, dietist eller annan vård.',
      'Prata med vården innan du gör stora förändringar. Särskilt om du är sjuk, gravid, ammar eller tar mediciner.'
    ]))}
    ${sec('Vem får använda appen', ul([
      'Du ska vara <b>minst 18 år</b>.',
      'Du har ett eget konto. Håll ditt lösenord hemligt.'
    ]))}
    ${sec('Det du lägger upp', ul([
      'Lägg bara upp bilder på dig själv, eller bilder du har rätt att använda.',
      'Skriv inget kränkande i inlägg och kommentarer.',
      'Vi kan ta bort innehåll eller konton som bryter mot reglerna.'
    ]))}
    ${sec('Ingen garanti', ul([
      'Appen är gratis. Den kan ibland ha fel eller inte fungera.',
      'Vi gör vårt bästa för att inget ska försvinna, men vi kan inte lova det.',
      'Ladda gärna ner dina uppgifter ibland, under Profil.'
    ]))}
    ${sec('Avsluta', ul([
      'Du kan radera ditt konto när du vill, under <b>Profil → Radera mina uppgifter</b>.',
      'Vi kan stänga appen. Då säger vi till i förväg om det går.'
    ]))}
    ${sec('Ändringar', p('Om villkoren ändras får du godkänna dem igen i appen. Svensk lag gäller.'))}
    ${sec('Kontakt', p(`${COMPANY}<br><a href="mailto:${CONTACT}">${CONTACT}</a>`))}
    <a class="btn outline block" href="#/integritet">Läs integritetspolicyn</a>
  </div>`;
}

export async function privacyView(el, ctx) {
  const inApp = ctx.state.user && ctx.state.profile?.termsVersion === TERMS_VERSION;
  el.innerHTML = `<div class="screen no-nav">
    ${back(ctx)}
    <h1>Integritet och GDPR</h1>
    <p class="small muted">Gäller från ${UPDATED}.</p>
    ${sec('Kort sagt', ul([
      'Det du sparar är <b>privat</b>. Bara du ser det.',
      'Andra ser bara det <b>du själv väljer</b> att dela.',
      'Vi <b>säljer aldrig</b> dina uppgifter. Ingen reklam. Ingen spårning.',
      'Du kan <b>ladda ner</b> och <b>radera</b> allt när du vill.'
    ]))}
    ${sec('Vem ansvarar', p(`<b>${COMPANY}</b> är personuppgiftsansvarig.<br>Kontakt: <a href="mailto:${CONTACT}">${CONTACT}</a>`))}
    ${sec('Vad vi sparar', ul([
      '<b>Konto:</b> förnamn, användarnamn, e-post och profilbild.',
      '<b>Om dig:</b> längd, födelseår och kön.',
      '<b>Hälsa:</b> vikt, mått, bilder, behandling, kost, vatten och träning.',
      '<b>Socialt:</b> inlägg, kommentarer, reaktioner, grupper och vem du delar med.'
    ]))}
    ${sec('Hälsouppgifter', p('Vikt, mått, kost och behandling är <b>känsliga uppgifter</b> enligt GDPR. Vi sparar dem bara för att du har <b>samtyckt</b> till det (artikel 9.2 a). Kontot i övrigt behövs för att appen ska fungera (artikel 6.1 b).'))}
    ${sec('Varför', ul([
      'För att visa din resa, dina grafer och ditt BMI.',
      'För att räkna kalorier och kostmål.',
      'För att dela med dem du väljer.'
    ]))}
    ${sec('Var det sparas', ul([
      '<b>Google Firebase</b> (Google Cloud) sparar uppgifterna. Google är vårt personuppgiftsbiträde. Uppgifter kan hanteras utanför EU. Google skyddar dem då med EU:s standardavtal.',
      '<b>GitHub Pages</b> visar själva appen. GitHub kan se din IP-adress när du öppnar den.',
      'När du skannar eller söker en vara skickas bara <b>streckkoden eller sökordet</b> till Open Food Facts. Inga uppgifter om dig.'
    ]))}
    ${sec('Hur länge', p('Så länge du har kvar ditt konto. När du raderar kontot tas allt bort direkt.'))}
    ${sec('Dina rättigheter', ul([
      '<b>Få ut</b> dina uppgifter: Profil → Ladda ner mina uppgifter.',
      '<b>Rätta</b> dina uppgifter: ändra dem i appen.',
      '<b>Radera</b> allt: Profil → Radera mina uppgifter.',
      '<b>Ta tillbaka samtycket:</b> radera kontot. Appen fungerar inte utan hälsouppgifter.',
      `Du kan också mejla oss: <a href="mailto:${CONTACT}">${CONTACT}</a>`,
      'Är du inte nöjd kan du klaga hos <b>IMY</b>, Integritetsskyddsmyndigheten (imy.se).'
    ]))}
    ${inApp ? `<button class="btn outline block" data-export>${icon('copy', 18)}Ladda ner mina uppgifter</button>` : ''}
    <a class="btn outline block" href="#/villkor">Läs användarvillkoren</a>
  </div>`;
  el.querySelector('[data-export]')?.addEventListener('click', (e) => downloadMyData(ctx, e.currentTarget));
}

// Sparar allt om dig i en fil.
export async function downloadMyData(ctx, btn) {
  await busy(btn, async () => {
    try {
      const data = await exportMyData(ctx.state.user.uid);
      const name = `viktresan-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mina uppgifter' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      toast('Filen är klar.');
    } catch (ex) { toast(errorText(ex)); }
  });
}

// Fråga om lösenord och radera allt.
export function openWipeSheet() {
  const s = openSheet(`
    <h2>Radera alla mina uppgifter?</h2>
    <p class="muted">Allt tas bort: mätningar, bilder, kost, träning, inlägg, behandling, mål, delningar och ditt konto. Det går inte att ångra.</p>
    <div class="field"><label for="pw">Skriv ditt lösenord för att bekräfta</label><input class="input" id="pw" type="password" autocomplete="current-password"></div>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn danger-outline" data-go>Radera allt</button></div>`, 'Radera');
  s.el.querySelector('[data-go]').addEventListener('click', async (e) => {
    const pw = s.el.querySelector('#pw').value;
    if (!pw) return;
    await busy(e.currentTarget, async () => {
      try {
        await deleteEverything(pw);
        s.close();
        toast('Allt är raderat.');
        location.hash = '#/login';
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// Rutorna man måste kryssa i.
export const consentBoxes = () => `
  <div class="stack" style="gap:4px">
    <label class="check" style="align-items:flex-start"><input type="checkbox" name="ct" style="flex-shrink:0;margin-top:2px">
      <span>Jag är minst 18 år och godkänner <a href="#/villkor">användarvillkoren</a>.</span></label>
    <label class="check" style="align-items:flex-start"><input type="checkbox" name="ch" style="flex-shrink:0;margin-top:2px">
      <span>Jag samtycker till att mina <b>hälsouppgifter</b> (vikt, mått, kost, behandling och bilder) sparas. Läs <a href="#/integritet">integritetspolicyn</a>.</span></label>
  </div>`;
export const consentChecked = (root) => root.querySelector('[name=ct]').checked && root.querySelector('[name=ch]').checked;

// Visas för alla som inte har godkänt den senaste versionen.
export async function consentView(el, ctx) {
  const again = ctx.state.profile?.termsVersion;
  el.innerHTML = `<div class="screen no-nav">
    <img src="icons/icon-192.png" alt="" width="56" height="56" style="border-radius:16px">
    <h1>${again ? 'Nya villkor' : 'Innan du fortsätter'}</h1>
    <p style="font-size:16px;line-height:1.45">${again ? 'Villkoren har ändrats. Läs och godkänn för att fortsätta.' : 'Viktresan sparar uppgifter om din hälsa. Därför behöver vi ditt godkännande.'}</p>
    <section class="card stack" style="gap:10px;font-size:15px">
      <div class="row">${icon('check', 20, 2.2)}<span>Det du sparar är <b>privat</b>.</span></div>
      <div class="row">${icon('check', 20, 2.2)}<span>Du väljer själv vad du <b>delar</b>.</span></div>
      <div class="row">${icon('check', 20, 2.2)}<span>Du kan <b>radera allt</b> när du vill.</span></div>
    </section>
    <form class="card stack-lg" novalidate>
      ${consentBoxes()}
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Godkänn och fortsätt</button>
    </form>
    <button class="btn outline block" data-logout>Logga ut</button>
    <button class="btn ghost block" data-wipe style="color:var(--danger)">Jag vill inte. Radera mitt konto</button>
    <p class="small muted">${COMPANY} · <a href="mailto:${CONTACT}">${CONTACT}</a></p>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consentChecked(form)) { err.textContent = 'Kryssa i båda rutorna för att fortsätta.'; err.classList.remove('hidden'); return; }
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        await acceptTerms(ctx.state.user.uid);
        await ctx.reloadProfile();
        ctx.go('/');
      } catch (ex) { err.textContent = errorText(ex); err.classList.remove('hidden'); }
    });
  });
  el.querySelector('[data-logout]').addEventListener('click', async () => { await signOut(auth); location.hash = '#/login'; });
  el.querySelector('[data-wipe]').addEventListener('click', openWipeSheet);
}
