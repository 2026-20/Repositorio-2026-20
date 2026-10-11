import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
