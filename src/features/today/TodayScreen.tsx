import { useMemo } from 'react';
import { BedDouble, Check, ChevronRight, Dumbbell, Flame, Scale, Settings, Target } from 'lucide-react';
import { useEntries, useGoals, usePhases, useTrainingIndex } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { sheets } from '@/app/sheets';
import { DAY_NAMES } from '@/lib/constants';
import { addDays, dayOfWeek, fmtLong, fmtRelative, mondayOf, todayISO } from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import {
  assignWeek,
  dayPlan,
  defaultAlternative,
  isTrainingDay,
  pendingDays,
  planMuscles,
  slotDoneOn,
  slotLabel,
  weekStreak,
} from '@/lib/training';
import { activeGoal, avgEndingAt, currentPhase, goalProgress, loggingStreak, weeklyAverages } from '@/lib/weight';
import { Button, IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Card, Delta, MuscleBadge, PhaseBadge, ProgressBar, ProgressRing, Sparkline } from '@/ui/display';
import { MigrationNotice, SlotNumber, useRoutineData } from '../training/common';

export function TodayScreen() {
  const today = todayISO();
  return (
    <Page
      title="Hoy"
      eyebrow={fmtLong(today)}
      actions={
        <IconButton label="Ajustes" onClick={sheets.openSettings}>
          <Settings className="size-[19px]" />
        </IconButton>
      }
    >
      <div className="space-y-4">
        <WeightTodayCard today={today} />
        <WorkoutTodayCard today={today} />
        <div className="grid grid-cols-2 gap-3">
          <WeeklyWeightTile />
          <TrainingWeekTile today={today} />
        </div>
        <GoalTile today={today} />
      </div>
    </Page>
  );
}

function WeightTodayCard({ today }: { today: string }) {
  const entries = useEntries();
  const todayEntry = entries.find((e) => e.date === today) ?? null;
  const prev = [...entries].reverse().find((e) => e.date < today) ?? null;
  const streak = loggingStreak(entries, today);

  if (todayEntry) {
    return (
      <Card onClick={() => sheets.openWeight(today)}>
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-muted">Peso de hoy</div>
            <div className="font-display text-[34px] leading-none font-semibold tracking-tight tnum">
              {fmtNum(todayEntry.weight, 1)}
              <span className="ml-1 text-[16px] text-muted">kg</span>
            </div>
          </div>
          <div className="text-right text-[13px]">
            {prev && (
              <>
                <Delta value={todayEntry.weight - prev.weight} className="text-[15px]" />
                <div className="text-muted">vs {fmtRelative(prev.date)}</div>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          <Scale className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold">Registrá tu peso</div>
          <div className="text-[13px] text-muted">
            {prev ? `Último: ${fmtNum(prev.weight, 1)} kg · ${fmtRelative(prev.date)}` : 'En ayunas, apenas te levantás'}
          </div>
        </div>
      </div>
      <Button block size="lg" className="mt-4" onClick={() => sheets.openWeight(today)}>
        Registrar peso de hoy
      </Button>
      {streak > 1 && (
        <p className="mt-2.5 text-center text-[12.5px] text-muted">
          <Flame className="mr-1 inline size-3.5 -translate-y-px text-warn" />
          Llevás {streak} días seguidos registrando
        </p>
      )}
    </Card>
  );
}

function WorkoutTodayCard({ today }: { today: string }) {
  const { query, data, active, exById, missingSchema } = useRoutineData();
  const index = useTrainingIndex();
  const dow = dayOfWeek(today);

  if (missingSchema) return <MigrationNotice />;
  if (query.isPending && !data) return <Card className="h-40 animate-pulse" />;

  if (!active) {
    return (
      <Card onClick={() => navigate('/entreno')}>
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <Dumbbell className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{data?.routines.length ? 'Elegí tu rutina activa' : 'Armá tu rutina'}</div>
            <div className="text-[13px] text-muted">Para ver acá qué te toca entrenar cada día</div>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </div>
      </Card>
    );
  }

  const assignment = assignWeek(data, active.id, exById, index, mondayOf(today), today);
  const doneToday = assignment.dayOnDate.get(today) ?? null;
  const ownDoneOn = assignment.doneOn.get(dow) ?? null;
  const pending = doneToday ? [] : pendingDays(assignment, today);
  // lo que se muestra hoy: lo que ya empezaste hoy (aunque sea de otro día), o lo que toca hoy si
  // todavía no lo hiciste antes
  const shownDow = doneToday ?? (ownDoneOn ? null : dow);
  const plan = dayPlan(data, active.id, shownDow ?? dow, exById);

  const banner =
    pending.length > 0 ? (
      <PendingBanner
        days={pending.map((d) => ({ dow: d, name: dayPlan(data, active.id, d, exById).name }))}
        todayPlanName={isTrainingDay(plan) && shownDow ? plan.name || DAY_NAMES[dow - 1] : null}
      />
    ) : null;

  if (shownDow == null || !isTrainingDay(plan)) {
    // próximo día con entrenamiento
    let next: { dow: number; name: string } | null = null;
    for (let i = 1; i <= 7; i++) {
      const d = ((dow - 1 + i) % 7) + 1;
      const p = dayPlan(data, active.id, d, exById);
      if (isTrainingDay(p)) {
        next = { dow: d, name: p.name };
        break;
      }
    }
    return (
      <>
        {banner}
        <Card>
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              {ownDoneOn ? <Check className="size-6 text-accent-ink" strokeWidth={3} /> : <BedDouble className="size-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-muted">{active.name}</div>
              <div className="text-[18px] font-semibold">
                {ownDoneOn
                  ? `${plan.name || 'El entrenamiento de hoy'} ya lo hiciste el ${DAY_NAMES[dayOfWeek(ownDoneOn) - 1].toLowerCase()}`
                  : plan.isRest
                    ? 'Hoy es día de descanso'
                    : 'Hoy no hay entrenamiento'}
              </div>
              {next && (
                <div className="text-[13px] text-muted">
                  Próximo: {DAY_NAMES[next.dow - 1]}
                  {next.name && ` · ${next.name}`}
                </div>
              )}
            </div>
          </div>
        </Card>
      </>
    );
  }

  const done = plan.slots.filter((s) => slotDoneOn(s, index, today)).length;
  const total = plan.slots.length;
  const complete = done === total;

  return (
    <>
      {banner}
      <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
        <div className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_100%_0%,var(--accent-soft),transparent_60%)] p-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-muted">
                Entrenamiento de hoy · {shownDow !== dow ? `el del ${DAY_NAMES[shownDow - 1].toLowerCase()}` : active.name}
              </div>
              <div className="mt-0.5 truncate text-[26px] leading-tight font-bold tracking-tight">
                {plan.name || DAY_NAMES[shownDow - 1]}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {planMuscles(plan.slots).map((m) => (
                  <MuscleBadge key={m} group={m} className="bg-surface-2" />
                ))}
              </div>
            </div>
            <ProgressRing value={done / total} size={60} stroke={6}>
              {complete ? (
                <Check className="size-6 text-accent-ink" strokeWidth={3} />
              ) : (
                <span className="text-[14px] font-bold tnum">
                  {done}/{total}
                </span>
              )}
            </ProgressRing>
          </div>
        </div>
        <div className="px-4 pb-1">
          {plan.slots.map((slot, i) => {
            const alt = defaultAlternative(slot, index);
            const item = slot.items[alt];
            const isDone = slotDoneOn(slot, index, today);
            return (
              <button
                key={slot.orderIndex}
                onClick={() => sheets.openSets(item.exercise_id, { target: { sets: item.sets_target, reps: item.reps_target } })}
                className={cn('flex w-full items-center gap-3 py-2.5 text-left', i > 0 && 'border-t border-line')}
              >
                <SlotNumber label={slotLabel(i + 1, alt, slot.items.length)} done={isDone} className="size-8 text-[13px]" />
                <span className={cn('min-w-0 flex-1 truncate text-[15px]', isDone ? 'text-muted' : 'font-medium')}>
                  {item.exercise.name}
                  {slot.items.length > 1 && <span className="text-faint"> · +{slot.items.length - 1} alt.</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            );
          })}
        </div>
        <div className="p-4 pt-2">
          <Button
            block
            size="lg"
            variant={complete ? 'secondary' : 'primary'}
            onClick={() => navigate(shownDow === dow ? '/entreno' : `/entreno?dia=${shownDow}`)}
          >
            {complete ? '¡Entrenamiento completo! Ver detalle' : done ? 'Seguir entrenando' : 'Empezar entrenamiento'}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Días de la rutina que quedaron sin hacer esta semana: se pueden hacer hoy y quedan como hechos. */
function PendingBanner({ days, todayPlanName }: { days: { dow: number; name: string }[]; todayPlanName: string | null }) {
  const first = days[0];
  const label = (d: { dow: number; name: string }) =>
    d.name ? `${d.name} (${DAY_NAMES[d.dow - 1].toLowerCase()})` : DAY_NAMES[d.dow - 1];
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-warn/30 bg-warn/10 p-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">
          {days.length === 1 ? 'Te quedó pendiente' : `Te quedaron ${days.length} pendientes`}
        </div>
        <div className="text-[13px] text-muted">
          {days.map(label).join(', ')}
          {todayPlanName && ` · lo de hoy (${todayPlanName}) se corre`}
        </div>
      </div>
      <Button size="sm" onClick={() => navigate(`/entreno?dia=${first.dow}`)}>
        Hacerlo hoy
      </Button>
    </div>
  );
}

function WeeklyWeightTile() {
  const entries = useEntries();
  const weeks = useMemo(() => weeklyAverages(entries).slice(-8), [entries]);
  const last = entries.length ? entries[entries.length - 1] : null;
  const avg = last ? avgEndingAt(entries, last.date) : null;
  const prevAvg = last ? avgEndingAt(entries, addDays(last.date, -7)) : null;

  return (
    <Card onClick={() => navigate('/peso')} className="flex flex-col justify-between">
      <div className="text-[12.5px] font-medium text-muted">Promedio 7 días</div>
      <div className="mt-1 font-display text-[26px] leading-none font-semibold tnum">
        {avg != null ? fmtNum(avg, 1) : '–'}
        <span className="ml-0.5 text-[13px] text-muted">kg</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[12.5px]">
          {avg != null && prevAvg != null ? <Delta value={avg - prevAvg} /> : <span className="text-faint">—</span>}
        </span>
        <Sparkline values={weeks.map((w) => w.avg)} width={60} height={24} />
      </div>
    </Card>
  );
}

function TrainingWeekTile({ today }: { today: string }) {
  const index = useTrainingIndex();
  const { data, active, exById } = useRoutineData();
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const trained = days.filter((d) => index.byDate.has(d)).length;
  const planned = active ? days.filter((_, i) => isTrainingDay(dayPlan(data, active.id, i + 1, exById))).length : null;
  const streak = weekStreak(index, today);

  return (
    <Card onClick={() => navigate('/progreso')} className="flex flex-col justify-between">
      <div className="text-[12.5px] font-medium text-muted">Esta semana</div>
      <div className="mt-1 font-display text-[26px] leading-none font-semibold tnum">
        {trained}
        {planned ? <span className="text-[16px] text-muted">/{planned}</span> : null}
        <span className="ml-1 text-[13px] text-muted">entrenos</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[12.5px] text-muted">
          {streak > 0 ? (
            <>
              <Flame className="mr-0.5 inline size-3.5 -translate-y-px text-warn" />
              {streak} sem. de racha
            </>
          ) : (
            'Sin racha'
          )}
        </span>
        <div className="flex gap-[3px]">
          {days.map((d) => (
            <span
              key={d}
              className={cn(
                'h-5 w-[5px] rounded-full',
                index.byDate.has(d) ? 'bg-accent-ink' : d <= today ? 'bg-surface-3' : 'bg-surface-2',
              )}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function GoalTile({ today }: { today: string }) {
  const entries = useEntries();
  const goal = activeGoal(useGoals());
  const phase = currentPhase(usePhases(), today);
  const gp = goal ? goalProgress(goal, entries, today) : null;
  if (!gp && !phase) return null;

  return (
    <Card onClick={() => navigate('/peso')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          <Target className="size-4" />
          Objetivo
        </div>
        {phase && <PhaseBadge phase={phase.phase} />}
      </div>
      {gp ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div className="text-[15px]">
              Meta <b className="tnum">{fmtNum(gp.target, 1)} kg</b>
              {goal?.target_date && <span className="text-muted"> · {fmtRelative(goal.target_date)}</span>}
            </div>
            <span className="text-[14px] font-semibold tnum">{Math.round(gp.pct)}%</span>
          </div>
          <ProgressBar value={gp.pct} className="mt-2" />
          <div className="mt-2 text-[12.5px] text-muted">
            {gp.reached ? '¡Meta alcanzada!' : `Faltan ${fmtNum(Math.abs(gp.target - gp.current), 1)} kg`}
            {gp.onTrack != null && !gp.reached && (
              <span className={gp.onTrack ? 'text-good' : 'text-bad'}>
                {' '}
                · {gp.onTrack ? 'vas en camino' : 'por debajo del ritmo'}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">Definí una meta de peso para seguir tu avance.</p>
      )}
    </Card>
  );
}
