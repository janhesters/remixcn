// Captures the Carousel examples in headless Chromium for UI reviews: the
// desktop and narrow pages in both themes, the API example moved on with the
// keyboard in dark mode, stopped autoplay, a focused column in forced colors,
// right-to-left text after a step, and the examples on a narrow screen with
// text at 200%. Run `bun run capture:carousel-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createCarouselExamples } from './server.tsx'

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

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

/** Focuses an element as the keyboard would, so it shows its focus ring. */
async function focusWithKeyboard(page: Page, selector: string) {
  await page.locator(selector).first().focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
}

async function selected(page: Page, title: string, index: number) {
  await example(page, title)
    .locator(`[data-slot="carousel-item"]:nth-child(${index + 1})[data-selected]`)
    .first()
    .waitFor({ state: 'attached' })
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'api-keyboard-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="API"]',
    async prepare(page) {
      await focusWithKeyboard(page, '[data-example="API"] [data-slot="carousel-content"]')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await selected(page, 'API', 2)
    },
  },
  {
    name: 'autoplay-stopped-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="Autoplay"]',
    async prepare(page) {
      await example(page, 'Autoplay').getByRole('button', { name: 'Stop slide rotation' }).click()
      await example(page, 'Autoplay').getByRole('button', { name: 'Start slide rotation' }).waitFor()
      await page.mouse.move(0, 0)
    },
  },
  {
    name: 'column-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-example="Orientation"]',
    async prepare(page) {
      await focusWithKeyboard(page, '[data-example="Orientation"] [data-slot="carousel-next"]')
      await page.keyboard.press('Enter')
      await selected(page, 'Orientation', 1)
    },
  },
  {
    name: 'right-to-left-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[aria-labelledby="direction"]',
    async prepare(page) {
      await example(page, 'من اليمين إلى اليسار').getByRole('button', { name: 'الشريحة التالية' }).click()
      await selected(page, 'من اليمين إلى اليسار', 1)
      await page.mouse.move(0, 0)
    },
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="carousel"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/carousel/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createCarouselExamples()
let server = await createTestServer(examples.fetch)
// Playwright hides scrollbars by default; the carousel without JavaScript shows its own.
let browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    // Reduced motion: scrolls jump, so each picture shows where they end, and autoplay holds still.
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    // The window grows to the whole page before any state is prepared. A
    // full-page screenshot would resize it afterwards, and a resize re-snaps
    // the carousels. It also keeps the scrollbars of inner scroll containers,
    // which full-page screenshots drop.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A margin keeps the focus ring and the buttons outside the slides in the picture.
      let clip = await page
        .locator(shot.clip)
        .first()
        .evaluate((element) => {
          let box = element.getBoundingClientRect()
          let margin = 16
          return {
            x: Math.max(0, box.x - margin),
            y: Math.max(0, box.y - margin),
            width: box.width + 2 * margin,
            height: box.height + 2 * margin,
          }
        })
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/carousel/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
