import { defineConfig } from 'cypress'

// Todo lo de Cypress vive contenido en esta carpeta (config, specs, fixtures,
// support) en vez de mezclarse con la raiz de frontend/. Aunque este archivo
// vive dentro de cypress/, --config-file no cambia el projectRoot: las rutas
// siguen siendo relativas a frontend/ (de donde se corre "npm run"), por eso
// llevan el prefijo "cypress/".
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    downloadsFolder: 'cypress/downloads',
  },
})
