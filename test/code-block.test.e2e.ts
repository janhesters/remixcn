import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createCodeBlockExamples } from './fixtures/code-block/server.tsx'

type Clipboard = 'resolve' | 'reject' | 'real'

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The clipboard answers as the test says and records what it
// was asked to write; 'real' leaves the browser's own clipboard in place.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    clock = false,
    hydrate = true,
    clipboard = 'resolve' as Clipboard,
  } = {},
) {
  let examples = await createCodeBlockExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  if (clipboard !== 'real') {
    await page.addInitScript((answer) => {
      let writes: string[] = []
      Object.assign(window, { clipboardWrites: writes })
      navigator.clipboard.writeText = async (text: string) => {
        writes.push(text)
        if (answer === 'reject') throw new DOMException('Write permission denied.', 'NotAllowedError')
      }
    }, clipboard)
  }
  if (clock) await page.clock.install()
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function clipboardWrites(page: Page) {
  return page.evaluate(() => (window as unknown as { clipboardWrites: string[] }).clipboardWrites)
}

function engine(page: Page) {
  return page.context().browser()?.browserType().name()
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

/** Moves keyboard focus onto an element, so :focus-visible matches in every engine. */
async function focusWithKeyboard(page: Page, locator: ReturnType<Page['locator']>) {
  await locator.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
}

const opacity = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((element) => getComputedStyle(element).opacity)

const untrusted = `<script>alert("owned")</script>
<img src=x onerror="alert('owned')">
</code></pre><b>Not bold</b> &amp; not an entity`

const install = `$ bun add remix@3.0.0
bun add v1.4.2

installed remix@3.0.0

1 package installed [812.00ms]`

describe('Code Block examples', () => {
  it('hydrate their copy buttons, which copy the exact text and announce it', async (t) => {
    let { page } = await open(t)
    let header = example(page, 'Header')
    let copy = header.getByRole('button', { name: 'Copy' })

    await copy.click()

    await header.getByRole('status').getByText('Copied').waitFor()
    assert.equal(await header.getByRole('button', { name: 'Copied' }).count(), 1)
    assert.deepEqual(await clipboardWrites(page), [install])
  })

  it('copy to the real clipboard, markup and blank lines included', async (t) => {
    let { page } = await open(t, { clipboard: 'real' })
    // Reading the clipboard back needs a permission only Chromium grants to a test.
    if (engine(page) !== 'chromium') return
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    let block = example(page, 'Untrusted output')

    await block.getByRole('button', { name: 'Copy' }).click()
    await block.getByRole('status').getByText('Copied').waitFor()

    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), untrusted)
  })

  it('render untrusted output as text that never runs', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Untrusted output')

    assert.equal(await block.locator('script, img, b').count(), 0)
    assert.equal(
      await block.locator('pre').evaluate((pre) => (pre as HTMLElement).innerText.includes('<b>Not bold</b>')),
      true,
    )
    assert.equal(await page.evaluate(() => typeof (window as { owned?: unknown }).owned), 'undefined')
  })

  it('report a refused copy in the button and in a status, and keep the floating actions visible', async (t) => {
    let { page } = await open(t, { clipboard: 'reject' })
    let block = example(page, 'Floating actions')
    let copy = block.getByRole('button', { name: 'Copy install command' })

    await focusWithKeyboard(page, copy)
    await page.keyboard.press('Enter')
    await block.getByRole('status').getByText("Couldn't copy").waitFor()
    await page.keyboard.press('Tab')

    assert.equal(await block.getByRole('button', { name: "Couldn't copy" }).count(), 1)
    assert.equal(await opacity(block.locator('[data-slot="code-block-actions"]')), '1')
  })

  it('go back to Copy two seconds after a copy', async (t) => {
    let { page } = await open(t, { clock: true })
    let header = example(page, 'Header')

    await header.getByRole('button', { name: 'Copy' }).click()
    await header.getByRole('status').getByText('Copied').waitFor()
    await page.clock.runFor(2000)

    await header.getByRole('button', { name: 'Copy' }).waitFor()
    assert.equal(await header.getByRole('status').textContent(), '')
  })

  it('copy with Enter or Space, and reach floating actions with the keyboard', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Floating actions')
    let actions = block.locator('[data-slot="code-block-actions"]')
    let pre = block.locator('pre')

    assert.equal(await opacity(actions), '0')
    await focusWithKeyboard(page, pre)
    assert.equal(await opacity(actions), '1')

    // The actions come first in the block, so Shift+Tab reaches them from the code.
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Copy install command')
    await page.keyboard.press(' ')
    await block.getByRole('status').getByText('Copied').waitFor()

    await focusWithKeyboard(page, example(page, 'Header').getByRole('button', { name: 'Copy' }))
    await page.keyboard.press('Enter')
    await example(page, 'Header').getByRole('status').getByText('Copied').waitFor()

    assert.deepEqual(await clipboardWrites(page), ['bun add remix@3.0.0', install])
  })

  it('show floating actions while the pointer is over the block', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Floating actions')
    let actions = block.locator('[data-slot="code-block-actions"]')

    await block.locator('[data-slot="code-block"]').hover()
    assert.equal(await opacity(actions), '1')
    await block.getByRole('button', { name: 'Copy install command' }).click()
    await block.getByRole('status').getByText('Copied').waitFor()

    await page.mouse.move(0, 0)
    await page.locator('h1').click()
    assert.equal(await opacity(actions), '0')
  })

  it('always show floating actions on a touch screen', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ hasTouch: true, baseURL: server.baseUrl })
    t.after(() => context.close())
    let touch = await context.newPage()
    await touch.goto('/')

    // Each engine decides what hasTouch emulates; check the rule wherever the media query matches.
    if (await touch.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches)) {
      assert.equal(await opacity(example(touch, 'Floating actions').locator('[data-slot="code-block-actions"]')), '1')
    } else {
      assert.equal(
        await touch.evaluate(() =>
          [...document.styleSheets]
            .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
            .some((text) => text.includes('(hover: none), (pointer: coarse)') && text.includes('opacity: 1')),
        ),
        true,
      )
    }
  })

  it('copy without sending the form around them, which still submits with its own button', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'In a form')
    let copy = form.getByRole('button', { name: 'Copy setup command' })

    await copy.click()
    await focusWithKeyboard(page, copy)
    await page.keyboard.press('Enter')
    await page.keyboard.press(' ')
    await form.getByRole('status').getByText('Copied').waitFor()
    assert.equal(new URL(page.url()).pathname, '/')
    assert.deepEqual(await clipboardWrites(page), Array(3).fill('npx remixcn add code-block'))

    await form.getByRole('button', { name: 'Send steps' }).click()
    assert.deepEqual(await received(page), {
      request: 'POST /echo',
      fields: ['email=dev@acme.example', 'intent=send-steps'],
    })
  })

  it('show the code without JavaScript, with copy buttons disabled', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    let copies = static_.locator('[data-slot="code-block-copy-button"]')
    assert.ok((await copies.count()) > 10)
    assert.deepEqual(
      [...new Set(await copies.evaluateAll((buttons) => buttons.map((b) => (b as HTMLButtonElement).disabled)))],
      [true],
    )
    assert.equal(await example(static_, 'Untrusted output').locator('script, img, b').count(), 0)
    assert.match(await example(static_, 'Plain').locator('pre').innerText(), /Compiled 48 modules/)
  })

  it('keep a copy button disabled when the page renders it outside a client entry, also after hydration', async (t) => {
    let { page } = await open(t)
    let copy = example(page, 'Server only').locator('[data-slot="code-block-copy-button"]')

    assert.equal(await copy.isDisabled(), true)
    let box = (await copy.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    assert.deepEqual(await clipboardWrites(page), [])
  })

  it('keep each copy button its own state', async (t) => {
    let { page } = await open(t)
    let light = page.locator('[data-theme="light"]')
    let dark = page.locator('[data-theme="dark"]')

    await dark.locator('[data-example], [data-slot="code-block"]').first().getByRole('button', { name: 'Copy' }).click()
    await dark.getByRole('status').getByText('Copied').first().waitFor()

    assert.equal(await light.getByText('Copied').count(), 0)
    assert.equal(await example(page, 'Header').getByRole('status').textContent(), '')
  })

  it('stream code line by line and copy it only once it is complete', async (t) => {
    let { page } = await open(t, { clock: true })
    let streaming = example(page, 'Streaming')
    let copy = streaming.locator('[data-slot="code-block-copy-button"]')
    let pre = streaming.locator('pre')

    await streaming.getByRole('button', { name: 'Replay' }).click()
    await page.clock.runFor(100)
    assert.equal(await copy.isDisabled(), true)
    assert.equal(await pre.getAttribute('aria-busy'), 'true')
    assert.ok((await streaming.locator('[data-slot="code-block-line"]').count()) < 14)

    await page.clock.runFor(10_000)
    await streaming.getByRole('button', { name: 'Replay' }).waitFor({ state: 'visible' })
    assert.equal(await copy.isDisabled(), false)
    assert.equal(await pre.getAttribute('aria-busy'), null)
    assert.equal(await streaming.locator('[data-slot="code-block-line"]').count(), 14)
  })

  it('expand with Show more, which says its state and points at the content', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Show more')
    let toggle = block.getByRole('button', { name: 'Show more' })
    let pre = block.locator('pre')
    let collapsed = (await pre.boundingBox())!.height

    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(await toggle.getAttribute('aria-controls'), await pre.getAttribute('id'))

    await toggle.press('Enter')
    let less = block.getByRole('button', { name: 'Show less' })
    await less.waitFor()

    assert.equal(await less.getAttribute('aria-expanded'), 'true')
    assert.ok((await pre.boundingBox())!.height > collapsed)
  })

  it('toggle wrapping with a pressed button', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Actions')
    let toggle = block.getByRole('button', { name: 'Wrap lines' })
    let pre = block.locator('pre')

    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    assert.ok(await pre.evaluate((element) => element.scrollWidth > element.clientWidth))

    await toggle.click()

    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    assert.equal(await pre.getAttribute('data-wrap'), '')
    assert.ok(await pre.evaluate((element) => element.scrollWidth <= element.clientWidth))
  })

  it('scroll long code by keyboard inside the block', async (t) => {
    let { page } = await open(t)
    let pre = example(page, 'Line numbers').locator('pre')

    await focusWithKeyboard(page, pre)
    for (let press = 0; press < 10; press++) await page.keyboard.press('ArrowRight')

    // A key press returns before the engine has scrolled: Firefox scrolls
    // smoothly over the next frames. So wait, up to two seconds, for the code to move.
    await page.waitForFunction((element) => element.scrollLeft > 0, await pre.elementHandle(), { timeout: 2000 })
    assert.ok(await pre.evaluate((element) => element.scrollLeft > 0))
    assert.equal(await page.evaluate(() => document.documentElement.scrollLeft), 0)
  })

  it('pass axe-core WCAG 2.2 A and AA checks, before and after a copy', async (t) => {
    let { page } = await open(t)
    let violations = await findAccessibilityViolations(page)
    assert.deepEqual(violations, [], violations.join('\n'))

    await example(page, 'Header').getByRole('button', { name: 'Copy' }).click()
    await example(page, 'Header').getByRole('status').getByText('Copied').waitFor()
    await example(page, 'Show more').getByRole('button', { name: 'Show more' }).click()
    violations = await findAccessibilityViolations(page)
    assert.deepEqual(violations, [], violations.join('\n'))
  })
})

/**
 * Paints each element's text (or a pseudo-element's) on its background, as the
 * browser composites them, and returns the contrast ratio.
 */
function measure(page: Page, selector: string, pseudo?: '::before' | '::after') {
  return page.locator(selector).evaluateAll((elements, pseudo) => {
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
      paint(getComputedStyle(element, pseudo ?? null).color)
      return { label: element.textContent?.trim().slice(0, 30) ?? '', background, text: read() }
    })
  }, pseudo ?? null)
}

const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })

describe('Code Block styles', () => {
  it('keep code, titles, line numbers, diff markers and tokens at 4.5:1 or more in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let panel = `[data-theme="${theme}"]`
      let checks: Array<[string, string, ('::before' | '::after')?]> = [
        ['code', `${panel} [data-slot="code-block-content"]`],
        ['title', `${panel} [data-slot="code-block-title"]`],
        ['line number', `${panel} [data-numbered] [data-slot="code-block-line"]`, '::before'],
        [
          'marker',
          `${panel} [data-slot="code-block-line"]:is([data-variant="added"], [data-variant="removed"])`,
          '::after',
        ],
      ]
      for (let [name, selector, pseudo] of checks) {
        let results = await measure(page, selector, pseudo)
        assert.ok(results.length > 0, `${theme} ${name}: nothing to measure`)
        for (let { label, background, text } of results) {
          let ratio = contrastRatio(toRgba(text), toRgba(background))
          if (ratio < 4.5) failures.push(`${theme} ${name} "${label}": ${ratio.toFixed(2)}`)
        }
      }
    }

    // Tokens anywhere on the page, removed and highlighted lines included, in each scheme.
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (let { label, background, text } of await measure(page, '[data-slot="code-block-token"][style]')) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${colorScheme} token "${label}": ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('set highlighted and added lines apart from the block in both themes', async (t) => {
    let { page } = await open(t)

    for (let theme of ['light', 'dark']) {
      let [line] = await measure(page, `[data-theme="${theme}"] [data-variant="added"]`)
      let [block] = await measure(page, `[data-theme="${theme}"] [data-slot="code-block-content"]`)
      assert.notDeepEqual(line.background, block.background, theme)
    }
  })

  it('show a focus ring around the block while its code has keyboard focus, also in forced colors', async (t) => {
    let { page } = await open(t)
    let block = example(page, 'Diff').locator('[data-slot="code-block"]')
    let ring = () =>
      block.evaluate((element) => [getComputedStyle(element).outlineStyle, getComputedStyle(element).outlineWidth])

    await focusWithKeyboard(page, block.locator('pre'))
    assert.deepEqual(await ring(), ['solid', '2px'])

    await page.emulateMedia({ forcedColors: 'active' })
    assert.deepEqual(await ring(), ['solid', '2px'])
  })

  it('mark changed and highlighted lines with a bar in forced colors, where tints disappear', async (t) => {
    let { page } = await open(t)
    // Only where the engine emulates forced colors; WebKit doesn't.
    await page.emulateMedia({ forcedColors: 'active' })
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return

    let bars = await page
      .locator('[data-example="Diff"] [data-slot="code-block-line"]')
      .evaluateAll((lines) => lines.map((line) => getComputedStyle(line).borderInlineStartStyle))

    assert.deepEqual(bars, ['none', 'solid', 'solid', 'solid', 'none'])
  })

  it('fade the floating actions with the motion tokens, and not at all for reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let actions = example(page, 'Floating actions').locator('[data-slot="code-block-actions"]')
    let duration = () => actions.evaluate((element) => getComputedStyle(element).transitionDuration)

    assert.notEqual(await duration(), '0s')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await duration(), '0s')
  })

  it('mirror the header and floating actions in right-to-left text, and keep code left to right', async (t) => {
    let { page } = await open(t)
    let rtl = page.locator('[dir="rtl"]').first()
    let [withHeader, floating] = await rtl.locator('[data-slot="code-block"]').all()

    let title = (await withHeader.locator('[data-slot="code-block-title"]').boundingBox())!
    let headerActions = (await withHeader.locator('[data-slot="code-block-actions"]').boundingBox())!
    assert.ok(headerActions.x < title.x, 'the actions sit at the left end of the header')

    let block = (await floating.boundingBox())!
    let actions = (await floating.locator('[data-slot="code-block-actions"]').boundingBox())!
    assert.ok(actions.x + actions.width < block.x + block.width / 2, 'the floating actions sit at the left')

    assert.equal(await withHeader.locator('pre').evaluate((pre) => getComputedStyle(pre).direction), 'ltr')
    let numbers = await withHeader
      .locator('[data-slot="code-block-line"]')
      .first()
      .evaluate((line) => {
        let content = line.querySelector('[data-slot="code-block-line-content"]')!.getBoundingClientRect()
        return content.x > line.getBoundingClientRect().x + 20
      })
    assert.equal(numbers, true, 'line numbers sit at the left of the code')
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
            .filter((element) => !element.closest('pre'))
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map((element) => `${element.localName}: ${element.textContent?.trim().slice(0, 40)}`)
            .at(-1),
        }))
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    }

    // Long code scrolls inside its block instead.
    assert.ok(
      await example(page, 'Plain')
        .locator('pre')
        .evaluate((pre) => pre.scrollWidth > pre.clientWidth),
    )
  })
})
