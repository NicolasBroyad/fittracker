import { addDays, dayOfWeek, mondayOf, todayISO } from './dates';
import type {
  Exercise,
  ISODate,
  MuscleGroup,
  PlanDay,
  PlanItem,
  Routine,
  RoutineData,
  SetInput,
  SetLog,
  WeightUnit,
} from './types';

// ── Sesiones ───────────────────────────────────────────────────────────────

export interface Session {
  exerciseId: string;
  date: ISODate;
  sets: SetInput[];
  /** unidad del peso de la sesión: kg y ladrillos nunca se comparan ni se suman entre sí */
  unit: WeightUnit;
  /** alguna serie tiene reps por lado (izquierda/derecha) */
  unilateral: boolean;
  topWeight: number | null;
  bestSet: SetInput | null;
  e1rm: number | null;
  /** peso × reps en la unidad de la sesión (en ladrillos no son kg) */
  volume: number;
  /** reps totales (por lado suma los dos) */
  totalReps: number;
  setCount: number;
}

/** 1RM estimado (Epley). Null si la serie no sirve para estimarlo. */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0 || reps > 20) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Reps que cuentan para récords y 1RM: en una serie por lado, el mejor lado. */
export function bestReps(s: SetInput): number | null {
  if (s.reps_right == null) return s.reps;
  return Math.max(s.reps ?? 0, s.reps_right);
}

/** Reps hechas en la serie: por lado suma los dos lados (para volumen y reps totales). */
export function setReps(s: SetInput): number {
  return (s.reps ?? 0) + (s.reps_right ?? 0);
}

/** Compara dos series: más peso gana; a igual peso, más repeticiones (del mejor lado). */
export function compareSets(a: SetInput, b: SetInput): number {
  const wa = a.weight ?? 0;
  const wb = b.weight ?? 0;
  if (wa !== wb) return wa - wb;
  return (bestReps(a) ?? 0) - (bestReps(b) ?? 0);
}

/** Unidad de una sesión: la de sus series con peso (si no hay, la de la primera; si no, kg). */
export function sessionUnit(sets: SetInput[]): WeightUnit {
  return (sets.find((s) => s.weight != null && s.weight > 0) ?? sets[0])?.weight_unit ?? 'kg';
}

export function makeSession(exerciseId: string, date: ISODate, sets: SetInput[]): Session {
  const unit = sessionUnit(sets);
  let topWeight: number | null = null;
  let bestSet: SetInput | null = null;
  let e1rm: number | null = null;
  let volume = 0;
  let totalReps = 0;
  for (const s of sets) {
    totalReps += setReps(s);
    // una serie con peso en otra unidad (no debería pasar: la hoja usa una sola) no entra en las cuentas de peso
    if (s.weight && s.weight > 0 && s.weight_unit !== unit) continue;
    if (s.weight != null && s.weight > 0) topWeight = Math.max(topWeight ?? 0, s.weight);
    if (!bestSet || compareSets(s, bestSet) > 0) bestSet = s;
    const est = estimate1RM(s.weight, bestReps(s));
    if (est != null) e1rm = Math.max(e1rm ?? 0, est);
    if (s.weight && s.reps) volume += s.weight * setReps(s);
  }
  const unilateral = sets.some((s) => s.reps_right != null);
  return { exerciseId, date, sets, unit, unilateral, topWeight, bestSet, e1rm, volume, totalReps, setCount: sets.length };
}

/**
 * Sesiones comparables entre sí: las que están en `unit` (por defecto, la unidad de la última). Los
 * récords, la mejor sesión, el gráfico y las tendencias se calculan solo con estas.
 */
export function sameUnit(sessions: Session[], unit?: WeightUnit): Session[] {
  const u = unit ?? sessions[sessions.length - 1]?.unit;
  return u && sessions.some((s) => s.unit !== u) ? sessions.filter((s) => s.unit === u) : sessions;
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
    // ?? por las filas cacheadas antes de que existieran weight_unit / reps_right
    const s = makeSession(
      rows[0].exercise_id,
      rows[0].session_date,
      rows.map((r) => ({
        weight: r.weight,
        reps: r.reps,
        weight_unit: r.weight_unit ?? 'kg',
        reps_right: r.reps_right ?? null,
      })),
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
  /** unidad en la que están calculados los récords (los de otra unidad no se mezclan) */
  unit: WeightUnit;
  bestE1rm: { value: number; date: ISODate } | null;
  heaviest: { set: SetInput; date: ISODate } | null;
  mostReps: { reps: number; date: ISODate } | null;
  bestVolume: { value: number; date: ISODate } | null;
  /** la sesión completa donde se hizo la mejor serie (ver bestSession) */
  best: Session | null;
  /** todas las sesiones, en cualquier unidad */
  sessions: number;
  lastDate: ISODate | null;
}

/** Récords con las sesiones en `unit` (por defecto, la unidad de la última sesión). */
export function exerciseRecords(sessions: Session[], unit?: WeightUnit): ExerciseRecords {
  const u = unit ?? sessions[sessions.length - 1]?.unit ?? 'kg';
  const comparable = sameUnit(sessions, u);
  const r: ExerciseRecords = {
    unit: u,
    bestE1rm: null,
    heaviest: null,
    mostReps: null,
    bestVolume: null,
    best: bestSession(comparable),
    sessions: sessions.length,
    lastDate: sessions.length ? sessions[sessions.length - 1].date : null,
  };
  for (const s of comparable) {
    if (s.e1rm != null && (!r.bestE1rm || s.e1rm >= r.bestE1rm.value)) r.bestE1rm = { value: s.e1rm, date: s.date };
    if (s.bestSet && (!r.heaviest || compareSets(s.bestSet, r.heaviest.set) >= 0)) r.heaviest = { set: s.bestSet, date: s.date };
    for (const set of s.sets) {
      const reps = bestReps(set);
      if (reps != null && (!r.mostReps || reps >= r.mostReps.reps)) r.mostReps = { reps, date: s.date };
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
  unit: WeightUnit;
  set: SetInput | null;
}

/**
 * Récords de un ejercicio en orden cronológico. La primera sesión nunca es récord (no hay nada que
 * superar). Prioridad: más peso levantado > mejor 1RM estimado > más repeticiones (peso corporal).
 * Los máximos se llevan por unidad: una sesión en ladrillos solo compite con las de ladrillos, y la
 * primera en una unidad nueva tampoco es récord. Por lado cuenta el mejor lado.
 */
export function detectPRs(sessions: Session[]): PR[] {
  const out: PR[] = [];
  const maxByUnit = new Map<WeightUnit, { w: number; e: number; r: number; n: number }>();
  for (const s of sessions) {
    let max = maxByUnit.get(s.unit);
    if (!max) maxByUnit.set(s.unit, (max = { w: 0, e: 0, r: 0, n: 0 }));
    const w = s.topWeight ?? 0;
    const e = s.e1rm ?? 0;
    const r = Math.max(0, ...s.sets.map((x) => bestReps(x) ?? 0));
    const bodyweight = w === 0;
    const base = { exerciseId: s.exerciseId, date: s.date, unit: s.unit };
    if (max.n > 0) {
      if (w > max.w && max.w > 0) {
        const set =
          s.sets
            .filter((x) => x.weight === w)
            .sort(compareSets)
            .pop() ?? null;
        out.push({ ...base, kind: 'peso', value: w, previous: max.w, set });
      } else if (e > max.e + 0.25 && max.e > 0) {
        const set = s.sets.reduce<SetInput | null>((best, x) => {
          const ex = estimate1RM(x.weight, bestReps(x)) ?? 0;
          return !best || ex > (estimate1RM(best.weight, bestReps(best)) ?? 0) ? x : best;
        }, null);
        out.push({ ...base, kind: '1rm', value: e, previous: max.e, set });
      } else if (bodyweight && max.w === 0 && r > max.r && max.r > 0) {
        out.push({ ...base, kind: 'reps', value: r, previous: max.r, set: null });
      }
    }
    max.w = Math.max(max.w, w);
    max.e = Math.max(max.e, e);
    max.r = Math.max(max.r, r);
    max.n++;
  }
  return out;
}

/**
 * ¿La sesión `now` (todavía sin guardar) es récord contra las anteriores a su fecha en la misma
 * unidad? Mismo criterio que detectPRs; si no hay sesiones previas en esa unidad, no lo es.
 */
export function newRecord(prior: Session[], now: Session): PR | null {
  const before = prior.filter((s) => s.date < now.date);
  return detectPRs([...before, now]).find((p) => p.date === now.date) ?? null;
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
  /** en kg: solo las sesiones en kg */
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
      if (s.unit === 'kg') ws.volume += s.volume; // el volumen en kg no suma las sesiones en ladrillos
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

// ── Semana real vs. planificada ────────────────────────────────────────────

export interface WeekAssignment {
  /** día de la rutina (1..7) → fecha en que se hizo esta semana */
  doneOn: Map<number, ISODate>;
  /** fecha → día de la rutina que se hizo esa fecha */
  dayOnDate: Map<ISODate, number>;
  /** días de la rutina con entrenamiento planificado */
  planned: number[];
}

/**
 * Deduce qué día de la rutina se hizo en cada fecha de la semana, comparando los ejercicios
 * cargados cada día contra los puestos de cada día planificado (cualquier alternativa cuenta).
 * Así, si Pull se hizo el miércoles en vez del martes, el martes figura como hecho "el miércoles".
 * Asignación greedy por mayor coincidencia; a igualdad, gana el día de la semana que corresponde a
 * esa fecha y después el más cercano.
 */
export function assignWeek(
  data: RoutineData | undefined,
  routineId: string | null | undefined,
  exById: Map<string, Exercise>,
  index: TrainingIndex,
  monday: ISODate,
  today: ISODate,
): WeekAssignment {
  const plans = Array.from({ length: 7 }, (_, i) => dayPlan(data, routineId, i + 1, exById)).filter(isTrainingDay);
  const candidates: { date: ISODate; dow: number; matched: number; ratio: number; dist: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (date > today) break;
    const logged = new Set((index.byDate.get(date) ?? []).map((s) => s.exerciseId));
    if (!logged.size) continue;
    for (const p of plans) {
      const matched = p.slots.filter((sl) => sl.items.some((it) => logged.has(it.exercise_id))).length;
      if (matched === 0 || matched < Math.ceil(p.slots.length * 0.3)) continue;
      candidates.push({ date, dow: p.dayOfWeek, matched, ratio: matched / p.slots.length, dist: Math.abs(i + 1 - p.dayOfWeek) });
    }
  }
  candidates.sort((a, b) => b.matched - a.matched || b.ratio - a.ratio || a.dist - b.dist);
  const doneOn = new Map<number, ISODate>();
  const dayOnDate = new Map<ISODate, number>();
  for (const c of candidates) {
    if (doneOn.has(c.dow) || dayOnDate.has(c.date)) continue;
    doneOn.set(c.dow, c.date);
    dayOnDate.set(c.date, c.dow);
  }
  return { doneOn, dayOnDate, planned: plans.map((p) => p.dayOfWeek) };
}

/** Días planificados de la semana que ya pasaron y todavía no se hicieron (ni antes ni después). */
export function pendingDays(w: WeekAssignment, today: ISODate): number[] {
  const todayDow = dayOfWeek(today);
  return w.planned.filter((d) => d < todayDow && !w.doneOn.has(d));
}
