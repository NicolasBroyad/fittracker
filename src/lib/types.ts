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

export interface SetLog {
  id: string;
  exercise_id: string;
  session_date: ISODate;
  set_number: number;
  weight: number | null;
  reps: number | null;
  created_at?: string;
}

export interface SetInput {
  weight: number | null;
  reps: number | null;
}

/** Ítem de un día de rutina tal como lo edita/guarda el cliente (sin routine_id/day). */
export interface PlanItemInput {
  exercise_id: string;
  order_index: number;
  variant: number;
  sets_target: number | null;
  reps_target: string | null;
}
