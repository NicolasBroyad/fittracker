import type { SetInput } from './types';

const nf = new Map<string, Intl.NumberFormat>();

function formatter(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = nf.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { minimumFractionDigits: min, maximumFractionDigits: max });
    nf.set(key, f);
  }
  return f;
}

/** 78.4 → "78,4" (fijo en `decimals` decimales). */
export function fmtNum(n: number, decimals = 1): string {
  return formatter(decimals, decimals).format(n);
}

/** Como fmtNum pero sin ceros de más: 80 → "80", 82.5 → "82,5". */
export function fmtNumTrim(n: number, maxDecimals = 2): string {
  return formatter(0, maxDecimals).format(n);
}

/** "+0,4" / "−0,4" / "0,0" con signo menos tipográfico. */
export function fmtDelta(n: number, decimals = 1): string {
  const rounded = Number(n.toFixed(decimals));
  if (rounded === 0) return fmtNum(0, decimals);
  return (rounded > 0 ? '+' : '−') + fmtNum(Math.abs(rounded), decimals);
}

export function fmtPct(n: number): string {
  const r = Math.round(n);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + '%';
}

/** 12450 → "12,5 t"; 850 → "850 kg" */
export function fmtVolume(kg: number): string {
  if (kg >= 10_000) return fmtNum(kg / 1000, 1) + ' t';
  return fmtNumTrim(Math.round(kg)) + ' kg';
}

/** Acepta coma o punto decimal. Devuelve null si está vacío o no es número. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseIntSafe(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/** "4 × 8-10", "4 series", "× 12", o null si no hay objetivo. */
export function fmtTarget(sets: number | null, reps: string | null): string | null {
  const r = reps?.trim();
  if (sets && r) return `${sets} × ${r}`;
  if (sets) return `${sets} series`;
  if (r) return `× ${r}`;
  return null;
}

function weightText(w: number | null): string {
  return w && w > 0 ? `${fmtNumTrim(w)} kg` : 'PC';
}

/**
 * Resume una sesión agrupando series consecutivas con el mismo peso:
 * [85×6, 80×8, 80×7] → "85 kg × 6 · 80 kg × 8, 7". "PC" = peso corporal.
 */
export function fmtSets(sets: SetInput[]): string {
  const groups: { w: number | null; reps: (number | null)[] }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.w === s.weight) last.reps.push(s.reps);
    else groups.push({ w: s.weight, reps: [s.reps] });
  }
  return groups.map((g) => `${weightText(g.w)} × ${g.reps.map((r) => (r == null ? '–' : r)).join(', ')}`).join(' · ');
}

/** Una serie suelta: "80 kg × 8" */
export function fmtSet(s: SetInput): string {
  return `${weightText(s.weight)} × ${s.reps ?? '–'}`;
}

/** Para buscar sin importar mayúsculas ni tildes: "Bíceps" → "biceps". */
export function searchKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
