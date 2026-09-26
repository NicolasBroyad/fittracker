import { useLayoutEffect, useRef, useState } from 'react';

/** Último valor no nulo: sirve para que una hoja siga mostrando su contenido mientras se cierra. */
export function useSticky<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value != null) ref.current = value;
  return ref.current;
}

/**
 * Clave que cambia cada vez que `open` pasa a true, para remontar (resetear) el formulario de una
 * hoja al abrirla sin desmontarlo mientras se cierra (así la animación de cierre no queda vacía).
 */
export function useResetKey(open: boolean): number {
  const [key, setKey] = useState(0);
  const was = useRef(open);
  useLayoutEffect(() => {
    if (open && !was.current) setKey((k) => k + 1);
    was.current = open;
  }, [open]);
  return key;
}
