// Captures the Calendar and Date Picker examples in headless Chromium for UI
// reviews: the desktop and narrow pages in both themes, a date picker opened
// from the keyboard, a range picked across two months, a typed day that
// doesn't exist, the locales, forced colors, right-to-left text, a calendar
// at 320px with text at 200%, and the page without JavaScript. Run
// `bun run capture:calendar-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createCalendarExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, with the popups open inside it, after an optional interaction.
  section?: string
  example?: string
  prepare?: (page: Page) => Promise<void>
}

/** Tabs from the example's heading to its first control. */
async function tabInto(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] h3`).click()
  await page.keyboard.press('Tab')
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'date-picker-keyboard-light',
    width: desktop,
    colorScheme: 'light',
    example: 'date-picker-basic',
    async prepare(page) {
      // Enter opens it with focus on today; the arrows move it.
      await tabInto(page, 'date-picker-basic')
      await page.keyboard.press('Enter')
      await page.locator('[data-example="date-picker-basic"] [data-day="2026-10-30"]:focus').waitFor()
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowUp')
    },
  },
  {
    name: 'date-picker-range-open-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'date-picker-range',
    async prepare(page) {
      let example = page.locator('[data-example="date-picker-range"]')
      await example.locator('[data-slot="popover-trigger"]').click()
      await example.locator('[data-slot="calendar-day"][data-day="2026-01-27"]:not([data-outside]) button').click()
      await example.locator('[data-slot="calendar-day"][data-day="2026-02-03"]:not([data-outside]) button').click()
    },
  },
  {
    name: 'date-input-invalid-light',
    width: desktop,
    colorScheme: 'light',
    example: 'date-picker-input',
    async prepare(page) {
      let input = page.locator('[data-example="date-picker-input"] input')
      await input.fill('2026-02-30')
      await input.press('Tab')
    },
  },
  { name: 'locales-light', width: desktop, colorScheme: 'light', section: 'locales' },
  { name: 'forced-colors', width: desktop, colorScheme: 'light', forcedColors: 'active', section: 'themes' },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', section: 'right-to-left' },
  {
    name: 'calendar-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    example: 'calendar-single',
  },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'form' },
]

const output = fileURLToPath(new URL('../../../docs/images/calendar/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createCalendarExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let javaScript = shot.javaScript ?? true
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 }, javaScriptEnabled: javaScript })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)

    // A viewport as tall as the page keeps every popup beside its trigger in the picture.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })
    await shot.prepare?.(page)
    // Two frames, for the positioning after a resize or an interaction. Without JavaScript nothing moves.
    if (javaScript) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }

    let path = `${output}${shot.name}.png`
    let target = shot.section
      ? page.locator(`section[aria-labelledby="${shot.section}"]`)
      : shot.example
        ? page.locator(`[data-example="${shot.example}"]`)
        : undefined
    if (target) {
      // The box of the target and of every popup open inside it, with a margin for focus rings.
      let clip = await target.evaluate((element) => {
        let boxes = [element, ...element.querySelectorAll(':popover-open')].map((part) => part.getBoundingClientRect())
        let margin = 16
        let left = Math.max(0, Math.min(...boxes.map((box) => box.left)) - margin)
        let top = Math.max(0, Math.min(...boxes.map((box) => box.top)) - margin)
        let right = Math.min(document.documentElement.clientWidth, Math.max(...boxes.map((box) => box.right)) + margin)
        let bottom = Math.max(...boxes.map((box) => box.bottom)) + margin
        return { x: left, y: top, width: right - left, height: bottom - top }
      })
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/calendar/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
