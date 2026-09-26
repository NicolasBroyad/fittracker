import { useSyncExternalStore } from 'react';
import { onlineManager, useMutationState } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/** Aviso flotante arriba de la barra de pestañas: sin conexión y/o cambios que faltan subir. */
export function OfflineIndicator() {
  const online = useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline());
  const pending = useMutationState({
    filters: { status: 'pending', predicate: (m) => m.options.mutationKey?.[0] === 'offline' },
  }).length;
  const show = !online || pending > 0;
  const plural = pending === 1 ? 'cambio' : 'cambios';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: 'calc(max(10px, calc(env(safe-area-inset-bottom) - 6px)) + 74px)' }}
        >
          <div className="flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-2 text-[13px] font-medium shadow-lg glass">
            {online ? (
              <>
                <RefreshCw className="size-3.5 animate-spin text-accent-ink" />
                Subiendo {pending} {plural}…
              </>
            ) : (
              <>
                <CloudOff className="size-3.5 text-warn" />
                Sin conexión
                {pending > 0 && (
                  <span className="text-muted">
                    · {pending} {plural} {pending === 1 ? 'guardado' : 'guardados'} en el celu
                  </span>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
