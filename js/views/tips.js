// Sidan "Tips och prylar".
import { TIPS, TIP_CATS } from '../tips.js';
import { isAdmin } from '../data.js';
import { esc, icon, backLink } from '../ui.js';

export async function tipsView(el, ctx) {
  const admin = await isAdmin(ctx.state.user.uid);
  const show = TIPS.filter((t) => t.url || admin);
  el.innerHTML = `<div class="screen">
    ${backLink('#/profil', 'Profil')}
    <h1>Tips och prylar</h1>
    <p style="font-size:16px;line-height:1.45">Saker som gör resan lite lättare. Vi tipsar bara om sådant vi tror hjälper på riktigt.</p>
    <div class="banner neutral row" style="gap:10px;align-items:flex-start">${icon('info', 20)}
      <span style="font-size:14px">Länkarna är <b>reklamlänkar</b>. Köper du något får Viktresan en liten ersättning från butiken. Det kostar inget extra för dig, och vi skickar inga uppgifter om dig.</span></div>
    ${admin ? '<p class="small" style="color:var(--pink-ink)">Bara du ser tips utan länk (märkta "Länk saknas"). Skicka länkarna till Claude så läggs de in.</p>' : ''}
    ${show.length ? TIP_CATS.map(([k, label, ic]) => {
      const list = show.filter((t) => t.cat === k);
      if (!list.length) return '';
      return `<section class="stack"><h2 class="row" style="gap:8px">${icon(ic, 20)}${label}</h2>
        <div class="stack" style="gap:10px">${list.map((t) => `
          <div class="card stack" style="gap:8px">
            <div class="between" style="align-items:flex-start"><b style="font-size:17px">${esc(t.title)}</b>
              <span class="chip neutral" style="font-size:11px;padding:3px 8px">${t.url ? 'Reklamlänk' : 'Länk saknas'}</span></div>
            <p class="muted" style="font-size:15px;line-height:1.45">${esc(t.why)}</p>
            ${t.url ? `<a class="btn outline block" href="${esc(t.url)}" target="_blank" rel="sponsored noopener">Visa${t.store ? ' hos ' + esc(t.store) : ''} ${icon('right', 16, 2)}</a>` : ''}
          </div>`).join('')}</div></section>`;
    }).join('') : '<div class="card empty">Inga tips än. Titta in igen snart!</div>'}
    <p class="small muted">Vi tipsar aldrig om bantningspiller eller produkter som lovar snabb viktnedgång.</p>
  </div>`;
}
