// Översikt: den enkla startsidan.
import { loadEntries, loadFeed, getCard } from '../data.js';
const withWeight = (list) => list.filter((e) => e.weight != null);
import { installBanner, wireInstallBanner } from '../install.js';
import { loadDay, dayTotals } from '../food.js';
import { maybeShowNews } from './kost.js';
import { isoDay } from '../ui.js';
import { esc, fmt1, signed, icon, bmi, bmiScale, dDay, dShort, round1, avatar } from '../ui.js';

export function progressInfo(start, goal, current) {
  if (start == null || goal == null || current == null || start === goal) return null;
  const total = start - goal;
  const done = start - current;
  const pct = Math.max(0, Math.min(1, done / total));
  const miles = [0.25, 0.5, 0.75, 1].map((m) => ({ m, weight: round1(start - total * m), done: pct >= m }));
  const next = miles.find((x) => !x.done) || null;
  return { total: Math.abs(total), done, pct, miles, next, left: Math.max(0, total > 0 ? current - goal : goal - current) };
}

export function motivation(all, start) {
  const entries = withWeight(all);
  if (!entries.length) return 'Välkommen! Gör din första mätning så har du en startpunkt.';
  const last = entries[entries.length - 1];
  const lost = round1(start - last.weight);
  const pct = start ? round1((lost / start) * 100) : 0;
  if (entries.length === 1) return '<strong>Bra start!</strong> Nu har du en utgångspunkt att jämföra med.';
  if (lost > 0) return `<strong>Bra jobbat!</strong> Du är ${fmt1(lost)} kg lättare än när du började. Det är ${fmt1(pct)} % av din startvikt.`;
  return '<strong>Fortsätt så.</strong> Vikten går upp och ner. Det viktiga är riktningen över tid.';
}

function latestPost(p, card) {
  const name = card?.firstName || p.ownerName || '';
  let text = p.text || '';
  if (!text && p.pLast != null) text = `${signed(p.pLast, '%')} sedan förra vägningen`;
  if (!text && p.pct != null) text = `${signed(p.pct, '%')} totalt`;
  if (!text && p.dWeight != null) text = `${signed(p.dWeight, 'kg')} sedan förra mätningen`;
  if (text.length > 70) text = text.slice(0, 68) + '…';
  return `<a class="card row" href="#/flode" style="text-decoration:none;color:inherit;padding:12px 14px">
    ${avatar(name, card?.avatar, 36)}
    <span class="grow stack" style="gap:2px"><span class="small muted">Senaste från ${esc(name)} · ${esc(dShort(p.createdAt))}</span><span style="font-size:15px;line-height:1.35">${esc(text)}</span></span>
    ${icon('right', 18, 2)}</a>`;
}

export async function overviewView(el, ctx) {
  const { state } = ctx;
  const uid = state.user.uid;
  const p = state.profile;
  const [entries, feed, food] = await Promise.all([loadEntries(uid), loadFeed(uid, 1).catch(() => []), loadDay(uid, isoDay(new Date())).catch(() => [])]);
  const FT = dayTotals(food);
  const kGoal = p.kcalGoal || null;
  const kostCard = `<a class="card row" href="#/kost" style="text-decoration:none;color:inherit;padding:14px 16px">
    <span style="width:44px;height:44px;border-radius:14px;background:var(--pink-soft);color:var(--pink);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('food', 22)}</span>
    <span class="grow stack" style="gap:2px"><span class="small muted" style="font-weight:600">Kost idag</span>
      <span style="font-size:17px;font-weight:700" class="num">${food.length ? `${Math.round(FT.kcal).toLocaleString('sv-SE')}${kGoal ? ' av ' + kGoal.toLocaleString('sv-SE') : ''} kcal` : 'Inget registrerat än'}</span>
      ${food.length ? `<span class="small muted">${fmt1(FT.p)} g protein</span>` : ''}</span>
    ${icon('right', 18, 2)}</a>`;
  setTimeout(() => maybeShowNews(ctx), 600);
  const latest = feed[0] || null;
  const latestCard = latest ? await getCard(latest.owner) : null;
  const wEntries = withWeight(entries);
  const last = wEntries[wEntries.length - 1];
  const prev = wEntries[wEntries.length - 2];
  const start = p.startWeight ?? wEntries[0]?.weight;

  const header = `<header class="between">
    <div class="stack" style="gap:2px">
      <span class="muted" style="font-size:14px;font-weight:500">${esc(dDay(new Date()))}</span>
      <h1>Hej ${esc(p.firstName)}</h1>
    </div>
    <a href="#/notiser" class="icon-btn" aria-label="Notiser">${icon('bell')}<span class="badge js-unread hidden"></span></a>
  </header>`;

  if (!last) {
    el.innerHTML = `<div class="screen">${header}
      ${installBanner()}
      ${kostCard}
      <div class="card stack-lg">
        <h2>${entries.length ? 'Lägg in din vikt' : 'Dags för första mätningen'}</h2>
        <p class="muted">${entries.length ? 'Dina mått är sparade. Lägg in vikten nästa gång, så ser du dina framsteg här.' : 'Fyll i det du vill: vikt, arm, midja, lår eller höft.'}</p>
        <a class="btn primary block" href="#/matning">${entries.length ? 'Ny mätning' : 'Gör första mätningen'}</a>
      </div></div>`;
    wireInstallBanner(el);
    return;
  }

  const delta = prev ? last.weight - prev.weight : null;
  const total = last.weight - start;
  const pr = progressInfo(start, p.goalWeight, last.weight);
  const b = bmi(last.weight, p.heightCm);

  el.innerHTML = `<div class="screen">
    ${header}
    <section class="card stack-lg">
      <div class="between" style="align-items:flex-start">
        <div class="stack" style="gap:6px">
          <span class="muted" style="font-size:14px;font-weight:600">Aktuell vikt</span>
          <div class="row" style="gap:6px;align-items:baseline"><span class="big num">${fmt1(last.weight)}</span><span style="font-size:20px;font-weight:600" class="muted">kg</span></div>
        </div>
        ${delta != null ? `<div class="stack" style="align-items:flex-end;gap:4px">
          <span class="chip ${delta <= 0 ? 'good' : 'neutral'}">${signed(delta, 'kg')}</span>
          <span class="small muted">sedan ${esc(dShort(prev.at))}</span></div>` : ''}
      </div>
      ${pr ? `<div class="divider"></div>
      <div class="stack" style="gap:10px">
        <div class="between"><span style="font-size:15px;font-weight:600">Mot målvikt ${fmt1(p.goalWeight)} kg</span><span style="font-size:18px;font-weight:700;color:var(--accent)">${Math.round(pr.pct * 100)} %</span></div>
        <div class="progress" role="progressbar" aria-valuenow="${Math.round(pr.pct * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Framsteg mot målvikt">
          <span style="width:${pr.pct * 100}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i>
        </div>
        <div class="between small muted"><span>${fmt1(Math.max(0, pr.done))} av ${fmt1(pr.total)} kg</span><span style="font-weight:600;color:var(--ink)">${fmt1(pr.left)} kg kvar</span></div>
        ${pr.next ? `<div class="small">Nästa delmål: ${Math.round(pr.next.m * 100)} % vid ${fmt1(pr.next.weight)} kg</div>` : '<div class="small"><b>Du har nått ditt mål!</b></div>'}
      </div>` : ''}
    </section>
    <div class="banner soft">${motivation(entries, start)}</div>
    <div class="grid2">
      <a class="stat" href="#/historik">
        <span class="label">BMI</span>
        ${b ? `<span class="value num">${fmt1(b)}</span>${bmiScale(b)}<span class="small muted">Ett informationsmått, inte ett betyg.</span>`
          : `<span class="small muted">Ange din längd i profilen.</span>`}
      </a>
      <a class="stat" href="#/historik">
        <span class="label">Sedan start</span>
        <span class="value num" style="color:${total <= 0 ? 'var(--accent)' : 'var(--ink)'}">${signed(total, 'kg')}</span>
        <span class="small muted">${start ? signed((total / start) * 100, '%') : ''} sedan ${esc(dShort(wEntries[0].at))}</span>
      </a>
    </div>
    ${kostCard}
    <a class="btn outline block" href="#/historik">${icon('chart', 20)}Historik och grafer</a>
    ${latest ? latestPost(latest, latestCard) : ''}
    ${installBanner()}
  </div>`;
  wireInstallBanner(el);
}
