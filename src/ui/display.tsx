import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { MUSCLE_LABEL, PHASE_META } from '@/lib/constants';
import { fmtDelta } from '@/lib/format';
import type { PhaseKind } from '@/lib/types';
import { cn } from './cn';

export function Card({ children, className, onClick }: { children?: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'block w-full rounded-[24px] border border-line bg-surface p-4 text-left shadow-card',
        onClick && 'transition-transform duration-150 active:scale-[0.985]',
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2.5 flex items-center justify-between gap-3 px-1', className)}>
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function CardTitle({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {icon}
        {children}
      </div>
      {action}
    </div>
  );
}

export function MuscleBadge({ group, className }: { group: string | null | undefined; className?: string }) {
  if (!group) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full bg-surface-2 px-2 text-[11.5px] font-medium text-muted',
        className,
      )}
    >
      {MUSCLE_LABEL[group] ?? group}
    </span>
  );
}

export function PhaseBadge({ phase, className }: { phase: PhaseKind; className?: string }) {
  const meta = PHASE_META[phase];
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold', className)}
      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

/**
 * Variación con flecha. `goodDirection`: 1 si subir es bueno, −1 si bajar es bueno, 0 neutral.
 */
export function Delta({
  value,
  unit = '',
  decimals = 1,
  goodDirection = 0,
  className,
}: {
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  goodDirection?: 1 | -1 | 0;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return <span className={cn('text-faint', className)}>—</span>;
  const r = Number(value.toFixed(decimals));
  const Icon = r > 0 ? ArrowUpRight : r < 0 ? ArrowDownRight : Minus;
  const tone = r === 0 || goodDirection === 0 ? 'text-muted' : Math.sign(r) === goodDirection ? 'text-good' : 'text-bad';
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium tnum', tone, className)}>
      <Icon className="size-[1.05em]" strokeWidth={2.5} />
      {fmtDelta(r, decimals)}
      {unit && <span className="ml-0.5">{unit}</span>}
    </span>
  );
}

export function ProgressBar({
  value,
  color = 'var(--accent)',
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = 'var(--accent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Sparkline({
  values,
  width = 72,
  height = 28,
  color = 'var(--accent-ink)',
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-8 text-center', className)}>
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <div className="text-[16px] font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-[280px] text-[14px] text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate text-[12.5px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[22px] leading-tight font-semibold tracking-tight tnum">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[12.5px]">{sub}</div>}
    </div>
  );
}
