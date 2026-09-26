import { useEffect, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

/**
 * Botón destructivo en dos toques: el primero lo "arma" (cambia el texto), el segundo confirma.
 * Evita diálogos apilados sobre las hojas inferiores.
 */
export function ConfirmButton({
  onConfirm,
  confirmLabel = 'Tocá de nuevo para confirmar',
  children,
  ...rest
}: Omit<ButtonProps, 'onClick'> & { onConfirm: () => void; confirmLabel?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant="danger"
      {...rest}
      className={armed ? 'bg-bad text-white' : rest.className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
