import { onlineManager } from '@tanstack/react-query';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './live';
import { BackendError } from './types';
import { isDemo } from './index';

/**
 * Conectividad real. `navigator.onLine` dice "online" aunque en el gimnasio no haya señal, así que
 * cuando un pedido falla por red se marca la app como offline (TanStack Query pausa consultas y
 * guardados) y se sondea el servidor cada tanto hasta que vuelva a responder.
 */

let timer: number | null = null;

export function isNetworkError(e: unknown): boolean {
  return (e instanceof BackendError && e.network) || (e instanceof TypeError && /fetch|load failed|network/i.test(e.message));
}

async function reachable(): Promise<boolean> {
  if (isDemo) return localStorage.getItem('demo-offline') !== '1';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function check() {
  if (await reachable()) {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
    onlineManager.setOnline(true);
  }
}

export function reportNetworkFailure() {
  onlineManager.setOnline(false);
  if (timer == null) timer = window.setInterval(check, 10_000);
}

{
  window.addEventListener('online', () => void check());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !onlineManager.isOnline()) void check();
  });
}

/** Texto para los avisos de guardado cuando no hay conexión (null si hay). */
export function offlineNote(): string | null {
  return onlineManager.isOnline() ? null : 'Sin conexión: quedó guardado en el celu y se sube solo cuando vuelva la señal';
}
