import { describe, expect, it } from 'vitest'
import { accionPara } from './sw-rules'

const APP = 'https://fsiccatto.github.io'
const req = (url: string, method = 'GET', mode?: string) => ({ url, method, mode })

describe('accionPara', () => {
  it('no toca la API: vive en otro origen', () => {
    const api = 'https://digital-wine-cellar-backend-x.run.app/api/wines'
    expect(accionPara(req(api), APP)).toBe('pasar')
  })

  it('no toca las fotos firmadas del bucket', () => {
    // Cachear una URL firmada garantiza un 403 cuando caduca en una hora.
    const foto = 'https://storage.googleapis.com/bucket/etiquetas/X.jpg?X-Goog-Signature=a'
    expect(accionPara(req(foto), APP)).toBe('pasar')
  })

  it('no toca las fuentes de Google', () => {
    expect(accionPara(req('https://fonts.gstatic.com/s/karla.woff2'), APP)).toBe('pasar')
  })

  it('deja pasar cualquier cosa que no sea GET', () => {
    // Descorchar, subir una foto, borrar un vino.
    const api = `${APP}/api/wines`
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(accionPara(req(api, metodo), APP)).toBe('pasar')
    }
  })

  it('la navegacion cae al shell si no hay senal', () => {
    expect(accionPara(req(`${APP}/digital-wine-cellar/`, 'GET', 'navigate'), APP)).toBe('shell')
  })

  it('cachea los assets propios, que llevan hash', () => {
    const asset = `${APP}/digital-wine-cellar/assets/index-abc123.js`
    expect(accionPara(req(asset), APP)).toBe('cache')
  })
})
