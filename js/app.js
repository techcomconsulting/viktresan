// Startpunkten: håller koll på inloggning, sidor och menyn.
import { isConfigured, auth, onAuthStateChanged } from './firebase.js';
import { getProfile, watchUnread } from './data.js';
import { icon, esc, $$ } from './ui.js';
import { loginView, registerView, forgotView, onboardingView } from './views/auth.js';
import { overviewView } from './views/overview.js';
import { measureView, resultView } from './views/measure.js';
import { historyView } from './views/history.js';
import { photosView } from './views/photos.js';
import { treatmentView } from './views/treatment.js';
import { sharingView, sharePermsView, personView } from './views/sharing.js';
import { profileView } from './views/profile.js';
import { notificationsView } from './views/notifications.js';

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
  [/^\/historik$/, historyView, 'stats'],
  [/^\/bilder$/, photosView, 'me'],
  [/^\/behandling$/, treatmentView, 'me'],
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
  updateBadges: () => updateBadges()
};

function renderNav(active) {
  if (!active) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  const item = (key, href, ic, label) =>
    `<a href="${href}" ${key === active ? 'aria-current="page"' : ''}><span class="ic">${icon(ic, 24)}</span><span>${label}</span></a>`;
  nav.innerHTML = `<div class="nav-inner">
    ${item('home', '#/', 'home', 'Översikt')}
    ${item('stats', '#/historik', 'chart', 'Historik')}
    <a href="#/matning" class="mat"><span class="plus">${icon('plus', 22, 2.2)}</span><span>Mät</span></a>
    ${item('share', '#/delning', 'users', 'Delning')}
    ${item('me', '#/profil', 'user', 'Profil')}
  </div>`;
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
  const my = ++routing;
  renderNav(state.user ? active : null);
  root.innerHTML = '<div class="boot">Laddar…</div>';
  window.scrollTo(0, 0);
  try {
    const html = document.createElement('div');
    await view(html, ctx, ...params);
    if (my !== routing) return;
    root.replaceChildren(html);
    updateBadges();
  } catch (e) {
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
