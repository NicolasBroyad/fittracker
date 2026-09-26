import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { MotionConfig, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { isDemo } from '@/api';
import { createQueryClient } from '@/api/hooks';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SettingsSheet } from '@/features/settings/SettingsSheet';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WeightHistoryScreen } from '@/features/weight/WeightHistoryScreen';
import { WeightSheet } from '@/features/weight/WeightSheet';
import { TrainingScreen } from '@/features/training/TrainingScreen';
import { RoutinesScreen } from '@/features/training/RoutinesScreen';
import { RoutineEditorScreen } from '@/features/training/RoutineEditorScreen';
import { ExercisesScreen } from '@/features/training/ExercisesScreen';
import { SetLoggerSheet } from '@/features/training/SetLoggerSheet';
import { ExerciseCalendarSheet } from '@/features/training/ExerciseCalendarSheet';
import { DaySessionsSheet } from '@/features/progress/DaySessionsSheet';
import { AuthProvider, useAuth } from './auth';
import { matchPath, navigate, useLocation } from './router';
import { TabBar } from './TabBar';
import { useResolvedTheme } from './theme';

// las pantallas con gráficos cargan recharts, así que se piden recién al entrar
const WeightScreen = lazy(() => import('@/features/weight/WeightScreen').then((m) => ({ default: m.WeightScreen })));
const ExerciseDetailScreen = lazy(() =>
  import('@/features/training/ExerciseDetailScreen').then((m) => ({ default: m.ExerciseDetailScreen })),
);
const ProgressScreen = lazy(() => import('@/features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));

const CACHE_KEY = 'ft-cache-v2';

const routes: { path: string; render: (p: Record<string, string>) => ReactNode }[] = [
  { path: '/', render: () => <TodayScreen /> },
  { path: '/peso', render: () => <WeightScreen /> },
  { path: '/peso/historial', render: () => <WeightHistoryScreen /> },
  { path: '/entreno', render: () => <TrainingScreen /> },
  { path: '/entreno/rutinas', render: () => <RoutinesScreen /> },
  { path: '/entreno/rutinas/:id', render: (p) => <RoutineEditorScreen id={p.id} /> },
  { path: '/entreno/ejercicios', render: () => <ExercisesScreen /> },
  { path: '/entreno/ejercicios/:id', render: (p) => <ExerciseDetailScreen id={p.id} /> },
  { path: '/progreso', render: () => <ProgressScreen /> },
];

export function App() {
  const queryClient = useMemo(createQueryClient, []);
  const persister = useMemo(
    () => createSyncStoragePersister({ storage: isDemo ? undefined : window.localStorage, key: CACHE_KEY }),
    [],
  );
  const onSignedOut = useCallback(() => {
    queryClient.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* nada */
    }
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30, buster: '2.0' }}
    >
      <MotionConfig reducedMotion="user">
        <AuthProvider onSignedOut={onSignedOut}>
          <Root />
        </AuthProvider>
      </MotionConfig>
    </PersistQueryClientProvider>
  );
}

function Root() {
  const auth = useAuth();
  const theme = useResolvedTheme();
  return (
    <>
      {/* franja oscura bajo la barra de estado de iOS (texto blanco) cuando el tema es claro */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[45] bg-[var(--statusbar)] dark:hidden"
        style={{ height: 'env(safe-area-inset-top)' }}
      />
      {auth.status === 'loading' ? null : auth.status === 'signedOut' ? <LoginScreen /> : <Shell />}
      <Toaster
        theme={theme}
        position="top-center"
        offset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-surface !text-fg !shadow-lg',
            description: '!text-muted',
          },
        }}
      />
    </>
  );
}

function Shell() {
  const loc = useLocation();

  let page: ReactNode = null;
  for (const r of routes) {
    const params = matchPath(r.path, loc.pathname);
    if (params) {
      page = r.render(params);
      break;
    }
  }

  useLayoutEffect(() => {
    if (!page) navigate('/', { replace: true });
  }, [page]);

  useLayoutEffect(() => {
    window.scrollTo(0, loc.restoreY ?? 0);
  }, [loc.pathname, loc.search, loc.idx, loc.restoreY]);

  const initial = loc.dir === 1 ? { opacity: 0, x: 28 } : loc.dir === -1 ? { opacity: 0, x: -28 } : { opacity: 0, y: 6 };

  return (
    <>
      <motion.main
        key={loc.pathname}
        initial={initial}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.22, ease: [0.25, 0.8, 0.3, 1] }}
        className="min-h-[100dvh]"
      >
        <Suspense fallback={<div className="min-h-[100dvh]" />}>{page}</Suspense>
      </motion.main>
      <TabBar />
      <WeightSheet />
      <SetLoggerSheet />
      <DaySessionsSheet />
      <ExerciseCalendarSheet />
      <SettingsSheet />
    </>
  );
}
