import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ISODate } from './types';

const DAY_MS = 86_400_000;

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha local a medianoche (nunca UTC: 'YYYY-MM-DD' parseado por Date() sería UTC). */
export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/** Número de día absoluto (sirve para restar fechas sin problemas de horario de verano). */
export function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return dayNumber(a) - dayNumber(b);
}

/** 1 = lunes … 7 = domingo. */
export function dayOfWeek(iso: ISODate): number {
  return ((fromISO(iso).getDay() + 6) % 7) + 1;
}

export function mondayOf(iso: ISODate): ISODate {
  return addDays(iso, 1 - dayOfWeek(iso));
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function firstOfMonth(iso: ISODate): ISODate {
  return iso.slice(0, 8) + '01';
}

export function daysInMonth(iso: ISODate): number {
  const d = fromISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function isFuture(iso: ISODate): boolean {
  return iso > todayISO();
}

// ── Formato ────────────────────────────────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "25 sep" */
export function fmtDayMonth(iso: ISODate): string {
  return format(fromISO(iso), 'd MMM', { locale: es }).replace('.', '');
}

/** "25 sep 2025" (año solo si no es el actual) */
export function fmtDate(iso: ISODate): string {
  const sameYear = iso.slice(0, 4) === todayISO().slice(0, 4);
  return format(fromISO(iso), sameYear ? 'd MMM' : 'd MMM yyyy', { locale: es }).replace('.', '');
}

/** "Jueves 25 de septiembre" */
export function fmtLong(iso: ISODate): string {
  return cap(format(fromISO(iso), "EEEE d 'de' MMMM", { locale: es }));
}

/** "jue 25 sep" */
export function fmtWeekdayShort(iso: ISODate): string {
  return format(fromISO(iso), 'EEE d MMM', { locale: es }).replace(/\./g, '');
}

/** "Septiembre 2026" */
export function fmtMonth(iso: ISODate): string {
  return cap(format(fromISO(iso), 'MMMM yyyy', { locale: es }));
}

/** "sep" */
export function fmtMonthShort(iso: ISODate): string {
  return format(fromISO(iso), 'MMM', { locale: es }).replace('.', '');
}

/** "22 – 28 sep" */
export function fmtWeekRange(monday: ISODate): string {
  const sunday = addDays(monday, 6);
  if (monday.slice(0, 7) === sunday.slice(0, 7)) {
    return `${fromISO(monday).getDate()} – ${fmtDayMonth(sunday)}`;
  }
  return `${fmtDayMonth(monday)} – ${fmtDayMonth(sunday)}`;
}

/** "hoy", "ayer", "hace 3 días", o la fecha. */
export function fmtRelative(iso: ISODate): string {
  const d = diffDays(todayISO(), iso);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d > 1 && d < 7) return `hace ${d} días`;
  if (d < 0 && d === -1) return 'mañana';
  return fmtDate(iso);
}
