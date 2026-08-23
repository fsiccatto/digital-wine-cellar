import type {
  ConsumeResult,
  WineConsumeInput,
  WineCreateInput,
  WineRecord,
  WineScanResult,
} from './types'

// En desarrollo el proxy de Vite redirige /api al backend; en produccion se
// apunta al Cloud Run con VITE_API_BASE.
const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** FastAPI devuelve el motivo en `detail`, como string o como lista de errores. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json()
    const detail = body?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => item?.msg ?? '')
        .filter(Boolean)
        .join('. ')
    }
  } catch {
    // Sin cuerpo JSON: se cae al mensaje genérico de abajo.
  }
  return `La petición falló (${response.status}).`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError('No se pudo contactar al servidor.', 0)
  }

  if (!response.ok) {
    throw new ApiError(await readErrorDetail(response), response.status)
  }
  return response.json() as Promise<T>
}

export function listWines(): Promise<WineRecord[]> {
  return request<WineRecord[]>('/api/wines')
}

export function getWine(codigoVino: string): Promise<WineRecord> {
  return request<WineRecord>(`/api/wines/${encodeURIComponent(codigoVino)}`)
}

export function scanLabel(file: File): Promise<WineScanResult> {
  const body = new FormData()
  body.append('file', file)
  return request<WineScanResult>('/api/scan-label', { method: 'POST', body })
}

export function createWine(payload: WineCreateInput): Promise<WineRecord> {
  return request<WineRecord>('/api/wines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function uploadLabelPhoto(codigoVino: string, file: File): Promise<WineRecord> {
  const body = new FormData()
  body.append('file', file)
  return request<WineRecord>(
    `/api/wines/${encodeURIComponent(codigoVino)}/foto`,
    { method: 'POST', body },
  )
}

export function consumeWine(
  codigoVino: string,
  payload: WineConsumeInput,
): Promise<ConsumeResult> {
  return request<ConsumeResult>(
    `/api/wines/${encodeURIComponent(codigoVino)}/consume`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
}
