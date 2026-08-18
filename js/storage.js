import { sb } from './config.js';
import { SEED_ENTRIES } from './seed-data.js';
import { setEntries } from './state.js';
import { showToast } from './utils.js';

export async function loadEntries(){
  const { data, error } = await sb.from('weight_entries').select('date,weight,note');
  if(error){ console.error(error); showToast('Error cargando datos'); setEntries({}); return; }

  if(data.length === 0){
    // primera vez: sembrar con el historial importado del excel
    const rows = Object.keys(SEED_ENTRIES).map(date => ({ date, weight: SEED_ENTRIES[date], note: '' }));
    const { error: seedError } = await sb.from('weight_entries').insert(rows);
    if(seedError){ console.error(seedError); showToast('Error cargando datos iniciales'); }
    const { data: seeded } = await sb.from('weight_entries').select('date,weight,note');
    const result = {};
    (seeded || []).forEach(r => { result[r.date] = { weight: Number(r.weight), note: r.note || '' }; });
    setEntries(result);
    return;
  }

  const result = {};
  data.forEach(r => { result[r.date] = { weight: Number(r.weight), note: r.note || '' }; });
  setEntries(result);
}

export async function upsertEntry(date, weight, note){
  return sb.from('weight_entries').upsert({ date, weight, note }, { onConflict: 'user_id,date' });
}

export async function deleteEntryByDate(date){
  return sb.from('weight_entries').delete().eq('date', date);
}

export async function logChange(entryDate, action, previous, next){
  const { error } = await sb.from('weight_entries_log').insert({
    entry_date: entryDate,
    action,
    previous_weight: previous ? previous.weight : null,
    previous_note: previous ? previous.note : null,
    new_weight: next ? next.weight : null,
    new_note: next ? next.note : null,
  });
  if(error) console.error('No se pudo registrar la actividad', error);
}

export async function loadRecentActivity(limit = 20){
  const { data, error } = await sb.from('weight_entries_log')
    .select('entry_date,action,previous_weight,previous_note,new_weight,new_note,changed_at')
    .order('changed_at', { ascending: false })
    .limit(limit);
  if(error){ console.error(error); return []; }
  return data || [];
}

export async function loadCurrentGoal(){
  const { data, error } = await sb.from('weight_goals')
    .select('target_weight,created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if(error){ console.error(error); return null; }
  return data;
}

export async function loadGoalHistory(limit = 10){
  const { data, error } = await sb.from('weight_goals')
    .select('target_weight,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if(error){ console.error(error); return []; }
  return data || [];
}

export async function saveGoal(targetWeight){
  return sb.from('weight_goals').insert({ target_weight: targetWeight });
}

// fases (períodos de volumen/definición/mantenimiento): end_date null = fase en curso
export async function loadPhases(){
  const { data, error } = await sb.from('weight_phases')
    .select('id,phase,start_date,end_date')
    .order('start_date', { ascending: false });
  if(error){ console.error(error); return []; }
  return data || [];
}

export async function createPhase(phase, startDate, endDate){
  return sb.from('weight_phases').insert({ phase, start_date: startDate, end_date: endDate || null }).select('id').single();
}

export async function finishPhase(id, endDate){
  return sb.from('weight_phases').update({ end_date: endDate }).eq('id', id);
}

export async function deletePhase(id){
  return sb.from('weight_phases').delete().eq('id', id);
}
