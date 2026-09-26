import { useSyncExternalStore } from 'react';

/**
 * Router mínimo sobre la History API. Además del path, sabe si la navegación fue hacia adelante
 * (+1), hacia atrás (−1) o un reemplazo (0) para animar en la dirección correcta y restaurar el
 * scroll al volver.
 */
export interface Loc {
  pathname: string;
  search: string;
  idx: number;
  dir: 1 | -1 | 0;
  /** scroll a restaurar (solo al volver atrás) */
  restoreY: number | null;
}

const listeners = new Set<() => void>();
const scrollByKey = new Map<string, number>();

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (typeof history.state?.idx !== 'number') history.replaceState({ idx: 0 }, '');

let loc: Loc = { pathname: location.pathname, search: location.search, idx: history.state.idx, dir: 0, restoreY: null };

const keyOf = (l: Pick<Loc, 'idx' | 'pathname'>) => `${l.idx}:${l.pathname}`;

function emit() {
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', (e) => {
  scrollByKey.set(keyOf(loc), window.scrollY);
  const idx = typeof e.state?.idx === 'number' ? e.state.idx : 0;
  const dir = idx < loc.idx ? -1 : 1;
  const next = { pathname: location.pathname, search: location.search, idx };
  loc = { ...next, dir, restoreY: dir === -1 ? (scrollByKey.get(keyOf(next)) ?? 0) : null };
  emit();
});

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = new URL(to, location.origin);
  if (url.pathname === loc.pathname && url.search === loc.search) return;
  scrollByKey.set(keyOf(loc), window.scrollY);
  const idx = opts.replace ? loc.idx : loc.idx + 1;
  history[opts.replace ? 'replaceState' : 'pushState']({ idx }, '', url.pathname + url.search);
  loc = { pathname: url.pathname, search: url.search, idx, dir: opts.replace ? 0 : 1, restoreY: null };
  emit();
}

/** Vuelve atrás si hay historial propio de la app; si no (entrada directa por URL), va a `fallback`. */
export function goBack(fallback: string) {
  if (loc.idx > 0) history.back();
  else {
    navigate(fallback, { replace: true });
    loc = { ...loc, dir: -1 };
    emit();
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocation(): Loc {
  return useSyncExternalStore(subscribe, () => loc);
}

export function useSearchParam(name: string): string | null {
  const l = useLocation();
  return new URLSearchParams(l.search).get(name);
}

/** "/entreno/ejercicios/:id" contra "/entreno/ejercicios/abc" → { id: "abc" } */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = pathname.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
