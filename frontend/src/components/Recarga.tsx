import { RetryIcon, SpinnerIcon } from './icons'

/**
 * El disco que baja mientras se tira para recargar.
 *
 * Va sobre el contenido y no lo empuja: mover la lista entera con un transform
 * en cada touchmove se nota en un telefono modesto, y el gesto se entiende
 * igual viendo bajar el disco.
 */
export function IndicadorRecarga({
  tiron,
  alcanzo,
  refrescando,
}: {
  tiron: number
  alcanzo: boolean
  refrescando: boolean
}) {
  const visible = refrescando || tiron > 0
  if (!visible) return null

  // Al refrescar se queda en una posicion fija; mientras se tira, sigue al dedo.
  const y = refrescando ? 34 : tiron

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-20 mx-auto flex max-w-[430px] justify-center"
      style={{ transform: `translateY(${y}px)` }}
    >
      <div
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border bg-madera-600 shadow-[0_3px_10px_rgba(70,52,30,0.16)] ${
          alcanzo || refrescando
            ? 'border-borra-600 text-oro'
            : 'border-borde text-tenue-500'
        }`}
        style={{
          // Antes del umbral la flecha gira acompañando; despues se queda.
          opacity: refrescando ? 1 : Math.min(1, tiron / 34),
        }}
      >
        {refrescando ? (
          <SpinnerIcon size={14} className="animate-spin" />
        ) : (
          // El giro va en un envoltorio: los iconos toman size y className, y
          // no vale ampliarles la API por un caso.
          <span
            className="flex"
            style={{ transform: `rotate(${Math.min(180, tiron * 2.8)}deg)` }}
          >
            <RetryIcon size={14} />
          </span>
        )}
      </div>
    </div>
  )
}
