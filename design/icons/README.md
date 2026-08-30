# Iconos de la PWA

`icon-maskable.svg` es el fuente del icono *maskable*: la misma copa del
`favicon.svg` pero al 62% y sin las esquinas redondeadas, porque Android recorta
los maskable a un circulo que solo garantiza el 80% central y la mascara la pone
el sistema.

Los PNG de `frontend/public/` se generan una sola vez y se commitean; no hay
razon para rasterizarlos en cada build:

```bash
cd frontend/public
npx --yes @resvg/resvg-js-cli favicon.svg icon-192.png --fit-width 192
npx --yes @resvg/resvg-js-cli favicon.svg icon-512.png --fit-width 512
npx --yes @resvg/resvg-js-cli ../../design/icons/icon-maskable.svg icon-maskable-512.png --fit-width 512
```
