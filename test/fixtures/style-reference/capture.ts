// Captures the style reference in headless Chromium for UI reviews: desktop
// and narrow pages in both themes, the form states with a focused invalid
// field in dark mode and in forced colors, and the narrow form states with
// text at 200%. Run `bun run capture:style-reference`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createStyleReference } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only the form states, optionally with the invalid email field focused.
  formsOnly?: boolean
  focusInvalidField?: boolean
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  { name: 'focus-invalid-dark', width: desktop, colorScheme: 'dark', formsOnly: true, focusInvalidField: true },
  {
    name: 'focus-invalid-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    formsOnly: true,
    focusInvalidField: true,
  },
  { name: 'narrow-text-200-light', width: narrow, colorScheme: 'light', fontSize: '32px', formsOnly: true },
]

const output = fileURLToPath(new URL('../../../docs/images/style-reference/', import.meta.url))
mkdirSync(output, { recursive: true })

let styleReference = await createStyleReference()
let server = await createTestServer(styleReference.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    await page.emulateMedia({ colorScheme: shot.colorScheme, forcedColors: shot.forcedColors ?? 'none', reducedMotion: 'reduce' })
    await page.goto(server.baseUrl)
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)

    let path = `${output}${shot.name}.png`
    if (shot.formsOnly) {
      if (shot.focusInvalidField) await page.getByLabel('Email').first().focus()
      // A margin keeps the focus ring, which sits outside the field, in the picture.
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      let clip = await page.locator('[aria-labelledby="forms"]').evaluate((section) => {
        let box = section.getBoundingClientRect()
        let margin = 16
        return {
          x: box.x + window.scrollX - margin,
          y: box.y + window.scrollY - margin,
          width: box.width + 2 * margin,
          height: box.height + 2 * margin,
        }
      })
      await page.screenshot({ path, clip, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/style-reference/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await styleReference.close()
}
