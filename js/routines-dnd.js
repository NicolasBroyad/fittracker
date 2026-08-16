import { routineExercises } from './routines-state.js';
import { updateExerciseDayOrderIndex } from './routines-storage.js';
import { renderRoutines } from './routines-render.js';

const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 8;

let jiggleDayOfWeek = null;

// dayOfWeek omitido -> ¿hay algún día en modo reordenar?
export function isJiggling(dayOfWeek){
  return dayOfWeek == null ? jiggleDayOfWeek !== null : jiggleDayOfWeek === dayOfWeek;
}

function updateAddButtonLabel(panel, dayOfWeek){
  const btn = panel.querySelector('.btn-add-exercise');
  if(!btn) return;
  const done = jiggleDayOfWeek === dayOfWeek;
  btn.textContent = done ? 'Listo' : '+ Ejercicio';
  btn.classList.toggle('btn-add-exercise-done', done);
}

function onOutsidePointerDown(e){
  if(jiggleDayOfWeek === null) return;
  const list = document.querySelector(`.routine-day-panel[data-day="${jiggleDayOfWeek}"] .exercise-list`);
  if(list && list.contains(e.target)) return;
  if(e.target.closest && e.target.closest('.btn-add-exercise')) return; // lo maneja el click handler (botón "Listo")
  exitJiggleMode();
}

export function enterJiggleMode(dayOfWeek){
  if(jiggleDayOfWeek === dayOfWeek) return;
  if(jiggleDayOfWeek !== null) exitJiggleMode();
  jiggleDayOfWeek = dayOfWeek;
  const panel = document.querySelector(`.routine-day-panel[data-day="${dayOfWeek}"]`);
  if(!panel) return;
  const list = panel.querySelector('.exercise-list');
  if(list) list.classList.add('jiggle-mode');
  updateAddButtonLabel(panel, dayOfWeek);
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
}

export function exitJiggleMode(){
  if(jiggleDayOfWeek === null) return;
  const dayOfWeek = jiggleDayOfWeek;
  jiggleDayOfWeek = null;
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  const panel = document.querySelector(`.routine-day-panel[data-day="${dayOfWeek}"]`);
  if(!panel) return;
  const list = panel.querySelector('.exercise-list');
  if(list) list.classList.remove('jiggle-mode');
  updateAddButtonLabel(panel, dayOfWeek);
}

function reapplyJiggleAfterRender(dayOfWeek){
  if(jiggleDayOfWeek !== dayOfWeek) return;
  const panel = document.querySelector(`.routine-day-panel[data-day="${dayOfWeek}"]`);
  if(!panel) return;
  const list = panel.querySelector('.exercise-list');
  if(list) list.classList.add('jiggle-mode');
  updateAddButtonLabel(panel, dayOfWeek);
}

// reposiciona el elemento ya movido en el DOM para que visualmente no salte
// (queda en el mismo lugar en pantalla, vía transform, hasta el próximo pointermove)
function reflow(el, desiredTop){
  el.style.transform = '';
  const newTop = el.getBoundingClientRect().top;
  const diff = desiredTop - newTop;
  el.style.transform = `translateY(${diff}px)`;
  return diff;
}

function startDragging(slotEl, dayOfWeek, pointerId, startClientY){
  const list = slotEl.parentElement;
  slotEl.classList.add('dragging');
  try{ slotEl.setPointerCapture(pointerId); }catch(e){}
  let lastY = startClientY;
  let translateY = 0;

  function checkSwap(){
    const dragRect = slotEl.getBoundingClientRect();
    const dragCenter = dragRect.top + dragRect.height/2;
    const prev = slotEl.previousElementSibling;
    if(prev && prev.classList.contains('exercise-slot')){
      const r = prev.getBoundingClientRect();
      if(dragCenter < r.top + r.height/2){
        list.insertBefore(slotEl, prev);
        translateY = reflow(slotEl, dragRect.top);
        return;
      }
    }
    const next = slotEl.nextElementSibling;
    if(next && next.classList.contains('exercise-slot')){
      const r = next.getBoundingClientRect();
      if(dragCenter > r.top + r.height/2){
        list.insertBefore(next, slotEl);
        translateY = reflow(slotEl, dragRect.top);
      }
    }
  }

  function onMove(e){
    if(e.pointerId !== pointerId) return;
    translateY += (e.clientY - lastY);
    lastY = e.clientY;
    slotEl.style.transform = `translateY(${translateY}px)`;
    checkSwap();
  }
  function onUp(e){
    if(e.pointerId !== pointerId) return;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    slotEl.classList.remove('dragging');
    slotEl.style.transform = '';
    try{ slotEl.releasePointerCapture(pointerId); }catch(err){}
    persistNewOrder(dayOfWeek, list);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

async function persistNewOrder(dayOfWeek, list){
  const slotEls = Array.from(list.querySelectorAll(':scope > .exercise-slot'));
  const exercises = routineExercises[dayOfWeek] || [];
  const updates = [];
  slotEls.forEach((el, i) => {
    const oldOrder = Number(el.dataset.order);
    if(oldOrder === i) return;
    exercises.filter(ex => ex.order_index === oldOrder).forEach(ex => {
      updates.push(updateExerciseDayOrderIndex(ex.id, dayOfWeek, i).then(() => { ex.order_index = i; }));
    });
  });
  if(updates.length === 0) return;
  await Promise.all(updates);
  await renderRoutines();
  reapplyJiggleAfterRender(dayOfWeek);
}

export function wireDragReorder(){
  document.getElementById('routine-days-container').addEventListener('pointerdown', (e)=>{
    if(e.button !== undefined && e.button !== 0) return;
    const slotEl = e.target.closest('.exercise-slot');
    if(!slotEl || e.target.closest('.btn-add-alt') || e.target.closest('.ex-remove-btn') || e.target.closest('.ex-calendar-btn')) return;
    const panel = slotEl.closest('.routine-day-panel');
    const dayOfWeek = Number(panel.dataset.day);

    if(jiggleDayOfWeek === dayOfWeek){
      startDragging(slotEl, dayOfWeek, e.pointerId, e.clientY);
      return;
    }
    if(jiggleDayOfWeek !== null) return; // otro día ya está en modo reordenar

    const startX = e.clientX, startY = e.clientY;
    const pointerId = e.pointerId;
    const timer = setTimeout(()=>{
      cleanup();
      enterJiggleMode(dayOfWeek);
      startDragging(slotEl, dayOfWeek, pointerId, startY);
    }, LONG_PRESS_MS);
    function onMove(ev){
      if(ev.pointerId !== pointerId) return;
      if(Math.abs(ev.clientX-startX) > MOVE_CANCEL_PX || Math.abs(ev.clientY-startY) > MOVE_CANCEL_PX) cleanup();
    }
    function onUp(ev){ if(ev.pointerId === pointerId) cleanup(); }
    function cleanup(){
      clearTimeout(timer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}
