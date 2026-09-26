import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Exercise, Phase, PlanDay, PlanItem, Routine, SetLog, WeightEntry, WeightGoal } from '@/lib/types';
import { BackendError, type Api, type AuthUser } from './types';

// URL y anon key son públicas por diseño: la seguridad real la da Row Level Security.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ogqbvooefjojaovxhhcx.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncWJ2b29lZmpvamFvdnhoaGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDczMjIsImV4cCI6MjEwMjIyMzMyMn0.5oMxu9TW87uMqUFVFe00r1M_wfs-brja4OJ0Ynf3R_Q';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

const PAGE = 1000; // max-rows por defecto de PostgREST en Supabase

const NETWORK_RE =
  /failed to fetch|load failed|networkerror|network request failed|fetch failed|the internet connection appears to be offline|err_internet/i;

/** supabase-js no tira excepción si no hay red: devuelve un error con el mensaje del fetch. */
function fail(error: PostgrestError | { message: string; code?: string }): never {
  if (NETWORK_RE.test(error.message ?? '')) throw new BackendError('Sin conexión', 'network');
  throw new BackendError(error.message, error.code);
}

/**
 * Usuario de la sesión guardada en el celular. Sin conexión y con el token vencido, supabase-js no
 * puede refrescarlo y getSession() devuelve null aunque la sesión siga guardada: en ese caso se usa
 * la guardada para no mandar al login a alguien que solo está sin señal.
 */
function storedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`);
    const u = raw ? JSON.parse(raw)?.user : null;
    return u?.id ? { id: u.id, email: u.email ?? '' } : null;
  } catch {
    return null;
  }
}

/** Trae todas las filas paginando de a 1000 (PostgREST corta ahí sin avisar). */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) fail(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

const toEntry = (r: Record<string, unknown>): WeightEntry => ({
  date: r.date as string,
  weight: Number(r.weight),
  note: (r.note as string) ?? '',
  updated_at: r.updated_at as string,
});

const toGoal = (r: Record<string, unknown>): WeightGoal => ({
  id: r.id as number,
  target_weight: num(r.target_weight),
  target_date: (r.target_date as string) ?? null,
  created_at: r.created_at as string,
});

const toLog = (r: Record<string, unknown>): SetLog => ({
  id: r.id as string,
  exercise_id: r.exercise_id as string,
  session_date: r.session_date as string,
  set_number: Number(r.set_number),
  weight: num(r.weight),
  reps: num(r.reps),
  created_at: r.created_at as string,
});

async function userId(): Promise<string> {
  const { data, error } = await sb.auth.getSession();
  const id = data.session?.user.id ?? (error ? storedUser()?.id : undefined);
  if (!id) throw new BackendError('No hay sesión iniciada', 'no_session');
  return id;
}

const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

export const liveApi: Api = {
  mode: 'live',

  async getUser() {
    const { data, error } = await sb.auth.getSession();
    if (data.session) return toUser(data.session.user);
    return error ? storedUser() : null;
  },

  onAuthChange(cb) {
    const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)));
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message) ? 'Email o contraseña incorrectos' : error.message;
      throw new BackendError(msg, error.code);
    }
  },

  async signOut() {
    await sb.auth.signOut();
  },

  // ── Peso ─────────────────────────────────────────────────────────────────

  async listWeightEntries() {
    const rows = await fetchAll((from, to) =>
      sb.from('weight_entries').select('date, weight, note, updated_at').order('date').range(from, to),
    );
    return rows.map(toEntry);
  },

  async saveWeightEntry(input, previous) {
    const uid = await userId();
    const { data, error } = await sb
      .from('weight_entries')
      .upsert(
        { user_id: uid, date: input.date, weight: input.weight, note: input.note, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      )
      .select('date, weight, note, updated_at')
      .single();
    if (error) fail(error);
    // historial de cambios (inmutable); si falla no invalida el guardado
    void sb.from('weight_entries_log').insert({
      entry_date: input.date,
      action: previous ? 'updated' : 'created',
      previous_weight: previous?.weight ?? null,
      previous_note: previous?.note ?? null,
      new_weight: input.weight,
      new_note: input.note,
    });
    return toEntry(data);
  },

  async deleteWeightEntry(previous) {
    const { error } = await sb.from('weight_entries').delete().eq('date', previous.date);
    if (error) fail(error);
    void sb.from('weight_entries_log').insert({
      entry_date: previous.date,
      action: 'deleted',
      previous_weight: previous.weight,
      previous_note: previous.note,
    });
  },

  async listGoals() {
    const { data, error } = await sb
      .from('weight_goals')
      .select('id, target_weight, target_date, created_at')
      .order('created_at');
    if (error) fail(error);
    return (data ?? []).map(toGoal);
  },

  async addGoal(input) {
    const { data, error } = await sb
      .from('weight_goals')
      .insert({ target_weight: input.target_weight, target_date: input.target_date })
      .select('id, target_weight, target_date, created_at')
      .single();
    if (error) fail(error);
    return toGoal(data);
  },

  async listPhases() {
    const { data, error } = await sb
      .from('weight_phases')
      .select('id, phase, start_date, end_date, created_at')
      .order('start_date');
    if (error) fail(error);
    return (data ?? []) as Phase[];
  },

  async createPhase(input) {
    const { data, error } = await sb
      .from('weight_phases')
      .insert(input)
      .select('id, phase, start_date, end_date, created_at')
      .single();
    if (error) fail(error);
    return data as Phase;
  },

  async updatePhase(id, patch) {
    const { data, error } = await sb
      .from('weight_phases')
      .update(patch)
      .eq('id', id)
      .select('id, phase, start_date, end_date, created_at')
      .single();
    if (error) fail(error);
    return data as Phase;
  },

  async deletePhase(id) {
    const { error } = await sb.from('weight_phases').delete().eq('id', id);
    if (error) fail(error);
  },

  // ── Ejercicios ───────────────────────────────────────────────────────────

  async listExercises() {
    const rows = await fetchAll((from, to) =>
      sb.from('routine_exercises').select('id, name, muscle_group, created_at').order('created_at').order('id').range(from, to),
    );
    return rows as Exercise[];
  },

  async createExercise(input) {
    const { data, error } = await sb
      .from('routine_exercises')
      .insert({ name: input.name, muscle_group: input.muscle_group })
      .select('id, name, muscle_group, created_at')
      .single();
    if (error) fail(error);
    return data as Exercise;
  },

  async updateExercise(id, patch) {
    const { data, error } = await sb
      .from('routine_exercises')
      .update(patch)
      .eq('id', id)
      .select('id, name, muscle_group, created_at')
      .single();
    if (error) fail(error);
    return data as Exercise;
  },

  async deleteExercise(id) {
    const { error } = await sb.from('routine_exercises').delete().eq('id', id);
    if (error) fail(error);
  },

  // ── Rutinas ──────────────────────────────────────────────────────────────

  async listRoutineData() {
    const [r, d, i] = await Promise.all([
      sb.from('routines').select('id, name, is_active, created_at').order('created_at'),
      sb.from('routine_plan_days').select('routine_id, day_of_week, name, is_rest'),
      fetchAll((from, to) =>
        sb
          .from('routine_plan_exercises')
          .select('routine_id, day_of_week, exercise_id, order_index, variant, sets_target, reps_target')
          .order('routine_id')
          .order('day_of_week')
          .order('exercise_id')
          .range(from, to),
      ),
    ]);
    if (r.error) fail(r.error);
    if (d.error) fail(d.error);
    return {
      routines: (r.data ?? []) as Routine[],
      days: (d.data ?? []) as PlanDay[],
      items: i as PlanItem[],
    };
  },

  async createRoutine({ name, activate, copy }) {
    const { data, error } = await sb
      .from('routines')
      .insert({ name, is_active: false })
      .select('id, name, is_active, created_at')
      .single();
    if (error) fail(error);
    const routine = data as Routine;
    if (copy) {
      if (copy.days.length) {
        const { error: e } = await sb
          .from('routine_plan_days')
          .insert(
            copy.days.map((d) => ({ routine_id: routine.id, day_of_week: d.day_of_week, name: d.name, is_rest: d.is_rest })),
          );
        if (e) fail(e);
      }
      if (copy.items.length) {
        const { error: e } = await sb.from('routine_plan_exercises').insert(
          copy.items.map((it) => ({
            routine_id: routine.id,
            day_of_week: it.day_of_week,
            exercise_id: it.exercise_id,
            order_index: it.order_index,
            variant: it.variant,
            sets_target: it.sets_target,
            reps_target: it.reps_target,
          })),
        );
        if (e) fail(e);
      }
    }
    if (activate) {
      const { error: e } = await sb.rpc('set_active_routine', { p_routine_id: routine.id });
      if (e) fail(e);
      routine.is_active = true;
    }
    return routine;
  },

  async renameRoutine(id, name) {
    const { error } = await sb.from('routines').update({ name }).eq('id', id);
    if (error) fail(error);
  },

  async deleteRoutine(id) {
    const { error } = await sb.from('routines').delete().eq('id', id);
    if (error) fail(error);
  },

  async setActiveRoutine(id) {
    const { error } = await sb.rpc('set_active_routine', { p_routine_id: id });
    if (error) fail(error);
  },

  async saveRoutineDay(routineId, dayOfWeek, day, items) {
    const { error } = await sb.rpc('save_routine_day', {
      p_routine_id: routineId,
      p_day: dayOfWeek,
      p_name: day.name,
      p_is_rest: day.is_rest,
      p_items: items,
    });
    if (error) fail(error);
  },

  // ── Series ───────────────────────────────────────────────────────────────

  async listLogs() {
    const rows = await fetchAll((from, to) =>
      sb
        .from('routine_logs')
        .select('id, exercise_id, session_date, set_number, weight, reps, created_at')
        .order('session_date')
        .order('id')
        .range(from, to),
    );
    return rows.map(toLog);
  },

  async replaceSessionSets(exerciseId, date, sets) {
    const { data, error } = await sb.rpc('replace_session_sets', {
      p_exercise_id: exerciseId,
      p_session_date: date,
      p_sets: sets,
    });
    if (error) fail(error);
    return ((data ?? []) as Record<string, unknown>[]).map(toLog);
  },
};
