import { loadRoutines } from './routines.js';
import { renderHome } from './home-render.js';
import { renderGym } from './gym-render.js';

const SCREENS = ['home', 'peso', 'rutina', 'gimnasio'];
let routinesLoaded = false;

export async function ensureRoutinesLoaded(){
  if(routinesLoaded) return;
  routinesLoaded = true;
  await loadRoutines();
}

export async function switchScreen(screen){
  SCREENS.forEach(s => {
    document.getElementById('screen-'+s).classList.toggle('hidden', s !== screen);
    document.getElementById('tab-screen-'+s).classList.toggle('active', s === screen);
  });
  document.getElementById('topbar-eyebrow').classList.toggle('hidden', screen !== 'peso');
  document.getElementById('topbar-title').classList.toggle('hidden', screen !== 'peso');
  document.getElementById('today-label').classList.toggle('hidden', screen !== 'peso');
  document.getElementById('btn-log-today').classList.toggle('hidden', screen !== 'peso');

  if(screen === 'home'){
    await ensureRoutinesLoaded();
    await renderHome();
  } else if(screen === 'rutina'){
    await ensureRoutinesLoaded();
  } else if(screen === 'gimnasio'){
    await ensureRoutinesLoaded();
    await renderGym();
  }
}
