import { ChevronRight } from 'lucide-react';
import { useExerciseMap, useTrainingIndex } from '@/api/hooks';
import { useSticky } from '@/app/hooks';
import { sheets, useSheets } from '@/app/sheets';
import { fmtLong } from '@/lib/dates';
import { fmtSets, fmtVolume } from '@/lib/format';
import { cn } from '@/ui/cn';
import { MuscleBadge } from '@/ui/display';
import { Sheet } from '@/ui/sheet';

/** Todo lo que se entrenó en una fecha, de cualquier ejercicio. */
export function DaySessionsSheet() {
  const { day } = useSheets();
  const data = useSticky(day);
  const index = useTrainingIndex();
  const exById = useExerciseMap();
  const sessions = data ? (index.byDate.get(data.date) ?? []) : [];
  const sets = sessions.reduce((a, s) => a + s.setCount, 0);
  const volume = sessions.reduce((a, s) => a + s.volume, 0);

  return (
    <Sheet
      open={!!day}
      onOpenChange={(o) => !o && sheets.closeDay()}
      title={data ? fmtLong(data.date) : ''}
      description={
        sessions.length
          ? `${sessions.length} ejercicios · ${sets} series${volume ? ` · ${fmtVolume(volume)}` : ''}`
          : 'Sin entrenamientos'
      }
    >
      <div className="overflow-hidden rounded-2xl bg-surface-2">
        {sessions.map((s, i) => {
          const ex = exById.get(s.exerciseId);
          return (
            <button
              key={s.exerciseId}
              onClick={() => {
                sheets.closeDay();
                setTimeout(() => sheets.openSets(s.exerciseId, { date: s.date }), 280);
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3',
                i && 'border-t border-line',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">{ex?.name ?? 'Ejercicio'}</span>
                  <MuscleBadge group={ex?.muscle_group} className="bg-surface-3" />
                </div>
                <div className="mt-0.5 text-[13px] text-muted tnum">{fmtSets(s.sets)}</div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
