// Captures the Slider examples in headless Chromium for UI reviews: desktop
// and narrow pages in both themes, a range thumb moved with the keyboard
// while it keeps focus in dark mode, the form in forced colors with a focused
// thumb, and the examples on a narrow screen with text at 200%.
// Run `bun run capture:slider-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createSliderExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this element, after preparing its state.
  clip?: string
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

/** Moves focus to a thumb in an example with Tab, as a keyboard user does, then presses keys. */
async function focusThumb(page: Page, example: string, name: string, keys: string[]) {
  await page.locator(`[data-example="${example}"]`).getByRole('slider', { name, exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  for (let key of keys) await page.keyboard.press(key)
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'range-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="Multiple thumbs"]',
    prepare: (page) => focusThumb(page, 'Multiple thumbs', 'Second delivery', ['PageUp', 'PageUp', 'PageUp', 'PageUp']),
  },
  {
    name: 'form-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-example="Form"]',
    prepare: (page) => focusThumb(page, 'Form', 'Maximum price', ['PageDown']),
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="examples"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/slider/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createSliderExamples()
let server = await createTestServer(examples.fetch)
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
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A margin keeps the focus ring, which sits outside the thumb, in the picture.
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      let clip = await page
        .locator(shot.clip)
        .first()
        .evaluate((element) => {
          let box = element.getBoundingClientRect()
          let margin = 16
          return {
            x: Math.max(0, box.x + window.scrollX - margin),
            y: Math.max(0, box.y + window.scrollY - margin),
            width: box.width + 2 * margin,
            height: box.height + 2 * margin,
          }
        })
      await page.screenshot({ path, clip, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/slider/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
