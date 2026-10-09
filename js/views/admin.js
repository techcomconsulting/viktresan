// Adminsida: antal användare och reklamlänkar. Syns bara för den som finns i samlingen "admins".
import { db, doc, getDoc, getDocs, collection } from '../firebase.js';
import { TIP_CATS, loadTips, saveTip, removeTip, validUrl } from '../tips.js';
import { esc, icon, backLink, openSheet, confirmSheet, toast, busy, errorText } from '../ui.js';

const weekStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function bars(weeks) {
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const W = 320, H = 110, bw = W / weeks.length;
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto" role="img" aria-label="Nya användare per vecka">
    ${weeks.map((w, i) => {
      const h = Math.round((w.n / max) * (H - 14));
      return `<rect x="${i * bw + 3}" y="${H - h}" width="${bw - 6}" height="${Math.max(h, 1)}" rx="3" fill="${i === weeks.length - 1 ? '#7B5EA7' : '#CDBFE3'}"/>
        ${w.n ? `<text x="${i * bw + bw / 2}" y="${H - h - 3}" text-anchor="middle" font-size="9" fill="#63675F">${w.n}</text>` : ''}
        ${i % 2 === weeks.length % 2 ? '' : `<text x="${i * bw + bw / 2}" y="${H + 13}" text-anchor="middle" font-size="9" fill="#63675F">v${w.label}</text>`}`;
    }).join('')}
  </svg>`;
}
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };

export async function adminView(el, ctx) {
  const uid = ctx.state.user.uid;
  let admin = false, err = '';
  try { admin = (await getDoc(doc(db, 'admins', uid))).exists(); } catch (e) { err = e.code || e.message; }
  if (!admin) {
    el.innerHTML = `<div class="screen">${backLink('#/profil', 'Profil')}<h1>Admin</h1>
      <div class="card stack"><span class="small muted">Ditt användar-id</span><b style="font-family:monospace;word-break:break-all">${esc(uid)}</b></div>
      <div class="card">${err ? 'Fel: ' + esc(err) : 'Du är inte admin. Lägg in ditt id i Firebase → Firestore → <b>admins</b>.'}</div></div>`;
    return;
  }

  const draw = async () => {
    // Användare
    let count = null, members = [];
    try { const s = await getDoc(doc(db, 'stats', 'users')); count = s.exists() ? s.data().count : 0; } catch { /* ok */ }
    try { members = (await getDocs(collection(db, 'stats', 'users', 'members'))).docs.map((d) => d.data().at?.toDate?.()).filter(Boolean); } catch { /* reglerna kanske inte publicerade */ }
    const now = Date.now();
    const n7 = members.filter((d) => now - d < 7 * 86400000).length;
    const n30 = members.filter((d) => now - d < 30 * 86400000).length;
    const w0 = weekStart(new Date());
    const weeks = Array.from({ length: 12 }, (_, i) => { const s = new Date(w0.getTime() - (11 - i) * 7 * 86400000); return { s, label: isoWeek(s), n: 0 }; });
    members.forEach((d) => { const w = weeks.find((x, i) => d >= x.s && (i === 11 || d < weeks[i + 1].s)); if (w) w.n++; });

    // Reklamlänkar och klick
    const tips = await loadTips();
    let clicks = {};
    try { clicks = Object.fromEntries((await getDocs(collection(db, 'tipClicks'))).docs.map((d) => [d.id, d.data().count || 0])); } catch { /* ok */ }
    const totalClicks = Object.values(clicks).reduce((a, b) => a + b, 0);
    const catName = (k) => (TIP_CATS.find((c) => c[0] === k) || [, 'Övrigt'])[1];

    el.innerHTML = `<div class="screen">
      ${backLink('#/profil', 'Profil')}
      <div class="between"><h1>Admin</h1><span class="chip good">Bara du ser detta</span></div>

      <section class="stack"><h2>Användare</h2>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${[['Totalt', count], ['Senaste 7 dagarna', members.length ? n7 : '–'], ['Senaste 30 dagarna', members.length ? n30 : '–']].map(([l, v]) => `
            <div class="card stack" style="gap:2px;padding:12px"><span class="small muted" style="font-size:12px">${l}</span><b class="num" style="font-size:28px">${v ?? '–'}</b></div>`).join('')}
        </div>
        ${members.length ? `<div class="card stack" style="gap:6px"><span class="small muted" style="font-weight:600">Nya användare per vecka</span>${bars(weeks)}</div>` : ''}
        <p class="small muted">Bara antal. Appen visar aldrig vilka som har konto.</p>
      </section>

      <section class="stack"><div class="between"><h2>Reklamlänkar</h2><button class="btn outline sm" data-new>${icon('plus', 18, 2.2)}Ny länk</button></div>
        <p class="small muted">Klistra in länken från Adtraction, Awin eller Partner-ads. Den måste börja med https://. Totalt ${totalClicks} klick.</p>
        <div class="card flush">
          ${tips.map((t) => `<button class="list-row" data-edit="${esc(t.id)}" style="align-items:flex-start">
            <span class="grow stack" style="gap:2px"><span class="title">${esc(t.title)}</span>
              <span class="sub">${esc(catName(t.cat))}${t.store ? ' · ' + esc(t.store) : ''} · ${clicks[t.id] || 0} klick</span></span>
            <span class="chip ${t.url && t.visible !== false ? 'good' : 'neutral'}" style="font-size:11px">${!t.url ? 'Länk saknas' : t.visible === false ? 'Dold' : 'Visas'}</span></button>`).join('')}
        </div>
        <a class="btn outline block" href="#/tips">Se sidan Tips och prylar</a>
      </section>

      <details class="card"><summary style="cursor:pointer;font-weight:600">Teknik</summary>
        <p class="small muted" style="margin-top:8px">Ditt användar-id:</p><p style="font-family:monospace;font-size:13px;word-break:break-all">${esc(uid)}</p></details>
    </div>`;

    el.querySelector('[data-new]').addEventListener('click', () => editTip(null));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editTip(tips.find((t) => t.id === b.dataset.edit))));
  };

  const editTip = (t) => {
    const x = t || { cat: 'mata', title: '', why: '', store: '', url: '', visible: true };
    const s = openSheet(`
      <h2>${t ? 'Ändra reklamlänk' : 'Ny reklamlänk'}</h2>
      <div class="field"><label for="tt">Rubrik</label><input class="input" id="tt" maxlength="60" value="${esc(x.title)}" placeholder="t.ex. Personvåg"></div>
      <div class="field"><label for="tc">Kategori</label><select class="input" id="tc">${TIP_CATS.map(([k, l]) => `<option value="${k}" ${k === x.cat ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="tw">Varför är den bra?</label><textarea class="input" id="tw" maxlength="200" style="min-height:80px">${esc(x.why)}</textarea></div>
      <div class="field"><label for="ts">Butik (valfritt)</label><input class="input" id="ts" maxlength="40" value="${esc(x.store)}" placeholder="t.ex. Clas Ohlson"></div>
      <div class="field"><label for="tu">Länk</label><input class="input" id="tu" inputmode="url" autocapitalize="none" value="${esc(x.url)}" placeholder="https://..."></div>
      <label class="check"><input type="checkbox" id="tv" ${x.visible !== false ? 'checked' : ''}> Visa för användarna</label>
      <p class="small muted">Inga bantningspiller eller produkter som lovar snabb viktnedgång.</p>
      <p class="error hidden" role="alert"></p>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>
      ${t ? '<button class="btn ghost block" data-del style="color:var(--danger)">Ta bort</button>' : ''}`, 'Reklamlänk');
    const err = s.el.querySelector('.error');
    s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const v = (id) => s.el.querySelector('#' + id).value.trim();
      const url = v('tu');
      if (!v('tt')) { err.textContent = 'Skriv en rubrik.'; err.classList.remove('hidden'); return; }
      if (url && !validUrl(url)) { err.textContent = 'Länken måste börja med https://'; err.classList.remove('hidden'); return; }
      await busy(e.currentTarget, async () => {
        try {
          await saveTip({ id: t?.id, cat: v('tc'), title: v('tt'), why: v('tw'), store: v('ts'), url, visible: s.el.querySelector('#tv').checked });
          s.close(); toast('Sparat.'); draw();
        } catch (ex) { toast(errorText(ex)); }
      });
    });
    s.el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmSheet({ title: 'Ta bort länken?', ok: 'Ta bort', danger: true }))) return;
      try { await removeTip(t.id); s.close(); toast('Borttagen.'); draw(); } catch (ex) { toast(errorText(ex)); }
    });
  };

  await draw();
}
