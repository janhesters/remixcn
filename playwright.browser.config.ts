import { defineConfig } from 'playwright/test'

import shared from './playwright.config.ts'

// The browser lane's runner page lists a row for every finished test file and
// suite above the frame of the file that runs next. In Playwright's default
// 1280 by 720 window the later frames end up below the window, where WebKit
// throttles their animation frames, and the lane stalls at its 90-second
// progress timeout. A tall window keeps the running frame in view.
// test:browser passes this file with --playwrightConfig. End-to-end tests
// keep the default window from playwright.config.ts, which remix.json names.
export default defineConfig({
  ...shared,
  use: { ...shared.use, viewport: { width: 1280, height: 4000 } },
})
