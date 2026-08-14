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

// ejercicio en edición/creación { dayOfWeek, exercise|null }
export let editingExercise = null;
export function setEditingExercise(v){ editingExercise = v; }

// ejercicio abierto en el modal de sesión
export let sessionExercise = null;
export function setSessionExercise(v){ sessionExercise = v; }

// filas de series cargadas en el modal de sesión: [{ weight, reps }]
export let sessionSetRows = [];
export function setSessionSetRows(v){ sessionSetRows = v; }
