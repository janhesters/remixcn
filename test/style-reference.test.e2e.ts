import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { createStyleReference } from './fixtures/style-reference/server.tsx'

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(t: TestContext, { reducedMotion = 'reduce' as 'reduce' | 'no-preference' } = {}) {
  let styleReference = await createStyleReference()
  t.after(() => void styleReference.close())

  let page = await t.serve(await createTestServer(styleReference.fetch))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  return page
}

type Page = Awaited<ReturnType<typeof open>>

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

describe('style reference', () => {
  it('follows the system color scheme', async (t) => {
    let page = await open(t)
    let light = await computed(page, 'html', 'background-color')

    await page.emulateMedia({ colorScheme: 'dark' })
    let dark = await computed(page, 'html', 'background-color')

    assert.equal(light, 'oklch(1 0 0)')
    assert.equal(dark, 'oklch(0.145 0 0)')
  })

  it('lets data-theme override the system preference', async (t) => {
    let page = await open(t)

    assert.equal(await computed(page, '[data-theme="dark"]', 'background-color'), 'oklch(0.145 0 0)')
    assert.equal(await computed(page, '[data-theme="dark"] label', 'color'), 'oklch(0.985 0 0)')

    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await computed(page, '[data-theme="light"]', 'background-color'), 'oklch(1 0 0)')
  })

  it('gives native controls the primary color of their own theme and of a token override', async (t) => {
    let page = await open(t)
    let accent = (selector: string) => computed(page, `${selector} input[type="checkbox"]`, 'accent-color')

    assert.equal(await accent('[aria-labelledby="forms"]'), 'oklch(0.205 0 0)')
    assert.equal(await accent('[data-theme="dark"]'), 'oklch(0.922 0 0)')

    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await accent('[data-theme="light"]'), 'oklch(0.205 0 0)')

    await page.locator('[aria-labelledby="forms"]').evaluate((section) => {
      ;(section as HTMLElement).style.setProperty('--primary', 'rgb(0, 128, 0)')
    })
    assert.equal(await accent('[aria-labelledby="forms"]'), 'rgb(0, 128, 0)')
  })

  it("defines every token through Remix's asset server", async (t) => {
    let page = await open(t)
    let missing = await page.evaluate(() => {
      let names = ['background', 'foreground', 'primary', 'muted-foreground', 'destructive', 'ring', 'chart-5']
      names.push('sidebar-primary', 'font-sans', 'text-sm', 'spacing', 'radius', 'duration-fast')
      let style = getComputedStyle(document.documentElement)
      return names.filter((name) => style.getPropertyValue(`--${name}`).trim() === '')
    })

    assert.deepEqual(missing, [])
  })

  it('orders the layers base, rmx, app, so callers can override components', async (t) => {
    let page = await open(t)
    let radius = (selector: string) => computed(page, selector, 'border-top-left-radius')

    // rmx beats base: the button's css() sets a weight that the reset's font: inherit would undo.
    assert.equal(await computed(page, '[aria-labelledby="forms"] button', 'font-weight'), '500')
    assert.equal(await radius('[aria-labelledby="overrides"] li:first-child > span'), '4px')
    assert.notEqual(
      await computed(page, '[data-override="token"] > span', 'background-color'),
      await computed(page, '[aria-labelledby="overrides"] li:first-child > span', 'background-color'),
    )
    assert.equal(await radius('[data-override="mix"]'), '0px')
    // :where(.pill) has no specificity; the app layer alone makes it win.
    assert.equal(await radius('[data-override="app"]'), '999px')
  })

  it('shows a focus ring on a focused field, also in forced colors', async (t) => {
    let page = await open(t)
    let name = page.getByLabel('Name').first()

    await name.focus()
    let ring = await name.evaluate((element) => {
      let style = getComputedStyle(element)
      return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset]
    })
    assert.deepEqual(ring, ['solid', '2px', 'oklch(0.556 0 0)', '2px'])

    await page.emulateMedia({ forcedColors: 'active' })
    assert.deepEqual(
      await name.evaluate((element) => [
        getComputedStyle(element).outlineStyle,
        getComputedStyle(element).outlineWidth,
      ]),
      ['solid', '2px'],
    )
    assert.equal(await computed(page, '[aria-labelledby="forms"] input[type="checkbox"]', 'appearance'), 'auto')
    assert.equal(await computed(page, '[aria-labelledby="forms"] select', 'forced-color-adjust'), 'auto')
  })

  it('marks an invalid field in red, with an icon and a message', async (t) => {
    let page = await open(t)
    let email = page.getByLabel('Email').first()

    assert.equal(await email.getAttribute('aria-invalid'), 'true')
    assert.equal(
      await email.evaluate((element) => getComputedStyle(element).borderTopColor),
      'oklch(0.56 0.245 27.325)',
    )

    let message = page.locator(`#${await email.getAttribute('aria-describedby')}`)
    assert.equal(await message.innerText(), 'Enter an email address like name@example.com.')
    assert.equal(await message.locator('svg[aria-hidden="true"]').count(), 1)

    await email.focus()
    assert.equal(await email.evaluate((element) => getComputedStyle(element).outlineColor), 'oklch(0.56 0.245 27.325)')
  })

  it('turns transitions off for reduced motion', async (t) => {
    let page = await open(t, { reducedMotion: 'no-preference' })
    assert.equal(await computed(page, '[aria-labelledby="forms"] input', 'transition-duration'), '0.1s')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await computed(page, '[aria-labelledby="forms"] input', 'transition-duration'), '0s')
  })

  it('reflows to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let page = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let width = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}`)
      }
    }
  })

  it('mirrors directional icons and logical borders in right-to-left text', async (t) => {
    let page = await open(t)

    assert.equal(await computed(page, '[dir="ltr"] svg', 'transform'), 'none')
    assert.equal(await computed(page, '[dir="rtl"] svg', 'transform'), 'matrix(-1, 0, 0, 1, 0, 0)')
    assert.equal(await computed(page, '[dir="rtl"]', 'border-right-width'), '2px')
    assert.equal(await computed(page, '[dir="rtl"]', 'border-left-width'), '0px')
  })
})
