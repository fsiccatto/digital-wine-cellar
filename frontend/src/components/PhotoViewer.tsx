import { useEffect } from 'react'
import { useBackToClose } from '../lib/useBackToClose'
import { CloseIcon } from './icons'

/**
 * La etiqueta a pantalla completa.
 *
 * Va con `object-contain` y no `object-cover`: la miniatura de la ficha recorta
 * los bordes para llenar su recuadro, y esto es justamente para poder ver la
 * etiqueta entera. La foto ya esta guardada en calidad completa; lo que faltaba
 * era una forma de mirarla.
 */
export function PhotoViewer({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  // El gesto de "atras" cierra el visor en vez de salir de la app.
  useBackToClose(true, onClose)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-madera-950/95 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-madera-700/90 text-tenue-400"
      >
        <CloseIcon size={15} />
      </button>

      <img
        src={src}
        alt={alt}
        // El tap sobre la foto no cierra: se cierra por el velo o por la X.
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain shadow-[0_10px_40px_rgba(70,52,30,0.3)]"
      />
    </div>
  )
}
