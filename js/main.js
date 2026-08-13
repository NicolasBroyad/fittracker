import { viewMonth } from './state.js';
import { MONTHS, DOW, todayISO } from './utils.js';
import { renderCalendar } from './render.js';
import { openModal, closeModal, saveEntry, deleteEntry } from './modal.js';
import { setActiveTab, openChartModal, closeChartModal, rerenderIfOpen } from './chart-modal.js';
import { wireAuth, checkSession } from './auth.js';
import { initTheme } from './theme.js';

initTheme();

window.addEventListener('resize', rerenderIfOpen);

document.getElementById('cal-prev').addEventListener('click', ()=>{
  viewMonth.setMonth(viewMonth.getMonth()-1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', ()=>{
  viewMonth.setMonth(viewMonth.getMonth()+1);
  renderCalendar();
});
document.getElementById('tab-weekly').addEventListener('click', ()=>setActiveTab('weekly'));
document.getElementById('tab-daily').addEventListener('click', ()=>setActiveTab('daily'));
document.getElementById('tab-weekly-big').addEventListener('click', ()=>setActiveTab('weekly'));
document.getElementById('tab-daily-big').addEventListener('click', ()=>setActiveTab('daily'));
document.getElementById('btn-chart-expand').addEventListener('click', openChartModal);
document.getElementById('chart-modal-close').addEventListener('click', closeChartModal);
document.getElementById('chart-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='chart-modal-overlay') closeChartModal(); });
document.getElementById('btn-log-today').addEventListener('click', ()=>openModal(todayISO()));
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('btn-save').addEventListener('click', saveEntry);
document.getElementById('btn-delete').addEventListener('click', deleteEntry);
document.getElementById('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='modal-overlay') closeModal(); });

const now = new Date();
document.getElementById('today-label').textContent = DOW[(now.getDay()+6)%7]+' '+now.getDate()+' de '+MONTHS[now.getMonth()]+' de '+now.getFullYear();

wireAuth();
checkSession();
