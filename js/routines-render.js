import { routineDays, routineExercises, exercisesById, DAY_NAMES, DOW_ABBR, MUSCLE_GROUP_LABELS } from './routines-state.js';
import { fromISO, todayISO, fmtShort, escapeHtml } from './utils.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { formatSessionSets, computeLatestSession, computeBestSession, groupIntoSlots } from './routines-derived.js';

const PENCIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
const CALENDAR_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const REMOVE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

function relativeLabel(dateStr){
  const today = todayISO();
  if(dateStr === today) return 'hoy';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const y = yesterday.getFullYear()+'-'+String(yesterday.getMonth()+1).padStart(2,'0')+'-'+String(yesterday.getDate()).padStart(2,'0');
  if(dateStr === y) return 'ayer';
  return fmtShort(fromISO(dateStr));
}

function statLineHtml(label, session){
  if(!session) return `<div class="ex-stat"><span class="ex-stat-label">${label}</span><span class="ex-stat-empty">Sin registros</span></div>`;
  const formatted = formatSessionSets(session.sets.map(s => ({ weight: s.weight, reps: s.reps })));
  return `<div class="ex-stat"><span class="ex-stat-label">${label}</span><span>${escapeHtml(formatted)} <span class="ex-stat-date">· ${relativeLabel(session.date)}</span></span></div>`;
}

function slotLabel(position, variant, variantCount){
  const n = String(position);
  return variantCount > 1 ? n + String.fromCharCode(97 + variant) : n;
}

function exerciseRowHtml(ex, label, logsByExercise, dayOfWeek){
  const target = (ex.sets_target != null ? ex.sets_target : '—')+'x'+(ex.reps_target || '—');
  const logs = logsByExercise[ex.id] || [];
  const latest = computeLatestSession(logs);
  const best = computeBestSession(logs);
  return `<div class="exercise-row" data-id="${ex.id}">
    <div class="ex-main">
      <span class="ex-number">${label}</span>
      <span class="ex-name">${escapeHtml(ex.name)}</span>
      <button class="ex-target ex-target-btn" data-id="${ex.id}" data-day="${dayOfWeek}" title="Editar objetivo de este día">${escapeHtml(target)}</button>
      <button class="ex-calendar-btn" data-id="${ex.id}" data-day="${dayOfWeek}" title="Ver calendario">${CALENDAR_SVG}</button>
      <button class="ex-remove-btn" data-id="${ex.id}" data-day="${dayOfWeek}" title="Quitar de este día">${REMOVE_SVG}</button>
    </div>
    <div class="ex-stats">
      ${statLineHtml('Mejor', best)}
      ${statLineHtml('Último', latest)}
    </div>
  </div>`;
}

function slotHtml(slot, position, logsByExercise, dayOfWeek){
  const variantCount = slot.items.length;
  const rows = slot.items.map(ex => exerciseRowHtml(ex, slotLabel(position, ex.variant, variantCount), logsByExercise, dayOfWeek)).join('');
  let content = rows;
  if(variantCount > 1){
    const dots = slot.items.map(() => '<span class="slot-dot"></span>').join('');
    content = `<div class="slot-carousel">${rows}</div><div class="slot-dots"><button class="slot-arrow" data-dir="-1" title="Alternativa anterior">‹</button>${dots}<button class="slot-arrow" data-dir="1" title="Alternativa siguiente">›</button></div>`;
  }
  return `<div class="exercise-slot" data-order="${slot.orderIndex}" data-day="${dayOfWeek}">
    ${content}
    <button class="btn-add-alt" data-order="${slot.orderIndex}" data-day="${dayOfWeek}">+ Alternativa</button>
  </div>`;
}

function todayDayOfWeek(){
  return ((new Date().getDay()+6)%7) + 1; // 1=lunes..7=domingo
}

function muscleGroupBadgesHtml(exercises){
  const groups = [];
  exercises.forEach(ex => { if(ex.muscle_group && !groups.includes(ex.muscle_group)) groups.push(ex.muscle_group); });
  if(groups.length === 0) return '';
  return '<div class="routine-day-muscle-groups">'
    + groups.map(g => `<span class="ex-muscle-badge">${escapeHtml(MUSCLE_GROUP_LABELS[g] || g)}</span>`).join('')
    + '</div>';
}

function dayPanelHtml(dayOfWeek, logsByExercise, todayDow){
  const day = routineDays[dayOfWeek] || { name: '', is_rest: false };
  const isRest = !!day.is_rest;
  const exercises = routineExercises[dayOfWeek] || [];
  const hasName = day.name && day.name.trim() !== '';
  const isToday = dayOfWeek === todayDow;
  const slots = groupIntoSlots(exercises);

  let body;
  if(isRest){
    body = '<div class="empty-state rest-day-message">Día de descanso.</div>';
  } else if(slots.length === 0){
    body = '<div class="empty-state">Sin ejercicios todavía.</div>';
  } else {
    body = slots.map((slot, i) => slotHtml(slot, i+1, logsByExercise, dayOfWeek)).join('');
  }

  return `<div class="panel routine-day-panel${isToday ? ' is-today' : ''}${isRest ? ' is-rest' : ''}" data-day="${dayOfWeek}">
    <div class="panel-head">
      <div>
        ${isToday ? '<div class="routine-today-eyebrow">Rutina de hoy</div>' : ''}
        <h2>${DAY_NAMES[dayOfWeek-1]}${isRest ? ' <span class="routine-day-name">— Descanso</span>' : (hasName ? ' <span class="routine-day-name">— '+escapeHtml(day.name)+'</span>' : '')}</h2>
      </div>
      <button class="btn-expand routine-day-edit" data-day="${dayOfWeek}" title="Nombrar entrenamiento / descanso">${PENCIL_SVG}</button>
    </div>
    ${isRest ? '' : muscleGroupBadgesHtml(exercises)}
    <div class="exercise-list">${body}</div>
    ${isRest ? '' : `<button class="btn-add-exercise" data-day="${dayOfWeek}">+ Ejercicio</button>`}
  </div>`;
}

function daysBadgeHtml(days){
  if(!days || days.length === 0) return '<span class="ex-catalog-days ex-catalog-days-empty">Sin asignar</span>';
  return '<span class="ex-catalog-days">'+days.map(d => DOW_ABBR[d.day_of_week-1]).join(' ')+'</span>';
}

function catalogRowHtml(ex, logsByExercise){
  const logs = logsByExercise[ex.id] || [];
  const latest = computeLatestSession(logs);
  const best = computeBestSession(logs);
  return `<div class="exercise-row exercise-catalog-row" data-id="${ex.id}">
    <div class="ex-main">
      <span class="ex-name">${escapeHtml(ex.name)}</span>
      ${ex.muscle_group ? `<span class="ex-muscle-badge">${escapeHtml(MUSCLE_GROUP_LABELS[ex.muscle_group] || ex.muscle_group)}</span>` : ''}
    </div>
    <div class="ex-catalog-days-row">${daysBadgeHtml(ex.days)}</div>
    <div class="ex-stats">
      ${statLineHtml('Mejor', best)}
      ${statLineHtml('Último', latest)}
    </div>
  </div>`;
}

function exerciseCatalogPanelHtml(exercisesById, logsByExercise){
  const list = Object.values(exercisesById).sort((a, b) => a.name.localeCompare(b.name));
  const body = list.length === 0
    ? '<div class="empty-state">Todavía no creaste ningún ejercicio.</div>'
    : list.map(ex => catalogRowHtml(ex, logsByExercise)).join('');
  return `<div class="panel" id="exercise-catalog-panel">
    <div class="panel-head"><h2>Ejercicios</h2></div>
    <div class="exercise-list">${body}</div>
    <button class="btn-add-exercise" id="btn-add-catalog-exercise">+ Ejercicio nuevo</button>
  </div>`;
}

// alternativa visible por slot (día-orden); si el usuario no swipeó, arranca en la última cargada cronológicamente
const chosenVariant = new Map();

function latestLoggedIndex(items, logsByExercise){
  let best = 0, bestDate = '';
  items.forEach((ex, i) => {
    const latest = computeLatestSession(logsByExercise[ex.id] || []);
    if(latest && latest.date > bestDate){ bestDate = latest.date; best = i; }
  });
  return best;
}

function setDots(slotEl, idx){
  slotEl.querySelectorAll('.slot-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function setupCarousels(container, logsByExercise){
  container.querySelectorAll('.exercise-slot').forEach(slotEl => {
    const car = slotEl.querySelector('.slot-carousel');
    if(!car) return;
    const day = Number(slotEl.dataset.day), order = Number(slotEl.dataset.order);
    const items = groupIntoSlots(routineExercises[day] || []).find(s => s.orderIndex === order).items;
    const key = day+'-'+order;
    let idx = chosenVariant.has(key) ? chosenVariant.get(key) : latestLoggedIndex(items, logsByExercise);
    if(idx >= items.length) idx = 0;
    slotEl.dataset.idx = idx;
    car.scrollLeft = idx * car.clientWidth;
    setDots(slotEl, idx);
    slotEl.querySelectorAll('.slot-arrow').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      car.scrollBy({ left: Number(btn.dataset.dir) * car.clientWidth, behavior: 'smooth' });
    }));
    let t;
    car.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const i = Math.round(car.scrollLeft / (car.clientWidth || 1));
        chosenVariant.set(key, i);
        setDots(slotEl, i);
      }, 80);
    }, { passive: true });
  });
}

export function rerenderCarousels(){
  document.querySelectorAll('#routine-days-container .exercise-slot').forEach(slotEl => {
    const car = slotEl.querySelector('.slot-carousel');
    if(!car || !car.clientWidth) return;
    const key = slotEl.dataset.day+'-'+slotEl.dataset.order;
    const i = chosenVariant.has(key) ? chosenVariant.get(key) : Number(slotEl.dataset.idx);
    if(i != null) car.scrollLeft = i * car.clientWidth;
  });
}

export async function renderRoutines(){
  const container = document.getElementById('routine-days-container');
  const catalogContainer = document.getElementById('exercise-catalog-container');
  if(!container) return;
  const logsByExercise = await loadAllLogsGroupedByExercise();
  const todayDow = todayDayOfWeek();
  let html = '';
  for(let d=1; d<=7; d++) html += dayPanelHtml(d, logsByExercise, todayDow);
  container.innerHTML = html;
  setupCarousels(container, logsByExercise);
  if(catalogContainer) catalogContainer.innerHTML = exerciseCatalogPanelHtml(exercisesById, logsByExercise);
}
