import type {
  Exercise,
  ISODate,
  MuscleGroup,
  Phase,
  PhaseKind,
  PlanDay,
  PlanItem,
  PlanItemInput,
  Routine,
  RoutineData,
  SetInput,
  SetLog,
  WeightEntry,
  WeightGoal,
} from '@/lib/types';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Api {
  readonly mode: 'live' | 'demo';

  // auth
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  // peso
  listWeightEntries(): Promise<WeightEntry[]>;
  saveWeightEntry(input: { date: ISODate; weight: number; note: string }, previous: WeightEntry | null): Promise<WeightEntry>;
  deleteWeightEntry(previous: WeightEntry): Promise<void>;
  listGoals(): Promise<WeightGoal[]>;
  addGoal(input: { target_weight: number | null; target_date: ISODate | null }): Promise<WeightGoal>;
  listPhases(): Promise<Phase[]>;
  createPhase(input: { phase: PhaseKind; start_date: ISODate; end_date: ISODate | null }): Promise<Phase>;
  updatePhase(id: string, patch: Partial<Pick<Phase, 'phase' | 'start_date' | 'end_date'>>): Promise<Phase>;
  deletePhase(id: string): Promise<void>;

  // ejercicios
  listExercises(): Promise<Exercise[]>;
  createExercise(input: { name: string; muscle_group: MuscleGroup | null }): Promise<Exercise>;
  updateExercise(id: string, patch: { name?: string; muscle_group?: MuscleGroup | null }): Promise<Exercise>;
  deleteExercise(id: string): Promise<void>;

  // rutinas
  listRoutineData(): Promise<RoutineData>;
  createRoutine(input: { name: string; activate: boolean; copy?: { days: PlanDay[]; items: PlanItem[] } }): Promise<Routine>;
  renameRoutine(id: string, name: string): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  setActiveRoutine(id: string): Promise<void>;
  saveRoutineDay(
    routineId: string,
    dayOfWeek: number,
    day: { name: string; is_rest: boolean },
    items: PlanItemInput[],
  ): Promise<void>;

  // series
  listLogs(): Promise<SetLog[]>;
  /**
   * Reemplaza las series de un ejercicio en una fecha. Si alguna serie es en ladrillos o por lado y
   * la base todavía no tiene esas columnas, falla con `SET_OPTIONS_MISSING` en vez de guardarla como
   * kg / ambos lados sin avisar.
   */
  replaceSessionSets(exerciseId: string, date: ISODate, sets: SetInput[]): Promise<SetLog[]>;
  /** ¿La base ya tiene la migración de ladrillos y series por lado (weight_unit / reps_right)? */
  supportsSetOptions(): Promise<boolean>;
}

export const SET_OPTIONS_MISSING = 'set_options_missing';

/** true si alguna serie necesita las columnas nuevas (ladrillos o por lado). */
export const needsSetOptions = (sets: SetInput[]) => sets.some((s) => s.weight_unit === 'ladrillos' || s.reps_right != null);

export const setOptionsMissingError = () =>
  new BackendError('Falta aplicar en Supabase la migración de ladrillos y series por lado: no se guardó.', SET_OPTIONS_MISSING);

/** Error del backend normalizado. `missingSchema` = falta aplicar la migración de la 2.0. */
export class BackendError extends Error {
  code?: string;
  missingSchema: boolean;
  /** no se pudo llegar al servidor (sin conexión o señal muy mala) */
  network: boolean;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.network = code === 'network';
    this.missingSchema = code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' || code === '42703';
  }
}
