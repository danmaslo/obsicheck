import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  testMatch: '*.spec.mjs',
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', viewport: { width: 1000, height: 850 } },
  webServer: { command: 'node tests/ui/server.mjs', url: 'http://127.0.0.1:4178', reuseExistingServer: false },
});
