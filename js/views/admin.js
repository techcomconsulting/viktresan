// Kontrollsida för admin: visar ditt id och om du räknas som admin.
import { db, doc, getDoc } from '../firebase.js';
import { esc, icon } from '../ui.js';

export async function adminView(el, ctx) {
  const uid = ctx.state.user.uid;
  const rows = [];
  let adminOk = false;
  try {
    const a = await getDoc(doc(db, 'admins', uid));
    adminOk = a.exists();
    rows.push(['Admin-dokument', a.exists() ? 'Finns ✅' : 'Finns inte ❌']);
  } catch (e) { rows.push(['Admin-dokument', 'Fel: ' + esc(e.code || e.message)]); }
  try {
    const s = await getDoc(doc(db, 'stats', 'users'));
    rows.push(['Användare', s.exists() ? String(s.data().count) : 'Ingen räknare än']);
  } catch (e) { rows.push(['Användare', 'Fel: ' + esc(e.code || e.message)]); }
  el.innerHTML = `<div class="screen no-nav">
    <a class="back" href="#/profil">‹ Profil</a>
    <h1>Admin</h1>
    <section class="card stack">
      <span class="small muted">Ditt användar-id</span>
      <b style="font-family:monospace;font-size:15px;word-break:break-all">${esc(uid)}</b>
    </section>
    <div class="card flush">${rows.map(([k, v]) => `<div class="list-row"><span class="grow">${k}</span><b>${v}</b></div>`).join('')}</div>
    ${adminOk ? '' : `<p class="small muted">Dokumentet i Firebase → Firestore → admins måste heta exakt som ditt id ovan.</p>`}
  </div>`;
}
