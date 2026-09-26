import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold active:brightness-95',
  secondary: 'bg-surface-2 text-fg font-medium active:bg-surface-3',
  ghost: 'bg-transparent text-fg font-medium active:bg-surface-2',
  danger: 'bg-bad/12 text-bad font-semibold active:bg-bad/20',
  outline: 'bg-transparent text-fg font-medium border border-line-strong active:bg-surface-2',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[14px] rounded-xl gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'h-[52px] px-5 text-[16px] rounded-2xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-[transform,background-color,filter,opacity] duration-150 active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-[18px] animate-spin" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'plain' | 'soft' | 'accent';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'soft', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-150 active:scale-[0.92] disabled:opacity-40',
        size === 'md' ? 'size-10' : 'size-8',
        variant === 'soft' && 'bg-surface-2 text-fg active:bg-surface-3',
        variant === 'plain' && 'text-muted active:bg-surface-2',
        variant === 'accent' && 'bg-accent text-on-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
