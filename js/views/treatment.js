// Behandling och medicin: bara anteckningar, inga råd.
import { loadTreatments, addTreatment, deleteTreatment, loadPrescriptions, savePrescription, deletePrescription } from '../data.js';
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
          ${r.dosage ? `<span class="small muted">${esc(r.dosage)}</span>` : ''}</span>
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
  const s = openSheet(`
    <h2>${r ? 'Ändra recept' : 'Nytt recept'}</h2>
    <div class="field"><label for="rn">Läkemedel</label><input class="input" id="rn" maxlength="80" value="${esc(e.name || '')}" placeholder="t.ex. Metformin"></div>
    <div class="grid2">
      <div class="field"><label for="rs">Styrka (valfritt)</label><input class="input" id="rs" maxlength="30" value="${esc(e.strength || '')}" placeholder="t.ex. 500 mg"></div>
      <div class="field"><label for="rr">Uttag kvar (valfritt)</label><input class="input" id="rr" inputmode="numeric" maxlength="3" value="${e.refills ?? ''}" placeholder="t.ex. 3"></div>
    </div>
    <div class="field"><label for="rd">Så tar jag det (valfritt)</label><input class="input" id="rd" maxlength="100" value="${esc(e.dosage || '')}" placeholder="t.ex. 1 tablett morgon och kväll"></div>
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
  s.el.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const name = v('rn');
    if (!name) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const refills = v('rr') === '' ? null : Math.max(0, Math.min(99, parseInt(v('rr'), 10) || 0));
    await busy(ev.currentTarget, async () => {
      try {
        await savePrescription(uid, {
          name, strength: v('rs'), dosage: v('rd'), refills, issued: v('rf') || isoDay(new Date()),
          validTo: v('rt') || inYear(), prescriber: v('rp'), note: v('ro')
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
        <p class="small muted">Du får en notis 30 dagar innan ett recept går ut. Recepten är bara för dig och delas inte.</p>`}
    </div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
    const reloadRx = async () => { rx = await loadPrescriptions(uid); draw(); };
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
