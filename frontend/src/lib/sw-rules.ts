/**
 * La decision de si el service worker toca un pedido, aparte del worker mismo
 * para poder probarla. `public/sw.js` implementa exactamente estas reglas.
 *
 * La que importa es 'pasar': todo lo que va al backend o al bucket tiene que
 * salir por ahi, sin cache. Un dato viejo en una cava que se edita desde el
 * telefono es peor que un error de red.
 */
export type AccionSW = 'pasar' | 'shell' | 'cache'

export function accionPara(
  request: { method: string; url: string; mode?: string },
  origen: string,
): AccionSW {
  if (request.method !== 'GET') return 'pasar'
  if (new URL(request.url).origin !== origen) return 'pasar'
  if (request.mode === 'navigate') return 'shell'
  return 'cache'
}
