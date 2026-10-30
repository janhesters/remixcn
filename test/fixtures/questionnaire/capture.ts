// Captures the Questionnaire examples in headless Chromium for UI reviews:
// the desktop page in both themes, the narrow page in both themes in three
// parts, and the important non-default states: a required question that
// can't go on, an async check that refused an answer, a submit that waits,
// a submit that failed, keyboard focus on a checked choice in forced colors,
// a theme panel with text at 200%, right-to-left text, the page without
// JavaScript, and the questionnaire in a dialog. Run
// `bun run capture:questionnaire-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createQuestionnaireExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  javaScriptEnabled?: boolean
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
const parts = [{ from: 'body', to: '#checks' }, { from: '#checks', to: '#composition' }, { from: '#composition' }]

const example = (page: Page, id: string) => page.locator(`[data-example="${id}"]`)

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  ...(['light', 'dark'] as const).flatMap((colorScheme) =>
    parts.map((part, index) => ({ name: `narrow-${colorScheme}-${index + 1}`, width: narrow, colorScheme, part })),
  ),
  {
    name: 'required-error-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="demo"]',
    async prepare(page) {
      await example(page, 'demo').getByRole('button', { name: 'Next' }).press('Enter')
      await example(page, 'demo').locator('[data-slot="questionnaire-error"]:not([hidden])').waitFor()
    },
  },
  {
    name: 'async-check-refused-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="validation"]',
    async prepare(page) {
      let validation = example(page, 'validation')
      await validation.getByLabel('Project code').fill('INV-9999')
      await validation.getByRole('button', { name: 'Next' }).click()
      await validation.locator('[data-slot="questionnaire-error"]:not([hidden])').waitFor()
    },
  },
  {
    name: 'submit-pending-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="submitting"]',
    async prepare(page) {
      let submitting = example(page, 'submitting')
      await submitting.getByText('Tonight at 22:00').click()
      await submitting.getByRole('button', { name: 'Next' }).click()
      await submitting.getByLabel('Approver').fill('Billing on-call')
      await submitting.getByRole('button', { name: 'Send plan' }).click()
      await submitting.locator('button[data-pending]').waitFor()
    },
  },
  {
    name: 'submit-failed-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="submitting"]',
    async prepare(page) {
      let submitting = example(page, 'submitting')
      await submitting.getByText('Tonight at 22:00').click()
      await submitting.getByRole('button', { name: 'Next' }).click()
      await submitting.getByLabel('Approver').fill('Billing on-call')
      await submitting.getByLabel('Fail the next send').check()
      await submitting.getByRole('button', { name: 'Send plan' }).click()
      await submitting.locator('[data-scope="questionnaire"]:not([hidden])').waitFor()
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-theme="light"]',
    async prepare(page) {
      let panel = page.locator('[data-theme="light"]')
      await panel.getByText('Pro', { exact: true }).click()
      await panel.getByRole('radio', { name: /Pro/ }).focus()
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
  {
    name: 'no-javascript-light',
    width: desktop,
    colorScheme: 'light',
    javaScriptEnabled: false,
    clip: '[data-example="demo"]',
  },
  {
    name: 'dialog-dark',
    width: desktop,
    colorScheme: 'dark',
    async prepare(page) {
      await example(page, 'dialog').getByRole('button', { name: 'Open questionnaire' }).click()
      let dialog = page.getByRole('dialog', { name: 'Plan an agent interface' })
      await dialog.getByText('Both together').click()
      await dialog.getByRole('button', { name: 'Next' }).click()
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/questionnaire/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createQuestionnaireExamples()
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
    let javaScriptEnabled = shot.javaScriptEnabled ?? true
    let context = await browser.newContext({ viewport: { width: shot.width, height: 900 }, javaScriptEnabled })
    let page = await context.newPage()
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    if (javaScriptEnabled) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip && javaScriptEnabled) {
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      await page.screenshot({ path, clip: await bounds(page, shot.clip, 16), fullPage: true })
    } else if (shot.clip) {
      // Without a script, the element takes the picture itself.
      await page.locator(shot.clip).first().screenshot({ path })
    } else if (shot.part) {
      let top = shot.part.from === 'body' ? 0 : (await bounds(page, shot.part.from, 0)).y
      let bottom = shot.part.to
        ? (await bounds(page, shot.part.to, 0)).y
        : await page.evaluate(() => document.documentElement.scrollHeight)
      await page.screenshot({ path, clip: { x: 0, y: top, width: shot.width, height: bottom - top }, fullPage: true })
    } else if (shot.prepare) {
      await page.screenshot({ path })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await context.close()
    process.stdout.write(`✓ docs/images/questionnaire/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
