import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: process.env['KHKI_BASE_URL'] || 'http://127.0.0.1:4200', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../test-results/playwright' }]]
});
