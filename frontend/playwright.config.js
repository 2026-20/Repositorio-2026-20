import { defineConfig, devices } from '@playwright/test'

// Pruebas E2E de flujos completos (login -> contexto -> conteo -> transmision).
// Alcance real del proyecto: solo Android/Windows via Chromium, por eso un solo proyecto "chromium".
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
