/**
 * La navegacion de la app vive en un `useState`, no en la URL. Instalada como
 * PWA eso tiene una consecuencia fea: el gesto de "atras" del telefono no
 * encuentra nada que desandar y **cierra la app**, aunque estes adentro de un
 * vino o de una hoja abierta.
 *
 * Estas funciones deciden que hace el "atras" en cada situacion. Viven aparte
 * del componente para poder probarlas: es logica facil de romper sin que se
 * note hasta que alguien pierde lo que estaba cargando.
 */

/** Lo que el gesto de "atras" tiene que hacer en un momento dado. */
export type PasoAtras =
  | { hacer: 'salir' }
  | { hacer: 'cerrar-capa' }
  | { hacer: 'ir-a-cava' }

/**
 * @param vista        pantalla actual
 * @param capaAbierta  si hay una hoja, un menu o el visor de foto encima
 *
 * Una capa abierta se cierra primero: es lo ultimo que abriste, y es lo que
 * espera cualquiera que aprieta atras. Recien despues se retrocede de pantalla.
 * Desde la cava sin nada abierto, atras sale de la app, como corresponde.
 */
export function pasoAtras(vista: string, capaAbierta: boolean): PasoAtras {
  if (capaAbierta) return { hacer: 'cerrar-capa' }
  if (vista !== 'cellar') return { hacer: 'ir-a-cava' }
  return { hacer: 'salir' }
}

/**
 * Si el estado actual necesita una entrada propia en el historial.
 *
 * Solo se empuja una entrada por "nivel": estar en un vino es un nivel, tener
 * una hoja abierta encima es otro. Sin esto, el navegador acumula entradas y
 * hay que apretar atras cinco veces para salir de una pantalla.
 */
export function necesitaEntrada(vista: string, capaAbierta: boolean): boolean {
  return capaAbierta || vista !== 'cellar'
}
