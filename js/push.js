// Påminnelser i telefonen: slå på/av, skicka schemat till servern, markera som tagen.
// Servern får bara tider och hur ofta, aldrig namnet på medicinen.
import { auth } from './firebase.js';
import { SERVER_URL } from './config.js';
import { isoDay } from './ui.js';

export const DEFAULT_TIMES = { morning: '08:00', noon: '12:00', evening: '18:00', night: '22:00' };

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// Kan den här telefonen få påminnelser? Svar: 'ok', 'install' (iPhone måste lägga appen på hemskärmen), 'no', 'server'
export function pushSupport() {
  if (!SERVER_URL) return 'server';
  if (isIOS() && !standalone()) return 'install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no';
  return 'ok';
}
export const pushPermission = () => ('Notification' in window ? Notification.permission : 'denied');

async function api(path, body = {}) {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(SERVER_URL.replace(/\/$/, '') + path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || 'Servern svarar inte just nu.');
  return d;
}

const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

// Slå på: fråga om lov, prenumerera och skicka schemat.
export async function enablePush(rx, times) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Du behöver tillåta notiser. Ändra det i telefonens inställningar för appen.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Byt prenumeration om servern har en annan nyckel.
    const cur = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const want = b64ToBytes(key);
    if (cur && (cur.length !== want.length || cur.some((b, i) => b !== want[i]))) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api('/push/subscribe', { sub: sub.toJSON() });
  await syncSchedule(rx, times);
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* ok */ }
}

// Ta bort allt hos servern (när kontot raderas).
export async function forgetPushAll() {
  if (!SERVER_URL) return;
  try { await api('/push/unsubscribe', { all: true }); } catch { /* ok */ }
}

// Skicka schemat: en rad per tid. Inga namn på mediciner.
export async function syncSchedule(rx, times) {
  if (!SERVER_URL) return;
  const t = { ...DEFAULT_TIMES, ...(times || {}) };
  const items = [];
  const seen = new Set();
  for (const r of rx || []) {
    const s = r.schedule;
    if (!s || !s.freq || s.freq === 'asNeeded') continue;
    for (const slot of s.slots || []) {
      const it = { time: t[slot], slot, freq: s.freq, start: s.start || isoDay(new Date()), weekday: s.weekday ?? 0 };
      const k = JSON.stringify(it);
      if (!seen.has(k)) { seen.add(k); items.push(it); }
    }
  }
  await api('/push/schedule', { items });
}

export async function markSlotDone(slot, done) {
  if (!SERVER_URL) return;
  try { await api('/push/done', { day: isoDay(new Date()), slot, done }); } catch { /* inte viktigt */ }
}

export async function testPush() { return api('/push/test'); }
