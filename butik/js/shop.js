// Viktresan – hemsida och butik (viktresan.online/butik)
import { loadProducts, loadSettings } from './data.js';
import { termsView, privacyView, contactView } from './pages.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => `${Math.round(n).toLocaleString('sv-SE')} kr`;
let toastT;
export function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }

// ---------- Varukorg (sparas i webbläsaren) ----------
const CART_KEY = 'vt-shop-cart';
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { cart = []; }
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ok */ } updateCount(); };
const cartQty = () => cart.reduce((n, l) => n + l.qty, 0);
function updateCount() {
  const el = document.querySelector('[data-count]');
  const n = cartQty();
  el.textContent = n; el.classList.toggle('hidden', !n);
}
function addToCart(p, qty = 1) {
  const l = cart.find((x) => x.id === p.id);
  if (l) l.qty = Math.min(20, l.qty + qty); else cart.push({ id: p.id, qty });
  saveCart();
}

const productCard = (p) => {
  const sale = p.comparePrice && p.comparePrice > p.price;
  return `<a class="pcard" href="#/produkt/${encodeURIComponent(p.id)}">
    <div class="pimg">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.title)}" loading="lazy">` : ''}
      ${sale ? `<span class="badge">−${Math.round((1 - p.price / p.comparePrice) * 100)} %</span>` : p.badge ? `<span class="badge soft">${esc(p.badge)}</span>` : ''}</div>
    <div class="pinfo"><span class="ttl">${esc(p.title)}</span>
      <div class="price"><b class="${sale ? 'sale' : ''}">${kr(p.price)}</b>${sale ? `<s>${kr(p.comparePrice)}</s>` : ''}</div></div>
  </a>`;
};

// ---------- Startsidan ----------
async function homeView() {
  const [products, s] = await Promise.all([loadProducts().catch(() => []), loadSettings()]);
  const top = products.slice(0, 4);
  app.innerHTML = `
    <section class="hero">
      <div>
        <h1>Din resa mot en <em>lättare vardag</em></h1>
        <p>Viktresan är en gratis app för vikt, mått, kost och träning. Dela resan med familj och vänner – och peppa varandra hela vägen.</p>
        <div class="hero-btns"><a class="btn primary" href="/">Öppna appen gratis</a><a class="btn" href="#/butik">Till butiken</a></div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="phone"><span class="muted small" style="font-weight:600">Sedan start</span><span class="ph-big">−6,4 kg</span><span class="ph-chip">−0,8 kg sedan förra</span>
          <span class="muted small" style="font-weight:600;margin-top:6px">Mot målet</span><div class="ph-bar"><i></i></div>
          <svg viewBox="0 0 200 70" style="margin-top:auto"><path d="M5 15 C40 18 50 30 80 34 S130 44 150 52 195 60 195 60" fill="none" stroke="#7B5EA7" stroke-width="4" stroke-linecap="round"/></svg></div>
        <div class="float-card" style="top:12%;left:6%">🏅 Nytt märke!</div>
        <div class="float-card" style="bottom:14%;right:6%">💜 Anna peppade dig</div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Allt i en app</h2></div>
      <div class="features">
        <div class="feature"><span class="ic">⚖️</span><b>Vikt och mått</b><span class="muted small">Se din resa i grafer och procent.</span></div>
        <div class="feature"><span class="ic">🥗</span><b>Kost och träning</b><span class="muted small">Skanna maten och räkna kalorier.</span></div>
        <div class="feature"><span class="ic">🩺</span><b>Blodvärden</b><span class="muted small">Rapport till vården med ett tryck.</span></div>
        <div class="feature"><span class="ic">👨‍👩‍👧</span><b>Tillsammans</b><span class="muted small">Dela privat och peppa varandra.</span></div>
      </div>
    </section>

    ${top.length ? `<section class="section">
      <div class="section-head"><h2>Populärt i butiken</h2><a href="#/butik" style="font-weight:700">Se alla ›</a></div>
      <div class="grid">${top.map(productCard).join('')}</div>
    </section>` : ''}

    <section class="banner-app">
      <div><h2>Kom igång idag – helt gratis</h2><p>Fungerar på iPhone och Android. Ingen app-butik behövs.</p></div>
      <a class="btn" href="/">Skapa konto</a>
    </section>
    ${s.freeShippingOver ? `<p class="muted small" style="text-align:center;margin-top:22px">Fri frakt när du handlar för minst ${kr(s.freeShippingOver)}.</p>` : ''}`;
}

// ---------- Butiken ----------
async function shopView(cat) {
  const [products, s] = await Promise.all([loadProducts(), loadSettings()]);
  const cats = (s.categories || []).filter((c) => products.some((p) => p.category === c.id));
  const list = cat ? products.filter((p) => p.category === cat) : products;
  app.innerHTML = `
    <div class="section-head" style="margin-top:6px"><h2 style="font-size:32px">Butiken</h2><span class="muted small">${products.length} produkter</span></div>
    ${s.notice ? `<div class="notice" style="margin-bottom:14px">${esc(s.notice)}</div>` : ''}
    ${cats.length ? `<div class="pills" role="group" aria-label="Kategorier">
      <a class="pill" href="#/butik" aria-pressed="${!cat}">Allt</a>
      ${cats.map((c) => `<a class="pill" href="#/butik/${encodeURIComponent(c.id)}" aria-pressed="${c.id === cat}">${esc(c.emoji || '')} ${esc(c.name)}</a>`).join('')}</div>` : ''}
    ${list.length ? `<div class="grid">${list.map(productCard).join('')}</div>`
      : `<div class="empty" style="margin-top:16px"><div style="font-size:40px">🛍️</div><p style="margin-top:8px"><b>Butiken öppnar snart!</b></p><p class="small">Vi väljer ut produkter just nu. Titta in igen om några dagar.</p></div>`}`;
}

// ---------- Produkt ----------
async function productView(id) {
  const products = await loadProducts();
  const p = products.find((x) => x.id === id);
  if (!p) { app.innerHTML = `<a class="back" href="#/butik">‹ Butiken</a><div class="empty">Produkten finns inte längre.</div>`; return; }
  const imgs = p.images?.length ? p.images : [''];
  let sel = 0, qty = 1;
  const sale = p.comparePrice && p.comparePrice > p.price;
  document.title = `${p.title} – Viktresan`;
  const draw = () => {
    app.innerHTML = `<a class="back" href="#/butik">‹ Butiken</a>
    <div class="pd">
      <div><div class="gallery-main">${imgs[sel] ? `<img src="${esc(imgs[sel])}" alt="${esc(p.title)}">` : ''}</div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button data-img="${i}" aria-pressed="${i === sel}" aria-label="Bild ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}</div>
      <div class="stack">
        ${p.badge ? `<span class="badge soft" style="position:static;align-self:flex-start">${esc(p.badge)}</span>` : ''}
        <h1>${esc(p.title)}</h1>
        <div class="price" style="padding:0"><b class="${sale ? 'sale' : ''}">${kr(p.price)}</b>${sale ? `<s>${kr(p.comparePrice)}</s>` : ''}<span class="muted small">inkl. moms</span></div>
        <p class="desc">${esc(p.description || '')}</p>
        <div class="row" style="flex-wrap:wrap">
          <div class="qty"><button data-q="-1" aria-label="Färre">−</button><span>${qty}</span><button data-q="1" aria-label="Fler">+</button></div>
          <button class="btn primary" data-add style="flex:1;min-width:200px">Lägg i varukorgen</button>
        </div>
        <div class="trust">
          <div>🚚 <span>Leverans ${esc(p.delivery || '5–10 arbetsdagar')}</span></div>
          <div>↩️ <span>14 dagars ångerrätt</span></div>
          <div>🔒 <span>Säker betalning</span></div>
          <div>💬 <span>Svensk kundtjänst</span></div>
        </div>
      </div>
    </div>`;
    app.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => { sel = Number(b.dataset.img); draw(); }));
    app.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { qty = Math.max(1, Math.min(20, qty + Number(b.dataset.q))); draw(); }));
    app.querySelector('[data-add]').addEventListener('click', () => { addToCart(p, qty); openCart(); });
  };
  draw();
}

// ---------- Varukorgen ----------
async function openCart() {
  const [products, s] = await Promise.all([loadProducts().catch(() => []), loadSettings()]);
  document.querySelector('.backdrop')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'backdrop';
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  const draw = () => {
    cart = cart.filter((l) => products.some((p) => p.id === l.id));
    const lines = cart.map((l) => ({ ...l, p: products.find((p) => p.id === l.id) }));
    const sub = lines.reduce((t, l) => t + l.p.price * l.qty, 0);
    const ship = !lines.length ? 0 : sub >= (s.freeShippingOver || Infinity) ? 0 : s.shippingPrice || 0;
    const left = s.freeShippingOver ? s.freeShippingOver - sub : 0;
    wrap.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="Varukorg">
      <div class="drawer-head"><h2 style="font-size:22px">Varukorgen</h2><button class="x" data-x aria-label="Stäng">×</button></div>
      <div class="drawer-body">
        ${lines.length ? lines.map((l) => `<div class="line">${l.p.images?.[0] ? `<img src="${esc(l.p.images[0])}" alt="">` : '<img alt="">'}
          <div class="grow"><b style="font-size:15px">${esc(l.p.title)}</b><div class="muted small">${kr(l.p.price)} st</div>
            <div class="row" style="margin-top:6px"><div class="qty"><button data-dq="${l.id}" data-d="-1" aria-label="Färre">−</button><span>${l.qty}</span><button data-dq="${l.id}" data-d="1" aria-label="Fler">+</button></div></div></div>
          <b>${kr(l.p.price * l.qty)}</b></div>`).join('')
        : '<div class="empty"><div style="font-size:36px">🛒</div><p style="margin-top:6px">Varukorgen är tom.</p></div>'}
        ${lines.length && left > 0 ? `<div class="notice small">Handla för ${kr(left)} till, så får du fri frakt!</div>` : ''}
      </div>
      ${lines.length ? `<div class="drawer-foot">
        <div class="sum"><span>Delsumma</span><span>${kr(sub)}</span></div>
        <div class="sum"><span>Frakt</span><span>${ship ? kr(ship) : 'Fri frakt'}</span></div>
        <div class="sum total"><span>Totalt</span><span>${kr(sub + ship)}</span></div>
        <span class="muted small">Varav moms ${kr((sub + ship) * 0.2)}</span>
        <button class="btn primary block" data-checkout>Till kassan</button>
      </div>` : ''}
    </aside>`;
    wrap.querySelector('[data-x]').onclick = close;
    wrap.querySelectorAll('[data-dq]').forEach((b) => b.addEventListener('click', () => {
      const l = cart.find((x) => x.id === b.dataset.dq);
      l.qty += Number(b.dataset.d);
      if (l.qty <= 0) cart = cart.filter((x) => x !== l);
      saveCart(); draw();
    }));
    wrap.querySelector('[data-checkout]')?.addEventListener('click', () => checkout(s));
  };
  draw();
}

function checkout(s) {
  const m = document.createElement('div');
  m.className = 'modal-wrap';
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div style="font-size:44px">🔒</div>
    <h2>Kassan öppnar snart</h2>
    <p class="muted">${s.open ? 'Betalningen startar…' : 'Vi kopplar in säker kortbetalning just nu. Dina varor ligger kvar i varukorgen tills dess.'}</p>
    <button class="btn primary block" data-ok>Okej</button></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-ok]')) m.remove(); });
}

// ---------- Vägvisning ----------
async function route() {
  const [h, anchor] = location.hash.replace(/^#\/?/, '').split('#');
  const [page, arg] = h.split('/').map(decodeURIComponent);
  document.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
  document.querySelector(`[data-nav="${page === 'butik' || page === 'produkt' ? 'shop' : page ? '' : 'home'}"]`)?.setAttribute('aria-current', 'page');
  document.title = 'Viktresan – appen och butiken för en lättare vardag';
  try {
    if (page === 'butik') await shopView(arg);
    else if (page === 'produkt') await productView(arg);
    else if (page === 'villkor') termsView(app);
    else if (page === 'integritet') privacyView(app);
    else if (page === 'kontakt') contactView(app);
    else await homeView();
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="empty">Något gick fel. Kontrollera internet och försök igen.</div>';
  }
  const a = anchor && document.getElementById(anchor);
  if (a) a.scrollIntoView({ behavior: 'smooth' }); else window.scrollTo(0, 0);
}
document.querySelector('[data-opencart]').addEventListener('click', openCart);
window.addEventListener('hashchange', route);
updateCount();
route();
