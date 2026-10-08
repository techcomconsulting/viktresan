// Märken: sidan med alla märken, och firandet när man klarar ett nytt.
import { BADGES, earnedBadges } from '../milestones.js';
import { loadEntries, saveProfile, createPost } from '../data.js';
import { esc, backLink, openSheet, toast, confetti } from '../ui.js';

const badge = ([id, emoji, name, desc], on, big = false) => `<div class="stack" style="align-items:center;text-align:center;gap:4px;padding:${big ? 14 : 10}px 6px;border-radius:18px;background:${on ? 'linear-gradient(160deg,#F6EEFA,#FCEFF4)' : '#F3F1EC'};${on ? '' : 'opacity:.55'}">
  <span style="font-size:${big ? 44 : 30}px;line-height:1.1;${on ? '' : 'filter:grayscale(1)'}">${on ? emoji : '🔒'}</span>
  <b style="font-size:${big ? 16 : 13}px;line-height:1.2">${esc(name)}</b>
  <span class="small muted" style="font-size:11px;line-height:1.25">${esc(desc)}</span></div>`;

export async function badgesView(el, ctx) {
  const { state } = ctx;
  const entries = await loadEntries(state.user.uid).catch(() => []);
  const got = earnedBadges(entries, state.profile);
  el.innerHTML = `<div class="screen">
    ${backLink('#/profil', 'Profil')}
    <h1>Mina märken</h1>
    <p class="muted" style="font-size:16px">Du har klarat <b style="color:var(--accent)">${got.size} av ${BADGES.length}</b>. Varje steg räknas!</p>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
      ${[...BADGES.filter((b) => got.has(b[0])), ...BADGES.filter((b) => !got.has(b[0]))].map((b) => badge(b, got.has(b[0]))).join('')}
    </div>
  </div>`;
}

// Kort till översikten.
export function badgesCard(entries, profile) {
  const got = earnedBadges(entries, profile);
  if (!got.size) return '';
  const last = BADGES.filter((b) => got.has(b[0])).slice(-5);
  return `<a class="card row" href="#/marken" style="text-decoration:none;color:inherit;padding:14px 16px;gap:12px">
    <span class="grow stack" style="gap:4px"><span class="small muted" style="font-weight:600">Mina märken · ${got.size} av ${BADGES.length}</span>
      <span style="font-size:26px;letter-spacing:2px">${last.map((b) => b[1]).join('')}</span></span>
    <span style="color:var(--muted)">›</span></a>`;
}

// Kollar om man har klarat något nytt. Visar firande med konfetti. Returnerar true om något visades.
export async function checkNewBadges(ctx, entries) {
  const { state } = ctx;
  const p = state.profile;
  const got = earnedBadges(entries, p);
  const seen = Array.isArray(p.badgesSeen) ? p.badgesSeen : null;
  const fresh = seen ? [...got].filter((id) => !seen.includes(id)) : [];
  const all = [...got];
  if (seen && !fresh.length) return false;
  try { await saveProfile(state.user.uid, { badgesSeen: all }); p.badgesSeen = all; } catch { return false; }
  // Första gången: visa vad man redan har klarat, om det finns något utöver första mätningen.
  const show = seen ? fresh : (all.length > 1 ? all : []);
  if (!show.length) return false;
  const list = BADGES.filter((b) => show.includes(b[0]));
  const top = list[list.length - 1];
  const s = openSheet(`
    <div class="stack" style="align-items:center;text-align:center;gap:6px">
      <span style="font-size:64px;line-height:1">${top[1]}</span>
      <h2 style="font-size:26px">${seen ? 'Grattis!' : 'Du har redan klarat mycket!'}</h2>
      <p class="muted" style="font-size:16px">${seen ? (list.length === 1 ? 'Du har klarat ett nytt delmål.' : `Du har klarat ${list.length} nya delmål.`) : `Du har ${list.length} märken. Snyggt jobbat!`}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(3, list.length)},minmax(0,1fr));gap:8px">${list.slice(-6).map((b) => badge(b, true, list.length === 1)).join('')}</div>
    ${seen ? '<button class="btn outline block" data-share>Dela i flödet</button>' : ''}
    <button class="btn primary block" data-close>Tack!</button>
    <a class="btn ghost block" href="#/marken" data-close>Se alla märken</a>`, 'Grattis');
  setTimeout(() => confetti(), 150);
  s.el.querySelector('[data-share]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await createPost(state.user.uid, p.firstName, { text: `${top[1]} Jag har klarat ett nytt delmål: ${top[2]}!`, badge: top[0] });
      toast('Delat i flödet!'); s.close();
    } catch { toast('Kunde inte dela.'); e.currentTarget.disabled = false; }
  });
  return true;
}
