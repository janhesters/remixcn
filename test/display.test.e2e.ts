import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { paintColors, toRgba } from './paint.ts'
import { createDisplayExamples } from './fixtures/display/server.tsx'

// Pages open with reduced motion, so transitions take 0s and animations stay
// still. The motion test opts back in.
async function open(
  t: TestContext,
  { reducedMotion = 'reduce' as 'reduce' | 'no-preference', clock = false, hydrate = true } = {},
) {
  let examples = await createDisplayExamples()
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

function example(page: Page, id: string) {
  return page.locator(`[data-example="${id}"]`).first()
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** Reads one avatar: whether its image shows and is named, and its fallback text. */
function avatarState(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((root) => {
      let image = root.querySelector('img')
      let fallback = root.querySelector('[data-slot="avatar-fallback"]')
      return {
        image: !image
          ? 'none'
          : image.hidden
            ? 'hidden'
            : image.getAttribute('aria-hidden') === 'true'
              ? 'unnamed'
              : 'shown',
        fallback: fallback ? fallback.textContent : null,
      }
    })
}

describe('Display and feedback examples', () => {
  it('pass axe-core WCAG 2.2 A and AA checks, in both color schemes', async (t) => {
    let { page } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      let violations = await findAccessibilityViolations(page)
      assert.deepEqual(violations, [], `${colorScheme}:\n${violations.join('\n')}`)
    }
  })

  it('give alerts the live role of their urgency, and announce a status that stays rendered', async (t) => {
    let { page } = await open(t)

    assert.equal(await example(page, 'alert-basic').locator('[role="alert"], [role="status"]').count(), 0)
    assert.equal(await example(page, 'alert-destructive').getByRole('alert').count(), 1)

    let live = example(page, 'alert-live')
    let status = live.getByRole('status')
    let region = await status.elementHandle()
    assert.equal(await status.innerText(), 'Draft\nNo changes saved yet.')

    await live.getByRole('button', { name: 'Save draft' }).click()
    await status.getByText('Draft saved once.').waitFor()
    await live.getByRole('button', { name: 'Save draft' }).press('Enter')
    await status.getByText('Draft saved 2 times.').waitFor()

    // The same region, so screen readers announce the change.
    assert.equal(await region!.evaluate((element) => element.isConnected), true)
  })

  it('swap a failed avatar image for its fallback, and follow a changed image', async (t) => {
    let { page } = await open(t)
    let picker = example(page, 'avatar-picker')
    let avatar = '[data-example="avatar-picker"] [data-slot="avatar"]'

    await picker.getByText('Photo: loaded.').waitFor()
    assert.deepEqual(await avatarState(page, avatar), { image: 'shown', fallback: null })
    assert.equal(await picker.getByRole('img', { name: 'Ada Lovelace' }).count(), 1)

    await picker.getByRole('button', { name: 'Use a broken link' }).click()
    await picker.getByText('Photo: error.').waitFor()
    assert.deepEqual(await avatarState(page, avatar), { image: 'hidden', fallback: 'AL' })

    await picker.getByRole('button', { name: 'Remove photo' }).press('Enter')
    await picker.getByText('No photo.').waitFor()
    assert.deepEqual(await avatarState(page, avatar), { image: 'none', fallback: 'AL' })

    await picker.getByRole('button', { name: 'Use photo' }).press(' ')
    await picker.getByText('Photo: loaded.').waitFor()
    assert.deepEqual(await avatarState(page, avatar), { image: 'shown', fallback: null })

    assert.deepEqual(await avatarState(page, '[data-example-avatar="broken"]'), { image: 'hidden', fallback: 'AL' })
  })

  it('keep avatars safe as plain HTML: the fallback names each one, and the box keeps its size', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    let state = await avatarState(static_, '[data-example-avatar="broken"]')
    assert.deepEqual(state, { image: 'unnamed', fallback: 'AL' })
    let box = await static_.locator('[data-example-avatar="broken"]').boundingBox()
    assert.deepEqual([box?.width, box?.height], [32, 32])
    // A broken image paints its alt text transparent, so the initials stay readable.
    assert.equal(
      await static_.locator('[data-example-avatar="broken"] img').evaluate((image) => getComputedStyle(image).color),
      'rgba(0, 0, 0, 0)',
    )
  })

  it('show collapsed breadcrumb levels from a named button, and move focus to the first one', async (t) => {
    let { page } = await open(t)
    let trail = example(page, 'breadcrumb-collapsed').getByRole('navigation', { name: 'Invoice location' })

    assert.deepEqual(await trail.locator('a[href]').allInnerTexts(), ['Home', 'Invoices'])
    await trail.getByRole('button', { name: 'Show 2 hidden levels' }).press('Enter')

    await trail.getByRole('link', { name: 'Customers' }).waitFor()
    assert.deepEqual(await trail.locator('a[href]').allInnerTexts(), ['Home', 'Customers', 'Acme Labs', 'Invoices'])
    // The current page is a disabled link, as in shadcn.
    assert.equal(await trail.getByRole('link', { name: 'INV-0042' }).getAttribute('aria-disabled'), 'true')
    assert.equal(
      await trail.getByRole('link', { name: 'Customers' }).evaluate((link) => link === document.activeElement),
      true,
    )
  })

  it('mark breadcrumbs up as a navigation landmark with an ordered list and native links', async (t) => {
    let { page } = await open(t)
    let trail = example(page, 'breadcrumb-basic').getByRole('navigation', { name: 'breadcrumb' })

    assert.equal(await trail.locator('ol > li').count(), 5)
    assert.equal(await trail.locator('[aria-current="page"]').innerText(), 'INV-0042')
    assert.equal(await trail.locator('[data-slot="breadcrumb-separator"][aria-hidden="true"]').count(), 2)

    await trail.getByRole('link', { name: 'Invoices' }).press('Enter')
    assert.equal(new URL(page.url()).hash, '#invoices')
    await trail.getByRole('link', { name: 'Home' }).click()
    assert.equal(new URL(page.url()).hash, '#home')
  })

  it('submit a card form with a button in the footer', async (t) => {
    let { page } = await open(t)
    let card = example(page, 'card-form').getByRole('region', { name: 'Send a reminder' })

    await card.getByRole('heading', { level: 3, name: 'Send a reminder' }).waitFor()
    await card.getByRole('button', { name: 'Send reminder' }).click()

    await page.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(
      await page
        .locator('[data-echo="fields"] > div')
        .evaluateAll((rows) =>
          rows.map((row) => `${row.querySelector('dt')?.textContent}=${row.querySelector('dd')?.textContent}`),
        ),
      ['email=billing@acme.example', 'intent=remind'],
    )
  })

  it('switch the direction of a subtree, while a nested subtree keeps its own', async (t) => {
    let { page } = await open(t)
    let nested = example(page, 'direction-nested')
    assert.deepEqual(
      await nested
        .locator('[data-slot="direction"]')
        .evaluateAll((providers) => providers.map((p) => p.getAttribute('dir'))),
      ['rtl', 'ltr'],
    )

    let toggle = example(page, 'direction-switch')
    let chevron = '[data-example="direction-switch"] [data-slot="breadcrumb-separator"] > span'
    assert.equal(await computed(page, chevron, 'transform'), 'none')
    let title = toggle.locator('[data-slot="card-title"]')
    assert.equal(await title.innerText(), 'Invoice INV-0042')

    await toggle.getByRole('button', { name: 'Right to left' }).click()

    await toggle.locator('[data-slot="direction"][dir="rtl"]').waitFor()
    assert.equal(await computed(page, chevron, 'transform'), 'matrix(-1, 0, 0, 1, 0, 0)')
    assert.equal(await title.innerText(), 'الفاتورة INV-0042')
    assert.equal(await toggle.getByRole('button', { name: 'Right to left' }).getAttribute('aria-pressed'), 'true')
  })

  it('make an item group a list of list items, with links that are whole rows', async (t) => {
    let { page } = await open(t)
    let group = example(page, 'item-links').getByRole('list', { name: 'Customers' })

    assert.equal(await group.getByRole('listitem').count(), 3)
    await group.getByRole('link', { name: /Globex/ }).press('Enter')
    assert.equal(new URL(page.url()).hash, '#globex')
  })

  it('follow a controlled value from the keyboard and a pointer, and show indeterminate progress', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'progress-controlled')
    let bar = controlled.getByRole('progressbar', { name: 'Monthly goal' })
    let range = controlled.getByRole('slider', { name: 'Set the progress' })

    await range.focus()
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight')
    assert.equal(await bar.getAttribute('aria-valuenow'), '55')
    assert.equal(await bar.getAttribute('aria-valuetext'), '55%')
    assert.equal(await controlled.locator('[data-slot="progress-value"]').innerText(), '55%')

    await page.keyboard.press('End')
    assert.equal(await bar.getAttribute('aria-valuenow'), '100')
    assert.equal(await bar.getAttribute('data-complete'), '')

    let box = (await range.boundingBox())!
    await page.mouse.click(box.x + 2, box.y + box.height / 2)
    assert.equal(await bar.getAttribute('aria-valuenow'), '0')
    assert.equal(
      await bar.locator('[data-slot="progress-indicator"]').evaluate((e) => (e as HTMLElement).style.width),
      '0%',
    )

    let waiting = example(page, 'progress-indeterminate').getByRole('progressbar', { name: 'Preparing the export' })
    assert.equal(await waiting.getAttribute('aria-valuenow'), null)
    assert.equal(await waiting.getAttribute('aria-valuetext'), 'indeterminate progress')
  })

  it('mark a reloading region busy and say what loads, then show the content again', async (t) => {
    let { page } = await open(t, { clock: true })
    let reload = example(page, 'skeleton-reload')
    let region = reload.locator('[aria-busy]')
    let status = reload.getByRole('status')
    assert.equal(await region.getAttribute('aria-busy'), 'false')
    assert.equal(await status.innerText(), '')

    await reload.getByRole('button', { name: 'Reload' }).click()

    assert.equal(await region.getAttribute('aria-busy'), 'true')
    assert.equal(await status.innerText(), 'Loading the account owner')
    assert.ok((await region.locator('[data-slot="skeleton"][aria-hidden="true"]').count()) > 0)
    // The button keeps focus while it waits.
    assert.equal(
      await reload.getByRole('button', { name: 'Reload' }).evaluate((b) => b === document.activeElement),
      true,
    )

    await page.clock.runFor(1500)
    await reload.getByText('Grace Hopper').waitFor()
    assert.equal(await region.getAttribute('aria-busy'), 'false')
    assert.equal(await status.innerText(), 'Account owner loaded')
  })

  it('keep every loading status outside its busy region, so assistive technology may announce it at once', async (t) => {
    let { page } = await open(t)
    let statuses = page.locator('#skeleton [role="status"]')

    assert.equal(await statuses.count(), 6)
    assert.deepEqual(
      await statuses.evaluateAll((elements) => elements.filter((element) => element.closest('[aria-busy]')).length),
      0,
    )
    assert.deepEqual(
      await page
        .locator('#skeleton [aria-busy="true"]')
        .evaluateAll((regions) => regions.map((region) => region.previousElementSibling?.getAttribute('role'))),
      ['status', 'status', 'status', 'status', 'status'],
    )
  })

  it('name every spinner that stands alone, and hide the ones next to text that says the same', async (t) => {
    let { page } = await open(t)

    assert.ok((await page.getByRole('status', { name: 'Loading payments' }).count()) > 0)
    let unnamed = await page
      .locator('[data-slot="spinner"]:not([aria-hidden="true"])')
      .evaluateAll((spinners) => spinners.filter((s) => !s.getAttribute('aria-label')).length)
    assert.equal(unnamed, 0)
    assert.equal(await page.locator('[data-slot="button"] [data-slot="spinner"]:not([aria-hidden="true"])').count(), 0)
  })
})

describe('Display and feedback styles', () => {
  it('keep text at 4.5:1 or more on its own background, in both themes', async (t) => {
    let { page } = await open(t)
    let parts = [
      'badge',
      'kbd',
      'alert-title',
      'alert-description',
      'avatar-fallback',
      'avatar-group-count',
      'progress-label',
      'progress-value',
      'item-title',
      'item-description',
      'empty-title',
      'empty-description',
      'card-description',
      'breadcrumb-link',
      'breadcrumb-page',
    ]
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = parts.map((part) => `[data-theme="${theme}"] [data-slot="${part}"]:not([aria-invalid])`).join(', ')
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('show a focus ring on links that look like badges, items and breadcrumbs, also in forced colors', async (t) => {
    let { page } = await open(t)
    let links = [
      example(page, 'badge-links').getByRole('link', { name: 'Drafts' }),
      example(page, 'item-links').getByRole('link', { name: /Acme Labs/ }),
      example(page, 'breadcrumb-basic').getByRole('link', { name: 'Invoices' }),
    ]

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      for (let link of links) {
        await link.focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        assert.deepEqual(
          await link.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth]),
          ['solid', '2px'],
          `${await link.innerText()} in forced colors ${forcedColors}`,
        )
      }
    }
  })

  it('keep progress fills, separators, keys and placeholders visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })
    // Only where the engine emulates forced colors. WebKit matches the media
    // query without forcing colors, so there it checks the colors the
    // components draw themselves.
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return

    let fill = await computed(
      page,
      '[data-example="progress-label"] [data-slot="progress-indicator"]',
      'background-color',
    )
    let canvas = await page.evaluate(() => {
      let probe = document.body.appendChild(document.createElement('span'))
      probe.style.color = 'Canvas'
      let color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    assert.notEqual(fill, canvas)
    assert.equal(
      await computed(page, '[data-example="progress-label"] [data-slot="progress-track"]', 'border-top-style'),
      'solid',
    )

    for (let [selector, property] of [
      ['[data-example="separator-horizontal"] [data-slot="separator"]', 'border-top'],
      ['[data-example="kbd-basic"] [data-slot="kbd"]', 'border-top'],
      ['[data-example="skeleton-text"] [data-slot="skeleton"]', 'border-top'],
    ]) {
      let [style, color] = await page
        .locator(selector)
        .first()
        .evaluate(
          (e, side) => [
            getComputedStyle(e).getPropertyValue(`${side}-style`),
            getComputedStyle(e).getPropertyValue(`${side}-color`),
          ],
          property,
        )
      assert.equal(style, 'solid', selector)
      assert.notEqual(color, canvas, selector)
      assert.notEqual(color, 'rgba(0, 0, 0, 0)', selector)
    }
  })

  it('animate spinners, skeletons and indeterminate progress only without reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let animated = {
      spinner: '[data-example="spinner-sizes"] [data-slot="spinner"]',
      skeleton: '[data-example="skeleton-text"] [data-slot="skeleton"]',
      progress: '[data-example="progress-indeterminate"] [data-slot="progress-indicator"]',
    }
    let names = async () => ({
      spinner: await computed(page, animated.spinner, 'animation-name'),
      skeleton: await computed(page, animated.skeleton, 'animation-name'),
      progress: await computed(page, animated.progress, 'animation-name'),
    })

    assert.deepEqual(await names(), {
      spinner: 'remixcn-spinner-spin',
      skeleton: 'remixcn-skeleton-pulse',
      progress: 'remixcn-progress-indeterminate',
    })
    assert.equal(
      await computed(page, '[data-example="progress-label"] [data-slot="progress-indicator"]', 'transition-duration'),
      '0.1s',
    )

    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.deepEqual(await names(), { spinner: 'none', skeleton: 'none', progress: 'none' })
    assert.equal(
      await computed(page, '[data-example="progress-label"] [data-slot="progress-indicator"]', 'transition-duration'),
      '0s',
    )
  })

  it('mirror chevrons, corners and fills in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = (id: string) => `[data-example="${id}"]`

    assert.equal(
      await computed(page, `${rtl('rtl-breadcrumb')} [data-slot="breadcrumb-separator"] > span`, 'transform'),
      'matrix(-1, 0, 0, 1, 0, 0)',
    )
    let alert = (await page
      .locator(`${rtl('rtl-alert')} [data-slot="alert"]`)
      .first()
      .boundingBox())!
    let action = (await page
      .locator(`${rtl('rtl-alert')} [data-slot="alert-action"]`)
      .first()
      .boundingBox())!
    assert.ok(
      action.x - alert.x < alert.x + alert.width - (action.x + action.width),
      'the action sits at the inline end, on the left',
    )

    let avatar = (await page
      .locator(`${rtl('rtl-avatar')} [data-slot="avatar"]`)
      .nth(1)
      .boundingBox())!
    let badge = (await page
      .locator(`${rtl('rtl-avatar')} [data-slot="avatar-badge"]`)
      .nth(1)
      .boundingBox())!
    assert.ok(badge.x < avatar.x + avatar.width / 2, 'the badge sits in the bottom left corner')

    let track = (await page
      .locator(`${rtl('rtl-progress')} [data-slot="progress-track"]`)
      .first()
      .boundingBox())!
    let fill = (await page
      .locator(`${rtl('rtl-progress')} [data-slot="progress-indicator"]`)
      .first()
      .boundingBox())!
    assert.equal(Math.round(track.x + track.width), Math.round(fill.x + fill.width))
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
            // A table may scroll inside its own region; WCAG's reflow rule allows that.
            .filter((element) => !element.closest('[role="region"][tabindex]'))
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map(
              (element) =>
                `${element.localName}.${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 40)}`,
            )
            .at(-1),
        }))
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    }
  })
})
