// Captures the display and feedback examples in headless Chromium for UI
// reviews: the desktop page in both themes, the narrow page in both themes in
// two parts, and the important non-default states: failed and replaced avatar
// images, a reloading skeleton, an expanded breadcrumb with keyboard focus,
// forced colors, and the alerts on a narrow screen with text at 200%.
// Run `bun run capture:display-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createDisplayExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this element, after preparing its state.
  clip?: string
  // Capture the page from the top of one element to the top of another, or to the end.
  part?: { from: string; to?: string }
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390
// The narrow page is too tall for one picture, so it comes in two parts.
const firstHalf = { from: 'body', to: '#item' }
const secondHalf = { from: '#item' }

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light-1', width: narrow, colorScheme: 'light', part: firstHalf },
  { name: 'narrow-light-2', width: narrow, colorScheme: 'light', part: secondHalf },
  { name: 'narrow-dark-1', width: narrow, colorScheme: 'dark', part: firstHalf },
  { name: 'narrow-dark-2', width: narrow, colorScheme: 'dark', part: secondHalf },
  {
    name: 'avatar-states-light',
    width: desktop,
    colorScheme: 'light',
    clip: '#avatar',
    async prepare(page) {
      let picker = page.locator('[data-example="avatar-picker"]')
      await picker.getByText('Photo: loaded.').waitFor()
      await picker.getByRole('button', { name: 'Use a broken link' }).click()
      await picker.getByText('Photo: error.').waitFor()
    },
  },
  {
    name: 'skeleton-loading-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '#skeleton',
    async prepare(page) {
      await page.locator('[data-example="skeleton-reload"]').getByRole('button', { name: 'Reload' }).click()
      await page.locator('[data-example="skeleton-reload"] [aria-busy="true"]').waitFor()
    },
  },
  {
    name: 'breadcrumb-expanded-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '#breadcrumb',
    async prepare(page) {
      let collapsed = page.locator('[data-example="breadcrumb-collapsed"]')
      await collapsed.getByRole('button', { name: 'Show 2 hidden levels' }).focus()
      await page.keyboard.press('Enter')
      await collapsed.getByRole('link', { name: 'Customers' }).waitFor()
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-theme="light"]',
    async prepare(page) {
      await page.locator('[data-theme="light"]').getByRole('link', { name: 'Drafts' }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  { name: 'narrow-text-200-light', width: narrow, colorScheme: 'light', fontSize: '32px', clip: '#alert' },
]

const output = fileURLToPath(new URL('../../../docs/images/display/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createDisplayExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

/** The page coordinates of an element's box, with a margin that keeps a focus ring in the picture. */
function bounds(page: Page, selector: string, margin: number) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, margin) => {
      let box = element.getBoundingClientRect()
      return {
        x: Math.max(0, box.x + window.scrollX - margin),
        y: Math.max(0, box.y + window.scrollY - margin),
        width: box.width + 2 * margin,
        height: box.height + 2 * margin,
      }
    }, margin)
}

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
    // Avatars and charts are inline images; wait until each one loaded or failed.
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))))
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      await page.screenshot({ path, clip: await bounds(page, shot.clip, 16), fullPage: true })
    } else if (shot.part) {
      let top = shot.part.from === 'body' ? 0 : (await bounds(page, shot.part.from, 0)).y
      let bottom = shot.part.to
        ? (await bounds(page, shot.part.to, 0)).y
        : await page.evaluate(() => document.documentElement.scrollHeight)
      await page.screenshot({ path, clip: { x: 0, y: top, width: shot.width, height: bottom - top }, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/display/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
