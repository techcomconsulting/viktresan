// Sidan Blodvärden: skriv in värden från vården eller egen mätare och se hur det går.
import { BLOOD, BLOOD_GROUPS, BLOOD_LIMITS, bloodInfo, bloodStatus, loadBlood, addBlood, deleteBlood, bloodSeries } from '../blood.js';
import { esc, fmt1, icon, backLink, openSheet, confirmSheet, toast, busy, errorText, parseNum, isoDay, dShort } from '../ui.js';

const STATUS = {
  ok: ['Inom normal', '#E6F2EC', '#1F5A41'],
  high: ['Över normal', '#FCEEF4', '#8A2E55'],
  low: ['Under normal', '#FCEEF4', '#8A2E55']
};

const fmtV = (key, v) => {
  const d = bloodInfo(key)[6];
  return d ? fmt1(v) : String(Math.round(v));
};

const rangeText = (b) => {
  const [, , , unit, lo, hi] = b;
  const f = (x) => (b[6] ? fmt1(x) : String(x));
  if (lo != null && hi != null) return `${f(lo)}–${f(hi)} ${unit}`;
  if (hi != null) return `under ${f(hi)} ${unit}`;
  return `över ${f(lo)} ${unit}`;
};

// Graf med en grön zon för normalintervallet.
export function bloodChart(series, b, w = 320, h = 120) {
  const vals = series.map((p) => p.v);
  const [, , , , lo, hi] = b;
  const span = [...vals, lo, hi].filter((x) => x != null);
  let mn = Math.min(...span), mx = Math.max(...span);
  const pad = (mx - mn) * 0.15 || 1;
  mn -= pad; mx += pad;
  const y = (v) => 8 + (mx - v) / (mx - mn) * (h - 16);
  const x = (i) => (vals.length === 1 ? w / 2 : i * (w - 16) / (vals.length - 1) + 8);
  const zTop = hi != null ? y(hi) : 0, zBot = lo != null ? y(lo) : h;
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(b[1])} över tid">
    <rect x="0" y="${zTop.toFixed(1)}" width="${w}" height="${Math.max(0, zBot - zTop).toFixed(1)}" fill="#E6F2EC" rx="6"/>
    ${vals.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#7B5EA7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === vals.length - 1 ? 5.5 : 3.5}" fill="${i === vals.length - 1 ? '#fff' : '#7B5EA7'}" stroke="#7B5EA7" stroke-width="2.5"/>`).join('')}
  </svg>`;
}

// Kort för varje värde som har mätts. Används både på din egen sida och när någon delar med dig.
export function bloodCards(list) {
  const out = [];
  for (const [g, gLabel] of BLOOD_GROUPS) {
    const cards = BLOOD.filter((b) => b[7] === g).map((b) => {
      const ser = bloodSeries(list, b[0]);
      if (!ser.length) return '';
      const last = ser[ser.length - 1];
      const prev = ser.length > 1 ? ser[ser.length - 2] : null;
      const st = STATUS[bloodStatus(b[0], last.v)];
      const diff = prev ? last.v - prev.v : null;
      return `<section class="card stack" style="gap:10px">
        <div class="between" style="align-items:flex-start">
          <div class="stack" style="gap:2px"><b style="font-size:17px">${esc(b[1])}</b>${b[2] ? `<span class="small muted">${esc(b[2])}</span>` : ''}</div>
          ${st ? `<span class="chip" style="background:${st[1]};color:${st[2]};font-size:12px">${st[0]}</span>` : ''}
        </div>
        <div class="row" style="gap:8px;align-items:baseline">
          <span class="num" style="font-size:32px;font-weight:700">${fmtV(b[0], last.v)}</span><span class="muted" style="font-weight:600">${esc(b[3])}</span>
          ${diff != null && Math.abs(diff) > 0.001 ? `<span class="small muted" style="margin-left:auto">${diff > 0 ? '+' : '−'}${fmtV(b[0], Math.abs(diff))} sedan förra</span>` : ''}
        </div>
        ${bloodChart(ser, b)}
        <div class="between small muted"><span>${esc(dShort(ser[0].at))}</span><span>${esc(dShort(last.at))}</span></div>
        <span class="small row" style="gap:6px;color:#1F5A41"><span style="width:12px;height:12px;border-radius:3px;background:#E6F2EC;border:1px solid #BFDCCB"></span>Normalt ungefär ${rangeText(b)}</span>
      </section>`;
    }).filter(Boolean);
    if (cards.length) out.push(`<section class="stack"><h2>${gLabel}</h2>${cards.join('')}</section>`);
  }
  return out.join('');
}

export async function bloodView(el, ctx) {
  const draw = async () => {
    const list = await loadBlood(ctx.state.user.uid).catch(() => []);
    el.innerHTML = `<div class="screen">
      ${backLink('#/profil', 'Profil')}
      <div class="between"><h1>Blodvärden</h1></div>
      <button class="btn primary block" data-add>${icon('plus', 20, 2.2)}Lägg till värden</button>
      ${list.length ? bloodCards(list) : `<div class="card stack" style="gap:10px;text-align:center;padding:24px">
        <span style="font-size:36px">🩸</span>
        <b style="font-size:17px">Inga värden än</b>
        <span class="muted" style="font-size:15px;line-height:1.45">Skriv in värden från vårdcentralen eller din egen blodtrycksmätare. Då ser du hur de förändras när du går ner i vikt.</span></div>`}
      ${list.length ? `<section class="stack"><h2>Alla mätningar</h2><div class="card flush">
        ${[...list].reverse().map((e) => `<div class="list-row" style="align-items:flex-start">
          <span class="grow stack" style="gap:2px"><b>${esc(dShort(e.at))}</b>
            <span class="small muted">${Object.entries(e.values || {}).map(([k, v]) => `${esc(bloodInfo(k)?.[1] || k)} ${fmtV(k, v)}`).join(' · ')}</span>
            ${e.note ? `<span class="small">${esc(e.note)}</span>` : ''}</span>
          <button class="icon-btn" data-del="${e.id}" aria-label="Ta bort">${icon('trash', 18)}</button></div>`).join('')}
      </div></section>` : ''}
      <div class="banner neutral row" style="gap:10px;align-items:flex-start">${icon('info', 20)}
        <span style="font-size:14px">Den gröna zonen är ett <b>ungefärligt normalintervall</b> för vuxna. Labbet kan ha andra gränser. Appen ställer ingen diagnos – <b>prata med vården</b> om dina värden.</span></div>
      <p class="small muted row" style="gap:6px">${icon('lock', 16)}Blodvärden är privata. Du väljer själv om någon får se dem under Hantera delning.</p>
    </div>`;
    el.querySelector('[data-add]').addEventListener('click', () => openBloodSheet(draw));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Ta bort mätningen?', ok: 'Ta bort', danger: true }))) return;
      try { await deleteBlood(b.dataset.del); toast('Borttagen.'); draw(); } catch (ex) { toast(errorText(ex)); }
    }));
  };
  await draw();
}

export function openBloodSheet(onDone) {
  const field = (b) => `<div class="row" style="gap:10px;padding:6px 0">
    <label for="b-${b[0]}" class="grow stack" style="gap:0"><span style="font-size:16px;font-weight:600">${esc(b[1])}</span>${b[2] ? `<span class="small muted">${esc(b[2])}</span>` : ''}</label>
    <div class="unit-input" style="width:132px;height:46px"><input id="b-${b[0]}" data-b="${b[0]}" inputmode="decimal" placeholder="–"><span style="font-size:12px">${esc(b[3])}</span></div></div>`;
  const s = openSheet(`
    <h2>Lägg till blodvärden</h2>
    <p class="muted" style="font-size:14px">Fyll i det du har. Resten lämnar du tomt.</p>
    <div class="field"><label for="bd">Datum</label><input class="input" id="bd" type="date" value="${isoDay(new Date())}"></div>
    ${BLOOD_GROUPS.map(([g, label]) => `<span class="section-title">${label}</span><div>${BLOOD.filter((b) => b[7] === g).map(field).join('')}</div>`).join('')}
    <div class="field"><label for="bn">Anteckning (valfritt)</label><input class="input" id="bn" maxlength="120" placeholder="t.ex. Vårdcentralen"></div>
    <p class="error hidden" role="alert"></p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Blodvärden');
  const err = s.el.querySelector('.error');
  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const values = {};
    for (const inp of s.el.querySelectorAll('[data-b]')) {
      const raw = inp.value.trim();
      if (!raw) continue;
      const v = parseNum(raw);
      const [lo, hi] = BLOOD_LIMITS[inp.dataset.b];
      if (v == null || v < lo || v > hi) {
        err.textContent = `${bloodInfo(inp.dataset.b)[1]}: värdet ser fel ut.`;
        err.classList.remove('hidden');
        return;
      }
      values[inp.dataset.b] = v;
    }
    if (!Object.keys(values).length) { err.textContent = 'Fyll i minst ett värde.'; err.classList.remove('hidden'); return; }
    const date = s.el.querySelector('#bd').value || isoDay(new Date());
    await busy(e.currentTarget, async () => {
      try {
        await addBlood(date, values, s.el.querySelector('#bn').value.trim());
        s.close();
        toast('Sparat.');
        onDone && onDone();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}
