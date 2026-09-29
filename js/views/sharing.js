// Delning: bjud in, behörigheter, flöde och andras sidor.
import {
  PERMS, REACTIONS, HISTORY_DAYS, lookupPerson, createShare, loadShares, getShare, acceptShare, updateShare,
  removeShare, loadPosts, loadPostExtras, setReaction, addComment, deletePost, getSummary, loadEntries,
  loadPhotos, loadTreatments, getCard, notify
} from '../data.js';
import {
  esc, fmt1, signed, icon, avatar, backLink, openSheet, confirmSheet, toast, busy, errorText, dLong, dShort,
  ago, lineChart
} from '../ui.js';
import { buildTimeline, photoImg } from './photos.js';
import { treatmentList } from './treatment.js';
import { openPostSheet } from './measure.js';

const permText = (s) => PERMS.filter(([k]) => s.perms?.[k]).map(([, l]) => l.split(' ')[0]).join(' · ') || 'Inget valt än';

// ---------- Inlägg ----------

function postCard(post, name, avatarImg, meUid) {
  const facts = [];
  if (post.weight != null) facts.push(`Vikt ${fmt1(post.weight)} kg`);
  if (post.dWeight != null) facts.push(`${signed(post.dWeight, 'kg')}`);
  if (post.pct != null) facts.push(`Totalt ${signed(post.pct, '%')}`);
  if (post.dWaist != null) facts.push(`Midja ${signed(post.dWaist, 'cm')}`);
  const own = post.owner === meUid;
  return `<article class="card post" data-owner="${post.owner}" data-pid="${post.id}">
    <div class="row" style="gap:10px">
      ${avatar(name, avatarImg, 34)}
      <span class="grow" style="font-size:14px"><strong>${esc(own ? 'Du' : name)}</strong> · ${esc(dLong(post.createdAt || new Date()))}</span>
      ${own ? `<button class="icon-btn" style="box-shadow:none;background:transparent;width:36px;height:36px" data-delpost aria-label="Ta bort inlägget">${icon('trash', 18)}</button>` : ''}
    </div>
    ${facts.length ? `<div class="facts">${facts.map((f) => `<span class="fact num">${esc(f)}</span>`).join('')}</div>` : ''}
    ${post.text ? `<p style="font-size:15px;line-height:1.4">${esc(post.text)}</p>` : ''}
    <div class="reactions">
      ${REACTIONS.map(([k, e, l]) => `<button type="button" class="r" data-r="${k}" aria-pressed="false" aria-label="${l}">${e} <b data-c="${k}"></b></button>`).join('')}
      <span class="grow"></span>
      <button type="button" class="btn ghost sm" data-comments>${icon('comment', 18)}<span data-cc>Kommentera</span></button>
    </div>
  </article>`;
}

function wirePosts(container, ctx, onDeleted) {
  const me = ctx.state.user.uid;
  const myName = ctx.state.profile.firstName;
  container.querySelectorAll('article.post').forEach(async (card) => {
    const owner = card.dataset.owner, pid = card.dataset.pid;
    let extras = { counts: {}, mine: null, comments: [] };
    const paint = () => {
      REACTIONS.forEach(([k]) => {
        card.querySelector(`[data-c=${k}]`).textContent = extras.counts[k] || '';
        card.querySelector(`[data-r=${k}]`).setAttribute('aria-pressed', String(extras.mine === k));
      });
      const n = extras.comments.length;
      card.querySelector('[data-cc]').textContent = n ? `${n} ${n === 1 ? 'kommentar' : 'kommentarer'}` : 'Kommentera';
    };
    try { extras = await loadPostExtras(owner, pid, me); paint(); } catch (e) { console.warn(e); }

    card.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.dataset.r;
      const next = extras.mine === k ? null : k;
      if (extras.mine) extras.counts[extras.mine]--;
      if (next) extras.counts[next] = (extras.counts[next] || 0) + 1;
      extras.mine = next;
      paint();
      try { await setReaction(owner, pid, me, myName, next); } catch (ex) { toast(errorText(ex)); }
    }));

    card.querySelector('[data-comments]').addEventListener('click', () => {
      const s = openSheet(`
        <h2>Kommentarer</h2>
        <div data-list>${extras.comments.length ? extras.comments.map((c) => `
          <div class="comment">${avatar(c.name, null, 32)}<div class="stack" style="gap:2px"><span style="font-size:14px"><b>${esc(c.name)}</b> <span class="muted small">${esc(ago(c.createdAt))}</span></span><span style="font-size:15px">${esc(c.text)}</span></div></div>`).join('')
          : '<p class="muted">Inga kommentarer än. Skriv något peppande!</p>'}</div>
        <div class="field"><label for="ct">Din kommentar</label><textarea class="input" id="ct" maxlength="500" style="min-height:72px"></textarea></div>
        <div class="btn-row"><button class="btn" data-close>Stäng</button><button class="btn primary" data-send>Skicka</button></div>`, 'Kommentarer');
      s.el.querySelector('[data-send]').addEventListener('click', async (e) => {
        const text = s.el.querySelector('#ct').value.trim();
        if (!text) return;
        await busy(e.currentTarget, async () => {
          try {
            await addComment(owner, pid, me, myName, text);
            extras.comments.push({ name: myName, text, createdAt: new Date() });
            paint();
            s.close();
            toast('Kommentaren är skickad.');
          } catch (ex) { toast(errorText(ex)); }
        });
      });
    });

    const del = card.querySelector('[data-delpost]');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Ta bort inlägget?', text: 'Kommentarer och peppningar försvinner också.', ok: 'Ta bort', danger: true }))) return;
      try { await deletePost(owner, pid); card.remove(); if (onDeleted) onDeleted(); } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// ---------- Välj behörigheter ----------

function permsEditor(perms, range) {
  return `<div class="card flush">${PERMS.map(([k, l, sub]) => `
    <div class="list-row" style="flex-wrap:wrap">
      <div class="grow stack" style="gap:2px"><span class="title">${l}</span><span class="sub">${sub}</span></div>
      <button type="button" class="toggle" data-perm="${k}" aria-pressed="${!!perms[k]}" aria-label="${l}"></button>
      ${k === 'history' ? `<div class="seg ${perms.history ? '' : 'hidden'}" data-range style="width:100%">
        <button type="button" data-rv="3m" aria-pressed="${range !== 'all'}">Senaste 3 mån</button>
        <button type="button" data-rv="all" aria-pressed="${range === 'all'}">All historik</button></div>` : ''}
    </div>`).join('')}</div>`;
}

function wirePerms(root, perms, rangeRef, onChange) {
  root.querySelectorAll('[data-perm]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.perm;
    perms[k] = !perms[k];
    b.setAttribute('aria-pressed', String(perms[k]));
    if (k === 'history') root.querySelector('[data-range]').classList.toggle('hidden', !perms.history);
    onChange && onChange();
  }));
  root.querySelectorAll('[data-rv]').forEach((b) => b.addEventListener('click', () => {
    rangeRef.value = b.dataset.rv;
    root.querySelectorAll('[data-rv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onChange && onChange();
  }));
}

// ---------- Delningssidan ----------

export async function sharingView(el, ctx) {
  const { state } = ctx;
  const me = state.user.uid;
  const myName = state.profile.firstName;

  const draw = async () => {
    const sh = await loadShares(me);
    const incoming = sh.in.filter((s) => s.status === 'pending');
    const waiting = sh.out.filter((s) => s.status === 'pending');
    const mine = sh.out.filter((s) => s.status === 'active');
    const theirs = sh.in.filter((s) => s.status === 'active');
    const cards = {};
    const [feedLists, ownPosts] = await Promise.all([
      Promise.all(theirs.filter((s) => s.perms?.posts).map((s) => loadPosts(s.owner, 10))),
      loadPosts(me, 10),
      ...theirs.map(async (s) => { cards[s.owner] = await getCard(s.owner); })
    ]);
    const feed = feedLists.flat().sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 20);
    const nameOf = (uid) => cards[uid]?.firstName || theirs.find((s) => s.owner === uid)?.ownerName || '';

    el.innerHTML = `<div class="screen">
      <h1>Delning</h1>
      <div class="banner soft row">${icon('lock', 22)}<span style="font-size:14px">Allt är privat. Du väljer vad var och en får se.</span></div>
      <form class="stack" data-invite novalidate>
        <label for="inv" style="font-size:14px;font-weight:600">Bjud in med e-post eller användarnamn</label>
        <div class="row" style="gap:8px"><input class="input grow" id="inv" autocapitalize="none" autocomplete="off" placeholder="namn@exempel.se"><button class="btn primary" type="submit" style="height:50px">Skicka</button></div>
      </form>

      ${incoming.map((s) => `<section class="card stack-lg">
        <div class="row">${avatar(s.ownerName, null, 40)}<div class="grow stack" style="gap:2px"><b>${esc(s.ownerName)} vill dela med dig</b><span class="small muted">Ny förfrågan</span></div></div>
        <div class="btn-row"><button class="btn sm" data-decline="${s.id}">Avböj</button><button class="btn primary sm" data-accept="${s.id}">Acceptera</button></div>
      </section>`).join('')}

      ${mine.length || waiting.length ? `<section class="stack"><h2>Du delar med</h2><div class="card flush">
        ${mine.map((s) => `<a class="list-row" href="#/delning/${s.id}">${avatar(s.viewerName, null, 40)}<span class="grow stack" style="gap:2px"><span class="title">${esc(s.viewerName)}</span><span class="sub">${esc(permText(s))}</span></span>${icon('right', 18, 2)}</a>`).join('')}
        ${waiting.map((s) => `<div class="list-row">${avatar(s.viewerName, null, 40)}<span class="grow stack" style="gap:2px"><span class="title">${esc(s.viewerName)}</span><span class="sub">Väntar på svar</span></span><button class="btn sm" data-cancel="${s.id}">Avbryt</button></div>`).join('')}
      </div></section>` : ''}

      ${theirs.length ? `<section class="stack"><h2>Delar med dig</h2><div class="card flush">
        ${theirs.map((s) => `<a class="list-row" href="#/person/${s.owner}">${avatar(nameOf(s.owner), cards[s.owner]?.avatar, 40)}<span class="grow title">${esc(nameOf(s.owner))}</span>${icon('right', 18, 2)}</a>`).join('')}
      </div></section>` : ''}

      ${feed.length ? `<section class="stack"><h2>Från familjen</h2>${feed.map((p) => postCard(p, nameOf(p.owner), cards[p.owner]?.avatar, me)).join('')}</section>` : ''}

      <section class="stack"><div class="between"><h2>Mina inlägg</h2><button class="btn primary sm" data-newpost>${icon('plus', 18, 2.2)}Nytt inlägg</button></div>
        ${ownPosts.length ? ownPosts.map((p) => postCard(p, myName, state.profile.avatar, me)).join('') : '<div class="card empty">Här syns det du delar. Tryck på Nytt inlägg för att skriva något.</div>'}
      </section>

      ${!mine.length && !waiting.length && !theirs.length && !incoming.length ? '<p class="small muted">Du delar inte med någon än. Ingen kan se något av det du sparar.</p>' : ''}
    </div>`;

    wirePosts(el, ctx);

    el.querySelector('[data-newpost]').addEventListener('click', async () => {
      const entries = await loadEntries(me).catch(() => []);
      const last = entries[entries.length - 1] || null;
      const prev = entries[entries.length - 2] || null;
      const start = state.profile.startWeight ?? entries[0]?.weight;
      openPostSheet(ctx, last, prev, start, false);
    });

    el.querySelector('[data-invite]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = el.querySelector('#inv').value;
      if (!q.trim()) return;
      await busy(e.target.querySelector('[type=submit]'), async () => {
        try {
          const person = await lookupPerson(q);
          if (!person) return toast('Hittade ingen med det namnet eller den e-posten.');
          if (person.uid === me) return toast('Det där är du själv.');
          if (sh.out.some((s) => s.viewer === person.uid)) return toast(`Du delar redan med ${person.firstName}.`);
          openInviteSheet(person);
        } catch (ex) { toast(errorText(ex)); }
      });
    });

    const openInviteSheet = (person) => {
      const perms = { weight: true, measures: false, history: false, photos: false, posts: true, treatment: false };
      const range = { value: '3m' };
      const s = openSheet(`
        <div class="row">${avatar(person.firstName, person.avatar, 48)}<h2>Dela med ${esc(person.firstName)}?</h2></div>
        <p class="muted" style="font-size:14px">Välj vad ${esc(person.firstName)} får se. Du kan ändra det när som helst.</p>
        ${permsEditor(perms, range.value)}
        <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-send>Skicka förfrågan</button></div>`, 'Dela');
      wirePerms(s.el, perms, range);
      s.el.querySelector('[data-send]').addEventListener('click', async (e) => {
        await busy(e.currentTarget, async () => {
          try {
            await createShare(me, myName, person, perms, range.value);
            s.close();
            toast(`Förfrågan skickad till ${person.firstName}.`);
            el.querySelector('#inv').value = '';
            await draw();
          } catch (ex) { toast(errorText(ex)); }
        });
      });
    };

    el.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', async () => {
      const s = incoming.find((x) => x.id === b.dataset.accept);
      await busy(b, async () => {
        try { await acceptShare(s, myName); toast(`Nu kan du följa ${s.ownerName}.`); await draw(); } catch (ex) { toast(errorText(ex)); }
      });
    }));
    el.querySelectorAll('[data-decline], [data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.decline || b.dataset.cancel;
      try { await removeShare(id); await draw(); } catch (ex) { toast(errorText(ex)); }
    }));
  };
  await draw();
}

// ---------- Ändra vad en person får se ----------

export async function sharePermsView(el, ctx, id) {
  const me = ctx.state.user.uid;
  const s = await getShare(id);
  if (!s || s.owner !== me) { ctx.go('/delning'); return; }
  const perms = { ...s.perms };
  const range = { value: s.historyRange || '3m' };
  const count = () => PERMS.filter(([k]) => perms[k]).length;

  el.innerHTML = `<div class="screen">
    ${backLink('#/delning', 'Delning')}
    <div class="row" style="gap:14px">${avatar(s.viewerName, null, 56)}
      <div class="stack" style="gap:2px"><h1 style="font-size:24px">Vad får ${esc(s.viewerName)} se?</h1><span class="muted small" data-count></span></div></div>
    ${s.status === 'pending' ? `<div class="banner neutral" style="font-size:14px">${esc(s.viewerName)} har inte svarat än.</div>` : ''}
    ${permsEditor(perms, range.value)}
    <p class="muted" style="font-size:14px">${esc(s.viewerName)} kan kommentera och ge peppning på det hen ser. Ändringar sparas direkt.</p>
    <button class="btn danger-outline block" data-stop>Sluta dela med ${esc(s.viewerName)}</button>
  </div>`;
  const countEl = el.querySelector('[data-count]');
  const setCount = () => { countEl.textContent = `${s.viewerName} ser ${count()} av ${PERMS.length} saker`; };
  setCount();
  wirePerms(el, perms, range, async () => {
    setCount();
    try { await updateShare(id, { perms, historyRange: range.value }); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-stop]').addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Sluta dela med ${s.viewerName}?`, text: 'Hen ser inget mer av det du sparar.', ok: 'Sluta dela', danger: true }))) return;
    try { await removeShare(id); toast('Delningen är borttagen.'); ctx.go('/delning'); } catch (ex) { toast(errorText(ex)); }
  });
}

// ---------- Se någon som delar med dig ----------

export async function personView(el, ctx, owner) {
  const me = ctx.state.user.uid;
  const share = await getShare(owner + '_' + me);
  if (!share || share.status !== 'active') {
    el.innerHTML = `<div class="screen">${backLink('#/delning', 'Delning')}<div class="card empty">Den här personen delar inget med dig just nu.</div></div>`;
    return;
  }
  const P = share.perms || {};
  const card = await getCard(owner);
  const name = card?.firstName || share.ownerName;
  const [w, m, entries, photos, posts, treat] = await Promise.all([
    P.weight ? getSummary(owner, 'weight') : null,
    P.measures ? getSummary(owner, 'measures') : null,
    P.history && (P.weight || P.measures) ? loadEntries(owner, share.historyRange === 'all' ? null : HISTORY_DAYS) : [],
    P.photos ? loadPhotos(owner) : [],
    P.posts ? loadPosts(owner, 20) : [],
    P.treatment ? loadTreatments(owner) : []
  ]);

  const parts = [];
  if (w) {
    const total = w.current - w.start;
    const pct = w.start ? (total / w.start) * 100 : null;
    const goalPct = w.goal != null && w.start !== w.goal ? Math.max(0, Math.min(100, ((w.start - w.current) / (w.start - w.goal)) * 100)) : null;
    parts.push(`<section class="card stack-lg">
      <div class="between" style="align-items:flex-start">
        <div class="stack" style="gap:6px"><span class="muted" style="font-size:14px;font-weight:600">Aktuell vikt</span>
          <div class="row" style="gap:6px;align-items:baseline"><span class="big num" style="font-size:44px">${fmt1(w.current)}</span><span class="muted" style="font-size:18px;font-weight:600">kg</span></div></div>
        ${w.previous != null ? `<span class="chip ${w.current <= w.previous ? 'good' : 'neutral'}">${signed(w.current - w.previous, 'kg')}</span>` : ''}
      </div>
      <div class="grid2">
        <div><div class="small muted">Sedan start</div><b class="num" style="font-size:18px">${signed(total, 'kg')}</b>${pct != null ? ` <span class="small muted">(${signed(pct, '%')})</span>` : ''}</div>
        ${goalPct != null ? `<div><div class="small muted">Mot målet</div><b style="font-size:18px">${Math.round(goalPct)} %</b></div>` : ''}
      </div>
      <span class="small muted">Senast uppdaterad ${esc(dShort(w.currentAt))}</span>
    </section>`);
  }
  if (m && m.current) {
    const rows = [['waist', 'Midja'], ['arm', 'Arm'], ['thigh', 'Lår'], ['hip', 'Höft']];
    parts.push(`<section class="card stack" style="padding-bottom:6px"><h2>Kroppsmått</h2>
      ${rows.map(([k, l]) => `<div class="between" style="padding:10px 0;border-top:1px solid var(--line)"><span class="grow" style="font-weight:600">${l}</span>
        <span class="num">${fmt1(m.current[k])} cm</span>
        ${m.previous ? `<span class="num small muted" style="width:70px;text-align:right">${signed(m.current[k] - m.previous[k], 'cm')}</span>` : ''}</div>`).join('')}
    </section>`);
  }
  if (entries.length >= 2) {
    if (P.weight) parts.push(`<section class="card stack"><h2>Vikt över tid</h2>${lineChart(entries.map((e) => e.weight), { label: 'Vikt över tid' })}
      <div class="between small muted"><span>${esc(dShort(entries[0].at))}</span><span>${esc(dShort(entries[entries.length - 1].at))}</span></div></section>`);
    if (P.measures) parts.push(`<section class="card stack"><h2>Midja över tid</h2>${lineChart(entries.map((e) => e.waist), { h: 110, color: '#CF5F8C', fill: '#FCEEF4', label: 'Midja över tid' })}</section>`);
  }
  if (photos.length) {
    const kinds = [['face', 'Ansikte'], ['body', 'Helkropp']].filter(([k]) => photos.some((p) => p.kind === k));
    parts.push(...kinds.map(([k, l]) => {
      const steps = buildTimeline(photos.filter((p) => p.kind === k));
      const a = steps[0].photo;
      const b = [...steps].reverse().find((s) => s.photo && s.photo !== a)?.photo;
      return `<section class="card stack-lg" style="padding:14px"><h2>Bilder · ${l}</h2><div class="grid2">
        <div class="stack">${photoImg(a, 'Start')}<b class="small">Start · ${esc(dShort(a.at))}</b></div>
        <div class="stack">${photoImg(b, 'Nu')}<b class="small">${b ? 'Nu · ' + esc(dShort(b.at)) : 'Nu'}</b></div></div></section>`;
    }));
  }
  if (P.treatment) parts.push(`<section class="stack"><h2>Behandling</h2>${treatmentList(treat, false)}</section>`);
  if (P.posts) parts.push(`<section class="stack"><h2>Inlägg</h2>${posts.length ? posts.map((p) => postCard(p, name, card?.avatar, me)).join('') : '<div class="card empty">Inga inlägg än.</div>'}</section>`);

  el.innerHTML = `<div class="screen">
    ${backLink('#/delning', 'Delning')}
    <div class="row" style="gap:14px">${avatar(name, card?.avatar, 56)}<div class="stack" style="gap:2px"><h1 style="font-size:26px">${esc(name)}</h1>
      <span class="small muted">Du ser bara det ${esc(name)} har valt att dela.</span></div></div>
    ${parts.join('') || '<div class="card empty">Inget delat än.</div>'}
    <button class="btn danger block" data-leave>Sluta följa ${esc(name)}</button>
  </div>`;
  wirePosts(el, ctx);
  el.querySelector('[data-leave]').addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Sluta följa ${name}?`, text: 'Du ser inget mer förrän hen bjuder in dig igen.', ok: 'Sluta följa', danger: true }))) return;
    try { await removeShare(share.id); ctx.go('/delning'); } catch (ex) { toast(errorText(ex)); }
  });
}

export { notify };
