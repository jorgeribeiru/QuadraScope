import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const deployedURL = process.env.E2E_BASE_URL
const existingAPI = process.env.E2E_API_PROXY
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: deployedURL || 'http://127.0.0.1:4178',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    {
      name: process.env.E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium',
      use:
        process.env.E2E_BROWSER === 'firefox'
          ? { ...devices['Desktop Firefox'] }
          : { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: deployedURL
    ? undefined
    : [
        ...(!existingAPI
          ? [
              {
                command:
                  'uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8018',
                cwd: fileURLToPath(new URL('..', import.meta.url)),
                url: 'http://127.0.0.1:8018/api/v1/health',
                reuseExistingServer: false,
              },
            ]
          : []),
        {
          command: 'npm run preview -- --port 4178',
          url: 'http://127.0.0.1:4178',
          env: { QUADRASCOPE_API_PROXY: existingAPI || 'http://127.0.0.1:8018' },
          reuseExistingServer: false,
        },
      ],
})
