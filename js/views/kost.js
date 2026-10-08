// Kost: dagens mat, lägg till mat, skanna streckkod.
import { tipLink } from '../tips.js';
import {
  MEALS, mealName, mealNow, loadDay, dayTotals, logFood, updateLogged, removeLogged, loadRecent, loadWater, setWater,
  loadFavs, isFav, setFav, loadSavedMeals, saveMeal, deleteSavedMeal, logSavedMeal, savedMealKcal,
  searchSlv, searchShared, searchOff, findBarcode, addSharedFood, getSharedFood, updateSharedFood, nutrition, loadSlv, isLiquid, isHotDrink, pieceGrams, rememberPiece, rememberLiquid,
  ACTIVITIES, activityKcal, loadWorkouts, addWorkout, removeWorkout
} from '../food.js';
import { saveProfile, loadEntries, lastValues } from '../data.js';
import { startScanner } from '../scanner.js';
import { esc, fmt1, icon, isoDay, dDay, openSheet, confirmSheet, toast, busy, errorText, parseNum, round1 } from '../ui.js';

const num = (n) => Math.round(n).toLocaleString('sv-SE');
const SRC = { slv: 'Livsmedelsverket', off: 'Open Food Facts', fam: 'Tillagd av er' };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };
const litre = (cl) => (cl / 100).toFixed(2).replace(/0$/, '').replace(/\.0$/, '').replace('.', ',') + ' l';

function goals(p) {
  return {
    kcal: p.kcalGoal || null, p: p.proteinGoal || null, c: p.carbGoal || null, f: p.fatGoal || null,
    water: p.waterGoalCl || 200, glass: p.glassCl || 25
  };
}

// ---------- Mål ----------

// Kostmetoder: andel av kalorierna från protein, kolhydrater och fett (procent).
export const DIETS = [
  ['balanced', 'Balanserad', 20, 50, 30, 'Som Livsmedelsverkets råd. Bra start för de flesta.'],
  ['protein', 'Mer protein', 30, 40, 30, 'Mättar bra och hjälper musklerna när du går ner i vikt.'],
  ['medel', 'Medelhavskost', 20, 45, 35, 'Mycket grönt, fisk, olivolja och nötter.'],
  ['lowcarb', 'Lågkolhydrat', 25, 25, 50, 'Mindre bröd, pasta och socker. Mer protein och fett.'],
  ['lchf', 'LCHF', 20, 10, 70, 'Lite kolhydrater, mycket fett.'],
  ['keto', 'Keto', 20, 5, 75, 'Mycket lite kolhydrater, så att kroppen går över till att bränna fett.'],
  ['custom', 'Egen', null, null, null, 'Skriv in dina egna siffror.']
];
const ACTIVITY = [
  ['1.2', 'Mest stillasittande', 'Kontor, lite rörelse'],
  ['1.375', 'Lätt aktiv', 'Promenerar en del'],
  ['1.55', 'Aktiv', 'Står och går mycket i jobbet'],
  ['1.725', 'Mycket aktiv', 'Tungt fysiskt arbete']
];
const PACE = [['0', 'Behålla vikten', 0], ['250', 'Lugnt, ca 0,25 kg/vecka', 250], ['500', 'Normalt, ca 0,5 kg/vecka', 500], ['750', 'Snabbare, ca 0,75 kg/vecka', 750]];

// Förslag på kalorier (Mifflin-St Jeor) minus det man vill gå ner.
export function suggestKcal({ sex, age, heightCm, kg, activity, pace }) {
  if (!sex || !age || !heightCm || !kg) return null;
  const bmr = 10 * kg + 6.25 * heightCm - 5 * age + (sex === 'Man' ? 5 : -161);
  const need = bmr * Number(activity || 1.2);
  const floor = sex === 'Man' ? 1500 : 1200;
  return Math.max(floor, Math.round((need - Number(pace || 0)) / 10) * 10);
}
export function macroGrams(kcal, dietKey) {
  const d = DIETS.find((x) => x[0] === dietKey);
  if (!d || d[2] == null || !kcal) return null;
  return { p: Math.round(kcal * d[2] / 100 / 4), c: Math.round(kcal * d[3] / 100 / 4), f: Math.round(kcal * d[4] / 100 / 9) };
}

export async function openGoalsSheet(ctx, onSaved) {
  const { state } = ctx;
  const p = state.profile;
  const G = goals(p);
  const kgNow = await latestWeight(state.user.uid);
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  let sex = p.calcSex || (p.gender === 'Man' || p.gender === 'Kvinna' ? p.gender : '');
  let activity = p.activityLevel || '1.2';
  let pace = p.pace ?? '500';
  let diet = p.dietMethod || 'balanced';
  let kcalTouched = !!p.kcalGoal;

  const s = openSheet(`<div data-body></div>`, 'Kostmål');
  const body = s.el.querySelector('[data-body]');
  const val = (id) => { const n = parseNum(body.querySelector('#' + id)?.value); return n && n > 0 ? Math.round(n) : null; };

  const draw = (keep = {}) => {
    const sug = suggestKcal({ sex, age, heightCm: p.heightCm, kg: kgNow, activity, pace });
    const kcal = keep.kcal ?? (kcalTouched ? (G.kcal || sug) : sug);
    const d = DIETS.find((x) => x[0] === diet);
    const mg = macroGrams(kcal, diet);
    const mp = keep.p ?? (mg ? mg.p : G.p), mc = keep.c ?? (mg ? mg.c : G.c), mf = keep.f ?? (mg ? mg.f : G.f);
    const missing = [!sex && 'kön', !age && 'födelseår', !p.heightCm && 'längd', !kgNow && 'en vägning'].filter(Boolean);
    const sel = (id, list, cur) => `<select class="input" id="${id}">${list.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

    body.innerHTML = `<div class="stack-lg">
      <h2>Mina kostmål</h2>

      <section class="stack" style="gap:12px">
        <span class="section-title">1. Kalorier per dag</span>
        <span class="small muted" style="margin-bottom:-6px">Räkna som</span>
        <div class="seg" role="group" aria-label="Räkna som">
          ${['Kvinna', 'Man'].map((g) => `<button type="button" data-sex="${g}" aria-pressed="${g === sex}">${g}</button>`).join('')}
        </div>
        <div class="field"><label for="ga">Hur aktiv är du i vardagen?</label>${sel('ga', ACTIVITY.map(([v, l, h]) => [v, `${l} – ${h}`]), activity)}
          <span class="hint">Träning räknas för sig, så välj utan träning.</span></div>
        <div class="field"><label for="gt">Vilken takt?</label>${sel('gt', PACE, pace)}</div>
        ${sug ? `<div class="banner soft" style="font-size:14px">Förslag: <b>${num(sug)} kcal</b> per dag<br><span style="font-size:12px">Utifrån ${sex.toLowerCase()}, ${age} år, ${p.heightCm} cm, ${fmt1(kgNow)} kg</span></div>`
          : `<div class="banner neutral" style="font-size:14px">För ett förslag behövs ${missing.join(', ')}. Fyll i under Profil.</div>`}
        <div class="field"><label for="gk">Mitt mål (kcal)</label><input class="input" id="gk" inputmode="numeric" value="${kcal ?? ''}" placeholder="Inget mål"></div>
      </section>

      <section class="stack" style="gap:12px">
        <span class="section-title">2. Kostmetod</span>
        <div class="pills" role="group" aria-label="Kostmetod" style="flex-wrap:wrap">
          ${DIETS.map(([k, l]) => `<button type="button" data-diet="${k}" aria-pressed="${k === diet}" style="flex:0 0 auto">${l}</button>`).join('')}
        </div>
        <p class="small muted" style="margin:0">${esc(d[5])}${d[2] != null ? ` <b>${d[2]} % protein · ${d[3]} % kolhydrater · ${d[4]} % fett.</b>` : ''}</p>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          <div class="field"><label for="gp">Protein (g)</label><input class="input" id="gp" inputmode="numeric" value="${mp ?? ''}"></div>
          <div class="field"><label for="gc">Kolh. (g)</label><input class="input" id="gc" inputmode="numeric" value="${mc ?? ''}"></div>
          <div class="field"><label for="gf">Fett (g)</label><input class="input" id="gf" inputmode="numeric" value="${mf ?? ''}"></div>
        </div>
        ${diet === 'keto' || diet === 'lchf' ? '<p class="small" style="color:var(--pink-ink);margin:0">Har du diabetes eller tar medicin? Prata med vården innan du börjar.</p>' : ''}
      </section>

      <section class="stack" style="gap:12px">
        <span class="section-title">3. Vatten</span>
        <div class="field"><label for="gw">Vatten per dag (liter)</label><input class="input" id="gw" inputmode="decimal" value="${String(G.water / 100).replace('.', ',')}"></div>
      </section>

      <p class="small muted" style="margin:0">Förslagen är ungefärliga. Är du gravid, sjuk eller under 18, fråga vården först.</p>
      <div class="btn-row"><button class="btn" data-cancel>Avbryt</button><button class="btn primary" data-save>Spara</button></div>
    </div>`;

    body.querySelectorAll('[data-sex]').forEach((b) => { b.onclick = () => { sex = b.dataset.sex; draw(); }; });
    body.querySelector('#ga').onchange = (e) => { activity = e.target.value; draw(); };
    body.querySelector('#gt').onchange = (e) => { pace = e.target.value; draw(); };
    body.querySelector('#gk').oninput = () => { kcalTouched = true; };
    body.querySelector('#gk').onchange = () => { kcalTouched = true; draw({ kcal: val('gk') }); };
    body.querySelectorAll('[data-diet]').forEach((b) => { b.onclick = () => {
      diet = b.dataset.diet;
      if (diet === 'custom') draw({ kcal: val('gk'), p: val('gp'), c: val('gc'), f: val('gf') }); else draw({ kcal: val('gk') });
    }; });
    ['gp', 'gc', 'gf'].forEach((id) => { body.querySelector('#' + id).oninput = () => {
      if (diet !== 'custom') { diet = 'custom'; body.querySelectorAll('[data-diet]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.diet === 'custom'))); }
    }; });
    body.querySelector('[data-cancel]').onclick = () => s.close();
    body.querySelector('[data-save]').onclick = async (e) => {
      const w = parseNum(body.querySelector('#gw').value);
      const data = {
        kcalGoal: val('gk'), proteinGoal: val('gp'), carbGoal: val('gc'), fatGoal: val('gf'),
        waterGoalCl: w && w > 0 ? Math.round(w * 100) : 200, dietMethod: diet, activityLevel: activity, pace: String(pace)
      };
      if (sex) data.calcSex = sex;
      await busy(e.currentTarget, async () => {
        try {
          await saveProfile(state.user.uid, data);
          Object.assign(state.profile, data);
          s.close();
          toast('Målen är sparade.');
          onSaved && onSaved();
        } catch (ex) { toast(errorText(ex)); }
      });
    };
  };
  draw();
}

// ---------- Dagens sida ----------

export async function kostView(el, ctx) {
  const { state } = ctx;
  const me = state.user.uid;
  const day = state.kostDay || isoDay(new Date());
  state.kostDay = day;
  const today = isoDay(new Date());
  const [items, water, workouts] = await Promise.all([
    loadDay(me, day), loadWater(me, day), loadWorkouts(me, day).catch(() => [])
  ]);
  const burned = workouts.reduce((t, w) => t + (w.kcal || 0), 0);
  const G = goals(state.profile);
  const T = dayTotals(items);
  const budget = G.kcal ? G.kcal + burned : null;
  const left = budget ? budget - T.kcal : null;
  const C = 2 * Math.PI * 56;
  const share = budget ? Math.min(1, T.kcal / budget) : 0;
  const dayLabel = day === today ? 'Idag' : day === addDays(today, -1) ? 'Igår' : dDay(day + 'T12:00:00').split(' ')[0];

  const macro = (label, val, goal, bar, bg) => `<div class="stack" style="gap:6px">
    <span style="font-size:13px;font-weight:600">${label}</span>
    <div style="height:8px;border-radius:4px;background:${bg};overflow:hidden"><div style="width:${goal ? Math.min(100, (val / goal) * 100) : 0}%;height:8px;background:${bar}"></div></div>
    <span class="small muted num" style="font-size:12px">${fmt1(val)}${goal ? ' / ' + goal : ''} g</span></div>`;

  const glasses = Math.max(1, Math.ceil(G.water / G.glass));
  const filled = Math.min(glasses, Math.round(water / G.glass));

  el.innerHTML = `<div class="screen">
    <div class="between">
      <button class="icon-btn" data-day="-1" aria-label="Föregående dag">${icon('back', 20, 2.2)}</button>
      <div class="stack" style="gap:0;align-items:center"><h1 style="font-size:24px">${esc(dayLabel)}</h1><span class="small muted">${esc(dDay(day + 'T12:00:00'))}</span></div>
      <button class="icon-btn" data-day="1" aria-label="Nästa dag" ${day >= today ? 'disabled style="opacity:.4"' : ''}>${icon('right', 20, 2.2)}</button>
    </div>

    <section class="card stack-lg">
      <div class="row" style="gap:18px">
        <div style="position:relative;width:132px;height:132px;flex-shrink:0">
          <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="56" fill="none" stroke="#F2EDF9" stroke-width="13"/>
            <circle cx="66" cy="66" r="56" fill="none" stroke="var(--accent)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(C * share).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 66 66)"/></svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span class="num" style="font-size:30px;font-weight:700;letter-spacing:-.02em">${left != null ? num(Math.abs(left)) : num(T.kcal)}</span>
            <span class="small muted" style="font-size:12px">${left == null ? 'kcal idag' : left >= 0 ? 'kcal kvar' : 'kcal över målet'}</span>
            ${budget ? `<span class="small muted num" style="font-size:11px">av ${num(budget)}</span>` : ''}
          </div>
        </div>
        <div class="grow stack" style="gap:10px">
          <div class="between" style="font-size:14px"><span class="muted">Mål</span><b class="num">${G.kcal ? num(G.kcal) : '–'}</b></div>
          <div class="between" style="font-size:14px"><span class="muted">Ätit</span><b class="num" style="color:var(--pink-ink)">− ${num(T.kcal)}</b></div>
          <div class="between" style="font-size:14px"><span class="muted">Träning</span><b class="num" style="color:#2E7A5C">+ ${num(burned)}</b></div>
          <div class="divider"></div>
          ${budget ? `<div class="between" style="font-size:15px"><b>Kvar</b><b class="num">${left >= 0 ? '' : '− '}${num(Math.abs(left))}</b></div>` : ''}
          <button class="btn ghost sm" data-goals style="padding:0;height:32px;justify-content:flex-start">${G.kcal ? 'Ändra mina mål' : 'Sätt mitt mål'}</button>
        </div>
      </div>
      ${burned && G.kcal ? `<div style="padding:10px 12px;border-radius:14px;background:#EAF4EE;color:#1F5A41;font-size:13px;line-height:1.4">Du har tränat bort <b>${num(burned)} kcal</b>. Därför får du äta <b>${num(burned)} kcal mer</b>.</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
        ${macro('Protein', T.p, G.p, 'var(--accent)', '#F2EDF9')}
        ${macro('Kolhydrater', T.c, G.c, 'var(--pink)', '#FCEEF4')}
        ${macro('Fett', T.f, G.f, '#8A8478', '#F3F1EC')}
      </div>
    </section>

    <section class="card stack" style="gap:12px">
      <div class="between" style="align-items:baseline"><h2 style="font-size:16px">Vatten</h2><span class="num" style="font-size:15px"><b>${litre(water)}</b> <span class="muted">av ${litre(G.water)}</span></span></div>
      <div role="group" aria-label="Glas vatten" style="display:flex;flex-wrap:wrap;gap:2px">
        ${Array.from({ length: glasses }, (_, i) => `<button type="button" data-glass="${i}" aria-pressed="${i < filled}" aria-label="Glas ${i + 1}" style="width:32px;height:44px;border:0;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center">
          <svg width="26" height="32" viewBox="0 0 26 32" aria-hidden="true"><path d="M3 3h20l-2.5 26h-15z" fill="${i < filled ? '#DCD2EC' : '#fff'}" stroke="${i < filled ? 'var(--accent)' : '#D2CDC4'}" stroke-width="2" stroke-linejoin="round"/></svg></button>`).join('')}
      </div>
      <div class="row" style="gap:8px"><span class="small muted" style="flex-shrink:0">1 glas =</span>
        <div class="pills" role="group" aria-label="Storlek på glaset" style="flex:1">
          ${[20, 25, 33, 50].map((cl) => `<button type="button" data-size="${cl}" aria-pressed="${cl === G.glass}" style="height:36px;font-size:13px">${cl} cl</button>`).join('')}
        </div></div>
    </section>

    <section class="card flush">
      <div class="row" style="gap:10px;padding:14px 12px 10px 16px">
        <div class="grow stack" style="gap:1px"><span style="font-size:16px;font-weight:700">Träning</span>
          <span class="small" style="color:${burned ? '#2E7A5C' : 'var(--muted)'};font-weight:600">${burned ? num(burned) + ' kcal förbrukat' : 'Inget ännu'}</span></div>
        <a href="#/kost/traning" aria-label="Lägg till träning" style="width:44px;height:44px;border-radius:22px;background:#EAF4EE;color:#1F5A41;display:flex;align-items:center;justify-content:center">${icon('plus', 20, 2.4)}</a>
      </div>
      ${workouts.map((w) => `<button class="list-row" data-wo="${w.id}" style="min-height:52px;padding:10px 16px">
        <span style="width:34px;height:34px;border-radius:10px;background:#EAF4EE;color:#1F5A41;display:flex;align-items:center;justify-content:center">${icon(w.kind === 'own' ? 'watch' : 'run', 18, 2)}</span>
        <span class="grow stack" style="gap:1px"><span style="font-size:15px;font-weight:600">${esc(w.name)}</span><span class="small muted" style="font-size:12px">${w.mins ? w.mins + ' min' : 'Från klockan'}</span></span>
        <span class="num" style="font-size:14px;font-weight:700;color:#2E7A5C">+${num(w.kcal)}</span></button>`).join('')}
    </section>

    ${MEALS.map(([key, label]) => {
      const list = items.filter((i) => i.meal === key);
      const t = dayTotals(list);
      return `<section class="card flush">
        <div class="row" style="gap:10px;padding:14px 12px 10px 16px">
          <div class="grow stack" style="gap:1px"><span style="font-size:16px;font-weight:700">${label}</span>
            <span class="small muted">${list.length ? `${num(t.kcal)} kcal · ${fmt1(t.p)} g protein` : 'Inget ännu'}</span></div>
          ${list.length ? `<button class="btn ghost sm" data-savemeal="${key}" style="padding:0 8px;font-size:13px">Spara</button>` : ''}
          <a href="#/kost/lagg" data-meal="${key}" aria-label="Lägg till i ${label}" style="width:44px;height:44px;border-radius:22px;background:var(--accent-soft);color:var(--accent-dark);display:flex;align-items:center;justify-content:center">${icon('plus', 20, 2.4)}</a>
        </div>
        ${list.map((i) => `<button class="list-row" data-item="${i.id}" style="min-height:52px;padding:10px 16px">
          <span class="grow stack" style="gap:1px"><span style="font-size:15px;font-weight:600">${esc(i.name)}</span><span class="small muted" style="font-size:12px">${esc(i.label)}</span></span>
          <span class="num" style="font-size:14px;font-weight:700">${num(i.kcal)}</span></button>`).join('')}
      </section>`;
    }).join('')}
    <p class="small muted" style="text-align:center">Data från Livsmedelsverket och Open Food Facts.</p>
  </div>`;

  el.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.day);
    const next = addDays(day, n);
    if (next > today) return;
    state.kostDay = next;
    ctx.rerender();
  }));
  el.querySelectorAll('[data-wo]').forEach((b) => b.addEventListener('click', async () => {
    const w = workouts.find((x) => x.id === b.dataset.wo);
    if (!(await confirmSheet({ title: `Ta bort ${w.name}?`, text: `${num(w.kcal)} kcal`, ok: 'Ta bort', danger: true }))) return;
    try { await removeWorkout(w.id); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelector('[data-goals]').addEventListener('click', () => openGoalsSheet(ctx, () => ctx.rerender()));
  el.querySelectorAll('[data-glass]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.glass);
    const n = filled === i + 1 ? i : i + 1;
    try { await setWater(day, n * G.glass); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', async () => {
    const cl = Number(b.dataset.size);
    try { await saveProfile(state.user.uid, { glassCl: cl }); state.profile.glassCl = cl; ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-meal]').forEach((a) => a.addEventListener('click', () => { state.kostMeal = a.dataset.meal; }));
  el.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => {
    const it = items.find((x) => x.id === b.dataset.item);
    openAmountSheet(ctx, { src: it.src, ref: it.ref, name: it.name, brand: it.brand, per100: it.per100, portionG: it.portionG, packG: it.packG, liquid: it.liquid }, { logged: it, onDone: () => ctx.rerender() });
  }));
  el.querySelectorAll('[data-savemeal]').forEach((b) => b.addEventListener('click', () => {
    const list = items.filter((i) => i.meal === b.dataset.savemeal);
    const s = openSheet(`<h2>Spara som måltid</h2>
      <p class="muted" style="font-size:14px">Då kan du lägga till allt med ett tryck nästa gång.</p>
      <div class="field"><label for="mn">Namn</label><input class="input" id="mn" maxlength="40" value="Min ${esc(mealName(b.dataset.savemeal).toLowerCase())}"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`, 'Spara måltid');
    s.el.querySelector('[data-ok]').addEventListener('click', async (e) => {
      const name = s.el.querySelector('#mn').value.trim();
      if (!name) return;
      await busy(e.currentTarget, async () => {
        try { await saveMeal(name, list); s.close(); toast('Måltiden är sparad.'); } catch (ex) { toast(errorText(ex)); }
      });
    });
  }));
}

// ---------- Välj mängd ----------

export async function openAmountSheet(ctx, food, opts = {}) {
  const { state } = ctx;
  const logged = opts.logged || null;
  let liquid = isLiquid(food);
  let base, units, pieceG, unit, amount;
  // [nyckel, knapptext, gram per enhet, ord i en, ord i flera]
  const setup = (startGrams) => {
    base = liquid ? 'cl' : 'g';
    units = liquid
      ? [['cl', 'cl', 10, 'cl', 'cl'], ['dl', 'dl', 100, 'dl', 'dl'],
        isHotDrink(food) ? ['cup', 'Kopp (15 cl)', 150, 'kopp', 'koppar'] : ['glass', 'Glas (20 cl)', 200, 'glas', 'glas']]
      : [['g', 'Gram', 1, 'g', 'g']];
    pieceG = liquid ? null : pieceGrams(food);
    if (!liquid) units.push(['st', 'Styck', pieceG || 100, 'st', 'st']);
    if (food.portionG) units.push(['portion', `Portion (${fmt1(food.portionG)} ${liquid ? 'ml' : 'g'})`, food.portionG, 'portion', 'portioner']);
    if (food.packG) units.push(['pack', 'Hel förp.', food.packG, 'förp.', 'förp.']);
    unit = base;
    amount = 100;
    if (startGrams) {
      amount = round1(startGrams / (liquid ? 10 : 1));
    } else if (liquid) {
      unit = units[2][0]; amount = 1;
    } else if (food.portionG) {
      unit = 'portion'; amount = 1;
    } else if (pieceG) {
      unit = 'st'; amount = 1;
    }
  };
  setup(logged ? logged.grams : opts.grams);
  const setPiece = (g) => { pieceG = g; const u = units.find((x) => x[0] === 'st'); if (u) u[2] = g; };
  let meal = logged ? logged.meal : (state.kostMeal || mealNow());
  let fav = await isFav(food).catch(() => false);
  // Har jag själv lagt till varan? Då får jag ändra den.
  let mine = null;
  if (food.src === 'fam' && food.ref) {
    const full = await getSharedFood(food.ref);
    if (full && full.createdBy === state.user.uid) mine = full;
  }

  const s = openSheet(`<div data-body></div>`, food.name);
  const body = s.el.querySelector('[data-body]');
  const grams = () => amount * (units.find((u) => u[0] === unit) || units[0])[2];
  const step = () => (unit === 'g' ? (amount >= 100 ? 25 : 10) : unit === 'cl' ? 5 : unit === 'st' ? 1 : 0.5);
  const uWord = () => { const u = units.find((x) => x[0] === unit) || units[0]; return amount === 1 ? u[3] : u[4]; };

  const draw = () => {
    const n = nutrition(food, grams());
    const uLabel = uWord();
    body.innerHTML = `<div class="stack" style="gap:16px">
      <div class="between" style="align-items:flex-start">
        <div class="stack" style="gap:4px">
          <span class="chip neutral" style="align-self:flex-start;font-size:12px;padding:3px 9px">${esc(SRC[food.src] || 'Egen')}</span>
          <h2 style="font-size:22px">${esc(food.name)}</h2>
          ${food.brand ? `<span class="small muted">${esc(food.brand)}</span>` : ''}
          ${mine ? `<button type="button" class="btn outline sm" data-editfood style="align-self:flex-start;height:34px;margin-top:4px">Ändra varan</button>` : ''}
        </div>
        <button class="icon-btn" data-fav aria-label="Favorit" aria-pressed="${fav}" style="color:${fav ? 'var(--pink)' : 'var(--muted)'}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>
      </div>
      <div class="stack" style="gap:10px">
        <div class="between"><span style="font-size:14px;font-weight:600">Hur mycket?</span>
          <div class="seg" role="group" aria-label="Mäts i" style="width:150px">
            <button type="button" data-kind="solid" aria-pressed="${!liquid}" style="height:32px;font-size:13px">Mat (g)</button>
            <button type="button" data-kind="drink" aria-pressed="${liquid}" style="height:32px;font-size:13px">Dryck (cl)</button>
          </div></div>
        <div class="row" style="gap:10px">
          <button class="btn" data-minus aria-label="Mindre" style="width:52px;padding:0;font-size:26px;background:var(--accent-soft);color:var(--accent-dark)">−</button>
          <label class="grow" style="height:52px;border-radius:16px;border:1px solid var(--field-line);display:flex;align-items:center;justify-content:center;gap:6px">
            <input data-amount inputmode="decimal" value="${fmt1(amount).replace(',0', '')}" aria-label="Mängd" style="width:90px;border:0;outline:none;background:transparent;text-align:right;font-size:26px;font-weight:700">
            <span class="muted" style="font-size:16px;font-weight:600;width:80px">${uLabel}</span></label>
          <button class="btn" data-plus aria-label="Mer" style="width:52px;padding:0;font-size:26px;background:var(--accent-soft);color:var(--accent-dark)">+</button>
        </div>
        ${units.length > 1 ? `<div class="pills" role="group" aria-label="Enhet">${units.map(([k, l]) => `<button type="button" data-unit="${k}" aria-pressed="${k === unit}">${esc(l)}</button>`).join('')}</div>` : ''}
        ${unit === 'st' ? `<div class="row" style="gap:8px;font-size:14px"><label for="pw" class="muted">1 st väger ungefär</label>
          <div class="unit-input" style="width:104px;height:42px"><input id="pw" data-piece inputmode="decimal" value="${pieceG ? fmt1(pieceG).replace(',0', '') : ''}" placeholder="?"><span>g</span></div></div>
          ${pieceG ? '' : '<p class="small" style="color:var(--pink-ink);margin:0">Skriv hur mycket en bit väger, så räknar appen rätt.</p>'}` : ''}
      </div>
      <div class="card" style="box-shadow:none;border:1px solid var(--line);padding:14px">
        <div class="between" style="align-items:baseline"><span class="muted" style="font-size:14px;font-weight:600">Energi</span><span class="num" style="font-size:30px;font-weight:700">${num(n.kcal)} <span class="muted" style="font-size:15px">kcal</span></span></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px">
          <div style="padding:9px;border-radius:12px;background:#F2EDF9"><div class="small" style="color:#4A3F6B">Protein</div><b class="num">${fmt1(n.p)} g</b></div>
          <div style="padding:9px;border-radius:12px;background:#FCEEF4"><div class="small" style="color:#8A2E55">Kolhydrater</div><b class="num">${fmt1(n.c)} g</b></div>
          <div style="padding:9px;border-radius:12px;background:#F3F1EC"><div class="small" style="color:#4A4E47">Fett</div><b class="num">${fmt1(n.f)} g</b></div>
        </div>
        <p class="small muted" style="margin-top:8px;font-size:12px">Per ${liquid ? '100 ml' : '100 g'}: ${num(food.per100.kcal)} kcal · ${fmt1(food.per100.p)} g protein · ${fmt1(food.per100.c)} g kolh. · ${fmt1(food.per100.f)} g fett</p>
      </div>
      <div class="field"><label for="ml">Måltid</label><select class="input" id="ml">${MEALS.map(([k, l]) => `<option value="${k}" ${k === meal ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="btn-row">
        ${logged ? '<button class="btn danger-outline" data-del>Ta bort</button>' : '<button class="btn" data-cancel>Avbryt</button>'}
        <button class="btn primary" data-add>${logged ? 'Spara' : 'Lägg till'}</button>
      </div></div>`;

    body.querySelector('[data-minus]').onclick = () => { amount = Math.max(unit === 'g' || unit === 'cl' ? 5 : 0.5, round1(amount - step())); draw(); };
    body.querySelector('[data-plus]').onclick = () => { amount = round1(amount + step()); draw(); };
    const inp = body.querySelector('[data-amount]');
    inp.onchange = () => { const v = parseNum(inp.value); if (v && v > 0) amount = v; draw(); };
    body.querySelectorAll('[data-unit]').forEach((b) => { b.onclick = () => {
      const g = grams(); unit = b.dataset.unit;
      const per = (units.find((x) => x[0] === unit) || units[0])[2];
      amount = unit === 'g' || unit === 'cl' || unit === 'dl' ? round1(g / per) : unit === 'st' && pieceG ? Math.max(1, Math.round(g / per)) : 1;
      draw();
    }; });
    body.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => {
      const want = b.dataset.kind === 'drink';
      if (want === liquid) return;
      liquid = want; food.liquid = want; rememberLiquid(food, want);
      setup(null); draw();
    }; });
    body.querySelector('#ml').onchange = (e) => { meal = e.target.value; };
    const pw = body.querySelector('[data-piece]');
    if (pw) pw.onchange = () => { const g = parseNum(pw.value); if (g && g > 0 && g < 2000) { setPiece(g); rememberPiece(food, g); } draw(); };
    body.querySelector('[data-fav]').onclick = async () => { fav = !fav; draw(); try { await setFav(food, fav); toast(fav ? 'Sparad som favorit.' : 'Borttagen från favoriter.'); } catch (ex) { toast(errorText(ex)); } };
    body.querySelector('[data-cancel]')?.addEventListener('click', () => s.close());
    body.querySelector('[data-editfood]')?.addEventListener('click', () => {
      s.close();
      openNewFoodSheet(ctx, '', '', mine, (nf) => {
        const g = logged ? logged.grams : null;
        openAmountSheet(ctx, nf, { ...opts, logged: logged ? { ...logged, ...nutrition(nf, g) } : null });
        if (opts.onDone) opts.onDone();
      });
    });
    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      try { await removeLogged(logged.id); s.close(); toast('Borttaget.'); opts.onDone && opts.onDone(); } catch (ex) { toast(errorText(ex)); }
    });
    body.querySelector('[data-add]').onclick = async (e) => {
      const v = parseNum(inp.value);
      if (v && v > 0) amount = v;
      const g = grams();
      if (unit === 'st' && !pieceG) { toast('Skriv hur mycket en bit väger.'); return; }
      const a = fmt1(amount).replace(',0', '');
      const total = liquid ? `${fmt1(g / 10).replace(',0', '')} cl` : `${Math.round(g)} g`;
      const label = unit === base ? total : unit === 'dl' ? `${a} dl` : `${a} ${uWord()} · ${total}`;
      await busy(e.currentTarget, async () => {
        try {
          if (logged) {
            await updateLogged(logged.id, food, g, label, meal);
          } else {
            await logFood(state.kostDay || isoDay(new Date()), meal, food, g, label);
          }
          s.close();
          toast(logged ? 'Sparat.' : `Tillagt i ${mealName(meal).toLowerCase()}.`);
          if (opts.onDone) opts.onDone(); else ctx.go('/kost');
        } catch (ex) { toast(errorText(ex)); }
      });
    };
  };
  draw();
}

// ---------- Ny vara ----------

export function openNewFoodSheet(ctx, barcode = '', presetName = '', edit = null, after = null) {
  const e0 = edit || {};
  const val = (x) => (x == null || x === '' ? '' : fmt1(x).replace(',0', ''));
  const pre = { nk: val(e0.per100?.kcal), np: val(e0.per100?.p), nc: val(e0.per100?.c), nf: val(e0.per100?.f) };
  const f = (id, label, unit) => `<div class="row" style="gap:10px;padding:6px 0"><label for="${id}" class="grow" style="font-size:16px;font-weight:600">${label}</label>
    <div class="unit-input" style="width:118px;height:46px"><input id="${id}" inputmode="decimal" placeholder="0" value="${pre[id] || ''}"><span>${unit}</span></div></div>`;
  const s = openSheet(`
    <h2>${edit ? 'Ändra varan' : barcode ? 'Varan finns inte än' : 'Lägg till en vara'}</h2>
    <p class="muted" style="font-size:14px">${edit ? 'Rätta det som blev fel. Det du redan har ätit av varan räknas om.' : 'Skriv av näringstabellen en gång. Sedan hittar alla den nästa gång.'}</p>
    <div class="field"><label for="nn">Namn</label><input class="input" id="nn" maxlength="80" value="${esc(edit ? e0.name : presetName)}" placeholder="t.ex. Proteinpudding vanilj"></div>
    <div class="field"><label for="nb">Märke (valfritt)</label><input class="input" id="nb" maxlength="40" value="${esc(e0.brand || '')}"></div>
    <label class="check"><input type="checkbox" id="nl"> Det är en dryck (mäts i cl)</label>
    <span class="section-title" data-per>Per 100 g</span>
    <div>${f('nk', 'Energi', 'kcal')}${f('np', 'Protein', 'g')}${f('nc', 'Kolhydrater', 'g')}${f('nf', 'Fett', 'g')}</div>
    <div class="grid2">
      <div class="field"><label for="npo">1 portion (g/ml)</label><input class="input" id="npo" inputmode="decimal" placeholder="valfritt" value="${val(e0.portionG)}"></div>
      <div class="field"><label for="npa">Hel förp. (g/ml)</label><input class="input" id="npa" inputmode="decimal" placeholder="valfritt" value="${val(e0.packG)}"></div>
    </div>
    ${barcode ? `<p class="small muted">Streckkod ${esc(barcode)} sparas med varan.</p>` : ''}
    <p class="error hidden" role="alert">Fyll i namn och kalorier.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Ny vara');
  const nl = s.el.querySelector('#nl');
  nl.checked = edit ? isLiquid(edit) : isLiquid({ name: presetName });
  const syncPer = () => { s.el.querySelector('[data-per]').textContent = nl.checked ? 'Per 100 ml' : 'Per 100 g'; };
  nl.addEventListener('change', syncPer);
  syncPer();
  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const v = (id) => parseNum(s.el.querySelector('#' + id).value);
    const name = s.el.querySelector('#nn').value.trim();
    const kcal = v('nk');
    if (!name || kcal == null || kcal < 0 || kcal > 1000) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    await busy(e.currentTarget, async () => {
      try {
        const data = {
          name, brand: s.el.querySelector('#nb').value.trim(), barcode,
          per100: { kcal: Math.round(kcal), p: round1(v('np') || 0), c: round1(v('nc') || 0), f: round1(v('nf') || 0) },
          portionG: v('npo') || null, packG: v('npa') || null, liquid: nl.checked
        };
        if (edit) {
          rememberLiquid(edit, nl.checked);
          const food = await updateSharedFood(edit.ref, data);
          s.close();
          toast('Varan är ändrad.');
          if (after) after(food);
          return;
        }
        const food = await addSharedFood(data);
        s.close();
        toast('Varan är sparad.');
        openAmountSheet(ctx, food);
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// ---------- Lägg till mat ----------

export async function addFoodView(el, ctx) {
  const { state } = ctx;
  const me = state.user.uid;
  if (!state.kostMeal) state.kostMeal = mealNow();
  let tab = 'recent';
  let q = '';
  loadSlv();

  el.innerHTML = `<div class="screen no-nav">
    <div class="between">
      <a href="#/kost" class="icon-btn" aria-label="Stäng">${icon('close', 20, 2)}</a>
      <label for="mt" class="row" style="gap:6px;font-size:17px;font-weight:700">Lägg till i
        <select id="mt" style="border:0;background:transparent;font-size:17px;font-weight:700;color:var(--accent-dark);padding:0">
          ${MEALS.map(([k, l]) => `<option value="${k}" ${k === state.kostMeal ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <span style="width:44px"></span>
    </div>
    <a href="#/kost/skanna" class="btn primary block" style="height:64px;font-size:17px;border-radius:18px">${icon('scan', 26, 2)}Skanna streckkod</a>
    <div class="row" style="gap:8px;background:#fff;border:1px solid var(--field-line);border-radius:14px;padding:0 12px">
      <span class="muted">${icon('search', 20)}</span>
      <input id="q" type="search" placeholder="Sök mat, t.ex. kyckling" aria-label="Sök mat" autocomplete="off" style="flex:1;min-width:0;height:48px;border:0;outline:none;background:transparent;font-size:16px">
    </div>
    <div class="seg" role="group" aria-label="Visa" data-tabs>
      <button type="button" data-tab="recent" aria-pressed="true">Senaste</button>
      <button type="button" data-tab="favs" aria-pressed="false">Favoriter</button>
      <button type="button" data-tab="meals" aria-pressed="false">Måltider</button>
    </div>
    <div data-list><div class="empty">Laddar…</div></div>
    <button class="btn ghost" data-new>Hittar du inte? Lägg till en egen vara</button>
  </div>`;

  const list = el.querySelector('[data-list]');
  const tabs = el.querySelector('[data-tabs]');
  el.querySelector('#mt').addEventListener('change', (e) => { state.kostMeal = e.target.value; });
  el.querySelector('[data-new]').addEventListener('click', () => openNewFoodSheet(ctx, '', q));

  const row = (title, sub, tag, i) => `<div class="list-row" style="padding:8px 8px 8px 16px">
    <button type="button" data-pick="${i}" class="grow stack" style="gap:2px;border:0;background:none;text-align:left;padding:0;cursor:pointer;min-height:44px;justify-content:center">
      <span style="font-size:15px;font-weight:700">${esc(title)}</span><span class="small muted" style="font-size:12px">${esc(sub)}</span></button>
    ${tag ? `<span class="chip neutral" style="font-size:11px;padding:3px 8px">${esc(tag)}</span>` : ''}
    <button type="button" data-pick="${i}" aria-label="Lägg till ${esc(title)}" style="width:44px;height:44px;border-radius:22px;border:0;background:var(--accent-soft);color:var(--accent-dark);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">${icon('plus', 18, 2.6)}</button>
  </div>`;
  const render = (entries, empty) => {
    list.innerHTML = entries.length ? `<div class="card flush">${entries.map((e, i) => row(e.title, e.sub, e.tag, i)).join('')}</div>` : `<div class="card empty">${empty}</div>`;
    list.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => entries[Number(b.dataset.pick)].go()));
  };
  const foodEntry = (f, tag) => ({
    title: f.name, sub: `${f.brand ? f.brand + ' · ' : ''}${Math.round(f.per100.kcal)} kcal / 100 ${isLiquid(f) ? 'ml' : 'g'}`, tag,
    go: () => openAmountSheet(ctx, f)
  });

  const showTab = async () => {
    tabs.classList.remove('hidden');
    tabs.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    try {
      if (tab === 'recent') {
        const r = await loadRecent(me);
        render(r.map((x) => ({ title: x.food.name, sub: `${x.label} · ${nutrition(x.food, x.grams).kcal} kcal`, go: () => openAmountSheet(ctx, x.food, { grams: x.grams }) })),
          'Här syns det du ätit senast.<br>Skanna eller sök för att börja.');
      } else if (tab === 'favs') {
        const r = await loadFavs(me);
        render(r.map((x) => foodEntry(x.food)), 'Tryck på hjärtat på en vara för att spara den här.');
      } else {
        const r = await loadSavedMeals(me);
        render(r.map((m) => ({
          title: m.name, sub: `${m.items.length} delar · ${num(savedMealKcal(m))} kcal`, tag: 'Måltid',
          go: () => {
            const s = openSheet(`<h2>${esc(m.name)}</h2>
              <div class="card flush" style="box-shadow:none;border:1px solid var(--line)">${m.items.map((i) => `<div class="list-row" style="min-height:48px"><span class="grow">${esc(i.name)}</span><span class="small muted">${esc(i.label)}</span></div>`).join('')}</div>
              <div class="btn-row"><button class="btn danger-outline" data-rm>Ta bort</button><button class="btn primary" data-use>Lägg till i ${esc(mealName(state.kostMeal).toLowerCase())}</button></div>`, m.name);
            s.el.querySelector('[data-use]').addEventListener('click', async (e) => {
              await busy(e.currentTarget, async () => {
                try { await logSavedMeal(state.kostDay || isoDay(new Date()), state.kostMeal, m); s.close(); toast('Måltiden är tillagd.'); ctx.go('/kost'); } catch (ex) { toast(errorText(ex)); }
              });
            });
            s.el.querySelector('[data-rm]').addEventListener('click', async () => {
              s.close();
              if (!(await confirmSheet({ title: `Ta bort ${m.name}?`, ok: 'Ta bort', danger: true }))) return;
              try { await deleteSavedMeal(m.id); showTab(); } catch (ex) { toast(errorText(ex)); }
            });
          }
        })), 'Inga sparade måltider.<br>Tryck på "Spara" vid en måltid på kost-sidan.');
      }
    } catch (ex) { render([], errorText(ex)); }
  };

  let searchNo = 0;
  const doSearch = async () => {
    const my = ++searchNo;
    tabs.classList.add('hidden');
    list.innerHTML = '<div class="empty">Söker…</div>';
    const [shared, slv] = await Promise.all([searchShared(q), searchSlv(q)]);
    if (my !== searchNo) return;
    const entries = [...shared.map((f) => foodEntry(f, 'Er vara')), ...slv.map((f) => foodEntry(f))];
    const more = { title: 'Sök bland butiksvaror', sub: 'Open Food Facts', tag: '', go: async () => {
      list.innerHTML = '<div class="empty">Söker bland butiksvaror…</div>';
      try {
        const off = await searchOff(q);
        if (my !== searchNo) return;
        render([...entries, ...off.map((f) => foodEntry(f, 'Butik'))], 'Inget hittades.');
      } catch { render(entries, 'Kunde inte söka just nu.'); }
    } };
    render([...entries, more], 'Inget hittades.');
  };

  let t;
  el.querySelector('#q').addEventListener('input', (e) => {
    q = e.target.value.trim();
    clearTimeout(t);
    if (!q) { searchNo++; showTab(); return; }
    t = setTimeout(doSearch, 250);
  });
  tabs.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; showTab(); }));
  showTab();
}

// ---------- Skanna ----------

export async function scanView(el, ctx) {
  el.innerHTML = `<div style="position:fixed;inset:0;background:#1B1820;color:#fff;z-index:30">
    <video playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>
    <div aria-hidden="true" style="position:absolute;left:50%;top:42%;width:min(310px,80vw);height:200px;transform:translate(-50%,-50%);border:3px solid #fff;border-radius:22px;box-shadow:0 0 0 9999px rgba(20,18,24,.6)"></div>
    <div aria-hidden="true" style="position:absolute;left:50%;top:42%;width:min(270px,70vw);height:3px;transform:translateX(-50%);background:var(--pink);box-shadow:0 0 12px rgba(201,76,126,.9)"></div>
    <div class="between" style="position:absolute;left:16px;right:16px;top:calc(env(safe-area-inset-top) + 16px)">
      <a href="#/kost/lagg" class="icon-btn" aria-label="Stäng" style="background:rgba(255,255,255,.16);color:#fff;box-shadow:none">${icon('close', 20, 2.2)}</a>
      <span style="font-size:17px;font-weight:700">Skanna streckkod</span>
      <button class="icon-btn hidden" data-torch aria-label="Lampa" aria-pressed="false" style="background:rgba(255,255,255,.16);color:#fff;box-shadow:none">${icon('torch', 20, 2)}</button>
      <span data-torchspace style="width:44px"></span>
    </div>
    <p data-msg style="position:absolute;left:20px;right:20px;top:calc(42% - 150px);text-align:center;font-size:16px;font-weight:600;margin:0">Håll streckkoden inne i rutan</p>
    <div style="position:absolute;left:20px;right:20px;bottom:calc(env(safe-area-inset-bottom) + 28px);display:flex;flex-direction:column;gap:10px">
      <button class="btn block" data-manual style="background:rgba(255,255,255,.16);color:#fff">Skriv in streckkoden</button>
      <p style="margin:0;text-align:center;font-size:13px;color:#D8D2E2">Tillåt kameran om telefonen frågar.</p>
    </div>
  </div>`;
  const video = el.querySelector('video');
  const msg = el.querySelector('[data-msg]');
  let scanner = null;
  let busyCode = false;

  const handle = async (code) => {
    if (busyCode) return;
    busyCode = true;
    if (navigator.vibrate) navigator.vibrate(60);
    msg.textContent = 'Letar upp varan…';
    try {
      const food = await findBarcode(code);
      scanner && scanner.stop();
      ctx.go('/kost/lagg');
      setTimeout(() => (food ? openAmountSheet(ctx, food) : openNewFoodSheet(ctx, code)), 150);
    } catch (ex) {
      msg.textContent = 'Något gick fel. Försök igen.';
      busyCode = false;
    }
  };

  el.querySelector('[data-manual]').addEventListener('click', () => {
    const s = openSheet(`<h2>Skriv in streckkoden</h2>
      <div class="field"><label for="bc">Siffrorna under strecken</label><input class="input" id="bc" inputmode="numeric" autocomplete="off"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-ok>Sök</button></div>`, 'Streckkod');
    s.el.querySelector('[data-ok]').addEventListener('click', () => {
      const c = s.el.querySelector('#bc').value.replace(/\D/g, '');
      if (c.length < 8) { toast('Streckkoden ska ha minst 8 siffror.'); return; }
      s.close();
      handle(c);
    });
  });

  ctx.onLeave(() => scanner && scanner.stop());
  setTimeout(async () => {
    try {
      scanner = await startScanner(video, handle);
      if (scanner.hasTorch) {
        const tb = el.querySelector('[data-torch]');
        tb.classList.remove('hidden');
        el.querySelector('[data-torchspace]').classList.add('hidden');
        tb.addEventListener('click', async () => { const on = await scanner.toggleTorch(); tb.setAttribute('aria-pressed', String(on)); tb.style.background = on ? '#fff' : 'rgba(255,255,255,.16)'; tb.style.color = on ? '#1B1D1C' : '#fff'; });
      }
    } catch (ex) {
      console.warn(ex);
      msg.innerHTML = 'Kameran gick inte att starta.<br><span style="font-weight:400;font-size:14px">Tillåt kameran i inställningarna, eller skriv in streckkoden.</span>';
    }
  }, 50);
}

// ---------- NYHET-ruta ----------

const NEWS = [
  { id: 'vt-news-kost', title: 'Nu kan du registrera kost också!', go: '/kost', rows: [
    ['scan', '<b>Skanna streckkoden</b> på maten'], ['search', '<b>Sök</b> bland vanlig mat'],
    ['food', 'Se <b>kalorier, protein</b>, kolhydrater och fett'], ['water', 'Räkna <b>vatten</b> i liter']
  ], note: 'Kosten är privat. Du väljer själv om någon får se den.' },
  { id: 'vt-news-traning', title: 'Nu kan du registrera träning!', go: '/kost/traning', rows: [
    ['run', 'Välj <b>aktivitet och tid</b>, t.ex. promenad 30 min'], ['flag', 'Eller skriv in <b>kalorier från klockan</b>'],
    ['watch', 'Fungerar med <b>Fitbit, Samsung, Garmin</b> och andra klockor'], ['food', 'Tränar du får du <b>äta mer</b> samma dag']
  ], note: 'Du hittar det under Kost → Träning.' },
  { id: 'vt-news-blod', title: 'Nu kan du spara blodvärden!', go: '/blodvarden', rows: [
    ['heart', '<b>Blodsocker</b> och långtidssocker'], ['chart', '<b>Kolesterol</b> och blodfetter'],
    ['run', '<b>Blodtryck</b> och vilopuls'], ['lock', 'Helt <b>privat</b>. Du väljer om någon får se']
  ], note: 'Du hittar det under Profil och under Lägg till.' },
  { id: 'vt-news-bjud', title: 'Bjud in en vän!', go: '/profil', rows: [
    ['send', 'Skicka en <b>länk</b> via sms eller Messenger'], ['users', 'Det är lättare att gå ner i vikt <b>tillsammans</b>'],
    ['bell', 'Du får en <b>notis</b> när din vän har gått med'], ['lock', 'Ni väljer själva vad ni <b>delar</b>']
  ], note: 'Du hittar det under Profil.' }
];

export function maybeShowNews(ctx) {
  let n;
  try { n = NEWS.find((x) => !localStorage.getItem(x.id)); if (!n) return; localStorage.setItem(n.id, '1'); } catch { return; }
  const s = openSheet(`
    <span class="chip warn" style="align-self:flex-start;font-size:13px;letter-spacing:.06em">${icon('sparkle', 14, 2)}NYHET</span>
    <h2 style="font-size:24px">${n.title}</h2>
    <div class="stack" style="gap:12px;font-size:16px">
      ${n.rows.map(([ic, t]) => `<div class="row">${ic === 'water' ? '<span style="font-size:22px;width:24px;text-align:center">💧</span>' : icon(ic, 24)}<span>${t}</span></div>`).join('')}
    </div>
    <p class="small muted">${n.note}</p>
    <button class="btn primary block" data-try>Testa nu</button>
    <button class="btn ghost block" data-close>Senare</button>`, 'Nyhet');
  s.el.querySelector('[data-try]').addEventListener('click', () => { s.close(); ctx.go(n.go); });
}

// ---------- Lägg till träning ----------

async function latestWeight(uid) {
  try { return lastValues(await loadEntries(uid), 'weight').last?.weight || null; } catch { return null; }
}

const WATCHES = ['Fitbit', 'Samsung', 'Garmin', 'Pixel Watch', 'Apple Watch', 'Annan'];

export async function trainingView(el, ctx) {
  const { state } = ctx;
  const me = state.user.uid;
  const day = state.kostDay || isoDay(new Date());
  const kg = await latestWeight(me);
  let tab = /flik=klocka/.test(location.hash) ? 'own' : 'pick';
  let watch = '';
  let act = 'walk';
  let mins = 30;
  let weight = kg || 75;

  const draw = () => {
    const kcal = activityKcal(act, mins, weight);
    const tabs = [['pick', 'Aktivitet'], ['own', 'Från klockan']];
    el.innerHTML = `<div class="screen no-nav">
      <div class="between">
        <a href="#/kost" class="icon-btn" aria-label="Stäng">${icon('close', 20, 2)}</a>
        <span style="font-size:17px;font-weight:700">Lägg till träning</span>
        <span style="width:44px"></span>
      </div>
      <div class="seg" role="group" aria-label="Sätt">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>
      ${tab === 'pick' ? `
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${ACTIVITIES.map(([k, l, met]) => `<button type="button" data-act="${k}" aria-pressed="${k === act}" style="min-height:62px;border-radius:16px;cursor:pointer;font-size:13px;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;background:${k === act ? '#EAF4EE' : '#fff'};color:${k === act ? '#1F5A41' : 'var(--ink)'};border:1.5px solid ${k === act ? '#2E7A5C' : 'var(--field-line)'}">
            ${esc(l)}<span style="font-size:11px;font-weight:500;color:var(--muted)">${activityKcal(k, 30, weight)} kcal/30 min</span></button>`).join('')}
        </div>
        <section class="card stack-lg">
          <span style="font-size:14px;font-weight:600">Hur länge?</span>
          <div class="row" style="gap:10px">
            <button class="btn" data-m="-5" aria-label="Kortare" style="width:52px;padding:0;font-size:26px;background:#EAF4EE;color:#1F5A41">−</button>
            <label class="grow" style="height:52px;border-radius:16px;border:1px solid var(--field-line);display:flex;align-items:center;justify-content:center;gap:6px">
              <input data-mins inputmode="numeric" value="${mins}" aria-label="Minuter" style="width:70px;border:0;outline:none;background:transparent;text-align:right;font-size:26px;font-weight:700"><span class="muted" style="font-weight:600">min</span></label>
            <button class="btn" data-m="5" aria-label="Längre" style="width:52px;padding:0;font-size:26px;background:#EAF4EE;color:#1F5A41">+</button>
          </div>
          <div class="between" style="align-items:baseline;border-top:1px solid var(--line);padding-top:10px"><span class="muted" style="font-size:14px">Förbrukat ungefär</span>
            <span class="num" style="font-size:28px;font-weight:700;color:#2E7A5C">${num(kcal)} <span class="muted" style="font-size:15px">kcal</span></span></div>
          <div class="row" style="gap:8px;font-size:13px"><label for="kg" class="muted">Räknat på din vikt</label>
            <div class="unit-input" style="width:100px;height:40px"><input id="kg" data-kg inputmode="decimal" value="${fmt1(weight).replace(',0', '')}"><span>kg</span></div></div>
        </section>
        <button class="btn block" data-save style="background:#2E7A5C;color:#fff">Lägg till ${num(kcal)} kcal</button>` : ''}
      ${tab === 'own' ? `
        <section class="card stack-lg">
          <span style="font-size:14px;font-weight:600">Vilken klocka?</span>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${WATCHES.map((w) => `<button type="button" class="chip" data-watch="${esc(w)}" aria-pressed="${w === watch}" style="min-height:40px;padding:0 14px;font-size:14px;cursor:pointer;border:1.5px solid ${w === watch ? '#2E7A5C' : 'var(--field-line)'};background:${w === watch ? '#EAF4EE' : '#fff'};color:${w === watch ? '#1F5A41' : 'var(--ink)'}">${esc(w)}</button>`).join('')}
          </div>
          <p class="small muted" style="margin:0">Öppna klockans app. Titta efter <b>Aktiva kalorier</b> för idag. Skriv in siffran här.</p>
          <div class="field"><label for="ok">Aktiva kalorier</label><input class="input" id="ok" inputmode="numeric" placeholder="0" style="font-size:22px;font-weight:700"></div>
          <div class="field"><label for="on">Vad gjorde du? (valfritt)</label><input class="input" id="on" maxlength="40" placeholder="t.ex. Promenad"></div>
          <div class="field"><label for="om">Minuter (valfritt)</label><input class="input" id="om" inputmode="numeric"></div>
        </section>
        <button class="btn block" data-saveown style="background:#2E7A5C;color:#fff">Lägg till</button>
        <p class="small muted">Lägg inte in samma pass två gånger. Klockans siffra räknar redan med det du gjort.</p>` : ''}
      ${tipLink('klocka', 'Har du ingen klocka?')}
    </div>`;

    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
    el.querySelectorAll('[data-watch]').forEach((b) => b.addEventListener('click', () => { watch = watch === b.dataset.watch ? '' : b.dataset.watch; const k = el.querySelector('#ok').value, n = el.querySelector('#on').value, m = el.querySelector('#om').value; draw(); el.querySelector('#ok').value = k; el.querySelector('#on').value = n; el.querySelector('#om').value = m; }));
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { act = b.dataset.act; draw(); }));
    el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { mins = Math.max(5, mins + Number(b.dataset.m)); draw(); }));
    const mi = el.querySelector('[data-mins]');
    if (mi) mi.addEventListener('change', () => { const v = parseNum(mi.value); if (v && v > 0 && v < 1000) mins = Math.round(v); draw(); });
    const ki = el.querySelector('[data-kg]');
    if (ki) ki.addEventListener('change', () => { const v = parseNum(ki.value); if (v && v > 25 && v < 350) weight = v; draw(); });
    el.querySelector('[data-save]')?.addEventListener('click', async (e) => {
      const name = ACTIVITIES.find((x) => x[0] === act)[1];
      await busy(e.currentTarget, async () => {
        try { await addWorkout(day, { kind: 'act', act, name, mins, kcal: activityKcal(act, mins, weight) }); toast('Träningen är tillagd.'); ctx.go('/kost'); } catch (ex) { toast(errorText(ex)); }
      });
    });
    el.querySelector('[data-saveown]')?.addEventListener('click', async (e) => {
      const name = el.querySelector('#on').value.trim() || (watch ? `Från ${watch}` : 'Från klockan');
      const k = parseNum(el.querySelector('#ok').value);
      const m = parseNum(el.querySelector('#om').value);
      if (!k || k <= 0 || k > 5000) { toast('Skriv hur många kalorier.'); return; }
      await busy(e.currentTarget, async () => {
        try { await addWorkout(day, { kind: 'own', name, watch: watch || null, mins: m ? Math.round(m) : null, kcal: k }); toast('Träningen är tillagd.'); ctx.go('/kost'); } catch (ex) { toast(errorText(ex)); }
      });
    });
  };
  draw();
}
