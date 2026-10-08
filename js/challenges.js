// Utmaningar: tävla i procent viktnedgång med dem du delar med. Bara procent visas, aldrig kilo.
import { db, auth, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, serverTimestamp, Timestamp } from './firebase.js';
import { notify } from './data.js';

const col = () => collection(db, 'challenges');
const me = () => auth.currentUser.uid;
const toDate = (x) => (x?.toDate ? x.toDate() : x ? new Date(x) : null);
const norm = (d) => ({ id: d.id, ...d.data(), start: toDate(d.data().start), end: toDate(d.data().end) });

export const LENGTHS = [[14, '2 veckor'], [28, '4 veckor'], [56, '8 veckor'], [91, '3 månader']];

export async function createChallenge({ title, days, people, myName }) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * 86400000); end.setHours(23, 59, 59, 0);
  const invited = people.map((p) => p.uid);
  const names = Object.fromEntries([[me(), myName], ...people.map((p) => [p.uid, p.name])]);
  const ref = await addDoc(col(), {
    title, owner: me(), ownerName: myName, start: Timestamp.fromDate(start), end: Timestamp.fromDate(end),
    members: [me()], invited, names, created: serverTimestamp()
  });
  await Promise.all(invited.map((u) => notify(u, `${myName} utmanar dig: ${title}`, `#/utmaning/${ref.id}`)));
  return ref.id;
}

export async function loadChallenges() {
  const [a, b] = await Promise.all([
    getDocs(query(col(), where('members', 'array-contains', me()))),
    getDocs(query(col(), where('invited', 'array-contains', me())))
  ]);
  const map = new Map();
  [...a.docs, ...b.docs].forEach((d) => map.set(d.id, norm(d)));
  return [...map.values()].sort((x, y) => y.end - x.end);
}

export async function getChallenge(id) {
  const s = await getDoc(doc(db, 'challenges', id));
  return s.exists() ? norm(s) : null;
}

export async function joinChallenge(c, myName) {
  await updateDoc(doc(db, 'challenges', c.id), {
    members: [...c.members, me()], invited: c.invited.filter((u) => u !== me()), names: { ...(c.names || {}), [me()]: myName }
  });
  if (c.owner !== me()) await notify(c.owner, `${myName} är med i ${c.title}!`, `#/utmaning/${c.id}`);
}

export async function declineChallenge(c) {
  await updateDoc(doc(db, 'challenges', c.id), { invited: c.invited.filter((u) => u !== me()) });
}

export async function leaveChallenge(c) {
  try { await deleteDoc(doc(db, 'challenges', c.id, 'scores', me())); } catch { /* ok */ }
  await updateDoc(doc(db, 'challenges', c.id), { members: c.members.filter((u) => u !== me()) });
}

export async function deleteChallenge(c) {
  const s = await getDocs(collection(db, 'challenges', c.id, 'scores')).catch(() => ({ docs: [] }));
  for (const d of s.docs) { try { await deleteDoc(d.ref); } catch { /* ok */ } }
  await deleteDoc(doc(db, 'challenges', c.id));
}

export async function loadScores(c) {
  const s = await getDocs(collection(db, 'challenges', c.id, 'scores'));
  return Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
}

// Procent sedan utmaningen började. Startvärdet = senaste vägningen före start (annars första under utmaningen).
export function challengePct(entries, c) {
  const w = entries.filter((e) => e.weight != null);
  const before = w.filter((e) => e.at <= c.start);
  const during = w.filter((e) => e.at > c.start && e.at <= c.end);
  const base = before.length ? before[before.length - 1] : during[0];
  const cur = during.length ? during[during.length - 1] : null;
  if (!base || !cur || base === cur) return before.length || during.length ? 0 : null;
  return Math.round(((cur.weight - base.weight) / base.weight) * 1000) / 10;
}

// Skriver in min egen procent i alla utmaningar jag är med i (bara siffran, inga kilo).
export async function syncMyScores(entries, myName) {
  let list;
  try { list = await loadChallenges(); } catch { return []; }
  const now = new Date();
  const mine = list.filter((c) => c.members.includes(me()) && now.getTime() - c.end.getTime() < 7 * 86400000);
  await Promise.all(mine.map(async (c) => {
    const pct = challengePct(entries, c);
    if (pct == null) return;
    try { await setDoc(doc(db, 'challenges', c.id, 'scores', me()), { pct, name: myName, updated: serverTimestamp() }); } catch { /* ok */ }
  }));
  return list;
}

export const isActive = (c) => new Date() <= c.end;
export const daysLeft = (c) => Math.max(0, Math.ceil((c.end - new Date()) / 86400000));
