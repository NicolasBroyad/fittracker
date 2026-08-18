import { toISO, fromISO } from './utils.js';

// logs: [{ session_date, set_number, weight, reps }] ordenados por fecha desc, set_number asc
export function groupLogsBySession(logs){
  const byDate = new Map();
  logs.forEach(l => {
    if(!byDate.has(l.session_date)) byDate.set(l.session_date, []);
    byDate.get(l.session_date).push(l);
  });
  return Array.from(byDate.entries()).map(([date, sets]) => ({ date, sets }));
}

// sets: [{ weight, reps }] en orden de ejecución -> agrupa series consecutivas con el mismo peso
function groupSetsByWeight(sets){
  const groups = [];
  sets.forEach(s => {
    const last = groups[groups.length-1];
    if(last && last.weight === s.weight){ last.reps.push(s.reps); }
    else groups.push({ weight: s.weight, reps: [s.reps] });
  });
  return groups;
}

// sets: [{ weight, reps }] en orden de ejecución -> "85kg x 6, 80kg x 8-7-6"
export function formatSessionSets(sets){
  return groupSetsByWeight(sets)
    .map(g => (g.weight != null ? Number(g.weight)+'kg' : '—') + ' x ' + g.reps.join('-'))
    .join(', ');
}

// logs: [{ session_date, set_number, weight, reps }] (todo el historial de un ejercicio, cualquier orden)
// -> { date, sets } de la sesión más reciente, o null si no hay registros
export function computeLatestSession(logs){
  if(logs.length === 0) return null;
  let latestDate = null;
  logs.forEach(l => { if(latestDate === null || l.session_date > latestDate) latestDate = l.session_date; });
  const sets = logs.filter(l => l.session_date === latestDate).sort((a,b) => a.set_number - b.set_number);
  return { date: latestDate, sets };
}

// perfil de un día: sus sets ordenados de "mejor" a "peor" (peso desc, luego reps desc)
function sessionProfile(logs, date){
  return logs
    .filter(l => l.session_date === date && l.weight != null)
    .map(l => ({ weight: Number(l.weight), reps: l.reps || 0 }))
    .sort((a,b) => (b.weight - a.weight) || (b.reps - a.reps));
}

// compara dos perfiles set por set (el mejor primero): weight y reps de cada posición, en orden;
// gana el que tenga un valor mayor en el primer punto donde difieren. positivo = a mejor que b.
function compareProfiles(a, b){
  const len = Math.min(a.length, b.length);
  for(let i=0; i<len; i++){
    if(a[i].weight !== b[i].weight) return a[i].weight - b[i].weight;
    if(a[i].reps !== b[i].reps) return a[i].reps - b[i].reps;
  }
  return a.length - b.length;
}

// mejor marca: el peso máximo levantado alguna vez. Entre los días que lo tocaron, si coinciden en
// peso y reps de esa mejor serie, se compara la siguiente serie de cada día (y así sucesivamente) para
// desempatar; si el empate persiste en todo, gana el día más reciente. Devuelve la sesión completa de ese día.
export function computeBestSession(logs){
  const withWeight = logs.filter(l => l.weight != null);
  if(withWeight.length === 0) return null;
  const maxWeight = Math.max(...withWeight.map(l => Number(l.weight)));
  const candidateDates = new Set(withWeight.filter(l => Number(l.weight) === maxWeight).map(l => l.session_date));

  let bestDate = null, bestProfile = null;
  candidateDates.forEach(date => {
    const profile = sessionProfile(logs, date);
    if(bestDate === null){ bestDate = date; bestProfile = profile; return; }
    const cmp = compareProfiles(profile, bestProfile);
    if(cmp > 0 || (cmp === 0 && date > bestDate)){ bestDate = date; bestProfile = profile; }
  });

  const sets = logs.filter(l => l.session_date === bestDate).sort((a,b) => a.set_number - b.set_number);
  return { date: bestDate, sets };
}

function dayOfWeekOf(date){ return ((date.getDay()+6)%7) + 1; } // 1=lunes..7=domingo

// agrupa el catálogo de ejercicios (routines-state.exercisesById) por día de la semana,
// según las asignaciones de cada uno; cada día queda ordenado por su order_index propio.
// sets_target/reps_target son del día (routine_exercise_days), no del ejercicio: el mismo
// ejercicio puede pedir distintas series/reps en cada día donde está asignado.
// -> { dayOfWeek: [{ id, name, sets_target, reps_target, muscle_group, order_index, variant }] }
export function buildExercisesByDay(exercisesById){
  const result = {};
  Object.values(exercisesById).forEach(ex => {
    (ex.days || []).forEach(d => {
      if(!result[d.day_of_week]) result[d.day_of_week] = [];
      result[d.day_of_week].push({
        id: ex.id, name: ex.name, sets_target: d.sets_target, reps_target: d.reps_target,
        muscle_group: ex.muscle_group, order_index: d.order_index, variant: d.variant || 0,
      });
    });
  });
  Object.keys(result).forEach(k => result[k].sort((a, b) => a.order_index - b.order_index));
  return result;
}

// agrupa los ejercicios de un día en slots por order_index, ordenados; cada slot trae sus alternativas
// (variant 0=principal, 1="b", 2="c"...) ordenadas
export function groupIntoSlots(exercises){
  const map = new Map();
  exercises.forEach(ex => {
    if(!map.has(ex.order_index)) map.set(ex.order_index, []);
    map.get(ex.order_index).push(ex);
  });
  const slots = Array.from(map.entries()).map(([orderIndex, items]) => ({
    orderIndex, items: items.slice().sort((a,b) => a.variant - b.variant),
  }));
  slots.sort((a,b) => a.orderIndex - b.orderIndex);
  return slots;
}

// día de hoy: qué toca, si es descanso, y cuántos slots ya tienen datos hoy (cualquiera de sus alternativas)
export function getTodayStatus(routineDays, routineExercises, logsByExercise){
  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek = dayOfWeekOf(today);
  const todayIso = toISO(today);
  const day = routineDays[dayOfWeek] || { name: '', is_rest: false };
  const exercises = routineExercises[dayOfWeek] || [];
  const slots = groupIntoSlots(exercises);
  const isRest = !!day.is_rest;
  const hasPlan = exercises.length > 0;
  const loggedSlotCount = slots.filter(slot =>
    slot.items.some(ex => (logsByExercise[ex.id] || []).some(l => l.session_date === todayIso))
  ).length;
  return {
    dayOfWeek,
    dayName: day.name || '',
    isRest,
    hasPlan,
    totalExercises: slots.length,
    loggedCount: loggedSlotCount,
    isFullyLogged: hasPlan && loggedSlotCount === slots.length,
    isAnyLogged: loggedSlotCount > 0,
  };
}

function isDayCompliant(dow, iso, routineDays, routineExercises, logsByExercise){
  const day = routineDays[dow];
  const exercises = routineExercises[dow] || [];
  if(day && day.is_rest) return true;
  if(exercises.length === 0) return true; // nada planificado ese día, no hay nada que cumplir
  return exercises.some(ex => (logsByExercise[ex.id] || []).some(l => l.session_date === iso));
}

// racha de días consecutivos "cumplidos": descanso o sin plan cuentan solos; un día de entreno
// cuenta si hay al menos un set cargado ese día. Hoy no rompe la racha si todavía no se cargó nada
// (el día no terminó) — se empieza a evaluar desde ayer, igual criterio que la racha de peso.
export function computeGymStreak(routineDays, routineExercises, logsByExercise){
  const today = new Date(); today.setHours(0,0,0,0);
  const todayDow = dayOfWeekOf(today);
  const todayIso = toISO(today);
  let cursor = new Date(today);
  if(!isDayCompliant(todayDow, todayIso, routineDays, routineExercises, logsByExercise)){
    cursor.setDate(cursor.getDate()-1);
  }
  let count = 0;
  for(let i=0; i<3650; i++){
    const dow = dayOfWeekOf(cursor);
    const iso = toISO(cursor);
    if(!isDayCompliant(dow, iso, routineDays, routineExercises, logsByExercise)) break;
    count++;
    cursor.setDate(cursor.getDate()-1);
  }
  return count;
}

// PRs (récords personales): recorre las sesiones de cada ejercicio en orden cronológico y marca
// las que establecieron un peso máximo nunca antes alcanzado por ESE ejercicio. La primera sesión
// de un ejercicio nunca cuenta como PR (no hay nada previo que superar) — hace falta al menos un
// intento anterior para que un peso nuevo sea "récord". Con empate de peso, se toma el mayor de reps
// de esa serie como dato del PR, pero no se considera un PR nuevo (ya está el peso, cambian solo reps).
// exercises: lista de ejercicios únicos del catálogo (Object.values(exercisesById))
// -> [{ exerciseId, exerciseName, date, weight, reps }], más recientes primero
export function computeRecentPRs(exercises, logsByExercise, limit){
  const prs = [];
  exercises.forEach(ex => {
    const logs = logsByExercise[ex.id] || [];
    const sessions = groupLogsBySession(logs).sort((a, b) => a.date.localeCompare(b.date));
    let bestWeight = null;
    sessions.forEach(s => {
      const withWeight = s.sets.filter(x => x.weight != null);
      if(withWeight.length === 0) return;
      const maxWeight = Math.max(...withWeight.map(x => Number(x.weight)));
      if(bestWeight === null){
        bestWeight = maxWeight; // primera sesión con peso: fija la base, todavía no hay nada que superar
        return;
      }
      if(maxWeight > bestWeight){
        const reps = Math.max(...withWeight.filter(x => Number(x.weight) === maxWeight).map(x => x.reps || 0));
        prs.push({ exerciseId: ex.id, exerciseName: ex.name, date: s.date, weight: maxWeight, reps });
        bestWeight = maxWeight;
      }
    });
  });
  prs.sort((a, b) => b.date.localeCompare(a.date));
  return limit ? prs.slice(0, limit) : prs;
}

// series totales por grupo muscular dentro de una semana natural puntual (ambos límites inclusive).
// exercisesById: catálogo completo (para leer el muscle_group de cada ejercicio)
// -> { [muscleGroup]: series }, solo incluye grupos con al menos una serie esa semana
export function computeWeeklyMuscleVolume(weekStartISO, weekEndISO, exercisesById, logsByExercise){
  const totals = {};
  Object.values(exercisesById).forEach(ex => {
    if(!ex.muscle_group) return;
    const logs = logsByExercise[ex.id] || [];
    const count = logs.filter(l => l.session_date >= weekStartISO && l.session_date <= weekEndISO).length;
    if(count > 0) totals[ex.muscle_group] = (totals[ex.muscle_group] || 0) + count;
  });
  return totals;
}

// todas las sesiones de todos los ejercicios, más recientes primero
// exercises: lista de ejercicios únicos del catálogo (Object.values(exercisesById))
export function computeAllSessionsHistory(exercises, logsByExercise){
  const rows = [];
  exercises.forEach(ex => {
    const logs = logsByExercise[ex.id] || [];
    groupLogsBySession(logs).forEach(s => {
      rows.push({ date: s.date, exerciseId: ex.id, exerciseName: ex.name, sets: s.sets });
    });
  });
  rows.sort((a,b) => b.date.localeCompare(a.date));
  return rows;
}

// series totales cargadas y días distintos entrenados dentro de un mes puntual, sin importar el
// ejercicio ni el grupo muscular — cuenta CUALQUIER set de logsByExercise (todos los ejercicios)
function monthGymActivity(year, month, logsByExercise){
  let totalSets = 0;
  const trainedDays = new Set();
  Object.values(logsByExercise).forEach(logs => {
    logs.forEach(l => {
      const d = fromISO(l.session_date);
      if(d.getFullYear() === year && d.getMonth() === month){
        totalSets++;
        trainedDays.add(l.session_date);
      }
    });
  });
  return { totalSets, trainedDays: trainedDays.size };
}

// resumen mensual de gimnasio: sesiones (días con al menos un set), series totales, promedio de
// series por sesión, y comparación contra el mes anterior. null si no hubo ninguna serie ese mes.
export function computeGymMonthlySummary(viewMonth, logsByExercise){
  const year = viewMonth.getFullYear(), month = viewMonth.getMonth();
  const { totalSets, trainedDays } = monthGymActivity(year, month, logsByExercise);
  if(totalSets === 0) return null;

  let prevMonth = month-1, prevYear = year;
  if(prevMonth < 0){ prevMonth = 11; prevYear--; }
  const prev = monthGymActivity(prevYear, prevMonth, logsByExercise);

  return {
    totalSets, trainedDays,
    daysInMonth: new Date(year, month+1, 0).getDate(),
    avgPerSession: totalSets / trainedDays,
    prevTotalSets: prev.totalSets,
    hasPrevData: prev.trainedDays > 0,
    delta: totalSets - prev.totalSets,
  };
}
