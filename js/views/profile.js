// Profil, mål och inställningar.
import { auth, signOut } from '../firebase.js';
import {
  saveProfile, refreshSummaries, loadGoals, addGoal, setGoalDone, deleteGoal, loadEntries, isAdmin, userCount
} from '../data.js';
import { openWipeSheet, downloadMyData } from './legal.js';
import { openInviteFriend } from '../invite.js';
import {
  esc, fmt1, icon, avatar, openSheet, confirmSheet, toast, busy, errorText, parseNum, dShort, dFull, resizeImage, round1
} from '../ui.js';
import { progressInfo } from './overview.js';
import { isInstalled, showInstall } from '../install.js';
import { openGoalsSheet } from './kost.js';

export async function profileView(el, ctx) {
  const { state } = ctx;
  const uid = state.user.uid;
  let [goals, entries, admin] = await Promise.all([loadGoals(uid), loadEntries(uid), isAdmin(uid)]);
  const users = admin ? await userCount().catch(() => null) : null;

  const draw = () => {
    const p = state.profile;
    const wl = entries.filter((e) => e.weight != null);
    const current = wl[wl.length - 1]?.weight;
    const start = p.startWeight ?? wl[0]?.weight;
    const pr = progressInfo(start, p.goalWeight, current ?? start);
    const row = (label, value, action) => `<div class="list-row" style="min-height:52px"><span class="grow" style="font-size:16px">${label}</span><span style="font-weight:700" class="num">${value}</span>${action || ''}</div>`;
    const editBtn = (k) => `<button class="btn sm" style="height:34px;background:var(--accent-soft);color:var(--accent-dark)" data-edit="${k}">Ändra</button>`;

    el.innerHTML = `<div class="screen">
      <div class="row" style="gap:16px">
        <label style="cursor:pointer;position:relative" aria-label="Byt profilbild">${avatar(p.firstName, p.avatar, 72)}
          <span style="position:absolute;right:-2px;bottom:-2px;width:28px;height:28px;border-radius:14px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;color:var(--accent)">${icon('camera', 16)}</span>
          <input type="file" accept="image/*" class="hidden" data-avatar></label>
        <div class="grow stack" style="gap:2px"><h1 style="font-size:26px">${esc(p.firstName)}</h1><span class="small muted">@${esc(p.username)}${p.startDate ? ' · start ' + esc(dFull(p.startDate + 'T12:00:00')) : ''}</span></div>
        <button class="btn outline sm" data-edit="info">Ändra</button>
      </div>

      <section class="stack"><h2>Mitt viktmål</h2>
        <div class="card" style="padding:4px 16px 16px">
          ${row('Startvikt', start != null ? fmt1(start) + ' kg' : '–', editBtn('start'))}
          ${row('Målvikt', p.goalWeight != null ? fmt1(p.goalWeight) + ' kg' : '–', editBtn('goal'))}
          ${row('Startdatum', p.startDate ? esc(dShort(p.startDate + 'T12:00:00')) : '–')}
          ${pr ? `<div class="grid4" style="margin-top:12px">${pr.miles.map((m) => `<div class="milestone ${m.done ? 'done' : ''}"><b>${Math.round(m.m * 100)} %</b><span>${m.done ? 'klart' : fmt1(m.weight) + ' kg'}</span></div>`).join('')}</div>` : ''}
        </div>
      </section>

      <section class="stack"><h2>Personliga mål</h2>
        <div class="card flush">
          ${goals.map((g) => `<div class="list-row" style="padding-left:6px">
            <button type="button" data-goal="${g.id}" aria-pressed="${!!g.done}" aria-label="Markera ${esc(g.text)} som klart" style="width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer">
              <span style="width:26px;height:26px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;background:${g.done ? 'var(--accent)' : '#fff'};border:2px solid ${g.done ? 'var(--accent)' : '#C9C3B8'}">${icon('check', 14, 3.2)}</span></button>
            <div class="grow stack" style="gap:2px"><span style="font-size:16px;font-weight:600">${esc(g.text)}</span><span class="sub">${g.done && g.doneAt ? 'Klart ' + esc(dShort(g.doneAt)) : 'Pågår'}</span></div>
            <button class="icon-btn" style="box-shadow:none;background:transparent" data-delgoal="${g.id}" aria-label="Ta bort målet">${icon('trash', 18)}</button>
          </div>`).join('')}
          <button class="list-row" data-addgoal style="color:var(--accent);font-weight:700">${icon('plus', 20, 2.2)} Lägg till mål</button>
        </div>
      </section>

      <section class="stack"><h2>Mina uppgifter</h2>
        <div class="card" style="padding:4px 16px">
          ${row('Förnamn', esc(p.firstName))}
          ${row('Födelseår', p.birthYear || '–')}
          ${row('Kön', esc(p.gender || '–'))}
          ${row('Längd', p.heightCm ? p.heightCm + ' cm' : '–')}
          ${row('E-post', `<span style="font-weight:500" class="small">${esc(p.email || state.user.email)}</span>`)}
        </div>
      </section>

      ${admin ? `<section class="card row" style="gap:14px;border:1.5px dashed var(--accent)">
        <span style="width:48px;height:48px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('users', 26)}</span>
        <span class="grow stack" style="gap:0"><span class="small muted">Användare i appen</span><b class="num" style="font-size:30px;line-height:1.1">${users == null ? '–' : users}</b><span class="small muted">Bara du ser detta</span></span>
      </section>` : ''}
      <button class="card row" data-invitefriend style="border:0;cursor:pointer;text-align:left;background:linear-gradient(135deg,#F6EEFA,#FCEFF4);gap:12px">
        <span style="font-size:30px">💜</span>
        <span class="grow stack" style="gap:2px"><b style="font-size:17px">Bjud in en vän</b><span class="small muted">Gå ner i vikt tillsammans</span></span>${icon('right', 18, 2)}</button>

      <section class="stack"><h2>Mer</h2>
        <div class="card flush">
          ${isInstalled() ? '' : `<button class="list-row" data-home><img src="icons/icon-192.png" alt="" width="22" height="22" style="border-radius:6px"><span class="grow title" style="font-weight:600">Lägg till på hemskärmen</span>${icon('right', 18, 2)}</button>`}
          <a class="list-row" href="#/historik"><span style="color:#7B5EA7">${icon('chart')}</span><span class="grow title" style="font-weight:600">Historik och grafer</span>${icon('right', 18, 2)}</a>
          <button class="list-row" data-kostgoals><span style="color:#7B5EA7">${icon('food')}</span><span class="grow stack" style="gap:2px"><span class="title" style="font-weight:600">Kostmål</span><span class="sub">${p.kcalGoal ? p.kcalGoal + ' kcal per dag' : 'Inget mål satt'}</span></span>${icon('right', 18, 2)}</button>
          <a class="list-row" href="#/bilder"><span style="color:var(--accent)">${icon('camera')}</span><span class="grow title" style="font-weight:600">Bilder</span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/behandling"><span style="color:var(--accent)">${icon('pill')}</span><span class="grow title" style="font-weight:600">Behandling</span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/blodvarden"><span style="color:var(--pink)">${icon('heart')}</span><span class="grow title" style="font-weight:600">Blodvärden</span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/rapport"><span style="color:var(--accent)">${icon('info')}</span><span class="grow stack" style="gap:2px"><span class="title" style="font-weight:600">Rapport till vården</span><span class="sub">PDF eller länk till läkaren</span></span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/tips"><span style="color:var(--accent)">${icon('sparkle')}</span><span class="grow title" style="font-weight:600">Tips och prylar</span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/notiser"><span style="color:var(--accent)">${icon('bell')}</span><span class="grow title" style="font-weight:600">Notiser</span><span class="chip warn js-unread hidden"></span>${icon('right', 18, 2)}</a>
        </div>
      </section>

      <section class="stack"><h2>Integritet</h2>
        <div class="card flush">
          <a class="list-row" href="#/integritet"><span style="color:var(--accent)">${icon('lock')}</span><span class="grow title" style="font-weight:600">Integritet och GDPR</span>${icon('right', 18, 2)}</a>
          <a class="list-row" href="#/villkor"><span style="color:var(--accent)">${icon('flag')}</span><span class="grow title" style="font-weight:600">Användarvillkor</span>${icon('right', 18, 2)}</a>
          <button class="list-row" data-export><span style="color:var(--accent)">${icon('copy')}</span><span class="grow stack" style="gap:2px"><span class="title" style="font-weight:600">Ladda ner mina uppgifter</span><span class="sub">Allt om dig i en fil</span></span>${icon('right', 18, 2)}</button>
        </div>
      </section>

      <button class="btn outline block" data-logout>Logga ut</button>
      <button class="btn danger block" data-wipe>Radera mina uppgifter</button>
    </div>`;
    wire();
    ctx.updateBadges && ctx.updateBadges();
  };

  const wire = () => {
    const p = state.profile;
    el.querySelector('[data-avatar]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = await resizeImage(f, 256, 0.8);
        await saveProfile(uid, { avatar: data });
        state.profile.avatar = data;
        draw();
      } catch (ex) { toast(errorText(ex)); }
    });

    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.edit;
      if (k === 'info') return editInfo();
      const isGoal = k === 'goal';
      const cur = isGoal ? p.goalWeight : (p.startWeight ?? entries.find((e) => e.weight != null)?.weight);
      const s = openSheet(`
        <h2>${isGoal ? 'Ändra målvikt' : 'Ändra startvikt'}</h2>
        <div class="field"><label for="v">${isGoal ? 'Målvikt' : 'Startvikt'} (kg)</label><input class="input" id="v" inputmode="decimal" value="${cur != null ? fmt1(cur) : ''}"></div>
        <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Ändra');
      s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
        const v = parseNum(s.el.querySelector('#v').value);
        if (!v || v < 25 || v > 350) { toast('Skriv en vikt i kg.'); return; }
        await busy(e.currentTarget, async () => {
          try {
            await saveProfile(uid, isGoal ? { goalWeight: round1(v) } : { startWeight: round1(v) });
            await ctx.reloadProfile();
            await refreshSummaries(uid, state.profile);
            s.close();
            toast('Sparat.');
            draw();
          } catch (ex) { toast(errorText(ex)); }
        });
      });
    }));

    el.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', async () => {
      const g = goals.find((x) => x.id === b.dataset.goal);
      try {
        await setGoalDone(uid, g.id, !g.done);
        if (!g.done) toast('Snyggt! Målet är klart.');
        goals = await loadGoals(uid);
        draw();
      } catch (ex) { toast(errorText(ex)); }
    }));
    el.querySelectorAll('[data-delgoal]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Ta bort målet?', ok: 'Ta bort', danger: true }))) return;
      try { await deleteGoal(uid, b.dataset.delgoal); goals = goals.filter((g) => g.id !== b.dataset.delgoal); draw(); } catch (ex) { toast(errorText(ex)); }
    }));
    el.querySelector('[data-addgoal]').addEventListener('click', () => {
      const s = openSheet(`
        <h2>Nytt personligt mål</h2>
        <div class="field"><label for="gt">Mitt mål</label><input class="input" id="gt" maxlength="80" placeholder="t.ex. Orka promenera 5 km"></div>
        <p class="small muted">Personliga mål har inget slutdatum.</p>
        <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Lägg till</button></div>`, 'Nytt mål');
      s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
        const t = s.el.querySelector('#gt').value.trim();
        if (!t) return;
        await busy(e.currentTarget, async () => {
          try { await addGoal(uid, t); goals = await loadGoals(uid); s.close(); draw(); } catch (ex) { toast(errorText(ex)); }
        });
      });
    });

    el.querySelector('[data-home]')?.addEventListener('click', showInstall);
    el.querySelector('[data-kostgoals]').addEventListener('click', () => openGoalsSheet(ctx, () => draw()));
    el.querySelector('[data-logout]').addEventListener('click', async () => {
      await signOut(auth);
      location.hash = '#/login';
    });

    el.querySelector('[data-wipe]').addEventListener('click', openWipeSheet);
    el.querySelector('[data-invitefriend]').addEventListener('click', () => openInviteFriend(ctx));
    el.querySelector('[data-export]').addEventListener('click', (e) => downloadMyData(ctx, e.currentTarget));
  };

  const editInfo = () => {
    const p = state.profile;
    const s = openSheet(`
      <h2>Mina uppgifter</h2>
      <div class="field"><label for="fn">Förnamn</label><input class="input" id="fn" value="${esc(p.firstName)}"></div>
      <div class="field"><label for="by">Födelseår</label><input class="input" id="by" inputmode="numeric" value="${p.birthYear || ''}"></div>
      <div class="field"><label for="ge">Kön</label><select class="input" id="ge">
        ${['', 'Kvinna', 'Man', 'Annat', 'Vill inte säga'].map((g) => `<option value="${g}" ${g === (p.gender || '') ? 'selected' : ''}>${g || 'Välj'}</option>`).join('')}</select></div>
      <div class="field"><label for="hc">Längd (cm)</label><input class="input" id="hc" inputmode="numeric" value="${p.heightCm || ''}"></div>
      <div class="field"><label for="sd">Startdatum</label><input class="input" id="sd" type="date" value="${esc(p.startDate || '')}"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Mina uppgifter');
    s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const firstName = s.el.querySelector('#fn').value.trim();
      const heightCm = parseNum(s.el.querySelector('#hc').value);
      const birthYear = parseNum(s.el.querySelector('#by').value);
      if (!firstName) return toast('Skriv ditt förnamn.');
      if (heightCm && (heightCm < 100 || heightCm > 250)) return toast('Längden ser fel ut.');
      await busy(e.currentTarget, async () => {
        try {
          await saveProfile(uid, {
            firstName, heightCm: heightCm || null, birthYear: birthYear || null,
            gender: s.el.querySelector('#ge').value || null, startDate: s.el.querySelector('#sd').value || p.startDate || null
          });
          await ctx.reloadProfile();
          s.close();
          toast('Sparat.');
          draw();
        } catch (ex) { toast(errorText(ex)); }
      });
    });
  };

  draw();
}
