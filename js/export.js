import { entries } from './state.js';
import { sortedDates } from './derived.js';
import { showToast } from './utils.js';

function csvEscape(field){
  const s = String(field ?? '');
  if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

export function exportCSV(){
  const dates = sortedDates();
  if(dates.length === 0){ showToast('No hay datos para exportar'); return; }

  const rows = ['fecha,peso_kg,nota'];
  dates.forEach(d => {
    const e = entries[d];
    rows.push([d, e.weight.toFixed(2), csvEscape(e.note || '')].join(','));
  });
  // ﻿ (BOM) al inicio para que Excel detecte UTF-8 y muestre bien los acentos
  const csv = '﻿' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'registro-peso-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV descargado');
}
