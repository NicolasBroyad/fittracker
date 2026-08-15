import { switchScreen, getCurrentScreen, SCREEN_ORDER } from './screens.js';
import { isJiggling } from './routines-dnd.js';

const LOCK_PX = 10; // movimiento mínimo para decidir si el gesto es horizontal o vertical
const COMMIT_RATIO = 0.3; // % del ancho de pantalla arrastrado para que la pestaña cambie
const ANIM_MS = 220;

function screenEl(name){ return document.getElementById('screen-'+name); }

function preparePane(el, left, width){
  el.classList.add('screen-swiping');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = left + 'px';
  el.style.width = width + 'px';
  el.style.height = '100vh';
  el.style.overflowY = 'hidden';
  el.style.transition = 'none';
}
function resetPane(el){
  el.style.cssText = '';
  el.classList.remove('screen-swiping');
}

// Se cuelga de #app-root (no de document/body) a propósito: #login-screen es un hermano,
// no un descendiente, así que un touchstart acá nunca llega a tocar la pantalla de login.
// En iOS standalone se vio que un listener de touch en un ancestro de un <input> puede romper
// el foco/teclado de ese input — este scoping evita el problema de raíz.
export function wireSwipeNav(){
  const root = document.getElementById('app-root');
  if(!root) return;
  root.addEventListener('touchstart', onTouchStart, { passive: true });
}

function onTouchStart(e){
  if(e.touches.length !== 1) return;
  if(isJiggling()) return;
  if(document.querySelector('.modal-overlay:not(.hidden)')) return;
  if(e.target.closest && e.target.closest('.chart-scroll, input, textarea, select, [contenteditable="true"]')) return;

  const startX = e.touches[0].clientX;
  const startY = e.touches[0].clientY;
  let axis = null; // null | 'h' | 'v' | 'blocked'
  let currentEl = null, targetEl = null, dir = 0, viewportWidth = 0;

  // los listeners de move/end solo existen durante un gesto ya validado por touchstart,
  // nunca están pegados de forma permanente a document (mismo patrón que routines-dnd.js)
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });

  function onMove(ev){
    const t = ev.touches[0];
    const dx = t.clientX - startX, dy = t.clientY - startY;
    if(axis === null){
      if(Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      if(Math.abs(dy) >= Math.abs(dx)){ axis = 'v'; teardown(); return; }
      dir = dx < 0 ? 1 : -1;
      const idx = SCREEN_ORDER.indexOf(getCurrentScreen());
      if(idx + dir < 0 || idx + dir >= SCREEN_ORDER.length){ axis = 'blocked'; teardown(); return; }
      axis = 'h';
      currentEl = screenEl(getCurrentScreen());
      targetEl = screenEl(SCREEN_ORDER[idx + dir]);
      const rect = currentEl.getBoundingClientRect();
      viewportWidth = window.innerWidth;
      targetEl.classList.remove('hidden');
      preparePane(currentEl, rect.left, rect.width);
      preparePane(targetEl, rect.left, rect.width);
      currentEl.style.transform = 'translateX(0px)';
      targetEl.style.transform = `translateX(${dir*viewportWidth}px)`;
    }
    if(axis !== 'h') return;
    ev.preventDefault();
    const clamped = Math.max(Math.min(dx, viewportWidth), -viewportWidth);
    currentEl.style.transform = `translateX(${clamped}px)`;
    targetEl.style.transform = `translateX(${dir*viewportWidth + clamped}px)`;
  }

  function onEnd(ev){
    teardown();
    if(axis !== 'h' || !currentEl) return;
    const t = ev.changedTouches && ev.changedTouches[0];
    const dx = t ? t.clientX - startX : 0;
    const commit = Math.abs(dx) > viewportWidth * COMMIT_RATIO;
    const targetName = SCREEN_ORDER[SCREEN_ORDER.indexOf(getCurrentScreen()) + dir];
    const finishedCurrentEl = currentEl, finishedTargetEl = targetEl;

    finishedCurrentEl.style.transition = `transform ${ANIM_MS}ms ease`;
    finishedTargetEl.style.transition = `transform ${ANIM_MS}ms ease`;
    if(commit){
      finishedCurrentEl.style.transform = `translateX(${dir*viewportWidth}px)`;
      finishedTargetEl.style.transform = 'translateX(0px)';
    } else {
      finishedCurrentEl.style.transform = 'translateX(0px)';
      finishedTargetEl.style.transform = `translateX(${dir*viewportWidth}px)`;
    }
    setTimeout(() => {
      resetPane(finishedCurrentEl);
      resetPane(finishedTargetEl);
      if(commit) switchScreen(targetName);
      else finishedTargetEl.classList.add('hidden');
    }, ANIM_MS + 30);
  }

  function teardown(){
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
  }
}
