import type {
  CataCreateInput,
  CataRecord,
  CataUpdateInput,
  ConsumeResult,
  DeleteCataResult,
  DeleteResult,
  WineConsumeInput,
  WineCreateInput,
  WineRecord,
  WineScanResult,
  WineUpdateInput,
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

// El token vive en el navegador de cada uno; el backend lo exige en cada pedido.
const TOKEN_KEY = 'cava.token'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    // Modo privado o cookies bloqueadas: se sigue sin token.
    return ''
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim())
  } catch {
    // Sin storage la sesion no persiste, pero la app arranca igual.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nada que limpiar si el storage no esta disponible.
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
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('X-App-Token', token)

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('No se pudo contactar al servidor.', 0)
  }

  if (response.status === 401) {
    // Token vencido o equivocado: se descarta para volver a pedirlo.
    clearToken()
    throw new ApiError('La clave no es correcta.', 401)
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

export function updateWine(
  codigoVino: string,
  payload: WineUpdateInput,
): Promise<WineRecord> {
  return request<WineRecord>(`/api/wines/${encodeURIComponent(codigoVino)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteWine(codigoVino: string): Promise<DeleteResult> {
  return request<DeleteResult>(`/api/wines/${encodeURIComponent(codigoVino)}`, {
    method: 'DELETE',
  })
}

/** `delta` es relativo: un absoluto pisaria un cambio hecho desde otro lado. */
export function adjustStock(codigoVino: string, delta: number): Promise<WineRecord> {
  return request<WineRecord>(`/api/wines/${encodeURIComponent(codigoVino)}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  })
}

export function listCatas(): Promise<CataRecord[]> {
  return request<CataRecord[]>('/api/catas')
}

export function listWineCatas(codigoVino: string): Promise<CataRecord[]> {
  return request<CataRecord[]>(`/api/wines/${encodeURIComponent(codigoVino)}/catas`)
}

/** Registra una cata sin descontar stock, a diferencia de consumeWine. */
export function addCata(
  codigoVino: string,
  payload: CataCreateInput,
): Promise<CataRecord> {
  return request<CataRecord>(`/api/wines/${encodeURIComponent(codigoVino)}/catas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateCata(
  idCata: string,
  payload: CataUpdateInput,
): Promise<CataRecord> {
  return request<CataRecord>(`/api/catas/${encodeURIComponent(idCata)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteCata(idCata: string): Promise<DeleteCataResult> {
  return request<DeleteCataResult>(`/api/catas/${encodeURIComponent(idCata)}`, {
    method: 'DELETE',
  })
}
