// Captures the Trace examples in headless Chromium for UI reviews: desktop
// and narrow pages in both themes, then states that differ from the first
// render: tool calls while one runs, the finished demo with its sources
// open, keyboard focus on a nested row in dark mode, the statuses in forced
// colors, a row's dialog, right-to-left text in dark mode, and the rows on a
// narrow screen with text at 200%. Run `bun run capture:trace-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createTraceExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // Running titles shimmer only without reduced motion.
  reducedMotion?: 'reduce' | 'no-preference'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this element, after preparing its state.
  clip?: string
  // Capture the viewport instead of the full page, such as for an open dialog.
  viewport?: boolean
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'tool-calls-running-light',
    width: desktop,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    clip: '[data-example="Tool calls"]',
    async prepare(page) {
      let calls = example(page, 'Tool calls')
      await calls.getByRole('button', { name: 'Send message' }).click()
      await calls.getByRole('button', { name: /^Ran node --version/ }).waitFor()
      await calls.getByRole('button', { name: /^Running npm --version/ }).waitFor()
    },
  },
  {
    name: 'demo-finished-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="Demo"]',
    async prepare(page) {
      let demo = example(page, 'Demo')
      await demo.getByRole('button', { name: 'Send message' }).click()
      await demo.getByRole('button', { name: 'Reset' }).waitFor({ timeout: 15_000 })
      await demo.getByRole('button', { name: /^Failed to run pnpm install/ }).click()
      await demo.getByRole('button', { name: 'Used 2 sources' }).click()
    },
  },
  {
    name: 'turn-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="Whole turn"]',
    async prepare(page) {
      let turn = example(page, 'Whole turn')
      await turn.getByRole('button', { name: /^Failed to run pnpm --version/ }).focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'status-forced-colors',
    width: desktop,
    colorScheme: 'dark',
    forcedColors: 'active',
    clip: '[data-example="Status"]',
  },
  {
    name: 'dialog-open-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await example(page, 'Dialog').getByRole('button', { name: 'Searched the web for cache keys' }).click()
      await page.getByRole('dialog').waitFor()
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[aria-labelledby="direction"]',
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="rows"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/trace/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createTraceExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: shot.reducedMotion ?? 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)
    // Off the page, so no row shows its hover color.
    await page.mouse.move(0, 0)

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
      await page.screenshot({ path, fullPage: !shot.viewport })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/trace/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
