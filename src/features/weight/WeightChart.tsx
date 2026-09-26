import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCssColors } from '@/app/theme';
import { PHASE_META, PHASES } from '@/lib/constants';
import {
  addDays,
  diffDays,
  fmtDate,
  fmtDayMonth,
  fmtMonthShort,
  fmtWeekRange,
  fromISO,
  mondayOf,
  toISO,
  todayISO,
} from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import type { Phase, PhaseKind, WeightEntry, WeightGoal } from '@/lib/types';
import { movingAverage, rangeStart, weeklyAverages, type ChartRange } from '@/lib/weight';
import { cn } from '@/ui/cn';
import { Segmented } from '@/ui/controls';
import { Delta } from '@/ui/display';

type Mode = 'diario' | 'semanal';

interface Point {
  x: number;
  date: string;
  weight?: number;
  ma?: number;
  avg?: number;
  count?: number;
}

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1A', label: '1A' },
  { value: 'ALL', label: 'Todo' },
];

const ts = (iso: string) => fromISO(iso).getTime();

function readPrefs(): { mode: Mode; range: ChartRange; phases: boolean; goal: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem('ft-chart') ?? '{}');
    return { mode: p.mode ?? 'diario', range: p.range ?? '3M', phases: p.phases ?? true, goal: p.goal ?? true };
  } catch {
    return { mode: 'diario', range: '3M', phases: true, goal: true };
  }
}

function niceTicks(from: string, to: string): number[] {
  const span = diffDays(to, from);
  const out: number[] = [];
  if (span <= 50) {
    for (let d = mondayOf(addDays(from, 6)); d <= to; d = addDays(d, span <= 21 ? 7 : 14)) out.push(ts(d));
  } else {
    const every = span <= 220 ? 1 : span <= 450 ? 2 : span <= 900 ? 3 : 6;
    const f = fromISO(from);
    const d = new Date(f.getFullYear(), f.getMonth() + 1, 1);
    while (toISO(d) <= to) {
      if (d.getMonth() % every === 0 || every === 1) out.push(d.getTime());
      d.setMonth(d.getMonth() + 1);
    }
  }
  return out;
}

export function WeightChart({ entries, phases, goal }: { entries: WeightEntry[]; phases: Phase[]; goal: WeightGoal | null }) {
  const [prefs, setPrefsState] = useState(readPrefs);
  const setPrefs = (patch: Partial<typeof prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem('ft-chart', JSON.stringify(next));
      } catch {
        /* nada */
      }
      return next;
    });

  const c = useCssColors(['accent-ink', 'muted', 'faint', 'line', 'surface', 'fg', 'vol', 'def', 'man'] as const);
  const phaseColor: Record<PhaseKind, string> = { volumen: c.vol, definicion: c.def, mantenimiento: c.man };
  const today = todayISO();

  const model = useMemo(() => {
    if (!entries.length) return null;
    const from = rangeStart(prefs.range, entries, today);
    const ma = movingAverage(entries);
    let points: Point[];
    if (prefs.mode === 'diario') {
      points = entries
        .filter((e) => e.date >= from)
        .map((e) => ({ x: ts(e.date), date: e.date, weight: e.weight, ma: ma.get(e.date) }));
    } else {
      const fromMonday = mondayOf(from);
      points = weeklyAverages(entries)
        .filter((w) => w.key >= fromMonday)
        .map((w) => ({ x: ts(w.key), date: w.key, avg: w.avg, count: w.count }));
    }
    if (!points.length) return null;
    const first = points[0].date;
    const last = prefs.mode === 'diario' ? today : points[points.length - 1].date;
    const minX = Math.min(ts(first), ts(from));
    const maxX = Math.max(ts(last), points[points.length - 1].x);

    const values = points.flatMap((p) => [p.weight, p.ma, p.avg].filter((v): v is number => v != null));
    const target = prefs.goal && goal?.target_weight != null ? goal.target_weight : null;
    if (target != null) values.push(target);
    const lo = Math.floor(Math.min(...values) - 0.4);
    const hi = Math.ceil(Math.max(...values) + 0.4);

    const bands = prefs.phases
      ? phases
          .map((p) => ({
            phase: p.phase,
            x1: Math.max(ts(p.start_date), minX),
            x2: Math.min(ts(p.end_date ?? today), maxX),
          }))
          .filter((b) => b.x2 > b.x1)
      : [];

    const firstVal = prefs.mode === 'diario' ? points[0].ma : points[0].avg;
    const lastVal = prefs.mode === 'diario' ? points[points.length - 1].ma : points[points.length - 1].avg;

    return {
      points,
      minX,
      maxX,
      lo,
      hi,
      target,
      bands,
      ticks: niceTicks(toISO(new Date(minX)), toISO(new Date(maxX))),
      change: firstVal != null && lastVal != null && points.length > 1 ? lastVal - firstVal : null,
    };
  }, [entries, phases, goal, prefs, today]);

  const presentPhases = model ? PHASES.filter((p) => model.bands.some((b) => b.phase === p.value)) : [];
  const spanDays = model ? Math.round((model.maxX - model.minX) / 86_400_000) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Segmented<Mode>
          size="sm"
          className="w-[168px]"
          value={prefs.mode}
          onChange={(mode) => setPrefs({ mode })}
          options={[
            { value: 'diario', label: 'Diario' },
            { value: 'semanal', label: 'Semanal' },
          ]}
        />
        <div className="flex gap-1.5">
          <Toggle on={prefs.phases} onClick={() => setPrefs({ phases: !prefs.phases })}>
            Fases
          </Toggle>
          <Toggle on={prefs.goal} onClick={() => setPrefs({ goal: !prefs.goal })}>
            Meta
          </Toggle>
        </div>
      </div>

      {model?.change != null && (
        <div className="mt-3 flex items-baseline gap-1.5 text-[13px] text-muted">
          <Delta value={model.change} unit="kg" className="text-[15px]" />
          <span>en el período</span>
        </div>
      )}

      <div className="-mx-1 mt-2 h-[220px]">
        {model ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={model.points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c['accent-ink']} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={c['accent-ink']} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.line} />
              {model.bands.map((b, i) => (
                <ReferenceArea
                  key={i}
                  x1={b.x1}
                  x2={b.x2}
                  fill={phaseColor[b.phase]}
                  fillOpacity={0.09}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ))}
              <XAxis
                dataKey="x"
                type="number"
                scale="time"
                domain={[model.minX, model.maxX]}
                ticks={model.ticks}
                tickFormatter={(v: number) => {
                  const iso = toISO(new Date(v));
                  return spanDays <= 50 ? fmtDayMonth(iso) : fmtMonthShort(iso);
                }}
                tick={{ fill: c.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                domain={[model.lo, model.hi]}
                tickCount={5}
                allowDecimals={false}
                tickFormatter={(v: number) => fmtNum(v, 0)}
                tick={{ fill: c.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              {model.target != null && (
                <ReferenceLine
                  y={model.target}
                  stroke={c.fg}
                  strokeOpacity={0.55}
                  strokeDasharray="5 5"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Meta ${fmtNum(model.target, 1)}`,
                    position: 'insideTopRight',
                    fill: c.muted,
                    fontSize: 11,
                  }}
                />
              )}
              <Tooltip
                cursor={{ stroke: c.faint, strokeWidth: 1 }}
                isAnimationActive={false}
                content={(p) => (
                  <ChartTooltip active={p.active} payload={p.payload as unknown as { payload: Point }[]} mode={prefs.mode} />
                )}
              />
              {prefs.mode === 'diario' ? (
                <>
                  <Area
                    dataKey="ma"
                    type="monotone"
                    stroke={c['accent-ink']}
                    strokeWidth={2.5}
                    fill="url(#wfill)"
                    baseValue={model.lo}
                    dot={false}
                    activeDot={{ r: 4, fill: c['accent-ink'], stroke: c.surface, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="weight"
                    stroke="none"
                    dot={{ r: model.points.length > 120 ? 1.6 : 2.4, fill: c.muted, strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: c.fg, stroke: c.surface, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <Area
                  dataKey="avg"
                  type="monotone"
                  stroke={c['accent-ink']}
                  strokeWidth={2.5}
                  fill="url(#wfill)"
                  baseValue={model.lo}
                  dot={{ r: 3, fill: c['accent-ink'], strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: c['accent-ink'], stroke: c.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[14px] text-muted">Sin registros en este período</div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 rounded-[14px] bg-surface-2 p-[3px]">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setPrefs({ range: r.value })}
            className={cn(
              'h-8 rounded-[11px] text-[13px] font-semibold transition-colors',
              prefs.range === r.value ? 'bg-surface text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-surface-3' : 'text-muted',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {presentPhases.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {presentPhases.map((p) => (
            <span key={p.value} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <span className="size-2 rounded-[3px]" style={{ background: PHASE_META[p.value].color, opacity: 0.8 }} />
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'h-8 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
        on ? 'border-transparent bg-accent-soft text-accent-ink' : 'border-line-strong text-muted',
      )}
    >
      {children}
    </button>
  );
}

function ChartTooltip({ active, payload, mode }: { active?: boolean; payload?: { payload: Point }[]; mode: Mode }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      {mode === 'diario' ? (
        <>
          <div className="text-muted">{fmtDate(p.date)}</div>
          {p.weight != null && <div className="font-semibold tnum">{fmtNum(p.weight, 1)} kg</div>}
          {p.ma != null && <div className="text-muted tnum">Prom. 7 días {fmtNum(p.ma, 1)}</div>}
        </>
      ) : (
        <>
          <div className="text-muted">Semana {fmtWeekRange(p.date)}</div>
          {p.avg != null && <div className="font-semibold tnum">{fmtNum(p.avg, 2)} kg</div>}
          {p.count != null && (
            <div className="text-muted">
              {p.count} {p.count === 1 ? 'registro' : 'registros'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
