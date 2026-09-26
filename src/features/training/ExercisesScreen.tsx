import { useMemo, useState } from 'react';
import { ChevronRight, Dumbbell, Plus, Search } from 'lucide-react';
import { useExercises, useExercisesQuery, useRoutinesQuery, useTrainingIndex } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { MUSCLE_GROUPS } from '@/lib/constants';
import { fmtRelative } from '@/lib/dates';
import { exerciseUsage, lastSession, sessionsOf } from '@/lib/training';
import type { MuscleGroup } from '@/lib/types';
import { Button, IconButton } from '@/ui/button';
import { searchKey } from '@/lib/format';
import { cn } from '@/ui/cn';
import { Chip } from '@/ui/controls';
import { Card, Empty, Skeleton } from '@/ui/display';
import { ExerciseFormSheet } from './ExerciseFormSheet';

const norm = searchKey;

export function ExercisesScreen() {
  const query = useExercisesQuery();
  const exercises = useExercises();
  const index = useTrainingIndex();
  const routines = useRoutinesQuery().data;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => {
    const nq = norm(q.trim());
    const filtered = exercises
      .filter((e) => (group == null || e.muscle_group === group) && (!nq || norm(e.name).includes(nq)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const out: { title: string; items: typeof filtered }[] = [];
    for (const m of MUSCLE_GROUPS) {
      const items = filtered.filter((e) => e.muscle_group === m.value);
      if (items.length) out.push({ title: m.label, items });
    }
    const rest = filtered.filter((e) => !e.muscle_group);
    if (rest.length) out.push({ title: 'Sin grupo', items: rest });
    return out;
  }, [exercises, q, group]);

  return (
    <Page
      title="Ejercicios"
      back={{ label: 'Entrenamiento', fallback: '/entreno' }}
      actions={
        <IconButton label="Nuevo ejercicio" variant="accent" onClick={() => setCreating(true)}>
          <Plus className="size-5" strokeWidth={2.5} />
        </IconButton>
      }
    >
      {query.isPending && !exercises.length ? (
        <div className="space-y-3">
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-64 rounded-[24px]" />
        </div>
      ) : !exercises.length ? (
        <Card>
          <Empty
            icon={<Dumbbell className="size-6" />}
            title="Todavía no hay ejercicios"
            action={<Button onClick={() => setCreating(true)}>Crear ejercicio</Button>}
          >
            Cada ejercicio tiene un único historial, aunque lo uses en varios días o rutinas.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar en ${exercises.length} ejercicios`}
              className="h-11 w-full rounded-2xl border border-line bg-surface pr-4 pl-10 text-[16px] outline-none placeholder:text-faint"
            />
          </div>
          <div className="-mx-4 mt-3 no-scrollbar flex gap-1.5 overflow-x-auto px-4">
            <Chip selected={group == null} onClick={() => setGroup(null)}>
              Todos
            </Chip>
            {MUSCLE_GROUPS.filter((m) => exercises.some((e) => e.muscle_group === m.value)).map((m) => (
              <Chip key={m.value} selected={group === m.value} onClick={() => setGroup(group === m.value ? null : m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>

          <div className="mt-5 space-y-5">
            {sections.length === 0 && <p className="py-8 text-center text-[14px] text-muted">No hay ejercicios que coincidan.</p>}
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{s.title}</h2>
                <Card className="p-0">
                  {s.items.map((e, i) => {
                    const last = lastSession(index, e.id);
                    const n = sessionsOf(index, e.id).length;
                    const used = exerciseUsage(routines, e.id).length;
                    return (
                      <button
                        key={e.id}
                        onClick={() => navigate(`/entreno/ejercicios/${e.id}`)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2',
                          i && 'border-t border-line',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15.5px] font-medium">{e.name}</div>
                          <div className="truncate text-[12.5px] text-muted">
                            {n ? `${n} ${n === 1 ? 'sesión' : 'sesiones'} · última ${fmtRelative(last!.date)}` : 'Sin registros'}
                            {used === 0 && ' · sin asignar'}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-faint" />
                      </button>
                    );
                  })}
                </Card>
              </section>
            ))}
          </div>
        </>
      )}
      <ExerciseFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        exercise={null}
        onCreated={(ex) => navigate(`/entreno/ejercicios/${ex.id}`)}
      />
    </Page>
  );
}
