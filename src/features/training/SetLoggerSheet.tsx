import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronRight, Plus, RotateCcw, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useExerciseMap, useReplaceSets, useRoutinesQuery, useTrainingIndex } from '@/api/hooks';
import { useSticky } from '@/app/hooks';
import { navigate } from '@/app/router';
import { sheets, useSheets } from '@/app/sheets';
import { MUSCLE_LABEL } from '@/lib/constants';
import { fmtDate, fmtRelative, todayISO } from '@/lib/dates';
import { fmtNum, fmtNumTrim, fmtSet, fmtTarget, parseDecimal, parseIntSafe } from '@/lib/format';
import {
  estimate1RM,
  exerciseRecords,
  lastKnownTarget,
  lastSessionBefore,
  makeSession,
  sessionOn,
  sessionsOf,
} from '@/lib/training';
import type { Exercise, ISODate, SetInput } from '@/lib/types';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { ConfirmButton } from '@/ui/confirm-button';
import { DateField } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';

type Target = { sets: number | null; reps: string | null } | null;

export function SetLoggerSheet() {
  const { sets } = useSheets();
  const data = useSticky(sets);
  const exById = useExerciseMap();
  const routines = useRoutinesQuery().data;
  const ex = data ? exById.get(data.exerciseId) : undefined;
  const target: Target = data?.target ?? (data ? lastKnownTarget(routines, data.exerciseId) : null);
  const targetText = target ? fmtTarget(target.sets, target.reps) : null;

  return (
    <Sheet
      open={!!sets && !!ex}
      onOpenChange={(o) => !o && sheets.closeSets()}
      bare
      title={ex?.name ?? 'Ejercicio'}
      description={
        [ex?.muscle_group ? MUSCLE_LABEL[ex.muscle_group] : null, targetText ? `Objetivo ${targetText}` : null]
          .filter(Boolean)
          .join(' · ') || 'Registrá tus series'
      }
    >
      {data && ex && <SetForm key={data.id} exercise={ex} initialDate={data.date ?? todayISO()} target={target} />}
    </Sheet>
  );
}

interface Row {
  id: number;
  w: string;
  r: string;
}

let rowSeq = 0;
const row = (w = '', r = ''): Row => ({ id: ++rowSeq, w, r });

function SetForm({ exercise, initialDate, target }: { exercise: Exercise; initialDate: ISODate; target: Target }) {
  const index = useTrainingIndex();
  const replace = useReplaceSets();
  const formRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(initialDate);

  const rowsFor = (d: ISODate): Row[] => {
    const existing = sessionOn(index, exercise.id, d);
    if (existing)
      return existing.sets.map((s) => row(s.weight != null ? fmtNumTrim(s.weight) : '', s.reps != null ? String(s.reps) : ''));
    const ref = lastSessionBefore(index, exercise.id, d);
    const n = target?.sets ?? ref?.setCount ?? 3;
    return Array.from({ length: Math.max(1, Math.min(n, 12)) }, () => row());
  };

  const [rows, setRows] = useState<Row[]>(() => rowsFor(initialDate));
  const [error, setError] = useState<string | null>(null);

  const existing = sessionOn(index, exercise.id, date);
  const ref = lastSessionBefore(index, exercise.id, date);
  const records = useMemo(
    () => exerciseRecords(sessionsOf(index, exercise.id).filter((s) => s.date !== date)),
    [index, exercise.id, date],
  );

  const placeholder = (i: number): SetInput | null => {
    if (!ref?.sets.length) return null;
    return ref.sets[Math.min(i, ref.sets.length - 1)];
  };

  const update = (id: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setError(null);
  };

  const changeDate = (d: ISODate | null) => {
    if (!d) return;
    setDate(d);
    setRows(rowsFor(d));
    setError(null);
  };

  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, row(last?.w ?? '', '')];
    });

  const repeatLast = () => {
    if (!ref) return;
    setRows(ref.sets.map((s) => row(s.weight != null ? fmtNumTrim(s.weight) : '', s.reps != null ? String(s.reps) : '')));
  };

  // Enter pasa al siguiente campo (peso → reps → peso de la serie siguiente)
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[data-set]') ?? []);
    const i = inputs.indexOf(e.currentTarget);
    if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus();
    else e.currentTarget.blur();
  };

  function save() {
    const sets: SetInput[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const reps = parseIntSafe(r.r);
      let weight = parseDecimal(r.w);
      if (r.w.trim() === '' && r.r.trim() === '') continue;
      if (reps == null || reps <= 0 || reps > 999) {
        setError(`Completá las repeticiones de la serie ${i + 1}`);
        return;
      }
      if (r.w.trim() === '') weight = placeholder(i)?.weight ?? null; // vacío = mismo peso que la vez anterior
      if (weight != null && (weight < 0 || weight > 1000)) {
        setError(`Revisá el peso de la serie ${i + 1}`);
        return;
      }
      sets.push({ weight: weight != null ? Math.round(weight * 100) / 100 : null, reps });
    }
    if (!sets.length && !existing) {
      setError('Cargá al menos una serie');
      return;
    }

    // ¿récord? se compara contra las sesiones anteriores a esta fecha
    const prior = sessionsOf(index, exercise.id).filter((s) => s.date < date);
    const now = makeSession(exercise.id, date, sets);
    const maxW = Math.max(0, ...prior.map((s) => s.topWeight ?? 0));
    const maxE = Math.max(0, ...prior.map((s) => s.e1rm ?? 0));

    replace.mutate({ exerciseId: exercise.id, date, sets });
    sheets.closeSets();

    if (!sets.length) {
      toast('Sesión borrada', { description: `${exercise.name} · ${fmtDate(date)}` });
    } else if (prior.length && (now.topWeight ?? 0) > maxW && maxW > 0) {
      toast.success('¡Nuevo récord de peso!', {
        description: `${exercise.name}: ${fmtNumTrim(now.topWeight!)} kg`,
        icon: <Trophy className="size-4 text-warn" />,
      });
    } else if (prior.length && (now.e1rm ?? 0) > maxE + 0.25 && maxE > 0) {
      toast.success('¡Mejor 1RM estimado!', {
        description: `${exercise.name}: ${fmtNum(now.e1rm!, 1)} kg`,
        icon: <Trophy className="size-4 text-warn" />,
      });
    } else {
      toast.success('Series guardadas', {
        description: `${exercise.name} · ${sets.length} ${sets.length === 1 ? 'serie' : 'series'}`,
      });
    }
  }

  return (
    <>
      <SheetBody ref={formRef} className="space-y-4 pt-2">
        <DateField value={date} onChange={changeDate} max={todayISO()} />

        {(ref || records.best) && (
          <div className="rounded-2xl bg-surface-2 p-3.5">
            {ref && (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-muted">Última vez · {fmtRelative(ref.date)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ref.sets.map((s, i) => (
                      <span key={i} className="rounded-lg bg-surface px-2 py-1 text-[13px] font-medium tnum dark:bg-surface-3">
                        {fmtSet(s)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={repeatLast}
                  className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-accent-ink active:bg-surface-3"
                >
                  <RotateCcw className="size-3.5" strokeWidth={2.5} />
                  Repetir
                </button>
              </div>
            )}
            {records.best && records.best.date !== ref?.date && (
              <div className={cn(ref && 'mt-2.5 border-t border-line pt-2.5')}>
                <div className="text-[12.5px] font-medium text-muted">
                  <Trophy className="mr-1 inline size-3.5 -translate-y-px text-warn" />
                  Mejor sesión · {fmtRelative(records.best.date)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {records.best.sets.map((s, i) => (
                    <span key={i} className="rounded-lg bg-surface px-2 py-1 text-[13px] font-medium tnum dark:bg-surface-3">
                      {fmtSet(s)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 grid grid-cols-[36px_1fr_16px_1fr_36px] items-center gap-2 px-0.5 text-[12px] font-medium text-muted">
            <span className="text-center">Serie</span>
            <span className="text-center">Peso (kg)</span>
            <span />
            <span className="text-center">Reps</span>
            <span />
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const ph = placeholder(i);
              const w = parseDecimal(r.w) ?? ph?.weight ?? null;
              const est = estimate1RM(w, parseIntSafe(r.r));
              return (
                <div key={r.id} className="grid grid-cols-[36px_1fr_16px_1fr_36px] items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-[14px] font-bold text-muted tnum">
                    {i + 1}
                  </span>
                  <input
                    data-set=""
                    value={r.w}
                    onChange={(e) => update(r.id, { w: e.target.value.replace(/[^0-9.,]/g, '') })}
                    onKeyDown={onKeyDown}
                    inputMode="decimal"
                    enterKeyHint="next"
                    placeholder={ph ? (ph.weight != null ? fmtNumTrim(ph.weight) : 'PC') : '—'}
                    aria-label={`Peso serie ${i + 1}`}
                    className="h-12 w-full min-w-0 rounded-2xl border border-line bg-surface-2 text-center font-display text-[19px] font-semibold tnum outline-none placeholder:font-medium placeholder:text-faint focus:border-accent-ink/50 focus:bg-surface"
                  />
                  <span className="text-center text-[15px] text-faint">×</span>
                  <div className="relative">
                    <input
                      data-set=""
                      value={r.r}
                      onChange={(e) => update(r.id, { r: e.target.value.replace(/[^0-9]/g, '') })}
                      onKeyDown={onKeyDown}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="next"
                      placeholder={ph?.reps != null ? String(ph.reps) : '—'}
                      aria-label={`Repeticiones serie ${i + 1}`}
                      className="h-12 w-full min-w-0 rounded-2xl border border-line bg-surface-2 text-center font-display text-[19px] font-semibold tnum outline-none placeholder:font-medium placeholder:text-faint focus:border-accent-ink/50 focus:bg-surface"
                    />
                    {est != null && r.r && (
                      <span className="pointer-events-none absolute -bottom-[7px] left-1/2 -translate-x-1/2 rounded-full bg-surface px-1.5 text-[9.5px] font-semibold whitespace-nowrap text-faint">
                        1RM {fmtNum(est, 0)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [row()]))}
                    aria-label={`Quitar serie ${i + 1}`}
                    className="flex size-9 items-center justify-center rounded-full text-faint active:bg-surface-2"
                  >
                    <X className="size-4" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" block className="mt-2 text-accent-ink" icon={<Plus className="size-[18px]" />} onClick={addRow}>
            Agregar serie
          </Button>
          {ref && <p className="px-1 text-center text-[12px] text-faint">Si dejás el peso vacío se usa el de la vez anterior.</p>}
        </div>

        {error && <p className="px-1 text-[14px] font-medium text-bad">{error}</p>}

        <button
          onClick={() => {
            sheets.closeSets();
            navigate(`/entreno/ejercicios/${exercise.id}`);
          }}
          className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-[14px] font-medium active:bg-surface-3"
        >
          Historial y progreso
          <ChevronRight className="size-4 text-faint" />
        </button>
      </SheetBody>
      <SheetFooter>
        {existing && (
          <ConfirmButton
            size="lg"
            className="px-4"
            confirmLabel="¿Borrar?"
            onConfirm={() => {
              replace.mutate({ exerciseId: exercise.id, date, sets: [] });
              sheets.closeSets();
              toast('Sesión borrada', { description: `${exercise.name} · ${fmtDate(date)}` });
            }}
          >
            Borrar
          </ConfirmButton>
        )}
        <Button size="lg" className="flex-1" onClick={save} loading={replace.isPending}>
          {existing ? 'Guardar cambios' : 'Guardar series'}
        </Button>
      </SheetFooter>
    </>
  );
}
