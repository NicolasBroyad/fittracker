import { mondayOf } from './utils.js';

export const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const DOW_ABBR = ['lun','mar','mié','jue','vie','sáb','dom'];
export const MUSCLE_GROUPS = ['Pierna','Pecho','Hombro','Tricep','Biceps','Espalda'];
export const MUSCLE_GROUP_LABELS = { Pierna:'Pierna', Pecho:'Pecho', Hombro:'Hombro', Tricep:'Tríceps', Biceps:'Bíceps', Espalda:'Espalda' };

// day_of_week (1=lunes..7=domingo) -> { name }
export let routineDays = {};
export function setRoutineDays(v){ routineDays = v; }

// catálogo de ejercicios: { [id]: { id, name, muscle_group, days: [{day_of_week, order_index, variant, sets_target, reps_target}] } }
// sets_target/reps_target son del día (no del ejercicio) — el mismo ejercicio puede pedir distintas series/reps en cada día
export let exercisesById = {};
export function setExercisesById(v){ exercisesById = v; }

// derivado de exercisesById (ver buildExercisesByDay en routines-derived.js):
// day_of_week -> [{ id, name, sets_target, reps_target, muscle_group, order_index }] ordenados por order_index
export let routineExercises = {};
export function setRoutineExercises(v){ routineExercises = v; }

// día en edición (nombre del entrenamiento)
export let editingDay = null;
export function setEditingDay(v){ editingDay = v; }

// ejercicio en edición/creación en el modal de catálogo: { exercise|null, presetDay|null, presetOrderIndex|null }
// presetDay: si se crea desde el botón "+ Ejercicio"/"+ Alternativa" de un día puntual, ese día queda pre-tildado
// presetOrderIndex: si se crea como alternativa de un slot existente, a qué slot de presetDay se asigna
export let editingExercise = null;
export function setEditingExercise(v){ editingExercise = v; }

// slot para el que está abierto el buscador de "agregar ejercicio existente": { dayOfWeek, orderIndex|null }
// orderIndex null = "+ Ejercicio" (crea un slot nuevo); orderIndex dado = "+ Alternativa" de ese slot
export let assigningTarget = null;
export function setAssigningTarget(v){ assigningTarget = v; }

// ejercicio abierto en el modal de sesión
export let sessionExercise = null;
export function setSessionExercise(v){ sessionExercise = v; }

// día (1-7) del que se abrió el modal de sesión actual, si se conoce (null si es ambiguo,
// ej. un ejercicio asignado a varios días abierto desde el historial de Gimnasio sin contexto de día)
export let sessionDayOfWeek = null;
export function setSessionDayOfWeek(v){ sessionDayOfWeek = v; }

// { exerciseId, dayOfWeek } en edición en el modal de objetivo (series/reps) de un día puntual
export let editingDayTarget = null;
export function setEditingDayTarget(v){ editingDayTarget = v; }

// fecha (ISO) que se está viendo/editando en el modal de sesión
export let sessionEditDate = null;
export function setSessionEditDate(v){ sessionEditDate = v; }

// filas de series cargadas en el modal de sesión: [{ weight, reps }]
export let sessionSetRows = [];
export function setSessionSetRows(v){ sessionSetRows = v; }

// calendario por ejercicio
export let exerciseCalendarExerciseId = null;
export function setExerciseCalendarExerciseId(v){ exerciseCalendarExerciseId = v; }

export let exerciseCalendarMonth = new Date();
export function setExerciseCalendarMonth(v){ exerciseCalendarMonth = v; }

// Map fecha ISO -> sets [{weight,reps}], para el ejercicio abierto en el calendario
export let exerciseCalendarSessions = new Map();
export function setExerciseCalendarSessions(v){ exerciseCalendarSessions = v; }

// lunes de la semana que se está viendo en "Volumen semanal" (pantalla de Gimnasio)
export let gymVolumeWeek = mondayOf(new Date());
export function setGymVolumeWeek(v){ gymVolumeWeek = v; }

// mes que se está viendo en "Resumen mensual" (pantalla de Gimnasio) — se muta directo con
// .setMonth(), mismo patrón que viewMonth en state.js, no necesita setter propio
export let gymSummaryMonth = new Date();
gymSummaryMonth.setDate(1);
gymSummaryMonth.setHours(0,0,0,0);
