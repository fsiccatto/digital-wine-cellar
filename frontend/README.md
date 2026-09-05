# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## `react/set-state-in-effect` esta apagada

Los efectos que la disparaban (`App.tsx`, `WineScreen.tsx`) arrancan una carga
contra la API y encienden su spinner. Eso es sincronizar con un sistema
externo, que es exactamente para lo que existe `useEffect`; la regla no
distingue ese caso de un valor que se podria derivar durante el render.

Se apago en la config y no linea por linea porque el `setState` vive dentro de
la funcion que el efecto llama (`load()`, `loadCatas()`), y ahi la supresion
por comentario no aplica.

El unico caso que si era real se arreglo en vez de silenciarlo: la preview de
`ScanScreen` se guardaba en estado pudiendo derivarse de la foto, y ahora sale
de un `useMemo`.
