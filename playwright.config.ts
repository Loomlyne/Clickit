import { defineConfig, devices } from '@playwright/test'

const isSmokeRun = process.env.PLAYWRIGHT_SMOKE === '1'
const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const webServerCommand = isSmokeRun ? 'npm run start' : 'npm run dev'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${playwrightPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `${webServerCommand} -- --hostname 127.0.0.1 --port ${playwrightPort}`,
    port: playwrightPort,
    reuseExistingServer: !process.env.CI && !isSmokeRun,
    timeout: 120_000,
  },
})
