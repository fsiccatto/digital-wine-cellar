import { useEffect, useRef } from 'react'

/**
 * La devolucion de la entrada al historial, pendiente de un tick.
 *
 * Vive en el modulo y no en el hook porque una sola capa esta abierta a la vez
 * en toda la app, y hay dos momentos en que la limpieza corre sin que la capa
 * se este cerrando de verdad:
 *
 * - En desarrollo StrictMode monta el efecto, lo limpia y lo vuelve a montar.
 *   Consumiendo la entrada en el acto, el remontaje empujaba otra y el popstate
 *   que salia de ahi cerraba la hoja apenas abierta.
 * - Si una capa se cierra y otra se abre en el mismo tick, la segunda reusa la
 *   entrada de la primera en vez de apilar una que despues sobra.
 *
 * Diferirla un tick alcanza para distinguir "esto se cierra" de "esto sigue
 * vivo y se volvio a montar".
 */
let devolucionPendiente: ReturnType<typeof setTimeout> | null = null

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
  // `cerrar` casi siempre llega como `() => setSheet(null)`, o sea una funcion
  // nueva en cada render. Si estuviera en las dependencias, cualquier re-render
  // con la hoja abierta re-ejecutaria el efecto, y su limpieza llama
  // `history.back()`: eso dispara el popstate que App lee como "volver a la
  // cava", y la hoja te escupe a la lista. Guardada en una ref, el efecto
  // depende solo de si la capa esta abierta, que es lo unico que deberia
  // moverlo.
  const alCerrar = useRef(cerrar)

  // Se actualiza despues del render y no durante: tocar una ref en pleno render
  // es lo que avisa el linter, y va primero para que el efecto de abajo ya la
  // encuentre al dia en el montaje.
  useEffect(() => {
    alCerrar.current = cerrar
  })

  useEffect(() => {
    if (!abierta) return

    if (devolucionPendiente !== null) {
      clearTimeout(devolucionPendiente)
      devolucionPendiente = null
    } else {
      window.history.pushState({ capa: true }, '')
    }

    const alVolver = () => alCerrar.current()
    window.addEventListener('popstate', alVolver)

    return () => {
      window.removeEventListener('popstate', alVolver)
      // Si la capa se cerro con el boton y no con el gesto, hay que consumir la
      // entrada que quedo colgada, o el proximo "atras" no hace nada visible.
      // Con el gesto ya no queda ninguna `capa` arriba, asi que no se toca.
      devolucionPendiente = setTimeout(() => {
        devolucionPendiente = null
        if (window.history.state?.capa) window.history.back()
      }, 0)
    }
  }, [abierta])
}
