import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronRight, Plus, RotateCcw, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { offlineNote } from '@/api/connectivity';
import { useExerciseMap, useReplaceSets, useRoutinesQuery, useSetOptionsSupport, useTrainingIndex } from '@/api/hooks';
import { needsSetOptions } from '@/api/types';
import { useSticky } from '@/app/hooks';
import { navigate } from '@/app/router';
import { sheets, useSheets } from '@/app/sheets';
import { MUSCLE_LABEL } from '@/lib/constants';
import { fmtDate, fmtRelative, todayISO } from '@/lib/dates';
import { fmtNum, fmtNumTrim, fmtSet, fmtTarget, fmtWeight, parseDecimal, parseIntSafe, UNIT_SHORT } from '@/lib/format';
import {
  estimate1RM,
  exerciseRecords,
  lastKnownTarget,
  lastSessionBefore,
  makeSession,
  newRecord,
  sessionOn,
  sessionsOf,
} from '@/lib/training';
import type { Exercise, ISODate, SetInput, WeightUnit } from '@/lib/types';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { ConfirmButton } from '@/ui/confirm-button';
import { Segmented } from '@/ui/controls';
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
  /** reps (o reps del lado izquierdo, por lado) */
  r: string;
  /** reps del lado derecho; vacío = igual que la izquierda */
  rr: string;
}

let rowSeq = 0;
const row = (w = '', r = '', rr = ''): Row => ({ id: ++rowSeq, w, r, rr });
const rowOf = (s: SetInput) =>
  row(
    s.weight != null ? fmtNumTrim(s.weight) : '',
    s.reps != null ? String(s.reps) : '',
    s.reps_right != null ? String(s.reps_right) : '',
  );

const UNIT_LABEL: Record<WeightUnit, string> = { kg: 'kilos', ladrillos: 'ladrillos' };

const inputClass =
  'h-12 w-full min-w-0 rounded-2xl border border-line bg-surface-2 text-center font-display text-[19px] font-semibold tnum outline-none placeholder:font-medium placeholder:text-faint focus:border-accent-ink/50 focus:bg-surface';
const badgeClass =
  'pointer-events-none absolute -bottom-[7px] left-1/2 -translate-x-1/2 rounded-full bg-surface px-1.5 text-[9.5px] font-semibold whitespace-nowrap';

function SetForm({ exercise, initialDate, target }: { exercise: Exercise; initialDate: ISODate; target: Target }) {
  const index = useTrainingIndex();
  const replace = useReplaceSets();
  const supported = useSetOptionsSupport();
  const formRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(initialDate);

  // unidad y modo arrancan como la sesión de ese día o, si no hay, como la vez anterior
  const stateFor = (d: ISODate) => {
    const existing = sessionOn(index, exercise.id, d);
    const ref = lastSessionBefore(index, exercise.id, d);
    const base = existing ?? ref;
    const n = target?.sets ?? ref?.setCount ?? 3;
    return {
      rows: existing ? existing.sets.map(rowOf) : Array.from({ length: Math.max(1, Math.min(n, 12)) }, () => row()),
      unit: base?.unit ?? ('kg' as WeightUnit),
      sided: base?.unilateral ?? false,
    };
  };

  const [initial] = useState(() => stateFor(initialDate));
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [sided, setSided] = useState(initial.sided);
  const [error, setError] = useState<string | null>(null);

  const existing = sessionOn(index, exercise.id, date);
  const ref = lastSessionBefore(index, exercise.id, date);
  // el peso de la vez anterior solo sirve de referencia si fue en la misma unidad
  const refSameUnit = ref?.unit === unit;
  const refOtherUnitWeight = !!ref && !refSameUnit && (ref.topWeight ?? 0) > 0;
  const records = useMemo(
    () =>
      exerciseRecords(
        sessionsOf(index, exercise.id).filter((s) => s.date !== date),
        unit,
      ),
    [index, exercise.id, date, unit],
  );
  const needsMigration = supported === false && (unit === 'ladrillos' || sided);

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
    const next = stateFor(d);
    setDate(d);
    setRows(next.rows);
    setUnit(next.unit);
    setSided(next.sided);
    setError(null);
  };

  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, row(last?.w ?? '', '')];
    });

  const repeatLast = () => {
    if (!ref) return;
    setRows(ref.sets.map(rowOf));
    setUnit(ref.unit);
    setSided(ref.unilateral);
    setError(null);
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
      const n = i + 1;
      const reps = parseIntSafe(r.r);
      const repsRight = sided ? parseIntSafe(r.rr) : null;
      let weight = parseDecimal(r.w);
      if (r.w.trim() === '' && r.r.trim() === '' && (!sided || r.rr.trim() === '')) continue;
      if (reps == null || reps <= 0 || reps > 999) {
        setError(sided ? `Completá las reps del lado izquierdo de la serie ${n}` : `Completá las repeticiones de la serie ${n}`);
        return;
      }
      if (repsRight != null && repsRight > 999) {
        setError(`Revisá las reps del lado derecho de la serie ${n}`);
        return;
      }
      if (r.w.trim() === '') {
        // vacío = mismo peso que la vez anterior, pero solo si fue en la misma unidad
        const ph = placeholder(i);
        if (!refSameUnit && (ph?.weight ?? 0) > 0) {
          setError(`Completá el peso de la serie ${n}: la vez anterior fue en ${UNIT_LABEL[ref!.unit]}`);
          return;
        }
        weight = refSameUnit ? (ph?.weight ?? null) : null;
      }
      if (weight != null && (weight < 0 || weight > (unit === 'kg' ? 1000 : 200))) {
        setError(`Revisá el peso de la serie ${n}`);
        return;
      }
      if (weight != null && unit === 'ladrillos' && !Number.isInteger(weight * 2)) {
        setError(`Los ladrillos van enteros o de a medio (ej. 7,5): revisá la serie ${n}`);
        return;
      }
      sets.push({
        weight: weight != null ? Math.round(weight * 100) / 100 : null,
        reps,
        weight_unit: unit,
        // por lado: si la derecha queda vacía, se guarda igual que la izquierda
        reps_right: sided ? (repsRight ?? reps) : null,
      });
    }
    if (!sets.length && !existing) {
      setError('Cargá al menos una serie');
      return;
    }
    if (supported === false && needsSetOptions(sets)) {
      setError(
        'Para guardar en ladrillos o por lado falta aplicar la migración en Supabase. Mientras tanto podés guardarlo en kilos y ambos lados.',
      );
      return;
    }

    // ¿récord? contra las sesiones anteriores a esta fecha en la misma unidad
    const pr = sets.length ? newRecord(sessionsOf(index, exercise.id), makeSession(exercise.id, date, sets)) : null;

    replace.mutate({ exerciseId: exercise.id, date, sets });
    sheets.closeSets();

    if (!sets.length) {
      toast('Sesión borrada', { description: `${exercise.name} · ${fmtDate(date)}` });
    } else if (pr?.kind === 'peso') {
      toast.success('¡Nuevo récord de peso!', {
        description: `${exercise.name}: ${fmtWeight(pr.value, pr.unit)}`,
        icon: <Trophy className="size-4 text-warn" />,
      });
    } else if (pr?.kind === '1rm') {
      toast.success('¡Mejor 1RM estimado!', {
        description: `${exercise.name}: ${fmtWeight(pr.value, pr.unit, 1)}`,
        icon: <Trophy className="size-4 text-warn" />,
      });
    } else if (pr?.kind === 'reps') {
      toast.success('¡Récord de repeticiones!', {
        description: `${exercise.name}: ${pr.value} reps`,
        icon: <Trophy className="size-4 text-warn" />,
      });
    } else {
      toast.success('Series guardadas', {
        description: offlineNote() ?? `${exercise.name} · ${sets.length} ${sets.length === 1 ? 'serie' : 'series'}`,
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
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Segmented<WeightUnit>
              value={unit}
              onChange={(v) => {
                setUnit(v);
                setError(null);
              }}
              options={[
                { value: 'kg', label: 'Kilos' },
                { value: 'ladrillos', label: 'Ladrillos' },
              ]}
            />
            <Segmented<'ambos' | 'lado'>
              value={sided ? 'lado' : 'ambos'}
              onChange={(v) => {
                setSided(v === 'lado');
                setError(null);
              }}
              options={[
                { value: 'ambos', label: 'Ambos lados' },
                { value: 'lado', label: 'Por lado' },
              ]}
            />
          </div>
          {needsMigration && (
            <p className="mb-3 rounded-xl bg-warn/12 px-3 py-2 text-[12.5px] font-medium text-warn">
              Falta aplicar la migración de ladrillos y series por lado en Supabase: así no se va a poder guardar.
            </p>
          )}
          <div
            className={cn(
              'mb-1.5 grid items-center px-0.5 text-[12px] font-medium text-muted',
              sided ? 'grid-cols-[36px_1fr_10px_1fr_1fr_32px] gap-1.5' : 'grid-cols-[36px_1fr_16px_1fr_36px] gap-2',
            )}
          >
            <span className="text-center">Serie</span>
            <span className="text-center">Peso ({UNIT_SHORT[unit]})</span>
            <span />
            {sided ? (
              <>
                <span className="text-center">Reps izq.</span>
                <span className="text-center">Reps der.</span>
              </>
            ) : (
              <span className="text-center">Reps</span>
            )}
            <span />
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const ph = placeholder(i);
              const phWeight = refSameUnit ? (ph?.weight ?? null) : null;
              const w = parseDecimal(r.w) ?? phWeight;
              const left = parseIntSafe(r.r);
              const right = sided ? (parseIntSafe(r.rr) ?? left) : null;
              const est = estimate1RM(w, right != null && left != null ? Math.max(left, right) : left);
              const diff = sided && left != null && right != null ? right - left : 0;
              const estBadge = est != null && r.r && <span className={cn(badgeClass, 'text-faint')}>1RM {fmtNum(est, 0)}</span>;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'grid items-center',
                    sided ? 'grid-cols-[36px_1fr_10px_1fr_1fr_32px] gap-1.5' : 'grid-cols-[36px_1fr_16px_1fr_36px] gap-2',
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-[14px] font-bold text-muted tnum">
                    {i + 1}
                  </span>
                  <div className="relative">
                    <input
                      data-set=""
                      value={r.w}
                      onChange={(e) => update(r.id, { w: e.target.value.replace(/[^0-9.,]/g, '') })}
                      onKeyDown={onKeyDown}
                      inputMode="decimal"
                      enterKeyHint="next"
                      placeholder={ph && refSameUnit ? (ph.weight != null ? fmtNumTrim(ph.weight) : 'PC') : '—'}
                      aria-label={`Peso serie ${i + 1} en ${UNIT_LABEL[unit]}`}
                      className={inputClass}
                    />
                    {sided && estBadge}
                  </div>
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
                      aria-label={sided ? `Reps lado izquierdo serie ${i + 1}` : `Repeticiones serie ${i + 1}`}
                      className={inputClass}
                    />
                    {!sided && estBadge}
                  </div>
                  {sided && (
                    <div className="relative">
                      <input
                        data-set=""
                        value={r.rr}
                        onChange={(e) => update(r.id, { rr: e.target.value.replace(/[^0-9]/g, '') })}
                        onKeyDown={onKeyDown}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        placeholder={r.r || (ph ? String(ph.reps_right ?? ph.reps ?? '—') : '—')}
                        aria-label={`Reps lado derecho serie ${i + 1}`}
                        className={inputClass}
                      />
                      {diff !== 0 && (
                        <span className={cn(badgeClass, 'text-[10.5px]', diff < 0 ? 'text-bad' : 'text-good')}>
                          {diff > 0 ? '+' : '−'}
                          {Math.abs(diff)}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [row()]))}
                    aria-label={`Quitar serie ${i + 1}`}
                    className={cn(
                      'flex items-center justify-center rounded-full text-faint active:bg-surface-2',
                      sided ? 'size-8' : 'size-9',
                    )}
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
          {(ref || sided) && (
            <div className="space-y-0.5 px-1 text-center text-[12px] text-faint">
              {refOtherUnitWeight ? (
                <p>La vez anterior fue en {UNIT_LABEL[ref!.unit]}: completá el peso.</p>
              ) : (
                ref && <p>Si dejás el peso vacío se usa el de la vez anterior.</p>
              )}
              {sided && <p>Si dejás vacía la derecha, se guarda igual que la izquierda.</p>}
            </div>
          )}
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
