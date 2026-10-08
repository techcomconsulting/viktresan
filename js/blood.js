// Blodvärden: blodsocker, kolesterol, blodtryck och puls.
// Normalintervallen är ungefärliga för vuxna och bara ett stöd. Labbet kan ha andra gränser.
import { db, auth, doc, collection, getDocs, addDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from './firebase.js';

// [nyckel, namn, kort förklaring, enhet, lägsta normal, högsta normal, decimaler, grupp]
export const BLOOD = [
  ['glucose', 'Fasteblodsocker', 'Mäts på morgonen innan frukost', 'mmol/L', 4.0, 6.0, 1, 'socker'],
  ['hba1c', 'HbA1c', 'Långtidssocker, de senaste 2–3 månaderna', 'mmol/mol', null, 42, 0, 'socker'],
  ['chol', 'Kolesterol totalt', '', 'mmol/L', null, 5.0, 1, 'fett'],
  ['ldl', 'LDL', 'Det "onda" kolesterolet', 'mmol/L', null, 3.0, 1, 'fett'],
  ['hdl', 'HDL', 'Det "goda" kolesterolet', 'mmol/L', 1.0, null, 1, 'fett'],
  ['tg', 'Triglycerider', 'Blodfetter', 'mmol/L', null, 1.7, 1, 'fett'],
  ['sys', 'Blodtryck, övre', 'Systoliskt', 'mmHg', 90, 139, 0, 'tryck'],
  ['dia', 'Blodtryck, nedre', 'Diastoliskt', 'mmHg', 60, 89, 0, 'tryck'],
  ['pulse', 'Vilopuls', 'Slag per minut i vila', 'slag/min', 50, 100, 0, 'tryck']
];

export const BLOOD_GROUPS = [
  ['socker', 'Blodsocker'],
  ['fett', 'Kolesterol och blodfetter'],
  ['tryck', 'Blodtryck och puls']
];

// Rimliga gränser så att man inte råkar skriva fel.
export const BLOOD_LIMITS = {
  glucose: [1, 40], hba1c: [10, 200], chol: [1, 20], ldl: [0.2, 15], hdl: [0.1, 5], tg: [0.1, 30],
  sys: [60, 260], dia: [30, 160], pulse: [25, 220]
};

export const bloodInfo = (key) => BLOOD.find((b) => b[0] === key);

// 'ok' = inom normal, 'high' = över, 'low' = under, null = inget intervall
export function bloodStatus(key, v) {
  const b = bloodInfo(key);
  if (!b || v == null) return null;
  const [, , , , lo, hi] = b;
  if (hi != null && v > hi) return 'high';
  if (lo != null && v < lo) return 'low';
  return 'ok';
}

const uid = () => auth.currentUser.uid;
const col = (u) => collection(db, 'users', u, 'blood');

export async function loadBlood(owner) {
  const s = await getDocs(query(col(owner), orderBy('at', 'asc')));
  return s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, ...x, at: x.at?.toDate ? x.at.toDate() : new Date(x.at) };
  });
}

export async function addBlood(date, values, note = '') {
  const at = Timestamp.fromDate(new Date(date + 'T12:00:00'));
  await addDoc(col(uid()), { at, values, note: note || '', created: serverTimestamp() });
}

export async function deleteBlood(id) {
  await deleteDoc(doc(db, 'users', uid(), 'blood', id));
}

// Senaste värdet och värdet innan, för en viss nyckel.
export function bloodSeries(list, key) {
  return list.filter((e) => e.values && e.values[key] != null).map((e) => ({ at: e.at, v: e.values[key] }));
}
