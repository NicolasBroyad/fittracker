import { viewMonth } from './state.js';
import { todayISO } from './utils.js';
import { renderCalendar, renderMonthlySummary } from './render.js';
import { openModal, closeModal, saveEntry, deleteEntry, closeViewModal, editFromViewModal } from './modal.js';
import { setActiveTab, setChartRange, openChartModal, closeChartModal, rerenderIfOpen, toggleShowPhases, toggleShowGoalLine } from './chart-modal.js';
import { invalidateChartWidthCache } from './chart.js';
import { wireAuth, checkSession } from './auth.js';
import { initTheme } from './theme.js';
import { openGoalModal, closeGoalModal, submitGoal, clearGoal } from './goal.js';
import { openPhaseModal, closePhaseModal, submitPhase, finishCurrentPhase, deletePhaseEntry } from './phases.js';
import { exportCSV } from './export.js';
import { wireSwipeNav, animateToScreen } from './swipe-nav.js';
import {
  wireRoutinesDelegation, updateTodayScrollHint,
  closeDayNameModal, saveDayName,
  closeExerciseModal, saveExerciseModal, deleteExerciseModal,
  closeSessionModal, saveSession, openSessionModal,
  closeAssignModal, renderAssignList, createFromAssignModal,
  closeDayTargetModal, saveDayTargetModal,
} from './routines.js';

initTheme();

window.addEventListener('resize', ()=>{ invalidateChartWidthCache(); rerenderIfOpen(); });

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
document.getElementById('chart-toggle-phases').addEventListener('click', toggleShowPhases);
document.getElementById('chart-toggle-phases-big').addEventListener('click', toggleShowPhases);
document.getElementById('chart-toggle-goal').addEventListener('click', toggleShowGoalLine);
document.getElementById('chart-toggle-goal-big').addEventListener('click', toggleShowGoalLine);
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
document.getElementById('btn-phase-add').addEventListener('click', openPhaseModal);
document.getElementById('phase-modal-cancel').addEventListener('click', closePhaseModal);
document.getElementById('phase-modal-save').addEventListener('click', submitPhase);
document.getElementById('phase-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='phase-modal-overlay') closePhaseModal(); });
document.getElementById('goal-panel').addEventListener('click', (e)=>{
  if(e.target.closest('#btn-finish-phase')){ finishCurrentPhase(); return; }
  const removeBtn = e.target.closest('.phase-history-remove');
  if(removeBtn) deletePhaseEntry(removeBtn.dataset.id);
});
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
document.getElementById('day-target-modal-cancel').addEventListener('click', closeDayTargetModal);
document.getElementById('day-target-modal-save').addEventListener('click', saveDayTargetModal);
document.getElementById('day-target-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='day-target-modal-overlay') closeDayTargetModal(); });
document.getElementById('session-modal-close').addEventListener('click', closeSessionModal);
document.getElementById('session-modal-save').addEventListener('click', saveSession);
document.getElementById('session-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='session-modal-overlay') closeSessionModal(); });
document.getElementById('assign-modal-cancel').addEventListener('click', closeAssignModal);
document.getElementById('assign-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='assign-modal-overlay') closeAssignModal(); });
document.getElementById('assign-search-input').addEventListener('input', (e)=>renderAssignList(e.target.value));
document.getElementById('assign-modal-create').addEventListener('click', createFromAssignModal);

wireAuth();
checkSession();
