import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { useCreateExercise, useExercises, useTrainingIndex } from '@/api/hooks';
import { useResetKey } from '@/app/hooks';
import { MUSCLE_GROUPS, MUSCLE_LABEL } from '@/lib/constants';
import { fmtRelative } from '@/lib/dates';
import { lastSession } from '@/lib/training';
import type { Exercise, MuscleGroup } from '@/lib/types';
import { Button } from '@/ui/button';
import { searchKey } from '@/lib/format';
import { cn } from '@/ui/cn';
import { Chip } from '@/ui/controls';
import { Label } from '@/ui/fields';
import { Sheet } from '@/ui/sheet';

const norm = searchKey;

export function ExercisePickerSheet({
  open,
  onClose,
  onPick,
  exclude,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ex: Exercise) => void;
  /** ejercicios que ya están en el día (no se pueden repetir) */
  exclude: Set<string>;
  title: string;
}) {
  const key = useResetKey(open);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title} className="h-[92dvh]">
      <Picker key={key} onPick={onPick} exclude={exclude} />
    </Sheet>
  );
}

function Picker({ onPick, exclude }: { onPick: (ex: Exercise) => void; exclude: Set<string> }) {
  const exercises = useExercises();
  const index = useTrainingIndex();
  const create = useCreateExercise();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [newGroup, setNewGroup] = useState<MuscleGroup | null>(null);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return exercises
      .filter((e) => (!group || e.muscle_group === group) && (!nq || norm(e.name).includes(nq)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [exercises, q, group]);

  const exact = exercises.some((e) => norm(e.name) === norm(q.trim()));
  const canCreate = q.trim().length > 1 && !exact;

  async function createAndPick() {
    const ex = await create.mutateAsync({ name: q.trim(), muscle_group: newGroup ?? group });
    onPick(ex);
  }

  return (
    <div className="pt-1">
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar o crear ejercicio"
            className="h-11 w-full rounded-2xl bg-surface-2 pr-4 pl-10 text-[16px] outline-none placeholder:text-faint"
          />
        </div>
        <div className="-mx-5 mt-2.5 no-scrollbar flex gap-1.5 overflow-x-auto px-5">
          <Chip selected={!group} onClick={() => setGroup(null)}>
            Todos
          </Chip>
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m.value} selected={group === m.value} onClick={() => setGroup(group === m.value ? null : m.value)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </div>

      {canCreate && (
        <div className="mb-3 rounded-2xl border border-dashed border-line-strong p-3.5">
          <div className="text-[15px]">
            Crear <b>«{q.trim()}»</b>
          </div>
          <div className="mt-2.5">
            <Label>Grupo muscular</Label>
          </div>
          <div className="-mt-0.5 flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((m) => (
              <Chip key={m.value} selected={(newGroup ?? group) === m.value} onClick={() => setNewGroup(m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
          <Button
            block
            className="mt-3"
            icon={<Plus className="size-[18px]" />}
            loading={create.isPending}
            onClick={createAndPick}
          >
            Crear y agregar
          </Button>
        </div>
      )}

      {list.length === 0 && !canCreate && (
        <p className="py-8 text-center text-[14px] text-muted">
          {exercises.length ? 'No hay ejercicios que coincidan.' : 'Escribí el nombre de un ejercicio para crearlo.'}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface-2">
        {list.map((e, i) => {
          const used = exclude.has(e.id);
          const last = lastSession(index, e.id);
          return (
            <button
              key={e.id}
              disabled={used}
              onClick={() => onPick(e)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3 disabled:opacity-45',
                i && 'border-t border-line',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{e.name}</div>
                <div className="text-[12.5px] text-muted">
                  {[
                    e.muscle_group ? MUSCLE_LABEL[e.muscle_group] : null,
                    used ? 'ya está en este día' : last ? `último ${fmtRelative(last.date)}` : 'sin registros',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {used ? <Check className="size-[18px] text-faint" /> : <Plus className="size-[18px] text-accent-ink" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
