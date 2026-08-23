/** Iconos de trazo, grilla de 24px, para que escalen y se recoloreen. */

type IconProps = {
  size?: number
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function VineLeafIcon({ size = 17, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.6} className={className}>
      <path d="M12 21v-6" />
      <path d="M12 15c-4 0-7-2.6-7-6.4C5 5.5 8 3 12 3s7 2.5 7 5.6c0 3.8-3 6.4-7 6.4z" />
      <path d="M12 15V5.5M9.2 9.2 12 11m2.8-1.8L12 11" />
    </svg>
  )
}

/**
 * Hoja de vid con su zarcillo, para el encabezado de la cava.
 * La hoja se balancea sola; el zarcillo se dibuja al entrar (ver index.css).
 */
export function VineSprigIcon({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 30"
      width={size}
      height={(size * 30) / 40}
      fill="none"
      aria-hidden="true"
    >
      {/* Sarmiento con su zarcillo enrulado: se dibuja solo al entrar. */}
      <path
        className="zarcillo"
        style={{ ['--largo' as string]: '34' }}
        d="M2 27c4.4-.5 7.4-1.9 9.4-4.2M11.4 22.8c1.5-1.2 3.4-.5 3.2 1.2-.2 1.5-2.2 1.6-2.5.1"
        stroke="var(--color-vina)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Hoja de vid: cinco lobulos con senos marcados, la silueta que la
          hace reconocible. Un ovalo liso no se lee como vid. */}
      <g className="hoja-vaiven">
        <path
          d="M20.4 26.8c-.9-1.5-1-2.9-.3-3.8-1.5.5-2.8.2-3.6-.8 1.2-.7 2.1-1.7 2.4-2.8-1.6-.2-2.8-1-3.2-2.3 1.4-.1 2.6-.6 3.4-1.4-1.4-.9-2.1-2.2-1.9-3.6 1.4.6 2.7.7 3.9.3-1-1.4-1.1-2.9-.2-4.1 1.1 1.2 2.3 1.9 3.5 2 -.1-1.7.6-3.1 2-3.8.6 1.5 1.4 2.6 2.5 3.1.6-1.6 1.9-2.5 3.5-2.5.1 1.6-.2 3-.9 3.9 1.6-.9 3.1-.7 4.2.4-1.1 1.2-1.7 2.5-1.7 3.7 1.6-.2 2.9.5 3.5 1.9-1.4.6-2.5 1.5-3 2.6z"
          fill="var(--color-vina)"
          fillOpacity={0.15}
          stroke="var(--color-vina)"
          strokeWidth={1.15}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Nervadura central desde el peciolo, con dos ramas. */}
        <path
          d="M20.5 26.6c2.3-3.4 4.9-6.3 8-8.6M24.4 21.4c1.2.6 2.6.7 3.9.3M26.6 18.4c.5-1.1.7-2.3.6-3.5"
          stroke="var(--color-vina)"
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.7}
        />
      </g>
    </svg>
  )
}

export function SearchIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function FiltersIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

export function CameraIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M14.5 4h-5L8 6.5H5a2 2 0 0 0-2 2V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3L14.5 4z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  )
}

export function CellarIcon({ size = 21, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 13h18M3 17h18" />
    </svg>
  )
}

export function GlassIcon({ size = 21, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M8 3h8l-1 7.5a4 4 0 0 1-6 0L8 3z" />
      <path d="M12 14v6M8.5 20h7" />
    </svg>
  )
}

/** Copa de puntuación: rellena cuando la nota la alcanza. */
export function RatingGlassIcon({
  size = 13,
  filled,
  className,
}: IconProps & { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3h8l-1 7.5a4 4 0 0 1-6 0L8 3z" />
      <path d="M12 14v6M9 20h6" />
    </svg>
  )
}

export function CorkscrewIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M9.5 3h5v4.5c0 1.6 2.5 2.8 2.5 5.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7c0-2.7 2.5-3.9 2.5-5.5V3z" />
      <path d="M12 3V1.5" />
    </svg>
  )
}

export function CheckIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function PlusIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function MinusIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function RetryIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function BarcodeIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6M11 9v6M15 9v6M18 9v6" />
    </svg>
  )
}

export function PairingIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M4 20V9a3 3 0 0 1 3-3h1V4h8v2h1a3 3 0 0 1 3 3v11z" />
      <path d="M4 14h16" />
    </svg>
  )
}

export function InfoIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5v.01M12 12v4" />
    </svg>
  )
}

export function TrashIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

export function SpinnerIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={className}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}

/** Botella del listado: vidrio claro para no fundirse con la madera. */
export function BottleIcon({
  glass,
  edge,
  width = 19,
  height = 46,
}: {
  glass: string
  edge: string
  width?: number
  height?: number
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 20 48" fill="none">
      <path
        d="M7.4 2h5.2v9.4c0 1.5 3.4 3.4 3.4 7.2V44a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V18.6c0-3.8 3.4-5.7 3.4-7.2V2z"
        fill={glass}
        stroke={edge}
        strokeWidth={1.2}
      />
      <rect x="3.6" y="26" width="12.8" height="14" rx="1.4" fill="#efe2ce" fillOpacity={0.9} />
      <path d="M6 30h8M6 33.5h5.5" stroke={edge} strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />
      <path d="M7.4 2h5.2v3.4H7.4z" fill={edge} />
      <path d="M6.2 20v22" stroke="#f7ecdd" strokeWidth={1.1} strokeLinecap="round" opacity={0.3} />
    </svg>
  )
}
