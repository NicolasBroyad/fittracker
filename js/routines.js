import {
  DAY_NAMES, routineDays, routineExercises, setRoutineDays, setRoutineExercises,
  editingDay, setEditingDay,
  editingExercise, setEditingExercise, sessionExercise, setSessionExercise,
  sessionEditDate, setSessionEditDate, sessionSetRows, setSessionSetRows,
  exerciseCalendarExerciseId, setExerciseCalendarExerciseId,
  exerciseCalendarMonth, setExerciseCalendarMonth,
  exerciseCalendarLogDates, setExerciseCalendarLogDates,
} from './routines-state.js';
import {
  loadRoutineDays, loadRoutineExercises, saveRoutineDay,
  createExercise, updateExercise, deleteExercise,
  loadExerciseLogs, replaceSessionSets, deleteSessionLogs,
} from './routines-storage.js';
import { renderRoutines } from './routines-render.js';
import { renderGym } from './gym-render.js';
import { renderHome } from './home-render.js';
import { groupLogsBySession, formatSessionSets, groupIntoSlots } from './routines-derived.js';
import { wireDragReorder, isJiggling, exitJiggleMode } from './routines-dnd.js';
import { showToast, escapeHtml, todayISO, fromISO, toISO, fmtShort, MONTHS, DOW } from './utils.js';

export async function loadRoutines(){
  const [days, exercises] = await Promise.all([loadRoutineDays(), loadRoutineExercises()]);
  setRoutineDays(days);
  setRoutineExercises(exercises);
  await renderRoutines();
  updateTodayScrollHint();
}

// refresca las 3 vistas que dependen de rutinas, sin importar cuál esté visible en este momento
async function refreshRoutineViews(){
  await Promise.all([renderRoutines(), renderGym(), renderHome()]);
  updateTodayScrollHint();
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

// ---------- Modal: ejercicio (alta/edición/borrado/alternativa) ----------

export function openExerciseModal(dayOfWeek, exercise, slotOrderIndex){
  setEditingExercise({ dayOfWeek, exercise: exercise || null, slotOrderIndex: slotOrderIndex != null ? slotOrderIndex : null });
  document.getElementById('exercise-modal-title').textContent = exercise ? 'Editar ejercicio' : (slotOrderIndex != null ? 'Nueva alternativa' : 'Nuevo ejercicio');
  document.getElementById('exercise-modal-day-label').textContent = DAY_NAMES[dayOfWeek-1];
  document.getElementById('exercise-input-name').value = exercise ? exercise.name : '';
  document.getElementById('exercise-input-sets').value = exercise && exercise.sets_target != null ? exercise.sets_target : '';
  document.getElementById('exercise-input-reps').value = exercise && exercise.reps_target ? exercise.reps_target : '';
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

  const { dayOfWeek, exercise, slotOrderIndex } = editingExercise;
  if(exercise){
    const { error } = await updateExercise(exercise.id, name, setsTarget, repsTarget);
    if(error){ console.error(error); showToast('No se pudo guardar'); return; }
    Object.assign(exercise, { name, sets_target: setsTarget, reps_target: repsTarget });
  } else {
    const existing = routineExercises[dayOfWeek] || [];
    let orderIndex, variant;
    if(slotOrderIndex != null){
      orderIndex = slotOrderIndex;
      const siblings = existing.filter(e => e.order_index === slotOrderIndex);
      variant = siblings.length === 0 ? 0 : Math.max(...siblings.map(e => e.variant)) + 1;
    } else {
      const slots = groupIntoSlots(existing);
      orderIndex = slots.length === 0 ? 0 : Math.max(...slots.map(s => s.orderIndex)) + 1;
      variant = 0;
    }
    const { data, error } = await createExercise(dayOfWeek, name, setsTarget, repsTarget, orderIndex, variant);
    if(error){ console.error(error); showToast('No se pudo crear el ejercicio'); return; }
    if(!routineExercises[dayOfWeek]) routineExercises[dayOfWeek] = [];
    routineExercises[dayOfWeek].push(data);
  }
  closeExerciseModal();
  await refreshRoutineViews();
  showToast('Guardado');
}
export async function deleteExerciseModal(){
  const { dayOfWeek, exercise } = editingExercise;
  if(!exercise) return;
  const { error } = await deleteExercise(exercise.id);
  if(error){ console.error(error); showToast('No se pudo borrar'); return; }
  routineExercises[dayOfWeek] = (routineExercises[dayOfWeek] || []).filter(e => e.id !== exercise.id);
  closeExerciseModal();
  await refreshRoutineViews();
  showToast('Ejercicio eliminado');
}

// ---------- Modal: registrar/editar sesión ----------

function findExercise(id){
  for(const day of Object.keys(routineExercises)){
    const found = (routineExercises[day] || []).find(e => e.id === id);
    if(found) return { dayOfWeek: Number(day), exercise: found };
  }
  return null;
}

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
  const found = findExercise(exerciseId);
  if(!found) return;
  setSessionExercise(found.exercise);
  const target = (found.exercise.sets_target != null ? found.exercise.sets_target : '—')+'x'+(found.exercise.reps_target || '—');
  document.getElementById('session-modal-title').textContent = found.exercise.name;
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
  const found = findExercise(exerciseId);
  if(!found) return;
  setExerciseCalendarExerciseId(exerciseId);
  document.getElementById('exercise-cal-title').textContent = found.exercise.name;
  const logs = await loadExerciseLogs(exerciseId);
  setExerciseCalendarLogDates(new Set(logs.map(l => l.session_date)));
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
    const hasLog = exerciseCalendarLogDates.has(iso);
    const el = document.createElement('div');
    el.className = 'cal-day' + (isFuture ? ' future' : '') + (iso === today ? ' today' : '') + (hasLog ? ' has-entry' : ' no-entry');
    el.innerHTML = '<span>'+day+'</span><span class="dot"></span>';
    if(!isFuture){
      el.addEventListener('click', () => pickExerciseCalendarDay(iso));
    }
    grid.appendChild(el);
  }
  document.getElementById('exercise-cal-next').disabled = (exerciseCalendarMonth.getFullYear()===new Date().getFullYear() && exerciseCalendarMonth.getMonth()===new Date().getMonth());
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
      openExerciseModal(day, null);
      return;
    }
    if(isJiggling()) return; // mientras se reordena un día, el resto de la lista queda bloqueada
    const calBtn = e.target.closest('.ex-calendar-btn');
    if(calBtn){ e.stopPropagation(); openExerciseCalendar(calBtn.dataset.id); return; }
    const addAlt = e.target.closest('.btn-add-alt');
    if(addAlt){ openExerciseModal(Number(addAlt.closest('.routine-day-panel').dataset.day), null, Number(addAlt.dataset.order)); return; }
    const editBtn = e.target.closest('.routine-day-edit');
    if(editBtn){ openDayNameModal(Number(editBtn.dataset.day)); return; }
    const row = e.target.closest('.exercise-row');
    if(row){ openSessionModal(row.dataset.id); return; }
  });
  wireDragReorder();

  document.getElementById('session-modal-edit-exercise').addEventListener('click', ()=>{
    if(!sessionExercise) return;
    const found = findExercise(sessionExercise.id);
    if(!found) return;
    closeSessionModal();
    openExerciseModal(found.dayOfWeek, found.exercise);
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
