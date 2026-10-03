// Startpunkten: håller koll på inloggning, sidor och menyn.
import { isConfigured, auth, onAuthStateChanged } from './firebase.js';
import { getProfile, watchUnread, prefetch, ensurePercent } from './data.js';
import { icon, esc, $$ } from './ui.js';
import './install.js';
import { loginView, registerView, forgotView, onboardingView } from './views/auth.js';
import { overviewView } from './views/overview.js';
import { measureView, resultView } from './views/measure.js';
import { historyView } from './views/history.js';
import { photosView } from './views/photos.js';
import { treatmentView } from './views/treatment.js';
import { sharingView, sharePermsView, personView, feedView } from './views/sharing.js';
import { profileView } from './views/profile.js';
import { notificationsView } from './views/notifications.js';
import { kostView, addFoodView, scanView } from './views/kost.js';
import { openSheet } from './ui.js';

const root = document.getElementById('app');
const nav = document.getElementById('nav');

export const state = { user: null, profile: null, unread: 0, lastResult: null, unsub: null };

const PUBLIC = ['/login', '/registrera', '/glomt'];

const routes = [
  [/^\/login$/, loginView, null],
  [/^\/registrera$/, registerView, null],
  [/^\/glomt$/, forgotView, null],
  [/^\/start$/, onboardingView, null],
  [/^\/$/, overviewView, 'home'],
  [/^\/matning$/, measureView, null],
  [/^\/matning\/klar$/, resultView, null],
  [/^\/historik$/, historyView, 'home'],
  [/^\/kost$/, kostView, 'kost'],
  [/^\/kost\/lagg$/, addFoodView, null],
  [/^\/kost\/skanna$/, scanView, null],
  [/^\/bilder$/, photosView, 'me'],
  [/^\/behandling$/, treatmentView, 'me'],
  [/^\/flode$/, feedView, 'share'],
  [/^\/delning$/, sharingView, 'share'],
  [/^\/delning\/([^/]+)$/, sharePermsView, 'share'],
  [/^\/person\/([^/]+)$/, personView, 'share'],
  [/^\/profil$/, profileView, 'me'],
  [/^\/notiser$/, notificationsView, 'home']
];

export const ctx = {
  state,
  go: (path) => { if (location.hash === '#' + path) route(); else location.hash = '#' + path; },
  reloadProfile: async () => { state.profile = await getProfile(state.user.uid); return state.profile; },
  rerender: () => route(),
  updateBadges: () => updateBadges(),
  onLeave: (fn) => { leaveFns.push(fn); }
};
const leaveFns = [];
function runLeave() { while (leaveFns.length) { try { leaveFns.pop()(); } catch { /* ok */ } } }

function openAddMenu() {
  const s = openSheet(`
    <h2>Lägg till</h2>
    <div class="card flush" style="box-shadow:none;border:1px solid var(--line)">
      <a class="list-row" href="#/matning" data-close><span style="width:44px;height:44px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon('chart', 24)}</span>
        <span class="grow stack" style="gap:2px"><span class="title">Ny mätning</span><span class="sub">Vikt och mått</span></span></a>
      <a class="list-row" href="#/kost/lagg" data-close><span style="width:44px;height:44px;border-radius:14px;background:var(--pink-soft);color:var(--pink);display:flex;align-items:center;justify-content:center">${icon('food', 24)}</span>
        <span class="grow stack" style="gap:2px"><span class="title">Lägg till mat</span><span class="sub">Skanna eller sök</span></span></a>
      <a class="list-row" href="#/kost/skanna" data-close><span style="width:44px;height:44px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon('scan', 24)}</span>
        <span class="grow stack" style="gap:2px"><span class="title">Skanna streckkod</span><span class="sub">Direkt till kameran</span></span></a>
    </div>
    <button class="btn block" data-close>Stäng</button>`, 'Lägg till');
  s.el.querySelectorAll('a[data-close]').forEach((a) => a.addEventListener('click', () => { state.kostDay = null; }));
}

function renderNav(active) {
  if (!active) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  const item = (key, href, ic, label) =>
    `<a href="${href}" ${key === active ? 'aria-current="page"' : ''}><span class="ic">${icon(ic, 24)}</span><span>${label}</span></a>`;
  nav.innerHTML = `<div class="nav-inner">
    ${item('home', '#/', 'home', 'Översikt')}
    ${item('kost', '#/kost', 'food', 'Kost')}
    <a href="#" class="mat" data-add><span class="plus">${icon('plus', 22, 2.2)}</span><span>Lägg till</span></a>
    ${item('share', '#/flode', 'comment', 'Flöde')}
    ${item('me', '#/profil', 'user', 'Profil')}
  </div>`;
  nav.querySelector('[data-add]').addEventListener('click', (e) => { e.preventDefault(); openAddMenu(); });
}

export function updateBadges() {
  $$('.js-unread').forEach((el) => {
    el.textContent = state.unread > 9 ? '9+' : String(state.unread);
    el.classList.toggle('hidden', !state.unread);
  });
}

let routing = 0;
async function route() {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  if (!state.user && !PUBLIC.includes(path)) { location.hash = '#/login'; return; }
  if (state.user && PUBLIC.includes(path)) { location.hash = '#/'; return; }
  if (state.user && (!state.profile || !state.profile.onboarded) && path !== '/start') { location.hash = '#/start'; return; }

  const found = routes.find(([re]) => re.test(path));
  if (!found) { location.hash = '#/'; return; }
  const [re, view, active] = found;
  const params = path.match(re).slice(1).map(decodeURIComponent);
  runLeave();
  const my = ++routing;
  renderNav(state.user ? active : null);
  const slow = setTimeout(() => { if (my === routing) root.innerHTML = '<div class="boot">Laddar…</div>'; }, 350);
  try {
    const html = document.createElement('div');
    await view(html, ctx, ...params);
    clearTimeout(slow);
    if (my !== routing) return;
    root.replaceChildren(html);
    window.scrollTo(0, 0);
    updateBadges();
  } catch (e) {
    clearTimeout(slow);
    console.error(e);
    if (my !== routing) return;
    root.innerHTML = `<div class="screen"><h1>Hoppsan</h1><p class="muted">Sidan kunde inte laddas. Kontrollera internet och försök igen.</p><a class="btn primary" href="#/">Till översikten</a></div>`;
  }
}

function setupMissing() {
  root.innerHTML = `<div class="screen no-nav">
    <h1>Nästan klart!</h1>
    <div class="banner soft">Appen är inte kopplad till Firebase än.</div>
    <p>Öppna filen <b>js/config.js</b> och klistra in dina Firebase-uppgifter. Se guiden i <b>README.md</b>.</p>
  </div>`;
}

async function startSession(user) {
  try { state.profile = await getProfile(user.uid); } catch { state.profile = null; }
  if (state.unsub) state.unsub();
  state.unsub = watchUnread(user.uid, (n) => { state.unread = n; updateBadges(); });
  prefetch(user.uid);
  if (state.profile?.onboarded) ensurePercent(user.uid, state.profile).catch(() => {});
}
ctx.startSession = startSession;

if (!isConfigured) {
  setupMissing();
} else {
  window.addEventListener('hashchange', route);
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (state.unsub) { state.unsub(); state.unsub = null; }
    if (state.registering) return;
    if (user) {
      await startSession(user);
    } else {
      state.profile = null;
      state.unread = 0;
    }
    route();
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

export { esc };
