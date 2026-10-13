// Behandling och medicin: bara anteckningar, inga råd.
import { loadTreatments, addTreatment, deleteTreatment, loadPrescriptions, savePrescription, deletePrescription, saveProfile } from '../data.js';
import { SLOTS, FREQS, WEEKDAYS, scheduleText, renderMedsToday } from '../meds.js';
import { DEFAULT_TIMES, pushSupport, pushPermission, enablePush, disablePush, syncSchedule, testPush } from '../push.js';
import { esc, icon, backLink, openSheet, confirmSheet, toast, busy, errorText, isoDay, toDate } from '../ui.js';

const MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function treatmentList(items, canDelete) {
  if (!items.length) return `<div class="card empty">Inga anteckningar än.</div>`;
  return `<div class="card flush">${items.map((t) => {
    const d = toDate(t.date + 'T12:00:00');
    return `<div class="list-row" style="align-items:flex-start">
      <div class="stack" style="width:44px;align-items:center;gap:0"><span style="font-size:20px;font-weight:700">${d.getDate()}</span><span class="small muted">${MON[d.getMonth()]}</span></div>
      <div class="grow stack" style="gap:2px">
        <span style="font-size:15px;font-weight:700">${esc(t.name)}${t.dose ? ' · ' + esc(t.dose) : ''}</span>
        ${t.note ? `<span style="font-size:14px" class="muted">${esc(t.note)}</span>` : ''}
      </div>
      ${canDelete ? `<button class="icon-btn" style="box-shadow:none;background:transparent" data-del="${t.id}" aria-label="Ta bort">${icon('trash', 20)}</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ---------- Recept ----------
const dTxt = (iso) => { if (!iso) return '–'; const d = toDate(iso + 'T12:00:00'); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const inYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return isoDay(d); };

function rxStatus(r) {
  const today = isoDay(new Date());
  const soon = isoDay(new Date(Date.now() + 30 * 864e5));
  if (r.validTo && r.validTo < today) return ['Utgånget', 'warn'];
  if (r.refills === 0) return ['Inga uttag kvar', 'warn'];
  if (r.validTo && r.validTo <= soon) return ['Går ut snart', 'warn'];
  return ['Giltigt', 'good'];
}

function rxList(items) {
  if (!items.length) return `<div class="card empty">Inga recept än.<br>Lägg till dina recept, så får du en påminnelse innan de går ut.</div>`;
  return `<div class="stack">${items.map((r) => {
    const [st, cls] = rxStatus(r);
    return `<button class="card stack" data-rx="${r.id}" style="border:0;text-align:left;cursor:pointer;gap:8px;font:inherit;color:inherit">
      <div class="between" style="align-items:flex-start;gap:8px">
        <span class="stack" style="gap:2px"><b style="font-size:17px">${esc(r.name)}${r.strength ? ' ' + esc(r.strength) : ''}</b>
          ${r.dosage ? `<span class="small muted">${esc(r.dosage)}</span>` : ''}
          ${r.schedule?.freq ? `<span class="small" style="color:var(--accent-dark);font-weight:600">⏰ ${esc(scheduleText(r.schedule))}</span>` : ''}</span>
        <span class="chip ${cls}" style="flex-shrink:0">${st}</span></div>
      <div class="row small" style="gap:14px;flex-wrap:wrap">
        <span><span class="muted">Giltigt till</span> <b>${dTxt(r.validTo)}</b></span>
        ${r.refills != null ? `<span><span class="muted">Uttag kvar</span> <b>${r.refills}</b></span>` : ''}
        ${r.prescriber ? `<span class="muted">${esc(r.prescriber)}</span>` : ''}
      </div></button>`;
  }).join('')}</div>`;
}

function openRxSheet(uid, r, onDone) {
  const e = r || {};
  const sch = { freq: e.schedule?.freq || '', slots: [...(e.schedule?.slots || [])], weekday: e.schedule?.weekday ?? 0, start: e.schedule?.start || '' };
  const s = openSheet(`
    <h2>${r ? 'Ändra recept' : 'Nytt recept'}</h2>
    <div class="field"><label for="rn">Läkemedel</label><input class="input" id="rn" maxlength="80" value="${esc(e.name || '')}" placeholder="t.ex. Metformin"></div>
    <div class="grid2">
      <div class="field"><label for="rs">Styrka (valfritt)</label><input class="input" id="rs" maxlength="30" value="${esc(e.strength || '')}" placeholder="t.ex. 500 mg"></div>
      <div class="field"><label for="rr">Uttag kvar (valfritt)</label><input class="input" id="rr" inputmode="numeric" maxlength="3" value="${e.refills ?? ''}" placeholder="t.ex. 3"></div>
    </div>
    <div class="field"><label for="rd">Så tar jag det (valfritt)</label><input class="input" id="rd" maxlength="100" value="${esc(e.dosage || '')}" placeholder="t.ex. 1 tablett morgon och kväll"></div>
    <div class="stack" style="gap:8px"><span style="font-size:14px;font-weight:600">Hur ofta?</span>
      <div class="pills" role="group" aria-label="Hur ofta" style="flex-wrap:wrap;overflow:visible">${FREQS.map(([k, l]) => `<button type="button" data-freq="${k}" aria-pressed="${k === sch.freq}">${l}</button>`).join('')}</div>
      <div data-wd class="field ${sch.freq === 'weekly' ? '' : 'hidden'}"><label for="rw">Vilken dag?</label><select class="input" id="rw">${WEEKDAYS.map((w, i) => `<option value="${i}" ${i === (sch.weekday ?? 0) ? 'selected' : ''}>${w}</option>`).join('')}</select></div>
      <div data-slots class="stack ${sch.freq && sch.freq !== 'asNeeded' ? '' : 'hidden'}" style="gap:6px"><span class="small muted">När på dagen? (välj en eller flera)</span>
        <div class="pills" role="group" aria-label="När på dagen" style="flex-wrap:wrap;overflow:visible">${SLOTS.map(([k, l, e]) => `<button type="button" data-slot="${k}" aria-pressed="${sch.slots.includes(k)}">${e} ${l}</button>`).join('')}</div></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="rf">Utfärdat</label><input class="input" id="rf" type="date" value="${e.issued || isoDay(new Date())}"></div>
      <div class="field"><label for="rt">Giltigt till</label><input class="input" id="rt" type="date" value="${e.validTo || inYear()}"></div>
    </div>
    <div class="field"><label for="rp">Läkare eller vårdcentral (valfritt)</label><input class="input" id="rp" maxlength="80" value="${esc(e.prescriber || '')}"></div>
    <div class="field"><label for="ro">Anteckning (valfritt)</label><textarea class="input" id="ro" maxlength="500">${esc(e.note || '')}</textarea></div>
    <p class="error hidden" role="alert">Skriv namnet på läkemedlet.</p>
    ${r && r.refills > 0 ? '<button class="btn outline block" data-took>Jag har hämtat ut (−1 uttag)</button>' : ''}
    <div class="btn-row">${r ? '<button class="btn danger-outline" data-del>Ta bort</button>' : '<button class="btn" data-close>Avbryt</button>'}<button class="btn primary" data-save>Spara</button></div>
    <p class="small muted" style="margin:0">Tips: du ser alla dina recept på 1177.se eller i apotekets app.</p>`, 'Recept');
  const v = (id) => s.el.querySelector('#' + id).value.trim();
  s.el.querySelectorAll('[data-freq]').forEach((b) => b.addEventListener('click', () => {
    sch.freq = sch.freq === b.dataset.freq ? '' : b.dataset.freq;
    if (sch.freq && sch.freq !== 'asNeeded' && !sch.slots.length) sch.slots = ['morning'];
    s.el.querySelectorAll('[data-freq]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.freq === sch.freq)));
    s.el.querySelectorAll('[data-slot]').forEach((x) => x.setAttribute('aria-pressed', String(sch.slots.includes(x.dataset.slot))));
    s.el.querySelector('[data-wd]').classList.toggle('hidden', sch.freq !== 'weekly');
    s.el.querySelector('[data-slots]').classList.toggle('hidden', !sch.freq || sch.freq === 'asNeeded');
  }));
  s.el.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.slot;
    sch.slots = sch.slots.includes(k) ? sch.slots.filter((x) => x !== k) : [...sch.slots, k];
    b.setAttribute('aria-pressed', String(sch.slots.includes(k)));
  }));
  s.el.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const name = v('rn');
    if (!name) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const refills = v('rr') === '' ? null : Math.max(0, Math.min(99, parseInt(v('rr'), 10) || 0));
    await busy(ev.currentTarget, async () => {
      try {
        await savePrescription(uid, {
          name, strength: v('rs'), dosage: v('rd'), refills, issued: v('rf') || isoDay(new Date()),
          validTo: v('rt') || inYear(), prescriber: v('rp'), note: v('ro'),
          schedule: sch.freq ? { freq: sch.freq, slots: sch.freq === 'asNeeded' ? [] : sch.slots, weekday: Number(v('rw')) || 0, start: sch.start || isoDay(new Date()) } : null
        }, r?.id);
        s.close(); toast('Receptet är sparat.'); onDone();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
  s.el.querySelector('[data-took]')?.addEventListener('click', async (ev) => {
    await busy(ev.currentTarget, async () => {
      try { await savePrescription(uid, { refills: r.refills - 1 }, r.id); s.close(); toast(`Noterat. ${r.refills - 1} uttag kvar.`); onDone(); } catch (ex) { toast(errorText(ex)); }
    });
  });
  s.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    s.close();
    if (!(await confirmSheet({ title: `Ta bort receptet på ${r.name}?`, ok: 'Ta bort', danger: true }))) return;
    try { await deletePrescription(uid, r.id); onDone(); } catch (ex) { toast(errorText(ex)); }
  });
}

// ---------- Påminnelser i telefonen ----------
function pushCard(p) {
  const sup = pushSupport();
  if (sup === 'server') return '';
  const on = !!p.medPush && pushPermission() === 'granted';
  const t = { ...DEFAULT_TIMES, ...(p.medTimes || {}) };
  return `<section class="card stack" style="gap:12px">
    <div class="row" style="gap:12px"><span style="font-size:24px">📲</span>
      <span class="grow stack" style="gap:2px"><b>Påminnelser i telefonen</b><span class="small muted">${on ? 'På. Du får en notis när det är dags.' : 'Få en notis när det är dags att ta medicinen.'}</span></span>
      ${sup === 'ok' ? `<button type="button" class="toggle" data-push aria-pressed="${on}" aria-label="Påminnelser"></button>` : ''}</div>
    ${sup === 'install' ? '<div class="banner neutral" style="font-size:14px">På iPhone måste appen ligga på <b>hemskärmen</b> för att få påminnelser. Tryck på Dela-knappen i Safari och välj <b>Lägg till på hemskärmen</b>. Öppna sedan appen därifrån.</div>' : ''}
    ${sup === 'no' ? '<p class="small muted" style="margin:0">Den här webbläsaren kan tyvärr inte visa påminnelser.</p>' : ''}
    ${on ? `<div class="stack" style="gap:6px"><span class="small muted">Vilken tid?</span>
      <div class="stack" style="gap:6px">${SLOTS.map(([k, l, e]) => `<label class="between" style="gap:8px;font-size:15px;font-weight:600"><span>${e} ${l}</span>
        <input class="input" type="time" step="300" data-time="${k}" value="${t[k]}" lang="sv-SE" style="height:44px;width:150px;padding:0 10px"></label>`).join('')}</div>
      <button type="button" class="btn ghost sm" data-pushtest style="align-self:flex-start;padding:0">Skicka en testnotis</button></div>` : ''}
    <p class="small muted" style="margin:0;font-size:12px">Notisen säger bara att det är dags. Namnet på medicinen skickas aldrig.</p>
  </section>`;
}

function wirePushCard(el, ctx, getRx, redraw) {
  const p = ctx.state.profile;
  const uid = ctx.state.user.uid;
  const t = () => ({ ...DEFAULT_TIMES, ...(p.medTimes || {}) });
  el.querySelector('[data-push]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    const turnOn = b.getAttribute('aria-pressed') !== 'true';
    b.disabled = true;
    try {
      if (turnOn) {
        if (!getRx().some((r) => r.schedule?.freq && r.schedule.freq !== 'asNeeded')) toast('Tips: välj "Hur ofta" på ett recept, annars kommer inga påminnelser.');
        await enablePush(getRx(), t());
        await saveProfile(uid, { medPush: true }); p.medPush = true;
        toast('Påminnelser är på.');
      } else {
        await disablePush();
        await saveProfile(uid, { medPush: false }); p.medPush = false;
        toast('Påminnelser är av.');
      }
    } catch (ex) { toast(ex.message || errorText(ex)); }
    b.disabled = false;
    redraw();
  });
  el.querySelectorAll('[data-time]').forEach((inp) => inp.addEventListener('change', async () => {
    const v = inp.value;
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    const [h, m] = v.split(':').map(Number);
    const r = `${String(h).padStart(2, '0')}:${String(Math.round(m / 5) * 5 % 60).padStart(2, '0')}`;
    inp.value = r;
    p.medTimes = { ...t(), [inp.dataset.time]: r };
    try { await saveProfile(uid, { medTimes: p.medTimes }); await syncSchedule(getRx(), p.medTimes); toast('Tiden är sparad.'); } catch (ex) { toast(ex.message || errorText(ex)); }
  }));
  el.querySelector('[data-pushtest]')?.addEventListener('click', async (e) => {
    await busy(e.currentTarget, async () => {
      try { const r = await testPush(); toast(r.devices ? 'Testnotis skickad!' : 'Hittade ingen telefon. Slå av och på igen.'); } catch (ex) { toast(ex.message); }
    });
  });
}

export async function treatmentView(el, ctx) {
  const uid = ctx.state.user.uid;
  let [items, rx] = await Promise.all([loadTreatments(uid), loadPrescriptions(uid)]);
  let tab = ctx.state.treatTab || 'notes';

  const draw = () => {
    ctx.state.treatTab = tab;
    el.innerHTML = `<div class="screen">
      ${backLink('#/profil', 'Profil')}
      <div class="between">
        <h1>Behandling</h1>
        <span class="chip" style="background:#fff;box-shadow:var(--shadow)">${icon('lock', 14, 2)}Privat</span>
      </div>
      <div class="banner neutral" style="font-size:14px">Här skriver du bara ner. Appen ger inga medicinska råd. Frågor om dos tar du med din läkare.</div>
      <div data-meds></div>
      <div class="seg" role="group" aria-label="Visa">
        <button type="button" data-tab="notes" aria-pressed="${tab === 'notes'}">Anteckningar</button>
        <button type="button" data-tab="rx" aria-pressed="${tab === 'rx'}">Mina recept${rx.length ? ` (${rx.length})` : ''}</button>
      </div>
      ${tab === 'notes' ? `
        <button class="btn primary block" data-add>${icon('plus', 20, 2.2)}Lägg till anteckning</button>
        ${treatmentList(items, true)}
        <p class="small muted">Delas bara om du själv slår på det under Delning.</p>` : `
        <button class="btn primary block" data-addrx>${icon('plus', 20, 2.2)}Lägg till recept</button>
        ${rxList(rx)}
        ${pushCard(ctx.state.profile)}
        <p class="small muted">Välj <b>Hur ofta</b> på ett recept, så kan du kryssa i när du tagit det. Du får en notis 30 dagar innan ett recept går ut. Recepten är bara för dig och delas inte.</p>`}
    </div>`;
    renderMedsToday(el.querySelector('[data-meds]'), uid, { rx });
    wirePushCard(el, ctx, () => rx, draw);
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
    const reloadRx = async () => {
      rx = await loadPrescriptions(uid); draw();
      if (ctx.state.profile.medPush) syncSchedule(rx, ctx.state.profile.medTimes).catch(() => toast('Kunde inte uppdatera påminnelserna.'));
    };
    el.querySelector('[data-addrx]')?.addEventListener('click', () => openRxSheet(uid, null, reloadRx));
    el.querySelectorAll('[data-rx]').forEach((b) => b.addEventListener('click', () => openRxSheet(uid, rx.find((x) => x.id === b.dataset.rx), reloadRx)));
    el.querySelector('[data-add]')?.addEventListener('click', openAdd);
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Ta bort anteckningen?', ok: 'Ta bort', danger: true }))) return;
      try { await deleteTreatment(uid, b.dataset.del); items = items.filter((x) => x.id !== b.dataset.del); draw(); } catch (ex) { toast(errorText(ex)); }
    }));
  };

  const openAdd = () => {
    const last = items[0];
    const s = openSheet(`
      <h2>Ny anteckning</h2>
      <div class="field"><label for="tn">Läkemedel eller preparat</label><input class="input" id="tn" maxlength="80" value="${esc(last?.name || '')}"></div>
      <div class="field"><label for="td">Dos eller mängd</label><input class="input" id="td" maxlength="60" value="${esc(last?.dose || '')}"></div>
      <div class="field"><label for="tdt">Datum</label><input class="input" id="tdt" type="date" value="${isoDay(new Date())}"></div>
      <div class="field"><label for="tno">Egen anteckning (valfritt)</label><textarea class="input" id="tno" maxlength="500"></textarea></div>
      <p class="error hidden" role="alert">Skriv namnet.</p>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Ny anteckning');
    s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const name = s.el.querySelector('#tn').value.trim();
      if (!name) { s.el.querySelector('.error').classList.remove('hidden'); return; }
      await busy(e.currentTarget, async () => {
        try {
          await addTreatment(uid, {
            name, dose: s.el.querySelector('#td').value.trim(),
            date: s.el.querySelector('#tdt').value || isoDay(new Date()),
            note: s.el.querySelector('#tno').value.trim()
          });
          items = await loadTreatments(uid);
          s.close();
          draw();
        } catch (ex) { toast(errorText(ex)); }
      });
    });
  };
  draw();
}
