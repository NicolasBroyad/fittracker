import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useRoutinesQuery,
  useTrainingIndex,
  useUpdateExercise,
} from '@/api/hooks';
import { useResetKey } from '@/app/hooks';
import { MUSCLE_GROUPS } from '@/lib/constants';
import { exerciseUsage, sessionsOf } from '@/lib/training';
import type { Exercise, MuscleGroup } from '@/lib/types';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/controls';
import { ConfirmButton } from '@/ui/confirm-button';
import { Field, Label, TextInput } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';

export function ExerciseFormSheet({
  open,
  onClose,
  exercise,
  onCreated,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  onCreated?: (ex: Exercise) => void;
  onDeleted?: () => void;
}) {
  const key = useResetKey(open);
  return (
    <Sheet bare open={open} onOpenChange={(o) => !o && onClose()} title={exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}>
      <ExerciseForm key={key} exercise={exercise} onDone={onClose} onCreated={onCreated} onDeleted={onDeleted} />
    </Sheet>
  );
}

function ExerciseForm({
  exercise,
  onDone,
  onCreated,
  onDeleted,
}: {
  exercise: Exercise | null;
  onDone: () => void;
  onCreated?: (ex: Exercise) => void;
  onDeleted?: () => void;
}) {
  const exercises = useExercises();
  const index = useTrainingIndex();
  const routines = useRoutinesQuery().data;
  const create = useCreateExercise();
  const update = useUpdateExercise();
  const del = useDeleteExercise();
  const [name, setName] = useState(exercise?.name ?? '');
  const [group, setGroup] = useState<MuscleGroup | null>(exercise?.muscle_group ?? null);
  const [error, setError] = useState<string | null>(null);

  const sessions = exercise ? sessionsOf(index, exercise.id).length : 0;
  const usage = exercise ? exerciseUsage(routines, exercise.id).length : 0;

  async function save() {
    const n = name.trim();
    if (!n) return;
    const dup = exercises.find((e) => e.id !== exercise?.id && e.name.trim().toLowerCase() === n.toLowerCase());
    if (dup) {
      setError('Ya existe un ejercicio con ese nombre');
      return;
    }
    if (exercise) {
      update.mutate({ id: exercise.id, name: n, muscle_group: group });
      toast.success('Ejercicio actualizado');
      onDone();
    } else {
      const ex = await create.mutateAsync({ name: n, muscle_group: group });
      toast.success('Ejercicio creado');
      onDone();
      onCreated?.(ex);
    }
  }

  return (
    <>
      <SheetBody className="space-y-5 pt-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Ej. Press banca, Sentadilla…"
            maxLength={60}
          />
        </Field>
        <div>
          <Label>Grupo muscular</Label>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((m) => (
              <Chip key={m.value} selected={group === m.value} onClick={() => setGroup(group === m.value ? null : m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
        {error && <p className="px-1 text-[14px] font-medium text-bad">{error}</p>}

        {exercise && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <p className="text-[13.5px] leading-snug text-muted">
              Eliminarlo borra también sus <b className="text-fg">{sessions} sesiones</b> registradas
              {usage > 0 && (
                <>
                  {' '}
                  y lo quita de{' '}
                  <b className="text-fg">
                    {usage} {usage === 1 ? 'día' : 'días'}
                  </b>{' '}
                  de tus rutinas
                </>
              )}
              . No se puede deshacer.
            </p>
            <ConfirmButton
              className="mt-3"
              block
              icon={<Trash2 className="size-[18px]" />}
              confirmLabel="Tocá de nuevo para eliminar"
              onConfirm={() => {
                del.mutate(exercise.id);
                toast('Ejercicio eliminado');
                onDone();
                onDeleted?.();
              }}
            >
              Eliminar ejercicio
            </ConfirmButton>
          </div>
        )}
      </SheetBody>
      <SheetFooter>
        <Button size="lg" block disabled={!name.trim()} loading={create.isPending} onClick={save}>
          {exercise ? 'Guardar cambios' : 'Crear ejercicio'}
        </Button>
      </SheetFooter>
    </>
  );
}
