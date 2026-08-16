import {
  DAY_NAMES, routineDays, exercisesById, routineExercises, setRoutineDays, setExercisesById, setRoutineExercises,
  editingDay, setEditingDay,
  editingExercise, setEditingExercise, assigningTarget, setAssigningTarget,
  sessionExercise, setSessionExercise,
  sessionEditDate, setSessionEditDate, sessionSetRows, setSessionSetRows,
  exerciseCalendarExerciseId, setExerciseCalendarExerciseId,
  exerciseCalendarMonth, setExerciseCalendarMonth,
  exerciseCalendarSessions, setExerciseCalendarSessions,
} from './routines-state.js';
import {
  loadRoutineDays, loadExercisesWithDays, saveRoutineDay,
  createExercise, updateExercise, deleteExercise,
  assignExerciseToDay, unassignExerciseFromDay,
  loadExerciseLogs, replaceSessionSets, deleteSessionLogs,
} from './routines-storage.js';
import { renderRoutines } from './routines-render.js';
import { renderGym } from './gym-render.js';
import { renderHome } from './home-render.js';
import { groupLogsBySession, formatSessionSets, buildExercisesByDay } from './routines-derived.js';
import { wireDragReorder, isJiggling, exitJiggleMode } from './routines-dnd.js';
import { showToast, escapeHtml, todayISO, fromISO, toISO, fmtShort, MONTHS, DOW } from './utils.js';

export async function loadRoutines(){
  const [days, exercises] = await Promise.all([loadRoutineDays(), loadExercisesWithDays()]);
  setRoutineDays(days);
  setExercisesById(exercises);
  setRoutineExercises(buildExercisesByDay(exercises));
  await renderRoutines();
  updateTodayScrollHint();
}

// vuelve a traer el catálogo de ejercicios de Supabase (más simple y confiable que parchear
// el estado local a mano, dado el volumen chico de datos) y refresca las vistas dependientes
async function reloadExercisesAndRefresh(){
  const exercises = await loadExercisesWithDays();
  setExercisesById(exercises);
  setRoutineExercises(buildExercisesByDay(exercises));
  await refreshRoutineViews();
}

// refresca las 3 vistas que dependen de rutinas, sin importar cuál esté visible en este momento
async function refreshRoutineViews(){
  await Promise.all([renderRoutines(), renderGym(), renderHome()]);
  updateTodayScrollHint();
}

function nextOrderIndexForDay(dayOfWeek){
  const existing = routineExercises[dayOfWeek] || [];
  return existing.length === 0 ? 0 : Math.max(...existing.map(e => e.order_index)) + 1;
}
function nextVariantForSlot(dayOfWeek, orderIndex){
  const siblings = (routineExercises[dayOfWeek] || []).filter(e => e.order_index === orderIndex);
  return siblings.length === 0 ? 0 : Math.max(...siblings.map(e => e.variant)) + 1;
}

// muestra/oculta el botón flotante "ir a la rutina de hoy" según si esa tarjeta está fuera de vista
// (solo tiene sentido en la pantalla de Rutina, se detecta mirando el DOM directo para no depender de screens.js)
export function updateTodayScrollHint(){
  const hint = document.getElementById('rutina-scroll-hint');
  const screenEl = document.getElementById('screen-rutina');
  if(!hint || !screenEl) return;
  if(screenEl.classList.contains('hidden')){ hint.classList.add('hidden'); return; }
  const todayCard = document.querySelector('.routine-day-panel.is-today');
  if(!todayCard){ hint.classList.add('hidden'); return; }
  const rect = todayCard.getBoundingClientRect();
  const outOfView = rect.top > window.innerHeight - 60;
  hint.classList.toggle('hidden', !outOfView);
}

// ---------- Modal: nombre del día ----------

export function openDayNameModal(dayOfWeek){
  setEditingDay(dayOfWeek);
  const day = routineDays[dayOfWeek];
  document.getElementById('day-modal-label').textContent = DAY_NAMES[dayOfWeek-1];
  document.getElementById('day-input-name').value = (day && day.name) || '';
  document.getElementById('day-input-rest').checked = !!(day && day.is_rest);
  document.getElementById('day-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('day-input-name').focus(), 50);
}
export function closeDayNameModal(){
  document.getElementById('day-modal-overlay').classList.add('hidden');
  setEditingDay(null);
}
export async function saveDayName(){
  const name = document.getElementById('day-input-name').value.trim();
  const isRest = document.getElementById('day-input-rest').checked;
  const { error } = await saveRoutineDay(editingDay, name, isRest);
  if(error){ console.error(error); showToast('No se pudo guardar'); return; }
  routineDays[editingDay] = { name, is_rest: isRest };
  closeDayNameModal();
  await refreshRoutineViews();
  showToast('Guardado');
}

// ---------- Modal: buscador "agregar ejercicio existente" a un día (o a un slot puntual, como alternativa) ----------

export function openAssignModal(dayOfWeek, orderIndex){
  setAssigningTarget({ dayOfWeek, orderIndex: orderIndex != null ? orderIndex : null });
  document.getElementById('assign-modal-title').textContent = orderIndex != null ? 'Agregar alternativa' : 'Agregar ejercicio';
  document.getElementById('assign-modal-day-label').textContent = DAY_NAMES[dayOfWeek-1];
  document.getElementById('assign-search-input').value = '';
  renderAssignList('');
  document.getElementById('assign-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('assign-search-input').focus(), 50);
}
export function closeAssignModal(){
  document.getElementById('assign-modal-overlay').classList.add('hidden');
  setAssigningTarget(null);
}
export function renderAssignList(query){
  const list = document.getElementById('assign-exercise-list');
  if(!assigningTarget) return;
  const { dayOfWeek } = assigningTarget;
  const assignedIds = new Set((routineExercises[dayOfWeek] || []).map(e => e.id));
  const q = query.trim().toLowerCase();
  const options = Object.values(exercisesById)
    .filter(ex => !assignedIds.has(ex.id))
    .filter(ex => q === '' || ex.name.toLowerCase().includes(q))
    .sort((a,b) => a.name.localeCompare(b.name));
  if(options.length === 0){
    const msg = Object.keys(exercisesById).length === 0 ? 'Todavía no creaste ningún ejercicio.' : 'Sin resultados.';
    list.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }
  list.innerHTML = options.map(ex => `<div class="assign-exercise-item">
    <div class="assign-exercise-info">
      <span class="assign-exercise-name">${escapeHtml(ex.name)}</span>
      ${ex.muscle_group ? `<span class="assign-exercise-muscle">${escapeHtml(ex.muscle_group)}</span>` : ''}
    </div>
    <button class="assign-exercise-add" data-id="${ex.id}">+ Agregar</button>
  </div>`).join('');
}
export async function assignExistingExercise(exerciseId){
  if(!assigningTarget) return;
  const { dayOfWeek, orderIndex } = assigningTarget;
  const finalOrderIndex = orderIndex != null ? orderIndex : nextOrderIndexForDay(dayOfWeek);
  const variant = orderIndex != null ? nextVariantForSlot(dayOfWeek, orderIndex) : 0;
  const { error } = await assignExerciseToDay(exerciseId, dayOfWeek, finalOrderIndex, variant);
  if(error){ console.error(error); showToast('No se pudo agregar'); return; }
  closeAssignModal();
  await reloadExercisesAndRefresh();
  showToast('Agregado');
}
export function createFromAssignModal(){
  const target = assigningTarget;
  closeAssignModal();
  if(!target) return;
  openExerciseModal(null, target.dayOfWeek, target.orderIndex);
}

// ---------- Modal: ejercicio (alta/edición/borrado en el catálogo) ----------

export function openExerciseModal(exercise, presetDay, presetOrderIndex){
  setEditingExercise({
    exercise: exercise || null,
    presetDay: presetDay != null ? presetDay : null,
    presetOrderIndex: presetOrderIndex != null ? presetOrderIndex : null,
  });
  document.getElementById('exercise-modal-title').textContent = exercise ? 'Editar ejercicio' : 'Nuevo ejercicio';
  document.getElementById('exercise-input-name').value = exercise ? exercise.name : '';
  document.getElementById('exercise-input-sets').value = exercise && exercise.sets_target != null ? exercise.sets_target : '';
  document.getElementById('exercise-input-reps').value = exercise && exercise.reps_target ? exercise.reps_target : '';
  document.getElementById('exercise-input-muscle').value = exercise && exercise.muscle_group ? exercise.muscle_group : '';
  const checkedDays = new Set(exercise ? exercise.days.map(d => d.day_of_week) : []);
  if(presetDay != null) checkedDays.add(presetDay);
  document.querySelectorAll('.exercise-day-checkbox').forEach(cb => { cb.checked = checkedDays.has(Number(cb.value)); });
  document.getElementById('exercise-modal-delete').classList.toggle('hidden', !exercise);
  document.getElementById('exercise-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('exercise-input-name').focus(), 50);
}
export function closeExerciseModal(){
  document.getElementById('exercise-modal-overlay').classList.add('hidden');
  setEditingExercise(null);
}
export async function saveExerciseModal(){
  const name = document.getElementById('exercise-input-name').value.trim();
  if(name === ''){ showToast('Ingresá un nombre para el ejercicio'); return; }
  const setsRaw = document.getElementById('exercise-input-sets').value.trim();
  const setsTarget = setsRaw === '' ? null : parseInt(setsRaw, 10);
  if(setsRaw !== '' && (isNaN(setsTarget) || setsTarget <= 0)){ showToast('Series inválidas'); return; }
  const repsTarget = document.getElementById('exercise-input-reps').value.trim() || null;
  const muscleGroup = document.getElementById('exercise-input-muscle').value || null;
  const selectedDays = Array.from(document.querySelectorAll('.exercise-day-checkbox:checked')).map(cb => Number(cb.value));

  const { exercise, presetDay, presetOrderIndex } = editingExercise;
  if(exercise){
    const { error } = await updateExercise(exercise.id, name, setsTarget, repsTarget, muscleGroup);
    if(error){ console.error(error); showToast('No se pudo guardar'); return; }
    const currentDays = exercise.days.map(d => d.day_of_week);
    const toAdd = selectedDays.filter(d => !currentDays.includes(d));
    const toRemove = currentDays.filter(d => !selectedDays.includes(d));
    const results = await Promise.all([
      ...toAdd.map(d => assignExerciseToDay(exercise.id, d, nextOrderIndexForDay(d))),
      ...toRemove.map(d => unassignExerciseFromDay(exercise.id, d)),
    ]);
    const assignError = results.find(r => r && r.error);
    if(assignError){ console.error(assignError.error); showToast('No se pudo guardar'); return; }
  } else {
    const { data, error } = await createExercise(name, setsTarget, repsTarget, muscleGroup);
    if(error){ console.error(error); showToast('No se pudo crear el ejercicio'); return; }
    // si se creó como alternativa de un slot puntual, esa asignación va a ese slot en vez de a uno nuevo
    await Promise.all(selectedDays.map(d => {
      if(d === presetDay && presetOrderIndex != null){
        return assignExerciseToDay(data.id, d, presetOrderIndex, nextVariantForSlot(d, presetOrderIndex));
      }
      return assignExerciseToDay(data.id, d, nextOrderIndexForDay(d));
    }));
  }
  closeExerciseModal();
  await reloadExercisesAndRefresh();
  showToast('Guardado');
}
export async function deleteExerciseModal(){
  const { exercise } = editingExercise;
  if(!exercise) return;
  const { error } = await deleteExercise(exercise.id);
  if(error){ console.error(error); showToast('No se pudo borrar'); return; }
  closeExerciseModal();
  await reloadExercisesAndRefresh();
  showToast('Ejercicio eliminado');
}
async function unassignFromDay(exerciseId, dayOfWeek){
  const { error } = await unassignExerciseFromDay(exerciseId, dayOfWeek);
  if(error){ console.error(error); showToast('No se pudo quitar'); return; }
  await reloadExercisesAndRefresh();
  showToast('Quitado del día');
}

// ---------- Modal: registrar/editar sesión ----------

function renderSessionHistory(sessions){
  const historyEl = document.getElementById('session-history');
  if(sessions.length === 0){
    historyEl.innerHTML = '<div class="empty-state">Sin sesiones registradas todavía.</div>';
    return;
  }
  historyEl.innerHTML = sessions.map(s => `<div class="activity-item session-history-item" data-date="${s.date}">
    <span class="act-date">${fmtShort(fromISO(s.date))}</span>
    <span class="act-detail">${escapeHtml(formatSessionSets(s.sets))}</span>
    <button class="session-history-remove" data-date="${s.date}" title="Borrar sesión">✕</button>
  </div>`).join('');
}

function setSessionDate(dateIso, sessions){
  setSessionEditDate(dateIso);
  const label = dateIso === todayISO() ? 'Hoy' : fmtShort(fromISO(dateIso));
  document.getElementById('session-today-label').textContent = label;
  const existing = sessions.find(s => s.date === dateIso);
  setSessionSetRows(existing ? existing.sets.map(s => ({ weight: s.weight, reps: s.reps })) : [{ weight: '', reps: '' }]);
  renderSessionSetRows();
}

export async function openSessionModal(exerciseId, dateOverride){
  const exercise = exercisesById[exerciseId];
  if(!exercise) return;
  setSessionExercise(exercise);
  const target = (exercise.sets_target != null ? exercise.sets_target : '—')+'x'+(exercise.reps_target || '—');
  document.getElementById('session-modal-title').textContent = exercise.name;
  document.getElementById('session-modal-target').textContent = target;
  document.getElementById('session-modal-overlay').classList.remove('hidden');

  document.getElementById('session-history').innerHTML = '<div class="empty-state">Cargando...</div>';
  const logs = await loadExerciseLogs(exerciseId);
  const sessions = groupLogsBySession(logs);
  renderSessionHistory(sessions);
  setSessionDate(dateOverride || todayISO(), sessions);
}
export function closeSessionModal(){
  document.getElementById('session-modal-overlay').classList.add('hidden');
  setSessionExercise(null);
  setSessionSetRows([]);
}

export function renderSessionSetRows(){
  const container = document.getElementById('session-sets');
  container.innerHTML = sessionSetRows.map((row, i) => `<div class="session-set-row" data-idx="${i}">
    <input type="text" inputmode="decimal" class="session-set-weight" data-idx="${i}" placeholder="kg" value="${row.weight ?? ''}">
    <span class="session-set-x">×</span>
    <input type="text" inputmode="numeric" class="session-set-reps" data-idx="${i}" placeholder="reps" value="${row.reps ?? ''}">
    <button class="session-set-remove" data-idx="${i}" title="Quitar">✕</button>
  </div>`).join('');
}
export function addSessionSetRow(){
  const last = sessionSetRows[sessionSetRows.length-1];
  sessionSetRows.push({ weight: last ? last.weight : '', reps: '' });
  renderSessionSetRows();
}
export function removeSessionSetRow(idx){
  sessionSetRows.splice(idx, 1);
  renderSessionSetRows();
}
export function updateSessionSetField(idx, field, value){
  if(!sessionSetRows[idx]) return;
  sessionSetRows[idx][field] = value;
}

export async function saveSession(){
  if(!sessionExercise || !sessionEditDate) return;
  const rows = sessionSetRows
    .map(r => ({
      weight: String(r.weight).trim() === '' ? null : parseFloat(String(r.weight).trim().replace(',', '.')),
      reps: String(r.reps).trim() === '' ? null : parseInt(String(r.reps).trim(), 10),
    }))
    .filter(r => r.weight != null || r.reps != null);
  if(rows.length === 0){ showToast('Cargá al menos una serie'); return; }

  const { error } = await replaceSessionSets(sessionExercise.id, sessionEditDate, rows);
  if(error){ console.error(error); showToast('No se pudo guardar'); return; }
  closeSessionModal();
  await refreshRoutineViews();
  showToast('Sesión guardada');
}

export async function deleteSessionHistoryEntry(exerciseId, date){
  const { error } = await deleteSessionLogs(exerciseId, date);
  if(error){ console.error(error); showToast('No se pudo borrar'); return; }
  showToast('Sesión eliminada');
  await openSessionModal(exerciseId, date === sessionEditDate ? todayISO() : sessionEditDate);
  await refreshRoutineViews();
}

// ---------- Calendario por ejercicio ----------

export async function openExerciseCalendar(exerciseId){
  const exercise = exercisesById[exerciseId];
  if(!exercise) return;
  setExerciseCalendarExerciseId(exerciseId);
  document.getElementById('exercise-cal-title').textContent = exercise.name;
  const logs = await loadExerciseLogs(exerciseId);
  const sessions = new Map(groupLogsBySession(logs).map(s => [s.date, s.sets]));
  setExerciseCalendarSessions(sessions);
  const now = new Date(); now.setDate(1); now.setHours(0,0,0,0);
  setExerciseCalendarMonth(now);
  renderExerciseCalendar();
  document.getElementById('exercise-cal-modal-overlay').classList.remove('hidden');
}
export function closeExerciseCalendar(){
  document.getElementById('exercise-cal-modal-overlay').classList.add('hidden');
  setExerciseCalendarExerciseId(null);
}
export function exerciseCalendarPrevMonth(){
  exerciseCalendarMonth.setMonth(exerciseCalendarMonth.getMonth()-1);
  renderExerciseCalendar();
}
export function exerciseCalendarNextMonth(){
  exerciseCalendarMonth.setMonth(exerciseCalendarMonth.getMonth()+1);
  renderExerciseCalendar();
}
export function renderExerciseCalendar(){
  document.getElementById('exercise-cal-month-label').textContent = MONTHS[exerciseCalendarMonth.getMonth()]+' '+exerciseCalendarMonth.getFullYear();
  const dowRow = document.getElementById('exercise-cal-dow-row');
  dowRow.innerHTML = DOW.map(d => '<div class="cal-dow">'+d+'</div>').join('');

  const grid = document.getElementById('exercise-cal-grid');
  grid.innerHTML = '';
  const first = new Date(exerciseCalendarMonth);
  const offset = (first.getDay()+6)%7;
  const daysInMonth = new Date(exerciseCalendarMonth.getFullYear(), exerciseCalendarMonth.getMonth()+1, 0).getDate();
  const today = todayISO();

  for(let i=0;i<offset;i++){
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(exerciseCalendarMonth.getFullYear(), exerciseCalendarMonth.getMonth(), day);
    const iso = toISO(d);
    const isFuture = iso > today;
    const sets = exerciseCalendarSessions.get(iso);
    const hasLog = !!sets;
    const el = document.createElement('div');
    el.className = 'cal-day' + (isFuture ? ' future' : '') + (iso === today ? ' today' : '') + (hasLog ? ' has-entry' : ' no-entry');
    el.innerHTML = '<span>'+day+'</span><span class="dot"></span>';
    if(!isFuture){
      el.addEventListener('click', () => pickExerciseCalendarDay(iso));
    }
    grid.appendChild(el);
  }
  document.getElementById('exercise-cal-next').disabled = (exerciseCalendarMonth.getFullYear()===new Date().getFullYear() && exerciseCalendarMonth.getMonth()===new Date().getMonth());
  renderExerciseCalendarMonthList();
}

function renderExerciseCalendarMonthList(){
  const listEl = document.getElementById('exercise-cal-month-list');
  if(!listEl) return;
  const year = exerciseCalendarMonth.getFullYear();
  const month = exerciseCalendarMonth.getMonth();
  const monthEntries = Array.from(exerciseCalendarSessions.entries())
    .filter(([iso]) => { const d = fromISO(iso); return d.getFullYear() === year && d.getMonth() === month; })
    .sort(([a], [b]) => b.localeCompare(a));
  if(monthEntries.length === 0){
    listEl.innerHTML = '<div class="empty-state">Sin registros este mes.</div>';
    return;
  }
  listEl.innerHTML = monthEntries.map(([iso, sets]) => `<div class="activity-item exercise-cal-month-item">
    <span class="act-date">${escapeHtml(fmtShort(fromISO(iso)))}</span>
    <span class="act-detail">${escapeHtml(formatSessionSets(sets))}</span>
  </div>`).join('');
}
async function pickExerciseCalendarDay(iso){
  const exerciseId = exerciseCalendarExerciseId;
  closeExerciseCalendar();
  await openSessionModal(exerciseId, iso);
}

// ---------- Delegación de clicks sobre el contenido dinámico ----------

export function wireRoutinesDelegation(){
  document.getElementById('routine-days-container').addEventListener('click', (e)=>{
    const addBtn = e.target.closest('.btn-add-exercise');
    if(addBtn){
      const day = Number(addBtn.dataset.day);
      if(isJiggling(day)){ exitJiggleMode(); return; }
      if(isJiggling()) return;
      openAssignModal(day, null);
      return;
    }
    if(isJiggling()) return; // mientras se reordena un día, el resto de la lista queda bloqueada
    const calBtn = e.target.closest('.ex-calendar-btn');
    if(calBtn){ e.stopPropagation(); openExerciseCalendar(calBtn.dataset.id); return; }
    const removeBtn = e.target.closest('.ex-remove-btn');
    if(removeBtn){ e.stopPropagation(); unassignFromDay(removeBtn.dataset.id, Number(removeBtn.dataset.day)); return; }
    const addAlt = e.target.closest('.btn-add-alt');
    if(addAlt){ openAssignModal(Number(addAlt.dataset.day), Number(addAlt.dataset.order)); return; }
    const editBtn = e.target.closest('.routine-day-edit');
    if(editBtn){ openDayNameModal(Number(editBtn.dataset.day)); return; }
    const row = e.target.closest('.exercise-row');
    if(row){ openSessionModal(row.dataset.id); return; }
  });
  wireDragReorder();

  document.getElementById('exercise-catalog-container').addEventListener('click', (e)=>{
    const addBtn = e.target.closest('#btn-add-catalog-exercise');
    if(addBtn){ openExerciseModal(null, null); return; }
    const row = e.target.closest('.exercise-catalog-row');
    if(row){ openExerciseModal(exercisesById[row.dataset.id], null); return; }
  });

  document.getElementById('assign-exercise-list').addEventListener('click', (e)=>{
    const btn = e.target.closest('.assign-exercise-add');
    if(btn) assignExistingExercise(btn.dataset.id);
  });

  document.getElementById('session-modal-edit-exercise').addEventListener('click', ()=>{
    if(!sessionExercise) return;
    const exercise = exercisesById[sessionExercise.id];
    if(!exercise) return;
    closeSessionModal();
    openExerciseModal(exercise, null);
  });

  document.getElementById('session-add-set').addEventListener('click', addSessionSetRow);
  document.getElementById('session-sets').addEventListener('click', (e)=>{
    const removeBtn = e.target.closest('.session-set-remove');
    if(removeBtn) removeSessionSetRow(Number(removeBtn.dataset.idx));
  });
  document.getElementById('session-sets').addEventListener('input', (e)=>{
    const idx = e.target.dataset.idx;
    if(idx == null) return;
    if(e.target.classList.contains('session-set-weight')) updateSessionSetField(Number(idx), 'weight', e.target.value);
    if(e.target.classList.contains('session-set-reps')) updateSessionSetField(Number(idx), 'reps', e.target.value);
  });
  document.getElementById('session-history').addEventListener('click', (e)=>{
    const removeBtn = e.target.closest('.session-history-remove');
    if(removeBtn && sessionExercise){ deleteSessionHistoryEntry(sessionExercise.id, removeBtn.dataset.date); return; }
    const item = e.target.closest('.session-history-item');
    if(item && sessionExercise){
      loadExerciseLogs(sessionExercise.id).then(logs => {
        const sessions = groupLogsBySession(logs);
        setSessionDate(item.dataset.date, sessions);
      });
    }
  });

  document.getElementById('exercise-cal-close').addEventListener('click', closeExerciseCalendar);
  document.getElementById('exercise-cal-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='exercise-cal-modal-overlay') closeExerciseCalendar(); });
  document.getElementById('exercise-cal-prev').addEventListener('click', exerciseCalendarPrevMonth);
  document.getElementById('exercise-cal-next').addEventListener('click', exerciseCalendarNextMonth);
}
