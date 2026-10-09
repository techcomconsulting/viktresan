// Liten adminsida i appen. Allt annat sköts på admin.viktresan.online.
import { db, doc, getDoc } from '../firebase.js';
import { esc, backLink } from '../ui.js';

export async function adminView(el, ctx) {
  const uid = ctx.state.user.uid;
  let admin = false, count = null;
  try { admin = (await getDoc(doc(db, 'admins', uid))).exists(); } catch { /* ok */ }
  if (admin) { try { const s = await getDoc(doc(db, 'stats', 'users')); count = s.exists() ? s.data().count : 0; } catch { /* ok */ } }
  el.innerHTML = `<div class="screen">
    ${backLink('#/profil', 'Profil')}
    <h1>Admin</h1>
    ${admin ? `<section class="card stack" style="gap:4px"><span class="small muted">Användare i appen</span><b class="num" style="font-size:36px">${count ?? '–'}</b></section>
      <a class="btn primary block" href="https://admin.viktresan.online" target="_blank" rel="noopener">Öppna adminsidan</a>
      <p class="small muted">På adminsidan ser du statistik och hanterar reklamlänkar, kategorier, nyheter, varor och inlägg.</p>`
      : `<div class="card stack"><span class="small muted">Ditt användar-id</span><b style="font-family:monospace;word-break:break-all">${esc(uid)}</b>
        <span class="small muted">Du är inte admin.</span></div>`}
  </div>`;
}
