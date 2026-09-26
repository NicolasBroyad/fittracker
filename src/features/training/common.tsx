import { Check, DatabaseZap } from 'lucide-react';
import { useExerciseMap, useRoutinesQuery } from '@/api/hooks';
import { BackendError } from '@/api';
import { activeRoutine } from '@/lib/training';
import { cn } from '@/ui/cn';
import { Card } from '@/ui/display';

export function useRoutineData() {
  const q = useRoutinesQuery();
  const exById = useExerciseMap();
  const missingSchema = q.error instanceof BackendError && q.error.missingSchema;
  return { query: q, data: q.data, active: activeRoutine(q.data), exById, missingSchema };
}

export function MigrationNotice() {
  return (
    <Card className="border-warn/30">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warn/15 text-warn">
          <DatabaseZap className="size-5" />
        </span>
        <div>
          <div className="text-[15px] font-semibold">Falta actualizar la base de datos</div>
          <p className="mt-1 text-[13.5px] leading-snug text-muted">
            Las rutinas de la 2.0 necesitan la migración <code className="text-fg">20260925000000_v2_routines.sql</code>. Aplicala
            en Supabase y recargá la app.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Número del puesto en la rutina ("3", "2a"...). */
export function SlotNumber({ label, done, className }: { label: string; done?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tnum',
        done ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg',
        className,
      )}
    >
      {label}
      {done && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-[15px] items-center justify-center rounded-full border-2 border-surface bg-good text-white">
          <Check className="size-2" strokeWidth={4} />
        </span>
      )}
    </span>
  );
}
