export const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// day_of_week (1=lunes..7=domingo) -> { name }
export let routineDays = {};
export function setRoutineDays(v){ routineDays = v; }

// day_of_week -> [{ id, name, sets_target, reps_target, order_index }]
export let routineExercises = {};
export function setRoutineExercises(v){ routineExercises = v; }

export let activeScreen = 'peso';
export function setActiveScreenState(v){ activeScreen = v; }

// día en edición (nombre del entrenamiento)
export let editingDay = null;
export function setEditingDay(v){ editingDay = v; }

// ejercicio en edición/creación { dayOfWeek, exercise|null, slotOrderIndex|null }
// slotOrderIndex se usa al crear una alternativa: mete el ejercicio nuevo en un slot existente
export let editingExercise = null;
export function setEditingExercise(v){ editingExercise = v; }

// ejercicio abierto en el modal de sesión
export let sessionExercise = null;
export function setSessionExercise(v){ sessionExercise = v; }

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

// Set de fechas ISO con registros, para el ejercicio abierto en el calendario
export let exerciseCalendarLogDates = new Set();
export function setExerciseCalendarLogDates(v){ exerciseCalendarLogDates = v; }
