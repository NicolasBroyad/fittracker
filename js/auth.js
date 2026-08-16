import { sb } from './config.js';
import { loadEntries } from './storage.js';
import { renderAll } from './render.js';
import { switchScreen } from './screens.js';

export async function startApp(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  await loadEntries();
  renderAll();
  await switchScreen('home');
}
export function showLogin(){
  document.getElementById('app-root').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('rutina-scroll-hint').classList.add('hidden');
}

export function wireAuth(){
  document.getElementById('login-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    errorEl.textContent = '';
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if(error){
      errorEl.textContent = 'Email o contraseña incorrectos';
      return;
    }
    await startApp();
  });

  document.getElementById('btn-logout').addEventListener('click', async ()=>{
    await sb.auth.signOut();
    showLogin();
  });
}

export async function checkSession(){
  const { data: { session } } = await sb.auth.getSession();
  if(session){
    await startApp();
  } else {
    showLogin();
  }
}
