/**
 * Puntuar con medias copas.
 *
 * Cinco copas grandes, comodas para el dedo, pero diez valores posibles: tocar
 * una copa la llena entera, y volver a tocar la MISMA la deja por la mitad.
 * Asi un 4,5 son dos toques en la quinta, sin apuntar a medias copas de 15px.
 */

/** El valor que queda al tocar la copa `copa` estando en `actual`. */
export function alTocar(actual: number, copa: number): number {
  // Tocar la copa que ya esta entera la baja a media: es el segundo toque.
  if (actual === copa) return copa - 0.5
  // Tocar la que ya esta a la mitad la vuelve a llenar, para poder deshacer.
  if (actual === copa - 0.5) return copa
  // Cualquier otra copa: se llena hasta ahi.
  return copa
}

/** Cuanto se pinta una copa concreta para una puntuacion dada. */
export type Relleno = 'vacia' | 'media' | 'llena'

export function rellenoDe(copa: number, puntuacion: number): Relleno {
  if (puntuacion >= copa) return 'llena'
  if (puntuacion >= copa - 0.5) return 'media'
  return 'vacia'
}

/** "4,5" y no "4.5": es como se escribe un decimal en es-AR. */
export function formatPuntuacion(valor: number): string {
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })
}
