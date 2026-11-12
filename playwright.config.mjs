import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/resultats',
  use: { baseURL: 'http://localhost:4173/superchef/' },
  webServer: { command: 'node tests/serveur.mjs', url: 'http://localhost:4173/superchef/', reuseExistingServer: true },
  projects: [
    // Galaxy S25 : 360 × 780 CSS px, densité 3.
    { name: 's25', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 } },
    { name: 'pc-1440', use: { viewport: { width: 1440, height: 900 } } }
  ]
});
