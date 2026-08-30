/*
 * Service worker minimo. Existe por dos razones: Chrome exige uno con handler
 * de `fetch` para ofrecer instalar la app, y permite que la app ABRA sin senal.
 *
 * Regla dura: NO se cachea nada de la API. El backend vive en otro origen
 * (Cloud Run), asi que el filtro por origen de mas abajo lo deja afuera entero,
 * y con el las signed URLs de GCS. Eso es lo que garantiza que el flujo del 401
 * y el stock que se ve sean siempre los de verdad, no una copia vieja.
 */

const CACHE = 'cava-v1'

// Se resuelven contra la ubicacion del sw.js, que en Pages cuelga de
// /digital-wine-cellar/. Nada de rutas absolutas: romperian en el subdirectorio.
const SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Que falte uno de estos no debe abortar la instalacion entera.
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // 1. Solo GET: nunca tocar el POST de una cata ni la subida de una foto.
  if (request.method !== 'GET') return

  // 2. Solo el mismo origen. Deja pasar de largo la API en Cloud Run, las
  //    fotos firmadas de GCS y las fuentes de Google.
  if (new URL(request.url).origin !== self.location.origin) return

  // 3. Navegacion: red primero, y si no hay senal el shell cacheado. La app
  //    abre y muestra su propio error de red, que es mejor que un stock viejo.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((hit) => hit ?? Response.error())),
    )
    return
  }

  // 4. Assets propios: cache primero. Es seguro porque Vite les pone hash en el
  //    nombre, asi que una version nueva es una URL nueva y nunca hay stale.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
