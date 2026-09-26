import type { MuscleGroup, PhaseKind } from './types';

export const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'Pecho', label: 'Pecho' },
  { value: 'Espalda', label: 'Espalda' },
  { value: 'Hombro', label: 'Hombros' },
  { value: 'Biceps', label: 'Bíceps' },
  { value: 'Tricep', label: 'Tríceps' },
  { value: 'Antebrazo', label: 'Antebrazos' },
  { value: 'Pierna', label: 'Piernas' },
  { value: 'Gluteo', label: 'Glúteos' },
  { value: 'Gemelo', label: 'Gemelos' },
  { value: 'Abdomen', label: 'Abdomen' },
];

export const MUSCLE_LABEL: Record<string, string> = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.value, m.label]));

export const PHASES: { value: PhaseKind; label: string; short: string; color: string; hint: string }[] = [
  { value: 'volumen', label: 'Volumen', short: 'Vol.', color: 'var(--vol)', hint: 'Superávit calórico para ganar masa' },
  { value: 'definicion', label: 'Definición', short: 'Def.', color: 'var(--def)', hint: 'Déficit calórico para perder grasa' },
  { value: 'mantenimiento', label: 'Mantenimiento', short: 'Mant.', color: 'var(--man)', hint: 'Sostener el peso actual' },
];

export const PHASE_META: Record<PhaseKind, (typeof PHASES)[number]> = Object.fromEntries(
  PHASES.map((p) => [p.value, p]),
) as Record<PhaseKind, (typeof PHASES)[number]>;

/** Índice 0 = lunes (day_of_week 1). */
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DAY_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
