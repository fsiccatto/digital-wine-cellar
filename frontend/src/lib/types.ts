/** Espeja los esquemas Pydantic de backend/app/schemas/wine_schema.py */

export interface WineRecord {
  id: string
  codigo_vino: string
  fecha_ingreso: string
  bodega: string
  nombre_vino: string
  varietal: string
  anada: number
  region: string
  alcohol: string
  cantidad: number
  ubicacion: string | null
  precio_estimado: number | null
  /** Ya viene firmada desde el backend; caduca, no conviene cachearla. */
  foto_url: string | null
}

/** Lo que Gemini pudo leer de la etiqueta: todo puede venir null. */
export interface WineScanResult {
  bodega: string | null
  nombre_vino: string | null
  varietal: string | null
  anada: number | null
  region: string | null
  alcohol: string | null
}

/** foto_url no va acá: la sube POST /wines/{codigo}/foto. */
export interface WineCreateInput {
  bodega: string
  nombre_vino: string
  varietal: string
  anada: number
  region: string
  alcohol: string
  cantidad: number
  ubicacion?: string | null
  precio_estimado?: number | null
}

export interface WineConsumeInput {
  puntuacion: number
  notas_cata?: string | null
  maridaje?: string | null
}

export interface ConsumeResult {
  status: string
  stock_restante: number
}

/** `cantidad` no va: el stock se mueve por PATCH /wines/{codigo}/stock. */
export interface WineUpdateInput {
  bodega: string
  nombre_vino: string
  varietal: string
  anada: number
  region: string
  alcohol: string
  ubicacion?: string | null
  precio_estimado?: number | null
}

export interface CataRecord {
  id_cata: string
  vino_id: string
  fecha_consumo: string
  /** Una fila cargada a mano en el Sheet puede no tener nota. */
  puntuacion: number | null
  notas_cata: string | null
  maridaje: string | null
  /** Del join contra el inventario; null si el vino ya no existe. */
  bodega: string | null
  nombre_vino: string | null
  anada: number | null
  /** Falso en una cata huerfana: el vino se borro pero la cata se conserva. */
  vino_existe: boolean
}

export interface DeleteResult {
  status: string
  codigo_vino: string
}
