import { ChartNoAxesColumn, Dumbbell, House, Scale, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/ui/cn';
import { navigate, useLocation } from './router';

export const TABS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: 'Hoy', icon: House },
  { path: '/peso', label: 'Peso', icon: Scale },
  { path: '/entreno', label: 'Entreno', icon: Dumbbell },
  { path: '/progreso', label: 'Progreso', icon: ChartNoAxesColumn },
];

export function tabOf(pathname: string): string {
  const first = '/' + (pathname.split('/')[1] ?? '');
  return TABS.some((t) => t.path === first) ? first : '/';
}

export function TabBar() {
  const loc = useLocation();
  const current = tabOf(loc.pathname);

  return (
    <nav
      className="fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'max(10px, calc(env(safe-area-inset-bottom) - 6px))' }}
    >
      <div className="flex w-full max-w-[400px] items-center rounded-[26px] border border-line-strong p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] glass">
        {TABS.map((t) => {
          const active = t.path === current;
          const Icon = t.icon;
          return (
            <button
              key={t.path}
              onClick={() => {
                if (loc.pathname === t.path) window.scrollTo({ top: 0, behavior: 'smooth' });
                else navigate(t.path, { replace: active || loc.pathname.split('/').length <= 2 });
              }}
              className="relative flex h-[52px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[20px] active:scale-[0.94]"
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[20px] bg-fg/[0.07] dark:bg-white/[0.08]"
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                />
              )}
              <Icon
                className={cn('relative size-[22px] transition-colors', active ? 'text-accent-ink' : 'text-muted')}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={cn('relative text-[10.5px] font-semibold tracking-wide', active ? 'text-fg' : 'text-muted')}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
