// Behandling och medicin: bara anteckningar, inga råd.
import { loadTreatments, addTreatment, deleteTreatment } from '../data.js';
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

export async function treatmentView(el, ctx) {
  const uid = ctx.state.user.uid;
  let items = await loadTreatments(uid);

  const draw = () => {
    el.innerHTML = `<div class="screen">
      ${backLink('#/profil', 'Profil')}
      <div class="between">
        <h1>Behandling</h1>
        <span class="chip" style="background:#fff;box-shadow:var(--shadow)">${icon('lock', 14, 2)}Privat</span>
      </div>
      <div class="banner neutral" style="font-size:14px">Här skriver du bara ner. Appen ger inga medicinska råd. Frågor om dos tar du med din läkare.</div>
      <button class="btn primary block" data-add>${icon('plus', 20, 2.2)}Lägg till anteckning</button>
      ${treatmentList(items, true)}
      <p class="small muted">Delas bara om du själv slår på det under Delning.</p>
    </div>`;
    el.querySelector('[data-add]').addEventListener('click', openAdd);
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
