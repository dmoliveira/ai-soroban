import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4322',
    headless: true,
  },
  webServer: {
    command: 'ASTRO_DISABLE_DEV_TOOLBAR=1 npm run dev -- --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322/ai-soroban/worksheets',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
