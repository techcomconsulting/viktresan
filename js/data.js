// All kontakt med databasen samlad på ett ställe.
import {
  db, auth, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
  orderBy, limit, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot,
  deleteUser, reauthenticateWithCredential, EmailAuthProvider, getDocsFromCache, getDocsFromServer
} from './firebase.js';

// Snabb läsning: visa det som redan finns sparat i mobilen direkt,
// och hämta det senaste från nätet i bakgrunden till nästa gång.
// Används bara för din egen data.
const WARM_KEY = 'vt-warm';
let warm;
try { warm = new Set(JSON.parse(localStorage.getItem(WARM_KEY) || '[]')); } catch { warm = new Set(); }
function markWarm(key) {
  warm.add(key);
  try { localStorage.setItem(WARM_KEY, JSON.stringify([...warm])); } catch { /* ingen lagring */ }
}
// Minne för den här sessionen: sidor som redan har visats öppnas direkt.
const mem = new Map();
let gen = 0;
export function invalidate(...parts) {
  gen++;
  if (!parts.length) { mem.clear(); return; }
  for (const k of [...mem.keys()]) if (parts.some((p) => k.includes(p))) mem.delete(k);
}
function refresh(q, k) {
  const hit = mem.get(k);
  if (hit && Date.now() - hit.t < 15000) return;
  if (hit) hit.t = Date.now();
  const g = gen;
  getDocsFromServer(q).then((s) => { if (g === gen) mem.set(k, { s, t: Date.now() }); }).catch(() => {});
}
async function fastDocs(q, key) {
  const k = (auth.currentUser?.uid || '') + ':' + key;
  if (mem.has(k)) { const s = mem.get(k).s; refresh(q, k); return s; }
  if (warm.has(k)) {
    try {
      const s = await getDocsFromCache(q);
      mem.set(k, { s, t: 0 });
      refresh(q, k);
      return s;
    } catch { /* inte i cachen, hämta från nätet */ }
  }
  const g = gen;
  const s = await getDocs(q);
  if (g === gen) mem.set(k, { s, t: Date.now() });
  markWarm(k);
  return s;
}
const isMe = (uid) => auth.currentUser && auth.currentUser.uid === uid;

const userDoc = (uid) => doc(db, 'users', uid);
const sub = (uid, name) => collection(db, 'users', uid, name);
const subDoc = (uid, name, id) => doc(db, 'users', uid, name, id);

export const HISTORY_DAYS = 90;

export const PERMS = [
  ['weight', 'Vikt', 'Aktuell vikt och förändring'],
  ['measures', 'Kroppsmått', 'Midja, arm, lår och höft'],
  ['history', 'Historik', 'Tidigare mätningar och grafer'],
  ['photos', 'Bilder', 'Dina före- och efterbilder'],
  ['posts', 'Inlägg', 'Framsteg du väljer att dela'],
  ['treatment', 'Behandling och medicin', 'Känslig information. Av som standard.']
];

export const METRICS = [
  ['weight', 'Vikt', 'kg'],
  ['waist', 'Midja', 'cm'],
  ['arm', 'Arm', 'cm'],
  ['thigh', 'Lår', 'cm'],
  ['hip', 'Höft / rumpa', 'cm']
];

// ---------- Profil och konto ----------

export async function getProfile(uid) {
  const s = await getDoc(userDoc(uid));
  return s.exists() ? s.data() : null;
}

export async function saveProfile(uid, data) {
  await setDoc(userDoc(uid), data, { merge: true });
  const card = {};
  if ('firstName' in data) card.firstName = data.firstName;
  if ('avatar' in data) card.avatar = data.avatar;
  if (Object.keys(card).length) await setDoc(doc(db, 'users', uid, 'public', 'card'), card, { merge: true });
}

export async function usernameFree(name) {
  const s = await getDoc(doc(db, 'usernames', name));
  return !s.exists();
}

export async function claimIdentity(user, firstName, username) {
  await runTransaction(db, async (tx) => {
    const uref = doc(db, 'usernames', username);
    const s = await tx.get(uref);
    if (s.exists()) throw Object.assign(new Error('taken'), { code: 'taken' });
    tx.set(uref, { uid: user.uid });
    tx.set(doc(db, 'emails', user.email.toLowerCase()), { uid: user.uid });
    tx.set(userDoc(user.uid), { firstName, username, email: user.email, createdAt: serverTimestamp(), onboarded: false });
    tx.set(doc(db, 'users', user.uid, 'public', 'card'), { firstName, username });
  });
}

// ---------- Mätningar ----------

function pickMeasures(e) {
  return e ? { arm: e.arm ?? null, waist: e.waist ?? null, thigh: e.thigh ?? null, hip: e.hip ?? null } : null;
}

// Hämtar mätningar. Fungerar både för dig själv och för någon som delar med dig.
export async function loadEntries(uid, sinceDays = null) {
  const since = sinceDays ? Timestamp.fromDate(new Date(Date.now() - sinceDays * 86400000)) : null;
  const q = (name) => since
    ? query(sub(uid, name), where('at', '>', since), orderBy('at'))
    : query(sub(uid, name), orderBy('at'));
  const get = (name) => (isMe(uid) && !since ? fastDocs(q(name), name) : getDocs(q(name)));
  const [w, m] = await Promise.allSettled([get('weights'), get('measures')]);
  const map = new Map();
  if (w.status === 'fulfilled') w.value.forEach((d) => map.set(d.id, { id: d.id, at: d.data().at.toDate(), weight: d.data().weight }));
  if (m.status === 'fulfilled') m.value.forEach((d) => {
    const x = map.get(d.id) || { id: d.id, at: d.data().at.toDate() };
    Object.assign(x, pickMeasures(d.data()));
    map.set(d.id, x);
  });
  return [...map.values()].sort((a, b) => a.at - b.at);
}

function writeSummaries(b, uid, profile, entries) {
  const list = [...entries].sort((a, b2) => a.at - b2.at);
  const first = list[0], last = list[list.length - 1], prev = list[list.length - 2] || null;
  if (!last) {
    b.delete(subDoc(uid, 'summary', 'weight'));
    b.delete(subDoc(uid, 'summary', 'measures'));
    return;
  }
  const start = profile.startWeight ?? first.weight;
  b.set(subDoc(uid, 'summary', 'weight'), {
    start, goal: profile.goalWeight ?? null, current: last.weight, previous: prev ? prev.weight : null,
    currentAt: Timestamp.fromDate(last.at), count: list.length
  });
  b.set(subDoc(uid, 'summary', 'measures'), {
    start: pickMeasures(first), current: pickMeasures(last), previous: pickMeasures(prev),
    currentAt: Timestamp.fromDate(last.at)
  });
}

export async function addEntry(uid, profile, prevEntries, vals) {
  invalidate('weights', 'measures');
  const ref = doc(sub(uid, 'weights'));
  const at = Timestamp.now();
  const b = writeBatch(db);
  b.set(ref, { at, weight: vals.weight });
  b.set(subDoc(uid, 'measures', ref.id), { at, arm: vals.arm, waist: vals.waist, thigh: vals.thigh, hip: vals.hip });
  const p = { ...profile };
  if (p.startWeight == null) {
    p.startWeight = vals.weight;
    b.set(userDoc(uid), { startWeight: vals.weight }, { merge: true });
  }
  writeSummaries(b, uid, p, [...prevEntries, { id: ref.id, at: at.toDate(), ...vals }]);
  await b.commit();
  return { id: ref.id, at: at.toDate(), ...vals, startWeight: p.startWeight };
}

export async function deleteEntry(uid, profile, entries, id) {
  invalidate('weights', 'measures');
  const b = writeBatch(db);
  b.delete(subDoc(uid, 'weights', id));
  b.delete(subDoc(uid, 'measures', id));
  writeSummaries(b, uid, profile, entries.filter((e) => e.id !== id));
  await b.commit();
}

export async function refreshSummaries(uid, profile) {
  invalidate('weights', 'measures');
  const entries = await loadEntries(uid);
  const b = writeBatch(db);
  writeSummaries(b, uid, profile, entries);
  await b.commit();
}

export async function getSummary(uid, which) {
  try {
    const s = await getDoc(subDoc(uid, 'summary', which));
    return s.exists() ? s.data() : null;
  } catch { return null; }
}

// ---------- Delning ----------

export async function lookupPerson(q) {
  const key = String(q || '').trim().toLowerCase().replace(/^@/, '');
  if (!key) return null;
  const s = await getDoc(key.includes('@') ? doc(db, 'emails', key) : doc(db, 'usernames', key));
  if (!s.exists()) return null;
  const uid = s.data().uid;
  const card = await getCard(uid);
  return { uid, firstName: card?.firstName || key, avatar: card?.avatar || null };
}

const cardMem = new Map();
export async function getCard(uid) {
  if (cardMem.has(uid)) return cardMem.get(uid);
  try {
    const c = await getDoc(doc(db, 'users', uid, 'public', 'card'));
    const v = c.exists() ? c.data() : null;
    cardMem.set(uid, v);
    return v;
  } catch { return null; }
}

export async function createShare(me, meName, other, perms, historyRange) {
  invalidate('shares');
  const id = me + '_' + other.uid;
  await setDoc(doc(db, 'shares', id), {
    owner: me, viewer: other.uid, ownerName: meName, viewerName: other.firstName,
    status: 'pending', perms, historyRange, createdAt: serverTimestamp()
  });
  await notify(other.uid, `${meName} vill dela sin resa med dig.`, '#/delning');
}

export async function loadShares(uid) {
  const col = collection(db, 'shares');
  const [o, v] = await Promise.all([
    fastDocs(query(col, where('owner', '==', uid)), 'shares-out'),
    fastDocs(query(col, where('viewer', '==', uid)), 'shares-in')
  ]);
  return {
    out: o.docs.map((d) => ({ id: d.id, ...d.data() })),
    in: v.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
}

export async function getShare(id) {
  try {
    const s = await getDoc(doc(db, 'shares', id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch { return null; }
}

export async function acceptShare(share, myName) {
  invalidate('shares');
  await updateDoc(doc(db, 'shares', share.id), { status: 'active', acceptedAt: serverTimestamp() });
  await notify(share.owner, `${myName} har accepterat din delning.`, '#/delning/' + share.id);
}

export async function updateShare(id, data) {
  invalidate('shares');
  await updateDoc(doc(db, 'shares', id), { ...data, updatedAt: serverTimestamp() });
}

export async function removeShare(id) {
  invalidate('shares');
  await deleteDoc(doc(db, 'shares', id));
}

// ---------- Inlägg, reaktioner och kommentarer ----------

export const REACTIONS = [['heart', '❤️', 'Hjärta'], ['fire', '🔥', 'Eld'], ['strong', '💪', 'Styrka'], ['clap', '👏', 'Applåd']];

export async function createPost(uid, name, data) {
  invalidate('posts');
  await addDoc(sub(uid, 'posts'), { ...data, createdAt: serverTimestamp() });
  try {
    const { out } = await loadShares(uid);
    await Promise.all(out.filter((s) => s.status === 'active' && s.perms?.posts)
      .map((s) => notify(s.viewer, `${name} har lagt till ett nytt framsteg.`, '#/person/' + uid)));
  } catch (e) { console.warn(e); }
}

export async function loadPosts(uid, n = 20) {
  try {
    const q = query(sub(uid, 'posts'), orderBy('createdAt', 'desc'), limit(n));
    const s = await fastDocs(q, 'posts:' + uid + ':' + n);
    return s.docs.map((d) => ({ id: d.id, owner: uid, ...d.data() }));
  } catch { return []; }
}

export async function deletePost(uid, pid) {
  invalidate('posts');
  const [c, r] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'posts', pid, 'comments')),
    getDocs(collection(db, 'users', uid, 'posts', pid, 'reactions'))
  ]);
  const b = writeBatch(db);
  c.forEach((d) => b.delete(d.ref));
  r.forEach((d) => b.delete(d.ref));
  b.delete(subDoc(uid, 'posts', pid));
  await b.commit();
}

export async function loadPostExtras(owner, pid, me) {
  const [r, c] = await Promise.all([
    getDocs(collection(db, 'users', owner, 'posts', pid, 'reactions')),
    getDocs(query(collection(db, 'users', owner, 'posts', pid, 'comments'), orderBy('createdAt')))
  ]);
  const counts = {};
  let mine = null;
  r.forEach((d) => {
    const k = d.data().kind;
    counts[k] = (counts[k] || 0) + 1;
    if (d.id === me) mine = k;
  });
  return { counts, mine, comments: c.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function setReaction(owner, pid, me, myName, kind) {
  const ref = doc(db, 'users', owner, 'posts', pid, 'reactions', me);
  if (!kind) { await deleteDoc(ref); return; }
  await setDoc(ref, { kind, at: serverTimestamp() });
  if (owner !== me) {
    const emoji = REACTIONS.find((r) => r[0] === kind)?.[1] || '';
    await notify(owner, `${myName} gav ${emoji} på ditt inlägg.`, '#/delning');
  }
}

export async function addComment(owner, pid, me, myName, text) {
  await addDoc(collection(db, 'users', owner, 'posts', pid, 'comments'), {
    uid: me, name: myName, text, createdAt: serverTimestamp()
  });
  if (owner !== me) await notify(owner, `${myName} har kommenterat ditt inlägg.`, '#/delning');
}

// ---------- Bilder ----------

export async function loadPhotos(uid) {
  try {
    const q = query(sub(uid, 'photos'), orderBy('at'));
    const s = isMe(uid) ? await fastDocs(q, 'photos') : await getDocs(q);
    return s.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at.toDate() }));
  } catch { return []; }
}
export async function addPhoto(uid, kind, data, weight) {
  invalidate('photos');
  await addDoc(sub(uid, 'photos'), { kind, data, weight: weight ?? null, at: Timestamp.now() });
}
export async function deletePhoto(uid, id) {
  invalidate('photos'); await deleteDoc(subDoc(uid, 'photos', id)); }

// ---------- Behandling ----------

export async function loadTreatments(uid) {
  try {
    const q = query(sub(uid, 'treatments'), orderBy('date', 'desc'));
    const s = isMe(uid) ? await fastDocs(q, 'treatments') : await getDocs(q);
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
export async function addTreatment(uid, data) {
  invalidate('treatments'); await addDoc(sub(uid, 'treatments'), { ...data, createdAt: serverTimestamp() }); }
export async function deleteTreatment(uid, id) {
  invalidate('treatments'); await deleteDoc(subDoc(uid, 'treatments', id)); }

// ---------- Personliga mål ----------

export async function loadGoals(uid) {
  const s = await fastDocs(query(sub(uid, 'goals'), orderBy('createdAt')), 'goals');
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addGoal(uid, text) {
  invalidate('goals'); await addDoc(sub(uid, 'goals'), { text, done: false, doneAt: null, createdAt: Timestamp.now() }); }
export async function setGoalDone(uid, id, done) {
  invalidate('goals'); await updateDoc(subDoc(uid, 'goals', id), { done, doneAt: done ? Timestamp.now() : null }); }
export async function deleteGoal(uid, id) {
  invalidate('goals'); await deleteDoc(subDoc(uid, 'goals', id)); }

// ---------- Notiser ----------

export async function notify(to, text, link = '#/') {
  try {
    await addDoc(collection(db, 'notifications', to, 'items'), {
      from: auth.currentUser.uid, text, link, read: false, createdAt: serverTimestamp()
    });
  } catch (e) { console.warn('Notis kunde inte skickas', e); }
}

export function watchUnread(uid, cb) {
  let last = -1;
  return onSnapshot(query(collection(db, 'notifications', uid, 'items'), where('read', '==', false)),
    (s) => { if (last >= 0 && s.size > last) invalidate(); last = s.size; cb(s.size); }, () => cb(0));
}

export async function loadNotifications(uid) {
  const s = await fastDocs(query(collection(db, 'notifications', uid, 'items'), orderBy('createdAt', 'desc'), limit(50)), 'notifs');
  return s.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

export async function markRead(items) {
  invalidate('notifs');
  const unread = items.filter((n) => !n.read);
  if (!unread.length) return;
  const b = writeBatch(db);
  unread.forEach((n) => b.update(n.ref, { read: true }));
  await b.commit();
}

// ---------- Radera allt ----------

async function deleteAll(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

export async function deleteEverything(password) {
  const user = auth.currentUser;
  const uid = user.uid;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const profile = await getProfile(uid);
  const refs = [];
  for (const name of ['weights', 'measures', 'summary', 'photos', 'treatments', 'goals', 'public']) {
    (await getDocs(sub(uid, name))).forEach((d) => refs.push(d.ref));
  }
  const posts = await getDocs(sub(uid, 'posts'));
  for (const p of posts.docs) {
    (await getDocs(collection(p.ref, 'comments'))).forEach((d) => refs.push(d.ref));
    (await getDocs(collection(p.ref, 'reactions'))).forEach((d) => refs.push(d.ref));
    refs.push(p.ref);
  }
  (await getDocs(collection(db, 'notifications', uid, 'items'))).forEach((d) => refs.push(d.ref));
  const shares = await loadShares(uid);
  [...shares.out, ...shares.in].forEach((s) => refs.push(doc(db, 'shares', s.id)));
  await deleteAll(refs);
  const last = [];
  if (profile?.username) last.push(doc(db, 'usernames', profile.username));
  last.push(doc(db, 'emails', user.email.toLowerCase()));
  last.push(userDoc(uid));
  await deleteAll(last);
  await deleteUser(user);
}
