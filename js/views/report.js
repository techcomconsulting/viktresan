// Rapport till vården: förhandsvisning, PDF och tillfälliga länkar.
import { PERIODS, buildReport, renderReport, createReportLink, loadReportLinks, deleteReportLink, openReportLink, reportUrl } from '../report.js';
import { esc, icon, backLink, openSheet, confirmSheet, toast, busy, errorText, dFull } from '../ui.js';

export async function reportView(el, ctx) {
  const { state } = ctx;
  let period = '180';
  let snap = null;

  const draw = async () => {
    snap = await buildReport(state.user.uid, state.profile, state.user.email, period);
    const links = await loadReportLinks().catch(() => []);
    const active = links.filter((l) => l.expires && l.expires > new Date());
    el.innerHTML = `<div class="screen">
      <div class="no-print stack-lg">
        ${backLink('#/profil', 'Profil')}
        <h1>Rapport till vården</h1>
        <p style="font-size:16px;line-height:1.45">En sammanfattning av vikt, BMI, mått och blodvärden. Visa den vid besöket, spara som PDF eller skicka en länk.</p>
        <div class="stack" style="gap:6px"><span style="font-size:14px;font-weight:600">Vilken period?</span>
          <div class="pills" role="group" aria-label="Period">${PERIODS.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}</div></div>
        <div class="btn-row">
          <button class="btn outline" data-pdf>${icon('copy', 18)}PDF / skriv ut</button>
          <button class="btn primary" data-link>${icon('send', 18)}Skapa länk</button>
        </div>
        ${active.length ? `<section class="stack"><h2>Aktiva länkar</h2><div class="card flush">
          ${active.map((l) => `<div class="list-row"><span class="grow stack" style="gap:2px"><span class="title">Gäller till ${esc(dFull(l.expires))}</span>
            <span class="sub">${esc((PERIODS.find((p) => p[0] === l.period) || PERIODS[3])[1])}</span></span>
            <button class="btn sm" data-show="${l.id}">Visa</button><button class="btn sm danger-outline" data-off="${l.id}">Stäng av</button></div>`).join('')}
        </div></section>` : ''}
        <span class="section-title">Så här ser rapporten ut</span>
      </div>
      <div class="rp-wrap">${renderReport(snap)}</div>
    </div>`;

    el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.p; draw(); }));
    el.querySelector('[data-pdf]').addEventListener('click', () => window.print());
    el.querySelector('[data-link]').addEventListener('click', () => askLink());
    el.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => showLink(b.dataset.show)));
    el.querySelectorAll('[data-off]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Stänga av länken?', text: 'Den som har länken kan inte längre se rapporten.', ok: 'Stäng av', danger: true }))) return;
      try { await deleteReportLink(b.dataset.off); toast('Länken är avstängd.'); draw(); } catch (ex) { toast(errorText(ex)); }
    }));
  };

  const askLink = () => {
    const s = openSheet(`
      <h2>Skapa länk till vården</h2>
      <p class="muted" style="font-size:15px;line-height:1.45">Den som får länken kan se rapporten <b>utan konto</b>. Den visar bara det som står i rapporten, inget annat.</p>
      <div class="stack" style="gap:6px"><span style="font-size:14px;font-weight:600">Hur länge ska länken fungera?</span>
        <div class="pills" role="group" aria-label="Giltighet">${[[1, '1 dag'], [7, '7 dagar'], [30, '30 dagar']].map(([d, l]) => `<button type="button" data-d="${d}" aria-pressed="${d === 7}">${l}</button>`).join('')}</div></div>
      <p class="small muted">Du kan stänga av länken när du vill.</p>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-go>Skapa länk</button></div>`, 'Skapa länk');
    let days = 7;
    s.el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      days = Number(b.dataset.d);
      s.el.querySelectorAll('[data-d]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    s.el.querySelector('[data-go]').addEventListener('click', async (e) => {
      await busy(e.currentTarget, async () => {
        try { const t = await createReportLink(snap, days); s.close(); await draw(); showLink(t); } catch (ex) { toast(errorText(ex)); }
      });
    });
  };

  const showLink = (token) => {
    const url = reportUrl(token);
    const name = state.profile.firstName || '';
    const s = openSheet(`
      <h2>Länken är klar</h2>
      <textarea class="input" readonly style="min-height:70px;font-size:14px">${esc(url)}</textarea>
      ${navigator.share ? `<button class="btn primary block" data-share>${icon('send', 18)}Skicka länken</button>` : ''}
      <a class="btn outline block" href="mailto:?subject=${encodeURIComponent('Hälsorapport ' + name)}&body=${encodeURIComponent('Hej! Här är min hälsorapport från Viktresan:\n' + url)}">${icon('comment', 18)}Skicka med e-post</a>
      <button class="btn outline block" data-copy>${icon('copy', 18)}Kopiera länken</button>
      <button class="btn ghost block" data-close>Klar</button>`, 'Länk');
    s.el.querySelector('[data-share]')?.addEventListener('click', async () => {
      try { await navigator.share({ title: 'Hälsorapport', text: 'Min hälsorapport från Viktresan', url }); } catch { /* avbrutet */ }
    });
    s.el.querySelector('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); toast('Länken är kopierad.'); } catch { toast('Markera texten och kopiera.'); }
    });
  };

  await draw();
}

// Sidan som läkaren ser. Ingen inloggning behövs.
export async function publicReportView(el, ctx, token) {
  const r = await openReportLink(token).catch(() => null);
  if (!r) {
    el.innerHTML = `<div class="screen no-nav"><div class="card stack" style="text-align:center;gap:10px;padding:28px">
      <span style="font-size:36px">🔒</span><h1 style="font-size:22px">Länken fungerar inte längre</h1>
      <p class="muted">Den har slutat gälla eller stängts av. Be om en ny länk.</p></div></div>`;
    return;
  }
  el.innerHTML = `<div class="screen no-nav" style="max-width:860px">
    <div class="no-print between"><span class="small muted">Gäller till ${esc(dFull(r.expires))}</span>
      <button class="btn outline sm" data-pdf>${icon('copy', 16)}Skriv ut / PDF</button></div>
    <div class="rp-wrap">${renderReport(r.data)}</div>
  </div>`;
  el.querySelector('[data-pdf]').addEventListener('click', () => window.print());
}
