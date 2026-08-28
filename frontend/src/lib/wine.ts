import type { CataRecord, WineRecord } from './types'

/** Tinte del vidrio segun el tipo de vino, para distinguirlos en el estante. */
export interface GlassTint {
  glass: string
  edge: string
}

const TINTO: GlassTint = { glass: '#7d2236', edge: '#c25068' }
const BLEND: GlassTint = { glass: '#8a4a1f', edge: '#d0873f' }
const BLANCO: GlassTint = { glass: '#6f7a3c', edge: '#a9bd6e' }

const BLANCOS = [
  'torrontes',
  'chardonnay',
  'sauvignon blanc',
  'viognier',
  'semillon',
  'riesling',
  'pinot gris',
  'gewurztraminer',
  'chenin',
  'moscatel',
]

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Un corte trae varias uvas en una celda: "Malbec & Cabernet Franc".
 *
 * Se parte por los separadores y NUNCA por el espacio: "Cabernet Sauvignon" es
 * una uva sola, y partirla la confundiria con "Cabernet Franc". Tambien se
 * descartan los conectores sueltos que quedan al separar ("y", "con").
 */
const SEPARADORES = /\s*(?:&|\+|\/|,|;|\by\b|\bcon\b)\s*/i

const CONECTORES = ['y', 'con', 'e']

export function splitVarietals(varietal: string): string[] {
  return varietal
    .split(SEPARADORES)
    .map((part) => part.trim())
    .filter((part) => part !== '' && !CONECTORES.includes(normalize(part)))
}

export function glassTint(varietal: string): GlassTint {
  const v = normalize(varietal)
  if (v.includes('blend') || v.includes('corte') || v.includes('rose')) return BLEND
  // Un corte de varias uvas es un corte aunque no diga "blend" en la etiqueta.
  if (splitVarietals(varietal).length > 1) return BLEND
  if (BLANCOS.some((blanco) => v.includes(blanco))) return BLANCO
  return TINTO
}

export interface Shelf {
  key: string
  label: string
  wines: WineRecord[]
  bottles: number
}

/**
 * Un codigo de estante es una letra y un numero opcional: A, A1, B12.
 * Cualquier otra cosa en `ubicacion` (una region escrita a mano en el Sheet,
 * por ejemplo) no se convierte en estante: se agrupa como su propio lugar.
 */
const SHELF_CODE = /^([A-Za-z])\s*(\d{0,3})$/

/** Estante = primera letra de un codigo tipo A1. Sin ubicacion, va aparte. */
export function groupByShelf(wines: WineRecord[]): Shelf[] {
  const shelves = new Map<string, WineRecord[]>()

  for (const wine of wines) {
    const location = (wine.ubicacion ?? '').trim()
    const code = SHELF_CODE.exec(location)
    // Con codigo se agrupa por letra; sin codigo, el texto tal cual es el grupo.
    const key = code ? code[1].toUpperCase() : location || '?'
    const existing = shelves.get(key)
    if (existing) {
      existing.push(wine)
    } else {
      shelves.set(key, [wine])
    }
  }

  const bottlesIn = (group: WineRecord[]) =>
    group.reduce((total, wine) => total + wine.cantidad, 0)

  return [...shelves.entries()]
    .sort(([a, groupA], [b, groupB]) => {
      // Un estante sin nada va al fondo, aunque su letra vaya antes.
      const emptyA = bottlesIn(groupA) <= 0 ? 1 : 0
      const emptyB = bottlesIn(groupB) <= 0 ? 1 : 0
      if (emptyA !== emptyB) return emptyA - emptyB
      // El grupo sin ubicacion queda al final.
      if (a === '?') return 1
      if (b === '?') return -1
      return a.localeCompare(b)
    })
    .map(([key, group]) => ({
      key,
      label:
        key === '?'
          ? 'Sin ubicar'
          : key.length === 1
            ? `Estante ${key}`
            : key, // texto libre: se muestra como vino, sin inventarle un estante
      // Las agotadas van al fondo del estante: ocupan lugar pero no son la foto.

      wines: [...group].sort((a, b) => {
        const emptyA = a.cantidad <= 0 ? 1 : 0
        const emptyB = b.cantidad <= 0 ? 1 : 0
        if (emptyA !== emptyB) return emptyA - emptyB
        return (a.ubicacion ?? '').localeCompare(b.ubicacion ?? '')
      }),
      bottles: group.reduce((total, wine) => total + wine.cantidad, 0),
    }))
}

export function totalBottles(wines: WineRecord[]): number {
  return wines.reduce((total, wine) => total + wine.cantidad, 0)
}

/**
 * Varietales presentes, para los chips de filtro. Un corte aporta cada una de
 * sus uvas, asi que el chip "Malbec" tambien encuentra los blends con Malbec.
 */
export function varietals(wines: WineRecord[]): string[] {
  const seen = new Map<string, string>()
  for (const wine of wines) {
    for (const varietal of splitVarietals(wine.varietal)) {
      const key = normalize(varietal)
      if (key && !seen.has(key)) seen.set(key, varietal)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/** Si el vino lleva esa uva, sea sola o dentro de un corte. */
export function hasVarietal(wine: WineRecord, varietal: string): boolean {
  const target = normalize(varietal)
  return splitVarietals(wine.varietal).some((part) => normalize(part) === target)
}

export function matchesSearch(wine: WineRecord, term: string): boolean {
  const q = normalize(term)
  if (!q) return true
  return [
    wine.bodega,
    wine.nombre_vino,
    wine.varietal,
    wine.region,
    wine.codigo_vino,
    String(wine.anada),
  ].some((field) => normalize(field ?? '').includes(q))
}

/** El Sheet se edita a mano: una fecha ilegible se omite en vez de mostrarse. */
export function formatDate(iso: string): string | null {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** El backend acepta anada >= 1900, pero una fila vieja del Sheet puede traer 0. */
export function formatYear(anada: number): string | null {
  return anada >= 1900 ? String(anada) : null
}

/** Dia y mes, para la fila de una cata: el año ya lo dice el rotulo del grupo. */
export function formatDayMonth(iso: string): string | null {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export interface CataMonth {
  key: string
  label: string
  catas: CataRecord[]
}

/**
 * El historico es una bitacora: la pregunta natural es "que tomamos ultimamente".
 * Las fechas ilegibles caen en un grupo al final, mismo criterio defensivo que
 * `groupByShelf` con las ubicaciones raras.
 */
export function groupByMonth(catas: CataRecord[]): CataMonth[] {
  const UNDATED = '?'
  const months = new Map<string, CataRecord[]>()

  for (const cata of catas) {
    const parsed = new Date(cata.fecha_consumo)
    const key = Number.isNaN(parsed.getTime())
      ? UNDATED
      : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    const existing = months.get(key)
    if (existing) {
      existing.push(cata)
    } else {
      months.set(key, [cata])
    }
  }

  return [...months.entries()]
    .sort(([a], [b]) => {
      if (a === UNDATED) return 1
      if (b === UNDATED) return -1
      return b.localeCompare(a) // mas reciente primero
    })
    .map(([key, group]) => {
      if (key === UNDATED) {
        return { key, label: 'Sin fecha', catas: group }
      }
      const [year, month] = key.split('-').map(Number)
      const label = new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
      })
      return { key, label, catas: group }
    })
}
