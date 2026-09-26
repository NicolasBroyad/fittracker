import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePhase, useDeletePhase, useUpdatePhase } from '@/api/hooks';
import { useResetKey } from '@/app/hooks';
import { PHASE_META, PHASES } from '@/lib/constants';
import { addDays, diffDays, fmtDate, todayISO } from '@/lib/dates';
import type { ISODate, Phase, PhaseKind } from '@/lib/types';
import { currentPhase, sortPhases } from '@/lib/weight';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { ConfirmButton } from '@/ui/confirm-button';
import { Empty } from '@/ui/display';
import { DateField, Field, Label } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';

type View = { kind: 'list' } | { kind: 'form'; phase: Phase | null };

function durationLabel(p: Phase, today: ISODate): string {
  const days = diffDays(p.end_date ?? today, p.start_date) + 1;
  if (days < 14) return `${days} ${days === 1 ? 'día' : 'días'}`;
  const weeks = Math.round(days / 7);
  return `${weeks} semanas`;
}

export function PhasesSheet({ open, onClose, phases }: { open: boolean; onClose: () => void; phases: Phase[] }) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const key = useResetKey(open);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setView({ kind: 'list' });
  }

  const title = view.kind === 'list' ? 'Fases' : view.phase ? 'Editar fase' : 'Nueva fase';
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      bare
      title={title}
      description={view.kind === 'list' ? 'Períodos de volumen, definición y mantenimiento' : undefined}
    >
      {view.kind === 'list' ? (
        <PhaseList
          phases={phases}
          onNew={() => setView({ kind: 'form', phase: null })}
          onEdit={(p) => setView({ kind: 'form', phase: p })}
        />
      ) : (
        <PhaseForm key={view.phase?.id ?? 'new'} phase={view.phase} phases={phases} onDone={() => setView({ kind: 'list' })} />
      )}
    </Sheet>
  );
}

function PhaseList({ phases, onNew, onEdit }: { phases: Phase[]; onNew: () => void; onEdit: (p: Phase) => void }) {
  const today = todayISO();
  const update = useUpdatePhase();
  const current = currentPhase(phases, today);
  const sorted = sortPhases(phases);

  return (
    <>
      <SheetBody className="pt-2">
        {current && (
          <div
            className="mb-4 rounded-[20px] p-4"
            style={{ background: `color-mix(in srgb, ${PHASE_META[current.phase].color} 12%, transparent)` }}
          >
            <div className="text-[12.5px] font-medium" style={{ color: PHASE_META[current.phase].color }}>
              En curso
            </div>
            <div className="mt-0.5 text-[20px] font-semibold tracking-tight">{PHASE_META[current.phase].label}</div>
            <div className="text-[13.5px] text-muted">
              Desde el {fmtDate(current.start_date)} · {durationLabel(current, today)}
              {current.end_date && <> · termina el {fmtDate(current.end_date)}</>}
            </div>
            {!current.end_date && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 bg-surface dark:bg-surface-2"
                onClick={() => {
                  update.mutate({ id: current.id, patch: { end_date: today } });
                  toast.success('Fase finalizada', { description: `${PHASE_META[current.phase].label} terminó hoy` });
                }}
              >
                Finalizar hoy
              </Button>
            )}
          </div>
        )}

        {sorted.length === 0 ? (
          <Empty title="Todavía no cargaste fases">
            Marcá tus etapas de volumen, definición o mantenimiento para verlas en el gráfico de peso.
          </Empty>
        ) : (
          <>
            <Label>Historial</Label>
            <div className="overflow-hidden rounded-2xl bg-surface-2">
              {sorted.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => onEdit(p)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3',
                    i > 0 && 'border-t border-line',
                  )}
                >
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: PHASE_META[p.phase].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{PHASE_META[p.phase].label}</div>
                    <div className="text-[13px] text-muted">
                      {fmtDate(p.start_date)} – {p.end_date ? fmtDate(p.end_date) : 'en curso'} · {durationLabel(p, today)}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </button>
              ))}
            </div>
          </>
        )}
      </SheetBody>
      <SheetFooter>
        <Button size="lg" block icon={<Plus className="size-5" />} onClick={onNew}>
          Nueva fase
        </Button>
      </SheetFooter>
    </>
  );
}

function PhaseForm({ phase, phases, onDone }: { phase: Phase | null; phases: Phase[]; onDone: () => void }) {
  const today = todayISO();
  const create = useCreatePhase();
  const update = useUpdatePhase();
  const del = useDeletePhase();
  const [kind, setKind] = useState<PhaseKind>(phase?.phase ?? 'definicion');
  const [start, setStart] = useState<ISODate>(phase?.start_date ?? today);
  const [end, setEnd] = useState<ISODate | null>(phase?.end_date ?? null);
  const [error, setError] = useState<string | null>(null);

  // otra fase abierta ("en curso") que quedaría pisada por una nueva fase en curso
  const open = !phase && !end ? (phases.find((p) => p.end_date == null && p.start_date < start) ?? null) : null;

  function save() {
    if (end && end < start) {
      setError('La fecha de fin no puede ser anterior al inicio');
      return;
    }
    if (phase) {
      update.mutate({ id: phase.id, patch: { phase: kind, start_date: start, end_date: end } });
      toast.success('Fase actualizada');
    } else {
      create.mutate({ phase: kind, start_date: start, end_date: end, closeOpen: open });
      toast.success('Fase creada');
    }
    onDone();
  }

  return (
    <>
      <SheetBody className="space-y-4 pt-2">
        <div>
          <Label>Tipo</Label>
          <div className="grid grid-cols-3 gap-2">
            {PHASES.map((p) => {
              const active = kind === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setKind(p.value)}
                  className={cn(
                    'flex h-[74px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors',
                    active ? 'border-transparent' : 'border-line bg-surface-2',
                  )}
                  style={
                    active ? { background: `color-mix(in srgb, ${p.color} 16%, transparent)`, borderColor: p.color } : undefined
                  }
                >
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-[14px] font-semibold">{p.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[12.5px] text-muted">{PHASE_META[kind].hint}</p>
        </div>

        <Field label="Inicio">
          <DateField value={start} onChange={(v) => v && setStart(v)} />
        </Field>
        <Field label="Fin" hint="Vacío = en curso">
          <DateField value={end} onChange={setEnd} min={start} clearable placeholder="En curso" />
        </Field>

        {open && (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-muted">
            La fase en curso ({PHASE_META[open.phase].label}) se va a cerrar el {fmtDate(addDays(start, -1))}.
          </p>
        )}
        {error && <p className="px-1 text-[14px] font-medium text-bad">{error}</p>}
      </SheetBody>
      <SheetFooter>
        {phase ? (
          <ConfirmButton
            size="lg"
            className="px-4"
            confirmLabel="¿Borrar?"
            onConfirm={() => {
              del.mutate(phase.id);
              toast('Fase borrada');
              onDone();
            }}
          >
            Borrar
          </ConfirmButton>
        ) : (
          <Button variant="secondary" size="lg" className="px-4" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={save}>
          Guardar
        </Button>
      </SheetFooter>
    </>
  );
}
