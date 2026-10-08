// Rapport till vården: en sammanfattning av vikt, BMI, mått och blodvärden.
// Kan visas i appen, sparas som PDF (skriv ut) eller delas med en tillfällig länk.
import { db, auth, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, Timestamp, serverTimestamp } from './firebase.js';
import { loadEntries } from './data.js';
import { loadBlood, BLOOD, bloodStatus, bloodInfo } from './blood.js';
import { esc, fmt1, signed, isoDay, dFull, bmi, lineChart } from './ui.js';

export const PERIODS = [['90', '3 månader'], ['180', '6 månader'], ['365', '1 år'], ['all', 'Allt']];

// Samlar ihop det som ska med. Sparas som en "ögonblicksbild".
export async function buildReport(uid, profile, email, period = '180') {
  const days = period === 'all' ? null : Number(period);
  const since = days ? Date.now() - days * 86400000 : 0;
  const [entries, blood] = await Promise.all([loadEntries(uid).catch(() => []), loadBlood(uid).catch(() => [])]);
  const keep = (d) => d.getTime() >= since;
  return {
    v: 1,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.firstName || '',
    email: email || profile.email || '',
    heightCm: profile.heightCm || null,
    goalWeight: profile.goalWeight || null,
    period,
    created: new Date().toISOString(),
    entries: entries.filter((e) => keep(e.at)).map((e) => ({
      d: isoDay(e.at), weight: e.weight ?? null, waist: e.waist ?? null, hip: e.hip ?? null, arm: e.arm ?? null, thigh: e.thigh ?? null
    })),
    blood: blood.filter((b) => keep(b.at)).map((b) => ({ d: isoDay(b.at), values: b.values || {}, note: b.note || '' }))
  };
}

const lastOf = (rows, key) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return rows[i]; return null; };
const firstOf = (rows, key) => rows.find((r) => r[key] != null) || null;
const dt = (s) => { const [y, m, d] = s.split('-'); return `${Number(d)}/${Number(m)} ${y}`; };
const bv = (key, v) => (v == null ? '–' : bloodInfo(key)[6] ? fmt1(v) : String(Math.round(v)));
const rangeTxt = (b) => {
  const f = (x) => (b[6] ? fmt1(x) : String(x));
  if (b[4] != null && b[5] != null) return `${f(b[4])}–${f(b[5])}`;
  if (b[5] != null) return `< ${f(b[5])}`;
  return `> ${f(b[4])}`;
};

// Själva rapporten som HTML. Samma utseende i appen, i länken och på papper.
export function renderReport(r) {
  const E = r.entries || [];
  const B = r.blood || [];
  const wF = firstOf(E, 'weight'), wL = lastOf(E, 'weight');
  const mF = firstOf(E, 'waist'), mL = lastOf(E, 'waist');
  const bmiF = wF && r.heightCm ? bmi(wF.weight, r.heightCm) : null;
  const bmiL = wL && r.heightCm ? bmi(wL.weight, r.heightCm) : null;
  const pct = wF && wL && wF !== wL ? ((wL.weight - wF.weight) / wF.weight) * 100 : null;
  const periodLabel = (PERIODS.find((p) => p[0] === r.period) || PERIODS[3])[1];
  const tile = (label, value, sub) => `<div class="rp-tile"><span class="rp-lbl">${label}</span><b class="rp-big">${value}</b><span class="rp-sub">${sub || '&nbsp;'}</span></div>`;

  const weights = E.filter((e) => e.weight != null);
  const waists = E.filter((e) => e.waist != null);
  const log = [...E].reverse().slice(0, 15);

  // Blodvärden: senaste värdet per sort, med värdet innan.
  const bloodRows = BLOOD.map((b) => {
    const ser = B.filter((x) => x.values[b[0]] != null);
    if (!ser.length) return '';
    const last = ser[ser.length - 1], prev = ser.length > 1 ? ser[ser.length - 2] : null;
    const st = bloodStatus(b[0], last.values[b[0]]);
    return `<tr><td><b>${esc(b[1])}</b><br><span class="rp-sub">${esc(b[3])}</span></td>
      <td class="rp-num"><b>${bv(b[0], last.values[b[0]])}</b>${st && st !== 'ok' ? ' <span class="rp-flag">' + (st === 'high' ? 'Hög' : 'Låg') + '</span>' : ''}<br><span class="rp-sub">${dt(last.d)}</span></td>
      <td class="rp-num">${prev ? bv(b[0], prev.values[b[0]]) + '<br><span class="rp-sub">' + dt(prev.d) + '</span>' : '–'}</td>
      <td class="rp-num rp-sub">${rangeTxt(b)}</td></tr>`;
  }).filter(Boolean);

  return `<article class="rp">
    <header class="rp-head">
      <div><div class="rp-kicker">Hälsorapport · Viktresan</div><h1 class="rp-name">${esc(r.name || 'Okänd')}</h1>
        <div class="rp-sub">${esc(r.email || '')}${r.heightCm ? ' · Längd ' + r.heightCm + ' cm' : ''}</div></div>
      <div class="rp-meta"><div>Skapad ${dFull(new Date(r.created))}</div><div>Period: ${periodLabel}</div></div>
    </header>

    <section class="rp-tiles">
      ${tile('Vikt nu', wL ? fmt1(wL.weight) + ' kg' : '–', wF && wL && wF !== wL ? `${signed(wL.weight - wF.weight, 'kg')} (${signed(pct, '%')}) sedan ${dt(wF.d)}` : wL ? dt(wL.d) : '')}
      ${tile('BMI nu', bmiL != null ? fmt1(bmiL) : '–', bmiF != null && bmiL != null && wF !== wL ? `Var ${fmt1(bmiF)} den ${dt(wF.d)}` : '')}
      ${tile('Midja nu', mL ? fmt1(mL.waist) + ' cm' : '–', mF && mL && mF !== mL ? `${signed(mL.waist - mF.waist, 'cm')} sedan ${dt(mF.d)}` : mL ? dt(mL.d) : '')}
    </section>

    <div class="rp-charts">
    ${weights.length >= 2 ? `<section class="rp-sec"><h2>Vikt över tid (kg)</h2>${lineChart(weights.map((e) => e.weight), { h: 130, label: 'Vikt över tid' })}
      <div class="rp-axis"><span>${dt(weights[0].d)}</span><span>${dt(weights[weights.length - 1].d)}</span></div></section>` : ''}
    ${waists.length >= 2 ? `<section class="rp-sec"><h2>Midja över tid (cm)</h2>${lineChart(waists.map((e) => e.waist), { h: 100, color: '#CF5F8C', fill: '#FCEEF4', label: 'Midja över tid' })}
      <div class="rp-axis"><span>${dt(waists[0].d)}</span><span>${dt(waists[waists.length - 1].d)}</span></div></section>` : ''}
    </div>

    ${bloodRows.length ? `<section class="rp-sec"><h2>Blodvärden och blodtryck</h2>
      <table class="rp-table"><thead><tr><th>Värde</th><th class="rp-num">Senaste</th><th class="rp-num">Förra</th><th class="rp-num">Ungefär normalt</th></tr></thead>
      <tbody>${bloodRows.join('')}</tbody></table></section>` : ''}

    ${log.length ? `<section class="rp-sec"><h2>Senaste mätningar</h2>
      <table class="rp-table"><thead><tr><th>Datum</th><th class="rp-num">Vikt</th><th class="rp-num">BMI</th><th class="rp-num">Midja</th><th class="rp-num">Höft</th><th class="rp-num">Arm</th><th class="rp-num">Lår</th></tr></thead>
      <tbody>${log.map((e) => `<tr><td>${dt(e.d)}</td><td class="rp-num">${e.weight != null ? fmt1(e.weight) : '–'}</td>
        <td class="rp-num">${e.weight != null && r.heightCm ? fmt1(bmi(e.weight, r.heightCm)) : '–'}</td>
        ${['waist', 'hip', 'arm', 'thigh'].map((k) => `<td class="rp-num">${e[k] != null ? fmt1(e[k]) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="rp-sub">Vikt i kg, mått i cm.</p></section>` : ''}

    ${B.length ? `<section class="rp-sec"><h2>Logg blodvärden</h2>
      <table class="rp-table"><thead><tr><th>Datum</th><th>Värden</th></tr></thead>
      <tbody>${[...B].reverse().slice(0, 12).map((x) => `<tr><td>${dt(x.d)}</td><td>${BLOOD.filter((b) => x.values[b[0]] != null).map((b) => `${esc(b[1])} <b>${bv(b[0], x.values[b[0]])}</b>`).join(' · ')}${x.note ? `<br><span class="rp-sub">${esc(x.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table></section>` : ''}

    ${!E.length && !B.length ? '<p class="rp-sub">Inga mätningar under perioden.</p>' : ''}
    <footer class="rp-foot">Uppgifterna har skrivits in av personen själv i appen Viktresan. Normalintervallen är ungefärliga för vuxna och ersätter inte labbets referensvärden. viktresan.online</footer>
  </article>`;
}

// ---------- Tillfälliga länkar ----------

const newToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const reportUrl = (token) => `https://viktresan.online/#/r/${token}`;

export async function createReportLink(snap, days = 7) {
  const token = newToken();
  await setDoc(doc(db, 'reports', token), {
    owner: auth.currentUser.uid, data: snap,
    expires: Timestamp.fromDate(new Date(Date.now() + days * 86400000)), created: serverTimestamp()
  });
  return token;
}

export async function loadReportLinks() {
  const s = await getDocs(query(collection(db, 'reports'), where('owner', '==', auth.currentUser.uid)));
  return s.docs.map((d) => ({ id: d.id, expires: d.data().expires?.toDate ? d.data().expires.toDate() : null, period: d.data().data?.period }))
    .sort((a, b) => (b.expires || 0) - (a.expires || 0));
}

export async function deleteReportLink(token) {
  await deleteDoc(doc(db, 'reports', token));
}

// Öppnas av läkaren, utan konto.
export async function openReportLink(token) {
  const s = await getDoc(doc(db, 'reports', token));
  if (!s.exists()) return null;
  const x = s.data();
  const exp = x.expires?.toDate ? x.expires.toDate() : null;
  if (exp && exp < new Date()) return null;
  return { data: x.data, expires: exp };
}

