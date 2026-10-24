import type { PendienteRecord, WineRecord } from './types'
import { formatYear, normalize } from './wine'

export function matchesPendienteSearch(pendiente: PendienteRecord, term: string): boolean {
  const q = normalize(term)
  if (!q) return true
  return [
    pendiente.nombre_vino,
    pendiente.bodega,
    pendiente.varietal,
    pendiente.region,
    pendiente.origen,
    pendiente.notas,
    pendiente.anada === null ? null : String(pendiente.anada),
  ].some((field) => normalize(field ?? '').includes(q))
}

export interface Comprado {
  pendiente: PendienteRecord
  /** Null si el vino se borro de la cava despues de comprarlo. */
  vino: WineRecord | null
}

/**
 * Lo que falta conseguir, los mas nuevos arriba, y aparte lo ya comprado.
 *
 * El comprado se resuelve contra la cava que la app ya tiene cargada: el
 * backend guarda el uuid del vino, y cruzarlo alla costaria otra lectura del
 * inventario.
 */
export function separarPendientes(
  lista: PendienteRecord[],
  wines: WineRecord[],
): { pendientes: PendienteRecord[]; comprados: Comprado[] } {
  const porId = new Map(wines.map((wine) => [wine.id, wine]))
  const nuevosPrimero = [...lista].sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta))
  return {
    pendientes: nuevosPrimero.filter((pendiente) => pendiente.vino_id === null),
    comprados: nuevosPrimero
      .filter((pendiente) => pendiente.vino_id !== null)
      .map((pendiente) => ({ pendiente, vino: porId.get(pendiente.vino_id!) ?? null })),
  }
}

/** "Malbec · 2019 · Mendoza", con lo que haya: casi nunca esta todo. */
export function detallePendiente(pendiente: PendienteRecord): string {
  const anada = pendiente.anada === null ? null : formatYear(pendiente.anada)
  return [pendiente.varietal, anada, pendiente.region].filter(Boolean).join(' · ')
}

/** `corto` aparece entero adentro de `largo`, palabra por palabra. */
function contiene(largo: string, corto: string): boolean {
  return ` ${largo} `.includes(` ${corto} `)
}

/**
 * El vino de la cava que parece ser este pendiente, si hay uno.
 *
 * Lo recomendado de palabra casi nunca trae bodega, uva y añada, asi que no
 * sirve la comparacion de la carga: va por el nombre, solo o con la bodega
 * adelante ("Luca Beso de Dante" contra Luca · Beso de Dante). Uno contenido en
 * el otro tambien cuenta si tiene al menos dos palabras: "Malbec" solo
 * coincidiria con media cava. Si el pendiente dice la bodega, tiene que ser
 * la misma. Es un aviso y no un bloqueo, asi que equivocarse de mas es barato.
 */
export function yaEnLaCava(
  wines: WineRecord[],
  datos: { nombre_vino: string; bodega: string },
): WineRecord | null {
  const nombre = normalize(datos.nombre_vino)
  if (!nombre) return null
  const bodega = normalize(datos.bodega)

  const parecidos = wines.filter((wine) => {
    if (bodega && normalize(wine.bodega) !== bodega) return false
    return [normalize(wine.nombre_vino), normalize(`${wine.bodega} ${wine.nombre_vino}`)].some(
      (candidato) => {
        if (candidato === nombre) return true
        const [corto, largo] =
          candidato.length < nombre.length ? [candidato, nombre] : [nombre, candidato]
        return corto.split(/\s+/).length >= 2 && contiene(largo, corto)
      },
    )
  })
  // El que tiene botellas primero: es el que conviene saber que esta.
  return [...parecidos].sort((a, b) => b.cantidad - a.cantidad)[0] ?? null
}
