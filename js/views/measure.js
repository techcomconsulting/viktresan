// Ny mätning och resultatet efteråt.
import { tipLink } from '../tips.js';
import { checkNewBadges } from './badges.js';
import { syncMyScores } from '../challenges.js';
import { loadEntries, addEntry, METRICS, createPost, notify, addPhoto, loadPeople, loadGroups, lastValues } from '../data.js';
import { esc, fmt1, signed, parseNum, icon, dDay, tHM, dLong, toast, busy, openSheet, errorText, resizeImage, round1, confetti } from '../ui.js';
import { progressInfo } from './overview.js';

export async function measureView(el, ctx) {
  const { state } = ctx;
  const uid = state.user.uid;
  const entries = await loadEntries(uid);
  // Senaste kända värdet för varje mått, även om det fylldes i vid olika tillfällen.
  const prev = entries.length ? Object.fromEntries([['at', entries[entries.length - 1].at],
    ...METRICS.map(([k]) => [k, lastValues(entries, k).last?.[k] ?? null])]) : null;
  const now = new Date();

  el.innerHTML = `<div class="screen no-nav">
    <div class="between">
      <a href="#/" class="icon-btn" aria-label="Stäng">${icon('close', 20, 2)}</a>
      <span style="font-size:17px;font-weight:700">Ny mätning</span>
      <span style="width:44px"></span>
    </div>
    <div class="stack" style="gap:4px">
      <h1 style="font-size:26px">${esc(dDay(now))}, ${tHM(now)}</h1>
      <p class="muted" style="font-size:14px">Datum och tid sparas automatiskt.</p>
    </div>
    <form class="stack-lg" novalidate>
      <div class="card flush">
        ${METRICS.map(([key, label, unit]) => `
          <div class="measure-row">
            <div class="grow stack" style="gap:3px">
              <label for="m-${key}" style="font-size:16px;font-weight:700">${label}</label>
              <span class="small muted">${prev && prev[key] != null ? `Förra: ${fmt1(prev[key])} ${unit}` : unit === 'kg' ? 'I kilo' : 'I centimeter'}</span>
            </div>
            <span class="chip neutral hidden" data-delta="${key}"></span>
            <div class="unit-input"><input id="m-${key}" name="${key}" inputmode="decimal" autocomplete="off" placeholder="–"><span>${unit}</span></div>
          </div>`).join('')}
      </div>
      <p class="small muted row" style="gap:8px">${icon('info', 16)}Fyll i det du vill. Minst ett värde. Vikt i kg, mått i cm.</p>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Spara mätning</button>
    </form>
    <div class="stack" style="gap:6px">${tipLink('vag', 'Saknar du våg?')}${tipLink('mattband', 'Saknar du måttband?')}</div>
  </div>`;

  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  METRICS.forEach(([key, , unit]) => {
    const input = form.querySelector(`[name=${key}]`);
    const chip = form.querySelector(`[data-delta=${key}]`);
    input.addEventListener('input', () => {
      const v = parseNum(input.value);
      if (v == null || !prev || prev[key] == null) { chip.classList.add('hidden'); return; }
      const d = v - prev[key];
      chip.textContent = signed(d, unit);
      chip.className = 'chip ' + (d < 0 ? 'good' : 'neutral');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const vals = {};
    for (const [key, label] of METRICS) {
      const raw = form.querySelector(`[name=${key}]`).value.trim();
      if (!raw) { vals[key] = null; continue; }
      const v = parseNum(raw);
      const [min, max] = key === 'weight' ? [25, 350] : [5, 250];
      if (v == null || v < min || v > max) {
        err.textContent = `Kontrollera ${label.toLowerCase()}.`;
        err.classList.remove('hidden');
        form.querySelector(`[name=${key}]`).focus();
        return;
      }
      vals[key] = round1(v);
    }
    if (METRICS.every(([k]) => vals[k] == null)) {
      err.textContent = 'Fyll i minst ett värde.';
      err.classList.remove('hidden');
      form.querySelector('[name=weight]').focus();
      return;
    }
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        const saved = await addEntry(uid, state.profile, entries, vals);
        if (state.profile.startWeight == null) state.profile.startWeight = saved.startWeight;
        const start = state.profile.startWeight;
        let milestone = null;
        if (prev && prev.weight != null && saved.weight != null) {
          const a = progressInfo(start, state.profile.goalWeight, prev.weight);
          const b = progressInfo(start, state.profile.goalWeight, saved.weight);
          if (a && b) {
            const crossed = b.miles.filter((m) => m.done && a.pct < m.m);
            if (crossed.length) milestone = crossed[crossed.length - 1].m;
          }
        }
        if (milestone) notify(uid, `Du nådde ${Math.round(milestone * 100)} % av ditt mål.`, '#/historik');
        state.lastResult = { entry: saved, prev, first: !prev, milestone, start };
        ctx.go('/matning/klar');
      } catch (ex) {
        err.textContent = errorText(ex);
        err.classList.remove('hidden');
      }
    });
  });
}

export async function resultView(el, ctx) {
  const { state } = ctx;
  const r = state.lastResult;
  if (!r) { ctx.go('/'); return; }
  const { entry, prev, first, milestone, start } = r;

  const rows = METRICS.filter(([key]) => entry[key] != null).map(([key, label, unit]) => {
    const d = prev && prev[key] != null ? entry[key] - prev[key] : null;
    return `<div class="list-row" style="min-height:54px">
      <span class="grow title">${label}</span>
      <span class="muted num" style="font-size:15px">${fmt1(entry[key])} ${unit}</span>
      ${d != null ? `<span class="chip ${d <= 0 ? 'good' : 'neutral'} num" style="min-width:84px;justify-content:center">${signed(d, unit)}</span>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="screen no-nav">
    <div class="row" style="gap:14px;margin-top:20px">
      <span style="width:52px;height:52px;border-radius:26px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center">${icon('check', 26, 2.6)}</span>
      <div class="stack" style="gap:2px">
        <h1 style="font-size:26px">${first ? 'Första mätningen sparad' : 'Mätning sparad'}</h1>
        <span class="muted" style="font-size:14px">${first ? 'Det här är din startpunkt.' : `Jämfört med ${esc(dLong(prev.at))}`}</span>
      </div>
    </div>
    <div class="card flush">${rows}</div>
    ${milestone ? `<div class="banner pink row">${icon('flag', 24)}<span><strong>Delmål klart!</strong> Du har gått ${Math.round(milestone * 100)} % av vägen.</span></div>` : ''}
    ${first ? `
      <div class="card stack-lg">
        <h2>Vill du ta en bild för att kunna se din förändring senare?</h2>
        <p class="muted">Bilder är alltid privata. Bara du ser dem.</p>
        <a class="btn primary block" href="#/bilder">Ladda upp bilder</a>
        <a class="btn block" href="#/">Hoppa över</a>
      </div>` : `
      <div class="card stack-lg">
        <div class="stack" style="gap:4px"><h2>Vill du dela ditt framsteg?</h2><p class="muted" style="font-size:14px">Bara de du har valt kan se det.</p></div>
        <div class="btn-row"><a class="btn" href="#/">Inte nu</a><button class="btn primary" data-share>Skapa inlägg</button></div>
      </div>`}
  </div>`;

  const shareBtn = el.querySelector('[data-share]');
  if (shareBtn) shareBtn.addEventListener('click', () => openPostSheet(ctx, entry, prev, start));
  if (first) { openPhotoPrompt(ctx, entry); return; }
  // Nya märken? Firande med konfetti. Uppdatera också utmaningar.
  setTimeout(async () => {
    const all = await loadEntries(state.user.uid).catch(() => null);
    if (!all) return;
    syncMyScores(all, state.profile.firstName).catch(() => {});
    const shown = await checkNewBadges(ctx, all).catch(() => false);
    if (!shown && milestone) confetti();
  }, 500);
}

function openPhotoPrompt(ctx, entry) {
  const uid = ctx.state.user.uid;
  const s = openSheet(`
    <span style="width:56px;height:56px;border-radius:28px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon('camera', 28)}</span>
    <h2>Vill du ta en bild för att kunna se din förändring senare?</h2>
    <p class="muted">Bilder är alltid privata. Bara du ser dem tills du själv väljer att dela.</p>
    <div class="grid2">
      ${[['face', 'Ansiktsbild'], ['body', 'Helkroppsbild']].map(([k, label]) => `
        <label class="btn outline" style="height:104px;flex-direction:column;border-style:dashed" data-kind="${k}">
          ${icon(k, 30, 1.6)}<span>${label}</span>
          <input type="file" accept="image/*" class="hidden">
        </label>`).join('')}
    </div>
    <button class="btn primary block" data-done>Ladda upp bilder</button>
    <button class="btn ghost block" data-close>Hoppa över</button>`, 'Bilder');
  const chosen = {};
  s.el.querySelectorAll('[data-kind]').forEach((lab) => {
    lab.querySelector('input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      chosen[lab.dataset.kind] = f;
      lab.style.borderStyle = 'solid';
      lab.style.borderColor = 'var(--accent)';
      lab.querySelector('span').textContent = 'Vald ✓';
    });
  });
  s.el.querySelector('[data-done]').addEventListener('click', async (e) => {
    if (!Object.keys(chosen).length) { s.close(); ctx.go('/bilder'); return; }
    await busy(e.currentTarget, async () => {
      try {
        for (const [kind, f] of Object.entries(chosen)) await addPhoto(uid, kind, await resizeImage(f), entry.weight);
        toast('Bilderna är sparade. Bara du ser dem.');
        s.close();
        ctx.go('/bilder');
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

export async function openPostSheet(ctx, entry, prev, start, fresh = true) {
  const { state } = ctx;
  const me = state.user.uid;
  const [people, groups] = await Promise.all([loadPeople(me).catch(() => []), loadGroups(me)]);
  if (entry && entry.weight == null && entry.waist == null) entry = null;
  const d = entry && prev && entry.weight != null && prev.weight != null ? entry.weight - prev.weight : null;
  const dw = entry && prev && entry.waist != null && prev.waist != null ? entry.waist - prev.waist : null;
  const pct = entry && start && entry.weight != null ? ((entry.weight - start) / start) * 100 : null;
  const pLast = d != null && prev.weight ? (d / prev.weight) * 100 : null;
  const on = fresh ? 'checked' : '';
  const s = openSheet(`
    <h2>${fresh ? 'Dela ditt framsteg' : 'Nytt inlägg'}</h2>
    <div class="field"><label for="aud">Vem får se inlägget?</label>
      <select class="input" id="aud">
        <option value="shares">De jag delar inlägg med</option>
        ${groups.map((g) => `<option value="group:${g.id}">Gruppen ${esc(g.name)}</option>`).join('')}
        <option value="people">Vissa personer</option>
        <option value="public">Alla i appen (publik)</option>
      </select></div>
    <div class="stack hidden" style="gap:0" data-people>
      ${people.length ? people.map((p) => `<label class="check"><input type="checkbox" value="${p.uid}" data-name="${esc(p.name)}"> ${esc(p.name)}</label>`).join('')
        : '<p class="small muted">Du behöver dela med någon först, så att de syns här.</p>'}
    </div>
    <p class="banner pink hidden" style="font-size:14px;padding:10px 12px" data-pubnote>Alla som har ett konto i appen kan se det här inlägget.</p>
    <div class="field"><label for="pt">Din text</label><textarea class="input" id="pt" maxlength="500" placeholder="Hur har veckan varit?"></textarea></div>
    ${entry ? `<p class="small muted" style="margin-bottom:-8px">Från din senaste mätning, ${esc(dLong(entry.at))}:</p>
      ${pLast != null ? `<label class="check"><input type="checkbox" name="pl" ${on}> Procent sedan förra vägningen (${signed(pLast, '%')})</label>` : ''}
      ${pct != null ? `<label class="check"><input type="checkbox" name="ptot" ${on}> Procent totalt sedan start (${signed(pct, '%')})</label>` : ''}
      <p class="small muted" style="margin:4px 0 -8px">Kilo är avbockat från början. Bocka i om du vill visa det.</p>
      ${d != null ? `<label class="check"><input type="checkbox" name="d"> Förändring i kilo (${signed(d, 'kg')})</label>` : ''}
      ${entry.weight != null ? `<label class="check"><input type="checkbox" name="w"> Vad jag väger (${fmt1(entry.weight)} kg)</label>` : ''}
      ${dw != null ? `<label class="check"><input type="checkbox" name="m" ${on}> Visa midjan (${signed(dw, 'cm')})</label>` : ''}` : ''}
    <p class="error hidden" role="alert">Skriv något eller välj vad som ska visas.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-post>Dela</button></div>`, 'Inlägg');
  const audSel = s.el.querySelector('#aud');
  audSel.addEventListener('change', () => {
    s.el.querySelector('[data-people]').classList.toggle('hidden', audSel.value !== 'people');
    s.el.querySelector('[data-pubnote]').classList.toggle('hidden', audSel.value !== 'public');
  });
  s.el.querySelector('[data-post]').addEventListener('click', async (e) => {
    const q = (n) => !!s.el.querySelector(`[name=${n}]`)?.checked;
    const err = s.el.querySelector('.error');
    const v = audSel.value;
    let audience = { type: 'shares', viewers: [], label: '' };
    if (v === 'public') audience = { type: 'public', viewers: [], label: 'Alla i appen' };
    if (v.startsWith('group:')) {
      const g = groups.find((x) => x.id === v.slice(6));
      audience = { type: 'group', viewers: g.members.map((m) => m.uid), label: g.name };
    }
    if (v === 'people') {
      const picked = [...s.el.querySelectorAll('[data-people] input:checked')];
      if (!picked.length) { err.textContent = 'Välj minst en person.'; err.classList.remove('hidden'); return; }
      audience = { type: 'people', viewers: picked.map((c) => c.value), label: picked.map((c) => c.dataset.name).join(', ') };
    }
    const data = {
      text: s.el.querySelector('#pt').value.trim().slice(0, 500),
      weight: q('w') && entry ? entry.weight : null,
      dWeight: q('d') && d != null ? round1(d) : null,
      pct: q('ptot') && pct != null ? round1(pct) : null,
      pLast: q('pl') && pLast != null ? round1(pLast) : null,
      dWaist: q('m') && dw != null ? round1(dw) : null
    };
    if (!data.text && data.weight == null && data.dWeight == null && data.dWaist == null && data.pct == null && data.pLast == null) {
      err.textContent = 'Skriv något eller välj vad som ska visas.';
      err.classList.remove('hidden');
      return;
    }
    await busy(e.currentTarget, async () => {
      try {
        await createPost(me, state.profile.firstName, data, audience);
        s.close();
        toast('Ditt inlägg är delat.');
        ctx.go('/flode');
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}
