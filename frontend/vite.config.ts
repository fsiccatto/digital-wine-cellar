import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En GitHub Pages el sitio cuelga de /<repo>/, no de la raiz: sin esto los
// assets se piden a rutas absolutas que no existen y la pagina queda en blanco.
// BASE_PATH lo pasa el workflow; en local queda en "/".
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // El backend corre en Docker en 8080; el proxy evita CORS en desarrollo.
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
