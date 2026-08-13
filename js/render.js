import { entries, viewMonth } from './state.js';
import { MONTHS, DOW, fromISO, toISO, todayISO, fmtShort, escapeHtml } from './utils.js';
import { computeCurrent, computeTrend, computeStreak, computeMinMax, sortedDates } from './derived.js';
import { renderChart } from './chart.js';
import { openDayModal } from './modal.js';

export function renderStats(){
  const cur = computeCurrent();
  document.getElementById('stat-current').innerHTML = cur ? cur.weight.toFixed(2)+' <span class="unit">kg</span>' : '— <span class="unit">kg</span>';
  document.getElementById('stat-current-date').textContent = cur ? ('último registro: '+fmtShort(fromISO(cur.date))) : 'sin registros';

  const trend = computeTrend();
  const elVal = document.getElementById('stat-trend');
  const elSub = document.getElementById('stat-trend-sub');
  if(!trend){
    elVal.innerHTML = '—';
    elSub.textContent = 'datos insuficientes';
  } else {
    const dir = trend.delta > 0.05 ? 'up' : (trend.delta < -0.05 ? 'down' : 'flat');
    const arrow = dir==='up' ? '↗' : (dir==='down' ? '↘' : '→');
    const cls = 'trend-'+dir;
    elVal.innerHTML = '<span class="trend-arrow '+cls+'">'+arrow+'</span><span class="'+cls+'">'+(trend.delta>=0?'+':'')+trend.delta.toFixed(2)+' kg</span>';
    elSub.textContent = (trend.pct>=0?'+':'')+trend.pct.toFixed(1)+'% · últimos '+trend.n1+' vs '+trend.n0+' registros previos';
  }

  const streak = computeStreak();
  document.getElementById('stat-streak').innerHTML = streak.count+'<span class="unit">días</span>';
  const upToDate = streak.lastDate === todayISO();
  document.getElementById('stat-streak-sub').textContent = streak.count===0 ? 'sin registros' : (upToDate ? 'al día' : 'último: '+fmtShort(fromISO(streak.lastDate)));
  const ticksEl = document.getElementById('stat-streak-ticks');
  ticksEl.innerHTML='';
  for(let i=0;i<14;i++){
    const s = document.createElement('span');
    if(i < Math.min(streak.count,14)) s.classList.add('on');
    ticksEl.appendChild(s);
  }

  const mm = computeMinMax();
  document.getElementById('stat-max').innerHTML = mm ? mm.max.weight.toFixed(2)+'<span style="font-size:.7rem;color:var(--ink-faint)"> kg</span>' : '—';
  document.getElementById('stat-min').innerHTML = mm ? mm.min.weight.toFixed(2)+'<span style="font-size:.7rem;color:var(--ink-faint)"> kg</span>' : '—';
}

export function renderCalendar(){
  document.getElementById('cal-month-label').textContent = MONTHS[viewMonth.getMonth()]+' '+viewMonth.getFullYear();

  const dowRow = document.getElementById('cal-dow-row');
  dowRow.innerHTML = DOW.map(d=>'<div class="cal-dow">'+d+'</div>').join('');

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const first = new Date(viewMonth);
  const offset = (first.getDay()+6)%7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
  const today = todayISO();

  for(let i=0;i<offset;i++){
    const e = document.createElement('div');
    e.className='cal-day empty';
    grid.appendChild(e);
  }
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const iso = toISO(d);
    const isFuture = iso > today;
    const el = document.createElement('div');
    el.className = 'cal-day' + (isFuture?' future':'') + (iso===today?' today':'') + (entries[iso] ? ' has-entry':' no-entry') + (entries[iso] && entries[iso].note ? ' has-note':'');
    el.innerHTML = '<span>'+day+'</span><span class="dot"></span>';
    if(entries[iso]){
      el.title = entries[iso].weight.toFixed(2)+' kg'+(entries[iso].note ? ' — '+entries[iso].note : '');
    }
    if(!isFuture){
      el.addEventListener('click', ()=>openDayModal(iso));
    }
    grid.appendChild(el);
  }

  document.getElementById('cal-next').disabled = (viewMonth.getFullYear()===new Date().getFullYear() && viewMonth.getMonth()===new Date().getMonth());
}

export function renderNotes(){
  const dates = sortedDates().filter(d=>entries[d].note && entries[d].note.trim()!=='').reverse().slice(0,6);
  const list = document.getElementById('notes-list');
  if(dates.length===0){ list.innerHTML = '<div class="empty-state">Todavía no agregaste notas. Podés sumar una al cargar tu peso del día.</div>'; return; }
  list.innerHTML = dates.map(d=>{
    return `<div class="note-item">
      <span class="nd">${fmtShort(fromISO(d))}</span>
      <span class="nw">${entries[d].weight.toFixed(2)}kg</span>
      <span class="nt">${escapeHtml(entries[d].note)}</span>
    </div>`;
  }).join('');
}

export function renderRecords(){
  const dates = sortedDates().slice().reverse();
  const countEl = document.getElementById('records-count');
  countEl.textContent = dates.length===0 ? '' : (dates.length+(dates.length===1?' registro':' registros'));
  const list = document.getElementById('records-list');
  if(dates.length===0){ list.innerHTML = '<div class="empty-state">Todavía no hay registros.</div>'; return; }
  list.innerHTML = dates.map(d=>{
    const e = entries[d];
    const dObj = fromISO(d);
    const label = DOW[(dObj.getDay()+6)%7]+' '+dObj.getDate()+' '+MONTHS[dObj.getMonth()].slice(0,3)+' '+dObj.getFullYear();
    return `<div class="record-item" data-date="${d}">
      <span class="rd">${label}</span>
      <span class="rw">${e.weight.toFixed(2)} kg</span>
      <span class="rt">${e.note ? escapeHtml(e.note) : ''}</span>
    </div>`;
  }).join('');
  list.querySelectorAll('.record-item').forEach(el=>{
    el.addEventListener('click', ()=>openDayModal(el.dataset.date));
  });
}

export function renderAll(){
  renderStats();
  renderCalendar();
  renderChart();
  renderNotes();
  renderRecords();
}
