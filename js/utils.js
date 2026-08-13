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
export const CHART_RANGE_MONTHS = { '1m':1, '3m':3, '6m':6, '1y':12 };
export function rangeCutoffISO(range){
  const months = CHART_RANGE_MONTHS[range];
  if(!months) return null; // 'all' o valor desconocido: sin recorte
  const now = new Date();
  return toISO(new Date(now.getFullYear(), now.getMonth()-months, now.getDate()));
}

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

const TREND_ARROW_SVG = {
  up: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7L17 17"/><path d="M17 8v9H8"/></svg>',
  flat: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
};
export function trendArrowSvg(dir){
  return TREND_ARROW_SVG[dir] || TREND_ARROW_SVG.flat;
}
