const STORAGE_KEY = 'broyi_peso_theme';

function isDarkActive(){
  const current = document.documentElement.getAttribute('data-theme');
  if(current === 'dark') return true;
  if(current === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateIcon(){
  const btn = document.getElementById('btn-theme-toggle');
  if(!btn) return;
  const dark = isDarkActive();
  btn.textContent = dark ? '☀️' : '🌙';
  btn.title = dark ? 'Modo claro' : 'Modo oscuro';
}

export function initTheme(){
  updateIcon();
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
}

export function toggleTheme(){
  const next = isDarkActive() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem(STORAGE_KEY, next); }catch(e){}
  updateIcon();
}
