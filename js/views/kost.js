// Kost: dagens mat, lägg till mat, skanna streckkod.
import {
  MEALS, mealName, mealNow, loadDay, dayTotals, logFood, updateLogged, removeLogged, loadRecent, loadWater, setWater,
  loadFavs, isFav, setFav, loadSavedMeals, saveMeal, deleteSavedMeal, logSavedMeal, savedMealKcal,
  searchSlv, searchShared, searchOff, findBarcode, addSharedFood, nutrition, loadSlv, isLiquid, isHotDrink, pieceGrams, rememberPiece
} from '../food.js';
import { saveProfile } from '../data.js';
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

export function openGoalsSheet(ctx, onSaved) {
  const p = ctx.state.profile;
  const G = goals(p);
  const field = (id, label, unit, v, hint = '') => `<div class="field"><label for="${id}">${label} (${unit})</label>
    <input class="input" id="${id}" inputmode="decimal" value="${v ?? ''}" placeholder="Inget mål">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const s = openSheet(`
    <h2>Mina kostmål</h2>
    <p class="muted" style="font-size:14px">Du väljer själv. Appen ger inga råd. Lämna tomt om du inte vill ha ett mål.</p>
    ${field('gk', 'Kalorier per dag', 'kcal', G.kcal)}
    <div class="grid2">${field('gp', 'Protein', 'g', G.p)}${field('gc', 'Kolhydrater', 'g', G.c)}</div>
    ${field('gf', 'Fett', 'g', G.f)}
    ${field('gw', 'Vatten per dag', 'liter', String(G.water / 100).replace('.', ','))}
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Kostmål');
  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const v = (id) => { const n = parseNum(s.el.querySelector('#' + id).value); return n && n > 0 ? Math.round(n) : null; };
    const w = parseNum(s.el.querySelector('#gw').value);
    const data = { kcalGoal: v('gk'), proteinGoal: v('gp'), carbGoal: v('gc'), fatGoal: v('gf'), waterGoalCl: w && w > 0 ? Math.round(w * 100) : 200 };
    await busy(e.currentTarget, async () => {
      try {
        await saveProfile(ctx.state.user.uid, data);
        Object.assign(ctx.state.profile, data);
        s.close();
        toast('Målen är sparade.');
        onSaved && onSaved();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// ---------- Dagens sida ----------

export async function kostView(el, ctx) {
  const { state } = ctx;
  const me = state.user.uid;
  const day = state.kostDay || isoDay(new Date());
  state.kostDay = day;
  const today = isoDay(new Date());
  const [items, water] = await Promise.all([loadDay(me, day), loadWater(me, day)]);
  const G = goals(state.profile);
  const T = dayTotals(items);
  const left = G.kcal ? G.kcal - T.kcal : null;
  const C = 2 * Math.PI * 56;
  const share = G.kcal ? Math.min(1, T.kcal / G.kcal) : 0;
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
          </div>
        </div>
        <div class="grow stack" style="gap:10px">
          <div class="between" style="font-size:14px"><span class="muted">Mål</span><b class="num">${G.kcal ? num(G.kcal) : '–'}</b></div>
          <div class="between" style="font-size:14px"><span class="muted">Ätit</span><b class="num">${num(T.kcal)}</b></div>
          <div class="divider"></div>
          <button class="btn ghost sm" data-goals style="padding:0;height:32px;justify-content:flex-start">${G.kcal ? 'Ändra mina mål' : 'Sätt mitt mål'}</button>
        </div>
      </div>
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
  const liquid = isLiquid(food);
  const base = liquid ? 'cl' : 'g';
  // [nyckel, knapptext, gram per enhet, ord i en, ord i flera]
  const units = liquid
    ? [['cl', 'cl', 10, 'cl', 'cl'], ['dl', 'dl', 100, 'dl', 'dl'],
      isHotDrink(food) ? ['cup', 'Kopp (15 cl)', 150, 'kopp', 'koppar'] : ['glass', 'Glas (20 cl)', 200, 'glas', 'glas']]
    : [['g', 'Gram', 1, 'g', 'g']];
  let pieceG = liquid ? null : pieceGrams(food);
  if (!liquid) units.push(['st', 'Styck', pieceG || 100, 'st', 'st']);
  if (food.portionG) units.push(['portion', `Portion (${fmt1(food.portionG)} ${liquid ? 'ml' : 'g'})`, food.portionG, 'portion', 'portioner']);
  if (food.packG) units.push(['pack', 'Hel förp.', food.packG, 'förp.', 'förp.']);
  const setPiece = (g) => { pieceG = g; const u = units.find((x) => x[0] === 'st'); if (u) u[2] = g; };
  let unit = base;
  let amount = 100;
  if (logged || opts.grams) {
    unit = base;
    amount = (logged ? logged.grams : opts.grams) / (liquid ? 10 : 1);
  } else if (liquid) {
    unit = units[2][0]; amount = 1;
  } else if (food.portionG) {
    unit = 'portion'; amount = 1;
  } else if (pieceG) {
    unit = 'st'; amount = 1;
  }
  let meal = logged ? logged.meal : (state.kostMeal || mealNow());
  let fav = await isFav(food).catch(() => false);

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
        </div>
        <button class="icon-btn" data-fav aria-label="Favorit" aria-pressed="${fav}" style="color:${fav ? 'var(--pink)' : 'var(--muted)'}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>
      </div>
      <div class="stack" style="gap:10px">
        <span style="font-size:14px;font-weight:600">Hur mycket?</span>
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
    body.querySelector('#ml').onchange = (e) => { meal = e.target.value; };
    const pw = body.querySelector('[data-piece]');
    if (pw) pw.onchange = () => { const g = parseNum(pw.value); if (g && g > 0 && g < 2000) { setPiece(g); rememberPiece(food, g); } draw(); };
    body.querySelector('[data-fav]').onclick = async () => { fav = !fav; draw(); try { await setFav(food, fav); toast(fav ? 'Sparad som favorit.' : 'Borttagen från favoriter.'); } catch (ex) { toast(errorText(ex)); } };
    body.querySelector('[data-cancel]')?.addEventListener('click', () => s.close());
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

export function openNewFoodSheet(ctx, barcode = '', presetName = '') {
  const f = (id, label, unit) => `<div class="row" style="gap:10px;padding:6px 0"><label for="${id}" class="grow" style="font-size:16px;font-weight:600">${label}</label>
    <div class="unit-input" style="width:118px;height:46px"><input id="${id}" inputmode="decimal" placeholder="0"><span>${unit}</span></div></div>`;
  const s = openSheet(`
    <h2>${barcode ? 'Varan finns inte än' : 'Lägg till en vara'}</h2>
    <p class="muted" style="font-size:14px">Skriv av näringstabellen en gång. Sedan hittar alla den nästa gång.</p>
    <div class="field"><label for="nn">Namn</label><input class="input" id="nn" maxlength="80" value="${esc(presetName)}" placeholder="t.ex. Proteinpudding vanilj"></div>
    <div class="field"><label for="nb">Märke (valfritt)</label><input class="input" id="nb" maxlength="40"></div>
    <label class="check"><input type="checkbox" id="nl"> Det är en dryck (mäts i cl)</label>
    <span class="section-title" data-per>Per 100 g</span>
    <div>${f('nk', 'Energi', 'kcal')}${f('np', 'Protein', 'g')}${f('nc', 'Kolhydrater', 'g')}${f('nf', 'Fett', 'g')}</div>
    <div class="grid2">
      <div class="field"><label for="npo">1 portion (g/ml)</label><input class="input" id="npo" inputmode="decimal" placeholder="valfritt"></div>
      <div class="field"><label for="npa">Hel förp. (g/ml)</label><input class="input" id="npa" inputmode="decimal" placeholder="valfritt"></div>
    </div>
    ${barcode ? `<p class="small muted">Streckkod ${esc(barcode)} sparas med varan.</p>` : ''}
    <p class="error hidden" role="alert">Fyll i namn och kalorier.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Ny vara');
  const nl = s.el.querySelector('#nl');
  nl.checked = isLiquid({ name: presetName });
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
        const food = await addSharedFood({
          name, brand: s.el.querySelector('#nb').value.trim(), barcode,
          per100: { kcal: Math.round(kcal), p: round1(v('np') || 0), c: round1(v('nc') || 0), f: round1(v('nf') || 0) },
          portionG: v('npo') || null, packG: v('npa') || null, liquid: nl.checked
        });
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

export function maybeShowNews(ctx) {
  try { if (localStorage.getItem('vt-news-kost')) return; localStorage.setItem('vt-news-kost', '1'); } catch { return; }
  const s = openSheet(`
    <span class="chip warn" style="align-self:flex-start;font-size:13px;letter-spacing:.06em">${icon('sparkle', 14, 2)}NYHET</span>
    <h2 style="font-size:24px">Nu kan du registrera kost också!</h2>
    <div class="stack" style="gap:12px;font-size:16px">
      <div class="row">${icon('scan', 24)}<span><b>Skanna streckkoden</b> på maten</span></div>
      <div class="row">${icon('search', 24)}<span><b>Sök</b> bland vanlig mat</span></div>
      <div class="row">${icon('food', 24)}<span>Se <b>kalorier, protein</b>, kolhydrater och fett</span></div>
      <div class="row"><span style="font-size:22px;width:24px;text-align:center">💧</span><span>Räkna <b>vatten</b> i liter</span></div>
    </div>
    <p class="small muted">Kosten är privat. Du väljer själv om någon får se den.</p>
    <button class="btn primary block" data-try>Testa nu</button>
    <button class="btn ghost block" data-close>Senare</button>`, 'Nyhet');
  s.el.querySelector('[data-try]').addEventListener('click', () => { s.close(); ctx.go('/kost'); });
}
