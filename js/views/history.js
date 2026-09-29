// Historik och statistik.
import { loadEntries, deleteEntry, METRICS } from '../data.js';
import { esc, fmt1, signed, lineChart, bmi, dShort, tHM, icon, confirmSheet, toast, errorText, round1 } from '../ui.js';

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
      el.innerHTML = `<div class="screen"><h1>Historik</h1>
        <div class="card empty">Här syns dina grafer när du har gjort mätningar.<br><br><a class="btn primary" href="#/matning">Gör en mätning</a></div></div>`;
      return;
    }
    const days = PERIODS.find((x) => x[0] === period)[2];
    const since = days ? Date.now() - days * 86400000 : 0;
    let list = entries.filter((e) => e.at.getTime() >= since);
    if (list.length < 2) list = entries.slice(-2);
    const first = entries[0], last = entries[entries.length - 1], prev = entries[entries.length - 2];
    const start = p.startWeight ?? first.weight;
    const total = last.weight - start;
    const goal = p.goalWeight;
    const toGoal = goal != null ? Math.max(0, last.weight - goal) : null;
    const pctGoal = goal != null && start !== goal ? Math.max(0, Math.min(100, ((start - last.weight) / (start - goal)) * 100)) : null;

    const metricOpts = [['bmi', 'BMI', ''], ...METRICS.filter((m) => m[0] !== 'weight').map(([k, l, u]) => [k, l.split(' ')[0], u])];
    const mInfo = metricOpts.find((m) => m[0] === metric);
    const mVals = list.map((e) => (metric === 'bmi' ? bmi(e.weight, p.heightCm) : e[metric]));
    const mUnit = mInfo[2];
    const wVals = list.map((e) => e.weight);

    el.innerHTML = `<div class="screen">
      <div class="stack" style="gap:2px"><h1>Historik</h1><span class="muted" style="font-size:14px">${entries.length} mätningar sedan ${esc(dShort(first.at))}</span></div>
      <div class="seg" role="group" aria-label="Tidsperiod">
        ${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}
      </div>
      <div class="grid2">
        <div class="stat"><span class="label">Total förändring</span><span class="value num" style="color:var(--accent)">${signed(total, 'kg')}</span><span class="small muted">${signed((total / start) * 100, '%')} av startvikt</span></div>
        <div class="stat"><span class="label">Sedan senaste</span><span class="value num" style="color:var(--accent)">${prev ? signed(last.weight - prev.weight, 'kg') : '–'}</span></div>
        <div class="stat"><span class="label">Kvar till mål</span><span class="value num">${toGoal != null ? fmt1(toGoal) + ' kg' : '–'}</span></div>
        <div class="stat"><span class="label">Mot målet</span><span class="value num">${pctGoal != null ? Math.round(pctGoal) + ' %' : '–'}</span></div>
      </div>
      <section class="card stack">
        <div class="between" style="align-items:flex-end">
          <div class="stack" style="gap:2px"><h2>Vikt</h2><span style="font-size:26px;font-weight:700" class="num">${fmt1(last.weight)} kg</span></div>
          <span class="chip good">${signed(wVals[wVals.length - 1] - wVals[0], 'kg')}</span>
        </div>
        ${lineChart(wVals, { h: 150, label: 'Vikt över tid' })}
        <div class="between small muted"><span>${esc(dShort(list[0].at))}</span>${goal != null ? `<span>Målvikt ${fmt1(goal)} kg</span>` : ''}<span>${esc(dShort(list[list.length - 1].at))}</span></div>
      </section>
      <section class="card stack-lg">
        <div class="pills" role="group" aria-label="Välj mått">
          ${metricOpts.map(([k, l]) => `<button type="button" data-metric="${k}" aria-pressed="${k === metric}">${l}</button>`).join('')}
        </div>
        <div class="between" style="align-items:flex-end">
          <div class="stack" style="gap:2px"><span class="muted" style="font-size:14px;font-weight:600">${mInfo[1]} över tid</span>
            <span style="font-size:24px;font-weight:700" class="num">${fmt1(mVals[mVals.length - 1])}${mUnit ? ' ' + mUnit : ''}</span></div>
          <span class="chip neutral">${signed(mVals[mVals.length - 1] - mVals[0], mUnit)}</span>
        </div>
        ${lineChart(mVals, { h: 110, color: '#CF5F8C', fill: '#FCEEF4', label: mInfo[1] + ' över tid' })}
        ${metric === 'bmi' ? '<p class="small muted">BMI är vikt delat med längden i kvadrat. Det säger inget om muskler eller hälsa i stort. Se det som information, inte ett betyg.</p>' : ''}
      </section>
      <section class="card stack" style="padding-bottom:6px">
        <h2>Kroppsmått sedan start</h2>
        ${METRICS.filter((m) => m[0] !== 'weight').map(([k, l, u]) => `
          <div class="between" style="padding:10px 0;border-top:1px solid var(--line)">
            <span class="grow" style="font-size:16px;font-weight:600">${l}</span>
            <span class="small muted num">${fmt1(first[k])} → ${fmt1(last[k])} ${u}</span>
            <span class="num" style="width:78px;text-align:right;font-weight:700;color:var(--accent)">${signed(last[k] - first[k], u)}</span>
          </div>`).join('')}
      </section>
      <section class="stack">
        <h2>Alla mätningar</h2>
        <div class="card flush">
          ${[...entries].reverse().map((e) => `
            <div class="list-row">
              <div class="grow stack" style="gap:2px">
                <span class="title num">${fmt1(e.weight)} kg</span>
                <span class="sub num">${esc(dShort(e.at))} ${tHM(e.at)} · Midja ${fmt1(e.waist)} · Arm ${fmt1(e.arm)} · Lår ${fmt1(e.thigh)} · Höft ${fmt1(e.hip)}</span>
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
