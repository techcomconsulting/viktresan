// Mediciner idag: när ska man ta sina läkemedel, och kryssa i när man har tagit dem.
import { db, doc, getDoc, setDoc } from './firebase.js';
import { loadPrescriptions } from './data.js';
import { esc, icon, isoDay, toast, errorText } from './ui.js';

export const SLOTS = [['morning', 'Morgon', '🌅'], ['noon', 'Lunch', '☀️'], ['evening', 'Kväll', '🌆'], ['night', 'Natt', '🌙']];
export const FREQS = [['daily', 'Varje dag'], ['everyOther', 'Varannan dag'], ['weekly', 'En gång i veckan'], ['asNeeded', 'Vid behov']];
export const WEEKDAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

const dayNo = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);

// Vilka tider ska receptet tas en viss dag?
export function dueSlots(rx, iso) {
  const s = rx.schedule;
  if (!s || !s.freq || s.freq === 'asNeeded' || !Array.isArray(s.slots) || !s.slots.length) return [];
  if (s.start && iso < s.start) return [];
  if (s.freq === 'everyOther' && (dayNo(iso) - dayNo(s.start || iso)) % 2 !== 0) return [];
  if (s.freq === 'weekly') {
    const wd = (new Date(iso + 'T12:00:00').getDay() + 6) % 7; // 0 = måndag
    if (wd !== (s.weekday ?? 0)) return [];
  }
  return SLOTS.map((x) => x[0]).filter((k) => s.slots.includes(k));
}

// Kort text om hur ofta, t.ex. "Varje dag · Morgon, Kväll"
export function scheduleText(s) {
  if (!s || !s.freq) return '';
  if (s.freq === 'asNeeded') return 'Vid behov';
  const f = s.freq === 'weekly' ? `Varje ${WEEKDAYS[s.weekday ?? 0].toLowerCase()}` : FREQS.find((x) => x[0] === s.freq)?.[1] || '';
  const t = SLOTS.filter(([k]) => (s.slots || []).includes(k)).map((x) => x[1]).join(', ');
  return t ? `${f} · ${t}` : f;
}

const logRef = (uid, iso) => doc(db, 'users', uid, 'medlog', iso);
export async function loadMedLog(uid, iso) {
  try { const d = await getDoc(logRef(uid, iso)); return d.exists() ? d.data().taken || {} : {}; } catch { return {}; }
}

// Ritar "Mediciner idag" i ett element. Visar inget om inget ska tas idag.
export async function renderMedsToday(box, uid, opts = {}) {
  if (!box) return;
  const iso = isoDay(new Date());
  const [rx, taken] = await Promise.all([opts.rx ? Promise.resolve(opts.rx) : loadPrescriptions(uid), loadMedLog(uid, iso)]);
  const rows = [];
  for (const r of rx) for (const slot of dueSlots(r, iso)) rows.push({ r, slot, key: `${r.id}_${slot}` });
  if (!rows.length) { box.innerHTML = ''; return; }
  rows.sort((a, b) => SLOTS.findIndex((x) => x[0] === a.slot) - SLOTS.findIndex((x) => x[0] === b.slot));
  const draw = () => {
    const done = rows.filter((x) => taken[x.key]).length;
    box.innerHTML = `<section class="card flush">
      <div class="between" style="padding:14px 16px 6px"><h2 style="font-size:16px">Mediciner idag</h2>
        <span class="chip ${done === rows.length ? 'good' : 'neutral'}">${done} av ${rows.length}</span></div>
      ${rows.map((x) => {
        const sl = SLOTS.find((s) => s[0] === x.slot);
        const on = !!taken[x.key];
        return `<button type="button" class="list-row" data-med="${x.key}" aria-pressed="${on}" style="min-height:56px;padding:8px 16px;gap:12px">
          <span style="width:28px;height:28px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:2px solid ${on ? 'var(--accent)' : 'var(--field-line)'};background:${on ? 'var(--accent)' : '#fff'};color:#fff">${on ? icon('check', 18, 3) : ''}</span>
          <span class="grow stack" style="gap:1px;text-align:left"><span style="font-size:15px;font-weight:600;${on ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.r.name)}${x.r.strength ? ' ' + esc(x.r.strength) : ''}</span>
            <span class="small muted" style="font-size:12px">${sl[2]} ${sl[1]}${x.r.dosage ? ' · ' + esc(x.r.dosage) : ''}</span></span>
        </button>`;
      }).join('')}
    </section>`;
    box.querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.dataset.med;
      const was = taken[k];
      if (was) delete taken[k]; else taken[k] = Date.now();
      draw();
      try { await setDoc(logRef(uid, iso), { taken }); }
      catch (ex) { if (was) taken[k] = was; else delete taken[k]; draw(); toast(errorText(ex)); }
    }));
  };
  draw();
}
