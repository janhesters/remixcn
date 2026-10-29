import { defineConfig } from 'playwright/test'

// The browser and end-to-end lanes run in every engine RemixCN supports. CI
// runs each project in its own job; `--project chromium` picks one locally.
export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    navigationTimeout: 10_000,
    actionTimeout: 5_000,
  },
})
