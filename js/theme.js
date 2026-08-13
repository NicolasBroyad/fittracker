const STORAGE_KEY = 'broyi_peso_theme';

const ICON_SUN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const ICON_MOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

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
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
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
