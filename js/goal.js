import { currentGoal } from './state.js';
import { saveGoal } from './storage.js';
import { showToast } from './utils.js';
import { renderGoal } from './render.js';

export function openGoalModal(){
  const g = currentGoal;
  document.getElementById('goal-input-weight').value = g && g.target_weight != null ? g.target_weight : '';
  document.getElementById('goal-phase').value = g && g.phase ? g.phase : '';
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
}
export function closeGoalModal(){
  document.getElementById('goal-modal-overlay').classList.add('hidden');
}

export async function submitGoal(){
  const raw = document.getElementById('goal-input-weight').value.trim().replace(',', '.');
  let targetWeight = null;
  if(raw !== ''){
    const w = parseFloat(raw);
    if(isNaN(w) || w<=0){ showToast('Ingresá un peso de meta válido'); return; }
    targetWeight = Math.round(w*100)/100;
  }
  const phaseValue = document.getElementById('goal-phase').value;
  const phase = phaseValue === '' ? null : phaseValue;

  const { error } = await saveGoal(targetWeight, phase);
  if(error){ console.error(error); showToast('No se pudo guardar la meta'); return; }
  closeGoalModal();
  await renderGoal();
  showToast('Meta actualizada');
}

export async function clearGoal(){
  const { error } = await saveGoal(null, null);
  if(error){ console.error(error); showToast('No se pudo quitar la meta'); return; }
  closeGoalModal();
  await renderGoal();
  showToast('Meta eliminada');
}
