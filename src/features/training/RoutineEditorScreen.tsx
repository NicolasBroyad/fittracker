import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { BedDouble, Copy, Ellipsis, GripVertical, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateRoutine, useDeleteRoutine, useExercisesQuery, useSaveRoutineDay, useSetActiveRoutine } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate, useSearchParam } from '@/app/router';
import { DAY_ABBR, DAY_NAMES, MUSCLE_LABEL } from '@/lib/constants';
import { dayOfWeek, todayISO } from '@/lib/dates';
import { parseIntSafe } from '@/lib/format';
import { dayPlan, isTrainingDay, lastKnownTarget, slotLabel } from '@/lib/training';
import type { Exercise, PlanItemInput, Routine, RoutineData } from '@/lib/types';
import { Button, IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { ConfirmButton } from '@/ui/confirm-button';
import { Switch } from '@/ui/controls';
import { Card, Empty, Skeleton } from '@/ui/display';
import { Sheet } from '@/ui/sheet';
import { MigrationNotice, useRoutineData } from './common';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { RenameRoutineSheet } from './RoutineSheets';

interface DraftItem {
  exercise_id: string;
  sets: string;
  reps: string;
}
interface DraftSlot {
  key: string;
  items: DraftItem[];
}
interface Draft {
  name: string;
  isRest: boolean;
  slots: DraftSlot[];
}

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

export function RoutineEditorScreen({ id }: { id: string }) {
  const { query, data, exById, missingSchema } = useRoutineData();
  // sin el catálogo cargado, los ítems del día no se pueden armar y un guardado los borraría
  const exercisesReady = useExercisesQuery().data != null;
  const routine = data?.routines.find((r) => r.id === id) ?? null;
  const param = Number(useSearchParam('dia'));
  const [day, setDay] = useState(param >= 1 && param <= 7 ? param : dayOfWeek(todayISO()));
  const [options, setOptions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  if (missingSchema) {
    return (
      <Page title="Rutina" back={{ label: 'Rutinas', fallback: '/entreno/rutinas' }}>
        <MigrationNotice />
      </Page>
    );
  }
  if (!routine || !exercisesReady) {
    return (
      <Page title="Rutina" back={{ label: 'Rutinas', fallback: '/entreno/rutinas' }}>
        {query.isPending || (routine && !exercisesReady) ? (
          <Skeleton className="h-64 rounded-[24px]" />
        ) : (
          <Card>
            <Empty
              title="Esta rutina no existe"
              action={<Button onClick={() => navigate('/entreno/rutinas', { replace: true })}>Ver rutinas</Button>}
            />
          </Card>
        )}
      </Page>
    );
  }

  return (
    <Page
      title={routine.name}
      eyebrow={
        <span className="inline-flex items-center gap-2">
          {routine.is_active ? <span className="text-accent-ink">Rutina activa</span> : 'Rutina'}
          <span className={cn('text-[12px] text-faint transition-opacity', status === 'idle' && 'opacity-0')}>
            {status === 'saving' ? 'Guardando…' : 'Guardado'}
          </span>
        </span>
      }
      back={{ label: 'Rutinas', fallback: '/entreno/rutinas' }}
      actions={
        <IconButton label="Opciones de la rutina" onClick={() => setOptions(true)}>
          <Ellipsis className="size-5" />
        </IconButton>
      }
    >
      <div className="space-y-4">
        {!routine.is_active && <ActivateBanner routine={routine} />}
        <DayTabs data={data!} routine={routine} exById={exById} day={day} onChange={setDay} />
        <DayEditor key={`${routine.id}-${day}`} data={data!} routine={routine} day={day} exById={exById} onStatus={setStatus} />
      </div>

      <RoutineOptionsSheet
        routine={routine}
        data={data!}
        open={options}
        onClose={() => setOptions(false)}
        onRename={() => {
          setOptions(false);
          setTimeout(() => setRenaming(true), 250);
        }}
      />
      <RenameRoutineSheet routine={routine} open={renaming} onClose={() => setRenaming(false)} />
    </Page>
  );
}

function ActivateBanner({ routine }: { routine: Routine }) {
  const setActive = useSetActiveRoutine();
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <span className="text-[14px] text-muted">Esta rutina no está activa</span>
      <Button
        size="sm"
        onClick={() => {
          setActive.mutate(routine.id);
          toast.success(`${routine.name} es tu rutina activa`);
        }}
      >
        Activar
      </Button>
    </div>
  );
}

function DayTabs({
  data,
  routine,
  exById,
  day,
  onChange,
}: {
  data: RoutineData;
  routine: Routine;
  exById: Map<string, Exercise>;
  day: number;
  onChange: (d: number) => void;
}) {
  return (
    <div className="-mx-4 no-scrollbar flex gap-1.5 overflow-x-auto px-4">
      {DAY_ABBR.map((abbr, i) => {
        const p = dayPlan(data, routine.id, i + 1, exById);
        const sel = day === i + 1;
        return (
          <button
            key={abbr}
            onClick={() => onChange(i + 1)}
            className={cn(
              'flex h-[58px] min-w-[64px] flex-1 flex-col items-center justify-center rounded-2xl border px-2 transition-colors active:scale-95',
              sel ? 'border-transparent bg-fg text-bg' : 'border-line bg-surface',
            )}
          >
            <span className="text-[13.5px] font-semibold">{abbr}</span>
            <span className={cn('max-w-[72px] truncate text-[11px]', sel ? 'text-bg/65' : 'text-muted')}>
              {p.isRest ? 'Descanso' : isTrainingDay(p) ? p.name || `${p.slots.length} ej.` : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function toDraft(data: RoutineData, routine: Routine, day: number, exById: Map<string, Exercise>): Draft {
  const p = dayPlan(data, routine.id, day, exById);
  return {
    name: p.day?.name ?? '',
    isRest: p.isRest,
    slots: p.slots.map((s) => ({
      key: newKey(),
      items: s.items.map((it) => ({
        exercise_id: it.exercise_id,
        sets: it.sets_target != null ? String(it.sets_target) : '',
        reps: it.reps_target ?? '',
      })),
    })),
  };
}

function toItems(d: Draft): PlanItemInput[] {
  return d.slots.flatMap((s, si) =>
    s.items.map((it, vi) => {
      const sets = parseIntSafe(it.sets);
      return {
        exercise_id: it.exercise_id,
        order_index: si + 1,
        variant: vi,
        sets_target: sets != null && sets >= 1 && sets <= 20 ? sets : null,
        reps_target: it.reps.trim() || null,
      };
    }),
  );
}

function DayEditor({
  data,
  routine,
  day,
  exById,
  onStatus,
}: {
  data: RoutineData;
  routine: Routine;
  day: number;
  exById: Map<string, Exercise>;
  onStatus: (s: 'idle' | 'saving' | 'saved') => void;
}) {
  const save = useSaveRoutineDay();
  const [draft, setDraftState] = useState<Draft>(() => toDraft(data, routine, day, exById));
  const [picker, setPicker] = useState<{ slotKey: string | null } | null>(null);
  const pending = useRef<Draft | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = pending.current;
    if (!d) return;
    pending.current = null;
    onStatus('saving');
    save.mutate(
      { routineId: routine.id, dayOfWeek: day, name: d.name.trim(), isRest: d.isRest, items: toItems(d) },
      { onSuccess: () => onStatus('saved'), onError: () => onStatus('idle') },
    );
  }, [save, routine.id, day, onStatus]);

  // guarda automáticamente al dejar de editar; y lo pendiente al cambiar de día o salir
  const setDraft = (fn: (d: Draft) => Draft, delay = 700) => {
    setDraftState((prev) => {
      const next = fn(prev);
      pending.current = next;
      return next;
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delay);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const exclude = useMemo(() => new Set(draft.slots.flatMap((s) => s.items.map((i) => i.exercise_id))), [draft.slots]);

  function pick(ex: Exercise) {
    const t = lastKnownTarget(data, ex.id);
    const item: DraftItem = { exercise_id: ex.id, sets: t.sets != null ? String(t.sets) : '', reps: t.reps ?? '' };
    const slotKey = picker?.slotKey ?? null;
    setDraft(
      (d) => ({
        ...d,
        slots: slotKey
          ? d.slots.map((s) => (s.key === slotKey ? { ...s, items: [...s.items, item] } : s))
          : [...d.slots, { key: newKey(), items: [item] }],
      }),
      0,
    );
    setPicker(null);
  }

  const updateItem = (slotKey: string, exId: string, patch: Partial<DraftItem>) =>
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((s) =>
        s.key === slotKey ? { ...s, items: s.items.map((it) => (it.exercise_id === exId ? { ...it, ...patch } : it)) } : s,
      ),
    }));

  const removeItem = (slotKey: string, exId: string) =>
    setDraft(
      (d) => ({
        ...d,
        slots: d.slots
          .map((s) => (s.key === slotKey ? { ...s, items: s.items.filter((it) => it.exercise_id !== exId) } : s))
          .filter((s) => s.items.length > 0),
      }),
      0,
    );

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <div className="mb-1.5 px-1 text-[13px] font-medium text-muted">{DAY_NAMES[day - 1]}</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={flush}
            placeholder="Nombre del día (ej. Push, Pierna, Torso…)"
            maxLength={40}
            disabled={draft.isRest}
            className="h-12 w-full rounded-2xl bg-surface-2 px-4 text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-faint disabled:opacity-50"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <BedDouble className="size-[18px] text-muted" />
            <span className="text-[15px]">Día de descanso</span>
          </div>
          <Switch checked={draft.isRest} onChange={(v) => setDraft((d) => ({ ...d, isRest: v }), 0)} label="Día de descanso" />
        </div>
      </Card>

      {draft.isRest ? (
        <p className="px-4 text-center text-[13.5px] text-muted">
          {draft.slots.length
            ? `Los ${draft.slots.length} ejercicios de este día se conservan, pero no se muestran mientras sea descanso.`
            : 'Este día no se entrena.'}
        </p>
      ) : (
        <>
          {draft.slots.length > 0 && (
            <Reorder.Group
              axis="y"
              values={draft.slots}
              onReorder={(slots: DraftSlot[]) => setDraft((d) => ({ ...d, slots }), 900)}
              className="space-y-3"
            >
              {draft.slots.map((slot, i) => (
                <SlotEditor
                  key={slot.key}
                  slot={slot}
                  position={i + 1}
                  exById={exById}
                  onUpdate={(exId, patch) => updateItem(slot.key, exId, patch)}
                  onRemove={(exId) => removeItem(slot.key, exId)}
                  onBlur={flush}
                  onAddAlt={() => setPicker({ slotKey: slot.key })}
                />
              ))}
            </Reorder.Group>
          )}
          <button
            onClick={() => setPicker({ slotKey: null })}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-line-strong text-[15px] font-semibold text-accent-ink active:bg-surface-2"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Agregar ejercicio
          </button>
          {draft.slots.length > 1 && (
            <p className="flex items-center justify-center gap-1 text-[12.5px] text-faint">
              Arrastrá desde <GripVertical className="size-3.5" /> para cambiar el orden
            </p>
          )}
        </>
      )}

      <ExercisePickerSheet
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={pick}
        exclude={exclude}
        title={picker?.slotKey ? 'Agregar alternativa' : 'Agregar ejercicio'}
      />
    </div>
  );
}

function SlotEditor({
  slot,
  position,
  exById,
  onUpdate,
  onRemove,
  onBlur,
  onAddAlt,
}: {
  slot: DraftSlot;
  position: number;
  exById: Map<string, Exercise>;
  onUpdate: (exId: string, patch: Partial<DraftItem>) => void;
  onRemove: (exId: string) => void;
  onBlur: () => void;
  onAddAlt: () => void;
}) {
  const controls = useDragControls();
  const count = slot.items.length;
  return (
    <Reorder.Item
      value={slot}
      dragListener={false}
      dragControls={controls}
      className="relative list-none rounded-[22px] border border-line bg-surface shadow-card"
      whileDrag={{ scale: 1.02, boxShadow: '0 16px 40px rgba(0,0,0,0.3)', zIndex: 20 }}
    >
      <div className="flex">
        <button
          onPointerDown={(e) => controls.start(e)}
          aria-label="Mover"
          className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-[22px] text-faint active:cursor-grabbing active:text-fg"
        >
          <GripVertical className="size-5" />
        </button>
        <div className="min-w-0 flex-1 py-2 pr-2">
          {slot.items.map((it, vi) => {
            const ex = exById.get(it.exercise_id);
            return (
              <div key={it.exercise_id} className={cn('flex gap-3 py-2', vi > 0 && 'border-t border-dashed border-line')}>
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold tnum">
                  {slotLabel(position, vi, count)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] leading-snug font-semibold">{ex?.name ?? 'Ejercicio'}</div>
                      {ex?.muscle_group && <div className="text-[12.5px] text-muted">{MUSCLE_LABEL[ex.muscle_group]}</div>}
                    </div>
                    <button
                      onClick={() => onRemove(it.exercise_id)}
                      aria-label="Quitar de este día"
                      className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-faint active:bg-surface-2"
                    >
                      <X className="size-4" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={it.sets}
                      onChange={(e) => onUpdate(it.exercise_id, { sets: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                      onBlur={onBlur}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Series"
                      aria-label="Series objetivo"
                      className="h-10 w-[74px] rounded-xl bg-surface-2 text-center text-[16px] font-semibold tnum outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-faint"
                    />
                    <span className="text-faint">×</span>
                    <input
                      value={it.reps}
                      onChange={(e) => onUpdate(it.exercise_id, { reps: e.target.value.slice(0, 12) })}
                      onBlur={onBlur}
                      placeholder="Reps (8-10)"
                      aria-label="Repeticiones objetivo"
                      className="h-10 w-[108px] rounded-xl bg-surface-2 text-center text-[16px] font-semibold tnum outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-faint"
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <button
            onClick={onAddAlt}
            className="mt-1 ml-11 flex items-center gap-1 py-1.5 text-[13px] font-semibold text-muted active:text-fg"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Alternativa
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function RoutineOptionsSheet({
  routine,
  data,
  open,
  onClose,
  onRename,
}: {
  routine: Routine;
  data: RoutineData;
  open: boolean;
  onClose: () => void;
  onRename: () => void;
}) {
  const setActive = useSetActiveRoutine();
  const create = useCreateRoutine();
  const del = useDeleteRoutine();

  async function duplicate() {
    const r = await create.mutateAsync({
      name: `${routine.name} (copia)`,
      activate: false,
      copy: {
        days: data.days.filter((d) => d.routine_id === routine.id),
        items: data.items.filter((i) => i.routine_id === routine.id),
      },
    });
    onClose();
    toast.success('Rutina duplicada');
    navigate(`/entreno/rutinas/${r.id}`, { replace: true });
  }

  function remove() {
    const others = data.routines.filter((r) => r.id !== routine.id);
    del.mutate(routine.id);
    if (routine.is_active && others.length) {
      setActive.mutate(others[0].id);
      toast(`Rutina eliminada. ${others[0].name} quedó como activa.`);
    } else toast('Rutina eliminada');
    onClose();
    navigate('/entreno/rutinas', { replace: true });
  }

  const row = 'flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15.5px] active:bg-surface-3';
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={routine.name}>
      <div className="space-y-4 pt-2">
        <div className="overflow-hidden rounded-2xl bg-surface-2">
          <button className={row} onClick={onRename}>
            <Pencil className="size-[18px] text-muted" /> Renombrar
          </button>
          {!routine.is_active && (
            <button
              className={cn(row, 'border-t border-line')}
              onClick={() => {
                setActive.mutate(routine.id);
                toast.success(`${routine.name} es tu rutina activa`);
                onClose();
              }}
            >
              <Star className="size-[18px] text-muted" /> Usar como rutina activa
            </button>
          )}
          <button className={cn(row, 'border-t border-line')} onClick={duplicate} disabled={create.isPending}>
            <Copy className="size-[18px] text-muted" /> Duplicar
          </button>
        </div>
        <ConfirmButton
          block
          size="lg"
          icon={<Trash2 className="size-[18px]" />}
          confirmLabel="Tocá de nuevo para eliminar"
          onConfirm={remove}
        >
          Eliminar rutina
        </ConfirmButton>
        <p className="px-2 text-center text-[12.5px] text-muted">
          Eliminar una rutina no borra los ejercicios ni su historial de series.
        </p>
      </div>
    </Sheet>
  );
}
