import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './aceptacion',
  workers: 1,
  timeout: 45000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.QA_PORTAL ?? 'http://127.0.0.1:5175',
    trace: 'off',
    launchOptions: { executablePath: process.env.QA_CHROME_PATH },
  },
  projects: [{ name: 'Chromium', use: { ...devices['Desktop Chrome'] } }],
});
