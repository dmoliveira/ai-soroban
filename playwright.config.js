import { defineConfig } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:4321/soroban-dojo/';
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL || localBaseURL;
const baseURL = configuredBaseURL.endsWith('/') ? configuredBaseURL : `${configuredBaseURL}/`;
const usesExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  webServer: usesExternalServer ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4321',
    url: localBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
