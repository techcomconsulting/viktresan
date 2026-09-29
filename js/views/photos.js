// Bilder: före och efter, med tidslinje.
import { loadPhotos, addPhoto, deletePhoto, getSummary } from '../data.js';
import { esc, fmt1, signed, icon, dShort, toast, busy, openSheet, confirmSheet, errorText, resizeImage } from '../ui.js';

const KINDS = [['face', 'Ansikte', 'ansiktsbild'], ['body', 'Helkropp', 'helkroppsbild']];

// Bygger stegen START → MÅNAD 1 → ... → NU
export function buildTimeline(list) {
  if (!list.length) return [];
  const start = list[0];
  const last = list[list.length - 1];
  const steps = [{ label: 'START', photo: start, date: start.at }];
  const months = Math.floor((last.at - start.at) / (30.44 * 86400000));
  const count = Math.min(12, Math.max(3, months));
  for (let n = 1; n <= count; n++) {
    const target = new Date(start.at);
    target.setMonth(target.getMonth() + n);
    let best = null, bestDiff = 20 * 86400000;
    for (const ph of list) {
      const diff = Math.abs(ph.at - target);
      if (diff <= bestDiff && ph !== start && ph !== last) { best = ph; bestDiff = diff; }
    }
    steps.push({ label: 'MÅNAD ' + n, photo: best, date: best ? best.at : target });
  }
  steps.push({ label: 'NU', photo: last !== start ? last : null, date: last.at });
  return steps;
}

export function photoImg(ph, alt) {
  return ph ? `<img class="photo" src="${ph.data}" alt="${esc(alt)}">` : `<div class="photo">Ingen bild</div>`;
}

export async function photosView(el, ctx) {
  const uid = ctx.state.user.uid;
  let photos = await loadPhotos(uid);
  let kind = 'face';
  let sel = null;

  const draw = () => {
    const list = photos.filter((p) => p.kind === kind);
    const steps = buildTimeline(list);
    if (sel == null || sel >= steps.length) sel = steps.length - 1;
    if (steps.length && !steps[sel].photo) sel = steps.map((s) => !!s.photo).lastIndexOf(true);
    const kInfo = KINDS.find((k) => k[0] === kind);
    const a = steps[0]?.photo;
    const b = steps[sel]?.photo && steps[sel].photo !== a ? steps[sel].photo : null;
    const diff = a && b && a.weight != null && b.weight != null ? b.weight - a.weight : null;

    el.innerHTML = `<div class="screen">
      <div class="between">
        <h1>Bilder</h1>
        <span class="chip" style="background:#fff;box-shadow:var(--shadow)">${icon('lock', 14, 2)}Privat</span>
      </div>
      <div class="seg" role="group" aria-label="Bildtyp">
        ${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join('')}
      </div>
      ${list.length ? `
        <section class="card stack-lg" style="padding:14px">
          <div class="grid2">
            <div class="stack">${photoImg(a, 'Startbild')}<div><b style="font-size:14px">Start · ${esc(dShort(a.at))}</b><div class="small muted">${a.weight != null ? fmt1(a.weight) + ' kg' : ''}</div></div></div>
            ${b ? `<div class="stack">${photoImg(b, steps[sel].label)}<div><b style="font-size:14px">${esc(steps[sel].label.charAt(0) + steps[sel].label.slice(1).toLowerCase())} · ${esc(dShort(steps[sel].date))}</b><div class="small muted">${b.weight != null ? fmt1(b.weight) + ' kg' : ''}</div></div></div>`
              : `<div class="stack"><div class="photo">Din nästa bild visas här, bredvid startbilden.</div><div><b style="font-size:14px">Nästa bild</b></div></div>`}
          </div>
          ${diff != null ? `<div class="banner soft" style="text-align:center;font-weight:700;padding:8px">${signed(diff, 'kg')} mellan bilderna</div>` : ''}
        </section>
        <section class="card" style="padding:14px 6px 8px">
          <h2 style="margin:0 10px 4px">Tidslinje</h2>
          <div class="timeline"><span class="line"></span>
            ${steps.map((s, i) => `<button type="button" data-step="${i}" aria-pressed="${i === sel}" ${s.photo && i > 0 ? '' : 'disabled'}>
              <span class="dot"></span><span class="tl-label">${s.label}</span><span class="tl-date">${esc(dShort(s.date))}</span></button>`).join('')}
          </div>
        </section>` : `<div class="card empty">Du har inga ${kInfo[2]}er än.<br>Bara du kan se dina bilder.</div>`}
      <label class="btn outline block">${icon('camera', 20)}Lägg till ${kInfo[2]}<input type="file" accept="image/*" class="hidden" data-upload></label>
      ${list.length ? `<section class="stack"><h2>Alla bilder</h2><div class="thumbs">
        ${[...list].reverse().map((p) => `<button type="button" data-open="${p.id}"><img class="photo" src="${p.data}" alt="Bild ${esc(dShort(p.at))}">${esc(dShort(p.at))}</button>`).join('')}
      </div></section>` : ''}
    </div>`;

    el.querySelectorAll('[data-kind]').forEach((x) => x.addEventListener('click', () => { kind = x.dataset.kind; sel = null; draw(); }));
    el.querySelectorAll('[data-step]').forEach((x) => x.addEventListener('click', () => { sel = Number(x.dataset.step); draw(); }));
    el.querySelector('[data-upload]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      toast('Sparar bilden…');
      try {
        const w = await getSummary(uid, 'weight');
        await addPhoto(uid, kind, await resizeImage(f), w?.current ?? null);
        photos = await loadPhotos(uid);
        sel = null;
        toast('Bilden är sparad.');
        draw();
      } catch (ex) { toast(errorText(ex)); }
    });
    el.querySelectorAll('[data-open]').forEach((x) => x.addEventListener('click', () => {
      const ph = photos.find((p) => p.id === x.dataset.open);
      const s = openSheet(`<img src="${ph.data}" alt="" style="width:100%;border-radius:16px">
        <div class="between"><b>${esc(dShort(ph.at))}</b><span class="muted">${ph.weight != null ? fmt1(ph.weight) + ' kg' : ''}</span></div>
        <div class="btn-row"><button class="btn danger-outline" data-del>Ta bort</button><button class="btn" data-close>Stäng</button></div>`, 'Bild');
      s.el.querySelector('[data-del]').addEventListener('click', async (ev) => {
        s.close();
        if (!(await confirmSheet({ title: 'Ta bort bilden?', ok: 'Ta bort', danger: true }))) return;
        try { await deletePhoto(uid, ph.id); photos = photos.filter((p) => p.id !== ph.id); sel = null; draw(); } catch (ex) { toast(errorText(ex)); }
      });
    }));
  };
  draw();
}

export { busy };
