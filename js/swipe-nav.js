import { switchScreen, getCurrentScreen, SCREEN_ORDER } from './screens.js';
import { isJiggling } from './routines-dnd.js';

const MIN_DX = 70;
const MAX_DY_RATIO = 0.6; // el gesto tiene que ser mayormente horizontal

export function wireSwipeNav(){
  // Se cuelga de #app-root (no de document/body) a propósito: #login-screen es un hermano,
  // no un descendiente, así que un touchstart acá nunca llega a tocar la pantalla de login.
  // En iOS standalone se vio que un listener de touch en un ancestor de un <input> puede romper
  // el foco/teclado de ese input aunque el listener sea passive y no haga preventDefault — este
  // scoping evita el problema de raíz en vez de solo esquivarlo adentro del handler.
  const root = document.getElementById('app-root');
  if(!root) return;
  let startX = null, startY = null, tracking = false;

  root.addEventListener('touchstart', (e) => {
    if(e.touches.length !== 1) return;
    if(isJiggling()) return;
    if(document.querySelector('.modal-overlay:not(.hidden)')) return;
    if(e.target.closest && e.target.closest('.chart-scroll, input, textarea, select, [contenteditable="true"]')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  root.addEventListener('touchend', (e) => {
    if(!tracking) return;
    tracking = false;
    if(startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = startY = null;
    if(Math.abs(dx) < MIN_DX) return;
    if(Math.abs(dy) > Math.abs(dx) * MAX_DY_RATIO) return;

    const idx = SCREEN_ORDER.indexOf(getCurrentScreen());
    if(idx === -1) return;
    if(dx < 0 && idx < SCREEN_ORDER.length - 1) switchScreen(SCREEN_ORDER[idx+1]);
    else if(dx > 0 && idx > 0) switchScreen(SCREEN_ORDER[idx-1]);
  }, { passive: true });

  root.addEventListener('touchcancel', () => { tracking = false; startX = startY = null; }, { passive: true });
}
