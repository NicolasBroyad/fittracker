import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSetActiveRoutine } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { Button, IconButton } from '@/ui/button';
import { Card, Empty, Skeleton } from '@/ui/display';
import { MigrationNotice, useRoutineData } from './common';
import { NewRoutineSheet, WeekDots, routineSummary } from './RoutineSheets';

export function RoutinesScreen() {
  const { query, data, exById, missingSchema } = useRoutineData();
  const setActive = useSetActiveRoutine();
  const [creating, setCreating] = useState(false);

  return (
    <Page
      title="Rutinas"
      back={{ label: 'Entreno', fallback: '/entreno' }}
      actions={
        <IconButton label="Nueva rutina" variant="accent" onClick={() => setCreating(true)}>
          <Plus className="size-5" strokeWidth={2.5} />
        </IconButton>
      }
    >
      {missingSchema ? (
        <MigrationNotice />
      ) : query.isPending && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-[24px]" />
          <Skeleton className="h-32 rounded-[24px]" />
        </div>
      ) : !data?.routines.length ? (
        <Card>
          <Empty title="Todavía no tenés rutinas" action={<Button onClick={() => setCreating(true)}>Crear rutina</Button>}>
            Podés tener varias (por ejemplo, una de volumen y otra de definición) y elegir cuál está activa.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.routines
            .slice()
            .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.created_at.localeCompare(b.created_at))
            .map((r) => (
              <Card key={r.id} className="p-0">
                <button
                  onClick={() => navigate(`/entreno/rutinas/${r.id}`)}
                  className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[17px] font-semibold">{r.name}</span>
                      {r.is_active && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">
                          ACTIVA
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">{routineSummary(data, r)}</div>
                    <div className="mt-2.5">
                      <WeekDots data={data} routine={r} exById={exById} />
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-faint" />
                </button>
                {!r.is_active && (
                  <div className="border-t border-line px-4 py-2.5">
                    <button
                      onClick={() => {
                        setActive.mutate(r.id);
                        toast.success(`${r.name} es tu rutina activa`);
                      }}
                      className="text-[14px] font-semibold text-accent-ink"
                    >
                      Usar como rutina activa
                    </button>
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}
      <NewRoutineSheet open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}
