// Tipsa oss: förslag på förbättringar och nya funktioner. Admin läser dem på adminsidan.
import { db, collection, addDoc, serverTimestamp } from './firebase.js';
import { openSheet, toast, busy, errorText } from './ui.js';

const KINDS = [['idea', '💡 Ny idé'], ['better', '✨ Förbättring'], ['bug', '🐞 Fel']];

export function openFeedback(ctx) {
  let kind = 'idea';
  const s = openSheet(`
    <h2>Tipsa oss</h2>
    <p class="muted" style="font-size:15px;margin:0">Har du en idé eller saknar du något? Vi läser allt.</p>
    <div class="pills" role="group" aria-label="Typ av tips">${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join('')}</div>
    <div class="field"><label for="fbt">Ditt tips</label>
      <textarea class="input" id="fbt" maxlength="1000" style="min-height:120px" placeholder="t.ex. Jag vill kunna se min vikt per månad"></textarea></div>
    <p class="error hidden" role="alert">Skriv några ord först.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-send>Skicka</button></div>
    <p class="small muted" style="margin:0;text-align:center">Ditt förnamn skickas med, så vi vet vem som tipsat.</p>`, 'Tipsa oss');
  s.el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    s.el.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  s.el.querySelector('[data-send]').addEventListener('click', async (e) => {
    const text = s.el.querySelector('#fbt').value.trim();
    if (text.length < 3) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    await busy(e.currentTarget, async () => {
      try {
        await addDoc(collection(db, 'feedback'), {
          uid: ctx.state.user.uid, name: String(ctx.state.profile?.firstName || '').slice(0, 40),
          kind, text: text.slice(0, 1000), status: 'new', at: serverTimestamp()
        });
        s.close();
        toast('Tack för tipset! 💜');
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}
