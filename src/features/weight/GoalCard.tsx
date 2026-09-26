import { useState, type ReactNode } from 'react';
import { Check, Flag, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAddGoal } from '@/api/hooks';
import { useResetKey } from '@/app/hooks';
import { addDays, diffDays, fmtDate, todayISO } from '@/lib/dates';
import { fmtDelta, fmtNum, parseDecimal } from '@/lib/format';
import type { Phase, WeightEntry, WeightGoal } from '@/lib/types';
import { avgEndingAt, goalProgress } from '@/lib/weight';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { ConfirmButton } from '@/ui/confirm-button';
import { Card, CardTitle, PhaseBadge, ProgressBar } from '@/ui/display';
import { DateField, Field, TextInput } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';
import { PhasesSheet } from './PhasesSheet';

export function GoalCard({
  entries,
  goals,
  goal,
  phases,
  phase,
}: {
  entries: WeightEntry[];
  goals: WeightGoal[];
  goal: WeightGoal | null;
  phases: Phase[];
  phase: Phase | null;
}) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [phasesOpen, setPhasesOpen] = useState(false);
  const today = todayISO();
  const gp = goal ? goalProgress(goal, entries, today) : null;
  const weeksIn = phase ? Math.floor(diffDays(today, phase.start_date) / 7) : 0;

  return (
    <Card>
      <CardTitle icon={<Target className="size-4" />}>Objetivo</CardTitle>

      <button
        onClick={() => setPhasesOpen(true)}
        className="-mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-surface-2"
      >
        <div className="min-w-0">
          <div className="text-[12.5px] text-muted">Fase actual</div>
          {phase ? (
            <div className="mt-1 flex items-center gap-2">
              <PhaseBadge phase={phase.phase} />
              <span className="truncate text-[13px] text-muted">
                {weeksIn > 0 ? `semana ${weeksIn + 1}` : 'empezó esta semana'} · desde {fmtDate(phase.start_date)}
              </span>
            </div>
          ) : (
            <div className="mt-0.5 text-[15px] font-medium">Sin fase definida</div>
          )}
        </div>
        <span className="shrink-0 text-[14px] font-semibold text-accent-ink">{phase ? 'Fases' : 'Definir'}</span>
      </button>

      <div className="my-3 h-px bg-line" />

      {goal && gp ? (
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12.5px] text-muted">Meta de peso</div>
              <div className="mt-0.5 font-display text-[30px] leading-none font-semibold tracking-tight tnum">
                {fmtNum(gp.target, 1)}
                <span className="ml-1 text-[16px] text-muted">kg</span>
              </div>
            </div>
            <div className="text-right text-[13px] text-muted">
              {goal.target_date ? (
                <>
                  para el <span className="font-semibold text-fg">{fmtDate(goal.target_date)}</span>
                  {gp.daysLeft != null && gp.daysLeft >= 0 && !gp.reached && (
                    <div>{gp.daysLeft < 14 ? `faltan ${gp.daysLeft} días` : `faltan ${Math.round(gp.daysLeft / 7)} semanas`}</div>
                  )}
                </>
              ) : (
                'sin fecha límite'
              )}
            </div>
          </div>

          <ProgressBar value={gp.pct} className="mt-3.5 h-2.5" />
          <div className="mt-2 flex justify-between text-[12.5px] text-muted tnum">
            <span>Inicio {fmtNum(gp.start, 1)}</span>
            <span className="font-semibold text-fg">{Math.round(gp.pct)}%</span>
            <span>Actual {fmtNum(gp.current, 1)}</span>
          </div>

          <div className="mt-3.5 space-y-2">
            {gp.reached ? (
              <Insight tone="good" icon={<Check className="size-4" />}>
                ¡Meta alcanzada! Tu promedio de 7 días ya está en el objetivo.
              </Insight>
            ) : (
              <>
                <Insight icon={<Flag className="size-4" />}>
                  Faltan <b className="text-fg">{fmtNum(Math.abs(gp.target - gp.current), 1)} kg</b>
                  {gp.requiredPerWeek != null && (
                    <>
                      {' '}
                      · ritmo necesario <b className="text-fg tnum">{fmtDelta(gp.requiredPerWeek, 2)} kg/sem</b>
                    </>
                  )}
                </Insight>
                {gp.trendPerWeek != null && (
                  <Insight
                    tone={gp.onTrack == null ? 'neutral' : gp.onTrack ? 'good' : 'bad'}
                    icon={gp.trendPerWeek < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                  >
                    Tendencia actual <b className="tnum">{fmtDelta(gp.trendPerWeek, 2)} kg/sem</b>
                    {gp.onTrack != null && (gp.onTrack ? ' · vas en camino' : ' · por debajo del ritmo')}
                    {gp.projectedDate && (
                      <span className="block text-muted">A este ritmo llegás el {fmtDate(gp.projectedDate)}</span>
                    )}
                  </Insight>
                )}
              </>
            )}
          </div>

          <Button variant="secondary" block className="mt-4" onClick={() => setGoalOpen(true)}>
            Editar meta
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">Sin meta de peso</div>
            <div className="text-[13px] text-muted">Definí un peso objetivo y, si querés, un plazo.</div>
          </div>
          <Button size="sm" onClick={() => setGoalOpen(true)}>
            Definir
          </Button>
        </div>
      )}

      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} goal={goal} goals={goals} entries={entries} />
      <PhasesSheet open={phasesOpen} onClose={() => setPhasesOpen(false)} phases={phases} />
    </Card>
  );
}

function Insight({
  children,
  icon,
  tone = 'neutral',
}: {
  children: ReactNode;
  icon: ReactNode;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <div className="flex gap-2.5 rounded-2xl bg-surface-2 px-3 py-2.5 text-[13.5px] leading-snug text-muted">
      <span className={cn('mt-px shrink-0', tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-accent-ink')}>
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GoalSheet({
  open,
  onClose,
  goal,
  goals,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  goal: WeightGoal | null;
  goals: WeightGoal[];
  entries: WeightEntry[];
}) {
  const key = useResetKey(open);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      bare
      title={goal ? 'Editar meta' : 'Nueva meta'}
      description="Cada cambio queda guardado en el historial"
    >
      <GoalForm key={key} goal={goal} goals={goals} entries={entries} onDone={onClose} />
    </Sheet>
  );
}

function GoalForm({
  goal,
  goals,
  entries,
  onDone,
}: {
  goal: WeightGoal | null;
  goals: WeightGoal[];
  entries: WeightEntry[];
  onDone: () => void;
}) {
  const add = useAddGoal();
  const today = todayISO();
  const [weight, setWeight] = useState(goal?.target_weight != null ? fmtNum(goal.target_weight, 1) : '');
  const [date, setDate] = useState<string | null>(goal?.target_date ?? null);
  const [error, setError] = useState<string | null>(null);

  const current = entries.length ? avgEndingAt(entries, entries[entries.length - 1].date) : null;
  const target = parseDecimal(weight);
  const weeks = date ? diffDays(date, today) / 7 : null;
  const perWeek = current != null && target != null && weeks && weeks > 0 ? (target - current) / weeks : null;
  const aggressive = perWeek != null && current != null && Math.abs(perWeek) > current * 0.01;

  const history = goals
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6);

  function save() {
    if (target == null || target < 20 || target > 400) {
      setError('Ingresá un peso válido');
      return;
    }
    add.mutate({ target_weight: Math.round(target * 100) / 100, target_date: date });
    toast.success('Meta guardada');
    onDone();
  }

  return (
    <>
      <SheetBody className="space-y-4 pt-2">
        <Field label="Peso objetivo (kg)">
          <TextInput
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value.replace(/[^0-9.,]/g, ''));
              setError(null);
            }}
            inputMode="decimal"
            placeholder="Ej. 75,0"
            className="font-display text-[20px] font-semibold tnum"
          />
        </Field>
        <Field label="Fecha límite" hint="Opcional">
          <DateField value={date} onChange={setDate} min={addDays(today, 1)} clearable placeholder="Sin fecha límite" />
        </Field>
        {error && <p className="px-1 text-[14px] font-medium text-bad">{error}</p>}

        {current != null && target != null && (
          <div className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] leading-snug text-muted">
            Desde tu promedio actual (<b className="text-fg tnum">{fmtNum(current, 1)} kg</b>) son{' '}
            <b className="text-fg tnum">{fmtDelta(target - current, 1)} kg</b>
            {perWeek != null && (
              <>
                {' '}
                en {Math.max(1, Math.round(weeks!))} semanas: <b className="text-fg tnum">{fmtDelta(perWeek, 2)} kg/sem</b>.
                {aggressive && (
                  <span className="mt-1 block text-warn">Es un ritmo exigente (más del 1% de tu peso por semana).</span>
                )}
              </>
            )}
          </div>
        )}

        {history.length > 0 && (
          <details className="group rounded-2xl bg-surface-2 px-4 py-3">
            <summary className="cursor-pointer list-none text-[13.5px] font-medium text-muted">
              Historial de metas <span className="text-faint">({goals.length})</span>
            </summary>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {history.map((g) => (
                <li key={g.id} className="flex justify-between gap-3 tnum">
                  <span className="text-muted">{fmtDate(g.created_at.slice(0, 10))}</span>
                  <span>
                    {g.target_weight == null ? 'Sin meta' : `${fmtNum(g.target_weight, 1)} kg`}
                    {g.target_date && <span className="text-muted"> · {fmtDate(g.target_date)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </SheetBody>
      <SheetFooter>
        {goal && (
          <ConfirmButton
            size="lg"
            className="px-4"
            confirmLabel="¿Quitar?"
            onConfirm={() => {
              add.mutate({ target_weight: null, target_date: null });
              toast('Meta quitada');
              onDone();
            }}
          >
            Quitar
          </ConfirmButton>
        )}
        <Button size="lg" className="flex-1" onClick={save}>
          Guardar meta
        </Button>
      </SheetFooter>
    </>
  );
}
