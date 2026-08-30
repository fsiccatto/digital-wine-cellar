import { useEffect } from 'react'

/**
 * Cierra una capa (hoja, menu, visor) con el gesto de "atras" del telefono.
 *
 * Instalada como PWA, "atras" cierra la app si no hay nada que desandar. Una
 * hoja abierta empuja su propia entrada al historial mientras vive, asi que el
 * gesto la cierra en vez de sacarte de la app — que es lo que espera cualquiera
 * que la abrio hace dos segundos.
 *
 * Se usa donde vive la capa y no en App, porque el estado de las hojas es local
 * de cada pantalla; levantarlo entero seria un refactor mas grande por el mismo
 * resultado.
 */
export function useBackToClose(abierta: boolean, cerrar: () => void): void {
  useEffect(() => {
    if (!abierta) return

    window.history.pushState({ capa: true }, '')

    const alVolver = () => cerrar()
    window.addEventListener('popstate', alVolver)

    return () => {
      window.removeEventListener('popstate', alVolver)
      // Si la capa se cerro con el boton y no con el gesto, hay que consumir la
      // entrada que quedo colgada, o el proximo "atras" no hace nada visible.
      if (window.history.state?.capa) window.history.back()
    }
  }, [abierta, cerrar])
}
