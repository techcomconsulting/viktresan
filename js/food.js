// Kost: matdagbok, vatten, favoriter, måltider och matdatabaser.
import {
  db, auth, doc, getDoc, setDoc, deleteDoc, addDoc, collection, getDocs, query, where, orderBy, limit,
  writeBatch, serverTimestamp
} from './firebase.js';

export const MEALS = [['breakfast', 'Frukost'], ['lunch', 'Lunch'], ['dinner', 'Middag'], ['snack', 'Mellanmål']];
export const mealName = (k) => (MEALS.find((m) => m[0] === k) || MEALS[3])[1];

// Föreslår måltid efter klockan.
export function mealNow() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h >= 17 && h < 21) return 'dinner';
  return 'snack';
}

const uid = () => auth.currentUser.uid;
const col = (u, name) => collection(db, 'users', u, name);
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- Enkelt minne för sessionen ----------
const mem = new Map();
function cached(key, ms, fn) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v;
  const v = fn().catch((e) => { mem.delete(key); throw e; });
  mem.set(key, { v, t: Date.now() });
  return v;
}
const forget = (...parts) => { for (const k of [...mem.keys()]) if (parts.some((p) => k.includes(p))) mem.delete(k); };

// Är det en dryck? Då mäter vi i cl/dl i stället för gram (1 cl ≈ 10 g).
// Tittar på första ordet i namnet, t.ex. "Kaffe bryggt" eller "Mellanmjölk fett 1,5%".
const DRINK_FIRST = /^(kaffe|kaffedrink|iskaffe|espresso|cappuccino|caffe|latte|chai|te|nyponte|örtte|mjölk|mellanmjölk|lättmjölk|standardmjölk|minimjölk|havredryck|sojadryck|mandeldryck|risdryck|kokosdryck|ärtdryck|mjölkdryck|chokladdryck|proteindryck|sportdryck|energidryck|måltidsdryck|\S*juice|\S*nektar|\S*saft|\S*dricka|läsk|alkoläsk|cola|lemonad|smoothie|öl|lättöl|folköl|starköl|vin|rödvin|glögg|cider|buljong|vatten|mineralvatten|kakao|filmjölk|kefir|drickyoghurt|yoghurtdryck|\S*dryck)$/i;
function looksLikeDrink(name) {
  const n = String(name || '').toLowerCase();
  if (/pulver|konc\.|glass|choklad(?!dryck)/.test(n) && !/drickf/.test(n)) return false;
  if (/drickf/.test(n)) return true;
  return DRINK_FIRST.test(n.split(/[\s,]+/)[0] || '');
}
export function isLiquid(food) {
  if (food.liquid != null) return !!food.liquid;
  return looksLikeDrink(food.name);
}
// Ungefärlig vikt för en bit (ätlig del), t.ex. ett ägg eller en banan.
const PIECES = [
  [/^(ägg|hönsägg)$/, 50], [/^banan$/, 110], [/^äpple$/, 150], [/^päron$/, 150], [/^apelsin$/, 140],
  [/^(mandarin|clementin|klementin|satsuma)/, 55], [/^kiwi$/, 70], [/^(persika|nektarin)/, 130], [/^plommon$/, 50],
  [/^avokado$/, 140], [/^tomat$/, 90], [/^(körsbärstomat|cocktailtomat)/, 15], [/^morot$/, 70], [/^potatis$/, 90],
  [/^(lök|gul lök|rödlök)$/, 80], [/^paprika$/, 150], [/^knäckebröd/, 12], [/^(bröd|limpa|rostbröd|formfranska|toast)$/, 30],
  [/^(fralla|småfranska|frukostbulle|bulle)/, 50], [/^(kanelbulle|vetebulle|kardemummabulle)/, 50], [/^tortilla/, 40],
  [/^(köttbulle|köttbullar)/, 20], [/^(dadel|dadlar)/, 8], [/^(valnöt|valnötter)/, 5], [/^(mandel|mandlar)$/, 1.2],
  [/^(jordgubbe|jordgubbar)/, 15], [/^(proteinbar|bar)\b/, 50], [/^(riskaka|riskakor)/, 9], [/^(skorpa|skorpor)/, 10]
];
export function pieceGrams(food) {
  if (food.pieceG) return food.pieceG;
  try {
    const mine = JSON.parse(localStorage.getItem('vt-pieces') || '{}');
    if (mine[food.name]) return mine[food.name];
  } catch { /* ok */ }
  const first = String(food.name || '').toLowerCase().split(/[\s,]+/)[0] || '';
  const hit = PIECES.find(([re]) => re.test(first));
  return hit ? hit[1] : null;
}
export function rememberPiece(food, g) {
  try {
    const mine = JSON.parse(localStorage.getItem('vt-pieces') || '{}');
    mine[food.name] = g;
    localStorage.setItem('vt-pieces', JSON.stringify(mine));
  } catch { /* ok */ }
}

export const isHotDrink = (food) => /(kaffe|espresso|cappuccino|latte|\bte\b|kakao)/i.test(food.name || '');

// Räknar ut näring för en mängd.
export function nutrition(food, grams) {
  const k = grams / 100;
  const p = food.per100 || {};
  return { kcal: Math.round((p.kcal || 0) * k), p: r1((p.p || 0) * k), c: r1((p.c || 0) * k), f: r1((p.f || 0) * k) };
}

// ---------- Matdagbok ----------

export async function loadDay(u, day) {
  return cached(`log:${u}:${day}`, 30000, async () => {
    const s = await getDocs(query(col(u, 'foodlog'), where('day', '==', day)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at?.toMillis?.() || 0) - (b.at?.toMillis?.() || 0));
  });
}

export function dayTotals(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  items.forEach((i) => { t.kcal += i.kcal || 0; t.p += i.p || 0; t.c += i.c || 0; t.f += i.f || 0; });
  return { kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f) };
}

export async function logFood(day, meal, food, grams, label) {
  forget('log:', 'recent:');
  const n = nutrition(food, grams);
  await addDoc(col(uid(), 'foodlog'), {
    day, meal, name: food.name, brand: food.brand || '', grams, label: label || `${r1(grams)} g`,
    ...n, src: food.src || 'fam', ref: String(food.ref || ''), per100: food.per100,
    portionG: food.portionG || null, packG: food.packG || null, pieceG: food.pieceG || null, liquid: isLiquid(food), at: serverTimestamp()
  });
}

export async function updateLogged(id, food, grams, label, meal) {
  forget('log:');
  await setDoc(doc(db, 'users', uid(), 'foodlog', id), { grams, label, meal, ...nutrition(food, grams) }, { merge: true });
}

export async function removeLogged(id) {
  forget('log:', 'recent:');
  await deleteDoc(doc(db, 'users', uid(), 'foodlog', id));
}

// Senast ätna, utan dubletter.
export async function loadRecent(u) {
  return cached(`recent:${u}`, 60000, async () => {
    const s = await getDocs(query(col(u, 'foodlog'), orderBy('at', 'desc'), limit(60)));
    const seen = new Set();
    const out = [];
    s.docs.forEach((d) => {
      const x = d.data();
      const key = x.src + ':' + (x.ref || x.name);
      if (seen.has(key) || !x.per100) return;
      seen.add(key);
      out.push({ food: { src: x.src, ref: x.ref, name: x.name, brand: x.brand, per100: x.per100, portionG: x.portionG, packG: x.packG, liquid: x.liquid }, grams: x.grams, label: x.label });
    });
    return out.slice(0, 20);
  });
}

// ---------- Vatten ----------

export async function loadWater(u, day) {
  return cached(`water:${u}:${day}`, 30000, async () => {
    const s = await getDoc(doc(db, 'users', u, 'water', day));
    return s.exists() ? s.data().cl || 0 : 0;
  });
}
export async function setWater(day, cl) {
  mem.set(`water:${uid()}:${day}`, { v: Promise.resolve(cl), t: Date.now() });
  await setDoc(doc(db, 'users', uid(), 'water', day), { cl, day });
}

// ---------- Favoriter ----------

const favId = (f) => (f.src + '_' + String(f.ref || f.name)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);

export async function loadFavs(u) {
  return cached(`favs:${u}`, 60000, async () => {
    const s = await getDocs(col(u, 'foodfav'));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.food.name.localeCompare(b.food.name, 'sv'));
  });
}
export async function isFav(food) {
  const favs = await loadFavs(uid());
  return favs.some((x) => x.id === favId(food));
}
export async function setFav(food, on) {
  forget('favs:');
  const ref = doc(db, 'users', uid(), 'foodfav', favId(food));
  if (on) await setDoc(ref, { food: { src: food.src, ref: String(food.ref || ''), name: food.name, brand: food.brand || '', per100: food.per100, portionG: food.portionG || null, packG: food.packG || null, liquid: isLiquid(food) } });
  else await deleteDoc(ref);
}

// ---------- Sparade måltider ----------

export async function loadSavedMeals(u) {
  return cached(`smeals:${u}`, 60000, async () => {
    const s = await getDocs(col(u, 'savedmeals'));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  });
}
export async function saveMeal(name, items) {
  forget('smeals:');
  await addDoc(col(uid(), 'savedmeals'), {
    name,
    items: items.map((i) => ({ name: i.name, brand: i.brand || '', grams: i.grams, label: i.label, src: i.src, ref: i.ref || '', per100: i.per100, portionG: i.portionG || null, packG: i.packG || null, liquid: isLiquid(i) }))
  });
}
export async function deleteSavedMeal(id) {
  forget('smeals:');
  await deleteDoc(doc(db, 'users', uid(), 'savedmeals', id));
}
export async function logSavedMeal(day, meal, m) {
  forget('log:', 'recent:');
  const b = writeBatch(db);
  m.items.forEach((i) => {
    b.set(doc(col(uid(), 'foodlog')), {
      day, meal, name: i.name, brand: i.brand, grams: i.grams, label: i.label, ...nutrition(i, i.grams),
      src: i.src, ref: i.ref, per100: i.per100, portionG: i.portionG, packG: i.packG, liquid: isLiquid(i), at: serverTimestamp()
    });
  });
  await b.commit();
}
export const savedMealKcal = (m) => m.items.reduce((t, i) => t + nutrition(i, i.grams).kcal, 0);

// ---------- Livsmedelsverket (fil i appen) ----------

let slvPromise = null;
export function loadSlv() {
  if (!slvPromise) {
    slvPromise = fetch('data/livsmedel.json').then((r) => (r.ok ? r.json() : { items: [] })).then((d) =>
      (d.items || []).map(([nr, name, kcal, p, c, f]) => ({ src: 'slv', ref: String(nr), name, brand: '', per100: { kcal, p, c, f }, lower: name.toLowerCase() }))
    ).catch(() => { slvPromise = null; return []; });
  }
  return slvPromise;
}

function score(lower, words) {
  if (!words.every((w) => lower.includes(w))) return -1;
  let s = 0;
  if (lower.startsWith(words[0])) s += 10;
  if (lower.split(/[ ,]+/).some((p) => p.startsWith(words[0]))) s += 5;
  return s - lower.length / 100;
}

export async function searchSlv(q) {
  let words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const all = await loadSlv();
  const run = (ws) => all.map((f) => [f, score(f.lower, ws)]).filter(([, s]) => s >= 0);
  let hits = run(words);
  // Sammansatta ord, t.ex. "kycklingfilé" = "kyckling" + "filé".
  if (!hits.length) {
    const long = words.find((w) => w.length >= 7);
    if (long) {
      const rest = words.filter((w) => w !== long);
      for (let i = long.length - 3; i >= 3 && !hits.length; i--) {
        const tryWords = [long.slice(0, i), long.slice(i), ...rest];
        const h = run(tryWords);
        if (h.length) { hits = h; words = tryWords; }
      }
      if (!hits.length) hits = run([long.slice(0, 6), ...rest]);
    }
  }
  // Visa helst träffar där ordet börjar, inte mitt i ett annat ord.
  if (hits.some(([, s]) => s >= 5)) hits = hits.filter(([, s]) => s >= 5);
  return hits.sort((a, b) => b[1] - a[1]).slice(0, 15).map(([f]) => f);
}

// ---------- Gemensamma varor (familjen har lagt till) ----------

const famFood = (d) => ({ src: 'fam', ref: d.id, ...d.data() });

export async function searchShared(q) {
  const s0 = q.trim().toLowerCase();
  if (!s0) return [];
  try {
    const s = await getDocs(query(collection(db, 'foods'), where('nameLower', '>=', s0), where('nameLower', '<=', s0 + ''), limit(10)));
    return s.docs.map(famFood);
  } catch { return []; }
}

export async function sharedByBarcode(code) {
  try {
    const s = await getDoc(doc(db, 'foods', code));
    return s.exists() ? famFood(s) : null;
  } catch { return null; }
}

export async function addSharedFood(data) {
  const clean = {
    name: data.name, nameLower: data.name.toLowerCase(), brand: data.brand || '', barcode: data.barcode || '',
    per100: data.per100, portionG: data.portionG || null, packG: data.packG || null, liquid: !!data.liquid,
    createdBy: uid(), createdAt: serverTimestamp()
  };
  if (data.barcode) {
    await setDoc(doc(db, 'foods', data.barcode), clean);
    return { src: 'fam', ref: data.barcode, ...clean };
  }
  const ref = await addDoc(collection(db, 'foods'), clean);
  return { src: 'fam', ref: ref.id, ...clean };
}

// ---------- Open Food Facts (streckkoder) ----------

const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_sv,brands,nutriments,serving_quantity,product_quantity,product_quantity_unit,quantity';

function fromOff(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  const name = (p.product_name_sv || p.product_name || '').trim();
  if (!name || kcal == null) return null;
  const num = (x) => (x == null || x === '' || isNaN(Number(x)) ? null : Number(x));
  return {
    src: 'off', ref: p.code, barcode: p.code, name, brand: (p.brands || '').split(',')[0].trim(),
    per100: { kcal: Math.round(Number(kcal)), p: r1(num(n.proteins_100g) || 0), c: r1(num(n.carbohydrates_100g) || 0), f: r1(num(n.fat_100g) || 0) },
    portionG: num(p.serving_quantity), packG: num(p.product_quantity),
    liquid: /ml/i.test(p.product_quantity_unit || '') || /\d\s*(ml|cl|dl|l)\b/i.test(p.quantity || '') || (looksLikeDrink(name) ? true : null)
  };
}

export async function offByBarcode(code) {
  const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.status === 1 ? fromOff(d.product) : null;
}

export async function searchOff(q) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}&tagtype_0=countries&tag_contains_0=contains&tag_0=sweden`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.products || []).map(fromOff).filter(Boolean);
}

// Leta upp en streckkod: först familjens varor, sedan Open Food Facts.
export async function findBarcode(code) {
  return (await sharedByBarcode(code)) || (await offByBarcode(code).catch(() => null));
}

// ---------- Delning: den andres dag ----------
export async function loadDayOf(owner, day) {
  try {
    const s = await getDocs(query(col(owner, 'foodlog'), where('day', '==', day)));
    return s.docs.map((d) => d.data());
  } catch { return null; }
}

// ---------- Träning ----------

// MET-värden: hur mycket energi aktiviteten tar jämfört med att sitta still.
export const ACTIVITIES = [
  ['walk', 'Promenad', 3.5], ['brisk', 'Rask promenad', 4.3], ['run', 'Löpning', 9.8], ['jog', 'Joggning', 7],
  ['bike', 'Cykling', 7.5], ['gym', 'Styrketräning', 5], ['swim', 'Simning', 6], ['yoga', 'Yoga', 2.5],
  ['dance', 'Dans', 5], ['garden', 'Trädgård', 4], ['clean', 'Städning', 3.3], ['ski', 'Längdskidor', 9],
  ['padel', 'Padel', 6], ['football', 'Fotboll', 7], ['hike', 'Vandring', 6], ['class', 'Gruppträning', 6.5]
];
export const activityKcal = (key, mins, kg) => {
  const a = ACTIVITIES.find((x) => x[0] === key);
  return a ? Math.round(a[2] * kg * mins / 60) : 0;
};

export async function loadWorkouts(u, day) {
  return cached(`wo:${u}:${day}`, 30000, async () => {
    const s = await getDocs(query(col(u, 'workouts'), where('day', '==', day)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at?.toMillis?.() || 0) - (b.at?.toMillis?.() || 0));
  });
}
export async function addWorkout(day, w) {
  forget('wo:');
  await addDoc(col(uid(), 'workouts'), { day, kind: w.kind, act: w.act || '', name: w.name, mins: w.mins || null, kcal: Math.round(w.kcal), at: serverTimestamp() });
}
export async function removeWorkout(id) {
  forget('wo:');
  await deleteDoc(doc(db, 'users', uid(), 'workouts', id));
}

