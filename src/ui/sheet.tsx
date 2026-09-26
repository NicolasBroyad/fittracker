import { forwardRef, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from './cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** si es true, los hijos arman su propio <SheetBody> y <SheetFooter> */
  bare?: boolean;
}

/** Cuerpo scrolleable de una hoja. */
export const SheetBody = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(function SheetBody(
  { children, className },
  ref,
) {
  return (
    <div
      ref={ref}
      data-vaul-no-drag=""
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-4', className)}
    >
      {children}
    </div>
  );
});

/** Acciones fijas al pie de una hoja (siempre visibles aunque el cuerpo scrollee). */
export function SheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex shrink-0 gap-2.5 border-t border-line bg-surface px-5 pt-3 pb-safe', className)}>{children}</div>
  );
}

/** Hoja inferior tipo iOS: se arrastra hacia abajo (desde el encabezado) para cerrar. */
export function Sheet({ open, onOpenChange, title, description, children, className, bare }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] border-t border-line bg-surface outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" />
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-2">
            <div className="min-w-0">
              <Drawer.Title className="text-[19px] font-semibold tracking-tight">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 text-[13.5px] text-muted">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{typeof title === 'string' ? title : ''}</Drawer.Description>
              )}
            </div>
            <Drawer.Close
              aria-label="Cerrar"
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted active:scale-95"
            >
              <X className="size-4" strokeWidth={2.5} />
            </Drawer.Close>
          </div>
          {bare ? children : <SheetBody className="pb-safe">{children}</SheetBody>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
