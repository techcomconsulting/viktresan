// Sidan "Tips och prylar". Visar bara tips som har en länk.
import { loadTips, catsNow, isShown } from '../tips.js';
import { esc, icon, backLink } from '../ui.js';

export async function tipsView(el) {
  const show = (await loadTips()).filter(isShown);
  const cats = catsNow();
  const known = new Set(cats.map((c) => c.id));
  const groups = [...cats, { id: '_other', name: 'Övrigt', emoji: '✨' }]
    .map((c) => ({ ...c, list: show.filter((t) => (c.id === '_other' ? !known.has(t.cat) : t.cat === c.id)) }))
    .filter((g) => g.list.length);
  el.innerHTML = `<div class="screen">
    ${backLink('#/profil', 'Profil')}
    <h1>Tips och prylar</h1>
    <p style="font-size:16px;line-height:1.45">Saker som gör resan lite lättare. Vi tipsar bara om sådant vi tror hjälper på riktigt.</p>
    <div class="banner neutral row" style="gap:10px;align-items:flex-start">${icon('info', 20)}
      <span style="font-size:14px">Länkarna är <b>reklamlänkar</b>. Köper du något får Viktresan en liten ersättning från butiken. Det kostar inget extra för dig, och vi skickar inga uppgifter om dig.</span></div>
    ${groups.length ? groups.map((g) => `<section class="stack"><h2 class="row" style="gap:8px"><span style="font-size:20px">${esc(g.emoji || '')}</span>${esc(g.name)}</h2>
        <div class="stack" style="gap:10px">${g.list.map((t) => `
          <div class="card stack" style="gap:8px">
            <div class="between" style="align-items:flex-start"><b style="font-size:17px">${esc(t.title)}</b>
              <span class="chip neutral" style="font-size:11px;padding:3px 8px">Reklamlänk</span></div>
            ${t.why ? `<p class="muted" style="font-size:15px;line-height:1.45">${esc(t.why)}</p>` : ''}
            <a class="btn outline block" href="${esc(t.url)}" data-tip="${esc(t.id)}" target="_blank" rel="sponsored noopener">Visa${t.store ? ' hos ' + esc(t.store) : ''} ${icon('right', 16, 2)}</a>
          </div>`).join('')}</div></section>`).join('')
      : '<div class="card empty">Inga tips just nu. Titta in igen snart!</div>'}
    <p class="small muted">Vi tipsar aldrig om bantningspiller eller produkter som lovar snabb viktnedgång.</p>
  </div>`;
}
