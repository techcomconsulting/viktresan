// Inloggning, nytt konto, glömt lösenord och första uppgifterna.
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, deleteUser
} from '../firebase.js';
import { claimIdentity, saveProfile, acceptTerms, lookupPerson, notify } from '../data.js';
import { readInviter, clearInviter } from '../invite.js';
import { consentBoxes, consentChecked, COMPANY } from './legal.js';
import { esc, errorText, parseNum, isoDay, toast, busy } from '../ui.js';

const brand = `<div class="stack" style="align-items:flex-start;margin:12px 0 8px">
  <img src="icons/icon-192.png" alt="" width="56" height="56" style="border-radius:16px">
  <h1>Viktresan</h1>
  <p class="muted">Din egen resa. Du väljer vad du delar.</p>
</div>`;

export async function loginView(el) {
  el.innerHTML = `<div class="screen no-nav">
    <a class="back" href="#/valkommen">‹ Om Viktresan</a>
    ${brand}
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="em">E-post</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pw">Lösenord</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Logga in</button>
      <a class="btn ghost" href="#/glomt">Glömt lösenord?</a>
    </form>
    <a class="btn outline block" href="#/registrera">Skapa nytt konto</a>
    <p class="small muted" style="text-align:center"><a href="#/villkor">Villkor</a> · <a href="#/integritet">Integritet</a></p>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        await signInWithEmailAndPassword(auth, form.em.value.trim(), form.pw.value);
      } catch (ex) {
        err.textContent = errorText(ex);
        err.classList.remove('hidden');
      }
    });
  });
}

export async function registerView(el, ctx) {
  const inviter = readInviter();
  el.innerHTML = `<div class="screen no-nav">
    <a class="back" href="#/valkommen">‹ Tillbaka</a>
    <h1>Skapa konto</h1>
    ${inviter ? `<div class="banner pink row" style="font-size:15px"><span style="font-size:22px">💜</span><span><b>@${esc(inviter)}</b> har bjudit in dig. Välkommen!</span></div>` : ''}
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="fn">Förnamn</label><input class="input" id="fn" autocomplete="given-name" required></div>
      <div class="field"><label for="un">Användarnamn</label><input class="input" id="un" autocapitalize="none" autocomplete="username" required>
        <span class="hint">Små bokstäver, siffror och _ . Andra hittar dig med det.</span></div>
      <div class="field"><label for="em">E-post</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pw">Lösenord</label><input class="input" id="pw" type="password" autocomplete="new-password" required>
        <span class="hint">Minst 6 tecken.</span></div>
      ${consentBoxes()}
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Skapa konto</button>
    </form>
    <p class="small muted">Allt du sparar är privat. Ingen ser något förrän du själv väljer att dela. Appen görs av ${COMPANY}.</p>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  const show = (t) => { err.textContent = t; err.classList.remove('hidden'); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const firstName = form.fn.value.trim();
    const username = form.un.value.trim().toLowerCase().replace(/^@/, '');
    if (!firstName) return show('Skriv ditt förnamn.');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return show('Användarnamnet ska ha 3–20 tecken: a–z, 0–9 eller _.');
    if (!consentChecked(form)) return show('Kryssa i båda rutorna för att skapa konto.');
    await busy(form.querySelector('[type=submit]'), async () => {
      const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'db-timeout' })), ms));
      try {
        ctx.state.registering = true;
        const cred = await createUserWithEmailAndPassword(auth, form.em.value.trim(), form.pw.value);
        try {
          await Promise.race([claimIdentity(cred.user, firstName, username), timeout(20000)]);
        } catch (ex) {
          ctx.state.registering = false;
          if (ex.code === 'db-timeout') { ctx.state.user = cred.user; return show(errorText(ex)); }
          await deleteUser(cred.user).catch(() => {});
          ctx.state.user = null;
          return show(ex.code === 'taken' ? 'Användarnamnet är upptaget.' : errorText(ex));
        }
        await acceptTerms(cred.user.uid).catch(() => {});
        if (inviter) {
          try {
            const who = await lookupPerson(inviter);
            if (who && who.uid !== cred.user.uid) {
              await saveProfile(cred.user.uid, { invitedBy: who.uid });
              await notify(who.uid, `${firstName} har gått med i Viktresan via din inbjudan! Vill ni dela med varandra?`, '#/delning');
            }
          } catch { /* inte viktigt */ }
          clearInviter();
        }
        ctx.state.registering = false;
        ctx.state.user = cred.user;
        await ctx.startSession(cred.user);
        ctx.go('/start');
      } catch (ex) {
        ctx.state.registering = false;
        show(errorText(ex));
      }
    });
  });
}

export async function forgotView(el) {
  el.innerHTML = `<div class="screen no-nav">
    <a class="back" href="#/login">‹ Logga in</a>
    <h1>Glömt lösenord</h1>
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="em">Din e-post</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Skicka länk</button>
    </form>
  </div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        await sendPasswordResetEmail(auth, form.em.value.trim());
        form.innerHTML = `<p style="font-size:16px;line-height:1.45;margin:0"><b>Mejlet är skickat!</b><br>Kolla din inkorg. Hittar du det inte, titta i <b>skräpposten</b>. Det kan ta några minuter.</p>
          <p class="small muted" style="margin:0">Avsändare: noreply@viktresan-25170.firebaseapp.com</p>
          <a class="btn primary block" href="#/login">Till inloggning</a>`;
      } catch (ex) {
        const er = form.querySelector('.error');
        er.textContent = errorText(ex);
        er.classList.remove('hidden');
      }
    });
  });
}

export async function onboardingView(el, ctx) {
  const { state } = ctx;
  const p = state.profile;
  const needsIdentity = !p;
  const year = new Date().getFullYear();
  el.innerHTML = `<div class="screen no-nav">
    <h1>${p ? `Hej ${esc(p.firstName)}!` : 'Välkommen!'}</h1>
    <p class="muted">Några uppgifter först. Allt är privat.</p>
    <form class="card stack-lg" novalidate>
      ${needsIdentity ? `
        <div class="field"><label for="fn">Förnamn</label><input class="input" id="fn" required></div>
        <div class="field"><label for="un">Användarnamn</label><input class="input" id="un" autocapitalize="none" required></div>` : ''}
      <div class="field"><label for="hc">Längd (cm)</label><input class="input" id="hc" inputmode="numeric" placeholder="t.ex. 175" required>
        <span class="hint">Används för att räkna ut BMI.</span></div>
      <div class="field"><label for="gw">Målvikt (kg)</label><input class="input" id="gw" inputmode="decimal" placeholder="t.ex. 80" required>
        <span class="hint">Du kan ändra den när du vill.</span></div>
      <div class="field"><label for="by">Födelseår</label><input class="input" id="by" inputmode="numeric" placeholder="t.ex. 1985"></div>
      <div class="field"><label for="ge">Kön</label>
        <select class="input" id="ge"><option value="">Välj</option><option>Kvinna</option><option>Man</option><option>Annat</option><option>Vill inte säga</option></select></div>
      <div class="field"><label for="sd">Startdatum</label><input class="input" id="sd" type="date" value="${isoDay(new Date())}"></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Fortsätt till första mätningen</button>
    </form>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  const show = (t) => { err.textContent = t; err.classList.remove('hidden'); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const heightCm = parseNum(form.hc.value);
    const goalWeight = parseNum(form.gw.value);
    const birthYear = parseNum(form.by.value);
    if (!heightCm || heightCm < 100 || heightCm > 250) return show('Skriv din längd i cm, till exempel 175.');
    if (!goalWeight || goalWeight < 30 || goalWeight > 300) return show('Skriv en målvikt i kg.');
    if (birthYear && (birthYear < 1900 || birthYear > year)) return show('Födelseåret ser fel ut.');
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        if (needsIdentity) {
          const firstName = form.fn.value.trim();
          const username = form.un.value.trim().toLowerCase();
          if (!firstName || !/^[a-z0-9_]{3,20}$/.test(username)) return show('Fyll i förnamn och ett användarnamn (a–z, 0–9, _).');
          await claimIdentity(state.user, firstName, username);
        }
        await saveProfile(state.user.uid, {
          heightCm, goalWeight, birthYear: birthYear || null, gender: form.ge.value || null,
          startDate: form.sd.value || isoDay(new Date()), onboarded: true
        });
        await ctx.reloadProfile();
        ctx.go('/matning');
      } catch (ex) {
        show(ex.code === 'taken' ? 'Användarnamnet är upptaget.' : errorText(ex));
      }
    });
  });
}
