import { viewMonth } from './state.js';
import { todayISO } from './utils.js';
import { renderCalendar, renderMonthlySummary } from './render.js';
import { openModal, closeModal, saveEntry, deleteEntry, closeViewModal, editFromViewModal } from './modal.js';
import { setActiveTab, setChartRange, openChartModal, closeChartModal, rerenderIfOpen } from './chart-modal.js';
import { wireAuth, checkSession } from './auth.js';
import { initTheme } from './theme.js';
import { openGoalModal, closeGoalModal, submitGoal, clearGoal } from './goal.js';
import { exportCSV } from './export.js';
import { wireSwipeNav, animateToScreen } from './swipe-nav.js';
import {
  wireRoutinesDelegation, updateTodayScrollHint,
  closeDayNameModal, saveDayName,
  closeExerciseModal, saveExerciseModal, deleteExerciseModal,
  closeSessionModal, saveSession, openSessionModal,
} from './routines.js';

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
document.getElementById('chart-range').addEventListener('change', (e)=>setChartRange(e.target.value));
document.getElementById('chart-range-big').addEventListener('change', (e)=>setChartRange(e.target.value));
document.getElementById('btn-chart-expand').addEventListener('click', openChartModal);
document.getElementById('chart-modal-close').addEventListener('click', closeChartModal);
document.getElementById('chart-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='chart-modal-overlay') closeChartModal(); });
document.getElementById('lcd-log-today-btn').addEventListener('click', ()=>openModal(todayISO()));
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
document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

document.getElementById('tab-screen-home').addEventListener('click', ()=>animateToScreen('home'));
document.getElementById('tab-screen-peso').addEventListener('click', ()=>animateToScreen('peso'));
document.getElementById('tab-screen-rutina').addEventListener('click', ()=>animateToScreen('rutina'));
document.getElementById('tab-screen-gimnasio').addEventListener('click', ()=>animateToScreen('gimnasio'));
wireRoutinesDelegation();
wireSwipeNav();

document.getElementById('rutina-scroll-hint').addEventListener('click', ()=>{
  const todayCard = document.querySelector('.routine-day-panel.is-today');
  if(todayCard) todayCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
let scrollHintTicking = false;
window.addEventListener('scroll', ()=>{
  if(scrollHintTicking) return;
  scrollHintTicking = true;
  requestAnimationFrame(()=>{ updateTodayScrollHint(); scrollHintTicking = false; });
}, { passive: true });

document.getElementById('home-container').addEventListener('click', (e)=>{
  if(e.target.closest('.home-log-weight-btn')){ openModal(todayISO()); return; }
  if(e.target.closest('.home-goto-rutina-btn')){ animateToScreen('rutina'); return; }
});
document.getElementById('gym-container').addEventListener('click', (e)=>{
  const row = e.target.closest('.gym-history-item');
  if(row) openSessionModal(row.dataset.exerciseId, row.dataset.date);
});
document.getElementById('day-modal-cancel').addEventListener('click', closeDayNameModal);
document.getElementById('day-modal-save').addEventListener('click', saveDayName);
document.getElementById('day-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='day-modal-overlay') closeDayNameModal(); });
document.getElementById('exercise-modal-cancel').addEventListener('click', closeExerciseModal);
document.getElementById('exercise-modal-save').addEventListener('click', saveExerciseModal);
document.getElementById('exercise-modal-delete').addEventListener('click', deleteExerciseModal);
document.getElementById('exercise-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='exercise-modal-overlay') closeExerciseModal(); });
document.getElementById('session-modal-close').addEventListener('click', closeSessionModal);
document.getElementById('session-modal-save').addEventListener('click', saveSession);
document.getElementById('session-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='session-modal-overlay') closeSessionModal(); });

wireAuth();
checkSession();
