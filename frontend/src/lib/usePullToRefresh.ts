import { useEffect, useRef, useState } from 'react'

/** Cuanto hay que arrastrar para que suelte la recarga. */
const UMBRAL = 64
/** Hasta donde acompaña el indicador, por mas que se siga tirando. */
const TOPE = 96
/** El arrastre no es 1 a 1: cuesta, y por eso se siente elastico. */
const RESISTENCIA = 0.45

/**
 * Tirar hacia abajo para recargar.
 *
 * Hace falta porque la base de datos es una planilla que se puede editar a
 * mano: si tocas una fila en Google Sheets, la app no se entera hasta que la
 * cerras y la volves a abrir. Instalada como PWA no hay barra de direcciones
 * donde apretar recargar, asi que sin esto no habia ningun camino.
 *
 * El gesto solo arranca estando arriba de todo; en cualquier otra posicion el
 * dedo es un scroll normal y no se toca.
 */
export function usePullToRefresh(
  refrescar: () => void,
  habilitado: boolean,
): { tiron: number; alcanzo: boolean } {
  const [tiron, setTiron] = useState(0)
  const desde = useRef<number | null>(null)
  const arrastre = useRef(0)

  // En una ref por lo mismo de siempre: `refrescar` cambia de identidad en cada
  // render y no tiene por que volver a colgar los listeners.
  const alRefrescar = useRef(refrescar)
  useEffect(() => {
    alRefrescar.current = refrescar
  })

  useEffect(() => {
    if (!habilitado) return

    const empezar = (evento: TouchEvent) => {
      desde.current =
        window.scrollY <= 0 && evento.touches.length === 1
          ? evento.touches[0].clientY
          : null
      arrastre.current = 0
    }

    const mover = (evento: TouchEvent) => {
      if (desde.current === null) return

      const recorrido = evento.touches[0].clientY - desde.current
      if (recorrido <= 0) {
        // Cambio de idea y empezo a subir: el gesto vuelve a ser del scroll.
        desde.current = null
        arrastre.current = 0
        setTiron(0)
        return
      }

      // Sin esto el navegador monta su propio rebote encima del nuestro.
      if (evento.cancelable) evento.preventDefault()
      arrastre.current = Math.min(TOPE, recorrido * RESISTENCIA)
      setTiron(arrastre.current)
    }

    const soltar = () => {
      if (desde.current !== null && arrastre.current >= UMBRAL) {
        alRefrescar.current()
      }
      desde.current = null
      arrastre.current = 0
      setTiron(0)
    }

    // `mover` necesita cancelar el rebote nativo, y para eso no puede ser pasivo.
    window.addEventListener('touchstart', empezar, { passive: true })
    window.addEventListener('touchmove', mover, { passive: false })
    window.addEventListener('touchend', soltar)
    window.addEventListener('touchcancel', soltar)

    return () => {
      window.removeEventListener('touchstart', empezar)
      window.removeEventListener('touchmove', mover)
      window.removeEventListener('touchend', soltar)
      window.removeEventListener('touchcancel', soltar)
    }
  }, [habilitado])

  return { tiron, alcanzo: tiron >= UMBRAL }
}
