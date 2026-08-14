import { routineDays, routineExercises, DAY_NAMES } from './routines-state.js';
import { fromISO, todayISO, fmtShort, escapeHtml } from './utils.js';
import { loadLatestSessionByExercise } from './routines-storage.js';
import { formatSessionSets } from './routines-derived.js';

const PENCIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';

function relativeLabel(dateStr){
  const today = todayISO();
  if(dateStr === today) return 'hoy';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const y = yesterday.getFullYear()+'-'+String(yesterday.getMonth()+1).padStart(2,'0')+'-'+String(yesterday.getDate()).padStart(2,'0');
  if(dateStr === y) return 'ayer';
  return fmtShort(fromISO(dateStr));
}

function exerciseRowHtml(ex, latest){
  const target = (ex.sets_target != null ? ex.sets_target : '—')+'x'+(ex.reps_target || '—');
  const l = latest[ex.id];
  let lastHtml = '<span class="ex-last empty">Sin registros</span>';
  if(l){
    const formatted = formatSessionSets(l.sets.map(s=>({ weight: s.weight, reps: s.reps })));
    lastHtml = `<span class="ex-last">${escapeHtml(formatted)} <span class="ex-last-date">· ${relativeLabel(l.date)}</span></span>`;
  }
  return `<div class="exercise-row" data-id="${ex.id}">
    <div class="ex-main">
      <span class="ex-name">${escapeHtml(ex.name)}</span>
      <span class="ex-target">${escapeHtml(target)}</span>
    </div>
    ${lastHtml}
  </div>`;
}

function dayPanelHtml(dayOfWeek, latest){
  const day = routineDays[dayOfWeek] || { name: '' };
  const exercises = routineExercises[dayOfWeek] || [];
  const hasName = day.name && day.name.trim() !== '';
  const body = exercises.length === 0
    ? '<div class="empty-state">Sin ejercicios todavía.</div>'
    : exercises.map(ex => exerciseRowHtml(ex, latest)).join('');
  return `<div class="panel routine-day-panel" data-day="${dayOfWeek}">
    <div class="panel-head">
      <h2>${DAY_NAMES[dayOfWeek-1]}${hasName ? ' <span class="routine-day-name">— '+escapeHtml(day.name)+'</span>' : ''}</h2>
      <button class="btn-expand routine-day-edit" data-day="${dayOfWeek}" title="Nombrar entrenamiento">${PENCIL_SVG}</button>
    </div>
    <div class="exercise-list">${body}</div>
    <button class="btn-add-exercise" data-day="${dayOfWeek}">+ Ejercicio</button>
  </div>`;
}

export async function renderRoutines(){
  const container = document.getElementById('routine-days-container');
  if(!container) return;
  const latest = await loadLatestSessionByExercise();
  let html = '';
  for(let d=1; d<=7; d++) html += dayPanelHtml(d, latest);
  container.innerHTML = html;
}
