// Captures the Select examples in headless Chromium for UI reviews: the
// desktop and narrow pages in both themes, a list lined up with its trigger,
// a list opened from the keyboard, a long list that scrolls, a multiple
// select, a select in a dialog, a required select the browser stops, forced
// colors, right-to-left text, a list at 320px with text at 200%, and the
// native selects a page without JavaScript shows. Run
// `bun run capture:select-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createSelectExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, with the lists open inside it, after an optional interaction.
  section?: string
  example?: string
  // Capture the window as it is, such as a long list that scrolls in it.
  viewport?: boolean
  prepare?: (page: Page) => Promise<void>
}

function trigger(page: Page, example: string, index = 0) {
  return page.locator(`[data-example="${example}"] [data-slot="select-trigger"]`).nth(index)
}

async function waitOpen(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] [data-slot="select-content"][data-open]`).first().waitFor()
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'item-aligned-open-light',
    width: desktop,
    colorScheme: 'light',
    example: 'Item aligned',
    async prepare(page) {
      await trigger(page, 'Item aligned').click()
      await waitOpen(page, 'Item aligned')
    },
  },
  {
    name: 'groups-keyboard-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'Groups',
    async prepare(page) {
      await trigger(page, 'Groups').focus()
      await page.keyboard.press('ArrowDown')
      await waitOpen(page, 'Groups')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'large-list-scrolled-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await trigger(page, 'Large list').scrollIntoViewIfNeeded()
      await trigger(page, 'Large list').focus()
      await page.keyboard.press('ArrowDown')
      await waitOpen(page, 'Large list')
      for (let step = 0; step < 30; step++) await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'multiple-light',
    width: desktop,
    colorScheme: 'light',
    example: 'Multiple',
    async prepare(page) {
      await trigger(page, 'Multiple').click()
      await waitOpen(page, 'Multiple')
      let list = page.locator('[data-example="Multiple"] [role=listbox]')
      await list.getByRole('option', { name: 'Apple', exact: true }).click()
      await list.getByRole('option', { name: 'Blueberry' }).click()
    },
  },
  {
    name: 'in-dialog-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await page.locator('[data-example="In a dialog"]').getByRole('button', { name: 'Open dialog' }).click()
      let dialog = page.getByRole('dialog', { name: 'Select example' })
      await dialog.waitFor()
      await dialog.locator('[data-slot="select-trigger"]').click()
      await waitOpen(page, 'In a dialog')
    },
  },
  {
    name: 'required-stopped-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      let form = page.locator('[data-example="Required"]')
      await form.scrollIntoViewIfNeeded()
      await form.getByRole('button', { name: 'Save' }).click()
      await page.waitForFunction(() =>
        document
          .querySelector('[data-example="Required"] [data-slot="select-trigger"]')
          ?.matches('[aria-invalid="true"]'),
      )
      // Chromium fades its message in.
      await page.waitForTimeout(800)
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    example: 'Groups',
    async prepare(page) {
      await trigger(page, 'Groups').focus()
      await page.keyboard.press('ArrowDown')
      await waitOpen(page, 'Groups')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    section: 'direction',
    async prepare(page) {
      await trigger(page, 'الفواكه').click()
      await waitOpen(page, 'الفواكه')
    },
  },
  {
    name: 'plan-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    viewport: true,
    async prepare(page) {
      await trigger(page, 'Plan').scrollIntoViewIfNeeded()
      await trigger(page, 'Plan').click()
      await waitOpen(page, 'Plan')
    },
  },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'forms' },
]

const output = fileURLToPath(new URL('../../../docs/images/select/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createSelectExamples()
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

    // A viewport as tall as the page keeps every list beside its trigger in the picture.
    if (!shot.viewport) {
      let height = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: shot.width, height })
    }
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
    process.stdout.write(`✓ docs/images/select/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
