export const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

export const PHASE_LABELS = {
  volumen: 'Volumen',
  definicion: 'Definición',
  mantenimiento: 'Mantenimiento',
};

export function pad(n){ return n<10 ? '0'+n : ''+n; }
export function toISO(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
export function fromISO(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
export function todayISO(){ return toISO(new Date()); }
export function fmtShort(dateObj){ return dateObj.getDate()+' '+MONTHS[dateObj.getMonth()].slice(0,3); }
export function mondayOf(d){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // 0=mon
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}
export function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
