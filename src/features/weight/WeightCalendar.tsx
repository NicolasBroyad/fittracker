import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { sheets } from '@/app/sheets';
import { DAY_LETTER } from '@/lib/constants';
import { addDays, addMonths, daysInMonth, firstOfMonth, fmtMonth, fromISO, mondayOf, todayISO } from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import type { WeightEntry } from '@/lib/types';
import { cn } from '@/ui/cn';
import { Delta } from '@/ui/display';
import { IconButton } from '@/ui/button';

/**
 * Calendario mensual con el peso de cada día y, en la última columna, el promedio de cada semana
 * (lunes a domingo, completa aunque parte caiga en el mes vecino).
 */
export function WeightCalendar({ entries, goodDirection }: { entries: WeightEntry[]; goodDirection: 1 | -1 | 0 }) {
  const today = todayISO();
  const [month, setMonth] = useState(firstOfMonth(today));
  const [dir, setDir] = useState(0);

  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const monthEnd = addDays(month, daysInMonth(month) - 1);

  const weeks = useMemo(() => {
    const out: { monday: string; days: string[]; avg: number | null }[] = [];
    for (let m = mondayOf(month); m <= monthEnd; m = addDays(m, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
      const ws = days.map((d) => byDate.get(d)?.weight).filter((w): w is number => w != null);
      out.push({ monday: m, days, avg: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null });
    }
    return out;
  }, [month, monthEnd, byDate]);

  const summary = useMemo(() => {
    const inMonth = entries.filter((e) => e.date >= month && e.date <= monthEnd);
    if (!inMonth.length) return null;
    const ws = inMonth.map((e) => e.weight);
    const elapsed = monthEnd < today ? daysInMonth(month) : Math.max(1, fromISO(today).getDate());
    return {
      avg: ws.reduce((a, b) => a + b, 0) / ws.length,
      change: inMonth.length > 1 ? ws[ws.length - 1] - ws[0] : null,
      min: Math.min(...ws),
      max: Math.max(...ws),
      count: inMonth.length,
      elapsed,
    };
  }, [entries, month, monthEnd, today]);

  const go = (n: number) => {
    setDir(n);
    setMonth((m) => addMonths(m, n));
  };
  const isCurrent = month === firstOfMonth(today);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[17px] font-semibold tracking-tight">{fmtMonth(month)}</h3>
          {!isCurrent && (
            <button
              onClick={() => {
                setDir(month < today ? 1 : -1);
                setMonth(firstOfMonth(today));
              }}
              className="text-[13px] font-semibold text-accent-ink"
            >
              Hoy
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <IconButton label="Mes anterior" size="sm" onClick={() => go(-1)}>
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="Mes siguiente" size="sm" onClick={() => go(1)} disabled={isCurrent}>
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.15fr)] gap-1 text-center">
        {DAY_LETTER.map((l) => (
          <div key={l} className="pb-1 text-[11px] font-semibold text-faint">
            {l}
          </div>
        ))}
        <div className="pb-1 text-[11px] font-semibold text-accent-ink">Prom.</div>
      </div>

      <motion.div
        key={month}
        initial={{ opacity: 0, x: dir * 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.15fr)] gap-1"
      >
        {weeks.map((w, wi) => {
          const prev = wi > 0 ? weeks[wi - 1].avg : null;
          return [
            ...w.days.map((d) => {
              const e = byDate.get(d);
              const outside = d < month || d > monthEnd;
              const future = d > today;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => sheets.openWeight(d)}
                  className={cn(
                    'relative flex aspect-[0.86] flex-col items-center justify-center rounded-xl text-center transition-transform active:scale-95 disabled:active:scale-100',
                    e ? 'bg-surface-2' : 'bg-transparent',
                    outside && 'opacity-35',
                    future && 'opacity-25',
                    isToday && 'ring-[1.5px] ring-accent-ink',
                  )}
                >
                  <span className={cn('text-[10.5px] leading-none', isToday ? 'font-bold text-accent-ink' : 'text-muted')}>
                    {fromISO(d).getDate()}
                  </span>
                  <span className={cn('mt-1 text-[12.5px] leading-none font-semibold tnum', !e && 'text-transparent')}>
                    {e ? fmtNum(e.weight, 1) : '·'}
                  </span>
                  {e?.note && <span className="absolute top-1.5 right-1.5 size-1 rounded-full bg-accent-ink" />}
                </button>
              );
            }),
            <div
              key={w.monday + '-avg'}
              className={cn(
                'flex aspect-[0.95] flex-col items-center justify-center rounded-xl text-center',
                w.monday <= today && 'bg-accent-soft',
              )}
            >
              <span className="text-[13px] leading-none font-bold text-accent-ink tnum">
                {w.avg != null ? fmtNum(w.avg, 1) : w.monday <= today ? '–' : ''}
              </span>
              {w.avg != null && prev != null && (
                <Delta value={w.avg - prev} goodDirection={goodDirection} className="mt-1 text-[10px]" />
              )}
            </div>,
          ];
        })}
      </motion.div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
        <MiniStat label="Promedio" value={summary ? fmtNum(summary.avg, 1) : '–'} />
        <MiniStat
          label="Cambio"
          value={summary?.change != null ? <Delta value={summary.change} goodDirection={goodDirection} /> : '–'}
        />
        <MiniStat label="Registros" value={summary ? `${summary.count}/${summary.elapsed}` : '–'} />
      </div>
      {summary && (
        <div className="mt-2 text-center text-[12px] text-muted tnum">
          Mín. {fmtNum(summary.min, 1)} · Máx. {fmtNum(summary.max, 1)} kg
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tnum">{value}</div>
    </div>
  );
}
