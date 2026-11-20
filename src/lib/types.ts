/** Fecha de calendario local en formato YYYY-MM-DD. */
export type ISODate = string;

export type PhaseKind = 'volumen' | 'definicion' | 'mantenimiento';

export type MuscleGroup =
  'Pecho' | 'Espalda' | 'Hombro' | 'Biceps' | 'Tricep' | 'Antebrazo' | 'Pierna' | 'Gluteo' | 'Gemelo' | 'Abdomen';

export interface WeightEntry {
  date: ISODate;
  weight: number;
  note: string;
  updated_at?: string;
}

export interface WeightGoal {
  id: number;
  target_weight: number | null;
  target_date: ISODate | null;
  created_at: string;
}

export interface Phase {
  id: string;
  phase: PhaseKind;
  start_date: ISODate;
  end_date: ISODate | null;
  created_at?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup | null;
  created_at: string;
}

export interface Routine {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PlanDay {
  routine_id: string;
  day_of_week: number;
  name: string;
  is_rest: boolean;
}

export interface PlanItem {
  routine_id: string;
  day_of_week: number;
  exercise_id: string;
  order_index: number;
  variant: number;
  sets_target: number | null;
  reps_target: string | null;
}

export interface RoutineData {
  routines: Routine[];
  days: PlanDay[];
  items: PlanItem[];
}

/** Unidad del peso de una serie: kg, o ladrillos/placas de máquinas que no dicen cuánto pesan. */
export type WeightUnit = 'kg' | 'ladrillos';

export interface SetLog {
  id: string;
  exercise_id: string;
  session_date: ISODate;
  set_number: number;
  weight: number | null;
  /** en una serie por lado, las del lado izquierdo */
  reps: number | null;
  weight_unit: WeightUnit;
  /** reps del lado derecho en una serie por lado; null = ambos lados juntos */
  reps_right: number | null;
  created_at?: string;
}

export interface SetInput {
  weight: number | null;
  reps: number | null;
  weight_unit: WeightUnit;
  reps_right: number | null;
}

/** Reloj Garmin vinculado (la app del reloj vive en el repo fittracker-garmin). */
export interface WatchDevice {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
}

/** Lo que midió el reloj en un día (lo sube la app del reloj cada vez que se abre). */
export interface WatchDay {
  date: ISODate;
  steps: number | null;
  step_goal: number | null;
  /** kcal del día, incluidas las de reposo */
  calories: number | null;
  distance_m: number | null;
  active_minutes: number | null;
  resting_hr: number | null;
  /** cuándo lo subió el reloj por última vez */
  updated_at: string;
}

/** Actividad grabada en el reloj (cardio, fuerza…). Connect IQ no da calorías ni FC de cada una. */
export interface WatchActivity {
  start_time: string;
  /** deporte de Garmin (FIT): 1 carrera, 2 ciclismo, 10 entrenamiento, 11 caminata… */
  sport: number | null;
  duration_s: number | null;
  distance_m: number | null;
}

/** Ítem de un día de rutina tal como lo edita/guarda el cliente (sin routine_id/day). */
export interface PlanItemInput {
  exercise_id: string;
  order_index: number;
  variant: number;
  sets_target: number | null;
  reps_target: string | null;
}
