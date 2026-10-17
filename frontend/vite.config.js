import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { playwright } from '@vitest/browser-playwright'

const dirnameEsm = path.dirname(fileURLToPath(import.meta.url))

// OPFS (wa-sqlite) exige un "contexto seguro" -- sin esto, probar desde
// otro dispositivo en la red (celular, etc.) por http:// falla con
// "Cannot read properties of undefined (reading 'getDirectory')", porque
// navigator.storage ni siquiera existe fuera de localhost/https. .certs/
// es local y esta en .gitignore (clave privada) -- si no existe, cada
// quien sigue developando por http://localhost normal, sin romper nada.
// Nunca bajo Vitest: el runner "browser" (Playwright, para OPFS) levanta su
// propio servidor con ESTA MISMA config, y el certificado local no es de
// confianza para Playwright -- rompe la navegacion de cada prueba con
// "Target page, context or browser has been closed". process.env.VITEST lo
// pone Vitest solo, nunca hay que configurarlo a mano.
const certKeyPath = path.resolve(dirnameEsm, '.certs/dev-key.pem')
const certPath = path.resolve(dirnameEsm, '.certs/dev-cert.pem')
const httpsConfigLocal =
    !process.env.VITEST && fs.existsSync(certKeyPath) && fs.existsSync(certPath)
        ? { key: fs.readFileSync(certKeyPath), cert: fs.readFileSync(certPath) }
        : undefined

// https://vite.dev/config/
export default defineConfig({
  server: {
    https: httpsConfigLocal,
    // Rama experimental (sprint3-conteo-widgets): deja usar VITE_API_BASE_URL=''
    // para que el fetch vaya a una ruta relativa y Vite la reenvie al backend
    // del lado del servidor -- evita tener que agregar este puerto al
    // allowlist de CORS del backend compartido (ver WebConfig.java), que
    // sigue sirviendo la sesion de pruebas real en el puerto 5173.
    proxy: { '/api': 'http://localhost:8080' },
  },
  preview: { https: httpsConfigLocal },
  // Vite descubre estas dependencias de wa-sqlite recien a mitad de la
  // corrida de las pruebas "browser" (OPFS) y las reoptimiza, lo que fuerza
  // una recarga del test y puede tumbar el iframe del tester (timeout de
  // 60s). Declararlas de entrada evita esa reoptimizacion sobre la marcha.
  optimizeDeps: {
    include: [
      'wa-sqlite/dist/wa-sqlite.mjs',
      'wa-sqlite/src/examples/AccessHandlePoolVFS.js',
      'wa-sqlite/src/sqlite-api.js',
    ],
  },
  plugins: [
    react(),
    // HU-021 Etapa 3: service worker que precachea el "app shell"
    // (JS/CSS/HTML/fuentes/iconos) para que la app pueda ABRIRSE sin
    // conexion -- los criterios 1 y 2 de HU-021 (contar/consultar sin red)
    // no sirven de nada si el dispositivo ni siquiera puede cargar la
    // pagina. A proposito SIN runtimeCaching de /api/**: los datos ya
    // tienen su propia capa de almacenamiento offline, con su propio
    // aislamiento por usuario (ver baseDatosLocal.js/datosMaestrosRepositorio.js)
    // -- que el service worker ademas cacheara respuestas crudas del fetch
    // (con el header Authorization adentro) duplicaria esa logica y
    // arriesgaria servirle a un usuario datos cacheados de otro en el mismo
    // dispositivo.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CAPRIS Médica',
        short_name: 'CAPRIS',
        description: 'Gestión y control de reactivos para laboratorios',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f6f8',
        theme_color: '#0f426e',
        icons: [
          { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // wa-sqlite necesita su .wasm para que el almacenamiento local
        // (OPFS) funcione -- ver baseDatosLocal.js. Sin precachearlo
        // explicitamente, el primer arranque offline (o uno online donde el
        // cache HTTP normal del navegador ya lo desalojo) rompe TODA la
        // capa de datos local, no solo la sincronizacion.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,wasm}'],
      },
    }),
  ],
  test: {
    // La base del proyecto arranca sin pruebas todavia; que no falle mientras
    // cada equipo agrega las suyas (quitar esta linea una vez existan pruebas reales).
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    projects: [
      {
        // Componentes/logica normal: rapido, sin navegador real (jsdom).
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.js'],
          include: ['src/**/*.test.{js,jsx}'],
          exclude: ['src/**/*.browser.test.{js,jsx}'],
        },
      },
      {
        // Capa de almacenamiento local (wa-sqlite + OPFS): jsdom NO implementa OPFS,
        // asi que estas pruebas corren en un Chromium real via Playwright.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{js,jsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
