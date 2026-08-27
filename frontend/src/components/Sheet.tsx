import { useEffect } from 'react'

/**
 * El chrome del bottom sheet, que hoy se repite en cada hoja: el velo, el panel
 * anclado abajo y el ancho maximo de la app.
 *
 * Suma dos cosas que el sheet original no hacia: cerrar al tocar el velo, y
 * frenar el scroll del fondo mientras esta abierto (antes la cava seguia
 * moviendose detras de la hoja).
 */
export function Sheet({
  onClose,
  children,
  className = '',
}: {
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center bg-crema/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        // El tap dentro del panel no debe cerrar: solo el velo cierra.
        onClick={(event) => event.stopPropagation()}
        className={`hoja-cata w-full max-w-[430px] rounded-t-2xl border-t border-borde bg-madera-600 px-5 pt-6 pb-[30px] shadow-[0_-8px_30px_rgba(70,52,30,0.18)] ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
