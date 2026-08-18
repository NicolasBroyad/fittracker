import { phases, setPhases } from './state.js';
import { loadPhases, createPhase, finishPhase, deletePhase } from './storage.js';
import { showToast, todayISO, PHASE_LABELS, fromISO, fmtShort } from './utils.js';
import { rerenderIfOpen } from './chart-modal.js';

// la fase "en curso" es la más reciente (por start_date) entre las que no tienen end_date
export function currentPhase(){
  const open = phases.filter(p => p.end_date == null);
  if(open.length === 0) return null;
  return open.reduce((a, b) => (b.start_date > a.start_date ? b : a));
}

export function openPhaseModal(){
  document.getElementById('phase-input-type').value = 'volumen';
  document.getElementById('phase-input-start').value = todayISO();
  document.getElementById('phase-input-end').value = '';
  document.getElementById('phase-modal-overlay').classList.remove('hidden');
}
export function closePhaseModal(){
  document.getElementById('phase-modal-overlay').classList.add('hidden');
}

export async function submitPhase(){
  const phase = document.getElementById('phase-input-type').value;
  const startDate = document.getElementById('phase-input-start').value;
  const endDate = document.getElementById('phase-input-end').value || null;
  if(!startDate){ showToast('Ingresá la fecha de inicio'); return; }
  if(endDate && endDate < startDate){ showToast('La fecha de fin no puede ser anterior al inicio'); return; }

  // si esta fase queda "en curso" (sin fin) y ya había otra en curso, esa otra se cierra
  // justo cuando arranca la nueva, para que no queden dos fases en curso a la vez
  if(!endDate){
    const open = currentPhase();
    if(open){
      const { error } = await finishPhase(open.id, startDate);
      if(error){ console.error(error); showToast('No se pudo guardar la fase'); return; }
    }
  }

  const { error } = await createPhase(phase, startDate, endDate);
  if(error){ console.error(error); showToast('No se pudo guardar la fase'); return; }
  closePhaseModal();
  await refreshPhases();
  showToast('Fase guardada');
}

export async function finishCurrentPhase(){
  const open = currentPhase();
  if(!open) return;
  const { error } = await finishPhase(open.id, todayISO());
  if(error){ console.error(error); showToast('No se pudo finalizar la fase'); return; }
  await refreshPhases();
  showToast('Fase finalizada');
}

export async function deletePhaseEntry(id){
  const { error } = await deletePhase(id);
  if(error){ console.error(error); showToast('No se pudo borrar'); return; }
  await refreshPhases();
  showToast('Fase eliminada');
}

async function refreshPhases(){
  setPhases(await loadPhases());
  renderPhasePanel();
  rerenderIfOpen();
}

export async function loadAndRenderPhases(){
  setPhases(await loadPhases());
  renderPhasePanel();
}

export function renderPhasePanel(){
  const current = currentPhase();
  const currentEl = document.getElementById('goal-phase-current');
  if(current){
    currentEl.innerHTML = `
      <span class="goal-phase-badge phase-${current.phase}">${PHASE_LABELS[current.phase]}</span>
      <span class="goal-phase-dates">desde ${fmtShort(fromISO(current.start_date))}</span>
      <button class="btn-finish-phase" id="btn-finish-phase">Finalizar fase</button>
    `;
  } else {
    currentEl.innerHTML = '<span class="goal-phase-badge phase-none">Sin fase actual</span>';
  }

  const closed = phases.filter(p => p.end_date != null);
  const histList = document.getElementById('phase-history-list');
  if(closed.length === 0){
    histList.innerHTML = '<div class="empty-state">Sin fases pasadas cargadas.</div>';
    return;
  }
  histList.innerHTML = closed.map(p => `<div class="activity-item phase-history-item">
    <span class="goal-phase-badge phase-${p.phase}">${PHASE_LABELS[p.phase]}</span>
    <span class="act-detail">${fmtShort(fromISO(p.start_date))} – ${fmtShort(fromISO(p.end_date))}</span>
    <button class="phase-history-remove" data-id="${p.id}" title="Borrar">✕</button>
  </div>`).join('');
}
