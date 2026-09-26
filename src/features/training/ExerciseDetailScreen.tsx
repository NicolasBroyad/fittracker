import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, Plus, Trophy } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExerciseMap, useExercisesQuery, useRoutinesQuery, useTrainingIndex } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { sheets } from '@/app/sheets';
import { useCssColors } from '@/app/theme';
import { DAY_NAMES, MUSCLE_LABEL } from '@/lib/constants';
import { fmtDate, fmtDayMonth, fmtMonthShort, fmtRelative, fmtWeekdayShort, fromISO, toISO } from '@/lib/dates';
import { fmtNum, fmtSet, fmtTarget, fmtVolume } from '@/lib/format';
import { detectPRs, exerciseRecords, exerciseUsage, sessionsOf, type PRKind, type Session } from '@/lib/training';
import { Button, IconButton } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Segmented } from '@/ui/controls';
import { Card, CardTitle, Empty, Skeleton, Stat } from '@/ui/display';
import { ExerciseFormSheet } from './ExerciseFormSheet';

type Metric = '1rm' | 'peso' | 'volumen';

const PR_LABEL: Record<PRKind, string> = { peso: 'Récord de peso', '1rm': 'Mejor 1RM', reps: 'Récord de reps' };

export function ExerciseDetailScreen({ id }: { id: string }) {
  const exQuery = useExercisesQuery();
  const exercise = useExerciseMap().get(id);
  const index = useTrainingIndex();
  const routines = useRoutinesQuery().data;
  const [editing, setEditing] = useState(false);
  const [metric, setMetric] = useState<Metric>('1rm');
  const [showAll, setShowAll] = useState(false);

  const sessions = sessionsOf(index, id);
  const records = useMemo(() => exerciseRecords(sessions), [sessions]);
  const prs = useMemo(() => new Map(detectPRs(sessions).map((p) => [p.date, p])), [sessions]);
  const usage = exerciseUsage(routines, id);
  const hasWeight = sessions.some((s) => (s.topWeight ?? 0) > 0);

  if (!exercise) {
    return (
      <Page title="Ejercicio" back={{ label: 'Ejercicios', fallback: '/entreno/ejercicios' }}>
        {exQuery.isPending ? (
          <Skeleton className="h-64 rounded-[24px]" />
        ) : (
          <Card>
            <Empty
              title="Este ejercicio no existe"
              action={<Button onClick={() => navigate('/entreno/ejercicios', { replace: true })}>Ver ejercicios</Button>}
            />
          </Card>
        )}
      </Page>
    );
  }

  const history = sessions.slice().reverse();
  const shown = showAll ? history : history.slice(0, 12);
  const target = usage.find((u) => u.routine.is_active)?.item ?? usage[0]?.item ?? null;

  return (
    <Page
      title={exercise.name}
      eyebrow={exercise.muscle_group ? MUSCLE_LABEL[exercise.muscle_group] : 'Ejercicio'}
      back={{ label: 'Atrás', fallback: '/entreno/ejercicios' }}
      actions={
        <IconButton label="Editar ejercicio" onClick={() => setEditing(true)}>
          <Pencil className="size-[17px]" />
        </IconButton>
      }
    >
      <div className="space-y-4">
        <Button
          size="lg"
          block
          icon={<Plus className="size-5" strokeWidth={2.5} />}
          onClick={() => sheets.openSets(id, { target: target ? { sets: target.sets_target, reps: target.reps_target } : null })}
        >
          Registrar series
        </Button>

        {sessions.length === 0 ? (
          <Card>
            <Empty title="Sin registros todavía">Cuando cargues series vas a ver acá tus récords y tu progreso.</Empty>
          </Card>
        ) : (
          <>
            <Card>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Stat
                  label="1RM estimado"
                  value={records.bestE1rm ? `${fmtNum(records.bestE1rm.value, 1)} kg` : '—'}
                  sub={records.bestE1rm && <span className="text-muted">{fmtDate(records.bestE1rm.date)}</span>}
                />
                <Stat
                  label="Mejor serie"
                  value={records.heaviest ? fmtSet(records.heaviest.set) : '—'}
                  sub={records.heaviest && <span className="text-muted">{fmtDate(records.heaviest.date)}</span>}
                />
                <Stat
                  label="Sesiones"
                  value={sessions.length}
                  sub={<span className="text-muted">desde {fmtDate(sessions[0].date)}</span>}
                />
                <Stat
                  label="Última vez"
                  value={<span className="capitalize">{fmtRelative(records.lastDate!)}</span>}
                  sub={<span className="text-muted">{prs.size} récords en total</span>}
                />
              </div>
            </Card>

            {sessions.length > 1 && (
              <Card>
                <CardTitle>Progreso</CardTitle>
                <Segmented<Metric>
                  size="sm"
                  value={hasWeight ? metric : 'volumen'}
                  onChange={setMetric}
                  options={
                    hasWeight
                      ? [
                          { value: '1rm', label: '1RM est.' },
                          { value: 'peso', label: 'Peso máx.' },
                          { value: 'volumen', label: 'Volumen' },
                        ]
                      : [{ value: 'volumen', label: 'Repeticiones totales' }]
                  }
                />
                <ProgressChart sessions={sessions} metric={hasWeight ? metric : 'volumen'} repsMode={!hasWeight} prDates={prs} />
              </Card>
            )}
          </>
        )}

        <Card>
          <CardTitle>En tus rutinas</CardTitle>
          {usage.length === 0 ? (
            <p className="text-[14px] text-muted">No está asignado a ningún día. Agregalo desde el editor de una rutina.</p>
          ) : (
            <div className="-mx-1">
              {usage.map((u) => (
                <button
                  key={`${u.routine.id}-${u.dayOfWeek}`}
                  onClick={() => navigate(`/entreno/rutinas/${u.routine.id}?dia=${u.dayOfWeek}`)}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">
                      {DAY_NAMES[u.dayOfWeek - 1]}
                      {u.dayName && <span className="text-muted"> · {u.dayName}</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">
                      {u.routine.name}
                      {u.routine.is_active && ' (activa)'}
                      {fmtTarget(u.item.sets_target, u.item.reps_target) &&
                        ` · ${fmtTarget(u.item.sets_target, u.item.reps_target)}`}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {history.length > 0 && (
          <Card className="p-0">
            <div className="px-4 pt-4">
              <CardTitle>Historial</CardTitle>
            </div>
            {shown.map((s, i) => {
              const pr = prs.get(s.date);
              return (
                <button
                  key={s.date}
                  onClick={() => sheets.openSets(id, { date: s.date })}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left active:bg-surface-2', i > 0 && 'border-t border-line')}
                >
                  <div className="w-[76px] shrink-0">
                    <div className="text-[14px] font-medium capitalize">{fmtWeekdayShort(s.date).split(' ')[0]}</div>
                    <div className="text-[12.5px] text-muted">{fmtDate(s.date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1">
                      {s.sets.map((set, j) => (
                        <span key={j} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12.5px] font-medium tnum">
                          {fmtSet(set)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-muted tnum">
                      {s.volume > 0 && <span>{fmtVolume(s.volume)}</span>}
                      {s.e1rm != null && <span>1RM {fmtNum(s.e1rm, 1)}</span>}
                      {pr && (
                        <span className="inline-flex items-center gap-1 font-semibold text-warn">
                          <Trophy className="size-3" />
                          {PR_LABEL[pr.kind]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {history.length > shown.length && (
              <div className="border-t border-line p-2">
                <Button variant="ghost" size="sm" block className="text-muted" onClick={() => setShowAll(true)}>
                  Ver las {history.length} sesiones
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <ExerciseFormSheet
        open={editing}
        onClose={() => setEditing(false)}
        exercise={exercise}
        onDeleted={() => navigate('/entreno/ejercicios', { replace: true })}
      />
    </Page>
  );
}

function ProgressChart({
  sessions,
  metric,
  repsMode,
  prDates,
}: {
  sessions: Session[];
  metric: Metric;
  repsMode: boolean;
  prDates: Map<string, unknown>;
}) {
  const c = useCssColors(['accent-ink', 'muted', 'faint', 'line', 'surface', 'fg', 'warn'] as const);
  const data = sessions
    .map((s) => ({
      x: fromISO(s.date).getTime(),
      date: s.date,
      value: metric === '1rm' ? s.e1rm : metric === 'peso' ? s.topWeight : repsMode ? s.totalReps : s.volume,
      pr: prDates.has(s.date),
    }))
    .filter((d): d is { x: number; date: string; value: number; pr: boolean } => d.value != null && d.value > 0);
  if (data.length < 2) return <p className="py-10 text-center text-[14px] text-muted">Faltan datos para graficar</p>;

  const vals = data.map((d) => d.value);
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.15 || 2;
  const span = (data[data.length - 1].x - data[0].x) / 86_400_000;
  const unit = metric === 'volumen' ? (repsMode ? ' reps' : ' kg') : ' kg';
  const first = vals[0];
  const last = vals[vals.length - 1];
  const change = first ? ((last - first) / first) * 100 : 0;

  return (
    <div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[26px] font-semibold tnum">
          {metric === 'volumen' && !repsMode ? fmtVolume(last) : fmtNum(last, metric === '1rm' ? 1 : 0).replace(/,0$/, '') + unit}
        </span>
        <span className={cn('text-[13px] font-semibold tnum', change > 0 ? 'text-good' : change < 0 ? 'text-bad' : 'text-muted')}>
          {change > 0 ? '+' : ''}
          {Math.round(change)}% desde el inicio
        </span>
      </div>
      <div className="-mx-2 mt-2 h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.line} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => (span < 60 ? fmtDayMonth(toISO(new Date(v))) : fmtMonthShort(toISO(new Date(v))))}
              tick={{ fill: c.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              domain={[Math.max(0, Math.floor(Math.min(...vals) - pad)), Math.ceil(Math.max(...vals) + pad)]}
              tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
              tick={{ fill: c.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickCount={4}
            />
            <Tooltip
              cursor={{ stroke: c.faint }}
              isAnimationActive={false}
              content={(p) => {
                const d = (p.payload?.[0] as { payload?: (typeof data)[number] } | undefined)?.payload;
                if (!p.active || !d) return null;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
                    <div className="text-muted">{fmtDate(d.date)}</div>
                    <div className="font-semibold tnum">
                      {metric === 'volumen' && !repsMode
                        ? fmtVolume(d.value)
                        : `${fmtNum(d.value, metric === '1rm' ? 1 : 0)}${unit}`}
                    </div>
                    {d.pr && <div className="font-semibold text-warn">Récord</div>}
                  </div>
                );
              }}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={c['accent-ink']}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: { pr: boolean }; index?: number }) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={props.payload?.pr ? 4.5 : 2.5}
                  fill={props.payload?.pr ? c.warn : c['accent-ink']}
                  stroke={props.payload?.pr ? c.surface : 'none'}
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 5, fill: c.fg, stroke: c.surface, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {prDates.size > 0 && <p className="mt-1 text-center text-[11.5px] text-faint">Los puntos dorados son récords.</p>}
    </div>
  );
}
