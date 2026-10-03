/** Si la espera se alarga es un arranque en frio: decirlo evita que parezca colgada. */
export const DESPERTANDO_MS = 3500
export const TARDANDO_MS = 12000

export function avisoDeCarga(aviso: string, transcurrido: number): string {
  if (transcurrido >= TARDANDO_MS) return 'Está tardando más de lo normal…'
  if (transcurrido >= DESPERTANDO_MS) return 'La bodega estaba dormida, ya abre…'
  return aviso
}
