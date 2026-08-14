import { sb } from './config.js';

export async function loadRoutineDays(){
  const { data, error } = await sb.from('routine_days').select('day_of_week,name');
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => { result[r.day_of_week] = { name: r.name || '' }; });
  return result;
}

export async function saveRoutineDayName(dayOfWeek, name){
  return sb.from('routine_days').upsert({ day_of_week: dayOfWeek, name }, { onConflict: 'user_id,day_of_week' });
}

export async function loadRoutineExercises(){
  const { data, error } = await sb.from('routine_exercises')
    .select('id,day_of_week,name,sets_target,reps_target,order_index,variant')
    .order('day_of_week', { ascending: true })
    .order('order_index', { ascending: true })
    .order('variant', { ascending: true });
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => {
    if(!result[r.day_of_week]) result[r.day_of_week] = [];
    result[r.day_of_week].push(r);
  });
  return result;
}

export async function createExercise(dayOfWeek, name, setsTarget, repsTarget, orderIndex, variant){
  return sb.from('routine_exercises').insert({
    day_of_week: dayOfWeek, name, sets_target: setsTarget, reps_target: repsTarget, order_index: orderIndex, variant,
  }).select('id,day_of_week,name,sets_target,reps_target,order_index,variant').single();
}

export async function updateExercise(id, name, setsTarget, repsTarget){
  return sb.from('routine_exercises').update({ name, sets_target: setsTarget, reps_target: repsTarget }).eq('id', id);
}

export async function updateExerciseOrderIndex(id, orderIndex){
  return sb.from('routine_exercises').update({ order_index: orderIndex }).eq('id', id);
}

export async function deleteExercise(id){
  return sb.from('routine_exercises').delete().eq('id', id);
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
