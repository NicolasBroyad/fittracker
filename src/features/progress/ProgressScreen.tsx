import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Flame, Trophy } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExerciseMap, useLogsQuery, useRoutinesQuery, useTrainingIndex } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { sheets } from '@/app/sheets';
import { useCssColors } from '@/app/theme';
import { DAY_LETTER, MUSCLE_GROUPS, MUSCLE_LABEL } from '@/lib/constants';
import { addDays, fmtDate, fmtDayMonth, fmtMonthShort, fmtWeekRange, fromISO, mondayOf, todayISO } from '@/lib/dates';
import { fmtNum, fmtPct, fmtVolume } from '@/lib/format';
import {
  activeRoutine,
  dayPlan,
  isTrainingDay,
  recentPRs,
  sessionsOf,
  weekStats,
  weeklySeries,
  weekStreak,
  type TrainingIndex,
} from '@/lib/training';
import type { Exercise } from '@/lib/types';
import { IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Card, CardTitle, Delta, Empty, Skeleton, Sparkline, Stat } from '@/ui/display';

export function ProgressScreen() {
  const logsQuery = useLogsQuery();
  const index = useTrainingIndex();
  const exById = useExerciseMap();
  const routines = useRoutinesQuery().data;
  const today = todayISO();

  const planned = useMemo(() => {
    const active = activeRoutine(routines);
    if (!active) return null;
    return Array.from({ length: 7 }, (_, i) => dayPlan(routines, active.id, i + 1, exById)).filter(isTrainingDay).length;
  }, [routines, exById]);

  if (logsQuery.isPending && !index.dates.length) {
    return (
      <Page title="Progreso">
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-[24px]" />
          <Skeleton className="h-48 rounded-[24px]" />
        </div>
      </Page>
    );
  }

  if (!index.dates.length) {
    return (
      <Page title="Progreso">
        <Card>
          <Empty icon={<Dumbbell className="size-6" />} title="Todavía no hay entrenamientos">
            Cuando registres series vas a ver acá tu constancia, volumen por grupo muscular y récords.
          </Empty>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Progreso">
      <div className="space-y-4">
        <ThisWeekCard index={index} exById={exById} planned={planned} today={today} />
        <Heatmap index={index} today={today} />
        <MuscleVolumeCard index={index} exById={exById} today={today} />
        <WeeklySetsCard index={index} exById={exById} today={today} />
        <PRsCard index={index} exById={exById} />
        <TopExercisesCard index={index} exById={exById} today={today} />
      </div>
    </Page>
  );
}

function ThisWeekCard({
  index,
  exById,
  planned,
  today,
}: {
  index: TrainingIndex;
  exById: Map<string, Exercise>;
  planned: number | null;
  today: string;
}) {
  const monday = mondayOf(today);
  const cur = weekStats(index, exById, monday);
  const prev = weekStats(index, exById, addDays(monday, -7));
  const streak = weekStreak(index, today);
  const month = today.slice(0, 7);
  const monthSessions = index.dates.filter((d) => d.startsWith(month)).length;

  return (
    <Card>
      <CardTitle action={<span className="text-[12.5px] text-muted normal-case">{fmtWeekRange(monday)}</span>}>
        Esta semana
      </CardTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Entrenos"
          value={
            <>
              {cur.sessions}
              {planned ? <span className="text-[15px] text-muted">/{planned}</span> : null}
            </>
          }
          sub={<Delta value={cur.sessions - prev.sessions} decimals={0} goodDirection={1} />}
        />
        <Stat label="Series" value={cur.sets} sub={<Delta value={cur.sets - prev.sets} decimals={0} goodDirection={1} />} />
        <Stat
          label="Volumen"
          value={fmtVolume(cur.volume)}
          sub={
            prev.volume > 0 ? (
              <span className={cn('font-medium', cur.volume >= prev.volume ? 'text-good' : 'text-muted')}>
                {fmtPct(((cur.volume - prev.volume) / prev.volume) * 100)}
              </span>
            ) : (
              <span className="text-faint">—</span>
            )
          }
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-3 py-2.5">
          <Flame className={cn('size-5 shrink-0', streak > 0 ? 'text-warn' : 'text-faint')} />
          <div className="min-w-0">
            <div className="text-[15px] leading-tight font-semibold tnum">
              {streak} {streak === 1 ? 'semana' : 'semanas'}
            </div>
            <div className="truncate text-[11.5px] text-muted">de racha</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-3 py-2.5">
          <CalendarDays className="size-5 shrink-0 text-accent-ink" />
          <div className="min-w-0">
            <div className="text-[15px] leading-tight font-semibold tnum">{monthSessions} días</div>
            <div className="truncate text-[11.5px] text-muted">entrenados este mes</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const WEEKS = 17;

function Heatmap({ index, today }: { index: TrainingIndex; today: string }) {
  const start = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const weeks = Array.from({ length: WEEKS }, (_, w) => addDays(start, w * 7));
  const level = (sets: number) => (sets === 0 ? 0 : sets <= 6 ? 1 : sets <= 12 ? 2 : sets <= 20 ? 3 : 4);
  const opacity = [0, 0.3, 0.55, 0.8, 1];
  const total = weeks
    .flatMap((m) => Array.from({ length: 7 }, (_, i) => addDays(m, i)))
    .filter((d) => index.byDate.has(d)).length;

  return (
    <Card>
      <CardTitle action={<span className="text-[12.5px] text-muted normal-case">{total} días en 4 meses</span>}>
        Constancia
      </CardTitle>
      <div className="flex gap-[3px]">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[18px] pr-1">
          {DAY_LETTER.map((l, i) => (
            <div key={i} className="flex aspect-square w-3 items-center text-[9.5px] font-semibold text-faint">
              {i % 2 === 0 ? l : ''}
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
          {weeks.map((m, w) => {
            const newMonth = w === 0 || fromISO(m).getMonth() !== fromISO(weeks[w - 1]).getMonth();
            return (
              <div key={m} className="flex flex-col gap-[3px]">
                <div className="h-[15px] overflow-visible text-[9.5px] font-semibold whitespace-nowrap text-faint">
                  {newMonth ? fmtMonthShort(m) : ''}
                </div>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(m, i);
                  const sets = (index.byDate.get(d) ?? []).reduce((a, s) => a + s.setCount, 0);
                  const lv = level(sets);
                  const future = d > today;
                  return (
                    <button
                      key={d}
                      disabled={!sets}
                      onClick={() => sheets.openDay(d)}
                      title={sets ? `${fmtDate(d)}: ${sets} series` : fmtDate(d)}
                      className={cn(
                        'relative aspect-square w-full overflow-hidden rounded-[4px]',
                        future ? 'bg-transparent' : 'bg-surface-2',
                        d === today && 'ring-1 ring-fg/40',
                      )}
                    >
                      {lv > 0 && <span className="absolute inset-0 bg-accent-ink" style={{ opacity: opacity[lv] }} />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        Menos
        {opacity.map((o, i) => (
          <span key={i} className="relative size-2.5 overflow-hidden rounded-[3px] bg-surface-2">
            {o > 0 && <span className="absolute inset-0 bg-accent-ink" style={{ opacity: o }} />}
          </span>
        ))}
        Más series
      </div>
    </Card>
  );
}

function MuscleVolumeCard({ index, exById, today }: { index: TrainingIndex; exById: Map<string, Exercise>; today: string }) {
  const thisMonday = mondayOf(today);
  const [monday, setMonday] = useState(thisMonday);
  const cur = weekStats(index, exById, monday);
  const prev = weekStats(index, exById, addDays(monday, -7));
  const groups = [...MUSCLE_GROUPS.map((m) => m.value), 'Otro' as const].filter(
    (g) => cur.byMuscle.has(g) || prev.byMuscle.has(g),
  );
  const max = Math.max(1, ...groups.map((g) => cur.byMuscle.get(g) ?? 0));

  return (
    <Card>
      <CardTitle
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Semana anterior" size="sm" onClick={() => setMonday((m) => addDays(m, -7))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton
              label="Semana siguiente"
              size="sm"
              disabled={monday >= thisMonday}
              onClick={() => setMonday((m) => addDays(m, 7))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        }
      >
        Series por músculo
      </CardTitle>
      <div className="-mt-1 mb-3 text-[13px] text-muted">
        {monday === thisMonday ? 'Esta semana' : `Semana del ${fmtWeekRange(monday)}`} · {cur.sets} series
      </div>
      {groups.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted">Sin series esta semana</p>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const n = cur.byMuscle.get(g) ?? 0;
            const p = prev.byMuscle.get(g) ?? 0;
            return (
              <div key={g} className="flex items-center gap-3">
                <span className="w-[82px] shrink-0 truncate text-[13.5px]">{g === 'Otro' ? 'Otros' : MUSCLE_LABEL[g]}</span>
                <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-2">
                  {n > 0 && (
                    <div
                      className="flex h-full items-center justify-end rounded-lg bg-accent-ink/85 pr-2 text-[12px] font-bold text-bg transition-[width] duration-500"
                      style={{ width: `${Math.max(10, (n / max) * 100)}%` }}
                    >
                      {n}
                    </div>
                  )}
                </div>
                <span className="w-9 shrink-0 text-right text-[12px]">
                  <Delta value={n - p} decimals={0} goodDirection={0} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function WeeklySetsCard({ index, exById, today }: { index: TrainingIndex; exById: Map<string, Exercise>; today: string }) {
  const c = useCssColors(['accent-ink', 'muted', 'surface-3', 'faint'] as const);
  const series = useMemo(() => weeklySeries(index, exById, 12, today), [index, exById, today]);
  const data = series.map((w) => ({ week: w.monday, sets: w.sets, sessions: w.sessions, volume: w.volume }));
  const done = data.slice(0, -1).filter((d) => d.sets > 0);
  const avg = done.length ? done.reduce((a, d) => a + d.sets, 0) / done.length : 0;

  return (
    <Card>
      <CardTitle action={<span className="text-[12.5px] text-muted normal-case">prom. {fmtNum(avg, 0)} series/sem</span>}>
        Últimas 12 semanas
      </CardTitle>
      <div className="-mx-2 h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="week"
              tickFormatter={(w: string) => fmtDayMonth(w)}
              tick={{ fill: c.muted, fontSize: 10.5 }}
              tickLine={false}
              axisLine={false}
              interval={2}
              tickMargin={6}
            />
            <YAxis tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: c['surface-3'], opacity: 0.4 }}
              isAnimationActive={false}
              content={(p) => {
                const d = (p.payload?.[0] as { payload?: (typeof data)[number] } | undefined)?.payload;
                if (!p.active || !d) return null;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
                    <div className="text-muted">Semana {fmtWeekRange(d.week)}</div>
                    <div className="font-semibold">
                      {d.sets} series · {d.sessions} días
                    </div>
                    {d.volume > 0 && <div className="text-muted">{fmtVolume(d.volume)}</div>}
                  </div>
                );
              }}
            />
            <Bar dataKey="sets" radius={[6, 6, 2, 2]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.week} fill={c['accent-ink']} fillOpacity={i === data.length - 1 ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PRsCard({ index, exById }: { index: TrainingIndex; exById: Map<string, Exercise> }) {
  const prs = useMemo(() => recentPRs(index, 8), [index]);
  return (
    <Card className="p-0">
      <div className="px-4 pt-4">
        <CardTitle icon={<Trophy className="size-4 text-warn" />}>Récords recientes</CardTitle>
      </div>
      {prs.length === 0 ? (
        <p className="px-4 pb-5 text-[14px] text-muted">
          Todavía no hay récords: aparecen cuando superás tu mejor marca en un ejercicio.
        </p>
      ) : (
        prs.map((pr, i) => {
          const ex = exById.get(pr.exerciseId);
          const label =
            pr.kind === 'peso'
              ? `${fmtNum(pr.value, 1).replace(/,0$/, '')} kg${pr.set?.reps ? ` × ${pr.set.reps}` : ''}`
              : pr.kind === '1rm'
                ? `1RM est. ${fmtNum(pr.value, 1)} kg`
                : `${pr.value} reps`;
          const diff = pr.value - pr.previous;
          return (
            <button
              key={`${pr.exerciseId}-${pr.date}`}
              onClick={() => navigate(`/entreno/ejercicios/${pr.exerciseId}`)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2',
                i > 0 && 'border-t border-line',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn">
                <Trophy className="size-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{ex?.name ?? 'Ejercicio'}</div>
                <div className="text-[13px] text-muted tnum">
                  {label} <span className="text-good">(+{fmtNum(diff, pr.kind === 'reps' ? 0 : 1)})</span>
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] text-muted">{fmtDate(pr.date)}</span>
            </button>
          );
        })
      )}
    </Card>
  );
}

function TopExercisesCard({ index, exById, today }: { index: TrainingIndex; exById: Map<string, Exercise>; today: string }) {
  const rows = useMemo(() => {
    const since = addDays(today, -56);
    return Array.from(index.byExercise.entries())
      .map(([id, sessions]) => ({ id, recent: sessions.filter((s) => s.date >= since), sessions }))
      .filter((r) => r.recent.length >= 2 && exById.has(r.id))
      .sort((a, b) => b.recent.length - a.recent.length)
      .slice(0, 6)
      .map((r) => {
        const vals = sessionsOf(index, r.id)
          .slice(-10)
          .map((s) => s.e1rm ?? s.totalReps);
        const first = r.recent[0].e1rm ?? r.recent[0].totalReps;
        const last = r.recent[r.recent.length - 1].e1rm ?? r.recent[r.recent.length - 1].totalReps;
        return { id: r.id, count: r.recent.length, vals, change: first ? ((last - first) / first) * 100 : 0 };
      });
  }, [index, exById, today]);

  if (!rows.length) return null;
  return (
    <Card className="p-0">
      <div className="px-4 pt-4">
        <CardTitle>Tus ejercicios principales</CardTitle>
        <p className="-mt-2 mb-2 text-[12.5px] text-muted">Últimas 8 semanas · tendencia del 1RM estimado</p>
      </div>
      {rows.map((r, i) => (
        <button
          key={r.id}
          onClick={() => navigate(`/entreno/ejercicios/${r.id}`)}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2',
            i > 0 && 'border-t border-line',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{exById.get(r.id)!.name}</div>
            <div className="text-[12.5px] text-muted">{r.count} sesiones</div>
          </div>
          <Sparkline values={r.vals} />
          <span
            className={cn(
              'w-12 shrink-0 text-right text-[13.5px] font-semibold tnum',
              r.change > 0.5 ? 'text-good' : r.change < -0.5 ? 'text-bad' : 'text-muted',
            )}
          >
            {fmtPct(r.change)}
          </span>
        </button>
      ))}
    </Card>
  );
}
