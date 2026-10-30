import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { createButtonExamples } from './fixtures/button/server.tsx'
import { suppressValidationMessages } from './validation.ts'

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(
  t: TestContext,
  { reducedMotion = 'reduce' as 'reduce' | 'no-preference', clock = false, hydrate = true } = {},
) {
  let examples = await createButtonExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  if (clock) await page.clock.install()
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** Reads what the echo page says the server received. */
async function received(page: Page) {
  await page.locator('[data-echo="request"]').waitFor()
  let request = await page.locator('[data-echo="request"]').innerText()
  let fields = await page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.querySelector('dt')?.textContent}=${row.querySelector('dd')?.textContent}`),
    )
  return { request, fields }
}

/** Paints each button's background and text on a canvas, as the browser composites them, and returns sRGB bytes. */
function paintColors(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => {
    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    let context = canvas.getContext('2d', { willReadFrequently: true })!
    let paint = (color: string) => {
      // A canvas that can't parse a color keeps its previous fill, so fail instead of measuring that.
      context.fillStyle = '#010203'
      context.fillStyle = color
      if (context.fillStyle === '#010203') throw new Error(`The canvas can't paint ${color}`)
      context.fillRect(0, 0, 1, 1)
    }
    let read = () => [...context.getImageData(0, 0, 1, 1).data]
    let isOpaque = (color: string) => {
      context.clearRect(0, 0, 1, 1)
      paint(color)
      return read()[3] === 255
    }

    return elements.map((element) => {
      let layers: string[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        let background = getComputedStyle(node).backgroundColor
        layers.unshift(background)
        if (isOpaque(background)) break
      }
      context.clearRect(0, 0, 1, 1)
      for (let layer of layers) paint(layer)
      let background = read()
      paint(getComputedStyle(element).color)
      return { label: element.textContent?.trim() ?? '', background, text: read() }
    })
  })
}

const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })

describe('Button examples', () => {
  it('hydrate their client entries: an action button runs without submitting its form', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'Form')

    await form.getByRole('button', { name: 'Preview' }).click()
    await form.getByRole('status').getByText('Preview opened once. Nothing was sent.').waitFor()
    await form.getByRole('button', { name: 'Preview' }).press('Enter')
    await form.getByRole('status').getByText('Preview opened 2 times. Nothing was sent.').waitFor()
    await form.getByRole('button', { name: 'Preview' }).press(' ')

    await form.getByRole('status').getByText('Preview opened 3 times. Nothing was sent.').waitFor()
    assert.equal(new URL(page.url()).pathname, '/')
  })

  it('submit their name and value with Enter, Space or a click', async (t) => {
    let { page } = await open(t)

    await example(page, 'Form').getByRole('button', { name: 'Send reminder' }).press('Enter')
    assert.deepEqual(await received(page), {
      request: 'POST /echo',
      fields: ['email=billing@acme.example', 'intent=send'],
    })

    // A fresh load, since the soft navigation replaced <html> and its data-ready marker.
    await page.goto('/')
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await example(page, 'Form').getByRole('button', { name: 'Schedule' }).press(' ')
    assert.deepEqual((await received(page)).fields, ['email=billing@acme.example', 'intent=schedule'])
  })

  it('keep the submitter overrides: Save draft posts elsewhere and skips validation', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'Form')
    let email = form.getByLabel('Billing email')
    // WebKit's own message would starve the Save draft click of frames (see validation.ts).
    let invalidControls = await suppressValidationMessages(page)
    await email.fill('not an email')
    await email.blur()

    await form.getByRole('button', { name: 'Send reminder' }).click()
    assert.deepEqual(await invalidControls(), ['email'])
    assert.equal(await email.evaluate((input: HTMLInputElement) => input.validity.valid), false)
    // No message: the browser leaves focus where it was instead of moving it to the field.
    assert.equal(await email.evaluate((input) => input === document.activeElement), false)
    assert.equal(new URL(page.url()).pathname, '/')

    await form.getByRole('button', { name: 'Save draft' }).click()
    assert.deepEqual(await received(page), { request: 'POST /echo/draft', fields: ['email=not an email'] })
  })

  it('reset the form with a reset button', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'Form')
    await form.getByLabel('Billing email').fill('accounts@acme.example')

    await form.getByRole('button', { name: 'Reset' }).click()

    assert.equal(await form.getByLabel('Billing email').inputValue(), 'billing@acme.example')
  })

  it('work as plain HTML without JavaScript, and stay natively disabled where they keep focus once hydrated', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    let fewer = static_.getByRole('button', { name: 'Fewer invoices' })
    assert.equal(await fewer.isDisabled(), true)
    assert.equal(await fewer.getAttribute('aria-disabled'), null)

    await example(static_, 'Form').getByRole('button', { name: 'Schedule' }).click()
    assert.deepEqual((await received(static_)).fields, ['email=billing@acme.example', 'intent=schedule'])
  })

  it('stay natively disabled when the page renders them outside a client entry, also after hydration', async (t) => {
    let { page } = await open(t)
    let serverOnly = example(page, 'Server only')
    let submitted = await serverOnly.locator('form').evaluateHandle((form) => {
      let intents: string[] = []
      form.addEventListener('submit', (event) => {
        event.preventDefault()
        intents.push(String(new FormData(form as HTMLFormElement, (event as SubmitEvent).submitter).get('intent')))
      })
      return intents
    })

    for (let name of ['Pay', 'Wait']) {
      let button = serverOnly.getByRole('button', { name })
      assert.equal(await button.evaluate((element: HTMLButtonElement) => element.disabled), true, name)
      let box = (await button.boundingBox())!
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    await serverOnly.getByRole('button', { name: 'Hold' }).click()

    assert.deepEqual(await submitted.jsonValue(), ['hold'])
    assert.equal(await serverOnly.getByRole('button', { name: 'Pay' }).getAttribute('aria-disabled'), 'true')
  })

  it('keep focus while loading, cancel repeated clicks, and announce when done', async (t) => {
    let { page } = await open(t, { clock: true })
    let loading = example(page, 'Loading')
    let button = loading.getByRole('button', { name: 'Save template' })

    // Keyboard focus, so the ring shows in every engine: focus, then Tab away and back.
    await button.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Enter')
    let saving = loading.getByRole('button', { name: 'Saving template…' })
    await saving.waitFor()
    await saving.click()

    // Playwright counts aria-disabled as disabled, so read the native property.
    assert.equal(await saving.getAttribute('aria-disabled'), 'true')
    assert.equal(await saving.evaluate((element: HTMLButtonElement) => element.disabled), false)
    assert.equal(await saving.evaluate((element) => element === document.activeElement), true)

    // The dimmed button still draws a focus ring at 3:1 or more against the page, in both schemes.
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      let ring = await saving.evaluate((element) => {
        let canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        let context = canvas.getContext('2d', { willReadFrequently: true })!
        let style = getComputedStyle(element)
        context.fillStyle = getComputedStyle(document.documentElement).backgroundColor
        context.fillRect(0, 0, 1, 1)
        let background = [...context.getImageData(0, 0, 1, 1).data]
        context.globalAlpha = Number(style.opacity)
        context.fillStyle = style.outlineColor
        context.fillRect(0, 0, 1, 1)
        let ring = [...context.getImageData(0, 0, 1, 1).data]
        return { background, ring, opacity: style.opacity, style: style.outlineStyle }
      })
      let ratio = contrastRatio(toRgba(ring.ring), toRgba(ring.background))
      assert.deepEqual([ring.style, ring.opacity], ['solid', '0.5'])
      assert.ok(ratio >= 3, `${colorScheme}: ${ratio.toFixed(2)}`)
    }

    await page.clock.runFor(2000)
    await loading.getByRole('status').getByText('Template saved.').waitFor()
    assert.equal(await button.getAttribute('aria-disabled'), null)
    assert.equal(await button.evaluate((element) => element === document.activeElement), true)
  })

  it('navigate natively when they are links, with a click or Enter', async (t) => {
    let { page } = await open(t)
    let links = example(page, 'As links')

    await links.getByRole('link', { name: 'View invoices' }).click()
    assert.equal(new URL(page.url()).hash, '#invoices')

    await links.getByRole('link', { name: 'Reminders' }).press('Enter')
    assert.equal(new URL(page.url()).hash, '#reminders')
    assert.equal(await links.getByRole('button').count(), 0)
  })

  it('name every icon-only button, and hide the icons themselves', async (t) => {
    let { page } = await open(t)

    for (let name of ['Add a line item', 'Delete invoice INV-0042', 'Continue to payment', 'Copy link', 'Zoom in']) {
      assert.ok((await page.getByRole('button', { name, exact: true }).count()) > 0, name)
    }
    let unnamed = await page.locator('button, a[href]').evaluateAll((elements) =>
      elements
        .filter((element) => !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby'))
        .filter((element) => (element as HTMLElement).innerText.trim() === '')
        .map((element) => element.outerHTML),
    )
    assert.deepEqual(unnamed, [])
    assert.deepEqual(await page.locator('[data-slot="button"] svg:not([aria-hidden="true"])').count(), 0)
  })

  it('apply caller overrides: a css() mix, a token, and a rule in @layer app', async (t) => {
    let { page } = await open(t)
    let overrides = example(page, 'Overrides')
    let send = await computed(page, '[data-example="Variants and sizes"] [data-variant="default"]', 'background-color')

    assert.equal(
      await overrides.locator('[data-override="mix"]').evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
      '999px',
    )
    assert.notEqual(
      await overrides
        .locator('[data-override="token"] [data-slot="button"]')
        .first()
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      send,
    )
    assert.equal(
      await overrides.locator('[data-override="app"]').evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
      '0px',
    )
  })
})

describe('Button Group examples', () => {
  it('add no tab stop: Tab moves from button to button', async (t) => {
    let { page } = await open(t)
    let basic = example(page, 'Basic')
    await basic.getByRole('button', { name: 'Archive' }).focus()

    let order = ['Archive']
    for (let step = 0; step < 2; step++) {
      await page.keyboard.press('Tab')
      order.push(await page.evaluate(() => document.activeElement?.textContent ?? ''))
    }

    assert.deepEqual(order, ['Archive', 'Report', 'Snooze'])
    assert.equal(await basic.getByRole('group', { name: 'Invoice actions' }).getAttribute('tabindex'), null)
    // The focused part draws its ring above its neighbors.
    assert.deepEqual(
      await page.evaluate(() => {
        let style = getComputedStyle(document.activeElement!)
        return [document.activeElement!.matches(':focus-visible'), style.position, style.zIndex]
      }),
      [true, 'relative', '1'],
    )
  })

  it('submit grouped inputs and steppers with the form around them, each instance with its own value', async (t) => {
    let { page } = await open(t)
    let stepper = example(page, 'Stepper')

    let more = stepper.getByRole('button', { name: 'More invoices' })
    await more.click()
    await more.press('Enter')
    await stepper.getByRole('group', { name: 'invoices' }).getByText('3').waitFor()

    // The maximum disables More, which keeps focus instead of dropping it.
    assert.equal(await more.getAttribute('aria-disabled'), 'true')
    assert.equal(await more.evaluate((element) => element === document.activeElement), true)

    await stepper.getByRole('button', { name: 'Fewer reminders' }).click()
    await stepper.getByRole('group', { name: 'reminders' }).getByText('1').waitFor()
    await stepper.getByRole('button', { name: 'Order' }).click()
    assert.deepEqual((await received(page)).fields, ['invoices=3', 'reminders=1'])

    await page.goto('/')
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await example(page, 'With input').getByRole('searchbox', { name: 'Search invoices' }).fill('INV-0042')
    await example(page, 'With input').getByRole('searchbox', { name: 'Search invoices' }).press('Enter')
    assert.deepEqual(await received(page), { request: 'GET /echo', fields: ['q=INV-0042'] })
  })

  it('join their parts with the theme: one shared border and rounded outer corners', async (t) => {
    let { page } = await open(t)
    let [first, middle, last] = await example(page, 'Basic')
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          let style = getComputedStyle(button)
          return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderLeftWidth].join(' ')
        }),
      )

    assert.equal(first, '4px 0px 1px')
    assert.equal(middle, '0px 0px 0px')
    assert.equal(last, '0px 4px 0px')
    assert.equal(await computed(page, '[data-example="Split"] [role="separator"]', 'border-left-style'), 'solid')
  })

  it('mirror joins, padding and onward arrows in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = page.locator('[dir="rtl"]')
    let first = rtl.locator('[data-slot="button-group"] [data-slot="button"]').first()

    assert.deepEqual(
      await first.evaluate((button) => [
        getComputedStyle(button).borderTopRightRadius,
        getComputedStyle(button).borderTopLeftRadius,
      ]),
      ['4px', '0px'],
    )
    assert.equal(
      await rtl
        .getByRole('button', { name: 'Continue' })
        .locator('svg')
        .evaluate((svg) => getComputedStyle(svg).transform),
      'matrix(-1, 0, 0, 1, 0, 0)',
    )
    let next = rtl.getByRole('link', { name: 'Next' })
    assert.deepEqual(
      await next.evaluate((link) => [getComputedStyle(link).paddingRight, getComputedStyle(link).paddingLeft]),
      ['10px', '6px'],
    )
  })
})

describe('Button and Button Group styles', () => {
  it('keep text at 4.5:1 or more in every variant, at rest and on hover, in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = `[data-theme="${theme}"] [data-slot="button"]:not(:disabled):not([aria-invalid])`
      let measure = async (state: string) => {
        for (let { label, background, text } of await paintColors(page, selector)) {
          let ratio = contrastRatio(toRgba(text), toRgba(background))
          if (ratio < 4.5) failures.push(`${theme} ${state} ${label}: ${ratio.toFixed(2)}`)
        }
      }

      await measure('rest')
      for (let button of await page.locator(selector).all()) {
        await button.hover()
        let [{ label, background, text }] = await paintColors(page, `${selector}:hover`)
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} hover ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('follow data-theme for the colors that differ by scheme', async (t) => {
    let { page } = await open(t)
    let outline = (theme: string) =>
      computed(page, `[data-theme="${theme}"] [data-variant="outline"]`, 'border-top-color')

    // Engines round oklch() differently, so compare with each panel's own token.
    let token = (theme: string, name: string) =>
      page
        .locator(`[data-theme="${theme}"]`)
        .first()
        .evaluate((panel, token) => {
          let probe = panel.appendChild(document.createElement('span'))
          probe.style.color = `var(--${token})`
          let color = getComputedStyle(probe).color
          probe.remove()
          return color
        }, name)

    assert.equal(await outline('light'), await token('light', 'border'))
    assert.equal(await outline('dark'), await token('dark', 'input'))
    assert.notEqual(await outline('light'), await outline('dark'))
  })

  it('show a focus ring, also in forced colors, and gray out an aria-disabled button there', async (t) => {
    let { page } = await open(t)
    let send = example(page, 'Form').getByRole('button', { name: 'Send reminder' })

    await send.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    assert.deepEqual(await send.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth]), [
      'solid',
      '2px',
    ])

    await page.emulateMedia({ forcedColors: 'active' })
    assert.deepEqual(await send.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth]), [
      'solid',
      '2px',
    ])
    assert.equal(await send.evaluate((e) => getComputedStyle(e).borderTopStyle), 'solid')

    let fewer = example(page, 'Stepper').getByRole('button', { name: 'Fewer invoices' })
    let grayText = await page.evaluate(() => {
      let probe = document.createElement('span')
      probe.style.color = 'GrayText'
      document.body.append(probe)
      let color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    assert.equal(await fewer.getAttribute('aria-disabled'), 'true')
    // Only where the engine emulates forced colors; WebKit doesn't.
    if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
      assert.equal(await fewer.evaluate((e) => getComputedStyle(e).color), grayText)
    }
  })

  it('turn transitions and the loading spinner off for reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference', clock: true })
    let loading = example(page, 'Loading')
    await loading.getByRole('button', { name: 'Save template' }).click()
    let spinner = loading.locator('[data-icon="inline-start"]').first()
    let button = loading.getByRole('button')

    assert.equal(await button.evaluate((e) => getComputedStyle(e).transitionDuration), '0.1s')
    assert.equal(await spinner.evaluate((e) => getComputedStyle(e).animationName), 'remixcn-button-spin')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await button.evaluate((e) => getComputedStyle(e).transitionDuration), '0s')
    assert.equal(await spinner.evaluate((e) => getComputedStyle(e).animationName), 'none')
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let { width, overflowing } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.body.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map((element) => `${element.localName}: ${element.textContent?.trim().slice(0, 40)}`)
            .at(-1),
        }))
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    }
  })
})
