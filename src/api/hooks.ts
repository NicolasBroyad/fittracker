import { useMemo } from 'react';
import { focusManager, onlineManager, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { buildIndex } from '@/lib/training';
import { sortEntries } from '@/lib/weight';
import type {
  Exercise,
  ISODate,
  MuscleGroup,
  Phase,
  PhaseKind,
  PlanDay,
  PlanItem,
  PlanItemInput,
  RoutineData,
  SetInput,
  SetLog,
  WeightEntry,
  WeightGoal,
} from '@/lib/types';
import { isNetworkError, reportNetworkFailure } from './connectivity';
import { api, BackendError } from './index';

export const qk = {
  entries: ['weight', 'entries'] as const,
  goals: ['weight', 'goals'] as const,
  phases: ['weight', 'phases'] as const,
  exercises: ['exercises'] as const,
  routines: ['routines'] as const,
  logs: ['logs'] as const,
};

// ── Sin conexión ───────────────────────────────────────────────────────────
//
// Las acciones del día a día (series, peso, orden de la rutina) funcionan sin señal: se aplican al
// instante en pantalla, quedan en cola (persistida en el celular, sobrevive a cerrar la app) y se
// suben solas y en orden cuando vuelve la conexión. El resto de las acciones (crear ejercicios,
// rutinas, metas…) necesitan conexión y fallan enseguida con un aviso.

export interface SaveWeightVars {
  date: ISODate;
  weight: number;
  note: string;
  previous: WeightEntry | null;
}
export interface ReplaceSetsVars {
  exerciseId: string;
  date: ISODate;
  sets: SetInput[];
}
const offlineKeys = {
  saveWeight: ['offline', 'saveWeight'],
  deleteWeight: ['offline', 'deleteWeight'],
  replaceSets: ['offline', 'replaceSets'],
  saveRoutineDay: ['offline', 'saveRoutineDay'],
} as const;

// las mismas funciones las usan los hooks y las mutaciones restauradas después de reabrir la app
const offlineFns = {
  saveWeight: (v: SaveWeightVars) => api().saveWeightEntry({ date: v.date, weight: v.weight, note: v.note }, v.previous),
  deleteWeight: (entry: WeightEntry) => api().deleteWeightEntry(entry),
  replaceSets: (v: ReplaceSetsVars) => api().replaceSessionSets(v.exerciseId, v.date, v.sets),
  saveRoutineDay: (v: SaveDayVars) =>
    api().saveRoutineDay(v.routineId, v.dayOfWeek, { name: v.name, is_rest: v.isRest }, v.items),
};

const offlineOptions = {
  networkMode: 'online' as const,
  // un solo carril: se suben en el orden en que se hicieron
  scope: { id: 'offline' },
  retry: (count: number, err: unknown) => {
    if (isNetworkError(err)) {
      reportNetworkFailure();
      return true;
    }
    return count < 1;
  },
  retryDelay: (n: number) => Math.min(1000 * 2 ** n, 30_000),
};

export function createQueryClient() {
  const qc: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24 * 30,
        retry: (count, err) => {
          if (isNetworkError(err)) {
            reportNetworkFailure();
            return true;
          }
          return !(err instanceof BackendError && err.missingSchema) && count < 2;
        },
        // con cambios en cola no se refresca: los datos del servidor todavía no los tienen
        refetchOnWindowFocus: () => qc.isMutating() === 0,
        refetchOnReconnect: false,
      },
      mutations: { networkMode: 'always' },
    },
  });
  qc.setMutationDefaults(offlineKeys.saveWeight, { ...offlineOptions, mutationFn: offlineFns.saveWeight });
  qc.setMutationDefaults(offlineKeys.deleteWeight, { ...offlineOptions, mutationFn: offlineFns.deleteWeight });
  qc.setMutationDefaults(offlineKeys.replaceSets, { ...offlineOptions, mutationFn: offlineFns.replaceSets });
  qc.setMutationDefaults(offlineKeys.saveRoutineDay, { ...offlineOptions, mutationFn: offlineFns.saveRoutineDay });
  // al volver la conexión: primero se sube la cola, después se trae lo último del servidor
  onlineManager.subscribe((online) => {
    if (online) void syncAfterReconnect(qc);
  });
  // la cola solo avanza con la app en primer plano: si la señal volvió con el celu bloqueado o la
  // app en segundo plano, se sube al volver a abrirla
  focusManager.subscribe((focused) => {
    if (
      focused &&
      onlineManager.isOnline() &&
      qc
        .getMutationCache()
        .getAll()
        .some((m) => m.state.isPaused)
    ) {
      void syncAfterReconnect(qc);
    }
  });
  return qc;
}

/** Al reabrir la app: continúa (en orden) todo lo que quedó pendiente de la sesión anterior. */
export async function resumeRestored(qc: QueryClient) {
  const pending = qc
    .getMutationCache()
    .getAll()
    .filter((m) => m.state.status === 'pending');
  for (const m of pending) await m.continue().catch(() => undefined);
  if (pending.length) await qc.invalidateQueries();
}

export async function syncAfterReconnect(qc: QueryClient) {
  await qc.resumePausedMutations();
  await qc.invalidateQueries();
}

function errorMessage(e: unknown): string {
  if (isNetworkError(e)) return 'Sin conexión: esto necesita internet';
  if (e instanceof BackendError && e.missingSchema) return 'Falta aplicar la migración de la 2.0 en Supabase';
  if (e instanceof Error) return e.message;
  return 'Algo salió mal';
}

const onError = (e: unknown) => toast.error('No se pudo guardar', { description: errorMessage(e) });

// ── Queries ────────────────────────────────────────────────────────────────

export const useEntriesQuery = () => useQuery({ queryKey: qk.entries, queryFn: () => api().listWeightEntries() });
export const useGoalsQuery = () => useQuery({ queryKey: qk.goals, queryFn: () => api().listGoals() });
export const usePhasesQuery = () => useQuery({ queryKey: qk.phases, queryFn: () => api().listPhases() });
export const useExercisesQuery = () => useQuery({ queryKey: qk.exercises, queryFn: () => api().listExercises() });
export const useRoutinesQuery = () => useQuery({ queryKey: qk.routines, queryFn: () => api().listRoutineData() });
export const useLogsQuery = () => useQuery({ queryKey: qk.logs, queryFn: () => api().listLogs() });

const EMPTY: never[] = [];

export function useEntries(): WeightEntry[] {
  const { data } = useEntriesQuery();
  return useMemo(() => (data ? sortEntries(data) : EMPTY), [data]);
}

export function useGoals(): WeightGoal[] {
  return useGoalsQuery().data ?? EMPTY;
}

export function usePhases(): Phase[] {
  return usePhasesQuery().data ?? EMPTY;
}

export function useExercises(): Exercise[] {
  return useExercisesQuery().data ?? EMPTY;
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}

export function useTrainingIndex() {
  const { data } = useLogsQuery();
  return useMemo(() => buildIndex(data ?? EMPTY), [data]);
}

// ── Peso ───────────────────────────────────────────────────────────────────

export function useSaveWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: offlineKeys.saveWeight,
    ...offlineOptions,
    mutationFn: offlineFns.saveWeight,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.entries });
      const prev = qc.getQueryData<WeightEntry[]>(qk.entries);
      qc.setQueryData<WeightEntry[]>(qk.entries, (old = []) =>
        old.filter((e) => e.date !== v.date).concat({ date: v.date, weight: v.weight, note: v.note }),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.entries, ctx.prev);
      onError(e);
    },
    onSuccess: (row) => {
      qc.setQueryData<WeightEntry[]>(qk.entries, (old = []) => old.filter((e) => e.date !== row.date).concat(row));
    },
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: offlineKeys.deleteWeight,
    ...offlineOptions,
    mutationFn: offlineFns.deleteWeight,
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: qk.entries });
      const prev = qc.getQueryData<WeightEntry[]>(qk.entries);
      qc.setQueryData<WeightEntry[]>(qk.entries, (old = []) => old.filter((e) => e.date !== entry.date));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.entries, ctx.prev);
      onError(e);
    },
  });
}

export function useAddGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { target_weight: number | null; target_date: ISODate | null }) => api().addGoal(v),
    onSuccess: (g) => qc.setQueryData<WeightGoal[]>(qk.goals, (old = []) => old.concat(g)),
    onError,
  });
}

export function useCreatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { phase: PhaseKind; start_date: ISODate; end_date: ISODate | null; closeOpen: Phase | null }) => {
      // si queda otra fase "en curso" pisándose con la nueva, se cierra el día anterior al inicio de la nueva
      if (v.closeOpen) {
        const end = v.closeOpen.start_date < v.start_date ? prevDay(v.start_date) : v.closeOpen.start_date;
        await api().updatePhase(v.closeOpen.id, { end_date: end });
      }
      return api().createPhase({ phase: v.phase, start_date: v.start_date, end_date: v.end_date });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.phases }),
    onError,
  });
}

function prevDay(iso: ISODate): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<Pick<Phase, 'phase' | 'start_date' | 'end_date'>> }) =>
      api().updatePhase(v.id, v.patch),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.phases });
      const prev = qc.getQueryData<Phase[]>(qk.phases);
      qc.setQueryData<Phase[]>(qk.phases, (old = []) => old.map((p) => (p.id === v.id ? { ...p, ...v.patch } : p)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.phases, ctx.prev);
      onError(e);
    },
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().deletePhase(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.phases });
      const prev = qc.getQueryData<Phase[]>(qk.phases);
      qc.setQueryData<Phase[]>(qk.phases, (old = []) => old.filter((p) => p.id !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.phases, ctx.prev);
      onError(e);
    },
  });
}

// ── Ejercicios ─────────────────────────────────────────────────────────────

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; muscle_group: MuscleGroup | null }) => api().createExercise(v),
    onSuccess: (e) => qc.setQueryData<Exercise[]>(qk.exercises, (old = []) => old.concat(e)),
    onError,
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string; muscle_group: MuscleGroup | null }) =>
      api().updateExercise(v.id, { name: v.name, muscle_group: v.muscle_group }),
    onSuccess: (e) => qc.setQueryData<Exercise[]>(qk.exercises, (old = []) => old.map((x) => (x.id === e.id ? e : x))),
    onError,
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().deleteExercise(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<Exercise[]>(qk.exercises, (old = []) => old.filter((x) => x.id !== id));
      qc.setQueryData<RoutineData>(qk.routines, (old) => old && { ...old, items: old.items.filter((i) => i.exercise_id !== id) });
      qc.setQueryData<SetLog[]>(qk.logs, (old = []) => old.filter((l) => l.exercise_id !== id));
    },
    onError,
  });
}

// ── Rutinas ────────────────────────────────────────────────────────────────

function useRoutineMutation<V>(
  mutationFn: (v: V) => Promise<unknown>,
  optimistic: (old: RoutineData, v: V) => RoutineData,
  opts: { invalidate?: boolean; offline?: keyof typeof offlineKeys } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    ...(opts.offline ? { mutationKey: offlineKeys[opts.offline], ...offlineOptions } : {}),
    mutationFn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: qk.routines });
      const prev = qc.getQueryData<RoutineData>(qk.routines);
      if (prev) qc.setQueryData<RoutineData>(qk.routines, optimistic(prev, v));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.routines, ctx.prev);
      onError(e);
    },
    onSettled: () => {
      if (opts.invalidate) qc.invalidateQueries({ queryKey: qk.routines });
    },
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; activate: boolean; copy?: { days: PlanDay[]; items: PlanItem[] } }) => api().createRoutine(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.routines }),
    onError,
  });
}

export function useRenameRoutine() {
  return useRoutineMutation(
    (v: { id: string; name: string }) => api().renameRoutine(v.id, v.name),
    (old, v) => ({ ...old, routines: old.routines.map((r) => (r.id === v.id ? { ...r, name: v.name } : r)) }),
  );
}

export function useDeleteRoutine() {
  return useRoutineMutation(
    (id: string) => api().deleteRoutine(id),
    (old, id) => ({
      routines: old.routines.filter((r) => r.id !== id),
      days: old.days.filter((d) => d.routine_id !== id),
      items: old.items.filter((i) => i.routine_id !== id),
    }),
  );
}

export function useSetActiveRoutine() {
  return useRoutineMutation(
    (id: string) => api().setActiveRoutine(id),
    (old, id) => ({ ...old, routines: old.routines.map((r) => ({ ...r, is_active: r.id === id })) }),
  );
}

export interface SaveDayVars {
  routineId: string;
  dayOfWeek: number;
  name: string;
  isRest: boolean;
  items: PlanItemInput[];
}

export function useSaveRoutineDay() {
  return useRoutineMutation(
    offlineFns.saveRoutineDay,
    (old, v) => {
      const same = (x: { routine_id: string; day_of_week: number }) =>
        x.routine_id === v.routineId && x.day_of_week === v.dayOfWeek;
      return {
        routines: old.routines,
        days: old.days
          .filter((d) => !same(d))
          .concat({ routine_id: v.routineId, day_of_week: v.dayOfWeek, name: v.name, is_rest: v.isRest }),
        items: old.items
          .filter((i) => !same(i))
          .concat(v.items.map((i) => ({ ...i, routine_id: v.routineId, day_of_week: v.dayOfWeek }))),
      };
    },
    { offline: 'saveRoutineDay' },
  );
}

// ── Series ─────────────────────────────────────────────────────────────────

export function useReplaceSets() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: offlineKeys.replaceSets,
    ...offlineOptions,
    mutationFn: offlineFns.replaceSets,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.logs });
      const prev = qc.getQueryData<SetLog[]>(qk.logs);
      qc.setQueryData<SetLog[]>(qk.logs, (old = []) =>
        old
          .filter((l) => !(l.exercise_id === v.exerciseId && l.session_date === v.date))
          .concat(
            v.sets.map((s, i) => ({
              id: `tmp-${v.exerciseId}-${v.date}-${i}`,
              exercise_id: v.exerciseId,
              session_date: v.date,
              set_number: i + 1,
              weight: s.weight,
              reps: s.reps,
            })),
          ),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.logs, ctx.prev);
      onError(e);
    },
    onSuccess: (rows, v) => {
      qc.setQueryData<SetLog[]>(qk.logs, (old = []) =>
        old.filter((l) => !(l.exercise_id === v.exerciseId && l.session_date === v.date)).concat(rows),
      );
    },
  });
}
