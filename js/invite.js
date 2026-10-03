// Bjud in en vän: en länk som man kan skicka via sms, Messenger, WhatsApp m.m.
import { icon, openSheet, toast, esc } from './ui.js';

const APP_URL = 'https://techcomconsulting.github.io/viktresan/';
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
