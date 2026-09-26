import { forwardRef, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import { fmtLong, fmtRelative, todayISO } from '@/lib/dates';
import type { ISODate } from '@/lib/types';
import { cn } from './cn';

export const inputClass =
  'h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[16px] text-fg placeholder:text-faint outline-none transition-colors focus:border-accent-ink/50 focus:bg-surface';

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between px-1">
      <span className="text-[13px] font-medium text-muted">{children}</span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[84px] resize-none py-3 leading-snug', className)} {...rest} />
  );
});

interface DateFieldProps {
  value: ISODate | null;
  onChange: (v: ISODate | null) => void;
  placeholder?: string;
  min?: ISODate;
  max?: ISODate;
  clearable?: boolean;
  className?: string;
}

/**
 * Selector de fecha: muestra la fecha formateada y abre el selector nativo (la rueda en iOS)
 * con un <input type="date"> transparente superpuesto.
 */
export function DateField({ value, onChange, placeholder = 'Elegir fecha', min, max, clearable, className }: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const today = todayISO();
  const rel = value ? fmtRelative(value) : null;
  return (
    <div className={cn(inputClass, 'relative flex items-center gap-2.5', className)}>
      <CalendarDays className="size-[18px] shrink-0 text-muted" />
      <span className={cn('min-w-0 flex-1 truncate', !value && 'text-faint')}>
        {value ? (
          <>
            {fmtLong(value)}
            {(rel === 'hoy' || rel === 'ayer') && <span className="text-muted"> · {rel}</span>}
          </>
        ) : (
          placeholder
        )}
      </span>
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="relative z-10 -mr-1 rounded-full px-2 py-1 text-[13px] font-medium text-muted active:bg-surface-3"
        >
          Quitar
        </button>
      )}
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        min={min}
        max={max ?? undefined}
        onChange={(e) => onChange(e.target.value || (clearable ? null : (value ?? today)))}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            /* algunos navegadores no lo permiten; el input igual abre su selector */
          }
        }}
        className={cn('absolute inset-0 h-full w-full cursor-pointer opacity-0', clearable && value && 'right-20 w-auto')}
        aria-label={placeholder}
      />
    </div>
  );
}
