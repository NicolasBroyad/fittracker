import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Check, ChevronRight, History, LineChart, Plus, Scale } from 'lucide-react';
import { useEntries, useEntriesQuery, useGoals, usePhases } from '@/api/hooks';
import { Page } from '@/app/Page';
import { navigate } from '@/app/router';
import { sheets } from '@/app/sheets';
import { addDays, fmtMonth, fmtRelative, todayISO } from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import { activeGoal, avgEndingAt, currentPhase, monthlyAverages, trendPerDay } from '@/lib/weight';
import { Button, IconButton } from '@/ui/button';
import { Card, CardTitle, Delta, Empty, Skeleton } from '@/ui/display';
import { GoalCard } from './GoalCard';
import { WeightCalendar } from './WeightCalendar';
import { WeightChart } from './WeightChart';

export function WeightScreen() {
  const query = useEntriesQuery();
  const entries = useEntries();
  const goals = useGoals();
  const phases = usePhases();
  const today = todayISO();

  const phase = currentPhase(phases, today);
  const goal = activeGoal(goals);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const loggedToday = latest?.date === today;

  const stats = useMemo(() => {
    if (!latest) return null;
    const avg7 = avgEndingAt(entries, latest.date);
    const prev7 = avgEndingAt(entries, addDays(latest.date, -7));
    const slope = trendPerDay(entries, 28, today);
    return { avg7, weekChange: avg7 != null && prev7 != null ? avg7 - prev7 : null, trend: slope == null ? null : slope * 7 };
  }, [entries, latest, today]);

  return (
    <Page
      title="Peso"
      actions={
        <IconButton label="Registrar peso" variant="accent" onClick={() => sheets.openWeight(today)}>
          <Plus className="size-5" strokeWidth={2.5} />
        </IconButton>
      }
    >
      {query.isPending && !entries.length ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-[24px]" />
          <Skeleton className="h-72 rounded-[24px]" />
        </div>
      ) : !latest ? (
        <Card>
          <Empty
            icon={<Scale className="size-6" />}
            title="Registrá tu primer peso"
            action={<Button onClick={() => sheets.openWeight(today)}>Registrar peso</Button>}
          >
            Pesate en ayunas cada mañana; con unos días de datos vas a ver promedios semanales y tendencias.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-muted">Último registro · {fmtRelative(latest.date)}</div>
                <div className="mt-1 font-display text-[48px] leading-none font-semibold tracking-tight tnum">
                  {fmtNum(latest.weight, 1)}
                  <span className="ml-1.5 text-[20px] font-semibold text-muted">kg</span>
                </div>
              </div>
              {loggedToday ? (
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent-ink">
                  <Check className="size-4" strokeWidth={3} />
                  Hoy
                </span>
              ) : (
                <Button size="sm" onClick={() => sheets.openWeight(today)}>
                  Registrar hoy
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
              <HeroStat label="Prom. 7 días" value={stats?.avg7 != null ? fmtNum(stats.avg7, 1) : '–'} />
              <HeroStat label="vs semana ant." value={<Delta value={stats?.weekChange} />} />
              <HeroStat
                label="Tendencia"
                value={stats?.trend != null ? <Delta value={stats.trend} decimals={2} /> : '–'}
                sub="kg/semana"
              />
            </div>
          </Card>

          <Card>
            <CardTitle icon={<LineChart className="size-4" />}>Evolución</CardTitle>
            <WeightChart entries={entries} phases={phases} goal={goal} />
          </Card>

          <GoalCard entries={entries} goals={goals} goal={goal} phases={phases} phase={phase} />

          <Card>
            <CardTitle icon={<CalendarDays className="size-4" />}>Calendario</CardTitle>
            <WeightCalendar entries={entries} />
          </Card>

          <MonthlyCard entries={entries} />

          <Card onClick={() => navigate('/peso/historial')} className="flex items-center gap-3 py-3.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <History className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">Todos los registros</div>
              <div className="text-[13px] text-muted">
                {entries.length} registros desde {fmtRelative(entries[0].date)}
              </div>
            </div>
            <ChevronRight className="size-5 text-faint" />
          </Card>
        </div>
      )}
    </Page>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[16px] font-semibold tnum">{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

function MonthlyCard({ entries }: { entries: ReturnType<typeof useEntries> }) {
  const [all, setAll] = useState(false);
  const months = useMemo(() => monthlyAverages(entries).reverse(), [entries]);
  if (months.length < 1) return null;
  const shown = all ? months : months.slice(0, 6);
  const max = Math.max(...months.map((m) => m.avg));
  const min = Math.min(...months.map((m) => m.avg));
  const span = max - min || 1;

  return (
    <Card>
      <CardTitle>Mes a mes</CardTitle>
      <div className="-mx-1 space-y-0.5">
        {shown.map((m, i) => {
          const prev = months[i + 1];
          return (
            <div key={m.key} className="flex items-center gap-3 rounded-xl px-1 py-2">
              <div className="w-[88px] shrink-0">
                <div className="text-[14.5px] font-medium capitalize">{fmtMonth(m.key + '-01').split(' ')[0]}</div>
                <div className="text-[12px] text-muted">
                  {m.key.slice(0, 4)} · {m.count} reg.
                </div>
              </div>
              <div className="relative h-1.5 min-w-0 flex-1 rounded-full bg-surface-2">
                <div
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-ink"
                  style={{ left: `${8 + ((m.avg - min) / span) * 84}%` }}
                />
              </div>
              <div className="w-[64px] shrink-0 text-right">
                <div className="text-[15px] font-semibold tnum">{fmtNum(m.avg, 1)}</div>
                <div className="text-[12px]">
                  {prev ? <Delta value={m.avg - prev.avg} /> : <span className="text-faint">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {months.length > 6 && (
        <Button variant="ghost" size="sm" block className="mt-1 text-muted" onClick={() => setAll((v) => !v)}>
          {all ? 'Ver menos' : `Ver los ${months.length} meses`}
        </Button>
      )}
    </Card>
  );
}
