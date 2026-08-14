import { entries } from './state.js';
import { computeCurrent, computeStreak } from './derived.js';
import { routineDays, routineExercises, DAY_NAMES } from './routines-state.js';
import { loadAllLogsGroupedByExercise } from './routines-storage.js';
import { getTodayStatus, computeGymStreak } from './routines-derived.js';
import { todayISO, fromISO, MONTHS, escapeHtml } from './utils.js';

const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

function heroHtml(status){
  const today = new Date();
  const dateLabel = DAY_NAMES[status.dayOfWeek-1]+' '+today.getDate()+' de '+MONTHS[today.getMonth()];
  let title, sub;
  if(status.isRest){
    title = 'Descanso';
    sub = 'Hoy no toca entrenar';
  } else if(!status.hasPlan){
    title = 'Sin rutina para hoy';
    sub = 'Todavía no cargaste ejercicios para este día';
  } else {
    title = status.dayName ? escapeHtml(status.dayName) : 'Entrenamiento';
    sub = status.totalExercises+(status.totalExercises===1 ? ' ejercicio' : ' ejercicios');
  }
  return `<div class="home-hero">
    <div class="home-hero-eyebrow">Hoy · ${dateLabel}</div>
    <div class="home-hero-title">${title}</div>
    <div class="home-hero-sub">${sub}</div>
  </div>`;
}

function weightModuleHtml(){
  const cur = computeCurrent();
  const loggedToday = cur && cur.date === todayISO();
  if(loggedToday){
    return `<div class="home-module home-module-done home-log-weight-btn">
      <div class="home-module-label">Peso</div>
      <div class="completion-badge">${CHECK_SVG}<span>Peso de hoy registrado</span></div>
      <div class="home-module-value">${cur.weight.toFixed(2)} <span class="unit">kg</span></div>
    </div>`;
  }
  return `<div class="home-module home-module-pending home-log-weight-btn">
    <div class="home-module-label">Peso</div>
    <div class="home-module-value">${cur ? cur.weight.toFixed(2)+' <span class="unit">kg</span>' : '—'}</div>
    <div class="home-module-cta"><span class="btn btn-save home-module-btn">＋ Cargar peso de hoy</span></div>
  </div>`;
}

function trainingModuleHtml(status){
  if(status.isRest){
    return `<div class="home-module home-module-rest">
      <div class="home-module-label">Entrenamiento</div>
      <div class="home-module-msg">Hoy es día de descanso.</div>
    </div>`;
  }
  if(!status.hasPlan){
    return `<div class="home-module home-module-pending">
      <div class="home-module-label">Entrenamiento</div>
      <div class="home-module-msg">No hay ejercicios cargados para hoy.</div>
      <div class="home-module-cta"><span class="btn btn-cancel home-goto-rutina-btn">Ir a mi rutina</span></div>
    </div>`;
  }
  if(status.isFullyLogged){
    return `<div class="home-module home-module-done home-goto-rutina-btn">
      <div class="home-module-label">Entrenamiento</div>
      <div class="completion-badge">${CHECK_SVG}<span>Entrenamiento de hoy completo</span></div>
      <div class="home-module-value">${status.loggedCount}/${status.totalExercises} ejercicios</div>
    </div>`;
  }
  return `<div class="home-module home-module-pending home-goto-rutina-btn">
    <div class="home-module-label">Entrenamiento</div>
    <div class="home-module-value">${status.loggedCount}/${status.totalExercises} <span class="unit">ejercicios</span></div>
    <div class="home-module-cta"><span class="btn btn-save home-module-btn">${status.isAnyLogged ? 'Seguir cargando' : 'Registrar entrenamiento'}</span></div>
  </div>`;
}

function streaksRowHtml(weightStreak, gymStreak){
  return `<div class="home-streaks-row">
    <div class="home-streak-chip">
      <span class="home-streak-value">${weightStreak.count}</span>
      <span class="home-streak-label">días seguidos con peso</span>
    </div>
    <div class="home-streak-chip">
      <span class="home-streak-value">${gymStreak}</span>
      <span class="home-streak-label">días seguidos cumpliendo rutina</span>
    </div>
  </div>`;
}

export async function renderHome(){
  const container = document.getElementById('home-container');
  if(!container) return;
  const logsByExercise = await loadAllLogsGroupedByExercise();
  const status = getTodayStatus(routineDays, routineExercises, logsByExercise);
  const weightStreak = computeStreak();
  const gymStreak = computeGymStreak(routineDays, routineExercises, logsByExercise);

  container.innerHTML = heroHtml(status)
    + `<div class="home-modules">${weightModuleHtml()}${trainingModuleHtml(status)}</div>`
    + streaksRowHtml(weightStreak, gymStreak);
}
