// Fotoanalys: fota maten, få en uppskattning av kalorier och näring.
// Bilden görs liten i telefonen och skickas till vår server. Den sparas inte.
import { app, db, doc, getDoc } from './firebase.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let cfg = null;
let cfgAt = 0;

// Är fotoanalysen påslagen? (Admin slår på den.)
export async function aiPhotoOn() {
  if (cfg && Date.now() - cfgAt < 5 * 60000) return !!cfg.aiPhoto;
  try {
    const s = await getDoc(doc(db, 'config', 'app'));
    cfg = s.exists() ? s.data() : {};
  } catch { cfg = {}; }
  cfgAt = Date.now();
  return !!cfg.aiPhoto;
}

// Gör bilden mindre (max 1024 px) och till JPEG.
export async function shrinkImage(file, max = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.82);
    return { dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
  } finally { URL.revokeObjectURL(url); }
}

// Skicka bilden till servern. Svar: { isFood, note, items: [{name, grams, liquid, kcal, p, c, f}], left }
export async function analyzeMeal(base64, mime, hint = '') {
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'analyzeMeal', { timeout: 70000 });
  try {
    const res = await fn({ image: base64, mime, hint });
    return res.data;
  } catch (ex) {
    const code = String(ex.code || '').replace('functions/', '');
    const known = ['resource-exhausted', 'failed-precondition', 'invalid-argument', 'unavailable', 'unauthenticated'];
    const e = new Error(known.includes(code) ? ex.message : 'Fotoanalysen fungerar inte just nu. Prova igen senare.');
    e.code = code;
    throw e;
  }
}

// Gör om en rad från AI:n till en "vara" som appen kan logga.
export function aiFood(item) {
  const g = Math.max(1, item.grams);
  const k = 100 / g;
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    src: 'ai',
    ref: 'ai-' + item.name.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-').slice(0, 40),
    name: item.name,
    brand: '',
    liquid: !!item.liquid,
    per100: { kcal: Math.round(item.kcal * k), p: r1(item.p * k), c: r1(item.c * k), f: r1(item.f * k) }
  };
}
