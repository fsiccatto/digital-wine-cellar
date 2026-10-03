/**
 * Lo que dice la pantalla de carga segun cuanto lleva esperando.
 *
 * Casi siempre la lista llega en menos de un segundo. Cuando no, es que el
 * backend estaba dormido (`min-instances=0`) y tarda varios: decirlo hace que
 * la espera se lea como algo que pasa y no como algo colgado.
 */
export const DESPERTANDO_MS = 3500
export const TARDANDO_MS = 12000

export function avisoDeCarga(aviso: string, transcurrido: number): string {
  if (transcurrido >= TARDANDO_MS) return 'Está tardando más de lo normal…'
  if (transcurrido >= DESPERTANDO_MS) return 'La bodega estaba dormida, ya abre…'
  return aviso
}
