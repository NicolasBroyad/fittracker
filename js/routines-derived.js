import { toISO } from './utils.js';

// logs: [{ session_date, set_number, weight, reps }] ordenados por fecha desc, set_number asc
export function groupLogsBySession(logs){
  const byDate = new Map();
  logs.forEach(l => {
    if(!byDate.has(l.session_date)) byDate.set(l.session_date, []);
    byDate.get(l.session_date).push(l);
  });
  return Array.from(byDate.entries()).map(([date, sets]) => ({ date, sets }));
}

// sets: [{ weight, reps }] en orden de ejecución -> "85kg x 6, 80kg x 8-7-6"
export function formatSessionSets(sets){
  const groups = [];
  sets.forEach(s => {
    const last = groups[groups.length-1];
    if(last && last.weight === s.weight){ last.reps.push(s.reps); }
    else groups.push({ weight: s.weight, reps: [s.reps] });
  });
  return groups.map(g => (g.weight != null ? Number(g.weight)+'kg' : '—') + ' x ' + g.reps.join('-')).join(', ');
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

// día de hoy: qué toca, si es descanso, y cuántos de sus ejercicios ya tienen datos hoy
export function getTodayStatus(routineDays, routineExercises, logsByExercise){
  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek = dayOfWeekOf(today);
  const todayIso = toISO(today);
  const day = routineDays[dayOfWeek] || { name: '', is_rest: false };
  const exercises = routineExercises[dayOfWeek] || [];
  const isRest = !!day.is_rest;
  const hasPlan = exercises.length > 0;
  const loggedIds = new Set(
    exercises.filter(ex => (logsByExercise[ex.id] || []).some(l => l.session_date === todayIso)).map(ex => ex.id)
  );
  return {
    dayOfWeek,
    dayName: day.name || '',
    isRest,
    hasPlan,
    totalExercises: exercises.length,
    loggedCount: loggedIds.size,
    isFullyLogged: hasPlan && loggedIds.size === exercises.length,
    isAnyLogged: loggedIds.size > 0,
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

// top ejercicios por mejora: peso máximo de la primera sesión vs. el mejor registro actual.
// Requiere al menos 2 sesiones distintas y una mejora positiva.
export function computeMostImproved(routineExercises, logsByExercise, topN){
  const results = [];
  Object.entries(routineExercises).forEach(([dow, exercises]) => {
    exercises.forEach(ex => {
      const logs = logsByExercise[ex.id] || [];
      const withWeight = logs.filter(l => l.weight != null);
      if(withWeight.length === 0) return;
      let firstDate = withWeight[0].session_date;
      withWeight.forEach(l => { if(l.session_date < firstDate) firstDate = l.session_date; });
      const firstWeight = Math.max(...withWeight.filter(l => l.session_date === firstDate).map(l => Number(l.weight)));
      const best = computeBestSession(logs);
      if(!best || best.date === firstDate) return;
      const bestWeight = Math.max(...best.sets.filter(s => s.weight != null).map(s => Number(s.weight)));
      const delta = bestWeight - firstWeight;
      if(delta <= 0) return;
      results.push({
        exerciseId: ex.id, exerciseName: ex.name, dayOfWeek: Number(dow),
        firstWeight, firstDate, bestWeight, bestDate: best.date, delta,
      });
    });
  });
  results.sort((a,b) => b.delta - a.delta);
  return topN ? results.slice(0, topN) : results;
}

// todas las sesiones de todos los ejercicios, más recientes primero
export function computeAllSessionsHistory(routineExercises, logsByExercise){
  const rows = [];
  Object.entries(routineExercises).forEach(([dow, exercises]) => {
    exercises.forEach(ex => {
      const logs = logsByExercise[ex.id] || [];
      groupLogsBySession(logs).forEach(s => {
        rows.push({ date: s.date, exerciseId: ex.id, exerciseName: ex.name, dayOfWeek: Number(dow), sets: s.sets });
      });
    });
  });
  rows.sort((a,b) => b.date.localeCompare(a.date));
  return rows;
}

// agrupa los ejercicios de un día en slots por order_index, ordenados; cada slot trae sus variantes ordenadas
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
