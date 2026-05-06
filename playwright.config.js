const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8000',
    cwd: './app',
    port: 8000,
    reuseExistingServer: true,
  },
});
