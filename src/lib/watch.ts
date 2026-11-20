import { toISO } from './dates';
import { fmtNum } from './format';
import type { ISODate, WatchActivity, WatchDay } from './types';

// Lo que mide el reloj Garmin (lo sube la app del reloj, repo fittracker-garmin). Lógica pura.

/** Deporte de Garmin (FIT) → nombre. Connect IQ solo da el deporte, no el subdeporte. */
const SPORT_LABEL: Record<number, string> = {
  1: 'Carrera',
  2: 'Ciclismo',
  4: 'Cardio en máquina',
  5: 'Natación',
  10: 'Entrenamiento',
  11: 'Caminata',
  15: 'Remo',
  17: 'Senderismo',
  21: 'E-bike',
  62: 'HIIT',
};

export function sportLabel(sport: number | null): string {
  return (sport != null && SPORT_LABEL[sport]) || 'Actividad';
}

/** 1 carrera, 2 ciclismo, 5 natación, 11 caminata… (para elegir el ícono) */
export type SportKind = 'run' | 'bike' | 'swim' | 'walk' | 'strength' | 'other';

export function sportKind(sport: number | null): SportKind {
  switch (sport) {
    case 1:
      return 'run';
    case 2:
    case 21:
      return 'bike';
    case 5:
      return 'swim';
    case 11:
    case 17:
      return 'walk';
    case 10:
      return 'strength';
    default:
      return 'other';
  }
}

/** 2700 → "45 min"; 3900 → "1 h 05 min" */
export function fmtDuration(s: number | null): string {
  if (s == null) return '';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** 5230 → "5,2 km"; 800 → "800 m" (0 o null → "") */
export function fmtDistance(m: number | null): string {
  if (!m) return '';
  return m >= 1000 ? `${fmtNum(m / 1000, m >= 10000 ? 1 : 2).replace(/,?0+$/, '')} km` : `${m} m`;
}

/** Ritmo de carrera/caminata: "5:30 /km" (solo con distancia y duración) */
export function fmtPace(a: WatchActivity): string | null {
  if (!a.distance_m || !a.duration_s || a.distance_m < 500) return null;
  const s = Math.round(a.duration_s / (a.distance_m / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

/** Fecha local de una actividad */
export function activityDate(a: WatchActivity): ISODate {
  return toISO(new Date(a.start_time));
}

/** "07:10" */
export function activityTime(a: WatchActivity): string {
  const d = new Date(a.start_time);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Días [desde, hasta] con lo que haya subido el reloj (null si ese día no hay dato). */
export function dayWindow(days: WatchDay[], from: ISODate, to: ISODate): { date: ISODate; day: WatchDay | null }[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: { date: ISODate; day: WatchDay | null }[] = [];
  const cur = new Date(from + 'T12:00:00');
  while (toISO(cur) <= to) {
    const iso = toISO(cur);
    out.push({ date: iso, day: byDate.get(iso) ?? null });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Promedio de pasos de los días con dato (sin contar hoy, que todavía no terminó). */
export function avgSteps(window: { date: ISODate; day: WatchDay | null }[], today: ISODate): number | null {
  const vals = window.filter((w) => w.date !== today && w.day?.steps != null).map((w) => w.day!.steps!);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
