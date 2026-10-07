import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'off',
    trace: 'off',
  },
  webServer: process.env.BLOG_TEST_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'npm run dev -- --port 4321',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
