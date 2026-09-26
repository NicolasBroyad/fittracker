import { addDays, mondayOf, todayISO } from './dates';
import type { Exercise, ISODate, MuscleGroup, PlanDay, PlanItem, Routine, RoutineData, SetInput, SetLog } from './types';

// ── Sesiones ───────────────────────────────────────────────────────────────

export interface Session {
  exerciseId: string;
  date: ISODate;
  sets: SetInput[];
  topWeight: number | null;
  bestSet: SetInput | null;
  e1rm: number | null;
  volume: number;
  totalReps: number;
  setCount: number;
}

/** 1RM estimado (Epley). Null si la serie no sirve para estimarlo. */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0 || reps > 20) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Compara dos series: más peso gana; a igual peso, más repeticiones. */
export function compareSets(a: SetInput, b: SetInput): number {
  const wa = a.weight ?? 0;
  const wb = b.weight ?? 0;
  if (wa !== wb) return wa - wb;
  return (a.reps ?? 0) - (b.reps ?? 0);
}

export function makeSession(exerciseId: string, date: ISODate, sets: SetInput[]): Session {
  let topWeight: number | null = null;
  let bestSet: SetInput | null = null;
  let e1rm: number | null = null;
  let volume = 0;
  let totalReps = 0;
  for (const s of sets) {
    if (s.weight != null && s.weight > 0) topWeight = Math.max(topWeight ?? 0, s.weight);
    if (!bestSet || compareSets(s, bestSet) > 0) bestSet = s;
    const est = estimate1RM(s.weight, s.reps);
    if (est != null) e1rm = Math.max(e1rm ?? 0, est);
    if (s.weight && s.reps) volume += s.weight * s.reps;
    totalReps += s.reps ?? 0;
  }
  return { exerciseId, date, sets, topWeight, bestSet, e1rm, volume, totalReps, setCount: sets.length };
}

export interface TrainingIndex {
  /** sesiones de cada ejercicio, de más vieja a más nueva */
  byExercise: Map<string, Session[]>;
  /** sesiones de cada fecha */
  byDate: Map<ISODate, Session[]>;
  /** fechas con al menos una serie, ascendente */
  dates: ISODate[];
}

export function buildIndex(logs: SetLog[]): TrainingIndex {
  const grouped = new Map<string, SetLog[]>();
  for (const l of logs) {
    const k = l.exercise_id + '|' + l.session_date;
    const arr = grouped.get(k);
    if (arr) arr.push(l);
    else grouped.set(k, [l]);
  }
  const byExercise = new Map<string, Session[]>();
  const byDate = new Map<ISODate, Session[]>();
  for (const rows of grouped.values()) {
    rows.sort((a, b) => a.set_number - b.set_number);
    const s = makeSession(
      rows[0].exercise_id,
      rows[0].session_date,
      rows.map((r) => ({ weight: r.weight, reps: r.reps })),
    );
    push(byExercise, s.exerciseId, s);
    push(byDate, s.date, s);
  }
  for (const arr of byExercise.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));
  const dates = Array.from(byDate.keys()).sort();
  return { byExercise, byDate, dates };
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

export function sessionsOf(index: TrainingIndex, exerciseId: string): Session[] {
  return index.byExercise.get(exerciseId) ?? [];
}

export function sessionOn(index: TrainingIndex, exerciseId: string, date: ISODate): Session | null {
  return sessionsOf(index, exerciseId).find((s) => s.date === date) ?? null;
}

/** Última sesión anterior a `date` (para usar de referencia al cargar series ese día). */
export function lastSessionBefore(index: TrainingIndex, exerciseId: string, date: ISODate): Session | null {
  const arr = sessionsOf(index, exerciseId);
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].date < date) return arr[i];
  return null;
}

export function lastSession(index: TrainingIndex, exerciseId: string): Session | null {
  const arr = sessionsOf(index, exerciseId);
  return arr.length ? arr[arr.length - 1] : null;
}

// ── Récords ────────────────────────────────────────────────────────────────

export interface ExerciseRecords {
  bestE1rm: { value: number; date: ISODate } | null;
  heaviest: { set: SetInput; date: ISODate } | null;
  mostReps: { reps: number; date: ISODate } | null;
  bestVolume: { value: number; date: ISODate } | null;
  /** la sesión completa donde se hizo la mejor serie (ver bestSession) */
  best: Session | null;
  sessions: number;
  lastDate: ISODate | null;
}

export function exerciseRecords(sessions: Session[]): ExerciseRecords {
  const r: ExerciseRecords = {
    bestE1rm: null,
    heaviest: null,
    mostReps: null,
    bestVolume: null,
    best: bestSession(sessions),
    sessions: sessions.length,
    lastDate: sessions.length ? sessions[sessions.length - 1].date : null,
  };
  for (const s of sessions) {
    if (s.e1rm != null && (!r.bestE1rm || s.e1rm >= r.bestE1rm.value)) r.bestE1rm = { value: s.e1rm, date: s.date };
    if (s.bestSet && (!r.heaviest || compareSets(s.bestSet, r.heaviest.set) >= 0)) r.heaviest = { set: s.bestSet, date: s.date };
    for (const set of s.sets) {
      if (set.reps != null && (!r.mostReps || set.reps >= r.mostReps.reps)) r.mostReps = { reps: set.reps, date: s.date };
    }
    if (s.volume > 0 && (!r.bestVolume || s.volume >= r.bestVolume.value)) r.bestVolume = { value: s.volume, date: s.date };
  }
  return r;
}

/**
 * Mejor sesión de un ejercicio: la que tiene la mejor serie (más peso; a igual peso, más reps). Si
 * varias empatan, se comparan sus series de mejor a peor posición por posición; si todo empata, gana
 * la más reciente.
 */
export function bestSession(sessions: Session[]): Session | null {
  let best: Session | null = null;
  let bestSorted: SetInput[] = [];
  for (const s of sessions) {
    if (!s.bestSet) continue;
    const sorted = s.sets.slice().sort((a, b) => compareSets(b, a));
    if (!best) {
      best = s;
      bestSorted = sorted;
      continue;
    }
    let cmp = 0;
    for (let i = 0; i < Math.max(sorted.length, bestSorted.length) && cmp === 0; i++) {
      if (!sorted[i]) cmp = -1;
      else if (!bestSorted[i]) cmp = 1;
      else cmp = compareSets(sorted[i], bestSorted[i]);
    }
    if (cmp >= 0) {
      best = s;
      bestSorted = sorted;
    }
  }
  return best;
}

export type PRKind = 'peso' | '1rm' | 'reps';

export interface PR {
  exerciseId: string;
  date: ISODate;
  kind: PRKind;
  value: number;
  previous: number;
  set: SetInput | null;
}

/**
 * Récords de un ejercicio en orden cronológico. La primera sesión nunca es récord (no hay nada que
 * superar). Prioridad: más peso levantado > mejor 1RM estimado > más repeticiones (peso corporal).
 */
export function detectPRs(sessions: Session[]): PR[] {
  const out: PR[] = [];
  let maxW = 0;
  let maxE = 0;
  let maxR = 0;
  sessions.forEach((s, i) => {
    const w = s.topWeight ?? 0;
    const e = s.e1rm ?? 0;
    const r = Math.max(0, ...s.sets.map((x) => x.reps ?? 0));
    const bodyweight = w === 0;
    if (i > 0) {
      if (w > maxW && maxW > 0) {
        const set =
          s.sets
            .filter((x) => x.weight === w)
            .sort(compareSets)
            .pop() ?? null;
        out.push({ exerciseId: s.exerciseId, date: s.date, kind: 'peso', value: w, previous: maxW, set });
      } else if (e > maxE + 0.25 && maxE > 0) {
        const set = s.sets.reduce<SetInput | null>((best, x) => {
          const ex = estimate1RM(x.weight, x.reps) ?? 0;
          return !best || ex > (estimate1RM(best.weight, best.reps) ?? 0) ? x : best;
        }, null);
        out.push({ exerciseId: s.exerciseId, date: s.date, kind: '1rm', value: e, previous: maxE, set });
      } else if (bodyweight && maxW === 0 && r > maxR && maxR > 0) {
        out.push({ exerciseId: s.exerciseId, date: s.date, kind: 'reps', value: r, previous: maxR, set: null });
      }
    }
    maxW = Math.max(maxW, w);
    maxE = Math.max(maxE, e);
    maxR = Math.max(maxR, r);
  });
  return out;
}

export function recentPRs(index: TrainingIndex, limit = 10): PR[] {
  const all: PR[] = [];
  for (const sessions of index.byExercise.values()) all.push(...detectPRs(sessions));
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
}

// ── Semanas ────────────────────────────────────────────────────────────────

export interface WeekStats {
  monday: ISODate;
  sessions: number;
  sets: number;
  volume: number;
  reps: number;
  byMuscle: Map<MuscleGroup | 'Otro', number>;
}

export function weekStats(index: TrainingIndex, exById: Map<string, Exercise>, monday: ISODate): WeekStats {
  const ws: WeekStats = { monday, sessions: 0, sets: 0, volume: 0, reps: 0, byMuscle: new Map() };
  for (let i = 0; i < 7; i++) {
    const day = index.byDate.get(addDays(monday, i));
    if (!day?.length) continue;
    ws.sessions++;
    for (const s of day) {
      ws.sets += s.setCount;
      ws.volume += s.volume;
      ws.reps += s.totalReps;
      const g = exById.get(s.exerciseId)?.muscle_group ?? 'Otro';
      ws.byMuscle.set(g, (ws.byMuscle.get(g) ?? 0) + s.setCount);
    }
  }
  return ws;
}

export function weeklySeries(
  index: TrainingIndex,
  exById: Map<string, Exercise>,
  weeks: number,
  today = todayISO(),
): WeekStats[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => weekStats(index, exById, addDays(thisMonday, -7 * (weeks - 1 - i))));
}

/** Semanas seguidas con al menos un entrenamiento, terminando en la actual (o la anterior si esta todavía no tiene). */
export function weekStreak(index: TrainingIndex, today = todayISO()): number {
  const weeks = new Set(index.dates.map(mondayOf));
  let m = mondayOf(today);
  if (!weeks.has(m)) m = addDays(m, -7);
  let n = 0;
  while (weeks.has(m)) {
    n++;
    m = addDays(m, -7);
  }
  return n;
}

// ── Rutinas ────────────────────────────────────────────────────────────────

export interface SlotItem extends PlanItem {
  exercise: Exercise;
}

export interface Slot {
  orderIndex: number;
  items: SlotItem[];
}

export interface DayPlan {
  dayOfWeek: number;
  day: PlanDay | null;
  name: string;
  isRest: boolean;
  slots: Slot[];
}

export function activeRoutine(data: RoutineData | undefined): Routine | null {
  return data?.routines.find((r) => r.is_active) ?? null;
}

export function groupSlots(items: PlanItem[], exById: Map<string, Exercise>): Slot[] {
  const map = new Map<number, SlotItem[]>();
  for (const it of items) {
    const exercise = exById.get(it.exercise_id);
    if (!exercise) continue;
    push(map, it.order_index, { ...it, exercise });
  }
  return Array.from(map, ([orderIndex, arr]) => ({
    orderIndex,
    items: arr.sort((a, b) => a.variant - b.variant),
  })).sort((a, b) => a.orderIndex - b.orderIndex);
}

export function dayPlan(
  data: RoutineData | undefined,
  routineId: string | null | undefined,
  dow: number,
  exById: Map<string, Exercise>,
): DayPlan {
  const day = data?.days.find((d) => d.routine_id === routineId && d.day_of_week === dow) ?? null;
  const items = data?.items.filter((i) => i.routine_id === routineId && i.day_of_week === dow) ?? [];
  return {
    dayOfWeek: dow,
    day,
    name: day?.name?.trim() ?? '',
    isRest: !!day?.is_rest,
    slots: groupSlots(items, exById),
  };
}

export function isTrainingDay(p: DayPlan): boolean {
  return !p.isRest && p.slots.length > 0;
}

/** "3" si el puesto no tiene alternativas; "3a", "3b"... si tiene. */
export function slotLabel(position: number, altIndex: number, altCount: number): string {
  return altCount > 1 ? `${position}${String.fromCharCode(97 + altIndex)}` : String(position);
}

/** Alternativa a mostrar por defecto: la que se registró más recientemente (empate → la primera). */
export function defaultAlternative(slot: Slot, index: TrainingIndex): number {
  let best = 0;
  let bestDate = '';
  slot.items.forEach((it, i) => {
    const last = lastSession(index, it.exercise_id);
    if (last && last.date > bestDate) {
      bestDate = last.date;
      best = i;
    }
  });
  return best;
}

export function slotDoneOn(slot: Slot, index: TrainingIndex, date: ISODate): boolean {
  return slot.items.some((it) => !!sessionOn(index, it.exercise_id, date));
}

export function planMuscles(slots: Slot[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  for (const s of slots)
    for (const it of s.items) {
      const g = it.exercise.muscle_group;
      if (g && !out.includes(g)) out.push(g);
    }
  return out;
}

export interface Usage {
  routine: Routine;
  dayOfWeek: number;
  dayName: string;
  item: PlanItem;
}

export function exerciseUsage(data: RoutineData | undefined, exerciseId: string): Usage[] {
  if (!data) return [];
  const routines = new Map(data.routines.map((r) => [r.id, r]));
  return data.items
    .filter((i) => i.exercise_id === exerciseId && routines.has(i.routine_id))
    .map((item) => ({
      routine: routines.get(item.routine_id)!,
      dayOfWeek: item.day_of_week,
      dayName: data.days.find((d) => d.routine_id === item.routine_id && d.day_of_week === item.day_of_week)?.name ?? '',
      item,
    }))
    .sort((a, b) => Number(b.routine.is_active) - Number(a.routine.is_active) || a.dayOfWeek - b.dayOfWeek);
}

/** Objetivo más reciente que se usó para este ejercicio en cualquier rutina (para autocompletar). */
export function lastKnownTarget(data: RoutineData | undefined, exerciseId: string): { sets: number | null; reps: string | null } {
  const u = exerciseUsage(data, exerciseId).find((x) => x.item.sets_target || x.item.reps_target);
  return { sets: u?.item.sets_target ?? null, reps: u?.item.reps_target ?? null };
}
