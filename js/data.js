// All kontakt med databasen samlad på ett ställe.
import {
  db, auth, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
  orderBy, limit, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot,
  deleteUser, reauthenticateWithCredential, EmailAuthProvider, getDocsFromServer
} from './firebase.js';

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
  const g = gen;
  const s = await getDocs(q);
  if (g === gen) mem.set(k, { s, t: Date.now() });
  return s;
}
const isMe = (uid) => auth.currentUser && auth.currentUser.uid === uid;

// Hämtar det vanligaste i bakgrunden direkt efter inloggning,
// så att menyerna öppnas snabbt redan första gången.
export function prefetch(uid) {
  const jobs = [
    () => loadEntries(uid), () => loadNotifications(uid), () => loadShares(uid), () => loadGoals(uid),
    () => migrateOldPosts(uid).then(() => loadMyPosts(uid)), () => loadGroups(uid), () => loadTreatments(uid), () => loadPhotos(uid)
  ];
  jobs.forEach((j) => j().catch(() => {}));
}

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
  ['food', 'Kost', 'Mat, kalorier och vatten per dag'],
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

// Senaste och näst senaste värdet för ett visst mått (hoppar över tomma).
export function lastValues(entries, key) {
  const v = entries.filter((e) => e[key] != null);
  return { first: v[0] || null, last: v[v.length - 1] || null, prev: v[v.length - 2] || null, list: v };
}

function writeSummaries(b, uid, profile, entries) {
  const list = [...entries].sort((a, b2) => a.at - b2.at);
  const W = lastValues(list, 'weight');
  if (W.last) {
    b.set(subDoc(uid, 'summary', 'weight'), {
      start: profile.startWeight ?? W.first.weight, goal: profile.goalWeight ?? null,
      current: W.last.weight, previous: W.prev ? W.prev.weight : null,
      currentAt: Timestamp.fromDate(W.last.at), count: W.list.length
    });
    // Bara procent, inga kilo. Det här får den se som bara får se procent.
    const start = profile.startWeight ?? W.first.weight;
    const pc = (w) => (start ? Math.round(((w - start) / start) * 1000) / 10 : null);
    const goal = profile.goalWeight;
    const goalPct = goal != null && start !== goal ? Math.max(0, Math.min(100, Math.round(((start - W.last.weight) / (start - goal)) * 100))) : null;
    const series = W.list.map((e) => ({ t: e.at.getTime(), p: pc(e.weight) }));
    const cut = Date.now() - 92 * 86400000;
    b.set(subDoc(uid, 'summary', 'percent'), {
      total: pc(W.last.weight),
      sinceLast: W.prev ? Math.round(((W.last.weight - W.prev.weight) / W.prev.weight) * 1000) / 10 : null,
      goalPct, currentAt: Timestamp.fromDate(W.last.at)
    });
    b.set(subDoc(uid, 'summary', 'pctAll'), { series: series.slice(-500) });
    b.set(subDoc(uid, 'summary', 'pct3m'), { series: series.filter((x) => x.t >= cut) });
  } else {
    ['weight', 'percent', 'pctAll', 'pct3m'].forEach((k) => b.delete(subDoc(uid, 'summary', k)));
  }
  const keys = ['arm', 'waist', 'thigh', 'hip'];
  const per = Object.fromEntries(keys.map((k) => [k, lastValues(list, k)]));
  const pick = (which) => Object.fromEntries(keys.map((k) => [k, per[k][which] ? per[k][which][k] : null]));
  const latest = keys.map((k) => per[k].last?.at).filter(Boolean).sort((a, c) => c - a)[0];
  if (latest) {
    b.set(subDoc(uid, 'summary', 'measures'), {
      start: pick('first'), current: pick('last'), previous: pick('prev'), currentAt: Timestamp.fromDate(latest)
    });
  } else b.delete(subDoc(uid, 'summary', 'measures'));
}

export async function addEntry(uid, profile, prevEntries, vals) {
  invalidate('weights', 'measures');
  const ref = doc(sub(uid, 'weights'));
  const at = Timestamp.now();
  const b = writeBatch(db);
  const v = { weight: null, arm: null, waist: null, thigh: null, hip: null, ...vals };
  b.set(ref, { at, weight: v.weight });
  b.set(subDoc(uid, 'measures', ref.id), { at, arm: v.arm, waist: v.waist, thigh: v.thigh, hip: v.hip });
  vals = v;
  const p = { ...profile };
  if (p.startWeight == null && vals.weight != null) {
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

// Skapar procent-sammanfattningen en gång för den som hade data före den här versionen.
export async function ensurePercent(uid, profile) {
  const flag = 'vt-pct-v1-' + uid;
  try { if (localStorage.getItem(flag)) return; } catch { return; }
  await refreshSummaries(uid, profile);
  try { localStorage.setItem(flag, '1'); } catch { /* ok */ }
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

const postsCol = () => collection(db, 'posts');
const postDoc = (pid) => doc(db, 'posts', pid);
const toPost = (d) => ({ id: d.id, ...d.data() });
const byNewest = (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);

// Vilka jag är kopplad till (delar med eller som delar med mig).
export async function loadPeople(uid) {
  const { out, in: inc } = await loadShares(uid);
  const map = new Map();
  out.filter((s) => s.status === 'active').forEach((s) => map.set(s.viewer, s.viewerName));
  inc.filter((s) => s.status === 'active').forEach((s) => map.set(s.owner, s.ownerName));
  return [...map.entries()].map(([id, name]) => ({ uid: id, name })).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

// audience: { type: 'shares' | 'public' | 'group' | 'people', viewers: [uid], label }
export async function createPost(uid, name, data, audience = { type: 'shares', viewers: [], label: '' }) {
  invalidate('posts');
  const viewers = audience.type === 'group' || audience.type === 'people' ? [...new Set(audience.viewers)] : [];
  await addDoc(postsCol(), {
    ...data, owner: uid, ownerName: name, audience: audience.type,
    audienceLabel: audience.label || '', viewers, public: audience.type === 'public',
    createdAt: serverTimestamp()
  });
  try {
    let to = viewers;
    if (audience.type === 'shares' || audience.type === 'public') {
      const { out } = await loadShares(uid);
      to = out.filter((s) => s.status === 'active' && (audience.type === 'public' || s.perms?.posts)).map((s) => s.viewer);
    }
    await Promise.all(to.map((v) => notify(v, `${name} har lagt till ett nytt inlägg.`, '#/flode')));
  } catch (e) { console.warn(e); }
}

export async function loadMyPosts(uid, n = 20) {
  try {
    const s = await fastDocs(query(postsCol(), where('owner', '==', uid)), 'posts:mine');
    return s.docs.map(toPost).sort(byNewest).slice(0, n);
  } catch (e) { console.warn(e); return []; }
}

// Alla inlägg från andra som jag får se.
export async function loadFeed(uid, n = 30) {
  const { in: inc } = await loadShares(uid).catch(() => ({ in: [] }));
  const owners = inc.filter((s) => s.status === 'active' && s.perms?.posts).map((s) => s.owner);
  const jobs = [
    fastDocs(query(postsCol(), where('viewers', 'array-contains', uid)), 'posts:direct'),
    fastDocs(query(postsCol(), where('public', '==', true)), 'posts:public'),
    ...owners.map((o) => fastDocs(query(postsCol(), where('owner', '==', o), where('audience', '==', 'shares')), 'posts:from:' + o))
  ];
  const res = await Promise.allSettled(jobs);
  const map = new Map();
  res.forEach((r) => { if (r.status === 'fulfilled') r.value.docs.forEach((d) => map.set(d.id, toPost(d))); });
  return [...map.values()].filter((p) => p.owner !== uid).sort(byNewest).slice(0, n);
}

export async function loadPostsOf(owner, me) {
  const feed = await loadFeed(me, 200);
  return feed.filter((p) => p.owner === owner).slice(0, 20);
}

export async function deletePost(pid) {
  invalidate('posts');
  const [c, r] = await Promise.all([
    getDocs(collection(db, 'posts', pid, 'comments')),
    getDocs(collection(db, 'posts', pid, 'reactions'))
  ]);
  const b = writeBatch(db);
  c.forEach((d) => b.delete(d.ref));
  r.forEach((d) => b.delete(d.ref));
  b.delete(postDoc(pid));
  await b.commit();
}

export async function loadPostExtras(pid, me) {
  const [r, c] = await Promise.all([
    getDocs(collection(db, 'posts', pid, 'reactions')),
    getDocs(query(collection(db, 'posts', pid, 'comments'), orderBy('createdAt')))
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

export async function setReaction(post, me, myName, kind) {
  const ref = doc(db, 'posts', post.id, 'reactions', me);
  if (!kind) { await deleteDoc(ref); return; }
  await setDoc(ref, { kind, at: serverTimestamp() });
  if (post.owner !== me) {
    const emoji = REACTIONS.find((r) => r[0] === kind)?.[1] || '';
    await notify(post.owner, `${myName} gav ${emoji} på ditt inlägg.`, '#/flode');
  }
}

export async function addComment(post, me, myName, text) {
  await addDoc(collection(db, 'posts', post.id, 'comments'), {
    uid: me, name: myName, text, createdAt: serverTimestamp()
  });
  if (post.owner !== me) await notify(post.owner, `${myName} har kommenterat ditt inlägg.`, '#/flode');
}

// Flyttar inlägg från den gamla platsen (första versionen) till den nya.
export async function migrateOldPosts(uid) {
  const flag = 'vt-posts-moved-' + uid;
  try { if (localStorage.getItem(flag)) return; } catch { return; }
  const old = await getDocs(sub(uid, 'posts'));
  if (!old.empty) {
    const card = await getCard(uid);
    for (const d of old.docs) {
      const x = d.data();
      const b = writeBatch(db);
      b.set(postDoc(d.id), {
        ...x, owner: uid, ownerName: card?.firstName || '', audience: 'shares', audienceLabel: '', viewers: [], public: false,
        createdAt: x.createdAt || Timestamp.now()
      });
      (await getDocs(collection(d.ref, 'comments'))).forEach((c) => b.delete(c.ref));
      (await getDocs(collection(d.ref, 'reactions'))).forEach((r) => b.delete(r.ref));
      b.delete(d.ref);
      await b.commit();
    }
    invalidate('posts');
  }
  try { localStorage.setItem(flag, '1'); } catch { /* ok */ }
}

// ---------- Grupper ----------

export async function loadGroups(uid) {
  try {
    const s = await fastDocs(query(sub(uid, 'groups'), orderBy('name')), 'groups');
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
export async function saveGroup(uid, group) {
  invalidate('groups');
  const data = { name: group.name, members: group.members };
  if (group.id) await setDoc(subDoc(uid, 'groups', group.id), data);
  else await addDoc(sub(uid, 'groups'), data);
}
export async function deleteGroup(uid, id) {
  invalidate('groups');
  await deleteDoc(subDoc(uid, 'groups', id));
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
  for (const name of ['weights', 'measures', 'summary', 'photos', 'treatments', 'goals', 'public', 'groups']) {
    (await getDocs(sub(uid, name))).forEach((d) => refs.push(d.ref));
  }
  const posts = await getDocs(query(postsCol(), where('owner', '==', uid)));
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
