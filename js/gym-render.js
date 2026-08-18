import { routineDays, routineExercises, exercisesById, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, gymVolumeWeek, gymSummaryMonth } from './routines-state.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { computeGymStreak, computeAllSessionsHistory, computeWeeklyMuscleVolume, computeRecentPRs, computeGymMonthlySummary, formatSessionSets } from './routines-derived.js';
import { fromISO, toISO, fmtShort, mondayOf, MONTHS, trendArrowSvg, escapeHtml } from './utils.js';

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

function monthlySummaryCardHtml(logsByExercise){
  const month = gymSummaryMonth;
  const summary = computeGymMonthlySummary(month, logsByExercise);
  const today = new Date();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const label = MONTHS[month.getMonth()]+' '+month.getFullYear();

  let body;
  if(!summary){
    body = '<div class="empty-state">Sin series registradas este mes.</div>';
  } else {
    const dir = summary.delta > 0 ? 'up' : (summary.delta < 0 ? 'down' : 'flat');
    const cmpText = summary.hasPrevData
      ? `<span class="trend-arrow trend-${dir}">${trendArrowSvg(dir)}</span> <span class="trend-${dir}">${summary.delta>=0?'+':''}${summary.delta}</span> series vs. mes anterior (${summary.prevTotalSets})`
      : 'sin datos del mes anterior para comparar';
    body = `
      <div class="month-grid">
        <div><div class="goal-label">Sesiones</div><div class="month-val">${summary.trainedDays}<span class="month-sub">de ${summary.daysInMonth} días</span></div></div>
        <div><div class="goal-label">Series totales</div><div class="month-val">${summary.totalSets}</div></div>
        <div><div class="goal-label">Promedio por sesión</div><div class="month-val">${summary.avgPerSession.toFixed(1)}<span class="month-sub">series</span></div></div>
      </div>
      <div class="month-compare">${cmpText}</div>`;
  }

  return `<div class="panel">
    <div class="panel-head">
      <h2>Resumen mensual</h2>
      <div class="cal-nav">
        <button id="gym-summary-prev" title="Mes anterior">‹</button>
        <div class="cal-month-label">${label}</div>
        <button id="gym-summary-next" title="Mes siguiente" ${isCurrentMonth ? 'disabled' : ''}>›</button>
      </div>
    </div>
    ${body}
  </div>`;
}

function prListHtml(rows){
  if(rows.length === 0){
    return '<div class="empty-state">Todavía no hay PRs — hace falta cargar al menos dos sesiones de un ejercicio para detectar una mejora.</div>';
  }
  return rows.map(r => `<div class="pr-item gym-history-item" data-exercise-id="${r.exerciseId}" data-date="${r.date}">
    <span class="pr-badge">PR</span>
    <span class="pr-name">${escapeHtml(r.exerciseName)}</span>
    <span class="pr-detail">${Number(r.weight)}kg${r.reps ? ' × '+r.reps : ''}</span>
    <span class="pr-date">${fmtShort(fromISO(r.date))}</span>
  </div>`).join('');
}

export async function renderGym(){
  const container = document.getElementById('gym-container');
  if(!container) return;
  const logsByExercise = await loadAllLogsGroupedByExercise();
  const exercisesList = Object.values(exercisesById);
  const streak = computeGymStreak(routineDays, routineExercises, logsByExercise);
  const prs = computeRecentPRs(exercisesList, logsByExercise, 15);
  const history = computeAllSessionsHistory(exercisesList, logsByExercise);

  container.innerHTML = streakCardHtml(streak)
    + volumeCardHtml(logsByExercise)
    + monthlySummaryCardHtml(logsByExercise)
    + `<div class="panel">
        <div class="panel-head"><h2>Récords personales</h2></div>
        <div class="pr-list">${prListHtml(prs)}</div>
      </div>`
    + `<div class="panel">
        <div class="panel-head">
          <h2>Historial de entrenamientos</h2>
          <div class="sub">${history.length ? history.length+(history.length===1?' sesión':' sesiones') : ''}</div>
        </div>
        <div class="gym-history-list">${historyListHtml(history)}</div>
      </div>`;
}
