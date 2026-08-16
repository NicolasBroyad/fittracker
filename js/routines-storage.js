import { sb } from './config.js';

export async function loadRoutineDays(){
  const { data, error } = await sb.from('routine_days').select('day_of_week,name,is_rest');
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => { result[r.day_of_week] = { name: r.name || '', is_rest: !!r.is_rest }; });
  return result;
}

export async function saveRoutineDay(dayOfWeek, name, isRest){
  return sb.from('routine_days').upsert({ day_of_week: dayOfWeek, name, is_rest: isRest }, { onConflict: 'user_id,day_of_week' });
}

// catálogo de ejercicios + a qué días de la semana está asignado cada uno (con su slot/variant en ese día).
// -> { [id]: { id, name, sets_target, reps_target, muscle_group, days: [{day_of_week, order_index, variant}] } }
export async function loadExercisesWithDays(){
  const [{ data: exs, error: e1 }, { data: assigns, error: e2 }] = await Promise.all([
    sb.from('routine_exercises').select('id,name,sets_target,reps_target,muscle_group'),
    sb.from('routine_exercise_days').select('exercise_id,day_of_week,order_index,variant'),
  ]);
  if(e1){ console.error(e1); return {}; }
  if(e2){ console.error(e2); return {}; }
  const daysByExercise = {};
  (assigns || []).forEach(a => {
    if(!daysByExercise[a.exercise_id]) daysByExercise[a.exercise_id] = [];
    daysByExercise[a.exercise_id].push({ day_of_week: a.day_of_week, order_index: a.order_index, variant: a.variant });
  });
  const result = {};
  (exs || []).forEach(ex => {
    const days = (daysByExercise[ex.id] || []).sort((a, b) => a.day_of_week - b.day_of_week);
    result[ex.id] = { ...ex, days };
  });
  return result;
}

export async function createExercise(name, setsTarget, repsTarget, muscleGroup){
  return sb.from('routine_exercises').insert({
    name, sets_target: setsTarget, reps_target: repsTarget, muscle_group: muscleGroup,
  }).select('id,name,sets_target,reps_target,muscle_group').single();
}

export async function updateExercise(id, name, setsTarget, repsTarget, muscleGroup){
  return sb.from('routine_exercises').update({
    name, sets_target: setsTarget, reps_target: repsTarget, muscle_group: muscleGroup,
  }).eq('id', id);
}

export async function deleteExercise(id){
  return sb.from('routine_exercises').delete().eq('id', id);
}

export async function assignExerciseToDay(exerciseId, dayOfWeek, orderIndex, variant){
  return sb.from('routine_exercise_days').insert({ exercise_id: exerciseId, day_of_week: dayOfWeek, order_index: orderIndex, variant: variant || 0 });
}

export async function unassignExerciseFromDay(exerciseId, dayOfWeek){
  return sb.from('routine_exercise_days').delete().eq('exercise_id', exerciseId).eq('day_of_week', dayOfWeek);
}

export async function updateExerciseDayOrderIndex(exerciseId, dayOfWeek, orderIndex){
  return sb.from('routine_exercise_days').update({ order_index: orderIndex }).eq('exercise_id', exerciseId).eq('day_of_week', dayOfWeek);
}

export async function loadExerciseLogs(exerciseId){
  const { data, error } = await sb.from('routine_logs')
    .select('id,session_date,set_number,weight,reps')
    .eq('exercise_id', exerciseId)
    .order('session_date', { ascending: false })
    .order('set_number', { ascending: true });
  if(error){ console.error(error); return []; }
  return data || [];
}

export async function deleteSessionLogs(exerciseId, sessionDate){
  return sb.from('routine_logs').delete().eq('exercise_id', exerciseId).eq('session_date', sessionDate);
}

// reemplaza todas las series de un ejercicio para una fecha dada
export async function replaceSessionSets(exerciseId, sessionDate, sets){
  const { error: delError } = await deleteSessionLogs(exerciseId, sessionDate);
  if(delError) return { error: delError };
  const rows = sets.map((s, i) => ({
    exercise_id: exerciseId,
    session_date: sessionDate,
    set_number: i + 1,
    weight: s.weight,
    reps: s.reps,
  }));
  return sb.from('routine_logs').insert(rows);
}

// todos los routine_logs del usuario, agrupados por ejercicio: { [exercise_id]: [{session_date,set_number,weight,reps}, ...] }
export async function loadAllLogsGroupedByExercise(){
  const { data, error } = await sb.from('routine_logs')
    .select('exercise_id,session_date,set_number,weight,reps');
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => {
    if(!result[r.exercise_id]) result[r.exercise_id] = [];
    result[r.exercise_id].push(r);
  });
  return result;
}
