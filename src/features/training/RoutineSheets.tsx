import { useState } from 'react';
import { Check, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateRoutine, useRenameRoutine, useSetActiveRoutine } from '@/api/hooks';
import { useResetKey } from '@/app/hooks';
import { navigate } from '@/app/router';
import { DAY_LETTER } from '@/lib/constants';
import { dayPlan, isTrainingDay } from '@/lib/training';
import type { Routine, RoutineData } from '@/lib/types';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Switch } from '@/ui/controls';
import { Field, Label, TextInput } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';
import { useRoutineData } from './common';

/** Mini semana con los días de entrenamiento resaltados. */
export function WeekDots({
  data,
  routine,
  exById,
}: {
  data: RoutineData;
  routine: Routine;
  exById: ReturnType<typeof useRoutineData>['exById'];
}) {
  return (
    <div className="flex gap-1">
      {DAY_LETTER.map((l, i) => {
        const p = dayPlan(data, routine.id, i + 1, exById);
        const train = isTrainingDay(p);
        return (
          <span
            key={i}
            className={cn(
              'flex size-[22px] items-center justify-center rounded-md text-[10.5px] font-bold',
              train ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-faint',
            )}
          >
            {l}
          </span>
        );
      })}
    </div>
  );
}

export function routineSummary(data: RoutineData, routine: Routine): string {
  const items = data.items.filter((i) => i.routine_id === routine.id);
  const days = new Set(items.map((i) => i.day_of_week));
  const restDays = data.days.filter((d) => d.routine_id === routine.id && d.is_rest).map((d) => d.day_of_week);
  restDays.forEach((d) => days.delete(d));
  const slots = new Set(items.filter((i) => !restDays.includes(i.day_of_week)).map((i) => `${i.day_of_week}-${i.order_index}`));
  return `${days.size} ${days.size === 1 ? 'día' : 'días'} · ${slots.size} ejercicios`;
}

export function RoutineSwitcherSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: () => void }) {
  const { data, exById } = useRoutineData();
  const setActive = useSetActiveRoutine();
  return (
    <Sheet
      bare
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Rutinas"
      description="Elegí la rutina que estás siguiendo"
    >
      <SheetBody className="space-y-2 pt-2">
        {data?.routines.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              if (!r.is_active) {
                setActive.mutate(r.id);
                toast.success(`${r.name} es tu rutina activa`);
              }
              onClose();
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors active:scale-[0.99]',
              r.is_active ? 'border-accent-ink/40 bg-accent-soft' : 'border-line bg-surface-2',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">{r.name}</div>
              <div className="mt-0.5 text-[13px] text-muted">{routineSummary(data, r)}</div>
              <div className="mt-2">
                <WeekDots data={data} routine={r} exById={exById} />
              </div>
            </div>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                r.is_active ? 'border-accent-ink bg-accent-ink text-bg' : 'border-line-strong',
              )}
            >
              {r.is_active && <Check className="size-3.5" strokeWidth={3.5} />}
            </span>
          </button>
        ))}
      </SheetBody>
      <SheetFooter>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          icon={<Settings2 className="size-[18px]" />}
          onClick={() => {
            onClose();
            navigate('/entreno/rutinas');
          }}
        >
          Administrar
        </Button>
        <Button
          size="lg"
          className="flex-1"
          icon={<Plus className="size-[18px]" />}
          onClick={() => {
            onClose();
            setTimeout(onCreate, 250);
          }}
        >
          Nueva
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

export function NewRoutineSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const key = useResetKey(open);
  return (
    <Sheet bare open={open} onOpenChange={(o) => !o && onClose()} title="Nueva rutina">
      <NewRoutineForm key={key} onDone={onClose} />
    </Sheet>
  );
}

function NewRoutineForm({ onDone }: { onDone: () => void }) {
  const { data } = useRoutineData();
  const create = useCreateRoutine();
  const [name, setName] = useState('');
  const [from, setFrom] = useState<string>('');
  const [activate, setActivate] = useState(!data?.routines.some((r) => r.is_active));

  async function submit() {
    const n = name.trim();
    if (!n) return;
    const copy =
      from && data
        ? { days: data.days.filter((d) => d.routine_id === from), items: data.items.filter((i) => i.routine_id === from) }
        : undefined;
    const r = await create.mutateAsync({ name: n, activate, copy });
    onDone();
    navigate(`/entreno/rutinas/${r.id}`);
  }

  return (
    <>
      <SheetBody className="space-y-4 pt-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Push Pull Legs, Torso/Pierna…"
            maxLength={60}
          />
        </Field>
        {!!data?.routines.length && (
          <div>
            <Label>Empezar desde</Label>
            <div className="overflow-hidden rounded-2xl bg-surface-2">
              {[{ id: '', name: 'Rutina vacía' }, ...data.routines.map((r) => ({ id: r.id, name: `Copia de ${r.name}` }))].map(
                (o, i) => (
                  <button
                    key={o.id}
                    onClick={() => setFrom(o.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-3 text-left text-[15px] active:bg-surface-3',
                      i && 'border-t border-line',
                    )}
                  >
                    <span className="truncate">{o.name}</span>
                    {from === o.id && <Check className="size-[18px] text-accent-ink" strokeWidth={3} />}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <div>
            <div className="text-[15px] font-medium">Usar como rutina activa</div>
            <div className="text-[13px] text-muted">Es la que aparece en Hoy y Entrenamiento</div>
          </div>
          <Switch checked={activate} onChange={setActivate} label="Usar como rutina activa" />
        </div>
      </SheetBody>
      <SheetFooter>
        <Button size="lg" block disabled={!name.trim()} loading={create.isPending} onClick={submit}>
          Crear rutina
        </Button>
      </SheetFooter>
    </>
  );
}

export function RenameRoutineSheet({ routine, open, onClose }: { routine: Routine; open: boolean; onClose: () => void }) {
  const key = useResetKey(open);
  return (
    <Sheet bare open={open} onOpenChange={(o) => !o && onClose()} title="Renombrar rutina">
      <RenameForm key={key} routine={routine} onDone={onClose} />
    </Sheet>
  );
}

function RenameForm({ routine, onDone }: { routine: Routine; onDone: () => void }) {
  const rename = useRenameRoutine();
  const [name, setName] = useState(routine.name);
  return (
    <>
      <SheetBody className="space-y-4 pt-2">
        <Field label="Nombre">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
      </SheetBody>
      <SheetFooter>
        <Button
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            rename.mutate({ id: routine.id, name: name.trim() });
            onDone();
          }}
        >
          Guardar
        </Button>
      </SheetFooter>
    </>
  );
}
