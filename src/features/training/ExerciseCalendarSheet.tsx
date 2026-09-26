import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useExerciseMap, useTrainingIndex } from '@/api/hooks';
import { useSticky } from '@/app/hooks';
import { sheets, useSheets } from '@/app/sheets';
import { DAY_LETTER } from '@/lib/constants';
import { addDays, addMonths, daysInMonth, firstOfMonth, fmtLong, fmtMonth, fromISO, mondayOf, todayISO } from '@/lib/dates';
import { fmtSet, fmtVolume } from '@/lib/format';
import { detectPRs, sessionsOf, type Session } from '@/lib/training';
import type { ISODate } from '@/lib/types';
import { Button, IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Sheet } from '@/ui/sheet';

/** Calendario de un solo ejercicio: qué días se hizo y qué series se cargaron cada vez. */
export function ExerciseCalendarSheet() {
  const { exCal } = useSheets();
  const data = useSticky(exCal);
  const ex = useExerciseMap().get(data?.exerciseId ?? '');
  return (
    <Sheet
      open={!!exCal && !!ex}
      onOpenChange={(o) => !o && sheets.closeExCal()}
      title={ex?.name ?? ''}
      description="Días en que lo hiciste"
    >
      {data && <ExerciseCalendar key={data.id} exerciseId={data.exerciseId} />}
    </Sheet>
  );
}

function ExerciseCalendar({ exerciseId }: { exerciseId: string }) {
  const index = useTrainingIndex();
  const today = todayISO();
  const sessions = sessionsOf(index, exerciseId);
  const byDate = new Map(sessions.map((s) => [s.date, s]));
  const prDates = new Set(detectPRs(sessions).map((p) => p.date));
  const last = sessions.length ? sessions[sessions.length - 1].date : null;
  const [month, setMonth] = useState(firstOfMonth(last ?? today));
  const [selected, setSelected] = useState<ISODate | null>(last && firstOfMonth(last) === month ? last : null);

  const monthEnd = addDays(month, daysInMonth(month) - 1);
  const days: ISODate[] = [];
  for (let d = mondayOf(month); d <= monthEnd || dayIndex(d) !== 0; d = addDays(d, 1)) days.push(d);
  const inMonth = sessions.filter((s) => s.date >= month && s.date <= monthEnd).reverse();
  const sel = selected ? byDate.get(selected) : undefined;

  const go = (n: number) => {
    const m = addMonths(month, n);
    setMonth(m);
    const lastInMonth = sessions.filter((s) => s.date >= m && s.date <= addDays(m, daysInMonth(m) - 1)).pop();
    setSelected(lastInMonth?.date ?? null);
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-semibold tracking-tight">{fmtMonth(month)}</h3>
        <div className="flex gap-1.5">
          <IconButton
            label="Mes anterior"
            size="sm"
            disabled={!sessions.length || month <= firstOfMonth(sessions[0].date)}
            onClick={() => go(-1)}
          >
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="Mes siguiente" size="sm" disabled={month >= firstOfMonth(today)} onClick={() => go(1)}>
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LETTER.map((l, i) => (
          <div key={i} className="pb-1 text-[11px] font-semibold text-faint">
            {l}
          </div>
        ))}
        {days.map((d) => {
          const s = byDate.get(d);
          const outside = d < month || d > monthEnd;
          return (
            <button
              key={d}
              disabled={!s}
              onClick={() => setSelected(d)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-xl text-[14px] font-semibold tnum transition-transform active:scale-95 disabled:active:scale-100',
                s ? (selected === d ? 'bg-fg text-bg' : 'bg-accent text-on-accent') : 'text-muted',
                outside && 'opacity-30',
                d > today && 'opacity-25',
                d === today && !s && 'ring-[1.5px] ring-accent-ink',
              )}
            >
              {fromISO(d).getDate()}
              {s && prDates.has(d) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warn" />}
            </button>
          );
        })}
      </div>

      {sel ? (
        <SessionDetail session={sel} isPR={prDates.has(sel.date)} />
      ) : (
        <p className="py-2 text-center text-[13.5px] text-muted">
          {inMonth.length ? 'Tocá un día marcado para ver sus series.' : 'Este mes no lo hiciste.'}
        </p>
      )}

      {inMonth.length > 1 && (
        <div>
          <div className="mb-1.5 px-1 text-[13px] font-medium text-muted">Todo el mes</div>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            {inMonth.map((s, i) => (
              <button
                key={s.date}
                onClick={() => setSelected(s.date)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3',
                  i && 'border-t border-line',
                  s.date === selected && 'bg-surface-3',
                )}
              >
                <span className="w-12 shrink-0 text-[13px] font-semibold text-accent-ink tnum">{fromISO(s.date).getDate()}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] tnum">{s.sets.map(fmtSet).join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const dayIndex = (d: ISODate) => (fromISO(d).getDay() + 6) % 7;

function SessionDetail({ session, isPR }: { session: Session; isPR: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14.5px] font-semibold">{fmtLong(session.date)}</div>
          <div className="text-[12.5px] text-muted">
            {session.setCount} {session.setCount === 1 ? 'serie' : 'series'}
            {session.volume > 0 && ` · ${fmtVolume(session.volume)}`}
            {isPR && <span className="font-semibold text-warn"> · récord</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="bg-surface dark:bg-surface-3"
          icon={<Pencil className="size-3.5" />}
          onClick={() => {
            sheets.closeExCal();
            setTimeout(() => sheets.openSets(session.exerciseId, { date: session.date }), 280);
          }}
        >
          Editar
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {session.sets.map((s, i) => (
          <span key={i} className="rounded-lg bg-surface px-2 py-1 text-[13px] font-medium tnum dark:bg-surface-3">
            {fmtSet(s)}
          </span>
        ))}
      </div>
    </div>
  );
}
