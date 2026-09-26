import { useSyncExternalStore } from 'react';

export type ThemePref = 'dark' | 'light' | 'system';

const KEY = 'ft-theme';
const listeners = new Set<() => void>();
const media = matchMedia('(prefers-color-scheme: dark)');

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

let pref = readPref();

function resolved(): 'dark' | 'light' {
  return pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
}

function apply() {
  const dark = resolved() === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09090B' : '#F4F4F1');
  listeners.forEach((l) => l());
}

media.addEventListener('change', () => pref === 'system' && apply());

export function setThemePref(p: ThemePref) {
  pref = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* modo privado: queda solo en memoria */
  }
  apply();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, () => pref);
}

export function useResolvedTheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribe, resolved);
}

/** Colores reales (hex) de las variables CSS, para las librerías que no entienden var(). */
export function useCssColors<K extends string>(names: readonly K[]): Record<K, string> {
  const theme = useResolvedTheme();
  const key = theme + names.join(',');
  if (cache.key !== key) {
    const cs = getComputedStyle(document.documentElement);
    cache.key = key;
    cache.value = Object.fromEntries(names.map((n) => [n, cs.getPropertyValue('--' + n).trim()]));
  }
  return cache.value as Record<K, string>;
}

const cache: { key: string; value: Record<string, string> } = { key: '', value: {} };
