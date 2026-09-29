// Notiser inne i appen (inga pushnotiser).
import { loadNotifications, markRead } from '../data.js';
import { esc, icon, backLink, ago } from '../ui.js';

export async function notificationsView(el, ctx) {
  const uid = ctx.state.user.uid;
  const items = await loadNotifications(uid);
  const fresh = items.filter((n) => !n.read);
  const old = items.filter((n) => n.read);
  const row = (n) => `<a class="list-row" href="${esc(n.link || '#/')}">
    <span style="width:40px;height:40px;border-radius:20px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('bell', 20)}</span>
    <span class="grow stack" style="gap:2px"><span style="font-size:15px;line-height:1.35">${esc(n.text)}</span><span class="sub">${esc(ago(n.createdAt))}</span></span>
    ${!n.read ? '<span style="width:9px;height:9px;border-radius:5px;background:var(--pink);flex-shrink:0"></span>' : ''}
  </a>`;

  el.innerHTML = `<div class="screen">
    ${backLink('#/', 'Översikt')}
    <h1>Notiser</h1>
    ${fresh.length ? `<span class="section-title">Nya</span><div class="card flush">${fresh.map(row).join('')}</div>` : ''}
    ${old.length ? `<span class="section-title">Tidigare</span><div class="card flush">${old.map(row).join('')}</div>` : ''}
    ${!items.length ? '<div class="card empty">Inga notiser än.</div>' : ''}
    <p class="small muted" style="text-align:center">Inga pushnotiser. Allt samlas här.</p>
  </div>`;
  markRead(items).catch(() => {});
}
