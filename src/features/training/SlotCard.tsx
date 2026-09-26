import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { sheets } from '@/app/sheets';
import { MUSCLE_LABEL } from '@/lib/constants';
import { fmtRelative } from '@/lib/dates';
import { fmtSets, fmtTarget } from '@/lib/format';
import {
  defaultAlternative,
  exerciseRecords,
  lastSession,
  sessionOn,
  sessionsOf,
  slotLabel,
  type Slot,
  type SlotItem,
  type TrainingIndex,
} from '@/lib/training';
import type { ISODate } from '@/lib/types';
import { cn } from '@/ui/cn';
import { SlotNumber } from './common';

/**
 * Alternativa elegida a mano en cada puesto (en memoria mientras la app está abierta). Si nunca se
 * tocó, se muestra la alternativa que se registró más recientemente.
 */
const chosen = new Map<string, number>();

export function SlotCard({
  slot,
  position,
  index,
  statusDate,
  slotKey,
}: {
  slot: Slot;
  position: number;
  index: TrainingIndex;
  /** fecha contra la que se marca "hecho" */
  statusDate: ISODate;
  /** identifica el puesto (rutina + día + orden) para recordar la alternativa elegida */
  slotKey: string;
}) {
  const count = slot.items.length;
  const [, rerender] = useState(0);
  const picked = chosen.get(slotKey);
  const alt = Math.min(picked ?? defaultAlternative(slot, index), count - 1);
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);

  const setAlt = (i: number, scroll: boolean) => {
    const v = Math.max(0, Math.min(count - 1, i));
    chosen.set(slotKey, v);
    rerender((n) => n + 1);
    if (scroll && scroller.current) scroller.current.scrollTo({ left: v * scroller.current.clientWidth, behavior: 'smooth' });
  };

  // posiciona el carrusel en la alternativa por defecto (al montar, o cuando llegan los datos
  // y cambia cuál fue la última registrada), salvo que el usuario ya haya elegido otra
  const auto = picked == null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && count > 1 && (auto || el.scrollLeft === 0)) el.scrollLeft = alt * el.clientWidth;
  }, [alt, auto, count]);

  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = scroller.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== alt) setAlt(i, false);
    }, 90);
  };

  const done = slot.items.some((it) => !!sessionOn(index, it.exercise_id, statusDate));

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] border bg-surface shadow-card transition-colors',
        done ? 'border-accent-ink/25' : 'border-line',
      )}
    >
      {count > 1 ? (
        <div
          ref={scroller}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {slot.items.map((it, i) => (
            <div key={it.exercise_id} className="w-full shrink-0 snap-center snap-always">
              <Pane item={it} label={slotLabel(position, i, count)} index={index} statusDate={statusDate} />
            </div>
          ))}
        </div>
      ) : (
        <Pane item={slot.items[0]} label={slotLabel(position, 0, 1)} index={index} statusDate={statusDate} />
      )}

      {count > 1 && (
        <div className="flex items-center justify-between border-t border-line px-2 py-1">
          <button
            onClick={() => setAlt(alt - 1, true)}
            disabled={alt === 0}
            aria-label="Alternativa anterior"
            className="flex size-8 items-center justify-center rounded-full text-muted active:bg-surface-2 disabled:opacity-25"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-muted">Alternativa {slotLabel(position, alt, count)}</span>
            <div className="flex gap-1">
              {slot.items.map((it, i) => (
                <button
                  key={it.exercise_id}
                  onClick={() => setAlt(i, true)}
                  aria-label={`Ver ${it.exercise.name}`}
                  className={cn('h-1.5 rounded-full transition-all', i === alt ? 'w-4 bg-accent-ink' : 'w-1.5 bg-surface-3')}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => setAlt(alt + 1, true)}
            disabled={alt === count - 1}
            aria-label="Alternativa siguiente"
            className="flex size-8 items-center justify-center rounded-full text-muted active:bg-surface-2 disabled:opacity-25"
          >
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

function Pane({ item, label, index, statusDate }: { item: SlotItem; label: string; index: TrainingIndex; statusDate: ISODate }) {
  const sessions = sessionsOf(index, item.exercise_id);
  const last = lastSession(index, item.exercise_id);
  const today = sessionOn(index, item.exercise_id, statusDate);
  const rec = exerciseRecords(sessions);
  const target = fmtTarget(item.sets_target, item.reps_target);

  return (
    <button
      onClick={() => sheets.openSets(item.exercise_id, { target: { sets: item.sets_target, reps: item.reps_target } })}
      className="flex w-full gap-3.5 p-4 text-left active:bg-surface-2"
    >
      <SlotNumber label={label} done={!!today} />
      <div className="min-w-0 flex-1">
        <div className="text-[16px] leading-snug font-semibold">{item.exercise.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          {target && <span className="font-semibold text-fg tnum">{target}</span>}
          {item.exercise.muscle_group && <span>{MUSCLE_LABEL[item.exercise.muscle_group]}</span>}
        </div>
        <div className="mt-2.5 space-y-1 text-[13px]">
          {today ? (
            <Line label={fmtRelative(statusDate)} accent>
              {fmtSets(today.sets)}
            </Line>
          ) : last ? (
            <Line label={fmtRelative(last.date)}>{fmtSets(last.sets)}</Line>
          ) : (
            <div className="text-faint">Sin registros todavía</div>
          )}
          {rec.best && sessions.length > 1 && (
            <Line label="Mejor">
              {fmtSets(rec.best.sets)}
              <span className="text-faint"> · {fmtRelative(rec.best.date)}</span>
            </Line>
          )}
        </div>
      </div>
    </button>
  );
}

function Line({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <span
        className={cn(
          'w-[76px] shrink-0 truncate first-letter:uppercase',
          accent ? 'font-semibold text-accent-ink' : 'text-faint',
        )}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 text-fg/90 tnum">{children}</span>
    </div>
  );
}
