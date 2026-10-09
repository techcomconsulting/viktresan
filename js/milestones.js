// Milstolpar (märken) och prognos. Allt räknas fram från mätningarna, inget sparas utom vilka märken man redan har sett.
import { bmi, round1 } from './ui.js';

// [id, emoji, namn, förklaring]
export const BADGES = [
  ['first', '🌱', 'Första steget', 'Din första mätning'],
  ['kg1', '👍', '1 kg lättare', 'Ner 1 kg sedan start'],
  ['kg5', '💪', '5 kg lättare', 'Ner 5 kg sedan start'],
  ['kg10', '🔥', '10 kg lättare', 'Ner 10 kg sedan start'],
  ['kg15', '🚀', '15 kg lättare', 'Ner 15 kg sedan start'],
  ['kg20', '🏔️', '20 kg lättare', 'Ner 20 kg sedan start'],
  ['kg30', '👑', '30 kg lättare', 'Ner 30 kg sedan start'],
  ['p5', '⭐', '5 procent', 'Ner 5 % av startvikten'],
  ['p10', '🌟', '10 procent', 'Ner 10 % av startvikten'],
  ['p15', '💫', '15 procent', 'Ner 15 % av startvikten'],
  ['p20', '✨', '20 procent', 'Ner 20 % av startvikten'],
  ['waist5', '📏', 'Midja −5 cm', 'Midjan har krympt 5 cm'],
  ['waist10', '🎯', 'Midja −10 cm', 'Midjan har krympt 10 cm'],
  ['bmi30', '📉', 'BMI under 30', 'Från över 30 till under 30'],
  ['bmi25', '🎊', 'BMI under 25', 'Från över 25 till under 25'],
  ['half', '🏁', 'Halvvägs', 'Halva vägen till målvikten'],
  ['goal', '🏆', 'Målet nått!', 'Du har nått din målvikt'],
  ['weeks4', '📅', '4 veckor i rad', 'Vägt dig varje vecka i 4 veckor'],
  ['weeks8', '🗓️', '8 veckor i rad', 'Vägt dig varje vecka i 8 veckor'],
  ['weeks12', '🥇', '12 veckor i rad', 'Vägt dig varje vecka i 12 veckor'],
  ['inv5', '🤝', 'Bjudit in 5', '5 vänner har gått med via dig'],
  ['inv15', '📣', 'Bjudit in 15', '15 vänner har gått med via dig']
];

// Veckonummer (måndag som första dag), som ett löpande tal.
const weekNo = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 3) / 7);

function longestWeekStreak(dates) {
  const weeks = [...new Set(dates.map(weekNo))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const w of weeks) { run = prev != null && w === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = w; }
  return best;
}

// Vilka märken har man klarat? entries = alla mätningar (äldst först).
export function earnedBadges(entries, profile) {
  const out = new Set();
  const inv = profile.invites || 0;
  if (inv >= 5) out.add('inv5');
  if (inv >= 15) out.add('inv15');
  if (!entries.length) return out;
  out.add('first');
  const w = entries.filter((e) => e.weight != null);
  const start = profile.startWeight ?? w[0]?.weight;
  if (w.length && start) {
    const best = Math.min(...w.map((e) => e.weight));
    const lost = start - best;
    [[1, 'kg1'], [5, 'kg5'], [10, 'kg10'], [15, 'kg15'], [20, 'kg20'], [30, 'kg30']].forEach(([k, id]) => { if (lost >= k - 0.05) out.add(id); });
    const pct = (lost / start) * 100;
    [[5, 'p5'], [10, 'p10'], [15, 'p15'], [20, 'p20']].forEach(([p, id]) => { if (pct >= p - 0.05) out.add(id); });
    const h = profile.heightCm;
    if (h) {
      const b0 = bmi(start, h), bb = bmi(best, h);
      if (b0 >= 30 && bb < 30) out.add('bmi30');
      if (b0 >= 25 && bb < 25) out.add('bmi25');
    }
    const goal = profile.goalWeight;
    if (goal && start > goal) {
      if (best <= start - (start - goal) / 2) out.add('half');
      if (best <= goal + 0.05) out.add('goal');
    }
    const streak = longestWeekStreak(w.map((e) => e.at));
    if (streak >= 4) out.add('weeks4');
    if (streak >= 8) out.add('weeks8');
    if (streak >= 12) out.add('weeks12');
  }
  const m = entries.filter((e) => e.waist != null);
  if (m.length >= 2) {
    const shrink = m[0].waist - Math.min(...m.map((e) => e.waist));
    if (shrink >= 5 - 0.05) out.add('waist5');
    if (shrink >= 10 - 0.05) out.add('waist10');
  }
  return out;
}

// Prognos: hur snabbt går vikten ner de senaste 8 veckorna, och när nås målet?
export function forecast(entries, goal) {
  const w = entries.filter((e) => e.weight != null);
  if (!w.length || !goal) return null;
  const lastAt = w[w.length - 1].at.getTime();
  const recent = w.filter((e) => e.at.getTime() >= lastAt - 56 * 86400000);
  const span = (lastAt - recent[0].at.getTime()) / 86400000;
  if (recent.length < 3 || span < 14) return { status: 'few' };
  // Minsta kvadratmetoden: kg per dag.
  const xs = recent.map((e) => (e.at.getTime() - lastAt) / 86400000);
  const ys = recent.map((e) => e.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  const perDay = den ? num / den : 0;
  const perWeek = round1(perDay * 7);
  const current = my + perDay * (0 - mx); // trendens värde idag
  const left = current - goal;
  if (left <= 0) return { status: 'reached', perWeek };
  if (perDay >= -0.005) return { status: 'flat', perWeek };
  const days = left / -perDay;
  if (days > 3 * 365) return { status: 'far', perWeek };
  return { status: 'ok', perWeek, date: new Date(lastAt + days * 86400000), weeks: Math.ceil(days / 7) };
}
