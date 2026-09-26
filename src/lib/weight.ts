import { addDays, dayNumber, diffDays, fromISO, mondayOf, monthKey, toISO, todayISO } from './dates';
import type { ISODate, Phase, WeightEntry, WeightGoal } from './types';

export function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return entries.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Promedio móvil por días de calendario: para cada registro, el promedio de todos los registros
 * de los `windowDays` días que terminan en esa fecha (no de los últimos N registros).
 */
export function movingAverage(sorted: WeightEntry[], windowDays = 7): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  let start = 0;
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].weight;
    const dn = dayNumber(sorted[i].date);
    while (dayNumber(sorted[start].date) <= dn - windowDays) {
      sum -= sorted[start].weight;
      start++;
    }
    out.set(sorted[i].date, sum / (i - start + 1));
  }
  return out;
}

/** Promedio de los registros en los 7 días que terminan en `date` (o null si no hay ninguno). */
export function avgEndingAt(sorted: WeightEntry[], date: ISODate, days = 7): number | null {
  const from = addDays(date, -(days - 1));
  const xs = sorted.filter((e) => e.date >= from && e.date <= date).map((e) => e.weight);
  return xs.length ? mean(xs) : null;
}

export interface PeriodAvg {
  key: ISODate | string; // lunes de la semana, o 'YYYY-MM'
  avg: number;
  count: number;
  min: number;
  max: number;
  first: number;
  last: number;
}

function groupAvg(sorted: WeightEntry[], keyOf: (iso: ISODate) => string): PeriodAvg[] {
  const groups = new Map<string, number[]>();
  for (const e of sorted) {
    const k = keyOf(e.date);
    const arr = groups.get(k);
    if (arr) arr.push(e.weight);
    else groups.set(k, [e.weight]);
  }
  return Array.from(groups, ([key, ws]) => ({
    key,
    avg: mean(ws),
    count: ws.length,
    min: Math.min(...ws),
    max: Math.max(...ws),
    first: ws[0],
    last: ws[ws.length - 1],
  })).sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Promedios por semana natural (lunes a domingo), ordenados de más vieja a más nueva. */
export function weeklyAverages(sorted: WeightEntry[]): PeriodAvg[] {
  return groupAvg(sorted, mondayOf);
}

export function monthlyAverages(sorted: WeightEntry[]): PeriodAvg[] {
  return groupAvg(sorted, monthKey);
}

/** Pendiente por regresión lineal (kg/día) de los registros de los últimos `days` días. */
export function trendPerDay(sorted: WeightEntry[], days = 28, today = todayISO()): number | null {
  const from = addDays(today, -days);
  const pts = sorted.filter((e) => e.date > from && e.date <= today);
  if (pts.length < 5) return null;
  const span = diffDays(pts[pts.length - 1].date, pts[0].date);
  if (span < 10) return null;
  const xs = pts.map((e) => dayNumber(e.date));
  const ys = pts.map((e) => e.weight);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** Días seguidos con registro, terminando hoy (o ayer, si hoy todavía no se cargó). */
export function loggingStreak(sorted: WeightEntry[], today = todayISO()): number {
  const dates = new Set(sorted.map((e) => e.date));
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ── Fases ──────────────────────────────────────────────────────────────────

export function sortPhases(phases: Phase[]): Phase[] {
  return phases.slice().sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}

export function phaseAt(phases: Phase[], date: ISODate): Phase | null {
  let best: Phase | null = null;
  for (const p of phases) {
    if (p.start_date <= date && (p.end_date == null || p.end_date >= date)) {
      if (!best || p.start_date > best.start_date) best = p;
    }
  }
  return best;
}

export function currentPhase(phases: Phase[], today = todayISO()): Phase | null {
  return phaseAt(phases, today);
}

// ── Meta ───────────────────────────────────────────────────────────────────

/** La meta vigente es la fila más reciente del historial; si su peso es null, no hay meta. */
export function activeGoal(goals: WeightGoal[]): WeightGoal | null {
  if (!goals.length) return null;
  const latest = goals.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  return latest.target_weight == null ? null : latest;
}

export interface GoalProgress {
  start: number;
  current: number;
  target: number;
  /** +1 si la meta es subir, −1 si es bajar */
  direction: 1 | -1;
  remaining: number;
  pct: number;
  reached: boolean;
  daysLeft: number | null;
  requiredPerWeek: number | null;
  trendPerWeek: number | null;
  onTrack: boolean | null;
  projectedDate: ISODate | null;
}

export function goalProgress(goal: WeightGoal, sorted: WeightEntry[], today = todayISO()): GoalProgress | null {
  if (goal.target_weight == null || !sorted.length) return null;
  const target = goal.target_weight;
  const createdOn = toISO(new Date(goal.created_at));
  const before = sorted.filter((e) => e.date <= createdOn);
  const start = before.length ? before[before.length - 1].weight : sorted[0].weight;
  const latestDate = sorted[sorted.length - 1].date;
  const current = avgEndingAt(sorted, latestDate) ?? sorted[sorted.length - 1].weight;

  const direction: 1 | -1 = target >= start ? 1 : -1;
  const total = Math.abs(target - start);
  const done = (current - start) * direction;
  const remaining = (target - current) * direction; // > 0 = falta
  const reached = remaining <= 0.05;
  const pct = total < 0.05 ? (reached ? 100 : 0) : Math.max(0, Math.min(100, (done / total) * 100));

  const daysLeft = goal.target_date ? diffDays(goal.target_date, today) : null;
  const requiredPerWeek = !reached && daysLeft != null && daysLeft > 0 ? ((target - current) / daysLeft) * 7 : null;

  const slope = trendPerDay(sorted, 28, today);
  const trendPerWeek = slope == null ? null : slope * 7;

  let projectedDate: ISODate | null = null;
  if (!reached && slope != null && Math.sign(slope) === direction && Math.abs(slope) > 0.001) {
    const days = Math.ceil(Math.abs(target - current) / Math.abs(slope));
    if (days < 365 * 3) projectedDate = addDays(today, days);
  }

  let onTrack: boolean | null = null;
  if (!reached && requiredPerWeek != null && trendPerWeek != null) {
    onTrack = trendPerWeek * direction >= requiredPerWeek * direction * 0.9;
  }

  return {
    start,
    current,
    target,
    direction,
    remaining,
    pct,
    reached,
    daysLeft,
    requiredPerWeek,
    trendPerWeek,
    onTrack,
    projectedDate,
  };
}

/**
 * Hacia dónde "conviene" que se mueva el peso, para colorear las variaciones: según la meta si hay
 * una, si no según la fase actual (definición = bajar, volumen = subir), si no neutral.
 */
export function preferredDirection(goal: WeightGoal | null, sorted: WeightEntry[], phase: Phase | null): 1 | -1 | 0 {
  if (goal?.target_weight != null && sorted.length) {
    const cur = sorted[sorted.length - 1].weight;
    if (Math.abs(goal.target_weight - cur) > 0.2) return goal.target_weight > cur ? 1 : -1;
  }
  if (phase?.phase === 'definicion') return -1;
  if (phase?.phase === 'volumen') return 1;
  return 0;
}

/** Rango de fechas visible para el gráfico según la opción elegida. */
export type ChartRange = '1M' | '3M' | '6M' | '1A' | 'ALL';

export function rangeStart(range: ChartRange, sorted: WeightEntry[], today = todayISO()): ISODate {
  const t = fromISO(today);
  switch (range) {
    case '1M':
      t.setMonth(t.getMonth() - 1);
      return toISO(t);
    case '3M':
      t.setMonth(t.getMonth() - 3);
      return toISO(t);
    case '6M':
      t.setMonth(t.getMonth() - 6);
      return toISO(t);
    case '1A':
      t.setFullYear(t.getFullYear() - 1);
      return toISO(t);
    default:
      return sorted.length ? sorted[0].date : today;
  }
}
