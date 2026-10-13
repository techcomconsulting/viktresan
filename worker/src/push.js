// Påminnelser i telefonen (Web Push). Skickas från Cloudflare, utan Firebase.
// Vi sparar bara tider och hur ofta, aldrig namnet på medicinen.
// Nycklarna (VAPID) skapas av servern själv första gången och sparas i databasen.

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };

export const SLOT_NAME = { morning: 'morgonmedicin', noon: 'lunchmedicin', evening: 'kvällsmedicin', night: 'nattmedicin' };

// ---------- Nycklar ----------
let vapidCache = null;
export async function vapid(env) {
  if (vapidCache) return vapidCache;
  const row = await env.DB.prepare('SELECT v FROM conf WHERE k = ?').bind('vapid').first();
  let jwk;
  if (row) jwk = JSON.parse(row.v);
  else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    await env.DB.prepare('INSERT OR IGNORE INTO conf (k, v) VALUES (?, ?)').bind('vapid', JSON.stringify(jwk)).run();
    const again = await env.DB.prepare('SELECT v FROM conf WHERE k = ?').bind('vapid').first();
    jwk = JSON.parse(again.v); // om två körde samtidigt används samma nyckel
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pub = b64u(concat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y)));
  vapidCache = { key, pub };
  return vapidCache;
}

async function vapidHeader(env, endpoint) {
  const { key, pub } = await vapid(env);
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:techcomconsultingab@gmail.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${pub}`;
}

// ---------- Kryptering (RFC 8291, aes128gcm) ----------
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

export async function encrypt(sub, text) {
  const uaPub = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

export async function sendPush(env, sub, payload) {
  const body = await encrypt(sub, JSON.stringify(payload));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(env, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high' },
    body
  });
  if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(sub.endpoint).run();
  return r.status;
}

// ---------- Schema ----------
const sthlm = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
};
const dayNo = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
function isDue(r, day) {
  if (r.start && day < r.start) return false;
  if (r.freq === 'everyOther') return (dayNo(day) - dayNo(r.start || day)) % 2 === 0;
  if (r.freq === 'weekly') return ((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7) === (r.weekday ?? 0);
  return r.freq === 'daily';
}

// Körs var 5:e minut av Cloudflare.
export async function runReminders(env, now = new Date()) {
  const t = sthlm(now);
  const time = `${t.hh}:${String(Math.floor(+t.mm / 5) * 5).padStart(2, '0')}`;
  const { results } = await env.DB.prepare(
    `SELECT r.uid, r.slot, r.freq, r.start, r.weekday FROM rem r
     WHERE r.time = ? AND NOT EXISTS (SELECT 1 FROM done d WHERE d.uid = r.uid AND d.day = ? AND d.slot = r.slot)`
  ).bind(time, t.day).all();
  const due = new Map();
  for (const r of results || []) if (isDue(r, t.day)) { if (!due.has(r.uid)) due.set(r.uid, new Set()); due.get(r.uid).add(r.slot); }
  let sent = 0;
  for (const [uid, slots] of due) {
    const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM subs WHERE uid = ?').bind(uid).all()).results || [];
    const slot = [...slots][0];
    for (const s of subs) {
      try { await sendPush(env, s, { title: 'Dags för din medicin 💊', body: `Det är dags för din ${SLOT_NAME[slot] || 'medicin'}. Tryck för att kryssa i.`, url: '/#/behandling', tag: `med-${t.day}-${slot}` }); sent++; } catch (e) { console.error('push', String(e)); }
    }
  }
  // Städa bort gamla kryss (äldre än 3 dagar).
  if (t.hh === '03' && t.mm < '05') await env.DB.prepare('DELETE FROM done WHERE day < ?').bind(sthlm(new Date(now.getTime() - 3 * 864e5)).day).run();
  return { time, day: t.day, sent };
}

// ---------- Anrop från appen ----------
const TIME_RE = /^([01]\d|2[0-3]):[0-5][05]$/;
const SLOTS = ['morning', 'noon', 'evening', 'night'];
const FREQS = ['daily', 'everyOther', 'weekly'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function pushApi(path, data, env, uid) {
  if (path === '/push/key') return { key: (await vapid(env)).pub };
  if (path === '/push/subscribe') {
    const s = data.sub || {};
    if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return { error: 'Fel prenumeration.' };
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM subs WHERE uid = ? AND endpoint != ?').bind(uid, s.endpoint).first()).n;
    if (n >= 5) await env.DB.prepare('DELETE FROM subs WHERE endpoint IN (SELECT endpoint FROM subs WHERE uid = ? ORDER BY updated LIMIT 1)').bind(uid).run();
    await env.DB.prepare('INSERT INTO subs (endpoint, uid, p256dh, auth, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET uid = excluded.uid, p256dh = excluded.p256dh, auth = excluded.auth, updated = excluded.updated')
      .bind(s.endpoint.slice(0, 1000), uid, String(s.keys.p256dh).slice(0, 200), String(s.keys.auth).slice(0, 100), Date.now()).run();
    return { ok: true };
  }
  if (path === '/push/unsubscribe') {
    if (data.endpoint) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ? AND uid = ?').bind(String(data.endpoint), uid).run();
    if (data.all) await env.DB.batch([env.DB.prepare('DELETE FROM subs WHERE uid = ?').bind(uid), env.DB.prepare('DELETE FROM rem WHERE uid = ?').bind(uid), env.DB.prepare('DELETE FROM done WHERE uid = ?').bind(uid)]);
    return { ok: true };
  }
  if (path === '/push/schedule') {
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 60).filter((i) => TIME_RE.test(i.time) && SLOTS.includes(i.slot) && FREQS.includes(i.freq));
    const stmts = [env.DB.prepare('DELETE FROM rem WHERE uid = ?').bind(uid)];
    for (const i of items) stmts.push(env.DB.prepare('INSERT INTO rem (uid, time, slot, freq, start, weekday) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uid, i.time, i.slot, i.freq, DAY_RE.test(i.start || '') ? i.start : null, Number.isInteger(i.weekday) ? Math.min(6, Math.max(0, i.weekday)) : 0));
    await env.DB.batch(stmts);
    return { ok: true, count: items.length };
  }
  if (path === '/push/done') {
    if (!DAY_RE.test(data.day || '') || !SLOTS.includes(data.slot)) return { error: 'Fel data.' };
    if (data.done) await env.DB.prepare('INSERT OR IGNORE INTO done (uid, day, slot) VALUES (?, ?, ?)').bind(uid, data.day, data.slot).run();
    else await env.DB.prepare('DELETE FROM done WHERE uid = ? AND day = ? AND slot = ?').bind(uid, data.day, data.slot).run();
    return { ok: true };
  }
  if (path === '/push/test') {
    const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM subs WHERE uid = ?').bind(uid).all()).results || [];
    for (const s of subs) await sendPush(env, s, { title: 'Viktresan 💜', body: 'Påminnelserna fungerar!', url: '/#/behandling', tag: 'test' });
    return { ok: true, devices: subs.length };
  }
  return null;
}
