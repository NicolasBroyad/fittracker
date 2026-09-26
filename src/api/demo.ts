/**
 * Backend falso en memoria con datos de ejemplo realistas. Solo se carga en desarrollo con `?demo`
 * (import dinámico en src/api/index.ts), para poder recorrer y probar la UI sin tocar la base real.
 */
import { addDays, dayOfWeek, mondayOf, todayISO } from '@/lib/dates';
import type {
  Exercise,
  MuscleGroup,
  Phase,
  PlanDay,
  PlanItem,
  Routine,
  RoutineData,
  SetLog,
  WeightEntry,
  WeightGoal,
} from '@/lib/types';
import { BackendError, type Api, type AuthUser } from './types';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uid = () => crypto.randomUUID();
const round = (n: number, step: number) => Math.round(n / step) * step;

interface Store {
  entries: WeightEntry[];
  goals: WeightGoal[];
  phases: Phase[];
  exercises: Exercise[];
  routines: Routine[];
  days: PlanDay[];
  items: PlanItem[];
  logs: SetLog[];
}

function seed(): Store {
  const r = rng(42);
  const today = todayISO();
  const start = addDays(today, -210);
  const bulkEnd = addDays(today, -95);

  // ── peso: volumen ~0,22 kg/sem y después definición ~0,24 kg/sem ──
  const entries: WeightEntry[] = [];
  for (let i = 0; i <= 210; i++) {
    const date = addDays(start, i);
    if (date !== today && r() < 0.13) continue;
    const base = date <= bulkEnd ? 74.2 + (i / 7) * 0.22 : 74.2 + (115 / 7) * 0.22 - ((i - 115) / 7) * 0.24;
    const weight = Math.round((base + (r() - 0.5) * 0.9) * 10) / 10;
    entries.push({ date, weight, note: '', updated_at: new Date().toISOString() });
  }
  entries[entries.length - 12].note = 'Cena pesada la noche anterior';
  entries[entries.length - 30].note = 'Post viaje';

  const phases: Phase[] = [
    { id: uid(), phase: 'volumen', start_date: start, end_date: bulkEnd },
    { id: uid(), phase: 'definicion', start_date: addDays(bulkEnd, 1), end_date: null },
  ];
  const goals: WeightGoal[] = [
    { id: 1, target_weight: 80, target_date: null, created_at: new Date(start + 'T09:00:00').toISOString() },
    {
      id: 2,
      target_weight: 73.5,
      target_date: addDays(today, 56),
      created_at: new Date(addDays(bulkEnd, 1) + 'T09:00:00').toISOString(),
    },
  ];

  // ── ejercicios ──
  const defs: [string, MuscleGroup | null, number][] = [
    ['Press banca', 'Pecho', 80],
    ['Press inclinado con mancuernas', 'Pecho', 30],
    ['Press inclinado en Smith', 'Pecho', 60],
    ['Aperturas en polea', 'Pecho', 15],
    ['Press militar', 'Hombro', 50],
    ['Elevaciones laterales', 'Hombro', 10],
    ['Extensión de tríceps en polea', 'Tricep', 25],
    ['Fondos en paralelas', 'Tricep', 0],
    ['Dominadas', 'Espalda', 0],
    ['Jalón al pecho', 'Espalda', 60],
    ['Remo con barra', 'Espalda', 70],
    ['Remo en máquina', 'Espalda', 55],
    ['Curl con barra', 'Biceps', 30],
    ['Curl martillo', 'Biceps', 14],
    ['Sentadilla', 'Pierna', 100],
    ['Hack squat', 'Pierna', 120],
    ['Peso muerto rumano', 'Pierna', 90],
    ['Prensa', 'Pierna', 180],
    ['Hip thrust', 'Gluteo', 110],
    ['Gemelos de pie', 'Gemelo', 80],
    ['Plancha', 'Abdomen', 0],
    ['Face pull', 'Hombro', 20],
  ];
  const created = new Date(start + 'T10:00:00').toISOString();
  const exercises: Exercise[] = defs.map(([name, muscle_group]) => ({ id: uid(), name, muscle_group, created_at: created }));
  const ex = (name: string) => exercises.find((e) => e.name === name)!;
  const baseWeight = new Map(defs.map(([name, , w]) => [ex(name).id, w]));

  // ── rutinas ──
  const ppl: Routine = { id: uid(), name: 'Push Pull Legs', is_active: true, created_at: created };
  const fb: Routine = { id: uid(), name: 'Full body 3 días', is_active: false, created_at: created };
  const days: PlanDay[] = [];
  const items: PlanItem[] = [];
  const addDay = (routine: Routine, dow: number, name: string, slots: [string[], number, string][], isRest = false) => {
    days.push({ routine_id: routine.id, day_of_week: dow, name, is_rest: isRest });
    slots.forEach(([alts, sets, reps], i) =>
      alts.forEach((n, v) =>
        items.push({
          routine_id: routine.id,
          day_of_week: dow,
          exercise_id: ex(n).id,
          order_index: i + 1,
          variant: v,
          sets_target: sets,
          reps_target: reps,
        }),
      ),
    );
  };
  addDay(ppl, 1, 'Push', [
    [['Press banca'], 4, '6-8'],
    [['Press inclinado con mancuernas', 'Press inclinado en Smith'], 3, '8-10'],
    [['Press militar'], 3, '8-10'],
    [['Elevaciones laterales'], 4, '12-15'],
    [['Extensión de tríceps en polea'], 3, '10-12'],
  ]);
  addDay(ppl, 2, 'Pull', [
    [['Dominadas', 'Jalón al pecho'], 4, '6-10'],
    [['Remo con barra'], 4, '8-10'],
    [['Face pull'], 3, '15'],
    [['Curl con barra'], 3, '8-10'],
    [['Curl martillo'], 3, '10-12'],
  ]);
  addDay(ppl, 3, 'Piernas', [
    [['Sentadilla', 'Hack squat'], 4, '6-8'],
    [['Peso muerto rumano'], 3, '8-10'],
    [['Prensa'], 3, '10-12'],
    [['Gemelos de pie'], 4, '12-15'],
  ]);
  addDay(ppl, 4, '', [], true);
  addDay(ppl, 5, 'Torso', [
    [['Press banca'], 3, '8-10'],
    [['Remo en máquina'], 3, '10-12'],
    [['Press militar'], 3, '10-12'],
    [['Jalón al pecho'], 3, '10-12'],
    [['Aperturas en polea'], 3, '12-15'],
    [['Fondos en paralelas'], 3, 'fallo'],
  ]);
  addDay(ppl, 6, 'Pierna y glúteo', [
    [['Hip thrust'], 4, '8-10'],
    [['Hack squat', 'Sentadilla'], 3, '10-12'],
    [['Peso muerto rumano'], 3, '10'],
    [['Plancha'], 3, '45s'],
  ]);
  addDay(ppl, 7, '', [], true);
  addDay(fb, 1, 'Full body A', [
    [['Sentadilla'], 3, '5'],
    [['Press banca'], 3, '5'],
    [['Remo con barra'], 3, '8'],
  ]);
  addDay(fb, 3, 'Full body B', [
    [['Peso muerto rumano'], 3, '8'],
    [['Press militar'], 3, '8'],
    [['Dominadas'], 3, '6-8'],
  ]);
  addDay(fb, 5, 'Full body C', [
    [['Prensa'], 3, '10'],
    [['Press inclinado con mancuernas'], 3, '10'],
    [['Jalón al pecho'], 3, '10'],
  ]);

  // ── series: últimas 14 semanas siguiendo la rutina activa, con progresión ──
  const logs: SetLog[] = [];
  const slotChoice = new Map<string, number>();
  for (let i = 98; i >= 0; i--) {
    const date = addDays(today, -i);
    // esta semana: el martes no se entrenó y todo se corrió un día (Pull el miércoles, Piernas el jueves)
    const shifted = date >= mondayOf(today) && dayOfWeek(date) >= 2 && dayOfWeek(date) <= 4;
    const dow = shifted ? dayOfWeek(date) - 1 : dayOfWeek(date);
    if (shifted && dow === 1) continue;
    const day = days.find((d) => d.routine_id === ppl.id && d.day_of_week === dow);
    if (!day || day.is_rest) continue;
    if (i > 0 && !shifted && r() < 0.08) continue; // alguna sesión salteada
    const dayItems = items.filter((it) => it.routine_id === ppl.id && it.day_of_week === dow);
    const slots = [...new Set(dayItems.map((it) => it.order_index))].sort((a, b) => a - b);
    const limit = i === 0 ? 2 : slots.length; // hoy: entrenamiento a medias
    for (const oi of slots.slice(0, limit)) {
      const alts = dayItems.filter((it) => it.order_index === oi).sort((a, b) => a.variant - b.variant);
      const key = dow + '-' + oi;
      if (!slotChoice.has(key) || r() < 0.2) slotChoice.set(key, Math.floor(r() * alts.length));
      const it = alts[Math.min(slotChoice.get(key)!, alts.length - 1)];
      const progress = 1 + ((98 - i) / 98) * 0.12;
      const bw = baseWeight.get(it.exercise_id) ?? 0;
      const step = bw >= 40 ? 2.5 : 1;
      const w = bw > 0 ? round(bw * progress, step) : null;
      const topReps = Number.parseInt(it.reps_target ?? '10', 10) || 10;
      for (let s = 1; s <= (it.sets_target ?? 3); s++) {
        const reps = Math.max(3, topReps + 2 - s - Math.floor(r() * 2));
        logs.push({
          id: uid(),
          exercise_id: it.exercise_id,
          session_date: date,
          set_number: s,
          weight: w,
          reps: bw === 0 && it.reps_target === '45s' ? 45 : reps,
        });
      }
    }
  }

  return { entries, goals, phases, exercises, routines: [ppl, fb], days, items, logs };
}

const wait = <T>(v: T, ms = 120) => new Promise<T>((res) => setTimeout(() => res(structuredClone(v)), ms));

/** En demo se puede simular que no hay señal: localStorage 'demo-offline' = '1'. */
export const demoOffline = () => localStorage.getItem('demo-offline') === '1';

export function createDemoApi(): Api {
  const api = createDemoApiInner();
  // cualquier llamada (salvo la sesión) falla como sin red mientras se simula estar offline
  return new Proxy(api, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== 'function' || ['getUser', 'onAuthChange', 'signIn', 'signOut'].includes(String(prop))) return v;
      return (...args: unknown[]) =>
        demoOffline()
          ? Promise.reject(new BackendError('Sin conexión', 'network'))
          : (v as (...a: unknown[]) => unknown).apply(target, args);
    },
  });
}

function createDemoApiInner(): Api {
  const db = seed();
  let user: AuthUser | null = { id: 'demo-user', email: 'demo@fittracker.app' };
  const listeners = new Set<(u: AuthUser | null) => void>();
  let goalId = 10;

  return {
    mode: 'demo',
    getUser: () => wait(user, 0),
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn(email) {
      user = { id: 'demo-user', email };
      listeners.forEach((l) => l(user));
    },
    async signOut() {
      user = null;
      listeners.forEach((l) => l(null));
    },

    listWeightEntries: () => wait(db.entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1))),
    async saveWeightEntry(input) {
      const e: WeightEntry = { ...input, updated_at: new Date().toISOString() };
      db.entries = db.entries.filter((x) => x.date !== input.date).concat(e);
      return wait(e);
    },
    async deleteWeightEntry(prev) {
      db.entries = db.entries.filter((x) => x.date !== prev.date);
      await wait(null);
    },
    listGoals: () => wait(db.goals),
    async addGoal(input) {
      const g: WeightGoal = { id: goalId++, ...input, created_at: new Date().toISOString() };
      db.goals.push(g);
      return wait(g);
    },
    listPhases: () => wait(db.phases),
    async createPhase(input) {
      const p: Phase = { id: uid(), ...input, created_at: new Date().toISOString() };
      db.phases.push(p);
      return wait(p);
    },
    async updatePhase(id, patch) {
      const p = db.phases.find((x) => x.id === id)!;
      Object.assign(p, patch);
      return wait(p);
    },
    async deletePhase(id) {
      db.phases = db.phases.filter((x) => x.id !== id);
      await wait(null);
    },

    listExercises: () => wait(db.exercises),
    async createExercise(input) {
      const e: Exercise = { id: uid(), ...input, created_at: new Date().toISOString() };
      db.exercises.push(e);
      return wait(e);
    },
    async updateExercise(id, patch) {
      const e = db.exercises.find((x) => x.id === id)!;
      Object.assign(e, patch);
      return wait(e);
    },
    async deleteExercise(id) {
      db.exercises = db.exercises.filter((x) => x.id !== id);
      db.items = db.items.filter((x) => x.exercise_id !== id);
      db.logs = db.logs.filter((x) => x.exercise_id !== id);
      await wait(null);
    },

    listRoutineData: () => wait<RoutineData>({ routines: db.routines, days: db.days, items: db.items }),
    async createRoutine({ name, activate, copy }) {
      const routine: Routine = { id: uid(), name, is_active: false, created_at: new Date().toISOString() };
      db.routines.push(routine);
      if (copy) {
        db.days.push(...copy.days.map((d) => ({ ...d, routine_id: routine.id })));
        db.items.push(...copy.items.map((i) => ({ ...i, routine_id: routine.id })));
      }
      if (activate) {
        db.routines.forEach((r) => (r.is_active = r.id === routine.id));
      }
      return wait(routine);
    },
    async renameRoutine(id, name) {
      db.routines.find((r) => r.id === id)!.name = name;
      await wait(null);
    },
    async deleteRoutine(id) {
      db.routines = db.routines.filter((r) => r.id !== id);
      db.days = db.days.filter((d) => d.routine_id !== id);
      db.items = db.items.filter((i) => i.routine_id !== id);
      await wait(null);
    },
    async setActiveRoutine(id) {
      db.routines.forEach((r) => (r.is_active = r.id === id));
      await wait(null);
    },
    async saveRoutineDay(routineId, dow, day, items) {
      db.days = db.days.filter((d) => !(d.routine_id === routineId && d.day_of_week === dow));
      db.days.push({ routine_id: routineId, day_of_week: dow, ...day });
      db.items = db.items.filter((i) => !(i.routine_id === routineId && i.day_of_week === dow));
      db.items.push(...items.map((i) => ({ ...i, routine_id: routineId, day_of_week: dow })));
      await wait(null);
    },

    listLogs: () => wait(db.logs),
    async replaceSessionSets(exerciseId, date, sets) {
      db.logs = db.logs.filter((l) => !(l.exercise_id === exerciseId && l.session_date === date));
      const rows: SetLog[] = sets.map((s, i) => ({
        id: uid(),
        exercise_id: exerciseId,
        session_date: date,
        set_number: i + 1,
        weight: s.weight,
        reps: s.reps,
      }));
      db.logs.push(...rows);
      return wait(rows);
    },
  };
}
