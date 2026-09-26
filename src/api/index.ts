import { liveApi } from './live';
import type { Api } from './types';

let current: Api = liveApi;

/** Modo demo: solo en desarrollo, abriendo la app con `?demo`. Nunca llega al build de producción. */
export const isDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');

export async function initApi(): Promise<void> {
  // import.meta.env.DEV literal: así el build de producción elimina el import del demo
  if (import.meta.env.DEV && isDemo) {
    const { createDemoApi } = await import('./demo');
    current = createDemoApi();
  }
}

export function api(): Api {
  return current;
}

export { BackendError } from './types';
export type { AuthUser } from './types';
