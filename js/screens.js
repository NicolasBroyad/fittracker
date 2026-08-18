import { loadRoutines, updateTodayScrollHint } from './routines.js';
import { renderHome } from './home-render.js';
import { renderGym } from './gym-render.js';
import { rerenderIfOpen } from './chart-modal.js';

export const SCREEN_ORDER = ['home', 'peso', 'rutina', 'gimnasio'];
let routinesLoaded = false;
let currentScreen = 'home';

export function getCurrentScreen(){
  return currentScreen;
}

export async function ensureRoutinesLoaded(){
  if(routinesLoaded) return;
  routinesLoaded = true;
  await loadRoutines();
}

export async function switchScreen(screen){
  currentScreen = screen;
  SCREEN_ORDER.forEach(s => {
    document.getElementById('screen-'+s).classList.toggle('hidden', s !== screen);
    document.getElementById('tab-screen-'+s).classList.toggle('active', s === screen);
  });
  if(screen === 'peso'){
    // el primer renderChart() de la carga inicial pasa con esta pantalla todavía oculta
    // (Home es la pantalla por defecto), así que mide ancho 0 — al mostrar Peso por primera
    // vez conviene re-dibujar con una medición real en vez de esperar a la próxima interacción
    rerenderIfOpen();
  } else if(screen === 'home'){
    await ensureRoutinesLoaded();
    await renderHome();
  } else if(screen === 'rutina'){
    await ensureRoutinesLoaded();
  } else if(screen === 'gimnasio'){
    await ensureRoutinesLoaded();
    await renderGym();
  }
  updateTodayScrollHint();
}
