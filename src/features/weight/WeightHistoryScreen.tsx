import { useMemo } from 'react';
import { useEntries, useGoals, usePhases } from '@/api/hooks';
import { Page } from '@/app/Page';
import { sheets } from '@/app/sheets';
import { fmtMonth, fmtWeekdayShort, monthKey } from '@/lib/dates';
import { fmtNum } from '@/lib/format';
import type { WeightEntry } from '@/lib/types';
import { activeGoal, currentPhase, preferredDirection } from '@/lib/weight';
import { Card, Delta } from '@/ui/display';

export function WeightHistoryScreen() {
  const entries = useEntries();
  const goal = activeGoal(useGoals());
  const phase = currentPhase(usePhases());
  const dir = preferredDirection(goal, entries, phase);

  const groups = useMemo(() => {
    const out: { month: string; rows: { e: WeightEntry; prev: WeightEntry | null }[] }[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      const m = monthKey(e.date);
      if (!out.length || out[out.length - 1].month !== m) out.push({ month: m, rows: [] });
      out[out.length - 1].rows.push({ e, prev: i > 0 ? entries[i - 1] : null });
    }
    return out;
  }, [entries]);

  return (
    <Page title="Registros" back={{ label: 'Peso', fallback: '/peso' }}>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.month}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {fmtMonth(g.month + '-01')}
            </h2>
            <Card className="p-0">
              {g.rows.map(({ e, prev }, i) => (
                <button
                  key={e.date}
                  onClick={() => sheets.openWeight(e.date)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2 ${i ? 'border-t border-line' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] capitalize">{fmtWeekdayShort(e.date)}</div>
                    {e.note && <div className="truncate text-[13px] text-muted">{e.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-semibold tnum">{fmtNum(e.weight, 1)}</div>
                    <div className="text-[12px]">
                      {prev ? <Delta value={e.weight - prev.weight} goodDirection={dir} /> : null}
                    </div>
                  </div>
                </button>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </Page>
  );
}
