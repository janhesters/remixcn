// Captures the Dialog, Alert Dialog and Sheet examples in headless Chromium
// for UI reviews: the page and an open dialog, alert dialog and sheet at
// desktop and narrow widths in both themes, a nested alert dialog, the
// sheets on the other edges, keyboard focus in forced colors, a dialog on a
// narrow screen with text at 200%, and right-to-left text.
// Run `bun run capture:dialog-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createDialogExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture the whole page instead of the viewport with the open dialog.
  fullPage?: boolean
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

type Section = 'dialog' | 'alert-dialog' | 'sheet'

/**
 * Opens the trigger named `name` in the example titled `example` of a page
 * section, and waits until focus moved inside. Two sections have examples
 * with the same title, so it checks that the dialog it opened is the
 * section's own, or `slot` when the example opens another kind first.
 */
function openFrom(
  section: Section,
  example: string,
  name: string,
  { keyboard = false, slot = `${section}-content` } = {},
) {
  return async (page: Page) => {
    let trigger = page
      .locator(`section[aria-labelledby="${section}"] [data-example="${example}"]`)
      .getByRole('button', { name, exact: true })
    if (keyboard) {
      await trigger.focus()
      await page.keyboard.press('Enter')
    } else {
      await trigger.click()
    }
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
    let opened = await page.locator('dialog[open]').last().getAttribute('data-slot')
    if (opened !== slot) throw new Error(`${section} › ${example} › ${name} opened ${opened}, not ${slot}`)
  }
}

const shots: Shot[] = [
  { name: 'page-desktop-light', width: desktop, colorScheme: 'light', fullPage: true },
  { name: 'page-desktop-dark', width: desktop, colorScheme: 'dark', fullPage: true },
  { name: 'page-narrow-light', width: narrow, colorScheme: 'light', fullPage: true },
  { name: 'page-narrow-dark', width: narrow, colorScheme: 'dark', fullPage: true },
  {
    name: 'dialog-desktop-light',
    width: desktop,
    colorScheme: 'light',
    prepare: openFrom('dialog', 'With form', 'Edit customer'),
  },
  {
    name: 'dialog-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    prepare: openFrom('dialog', 'With form', 'Edit customer'),
  },
  {
    name: 'dialog-narrow-light',
    width: narrow,
    colorScheme: 'light',
    prepare: openFrom('dialog', 'With form', 'Edit customer'),
  },
  {
    name: 'dialog-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    prepare: openFrom('dialog', 'With form', 'Edit customer'),
  },
  {
    name: 'alert-dialog-desktop-light',
    width: desktop,
    colorScheme: 'light',
    prepare: openFrom('alert-dialog', 'With media', 'With media'),
  },
  {
    name: 'alert-dialog-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    prepare: openFrom('alert-dialog', 'Destructive', 'Delete invoice'),
  },
  {
    name: 'alert-dialog-narrow-light',
    width: narrow,
    colorScheme: 'light',
    prepare: openFrom('alert-dialog', 'Destructive', 'Delete invoice'),
  },
  {
    name: 'alert-dialog-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    prepare: openFrom('alert-dialog', 'With media', 'With media'),
  },
  { name: 'sheet-desktop-light', width: desktop, colorScheme: 'light', prepare: openFrom('sheet', 'Sides', 'Right') },
  {
    name: 'sheet-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    prepare: openFrom('sheet', 'With form', 'Edit customer'),
  },
  { name: 'sheet-narrow-light', width: narrow, colorScheme: 'light', prepare: openFrom('sheet', 'Sides', 'Bottom') },
  { name: 'sheet-narrow-dark', width: narrow, colorScheme: 'dark', prepare: openFrom('sheet', 'Sides', 'Left') },
  { name: 'sheet-top-desktop-light', width: desktop, colorScheme: 'light', prepare: openFrom('sheet', 'Sides', 'Top') },
  {
    name: 'sheet-long-content-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    async prepare(page) {
      await openFrom('sheet', 'Long content', 'Long content')(page)
      await page.locator('dialog[open]').evaluate((dialog) => (dialog.scrollTop = dialog.scrollHeight))
    },
  },
  {
    name: 'nested-alert-dialog-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    async prepare(page) {
      await openFrom('alert-dialog', 'In a dialog', 'Open dialog', { slot: 'dialog-content' })(page)
      await page.locator('dialog[open]').getByRole('button', { name: 'Void invoice' }).click()
      await page.waitForFunction(() => document.activeElement?.textContent === 'Cancel')
    },
  },
  {
    name: 'dialog-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    async prepare(page) {
      await openFrom('dialog', 'With form', 'Edit customer', { keyboard: true })(page)
      for (let step = 0; step < 4; step++) await page.keyboard.press('Tab')
    },
  },
  {
    name: 'dialog-narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    prepare: openFrom('dialog', 'With form', 'Edit customer'),
  },
  {
    name: 'rtl-dialog-light',
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      await page.locator('#direction ~ div [data-example]').first().getByRole('button').first().click()
      await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
    },
  },
  {
    name: 'rtl-sheet-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    async prepare(page) {
      await page.locator('#direction ~ div [data-example]').nth(2).getByRole('button').nth(1).click()
      await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/dialog/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createDialogExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 820 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    await page.screenshot({ path: `${output}${shot.name}.png`, fullPage: shot.fullPage ?? false })
    await page.close()
    process.stdout.write(`✓ docs/images/dialog/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
