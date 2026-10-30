// Captures the static site in headless Chromium for UI reviews: the Button
// page on a wide and a narrow screen in both themes, a theme the reader
// picked, the menu and the search open, an example after a form and a copy,
// the home and components pages, 320px with text at 200%, and the narrow page
// and an example without JavaScript. It builds the site into dist/site first and reads it
// back as GitHub Pages would serve it. Run `bun run capture:site`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { href } from './app/site.ts'
import { buildSite } from './build.ts'
import { createStaticSite } from './preview.ts'

interface Shot {
  name: string
  path: string
  width: number
  height?: number
  colorScheme: 'light' | 'dark'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  fullPage?: boolean
  prepare?: (page: Page) => Promise<void>
}

const button = href('docs/components/button/')
const desktop = 1280
const narrow = 390

async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
  await page.getByRole('dialog', { name: 'Sidebar' }).waitFor()
}

async function search(page: Page) {
  await page.getByRole('button', { name: /Search the docs/ }).click()
  await page.getByRole('dialog', { name: 'Search the docs' }).waitFor()
  await page.keyboard.type('but')
}

const shots: Shot[] = [
  { name: 'button-desktop-light', path: button, width: desktop, colorScheme: 'light' },
  { name: 'button-desktop-dark', path: button, width: desktop, colorScheme: 'dark' },
  { name: 'button-narrow-light', path: button, width: narrow, colorScheme: 'light' },
  { name: 'button-narrow-dark', path: button, width: narrow, colorScheme: 'dark' },
  {
    name: 'theme-dark-picked-on-light-system',
    path: button,
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      await page.getByRole('radio', { name: 'Dark' }).check()
    },
  },
  { name: 'menu-narrow-light', path: button, width: narrow, colorScheme: 'light', prepare: openMenu },
  { name: 'menu-narrow-dark', path: button, width: narrow, colorScheme: 'dark', prepare: openMenu },
  { name: 'search-desktop-light', path: button, width: desktop, colorScheme: 'light', prepare: search },
  { name: 'search-narrow-dark', path: button, width: narrow, colorScheme: 'dark', prepare: search },
  {
    name: 'example-after-submit-and-copy-light',
    path: button,
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      let form = page.locator('[data-docs-example="ButtonForm"]')
      await form.getByLabel('Billing email').fill('ops@acme.example')
      await form.getByRole('button', { name: 'Send reminder' }).click()
      await form.locator('[data-docs-example-status]').filter({ hasText: 'intent=send' }).waitFor()
      await form.getByRole('button', { name: 'Copy the ButtonForm source' }).click()
      await form.getByRole('status').filter({ hasText: 'Copied' }).waitFor()
      await page.evaluate(() => document.querySelector('#example-form')?.scrollIntoView())
    },
  },
  { name: 'home-desktop-light', path: href(), width: desktop, colorScheme: 'light' },
  { name: 'components-desktop-dark', path: href('docs/components/'), width: desktop, colorScheme: 'dark' },
  {
    name: 'introduction-320-text-200-light',
    path: href('docs/'),
    width: 320,
    height: 640,
    colorScheme: 'light',
    fontSize: '32px',
  },
  { name: 'without-javascript-narrow-light', path: button, width: narrow, colorScheme: 'light', javaScript: false },
  {
    name: 'example-without-javascript-light',
    path: button,
    width: desktop,
    colorScheme: 'light',
    javaScript: false,
    async prepare(page) {
      await page.locator('[data-docs-example="ButtonForm"] [data-docs-source]').scrollIntoViewIfNeeded()
    },
  },
]

const output = fileURLToPath(new URL('../../docs/images/site/', import.meta.url))
const site = fileURLToPath(new URL('../../dist/site', import.meta.url))
mkdirSync(output, { recursive: true })

await buildSite(site)
let server = await createTestServer(createStaticSite(site))
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let javaScript = shot.javaScript ?? true
    let context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height ?? 844 },
      javaScriptEnabled: javaScript,
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    let page = await context.newPage()
    await page.emulateMedia({ colorScheme: shot.colorScheme, reducedMotion: 'reduce' })
    await page.goto(new URL(shot.path, server.baseUrl).href)
    if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)
    if (javaScript) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }

    await page.screenshot({ path: `${output}${shot.name}.png`, fullPage: shot.fullPage ?? false })
    await context.close()
    process.stdout.write(`✓ docs/images/site/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
}
