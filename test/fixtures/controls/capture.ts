// Captures the controls showcase in headless Chromium for UI reviews: the
// desktop and narrow pages in both themes, keyboard focus in a toggle group
// in dark mode, the page in forced colors, right-to-left text in dark mode,
// and the native form at 200% text. Run `bun run capture:controls`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createControls } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this section, after an optional interaction.
  section?: string
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'toggle-group-keyboard-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    section: 'toggle-group',
    async prepare(page) {
      // Tab into the first group, then move with the arrow keys and press Space.
      await page.getByRole('heading', { name: 'Multiple' }).click()
      await page.keyboard.press('Tab')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Space')
    },
  },
  { name: 'forced-colors', width: desktop, colorScheme: 'light', forcedColors: 'active' },
  { name: 'right-to-left-dark', width: narrow, colorScheme: 'dark', section: 'right-to-left' },
  {
    name: 'native-form-narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    section: 'native-form',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/controls/', import.meta.url))
mkdirSync(output, { recursive: true })

let controls = await createControls()
let server = await createTestServer(controls.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.section) {
      // A margin keeps focus rings, which sit outside their controls, in the picture.
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      let clip = await page.locator(`section[aria-labelledby="${shot.section}"]`).evaluate((section) => {
        let box = section.getBoundingClientRect()
        let margin = 16
        return {
          x: Math.max(0, box.x + window.scrollX - margin),
          y: box.y + window.scrollY - margin,
          width: Math.min(box.width + 2 * margin, document.documentElement.clientWidth),
          height: box.height + 2 * margin,
        }
      })
      await page.screenshot({ path, clip, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/controls/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await controls.close()
}
