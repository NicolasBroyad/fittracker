import { useSyncExternalStore } from 'react';
import type { ISODate } from '@/lib/types';

/**
 * Hojas globales que se abren desde varias pantallas (cargar peso, cargar series, ajustes...).
 * Se renderizan una sola vez en el Shell.
 */
export interface SheetsState {
  weight: { id: number; date: ISODate } | null;
  sets: {
    id: number;
    exerciseId: string;
    date: ISODate | null;
    target: { sets: number | null; reps: string | null } | null;
  } | null;
  day: { id: number; date: ISODate } | null;
  settings: boolean;
}

let seq = 0;
let state: SheetsState = { weight: null, sets: null, day: null, settings: false };
const listeners = new Set<() => void>();

function set(patch: Partial<SheetsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const sheets = {
  openWeight: (date: ISODate) => set({ weight: { id: ++seq, date } }),
  closeWeight: () => set({ weight: null }),
  openSets: (exerciseId: string, opts: { date?: ISODate; target?: { sets: number | null; reps: string | null } | null } = {}) =>
    set({ sets: { id: ++seq, exerciseId, date: opts.date ?? null, target: opts.target ?? null } }),
  closeSets: () => set({ sets: null }),
  openDay: (date: ISODate) => set({ day: { id: ++seq, date } }),
  closeDay: () => set({ day: null }),
  openSettings: () => set({ settings: true }),
  closeSettings: () => set({ settings: false }),
};

export function useSheets(): SheetsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
