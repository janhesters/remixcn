// Captures the Combobox examples in headless Chromium for UI reviews: the
// desktop and narrow pages in both themes, a search that filters the list, a
// search without results, groups browsed with the keyboard, chips with their
// list open, results loaded for a search, the search in a popup, a combobox
// in a dialog, a required combobox the browser stops, forced colors,
// right-to-left text, a list at 320px with text at 200%, and the native
// selects a page without JavaScript shows. Run
// `bun run capture:combobox-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createComboboxExamples } from './server.tsx'

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

function input(page: Page, example: string, index = 0) {
  return page.locator(`[data-example="${example}"] input[role="combobox"]`).nth(index)
}

async function waitOpen(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] [data-slot="combobox-content"][data-open]`).first().waitFor()
}

async function waitHighlighted(page: Page, example: string) {
  await page.waitForFunction(
    (example) => document.querySelector(`[data-example="${example}"] input[aria-activedescendant]`),
    example,
  )
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'search-light',
    width: desktop,
    colorScheme: 'light',
    example: 'Auto highlight',
    async prepare(page) {
      await input(page, 'Auto highlight').click()
      await page.keyboard.type('s')
      await waitOpen(page, 'Auto highlight')
      await waitHighlighted(page, 'Auto highlight')
    },
  },
  {
    name: 'no-results-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'Basic',
    async prepare(page) {
      await input(page, 'Basic').click()
      await page.keyboard.type('Gatsby')
      await waitOpen(page, 'Basic')
    },
  },
  {
    name: 'groups-keyboard-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'Groups and separators',
    async prepare(page) {
      await input(page, 'Groups and separators').focus()
      await page.keyboard.press('ArrowDown')
      await waitOpen(page, 'Groups and separators')
      for (let step = 0; step < 7; step++) await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'multiple-chips-light',
    width: desktop,
    colorScheme: 'light',
    example: 'Multiple',
    async prepare(page) {
      await input(page, 'Multiple').click()
      await waitOpen(page, 'Multiple')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'async-results-light',
    width: desktop,
    colorScheme: 'light',
    example: 'Async results',
    async prepare(page) {
      await input(page, 'Async results').click()
      await page.keyboard.type('ha')
      await page.locator('[data-example="Async results"] [role="option"]').first().waitFor()
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'popup-search-light',
    width: desktop,
    colorScheme: 'light',
    example: 'In a popup',
    async prepare(page) {
      await page.locator('[data-example="In a popup"] [data-slot="combobox-trigger"]').click()
      await waitOpen(page, 'In a popup')
      await page.keyboard.type('land')
    },
  },
  {
    name: 'in-dialog-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await page.locator('[data-example="In a dialog"]').getByRole('button', { name: 'Open dialog' }).click()
      let dialog = page.getByRole('dialog', { name: 'Select framework' })
      await dialog.waitFor()
      await dialog.getByRole('combobox', { name: 'Framework' }).click()
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
      await form.getByRole('button', { name: 'Submit' }).click()
      await page.waitForFunction(() =>
        document.querySelector('[data-example="Required"] input[role="combobox"]')?.matches('[aria-invalid="true"]'),
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
    example: 'Multiple',
    async prepare(page) {
      await input(page, 'Multiple').focus()
      await page.keyboard.press('ArrowDown')
      await waitOpen(page, 'Multiple')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    section: 'direction',
    async prepare(page) {
      await input(page, 'الفواكه', 1).click()
      await waitOpen(page, 'الفواكه')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'custom-items-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    viewport: true,
    async prepare(page) {
      await input(page, 'Custom items').scrollIntoViewIfNeeded()
      await input(page, 'Custom items').click()
      await page.keyboard.type('new')
      await waitOpen(page, 'Custom items')
    },
  },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'forms' },
]

const output = fileURLToPath(new URL('../../../docs/images/combobox/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createComboboxExamples()
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
    process.stdout.write(`✓ docs/images/combobox/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
