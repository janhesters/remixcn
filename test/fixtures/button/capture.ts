// Captures the Button and Button Group examples in headless Chromium for UI
// reviews: desktop and narrow pages in both themes, the loading button while
// it keeps focus in dark mode, a focused group part in forced colors, and the
// Button Group section on a narrow screen with text at 200%.
// Run `bun run capture:button-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createButtonExamples } from './server.tsx'

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

async function focusWithKeyboard(page: Page, previous: string) {
  await page.getByRole('button', { name: previous, exact: true }).first().focus()
  await page.keyboard.press('Tab')
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'loading-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="Loading"]',
    async prepare(page) {
      let button = page.locator('[data-example="Loading"]').getByRole('button')
      await button.focus()
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: 'Saving template…' }).waitFor()
    },
  },
  {
    name: 'group-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[aria-labelledby="button-group"]',
    prepare: (page) => focusWithKeyboard(page, 'Archive'),
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="button-group"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/button/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createButtonExamples()
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
    // A paused clock keeps the loading state until the picture is taken.
    await page.clock.install()
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A margin keeps the focus ring, which sits outside the part, in the picture.
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
    process.stdout.write(`✓ docs/images/button/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
