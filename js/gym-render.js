import { routineDays, routineExercises, exercisesById, MUSCLE_GROUP_LABELS } from './routines-state.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { computeGymStreak, computeMostImproved, computeAllSessionsHistory, formatSessionSets } from './routines-derived.js';
import { fromISO, fmtShort, escapeHtml } from './utils.js';

function streakCardHtml(count){
  let ticks = '';
  for(let i=0; i<14; i++) ticks += '<span'+(i<Math.min(count,14) ? ' class="on"' : '')+'></span>';
  return `<div class="card card-streak gym-streak-card">
    <div class="label">Racha de entrenamiento</div>
    <div class="value">${count}<span class="unit">días</span></div>
    <div class="sub">Los días de descanso cuentan igual — se corta solo si faltás un día de entreno</div>
    <div class="streak-ticks">${ticks}</div>
  </div>`;
}

function improvedListHtml(items){
  if(items.length === 0){
    return '<div class="empty-state">Todavía no hay suficientes datos para calcular mejoras.</div>';
  }
  return items.map(it => `<div class="improved-item">
    <div class="improved-main">
      <span class="improved-name">${escapeHtml(it.exerciseName)}</span>
      ${it.muscleGroup ? `<span class="improved-day">${escapeHtml(MUSCLE_GROUP_LABELS[it.muscleGroup] || it.muscleGroup)}</span>` : ''}
    </div>
    <div class="improved-detail">
      <span>${it.firstWeight}kg</span>
      <span class="improved-arrow">→</span>
      <span>${it.bestWeight}kg</span>
      <span class="improved-delta">+${it.delta}kg</span>
    </div>
  </div>`).join('');
}

function historyListHtml(rows){
  if(rows.length === 0){
    return '<div class="empty-state">Todavía no hay sesiones registradas.</div>';
  }
  return rows.map(r => `<div class="record-item gym-history-item" data-exercise-id="${r.exerciseId}" data-date="${r.date}">
    <span class="rd">${fmtShort(fromISO(r.date))}</span>
    <span class="rw">${escapeHtml(r.exerciseName)}</span>
    <span class="rt">${escapeHtml(formatSessionSets(r.sets))}</span>
  </div>`).join('');
}

export async function renderGym(){
  const container = document.getElementById('gym-container');
  if(!container) return;
  const logsByExercise = await loadAllLogsGroupedByExercise();
  const exercisesList = Object.values(exercisesById);
  const streak = computeGymStreak(routineDays, routineExercises, logsByExercise);
  const improved = computeMostImproved(exercisesList, logsByExercise, 5);
  const history = computeAllSessionsHistory(exercisesList, logsByExercise);

  container.innerHTML = streakCardHtml(streak)
    + `<div class="panel">
        <div class="panel-head"><h2>Ejercicios que más mejoraron</h2></div>
        <div class="improved-list">${improvedListHtml(improved)}</div>
      </div>`
    + `<div class="panel">
        <div class="panel-head">
          <h2>Historial de entrenamientos</h2>
          <div class="sub">${history.length ? history.length+(history.length===1?' sesión':' sesiones') : ''}</div>
        </div>
        <div class="gym-history-list">${historyListHtml(history)}</div>
      </div>`;
}
