/** Espeja los esquemas Pydantic de backend/app/schemas/wine_schema.py */

export interface WineRecord {
  id: string
  codigo_vino: string
  fecha_ingreso: string
  bodega: string
  nombre_vino: string
  varietal: string
  anada: number
  /** Null en un vino sin etiqueta: no hay de donde sacarlas. */
  region: string | null
  alcohol: string | null
  cantidad: number
  ubicacion: string | null
  precio_estimado: number | null
  /** Ya viene firmada desde el backend; caduca, no conviene cachearla. */
  foto_url: string | null
  /** Como se la reconoce en el estante: lo escrito con fibra, una cinta. */
  distintivo: string | null
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
  region?: string | null
  alcohol?: string | null
  cantidad: number
  ubicacion?: string | null
  precio_estimado?: number | null
  distintivo?: string | null
}

export interface WineConsumeInput {
  /** Sin puntuacion: se tomo, pero sin ganas de puntuarlo. */
  puntuacion?: number | null
  notas_cata?: string | null
  maridaje?: string | null
  /** Sin fecha, la pone el servidor. */
  fecha_consumo?: string | null
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
  region?: string | null
  alcohol?: string | null
  ubicacion?: string | null
  precio_estimado?: number | null
  distintivo?: string | null
}

export interface CataRecord {
  id_cata: string
  /** El uuid del vino catado. NO sirve para pedir /api/wines/{}: para eso va
   *  `codigo_vino`, que sale del join. Las catas viejas todavia guardan aca el
   *  codigo, y el backend las resuelve igual. */
  vino_id: string
  fecha_consumo: string
  /** Una fila cargada a mano en el Sheet puede no tener nota. */
  puntuacion: number | null
  notas_cata: string | null
  maridaje: string | null
  /** Del join contra el inventario; null si el vino ya no existe. */
  codigo_vino: string | null
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

/** Lo que se puede corregir de una cata: todo menos el vino. */
export interface CataUpdateInput {
  /** Sin puntuacion: se tomo, pero sin ganas de puntuarlo. */
  puntuacion?: number | null
  notas_cata?: string | null
  maridaje?: string | null
  /** Sin fecha queda la que tenia. */
  fecha_consumo?: string | null
}

/** Una cata suelta, sin descontar stock. Sin fecha, la pone el servidor. */
export interface CataCreateInput {
  /** Sin puntuacion: se tomo, pero sin ganas de puntuarlo. */
  puntuacion?: number | null
  notas_cata?: string | null
  maridaje?: string | null
  fecha_consumo?: string | null
}

export interface DeleteCataResult {
  status: string
  id_cata: string
}

/** Un vino que todavia no esta en la cava: probado afuera o recomendado. */
export interface PendienteRecord {
  id: string
  fecha_alta: string
  /** Lo unico seguro: lo recomendado de palabra no trae mas. */
  nombre_vino: string
  bodega: string | null
  varietal: string | null
  anada: number | null
  region: string | null
  alcohol: string | null
  /** Quien lo recomendo o donde se probo. */
  origen: string | null
  /** Con puntuacion se probo, y al comprarlo pasa a ser una cata. */
  puntuacion: number | null
  notas: string | null
  maridaje: string | null
  fecha_probado: string | null
  /** Firmada solo mientras esta pendiente. */
  foto_url: string | null
  /** El uuid del vino de la cava; null mientras esta pendiente. */
  vino_id: string | null
}

/** Crear y editar mandan lo mismo: editar reemplaza todos los campos. */
export interface PendienteInput {
  nombre_vino: string
  bodega?: string | null
  varietal?: string | null
  anada?: number | null
  region?: string | null
  alcohol?: string | null
  origen?: string | null
  puntuacion?: number | null
  notas?: string | null
  maridaje?: string | null
  /** Sin fecha y con puntuacion, la pone el servidor. */
  fecha_probado?: string | null
}

export interface DeletePendienteResult {
  status: string
  id: string
}
