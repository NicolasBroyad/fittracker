import { routineDays, routineExercises, DAY_NAMES } from './routines-state.js';
import { fromISO, todayISO, fmtShort, escapeHtml } from './utils.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { formatSessionSets, computeLatestSession, computeBestSession, groupIntoSlots } from './routines-derived.js';

const PENCIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
const CALENDAR_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const UP_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
const DOWN_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function relativeLabel(dateStr){
  const today = todayISO();
  if(dateStr === today) return 'hoy';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const y = yesterday.getFullYear()+'-'+String(yesterday.getMonth()+1).padStart(2,'0')+'-'+String(yesterday.getDate()).padStart(2,'0');
  if(dateStr === y) return 'ayer';
  return fmtShort(fromISO(dateStr));
}

function slotLabel(position, variant, variantCount){
  const n = String(position);
  return variantCount > 1 ? n + String.fromCharCode(97 + variant) : n;
}

function statLineHtml(label, session){
  if(!session) return `<div class="ex-stat"><span class="ex-stat-label">${label}</span><span class="ex-stat-empty">Sin registros</span></div>`;
  const formatted = formatSessionSets(session.sets.map(s => ({ weight: s.weight, reps: s.reps })));
  return `<div class="ex-stat"><span class="ex-stat-label">${label}</span><span>${escapeHtml(formatted)} <span class="ex-stat-date">· ${relativeLabel(session.date)}</span></span></div>`;
}

function exerciseRowHtml(ex, label, logsByExercise){
  const target = (ex.sets_target != null ? ex.sets_target : '—')+'x'+(ex.reps_target || '—');
  const logs = logsByExercise[ex.id] || [];
  const latest = computeLatestSession(logs);
  const best = computeBestSession(logs);
  return `<div class="exercise-row" data-id="${ex.id}">
    <div class="ex-main">
      <span class="ex-number">${label}</span>
      <span class="ex-name">${escapeHtml(ex.name)}</span>
      <span class="ex-target">${escapeHtml(target)}</span>
      <button class="ex-calendar-btn" data-id="${ex.id}" title="Ver calendario">${CALENDAR_SVG}</button>
    </div>
    <div class="ex-stats">
      ${statLineHtml('Mejor', best)}
      ${statLineHtml('Último', latest)}
    </div>
  </div>`;
}

function slotHtml(slot, position, logsByExercise){
  const variantCount = slot.items.length;
  const rows = slot.items.map(ex => exerciseRowHtml(ex, slotLabel(position, ex.variant, variantCount), logsByExercise)).join('');
  return `<div class="exercise-slot" data-order="${slot.orderIndex}">
    <div class="slot-move">
      <button class="slot-move-up" data-order="${slot.orderIndex}" title="Subir">${UP_SVG}</button>
      <button class="slot-move-down" data-order="${slot.orderIndex}" title="Bajar">${DOWN_SVG}</button>
    </div>
    <div class="slot-items">
      ${rows}
      <button class="btn-add-alt" data-order="${slot.orderIndex}">+ Alternativa</button>
    </div>
  </div>`;
}

function dayPanelHtml(dayOfWeek, logsByExercise){
  const day = routineDays[dayOfWeek] || { name: '' };
  const exercises = routineExercises[dayOfWeek] || [];
  const hasName = day.name && day.name.trim() !== '';
  const slots = groupIntoSlots(exercises);
  const body = slots.length === 0
    ? '<div class="empty-state">Sin ejercicios todavía.</div>'
    : slots.map((slot, i) => slotHtml(slot, i+1, logsByExercise)).join('');
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
  const logsByExercise = await loadAllLogsGroupedByExercise();
  let html = '';
  for(let d=1; d<=7; d++) html += dayPanelHtml(d, logsByExercise);
  container.innerHTML = html;
}
