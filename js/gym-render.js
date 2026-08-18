import { routineDays, routineExercises, exercisesById, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, gymVolumeWeek } from './routines-state.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { computeGymStreak, computeMostImproved, computeAllSessionsHistory, computeWeeklyMuscleVolume, formatSessionSets } from './routines-derived.js';
import { fromISO, toISO, fmtShort, mondayOf, escapeHtml } from './utils.js';

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

function volumeRowHtml(group, sets, maxSets){
  const pct = Math.max(4, Math.round((sets/maxSets)*100));
  return `<div class="volume-row">
    <div class="volume-row-head">
      <span class="volume-label">${escapeHtml(MUSCLE_GROUP_LABELS[group] || group)}</span>
      <span class="volume-value">${sets}<span class="unit">series</span></span>
    </div>
    <div class="volume-bar-track"><div class="volume-bar-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function volumeCardHtml(logsByExercise){
  const weekStart = gymVolumeWeek;
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
  const totals = computeWeeklyMuscleVolume(toISO(weekStart), toISO(weekEnd), exercisesById, logsByExercise);
  const maxSets = Math.max(1, ...Object.values(totals));
  const rows = MUSCLE_GROUPS.filter(g => totals[g]).map(g => volumeRowHtml(g, totals[g], maxSets)).join('');
  const isCurrentWeek = toISO(weekStart) === toISO(mondayOf(new Date()));

  return `<div class="panel">
    <div class="panel-head">
      <h2>Volumen semanal</h2>
      <div class="cal-nav">
        <button id="gym-volume-prev" title="Semana anterior">‹</button>
        <div class="cal-month-label">${fmtShort(weekStart)} – ${fmtShort(weekEnd)}</div>
        <button id="gym-volume-next" title="Semana siguiente" ${isCurrentWeek ? 'disabled' : ''}>›</button>
      </div>
    </div>
    ${rows ? `<div class="volume-list">${rows}</div>` : '<div class="empty-state">Sin series registradas esta semana.</div>'}
  </div>`;
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
    + volumeCardHtml(logsByExercise)
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
