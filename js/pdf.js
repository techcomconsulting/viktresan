// Skapar rapporten som en riktig PDF-fil (fungerar även när appen ligger på hemskärmen på iPhone).
// Använder jsPDF som ligger i js/vendor. Allt ritas som text och linjer, så det blir skarpt.
import { BLOOD, bloodStatus, bloodInfo } from './blood.js';
import { PERIODS } from './report.js';
import { fmt1, bmi, dFull } from './ui.js';

let loading = null;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/jspdf.umd.min.js';
      s.onload = () => (window.jspdf ? resolve(window.jspdf.jsPDF) : reject(new Error('pdf')));
      s.onerror = () => { loading = null; reject(Object.assign(new Error('pdf'), { code: 'pdf-load' })); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// Standardtypsnittet klarar inte alla tecken.
const T = (s) => String(s ?? '').replace(/[−–—]/g, '-').replace(/[“”]/g, '"').replace(/ /g, ' ');
const sgn = (n, unit) => (n == null || isNaN(n) ? '-' : (n > 0 ? '+' : n < 0 ? '-' : '±') + fmt1(Math.abs(n)) + (unit ? ' ' + unit : ''));
const dt = (s) => { const [y, m, d] = s.split('-'); return `${Number(d)}/${Number(m)} ${y}`; };
const bv = (key, v) => (v == null ? '-' : bloodInfo(key)[6] ? fmt1(v) : String(Math.round(v)));
const rangeTxt = (b) => {
  const f = (x) => (b[6] ? fmt1(x) : String(x));
  if (b[4] != null && b[5] != null) return `${f(b[4])}-${f(b[5])}`;
  if (b[5] != null) return `under ${f(b[5])}`;
  return `över ${f(b[4])}`;
};
const lastOf = (rows, key) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return rows[i]; return null; };
const firstOf = (rows, key) => rows.find((r) => r[key] != null) || null;

const C = {
  ink: [27, 29, 28], muted: [99, 103, 95], line: [230, 226, 220], accent: [123, 94, 167], accentInk: [62, 42, 92],
  soft: [242, 237, 249], pink: [201, 76, 126], pinkSoft: [252, 238, 244], pinkInk: [138, 46, 85], waistFill: [252, 238, 244], wFill: [243, 238, 250]
};

export async function reportPdf(r) {
  const JsPDF = await loadJsPdf();
  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 15, CW = W - 2 * M;
  let y = M;
  const color = (c) => pdf.setTextColor(...c);
  const font = (size, style = 'normal') => { pdf.setFont('helvetica', style); pdf.setFontSize(size); };
  const text = (s, x, yy, opt) => pdf.text(Array.isArray(s) ? s.map(T) : T(s), x, yy, opt);
  const hr = (yy, c = C.line, w = 0.2) => { pdf.setDrawColor(...c); pdf.setLineWidth(w); pdf.line(M, yy, W - M, yy); };
  const ensure = (h) => { if (y + h > H - 18) { pdf.addPage(); y = M; } };
  const heading = (s) => { ensure(14); font(12, 'bold'); color(C.ink); text(s, M, y + 4); y += 9; };

  const E = r.entries || [];
  const B = r.blood || [];
  const periodLabel = (PERIODS.find((p) => p[0] === r.period) || PERIODS[3])[1];

  // Rubrik
  font(8, 'bold'); color(C.accent); text('HÄLSORAPPORT · VIKTRESAN', M, y + 3);
  font(20, 'bold'); color(C.ink); text(r.name || 'Okänd', M, y + 11);
  font(9.5); color(C.muted); text(`${r.email || ''}${r.heightCm ? '  ·  Längd ' + r.heightCm + ' cm' : ''}`, M, y + 17);
  text(`Skapad ${dFull(new Date(r.created))}`, W - M, y + 6, { align: 'right' });
  text(`Period: ${periodLabel}`, W - M, y + 11, { align: 'right' });
  y += 21; hr(y, C.accent, 0.6); y += 6;

  // Tre rutor: vikt, BMI, midja
  const wF = firstOf(E, 'weight'), wL = lastOf(E, 'weight');
  const mF = firstOf(E, 'waist'), mL = lastOf(E, 'waist');
  const bmiF = wF && r.heightCm ? bmi(wF.weight, r.heightCm) : null;
  const bmiL = wL && r.heightCm ? bmi(wL.weight, r.heightCm) : null;
  const pct = wF && wL && wF !== wL ? ((wL.weight - wF.weight) / wF.weight) * 100 : null;
  const tiles = [
    ['Vikt nu', wL ? fmt1(wL.weight) + ' kg' : '-', wF && wL && wF !== wL ? `${sgn(wL.weight - wF.weight, 'kg')} (${sgn(pct, '%')}) sedan ${dt(wF.d)}` : wL ? dt(wL.d) : ''],
    ['BMI nu', bmiL != null ? fmt1(bmiL) : '-', bmiF != null && bmiL != null && wF !== wL ? `Var ${fmt1(bmiF)} den ${dt(wF.d)}` : ''],
    ['Midja nu', mL ? fmt1(mL.waist) + ' cm' : '-', mF && mL && mF !== mL ? `${sgn(mL.waist - mF.waist, 'cm')} sedan ${dt(mF.d)}` : mL ? dt(mL.d) : '']
  ];
  const tw = (CW - 8) / 3;
  tiles.forEach(([l, v, s], i) => {
    const x = M + i * (tw + 4);
    pdf.setFillColor(...C.soft); pdf.roundedRect(x, y, tw, 24, 3, 3, 'F');
    font(8, 'bold'); color(C.accentInk); text(l, x + 4, y + 6);
    font(15, 'bold'); color(C.ink); text(v, x + 4, y + 14);
    font(7.5); color(C.muted); text(pdf.splitTextToSize(T(s), tw - 8), x + 4, y + 19);
  });
  y += 31;

  // Grafer
  const chart = (vals, x, yy, w, h, stroke, fill) => {
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const pad = (mx - mn) * 0.12 || 1, lo = mn - pad, hi = mx + pad;
    pdf.setDrawColor(...C.line); pdf.setLineWidth(0.2);
    [0, 0.5, 1].forEach((f) => pdf.line(x, yy + f * h, x + w, yy + f * h));
    const pts = vals.map((v, i) => [x + 2 + i * (w - 4) / (vals.length - 1), yy + (hi - v) / (hi - lo) * h]);
    // yta under linjen
    pdf.setFillColor(...fill);
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      pdf.triangle(x1, y1, x2, y2, x1, yy + h, 'F');
      pdf.triangle(x2, y2, x2, yy + h, x1, yy + h, 'F');
    }
    pdf.setDrawColor(...stroke); pdf.setLineWidth(0.7);
    for (let i = 1; i < pts.length; i++) pdf.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    const [lx, ly] = pts[pts.length - 1];
    pdf.setFillColor(255, 255, 255); pdf.circle(lx, ly, 1.3, 'FD');
  };
  const weights = E.filter((e) => e.weight != null);
  const waists = E.filter((e) => e.waist != null);
  const charts = [];
  if (weights.length >= 2) charts.push(['Vikt över tid (kg)', weights.map((e) => e.weight), weights, C.accent, C.wFill, 'weight']);
  if (waists.length >= 2) charts.push(['Midja över tid (cm)', waists.map((e) => e.waist), waists, C.pink, C.waistFill, 'waist']);
  if (charts.length) {
    ensure(52);
    const cw = charts.length === 2 ? (CW - 8) / 2 : CW;
    charts.forEach(([title, vals, rows, stroke, fill, key], i) => {
      const x = M + i * (cw + 8);
      font(10, 'bold'); color(C.ink); text(title, x, y + 3);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      font(7); color(C.muted);
      text(fmt1(mx), x + cw, y + 3, { align: 'right' });
      chart(vals, x, y + 6, cw, 32, stroke, fill);
      text(dt(rows[0].d), x, y + 43);
      text(dt(rows[rows.length - 1].d), x + cw, y + 43, { align: 'right' });
      text(`Lägst ${fmt1(mn)}`, x + cw / 2, y + 43, { align: 'center' });
    });
    y += 50;
  }

  // Tabellhjälp
  const table = (cols, rows, rowH = 7) => {
    const head = () => {
      font(7, 'bold'); color(C.muted);
      cols.forEach((c) => text(c.label.toUpperCase(), c.align === 'right' ? c.x + c.w : c.x, y + 3, { align: c.align || 'left' }));
      y += 5; hr(y);
    };
    head();
    rows.forEach((cells) => {
      const lines = cells.map((cell, i) => {
        font(cols[i].size || 9, cell.bold ? 'bold' : 'normal');
        return cols[i].wrap ? pdf.splitTextToSize(T(cell.t), cols[i].w) : [T(cell.t)];
      });
      const h = Math.max(rowH, ...lines.map((l, i) => l.length * 3.8 + (cells[i].sub ? 3.6 : 0) + 3));
      if (y + h > H - 18) { pdf.addPage(); y = M; head(); }
      cells.forEach((cell, i) => {
        const c = cols[i];
        const x = c.align === 'right' ? c.x + c.w : c.x;
        font(c.size || 9, cell.bold ? 'bold' : 'normal'); color(cell.color || C.ink);
        text(lines[i], x, y + 4.5, { align: c.align || 'left' });
        if (cell.flag) {
          const fw = pdf.getTextWidth(T(cell.t));
          font(6.5, 'bold');
          const lw = pdf.getTextWidth(cell.flag) + 3;
          const fx = (c.align === 'right' ? x - fw - lw - 1.5 : x + fw + 1.5);
          pdf.setFillColor(...C.pinkSoft); pdf.roundedRect(fx, y + 1.6, lw, 3.8, 1, 1, 'F');
          color(C.pinkInk); text(cell.flag, fx + 1.5, y + 4.4);
        }
        if (cell.sub) { font(7); color(C.muted); text(cell.sub, x, y + 4.5 + lines[i].length * 3.8, { align: c.align || 'left' }); }
      });
      y += h; hr(y);
    });
    y += 4;
  };

  // Blodvärden
  const bRows = BLOOD.map((b) => {
    const ser = B.filter((x) => x.values[b[0]] != null);
    if (!ser.length) return null;
    const last = ser[ser.length - 1], prev = ser.length > 1 ? ser[ser.length - 2] : null;
    const st = bloodStatus(b[0], last.values[b[0]]);
    return [
      { t: b[1], bold: true, sub: b[3] },
      { t: bv(b[0], last.values[b[0]]), bold: true, sub: dt(last.d), flag: st === 'high' ? 'Hög' : st === 'low' ? 'Låg' : null },
      { t: prev ? bv(b[0], prev.values[b[0]]) : '-', sub: prev ? dt(prev.d) : '' },
      { t: rangeTxt(b), color: C.muted }
    ];
  }).filter(Boolean);
  if (bRows.length) {
    heading('Blodvärden och blodtryck');
    table([
      { label: 'Värde', x: M, w: 70 },
      { label: 'Senaste', x: M + 70, w: 38, align: 'right' },
      { label: 'Förra', x: M + 108, w: 32, align: 'right' },
      { label: 'Ungefär normalt', x: M + 140, w: CW - 140, align: 'right' }
    ], bRows, 10);
  }

  // Senaste mätningar
  const log = [...E].reverse().slice(0, 15);
  if (log.length) {
    heading('Senaste mätningar');
    const w7 = CW / 7;
    const f = (v) => (v != null ? fmt1(v) : '-');
    table(['Datum', 'Vikt (kg)', 'BMI', 'Midja', 'Höft', 'Arm', 'Lår'].map((label, i) => ({ label, x: M + i * w7, w: w7, align: i ? 'right' : 'left' })),
      log.map((e) => [{ t: dt(e.d) }, { t: f(e.weight), bold: true }, { t: e.weight != null && r.heightCm ? fmt1(bmi(e.weight, r.heightCm)) : '-' },
        { t: f(e.waist) }, { t: f(e.hip) }, { t: f(e.arm) }, { t: f(e.thigh) }]));
    font(7); color(C.muted); text('Mått i cm.', M, y - 1); y += 3;
  }

  // Logg blodvärden
  if (B.length) {
    heading('Logg blodvärden');
    table([{ label: 'Datum', x: M, w: 25 }, { label: 'Värden', x: M + 25, w: CW - 25, wrap: true, size: 8.5 }],
      [...B].reverse().slice(0, 12).map((x) => [
        { t: dt(x.d) },
        { t: BLOOD.filter((b) => x.values[b[0]] != null).map((b) => `${b[1]} ${bv(b[0], x.values[b[0]])}`).join('  ·  '), sub: x.note || '' }
      ]));
  }

  if (!E.length && !B.length) { font(10); color(C.muted); text('Inga mätningar under perioden.', M, y + 4); }

  // Sidfot på varje sida
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...C.line); pdf.setLineWidth(0.2); pdf.line(M, H - 14, W - M, H - 14);
    font(7); color(C.muted);
    text('Uppgifterna har skrivits in av personen själv i appen Viktresan. Normalintervallen är ungefärliga för vuxna och ersätter inte labbets referensvärden.', M, H - 10, { maxWidth: CW - 25 });
    text(`viktresan.online  ·  Sida ${i} av ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const safe = (r.name || 'rapport').toLowerCase().replace(/[^a-z0-9åäö]+/gi, '-').replace(/^-|-$/g, '');
  const name = `halsorapport-${safe}-${new Date(r.created).toISOString().slice(0, 10)}.pdf`;
  return new File([pdf.output('blob')], name, { type: 'application/pdf' });
}

// Visar en ruta där man kan dela eller spara PDF:en (måste ske direkt efter ett tryck på iPhone).
export function offerPdf(file, openSheet, toast) {
  const url = URL.createObjectURL(file);
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const s = openSheet(`
    <h2>PDF:en är klar</h2>
    <p class="muted" style="font-size:15px">${file.name}</p>
    ${canShare ? '<button class="btn primary block" data-share>Dela eller spara PDF</button>' : ''}
    <a class="btn ${canShare ? 'outline' : 'primary'} block" href="${url}" download="${file.name}" target="_blank" rel="noopener">Öppna PDF</a>
    <button class="btn ghost block" data-close>Klar</button>`, 'PDF');
  s.el.querySelector('[data-share]')?.addEventListener('click', async () => {
    try { await navigator.share({ files: [file], title: 'Hälsorapport' }); } catch (e) { if (e && e.name !== 'AbortError') toast('Det gick inte att dela. Tryck på Öppna PDF.'); }
  });
}
