import { useMemo, useState } from 'react';
import { BedDouble, Check, ChevronDown, Library, Pencil, Plus } from 'lucide-react';
import { useTrainingIndex } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate, useSearchParam } from '@/app/router';
import { DAY_LETTER, DAY_NAMES } from '@/lib/constants';
import { addDays, dayOfWeek, fromISO, mondayOf, todayISO } from '@/lib/dates';
import { dayPlan, isTrainingDay, planMuscles, slotDoneOn } from '@/lib/training';
import { Button, IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Card, Empty, MuscleBadge, ProgressRing, Skeleton } from '@/ui/display';
import { MigrationNotice, useRoutineData } from './common';
import { NewRoutineSheet, RoutineSwitcherSheet } from './RoutineSheets';
import { SlotCard } from './SlotCard';

export function TrainingScreen() {
  const { query, data, active, exById, missingSchema } = useRoutineData();
  const index = useTrainingIndex();
  const today = todayISO();
  const todayDow = dayOfWeek(today);
  const param = Number(useSearchParam('dia'));
  const selected = param >= 1 && param <= 7 ? param : todayDow;
  const monday = mondayOf(today);
  const selectedDate = addDays(monday, selected - 1);
  const [switcher, setSwitcher] = useState(false);
  const [creating, setCreating] = useState(false);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const dow = i + 1;
        const date = addDays(monday, i);
        const plan = dayPlan(data, active?.id, dow, exById);
        const trained = !!index.byDate.get(date)?.length;
        return { dow, date, plan, trained };
      }),
    [data, active?.id, exById, index, monday],
  );

  const plan = week[selected - 1].plan;
  const doneCount = plan.slots.filter((s) => slotDoneOn(s, index, selectedDate)).length;
  const selectDay = (dow: number) => navigate(dow === todayDow ? '/entreno' : `/entreno?dia=${dow}`, { replace: true });

  const actions = active ? (
    <>
      <IconButton label="Ejercicios" onClick={() => navigate('/entreno/ejercicios')}>
        <Library className="size-[18px]" />
      </IconButton>
      <IconButton label="Editar rutina" onClick={() => navigate(`/entreno/rutinas/${active.id}?dia=${selected}`)}>
        <Pencil className="size-[17px]" />
      </IconButton>
    </>
  ) : (
    <IconButton label="Ejercicios" onClick={() => navigate('/entreno/ejercicios')}>
      <Library className="size-[18px]" />
    </IconButton>
  );

  let body;
  if (missingSchema) body = <MigrationNotice />;
  else if (query.isPending && !data) {
    body = (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-[20px]" />
        <Skeleton className="h-28 rounded-[22px]" />
        <Skeleton className="h-28 rounded-[22px]" />
      </div>
    );
  } else if (!data?.routines.length) {
    body = (
      <Card>
        <Empty
          icon={<Plus className="size-6" />}
          title="Armá tu primera rutina"
          action={<Button onClick={() => setCreating(true)}>Crear rutina</Button>}
        >
          Organizá tus entrenamientos por día de la semana y registrá tus series en cada sesión.
        </Empty>
      </Card>
    );
  } else if (!active) {
    body = (
      <Card>
        <Empty title="No hay ninguna rutina activa" action={<Button onClick={() => setSwitcher(true)}>Elegir rutina</Button>}>
          Elegí cuál de tus rutinas estás siguiendo ahora.
        </Empty>
      </Card>
    );
  } else {
    body = (
      <div className="space-y-4">
        <WeekStrip week={week} selected={selected} today={today} onSelect={selectDay} />

        <div className="flex items-center gap-3 px-1">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-muted">
              {DAY_NAMES[selected - 1]}
              {selected === todayDow ? ' · hoy' : ''}
            </div>
            <h2 className="truncate text-[22px] leading-tight font-bold tracking-tight">
              {plan.isRest ? 'Descanso' : plan.name || (plan.slots.length ? 'Entrenamiento' : 'Sin plan')}
            </h2>
            {!plan.isRest && plan.slots.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {planMuscles(plan.slots).map((m) => (
                  <MuscleBadge key={m} group={m} />
                ))}
              </div>
            )}
          </div>
          {isTrainingDay(plan) && selectedDate <= today && (
            <ProgressRing value={doneCount / plan.slots.length} size={54} stroke={5}>
              {doneCount === plan.slots.length ? (
                <Check className="size-5 text-accent-ink" strokeWidth={3} />
              ) : (
                <span className="text-[13px] font-bold tnum">
                  {doneCount}/{plan.slots.length}
                </span>
              )}
            </ProgressRing>
          )}
        </div>

        {plan.isRest ? (
          <Card>
            <Empty icon={<BedDouble className="size-6" />} title="Día de descanso">
              La recuperación también es parte del entrenamiento.
            </Empty>
          </Card>
        ) : plan.slots.length === 0 ? (
          <Card>
            <Empty
              title="Este día no tiene ejercicios"
              action={
                <Button variant="secondary" onClick={() => navigate(`/entreno/rutinas/${active.id}?dia=${selected}`)}>
                  Agregar ejercicios
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {plan.slots.map((slot, i) => (
              <SlotCard
                key={`${active.id}-${selected}-${slot.orderIndex}`}
                slotKey={`${active.id}-${selected}-${slot.orderIndex}`}
                slot={slot}
                position={i + 1}
                index={index}
                statusDate={selectedDate <= today ? selectedDate : today}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Page
      title="Entreno"
      eyebrow={
        active ? (
          <button
            onClick={() => setSwitcher(true)}
            className="-my-1 inline-flex items-center gap-1 py-1 text-accent-ink active:opacity-60"
          >
            {active.name}
            <ChevronDown className="size-4" strokeWidth={2.5} />
          </button>
        ) : undefined
      }
      actions={actions}
    >
      {body}
      <RoutineSwitcherSheet open={switcher} onClose={() => setSwitcher(false)} onCreate={() => setCreating(true)} />
      <NewRoutineSheet open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}

function WeekStrip({
  week,
  selected,
  today,
  onSelect,
}: {
  week: { dow: number; date: string; plan: ReturnType<typeof dayPlan>; trained: boolean }[];
  selected: number;
  today: string;
  onSelect: (dow: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {week.map((d) => {
        const isSel = d.dow === selected;
        const isToday = d.date === today;
        const training = isTrainingDay(d.plan);
        const past = d.date < today;
        return (
          <button
            key={d.dow}
            onClick={() => onSelect(d.dow)}
            className={cn(
              'flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border transition-colors active:scale-95',
              isSel ? 'border-transparent bg-fg text-bg' : 'border-line bg-surface',
            )}
          >
            <span className={cn('text-[11px] font-semibold', isSel ? 'text-bg/70' : isToday ? 'text-accent-ink' : 'text-muted')}>
              {DAY_LETTER[d.dow - 1]}
            </span>
            <span className="text-[17px] leading-none font-bold tnum">{fromISO(d.date).getDate()}</span>
            <span className="flex h-1.5 items-center">
              {d.trained ? (
                <span className={cn('size-1.5 rounded-full', isSel ? 'bg-bg' : 'bg-accent-ink')} />
              ) : d.plan.isRest ? (
                <span className={cn('h-[2px] w-2 rounded-full', isSel ? 'bg-bg/40' : 'bg-surface-3')} />
              ) : training ? (
                <span
                  className={cn('size-1.5 rounded-full border', isSel ? 'border-bg/50' : past ? 'border-bad/60' : 'border-faint')}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
