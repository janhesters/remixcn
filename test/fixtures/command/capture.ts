// Captures the Command examples in headless Chromium for UI reviews: the
// page at desktop and narrow widths in both themes, open command dialogs,
// a search that sorts the groups, the empty state, keywords, keyboard
// focus in forced colors, a 320px screen with text at 200%, and
// right-to-left text.
// Run `bun run capture:command-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createCommandExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture the whole page instead of the viewport.
  fullPage?: boolean
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

/** Opens the palette of the dialog example titled `example`, and waits until its input has focus. */
function openPalette(example: string, search = '', keys: string[] = []) {
  return async (page: Page) => {
    await page.locator(`section[aria-labelledby="dialog"] [data-example="${example}"]`).getByRole('button').click()
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open]')?.querySelector('[role=combobox]'))
    if (search) await page.keyboard.type(search)
    for (let key of keys) await page.keyboard.press(key)
  }
}

/** Types into the inline example titled `example`. */
function search(example: string, text: string, keys: string[] = []) {
  return async (page: Page) => {
    let figure = page.locator(`[data-example="${example}"]`).first()
    await figure.getByRole('combobox').click()
    if (text) await page.keyboard.type(text)
    for (let key of keys) await page.keyboard.press(key)
    await figure.scrollIntoViewIfNeeded()
  }
}

const shots: Shot[] = [
  { name: 'page-desktop-light', width: desktop, colorScheme: 'light', fullPage: true },
  { name: 'page-desktop-dark', width: desktop, colorScheme: 'dark', fullPage: true },
  { name: 'page-narrow-light', width: narrow, colorScheme: 'light', fullPage: true },
  { name: 'page-narrow-dark', width: narrow, colorScheme: 'dark', fullPage: true },
  { name: 'dialog-desktop-light', width: desktop, colorScheme: 'light', prepare: openPalette('Groups') },
  { name: 'dialog-search-desktop-dark', width: desktop, colorScheme: 'dark', prepare: openPalette('Groups', 'set') },
  {
    name: 'dialog-many-narrow-light',
    width: narrow,
    colorScheme: 'light',
    prepare: openPalette('Many groups', '', ['End', 'ArrowUp']),
  },
  { name: 'dialog-empty-narrow-dark', width: narrow, colorScheme: 'dark', prepare: openPalette('Groups', 'zzz') },
  {
    name: 'inline-keywords-light',
    width: desktop,
    colorScheme: 'light',
    prepare: search('Inline', 'account'),
  },
  {
    name: 'checked-dark',
    width: desktop,
    colorScheme: 'dark',
    prepare: search('Checked', '', ['ArrowDown', 'ArrowDown']),
  },
  {
    name: 'focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    prepare: search('Inline', '', ['ArrowDown', 'ArrowDown', 'ArrowDown']),
  },
  {
    name: 'dialog-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    prepare: openPalette('Groups'),
  },
  { name: 'rtl-light', width: desktop, colorScheme: 'light', prepare: search('أوامر', '', ['ArrowDown', 'ArrowDown']) },
]

const output = fileURLToPath(new URL('../../../docs/images/command/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createCommandExamples()
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
    process.stdout.write(`✓ docs/images/command/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
