import { entries, selectedDateStr, setSelectedDateStr } from './state.js';
import { fromISO, MONTHS, DOW, showToast } from './utils.js';
import { upsertEntry, deleteEntryByDate, logChange } from './storage.js';
import { renderAll } from './render.js';

export function openDayModal(iso){
  if(entries[iso]) openViewModal(iso);
  else openModal(iso);
}

export function openViewModal(iso){
  setSelectedDateStr(iso);
  const d = fromISO(iso);
  const e = entries[iso];
  document.getElementById('view-modal-date').textContent = DOW[(d.getDay()+6)%7]+' '+d.getDate()+' de '+MONTHS[d.getMonth()]+' de '+d.getFullYear();
  document.getElementById('view-modal-weight').textContent = e.weight.toFixed(2)+' kg';
  const noteEl = document.getElementById('view-modal-note');
  const hasNote = e.note && e.note.trim() !== '';
  noteEl.textContent = hasNote ? e.note : 'Sin nota';
  noteEl.classList.toggle('empty', !hasNote);
  document.getElementById('view-modal-overlay').classList.remove('hidden');
}
export function closeViewModal(){
  document.getElementById('view-modal-overlay').classList.add('hidden');
  setSelectedDateStr(null);
}
export function editFromViewModal(){
  const iso = selectedDateStr;
  closeViewModal();
  openModal(iso);
}

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
  const raw = document.getElementById('input-weight').value.trim().replace(',', '.');
  const w = parseFloat(raw);
  if(raw === '' || isNaN(w) || w<=0){ showToast('Ingresá un peso válido'); return; }
  const note = document.getElementById('input-note').value.trim();
  const weight = Math.round(w*100)/100;
  const previous = entries[selectedDateStr] ? { ...entries[selectedDateStr] } : null;
  const { error } = await upsertEntry(selectedDateStr, weight, note);
  if(error){ console.error(error); showToast('No se pudo guardar'); return; }
  entries[selectedDateStr] = { weight, note };
  logChange(selectedDateStr, previous ? 'updated' : 'created', previous, { weight, note });
  closeModal();
  renderAll();
  showToast('Guardado');
}
export async function deleteEntry(){
  const previous = entries[selectedDateStr] ? { ...entries[selectedDateStr] } : null;
  const { error } = await deleteEntryByDate(selectedDateStr);
  if(error){ console.error(error); showToast('No se pudo eliminar'); return; }
  delete entries[selectedDateStr];
  logChange(selectedDateStr, 'deleted', previous, null);
  closeModal();
  renderAll();
  showToast('Registro eliminado');
}
