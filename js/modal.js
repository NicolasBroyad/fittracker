import { entries, selectedDateStr, setSelectedDateStr } from './state.js';
import { fromISO, MONTHS, DOW, showToast } from './utils.js';
import { upsertEntry, deleteEntryByDate } from './storage.js';
import { renderAll } from './render.js';

export function openModal(iso){
  setSelectedDateStr(iso);
  const d = fromISO(iso);
  document.getElementById('modal-date').textContent = DOW[(d.getDay()+6)%7]+' '+d.getDate()+' de '+MONTHS[d.getMonth()]+' de '+d.getFullYear();
  const existing = entries[iso];
  document.getElementById('input-weight').value = existing ? existing.weight : '';
  document.getElementById('input-note').value = existing ? (existing.note||'') : '';
  document.getElementById('btn-delete').classList.toggle('hidden', !existing);
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('input-weight').focus(), 50);
}
export function closeModal(){
  document.getElementById('modal-overlay').classList.add('hidden');
  setSelectedDateStr(null);
}
export async function saveEntry(){
  const w = parseFloat(document.getElementById('input-weight').value);
  if(isNaN(w) || w<=0){ showToast('Ingresá un peso válido'); return; }
  const note = document.getElementById('input-note').value.trim();
  const weight = Math.round(w*100)/100;
  const { error } = await upsertEntry(selectedDateStr, weight, note);
  if(error){ console.error(error); showToast('No se pudo guardar'); return; }
  entries[selectedDateStr] = { weight, note };
  closeModal();
  renderAll();
  showToast('Guardado');
}
export async function deleteEntry(){
  const { error } = await deleteEntryByDate(selectedDateStr);
  if(error){ console.error(error); showToast('No se pudo eliminar'); return; }
  delete entries[selectedDateStr];
  closeModal();
  renderAll();
  showToast('Registro eliminado');
}
