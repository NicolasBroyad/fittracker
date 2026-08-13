import { viewMonth } from './state.js';
import { MONTHS, DOW, todayISO } from './utils.js';
import { renderCalendar, renderMonthlySummary } from './render.js';
import { openModal, closeModal, saveEntry, deleteEntry, closeViewModal, editFromViewModal } from './modal.js';
import { setActiveTab, openChartModal, closeChartModal, rerenderIfOpen } from './chart-modal.js';
import { wireAuth, checkSession } from './auth.js';
import { initTheme } from './theme.js';
import { openGoalModal, closeGoalModal, submitGoal, clearGoal } from './goal.js';

initTheme();

window.addEventListener('resize', rerenderIfOpen);

document.getElementById('cal-prev').addEventListener('click', ()=>{
  viewMonth.setMonth(viewMonth.getMonth()-1);
  renderCalendar();
  renderMonthlySummary();
});
document.getElementById('cal-next').addEventListener('click', ()=>{
  viewMonth.setMonth(viewMonth.getMonth()+1);
  renderCalendar();
  renderMonthlySummary();
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
document.getElementById('btn-view-edit').addEventListener('click', editFromViewModal);
document.getElementById('view-modal-close').addEventListener('click', closeViewModal);
document.getElementById('view-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='view-modal-overlay') closeViewModal(); });
document.getElementById('btn-goal-edit').addEventListener('click', openGoalModal);
document.getElementById('goal-modal-cancel').addEventListener('click', closeGoalModal);
document.getElementById('goal-modal-save').addEventListener('click', submitGoal);
document.getElementById('btn-goal-clear').addEventListener('click', clearGoal);
document.getElementById('goal-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='goal-modal-overlay') closeGoalModal(); });

const now = new Date();
document.getElementById('today-label').textContent = DOW[(now.getDay()+6)%7]+' '+now.getDate()+' de '+MONTHS[now.getMonth()]+' de '+now.getFullYear();

wireAuth();
checkSession();
