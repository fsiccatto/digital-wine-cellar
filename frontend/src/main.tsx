import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// El service worker solo en produccion: en `npm run dev` pelear con su cache
// es una fuente de confusion y no aporta nada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // BASE_URL trae el subdirectorio de Pages; registrarlo en la raiz dejaria
    // el scope afuera y el navegador lo rechazaria.
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Sin service worker la app anda igual: solo no se puede instalar.
    })
  })
}
