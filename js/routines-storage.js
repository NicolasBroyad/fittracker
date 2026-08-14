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
    .select('id,day_of_week,name,sets_target,reps_target,order_index')
    .order('day_of_week', { ascending: true })
    .order('order_index', { ascending: true });
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => {
    if(!result[r.day_of_week]) result[r.day_of_week] = [];
    result[r.day_of_week].push(r);
  });
  return result;
}

export async function createExercise(dayOfWeek, name, setsTarget, repsTarget, orderIndex){
  return sb.from('routine_exercises').insert({
    day_of_week: dayOfWeek, name, sets_target: setsTarget, reps_target: repsTarget, order_index: orderIndex,
  }).select('id,day_of_week,name,sets_target,reps_target,order_index').single();
}

export async function updateExercise(id, name, setsTarget, repsTarget){
  return sb.from('routine_exercises').update({ name, sets_target: setsTarget, reps_target: repsTarget }).eq('id', id);
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

export async function saveSets(exerciseId, sessionDate, startSetNumber, sets){
  const rows = sets.map((s, i) => ({
    exercise_id: exerciseId,
    session_date: sessionDate,
    set_number: startSetNumber + i,
    weight: s.weight,
    reps: s.reps,
  }));
  return sb.from('routine_logs').insert(rows);
}

export async function deleteSessionLogs(exerciseId, sessionDate){
  return sb.from('routine_logs').delete().eq('exercise_id', exerciseId).eq('session_date', sessionDate);
}

// última sesión registrada por ejercicio: { [exercise_id]: { date, sets: [...] } }
export async function loadLatestSessionByExercise(){
  const { data, error } = await sb.from('routine_logs')
    .select('exercise_id,session_date,set_number,weight,reps')
    .order('session_date', { ascending: false })
    .order('set_number', { ascending: true });
  if(error){ console.error(error); return {}; }
  const result = {};
  (data || []).forEach(r => {
    if(!result[r.exercise_id]) result[r.exercise_id] = { date: r.session_date, sets: [] };
    if(result[r.exercise_id].date === r.session_date) result[r.exercise_id].sets.push(r);
  });
  return result;
}
