import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';

interface SegmentedProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/** Control segmentado tipo iOS con indicador que se desliza. */
export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div className={cn('flex rounded-[14px] bg-surface-2 p-[3px]', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 rounded-[11px] font-medium transition-colors',
              size === 'md' ? 'h-9 text-[14px]' : 'h-7 text-[12.5px]',
              active ? 'text-fg' : 'text-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                className="absolute inset-0 rounded-[11px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-surface-3"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  color?: string;
  className?: string;
}

export function Chip({ selected, onClick, children, color, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium transition-colors active:scale-[0.96]',
        selected ? 'bg-fg text-bg' : 'bg-surface-2 text-muted',
        className,
      )}
      style={selected && color ? { background: color, color: '#0c0c0e' } : undefined}
    >
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-surface-3',
      )}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      />
    </button>
  );
}
