import { switchScreen, getCurrentScreen, SCREEN_ORDER } from './screens.js';
import { isJiggling } from './routines-dnd.js';

const LOCK_PX = 10; // movimiento mínimo para decidir si el gesto es horizontal o vertical
const COMMIT_RATIO = 0.3; // % del ancho de pantalla arrastrado para que la pestaña cambie
const ANIM_MS = 220;

function screenEl(name){ return document.getElementById('screen-'+name); }

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
  let el = null;
  let dir = 0;

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
      el = screenEl(getCurrentScreen());
      el.classList.add('screen-swiping');
      el.style.transition = 'none';
    }
    if(axis !== 'h') return;
    ev.preventDefault();
    el.style.transform = `translateX(${dx}px)`;
  }

  function onEnd(ev){
    teardown();
    if(axis !== 'h' || !el) return;
    const t = ev.changedTouches && ev.changedTouches[0];
    const dx = t ? t.clientX - startX : 0;
    const width = window.innerWidth;
    const commit = Math.abs(dx) > width * COMMIT_RATIO;
    const outgoing = el;

    outgoing.style.transition = `transform ${ANIM_MS}ms ease`;
    if(!commit){
      outgoing.style.transform = 'translateX(0px)';
      setTimeout(() => { outgoing.style.cssText = ''; outgoing.classList.remove('screen-swiping'); }, ANIM_MS + 30);
      return;
    }

    outgoing.style.transform = `translateX(${dir*width}px)`;
    const nextScreen = SCREEN_ORDER[SCREEN_ORDER.indexOf(getCurrentScreen()) + dir];
    setTimeout(() => {
      outgoing.style.cssText = '';
      outgoing.classList.remove('screen-swiping');
      switchScreen(nextScreen).then(() => {
        const incoming = screenEl(nextScreen);
        incoming.classList.add('screen-swiping');
        incoming.style.transition = 'none';
        incoming.style.transform = `translateX(${dir*width}px)`;
        incoming.getBoundingClientRect(); // fuerza reflow antes de animar a 0
        incoming.style.transition = `transform ${ANIM_MS}ms ease`;
        incoming.style.transform = 'translateX(0px)';
        setTimeout(() => { incoming.style.cssText = ''; incoming.classList.remove('screen-swiping'); }, ANIM_MS + 30);
      });
    }, ANIM_MS);
  }

  function teardown(){
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
  }
}
