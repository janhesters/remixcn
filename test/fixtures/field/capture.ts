// Captures the Field, Input, Label, Native Select and Textarea examples in
// headless Chromium for UI reviews: the desktop page in both themes, the
// narrow page in both themes in three parts, and the important non-default
// states: the browser's validation messages in the invoice form, a save the
// server refused, recipient rows that changed, keyboard focus on an invalid
// field in forced colors, a theme panel with text at 200%, and right-to-left
// text. Run `bun run capture:field-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createFieldExamples } from './server.tsx'

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
// The narrow page is too tall for one picture, so it comes in three parts.
const parts = [
  { from: 'body', to: '#validation' },
  { from: '#validation', to: '#native-select' },
  { from: '#native-select' },
]

async function submitInvoice(page: Page, values: Record<string, string>) {
  let form = page.locator('[data-example="field-invoice"]')
  for (let [label, value] of Object.entries(values)) await form.getByLabel(label).fill(value)
  await form.getByRole('button', { name: 'Create invoice' }).click()
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  ...(['light', 'dark'] as const).flatMap((colorScheme) =>
    parts.map((part, index) => ({ name: `narrow-${colorScheme}-${index + 1}`, width: narrow, colorScheme, part })),
  ),
  {
    name: 'invoice-browser-errors-light',
    width: desktop,
    colorScheme: 'light',
    clip: '#validation',
    async prepare(page) {
      await submitInvoice(page, { 'Billing email (required)': 'ap@' })
      await page.locator('#invoice-customer-error').waitFor()
    },
  },
  {
    name: 'invoice-refused-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '#validation',
    async prepare(page) {
      await submitInvoice(page, {
        'Customer (required)': 'Closed Account Ltd',
        'Billing email (required)': 'ap@closed.example',
        'Amount (required)': '120',
        'Due date (required)': '2026-12-01',
      })
      await page.locator('#invoice-form-error').waitFor()
    },
  },
  {
    name: 'recipients-changing-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="field-recipients"]',
    async prepare(page) {
      let recipients = page.locator('[data-example="field-recipients"]')
      await recipients.getByRole('button', { name: 'Add recipient' }).click()
      await recipients.getByLabel('Recipient 2', { exact: true }).fill('accounts receivable')
      await recipients.getByLabel('Recipient 2', { exact: true }).press('Tab')
      await recipients.locator('#recipient-2-error').waitFor()
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-theme="light"]',
    async prepare(page) {
      await page.locator('#light-email').focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[data-theme="light"]',
  },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', clip: '#right-to-left' },
]

const output = fileURLToPath(new URL('../../../docs/images/field/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createFieldExamples()
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
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
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

    await page.close()
    process.stdout.write(`✓ docs/images/field/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
