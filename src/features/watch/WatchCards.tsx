import { useMemo } from 'react';
import { Activity, Bike, Dumbbell, Flame, Footprints, PersonStanding, Timer, Watch, Waves } from 'lucide-react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWatchActivities, useWatchDays } from '@/api/hooks';
import { useCssColors } from '@/app/theme';
import { DAY_LETTER } from '@/lib/constants';
import { addDays, dayOfWeek, fmtRelative } from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import type { WatchActivity } from '@/lib/types';
import {
  activityDate,
  activityTime,
  avgSteps,
  dayWindow,
  fmtDistance,
  fmtDuration,
  fmtPace,
  sportKind,
  sportLabel,
} from '@/lib/watch';
import { Card, CardTitle, ProgressRing, Stat } from '@/ui/display';

// Lo que mide el reloj Garmin. Lo sube la app del reloj cada vez que se abre (no hay sincronización
// en segundo plano), así que "hoy" puede estar atrasado: se muestra cuándo se actualizó.

const int = (n: number | null | undefined) => (n == null ? '—' : fmtNum(n, 0));

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Hoy: pasos (con la meta), calorías, minutos activos, distancia y las actividades del día. */
export function WatchTodayCard({ today }: { today: string }) {
  const days = useWatchDays();
  const activities = useWatchActivities();
  const day = days.find((d) => d.date === today) ?? null;
  const todays = activities.filter((a) => activityDate(a) === today);
  if (!day && !todays.length) return null;

  const goal = day?.step_goal ?? null;
  return (
    <Card>
      <CardTitle
        icon={<Watch className="size-4" />}
        action={day && <span className="text-[12.5px] text-muted normal-case">actualizado {hhmm(day.updated_at)}</span>}
      >
        Reloj
      </CardTitle>
      {day && (
        <>
          <div className="flex items-center gap-4">
            <ProgressRing value={goal && day.steps != null ? day.steps / goal : 0} size={60} stroke={6}>
              <Footprints className="size-5 text-accent-ink" />
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[30px] leading-none font-semibold tracking-tight tnum">
                {int(day.steps)}
                <span className="ml-1.5 text-[15px] font-medium text-muted">pasos</span>
              </div>
              {goal != null && (
                <div className="mt-1 text-[13px] text-muted">
                  {day.steps != null && day.steps >= goal ? 'Meta cumplida' : `Meta ${int(goal)}`}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <Stat label="Calorías" value={int(day.calories)} sub={<span className="text-muted">kcal</span>} />
            <Stat label="Activo" value={int(day.active_minutes)} sub={<span className="text-muted">min</span>} />
            <Stat
              label="Distancia"
              value={day.distance_m != null ? fmtNum(day.distance_m / 1000, 1) : '—'}
              sub={<span className="text-muted">km</span>}
            />
          </div>
        </>
      )}
      {todays.length > 0 && (
        <div className={day ? 'mt-3.5 space-y-2 border-t border-line pt-3' : 'space-y-2'}>
          {todays.map((a) => (
            <ActivityRow key={a.start_time} a={a} showDate={false} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Progreso: pasos de las últimas 2 semanas. */
export function WatchStepsCard({ today }: { today: string }) {
  const days = useWatchDays();
  const c = useCssColors(['accent-ink', 'muted', 'surface-3', 'faint'] as const);
  const window = useMemo(() => dayWindow(days, addDays(today, -13), today), [days, today]);
  if (!days.length) return null;
  const avg = avgSteps(window, today);
  const goal = [...days].reverse().find((d) => d.step_goal != null)?.step_goal ?? null;
  const data = window.map((w) => ({ date: w.date, steps: w.day?.steps ?? 0, has: w.day?.steps != null }));

  return (
    <Card>
      <CardTitle
        icon={<Footprints className="size-4" />}
        action={avg != null && <span className="text-[12.5px] text-muted normal-case">prom. {int(Math.round(avg))}/día</span>}
      >
        Pasos · 2 semanas
      </CardTitle>
      <div className="-mx-2 h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => DAY_LETTER[dayOfWeek(d) - 1]}
              tick={{ fill: c.muted, fontSize: 10.5 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={6}
            />
            <YAxis
              tick={{ fill: c.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            {goal != null && <ReferenceLine y={goal} stroke={c.faint} strokeDasharray="4 4" />}
            <Tooltip
              cursor={{ fill: c['surface-3'], opacity: 0.4 }}
              isAnimationActive={false}
              content={(p) => {
                const d = (p.payload?.[0] as { payload?: (typeof data)[number] } | undefined)?.payload;
                if (!p.active || !d) return null;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
                    <div className="text-muted">{fmtRelative(d.date)}</div>
                    <div className="font-semibold">{d.has ? `${int(d.steps)} pasos` : 'Sin datos del reloj'}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="steps" radius={[6, 6, 2, 2]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.date}
                  fill={c['accent-ink']}
                  fillOpacity={d.date === today ? 1 : goal != null && d.steps >= goal ? 0.75 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Progreso: las últimas actividades grabadas en el reloj (cardio, fuerza…). */
export function WatchActivitiesCard() {
  const activities = useWatchActivities();
  if (!activities.length) return null;
  return (
    <Card>
      <CardTitle icon={<Activity className="size-4" />}>Actividades del reloj</CardTitle>
      <div className="space-y-2.5">
        {activities.slice(0, 8).map((a) => (
          <ActivityRow key={a.start_time} a={a} showDate />
        ))}
      </div>
    </Card>
  );
}

const ICON = {
  run: Activity,
  bike: Bike,
  swim: Waves,
  walk: PersonStanding,
  strength: Dumbbell,
  other: Flame,
} as const;

function ActivityRow({ a, showDate }: { a: WatchActivity; showDate: boolean }) {
  const Icon = ICON[sportKind(a.sport)];
  const date = activityDate(a);
  const pace = sportKind(a.sport) === 'run' || sportKind(a.sport) === 'walk' ? fmtPace(a) : null;
  const distance = fmtDistance(a.distance_m);
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{sportLabel(a.sport)}</div>
        <div className="truncate text-[12.5px] text-muted">
          {showDate ? `${fmtRelative(date)} · ` : ''}
          {activityTime(a)}
          {distance && ` · ${distance}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1 text-[14px] font-semibold tnum">
          <Timer className="size-3.5 text-muted" />
          {fmtDuration(a.duration_s)}
        </div>
        {pace && <div className="text-[12px] text-muted tnum">{pace}</div>}
      </div>
    </div>
  );
}
