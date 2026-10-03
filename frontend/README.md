# Frontend

La PWA de Mi Cava Virtual. Cómo correrla está en el README de la raíz.

## `react/set-state-in-effect` esta apagada

Los efectos que la disparaban (`App.tsx`, `WineScreen.tsx`) arrancan una carga
contra la API y encienden su indicador de carga. Eso es sincronizar con un sistema
externo, que es exactamente para lo que existe `useEffect`; la regla no
distingue ese caso de un valor que se podria derivar durante el render.

Se apago en la config y no linea por linea porque el `setState` vive dentro de
la funcion que el efecto llama (`load()`, `loadCatas()`), y ahi la supresion
por comentario no aplica.

El unico caso que si era real se arreglo en vez de silenciarlo: la preview de
`ScanScreen` se guardaba en estado pudiendo derivarse de la foto, y ahora sale
de un `useMemo`.
