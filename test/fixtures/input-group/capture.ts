// Captures the Input Group and Input OTP examples in headless Chromium for UI
// reviews: the desktop page in both themes, the narrow page in both themes in
// three parts, and the important non-default states: codes while the user
// types and selects, an invalid code and group with keyboard focus in forced
// colors, a message over its limit, the theme panels with text at 200%,
// right-to-left text, and the parts on a page whose script never runs. Run
// `bun run capture:input-group-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createInputGroupExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Runs the page without JavaScript.
  noScript?: boolean
  // Capture only this element, after preparing its state.
  clip?: string
  // Capture the page from the top of one element to the top of another, or to the end.
  part?: { from: string; to?: string }
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390
// The narrow page is too tall for one picture, so it comes in three parts.
const parts = [
  { from: 'body', to: '#input-otp' },
  { from: '#input-otp', to: '#right-to-left' },
  { from: '#right-to-left' },
]

async function typeInto(page: Page, selector: string, text: string) {
  await page.locator(selector).click()
  await page.keyboard.type(text)
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  ...(['light', 'dark'] as const).flatMap((colorScheme) =>
    parts.map((part, index) => ({ name: `narrow-${colorScheme}-${index + 1}`, width: narrow, colorScheme, part })),
  ),
  {
    name: 'codes-typing-light',
    width: desktop,
    colorScheme: 'light',
    clip: '#input-otp',
    async prepare(page) {
      await typeInto(page, '#input-otp-demo-masked', '48')
      await typeInto(page, '#input-otp-demo-controlled', '042')
      await typeInto(page, '#input-otp-demo-alphanumeric', 'ab12')
      await typeInto(page, '#input-otp-demo-simple', '123')
    },
  },
  {
    name: 'code-selected-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="input-otp-separator"]',
    async prepare(page) {
      await page.locator('#input-otp-demo-pairs').focus()
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
    },
  },
  {
    name: 'message-over-limit-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="input-group-counter"]',
    async prepare(page) {
      await page.locator('#input-group-demo-counter').fill('Thanks for your order. '.repeat(13))
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-panel="light"]',
    async prepare(page) {
      await page.locator('#light-code').focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'group-focused-invalid-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-panel="light"]',
    async prepare(page) {
      await page.locator('#light-amount').focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[data-panel="light"]',
  },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', clip: '#right-to-left' },
  { name: 'without-script-light', width: desktop, colorScheme: 'light', noScript: true, clip: '#without-script' },
]

const output = fileURLToPath(new URL('../../../docs/images/input-group/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createInputGroupExamples()
let server = await createTestServer(examples.fetch)
let browser: Browser = await chromium.launch()

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
    let context = await browser.newContext({
      viewport: { width: shot.width, height: 900 },
      javaScriptEnabled: !shot.noScript,
    })
    let page = await context.newPage()
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    if (!shot.noScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
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

    await context.close()
    process.stdout.write(`✓ docs/images/input-group/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
