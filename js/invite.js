// Bjud in en vän: en länk som man kan skicka via sms, Messenger, WhatsApp m.m.
import { icon, openSheet, toast, esc } from './ui.js';

const APP_URL = 'https://viktresan.online/';
const KEY = 'vt-invited-by';

export function inviteLink(username) {
  return `${APP_URL}#/registrera?av=${encodeURIComponent(username || '')}`;
}

export function inviteText(firstName) {
  return `Hej! Jag använder Viktresan för att följa min resa. Gå med du också, så kan vi peppa varandra 💪`;
}

// Vem bjöd in mig? Sparas så att det inte försvinner om man läser villkoren först.
export function readInviter() {
  const m = location.hash.match(/[?&]av=([a-z0-9_]{3,20})/i);
  try {
    if (m) localStorage.setItem(KEY, m[1].toLowerCase());
    return localStorage.getItem(KEY);
  } catch { return m ? m[1].toLowerCase() : null; }
}
export function clearInviter() { try { localStorage.removeItem(KEY); } catch { /* ok */ } }

// Länkar för att dela på sociala medier. Instagram och TikTok saknar dela-länkar,
// där fungerar "Skicka länken" (telefonens egen dela-meny) i stället.
export function socialLinks(link, text) {
  const u = encodeURIComponent(link);
  const t = encodeURIComponent(text);
  const tl = encodeURIComponent(text + ' ' + link);
  const mobile = /iphone|ipad|android/i.test(navigator.userAgent || '');
  return [
    ['Facebook', '#1877F2', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['WhatsApp', '#25D366', `https://wa.me/?text=${tl}`],
    ...(mobile ? [['Messenger', '#0084FF', `fb-messenger://share/?link=${u}`]] : []),
    ['X', '#1B1D1C', `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ['LinkedIn', '#0A66C2', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['E-post', '#7B5EA7', `mailto:?subject=${encodeURIComponent('Följ med på Viktresan')}&body=${tl}`]
  ];
}

export const socialButtons = (link, text) => `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
  ${socialLinks(link, text).map(([name, color, href]) => `<a href="${href}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:16px;border:1px solid var(--field-line);background:#fff;text-decoration:none;color:var(--ink);font-size:13px;font-weight:600">
    <span style="width:36px;height:36px;border-radius:18px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">${name === 'E-post' ? '@' : name[0]}</span>${name}</a>`).join('')}
</div>`;

export function openInviteFriend(ctx) {
  const p = ctx.state.profile || {};
  const link = inviteLink(p.username);
  const text = inviteText(p.firstName);
  const canShare = !!navigator.share;
  const s = openSheet(`
    <div style="font-size:40px;line-height:1">💜</div>
    <h2 style="font-size:24px">Bjud in en vän</h2>
    <p style="font-size:16px;line-height:1.45;margin:0">Det är lättare att gå ner i vikt tillsammans. Skicka länken till någon du vill peppa.</p>
    <p class="small muted" style="margin:0">När din vän har gått med får du en notis. Sedan väljer ni själva vad ni delar.</p>
    ${canShare ? `<button class="btn primary block" data-share>${icon('send', 20)}Skicka länken</button>` : ''}
    <a class="btn ${canShare ? 'outline' : 'primary'} block" href="sms:?&body=${encodeURIComponent(text + ' ' + link)}">${icon('comment', 20)}Skicka som sms</a>
    <button class="btn outline block" data-copy>${icon('copy', 20)}Kopiera länken</button>
    <span style="font-size:14px;font-weight:600;margin-top:4px">Dela på sociala medier</span>
    ${socialButtons(link, text)}
    <p class="small muted" style="margin:0">Instagram eller TikTok? Tryck på <b>Skicka länken</b> och välj appen där.</p>
    <button class="btn ghost block" data-close>Stäng</button>`, 'Bjud in en vän');
  s.el.querySelector('[data-share]')?.addEventListener('click', async () => {
    try { await navigator.share({ title: 'Viktresan', text, url: link }); } catch { /* avbrutet */ }
  });
  s.el.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${text} ${link}`); toast('Länken är kopierad.'); } catch {
      openSheet(`<h2>Kopiera länken</h2><textarea class="input" readonly style="min-height:90px;font-size:14px">${esc(link)}</textarea><button class="btn block" data-close>Stäng</button>`, 'Kopiera');
    }
  });
}
