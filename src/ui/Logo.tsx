/** Marca de FitTracker: una línea de progreso ascendente. Misma forma que el ícono de la app. */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="26" fill="#131316" />
      <rect x="0.5" y="0.5" width="99" height="99" rx="25.5" fill="none" stroke="rgba(255,255,255,0.08)" />
      <path
        d="M24 64 L40 47 L53 58 L74 35"
        fill="none"
        stroke="#10B981"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="74" cy="35" r="7.5" fill="#10B981" />
    </svg>
  );
}
