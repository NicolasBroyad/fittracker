import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/ui/cn';
import { goBack } from './router';

interface PageProps {
  title: ReactNode;
  /** texto chico arriba del título (ej. la fecha) */
  eyebrow?: ReactNode;
  /** si está, muestra el botón de volver con este texto */
  back?: { label: string; fallback: string };
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Pantalla con título grande estilo iOS. Al scrollear, el título grande se va y aparece
 * una barra superior translúcida con el título chico.
 */
export function Page({ title, eyebrow, back, actions, children, className }: PageProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 pt-safe transition-[background-color,border-color,backdrop-filter] duration-200',
          compact ? 'border-b border-line glass' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-11 max-w-2xl items-center justify-between gap-2 px-page">
          <div className="flex min-w-[72px] items-center">
            {back && (
              <button
                onClick={() => goBack(back.fallback)}
                className="-ml-2 flex h-10 items-center gap-0.5 rounded-full pr-3 pl-1 text-[16px] text-accent-ink active:opacity-60"
              >
                <ChevronLeft className="size-[26px]" strokeWidth={2.25} />
                <span className="max-w-[110px] truncate">{back.label}</span>
              </button>
            )}
          </div>
          <div
            className={cn(
              'min-w-0 flex-1 truncate text-center text-[16px] font-semibold transition-opacity duration-200',
              compact ? 'opacity-100' : 'opacity-0',
            )}
          >
            {title}
          </div>
          <div className="flex min-w-[72px] items-center justify-end gap-1.5">{actions}</div>
        </div>
      </div>

      <div className="px-page pb-nav" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 44px)' }}>
        <header className="pt-1 pb-4">
          {eyebrow && <div className="mb-0.5 text-[13px] font-medium text-muted">{eyebrow}</div>}
          <h1 className="text-[32px] leading-[1.1] font-bold tracking-[-0.02em]">{title}</h1>
          <div ref={sentinel} className="h-px" />
        </header>
        {children}
      </div>
    </div>
  );
}
