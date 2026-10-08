// Utmaningar: lista, skapa och topplista.
import { LENGTHS, createChallenge, loadChallenges, getChallenge, joinChallenge, declineChallenge, leaveChallenge, deleteChallenge, loadScores, syncMyScores, isActive, daysLeft } from '../challenges.js';
import { loadPeople, loadEntries } from '../data.js';
import { esc, icon, backLink, openSheet, confirmSheet, toast, busy, errorText, avatar, dShort, fmt1, confetti } from '../ui.js';

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const pctTxt = (p) => (p == null ? 'Ingen vägning än' : (p > 0 ? '+' : p < 0 ? '−' : '±') + fmt1(Math.abs(p)) + ' %');
const MEDAL = ['🥇', '🥈', '🥉'];

function card(c, uid) {
  const invited = c.invited?.includes(uid) && !c.members.includes(uid);
  const left = daysLeft(c);
  return `<a class="card row" href="#/utmaning/${c.id}" style="text-decoration:none;color:inherit;gap:12px">
    <span style="font-size:30px">${invited ? '✉️' : isActive(c) ? '🏃' : '🏆'}</span>
    <span class="grow stack" style="gap:2px"><b style="font-size:16px">${esc(c.title)}</b>
      <span class="small muted">${invited ? `${esc(c.ownerName)} har bjudit in dig` : isActive(c) ? `${c.members.length} deltagare · ${left} ${left === 1 ? 'dag' : 'dagar'} kvar` : `Avslutad ${esc(dShort(c.end))}`}</span></span>
    ${invited ? '<span class="chip warn">Ny</span>' : icon('right', 18, 2)}</a>`;
}

export async function challengesView(el, ctx) {
  const { state } = ctx;
  const uid = state.user.uid;
  const entries = await loadEntries(uid).catch(() => []);
  const list = await syncMyScores(entries, state.profile.firstName);
  const active = list.filter((c) => isActive(c));
  const done = list.filter((c) => !isActive(c) && c.members.includes(uid));
  el.innerHTML = `<div class="screen">
    ${backLink('#/flode', 'Flöde')}
    <h1>Utmaningar</h1>
    <p class="muted" style="font-size:15px;line-height:1.45">Tävla med familj och vänner om vem som går ner flest <b>procent</b>. Ingen ser dina kilo.</p>
    <button class="btn primary block" data-new>${icon('plus', 20, 2.2)}Ny utmaning</button>
    ${active.length ? `<section class="stack"><h2>Pågår</h2>${active.map((c) => card(c, uid)).join('')}</section>` : `<div class="card empty">Inga utmaningar än. Starta en och bjud in någon du delar med!</div>`}
    ${done.length ? `<section class="stack"><h2>Avslutade</h2>${done.map((c) => card(c, uid)).join('')}</section>` : ''}
  </div>`;
  el.querySelector('[data-new]').addEventListener('click', () => openNewChallenge(ctx));
}

async function openNewChallenge(ctx) {
  const { state } = ctx;
  const people = await loadPeople(state.user.uid).catch(() => []);
  if (!people.length) {
    openSheet(`<h2>Ingen att utmana än</h2><p class="muted">Du kan utmana dem du delar med. Bjud in någon först.</p>
      <a class="btn primary block" href="#/delning" data-close>Hantera delning</a><button class="btn block" data-close>Stäng</button>`, 'Utmaning');
    return;
  }
  const m = MONTHS[new Date().getMonth()];
  const s = openSheet(`
    <h2>Ny utmaning</h2>
    <div class="field"><label for="ct">Namn</label><input class="input" id="ct" maxlength="40" value="${m[0].toUpperCase() + m.slice(1)}utmaningen"></div>
    <div class="stack" style="gap:6px"><span style="font-size:14px;font-weight:600">Hur länge?</span>
      <div class="pills" role="group" aria-label="Längd">${LENGTHS.map(([d, l]) => `<button type="button" data-days="${d}" aria-pressed="${d === 28}">${l}</button>`).join('')}</div></div>
    <div class="stack" style="gap:2px"><span style="font-size:14px;font-weight:600">Vem vill du utmana?</span>
      ${people.map((p) => `<label class="check"><input type="checkbox" value="${p.uid}" data-name="${esc(p.name)}"> ${esc(p.name)}</label>`).join('')}</div>
    <p class="small muted">Alla börjar från sin senaste vägning. Den som har gått ner flest procent när tiden är slut vinner.</p>
    <p class="error hidden" role="alert">Välj minst en person.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-go>Starta</button></div>`, 'Ny utmaning');
  let days = 28;
  s.el.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    s.el.querySelectorAll('[data-days]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  s.el.querySelector('[data-go]').addEventListener('click', async (e) => {
    const chosen = [...s.el.querySelectorAll('input[type=checkbox]:checked')].map((i) => ({ uid: i.value, name: i.dataset.name }));
    if (!chosen.length) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const title = s.el.querySelector('#ct').value.trim() || 'Utmaning';
    await busy(e.currentTarget, async () => {
      try {
        const id = await createChallenge({ title, days, people: chosen, myName: state.profile.firstName });
        s.close(); toast('Utmaningen har startat!'); ctx.go('/utmaning/' + id);
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

export async function challengeView(el, ctx, id) {
  const { state } = ctx;
  const uid = state.user.uid;
  let c = await getChallenge(id).catch(() => null);
  if (!c) { el.innerHTML = `<div class="screen">${backLink('#/utmaningar', 'Utmaningar')}<div class="card empty">Utmaningen finns inte längre.</div></div>`; return; }
  const member = c.members.includes(uid);
  const invited = !member && c.invited?.includes(uid);
  if (member) { await syncMyScores(await loadEntries(uid).catch(() => []), state.profile.firstName); }
  const scores = member ? await loadScores(c).catch(() => ({})) : {};
  const rows = c.members.map((u) => ({ uid: u, name: c.names?.[u] || scores[u]?.name || '?', pct: scores[u]?.pct ?? null }))
    .sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
  const active = isActive(c);
  const left = daysLeft(c);
  const total = Math.max(1, Math.round((c.end - c.start) / 86400000));
  const passed = Math.min(1, Math.max(0, (new Date() - c.start) / (c.end - c.start)));
  const winner = !active && rows[0]?.pct != null ? rows[0] : null;

  el.innerHTML = `<div class="screen">
    ${backLink('#/utmaningar', 'Utmaningar')}
    <div class="stack" style="gap:4px"><h1>${esc(c.title)}</h1>
      <span class="muted">${esc(dShort(c.start))} – ${esc(dShort(c.end))} · ${c.members.length} deltagare</span></div>
    ${invited ? `<section class="card stack-lg" style="background:linear-gradient(135deg,#F6EEFA,#FCEFF4)">
      <b style="font-size:17px">${esc(c.ownerName)} utmanar dig! 💪</b>
      <p class="muted" style="font-size:15px">Den som går ner flest <b>procent</b> på ${total} dagar vinner. De andra ser bara procent, aldrig dina kilo.</p>
      <div class="btn-row"><button class="btn" data-decline>Nej tack</button><button class="btn primary" data-join>Jag är med!</button></div></section>` : ''}
    ${member ? `
      ${active ? `<section class="card stack" style="gap:8px"><div class="between"><b>${left} ${left === 1 ? 'dag' : 'dagar'} kvar</b><span class="small muted">${Math.round(passed * 100)} % av tiden</span></div>
        <div class="progress"><span style="width:${passed * 100}%"></span></div></section>` : ''}
      ${winner ? `<section class="card stack" style="align-items:center;text-align:center;gap:6px;background:linear-gradient(135deg,#F6EEFA,#FCEFF4)">
        <span style="font-size:56px;line-height:1">🏆</span><b style="font-size:20px">${winner.uid === uid ? 'Du vann!' : esc(winner.name) + ' vann!'}</b>
        <span class="muted">${pctTxt(winner.pct)}</span></section>` : ''}
      <section class="stack"><h2>Topplista</h2><div class="card flush">
        ${rows.map((r, i) => `<div class="list-row" style="min-height:60px;${r.uid === uid ? 'background:var(--accent-soft)' : ''}">
          <span style="width:30px;text-align:center;font-size:${i < 3 && r.pct != null ? 24 : 16}px;font-weight:700">${i < 3 && r.pct != null ? MEDAL[i] : i + 1}</span>
          ${avatar(r.name, null, 36)}
          <span class="grow" style="font-weight:600">${esc(r.name)}${r.uid === uid ? ' (du)' : ''}</span>
          <b class="num" style="color:${r.pct != null && r.pct < 0 ? 'var(--accent)' : 'var(--muted)'};${r.pct == null ? 'font-weight:500;font-size:13px' : ''}">${pctTxt(r.pct)}</b></div>`).join('')}
      </div></section>
      ${c.invited?.length ? `<p class="small muted">Väntar på svar från ${c.invited.map((u) => esc(c.names?.[u] || '?')).join(', ')}.</p>` : ''}
      ${active ? '<a class="btn outline block" href="#/matning">Väg dig nu</a>' : ''}
      <p class="small muted">Procent räknas från din senaste vägning före start. Väg dig gärna samma tid på dagen.</p>
      ${c.owner === uid ? '<button class="btn ghost block" data-del style="color:var(--danger)">Ta bort utmaningen</button>' : '<button class="btn ghost block" data-leave style="color:var(--danger)">Lämna utmaningen</button>'}` : ''}
    ${!member && !invited ? '<div class="card empty">Du är inte med i den här utmaningen.</div>' : ''}
  </div>`;

  if (winner && winner.uid === uid) {
    const key = 'vt-won-' + c.id;
    try { if (!localStorage.getItem(key)) { localStorage.setItem(key, '1'); setTimeout(() => confetti(), 300); } } catch { /* ok */ }
  }
  el.querySelector('[data-join]')?.addEventListener('click', async (e) => {
    await busy(e.currentTarget, async () => {
      try { await joinChallenge(c, state.profile.firstName); toast('Du är med!'); confetti(); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
    });
  });
  el.querySelector('[data-decline]')?.addEventListener('click', async () => {
    try { await declineChallenge(c); toast('Okej!'); ctx.go('/utmaningar'); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-leave]')?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: 'Lämna utmaningen?', ok: 'Lämna', danger: true }))) return;
    try { await leaveChallenge(c); ctx.go('/utmaningar'); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: 'Ta bort utmaningen?', text: 'Den försvinner för alla deltagare.', ok: 'Ta bort', danger: true }))) return;
    try { await deleteChallenge(c); ctx.go('/utmaningar'); } catch (ex) { toast(errorText(ex)); }
  });
}

// Kort till översikten om man är med i en pågående utmaning eller har en inbjudan.
export async function challengeCard(list, uid) {
  const inv = list.find((c) => isActive(c) && c.invited?.includes(uid) && !c.members.includes(uid));
  if (inv) return `<a class="card row" href="#/utmaning/${inv.id}" style="text-decoration:none;color:inherit;gap:12px;background:linear-gradient(135deg,#F6EEFA,#FCEFF4)">
    <span style="font-size:28px">✉️</span><span class="grow stack" style="gap:2px"><b>${esc(inv.ownerName)} utmanar dig!</b><span class="small muted">${esc(inv.title)}</span></span>${icon('right', 18, 2)}</a>`;
  const act = list.find((c) => isActive(c) && c.members.includes(uid) && c.members.length > 1);
  if (!act) return '';
  const scores = await loadScores(act).catch(() => ({}));
  const ranked = act.members.map((u) => ({ u, p: scores[u]?.pct ?? null })).sort((a, b) => (a.p ?? 999) - (b.p ?? 999));
  const pos = ranked.findIndex((r) => r.u === uid) + 1;
  return `<a class="card row" href="#/utmaning/${act.id}" style="text-decoration:none;color:inherit;gap:12px">
    <span style="font-size:28px">${pos >= 1 && pos <= 3 && scores[uid]?.pct != null ? MEDAL[pos - 1] : '🏃'}</span>
    <span class="grow stack" style="gap:2px"><span class="small muted" style="font-weight:600">${esc(act.title)} · ${daysLeft(act)} dagar kvar</span>
      <b>${scores[uid]?.pct != null ? `Du ligger ${pos === 1 ? 'först' : 'på plats ' + pos}` : 'Väg dig för att vara med'}</b></span>${icon('right', 18, 2)}</a>`;
}
