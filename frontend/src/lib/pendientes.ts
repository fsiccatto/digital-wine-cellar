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
