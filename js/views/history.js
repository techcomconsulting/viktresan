// Historik och statistik.
import { loadEntries, deleteEntry, METRICS, lastValues } from '../data.js';
import { esc, fmt1, signed, lineChart, bmi, dShort, tHM, icon, confirmSheet, toast, errorText, round1, backLink } from '../ui.js';

const PERIODS = [['1m', '1 mån', 31], ['3m', '3 mån', 92], ['6m', '6 mån', 183], ['1y', '1 år', 366], ['all', 'All tid', null]];

export async function historyView(el, ctx) {
  const { state } = ctx;
  const uid = state.user.uid;
  const p = state.profile;
  let entries = await loadEntries(uid);
  let period = 'all';
  let metric = 'bmi';

  const draw = () => {
    if (!entries.length) {
      el.innerHTML = `<div class="screen">${backLink('#/', 'Översikt')}<h1>Historik</h1>
        <div class="card empty">Här syns dina grafer när du har gjort mätningar.<br><br><a class="btn primary" href="#/matning">Gör en mätning</a></div></div>`;
      return;
    }
    const days = PERIODS.find((x) => x[0] === period)[2];
    const since = days ? Date.now() - days * 86400000 : 0;
    let list = entries.filter((e) => e.at.getTime() >= since);
    if (list.length < 2) list = entries.slice(-2);
    const first = entries[0];
    const W = lastValues(entries, 'weight');
    const last = W.last, prev = W.prev;
    const start = p.startWeight ?? W.first?.weight;
    const total = last && start != null ? last.weight - start : null;
    const goal = p.goalWeight;
    const toGoal = goal != null && last ? Math.max(0, last.weight - goal) : null;
    const pctGoal = goal != null && last && start != null && start !== goal ? Math.max(0, Math.min(100, ((start - last.weight) / (start - goal)) * 100)) : null;
    const pick = (arr) => arr.filter((x) => x.v != null);
    const series = (key) => pick(list.map((e) => ({ at: e.at, v: key === 'bmi' ? (e.weight != null ? bmi(e.weight, p.heightCm) : null) : e[key] })));

    const metricOpts = [['bmi', 'BMI', ''], ...METRICS.filter((m) => m[0] !== 'weight').map(([k, l, u]) => [k, l.split(' ')[0], u])];
    const mInfo = metricOpts.find((m) => m[0] === metric);
    const mS = series(metric), mVals = mS.map((x) => x.v);
    const mUnit = mInfo[2];
    const wS = series('weight'), wVals = wS.map((x) => x.v);
    const diff = (a) => (a.length >= 2 ? a[a.length - 1] - a[0] : null);

    el.innerHTML = `<div class="screen">
      ${backLink('#/', 'Översikt')}
      <div class="stack" style="gap:2px"><h1>Historik</h1><span class="muted" style="font-size:14px">${entries.length} mätningar sedan ${esc(dShort(first.at))}</span></div>
      <div class="seg" role="group" aria-label="Tidsperiod">
        ${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}
      </div>
      <div class="grid2">
        <div class="stat"><span class="label">Total förändring</span><span class="value num" style="color:var(--accent)">${signed(total, 'kg')}</span>${total != null && start ? `<span class="small muted">${signed((total / start) * 100, '%')} av startvikt</span>` : ''}</div>
        <div class="stat"><span class="label">Sedan senaste</span><span class="value num" style="color:var(--accent)">${prev && last ? signed(last.weight - prev.weight, 'kg') : '–'}</span></div>
        <div class="stat"><span class="label">Kvar till mål</span><span class="value num">${toGoal != null ? fmt1(toGoal) + ' kg' : '–'}</span></div>
        <div class="stat"><span class="label">Mot målet</span><span class="value num">${pctGoal != null ? Math.round(pctGoal) + ' %' : '–'}</span></div>
      </div>
      <section class="card stack">
        <div class="between" style="align-items:flex-end">
          <div class="stack" style="gap:2px"><h2>Vikt</h2><span style="font-size:26px;font-weight:700" class="num">${last ? fmt1(last.weight) + ' kg' : '–'}</span></div>
          ${diff(wVals) != null ? `<span class="chip good">${signed(diff(wVals), 'kg')}</span>` : ''}
        </div>
        ${lineChart(wVals, { h: 150, label: 'Vikt över tid' })}
        ${wS.length >= 2 ? `<div class="between small muted"><span>${esc(dShort(wS[0].at))}</span>${goal != null ? `<span>Målvikt ${fmt1(goal)} kg</span>` : ''}<span>${esc(dShort(wS[wS.length - 1].at))}</span></div>` : ''}
      </section>
      <section class="card stack-lg">
        <div class="pills" role="group" aria-label="Välj mått">
          ${metricOpts.map(([k, l]) => `<button type="button" data-metric="${k}" aria-pressed="${k === metric}">${l}</button>`).join('')}
        </div>
        <div class="between" style="align-items:flex-end">
          <div class="stack" style="gap:2px"><span class="muted" style="font-size:14px;font-weight:600">${mInfo[1]} över tid</span>
            <span style="font-size:24px;font-weight:700" class="num">${mVals.length ? fmt1(mVals[mVals.length - 1]) + (mUnit ? ' ' + mUnit : '') : '–'}</span></div>
          ${diff(mVals) != null ? `<span class="chip neutral">${signed(diff(mVals), mUnit)}</span>` : ''}
        </div>
        ${lineChart(mVals, { h: 110, color: '#CF5F8C', fill: '#FCEEF4', label: mInfo[1] + ' över tid' })}
        ${metric === 'bmi' ? '<p class="small muted">BMI är vikt delat med längden i kvadrat. Det säger inget om muskler eller hälsa i stort. Se det som information, inte ett betyg.</p>' : ''}
      </section>
      <section class="card stack" style="padding-bottom:6px">
        <h2>Kroppsmått sedan start</h2>
        ${METRICS.filter((m) => m[0] !== 'weight').map(([k, l, u]) => { const V = lastValues(entries, k); return `
          <div class="between" style="padding:10px 0;border-top:1px solid var(--line)">
            <span class="grow" style="font-size:16px;font-weight:600">${l}</span>
            <span class="small muted num">${V.first ? `${fmt1(V.first[k])} → ${fmt1(V.last[k])} ${u}` : 'Inte mätt än'}</span>
            <span class="num" style="width:78px;text-align:right;font-weight:700;color:var(--accent)">${V.list.length >= 2 ? signed(V.last[k] - V.first[k], u) : ''}</span>
          </div>`; }).join('')}
      </section>
      <section class="stack">
        <h2>Alla mätningar</h2>
        <div class="card flush">
          ${[...entries].reverse().map((e) => `
            <div class="list-row">
              <div class="grow stack" style="gap:2px">
                <span class="title num">${e.weight != null ? fmt1(e.weight) + ' kg' : 'Bara mått'}</span>
                <span class="sub num">${esc(dShort(e.at))} ${tHM(e.at)}${[['waist', 'Midja'], ['arm', 'Arm'], ['thigh', 'Lår'], ['hip', 'Höft']].filter(([k]) => e[k] != null).map(([k, l]) => ` · ${l} ${fmt1(e[k])}`).join('')}</span>
              </div>
              <button class="icon-btn" style="box-shadow:none;background:transparent" data-del="${e.id}" aria-label="Ta bort mätningen ${esc(dShort(e.at))}">${icon('trash', 20)}</button>
            </div>`).join('')}
        </div>
      </section>
    </div>`;

    el.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; draw(); }));
    el.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => { metric = b.dataset.metric; draw(); }));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await confirmSheet({ title: 'Ta bort mätningen?', text: 'Den går inte att få tillbaka.', ok: 'Ta bort', danger: true });
      if (!ok) return;
      try {
        await deleteEntry(uid, p, entries, b.dataset.del);
        entries = entries.filter((x) => x.id !== b.dataset.del);
        toast('Mätningen är borttagen.');
        draw();
      } catch (ex) { toast(errorText(ex)); }
    }));
  };
  draw();
}

export { round1 };
