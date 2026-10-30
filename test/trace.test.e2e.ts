import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createTraceExamples } from './fixtures/trace/server.tsx'
import { paintColors, toRgba } from './paint.ts'

// Pages open with reduced motion, so panels move in 0s and running titles
// don't shimmer. The motion tests opt back in.
async function open(t: TestContext, { reducedMotion = 'reduce' as 'reduce' | 'no-preference', hydrate = true } = {}) {
  let examples = await createTraceExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

async function withoutJavaScript(t: TestContext, page: Page, baseURL: string) {
  let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL })
  t.after(() => context.close())
  let staticPage = await context.newPage()
  await staticPage.goto('/')
  return staticPage
}

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function focusedText(page: Page) {
  return page.evaluate(() => document.activeElement?.textContent?.trim())
}

function style(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** The states the server renders, which hydration must keep. */
function states(page: Page) {
  return page
    .locator(
      '[data-slot="trace-line"], [data-slot="trace-collapsible-trigger"], [data-slot="trace-collapsible-content"]',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        [
          node.getAttribute('data-slot'),
          node.getAttribute('data-status'),
          node.getAttribute('aria-expanded'),
          node.getAttribute('hidden'),
          node.textContent?.trim().slice(0, 24),
        ].join(' '),
      ),
    )
}

describe('Trace examples', () => {
  it('open and close rows with Enter, Space and the pointer, and leave plain lines out of the tab order', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'Collapsible')
    let trigger = demo.getByRole('button', { name: 'Ran node --version' })

    await trigger.focus()
    await page.keyboard.press('Enter')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await demo.getByText('v24.18.0').waitFor()
    await page.keyboard.press(' ')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    await demo.getByText('v24.18.0').waitFor({ state: 'detached' })

    await trigger.click()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await trigger.click()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    // The group's lines are text, so Tab goes from the trigger before them to the link after them.
    let lines = example(page, 'Group')
    assert.equal(await lines.locator('a, button, [tabindex]').count(), 0)
    await example(page, 'Link').getByRole('link', { name: 'Read apps/v4/lib/docs.ts' }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await focusedText(page), 'Install the CLI | example.com (opens in a new tab)')
  })

  it('name each row by its title and status, and hide the icons', async (t) => {
    let { page } = await open(t)
    let status = example(page, 'Status')

    assert.deepEqual(
      await status
        .locator('[data-slot="trace-line"]')
        .evaluateAll((lines) => lines.map((line) => line.textContent?.replace(/\s+/g, ' ').trim())),
      [
        'Ran pnpm install',
        'Failed to run pnpm lint (failed)',
        'Running pnpm build (in progress)',
        'Run pnpm test (not started)',
      ],
    )
    assert.equal(
      await status
        .locator('[data-slot="trace-icon"]')
        .evaluateAll((icons) => icons.every((icon) => icon.getAttribute('aria-hidden') === 'true')),
      true,
    )
    let turn = example(page, 'Whole turn')
    await turn.getByRole('button', { name: 'Failed to run pnpm --version (failed)', exact: true }).waitFor()
    await turn.getByRole('button', { name: 'Thought 12s', exact: true }).waitFor()
  })

  it('let the owner and the row both change a controlled row', async (t) => {
    let { page } = await open(t)
    let openState = example(page, 'Open state')
    let row = openState.getByRole('button', { name: 'Ran pnpm --version' })

    assert.equal(
      await openState.getByRole('button', { name: 'Ran node --version' }).getAttribute('aria-expanded'),
      'true',
    )
    await openState.getByRole('button', { name: 'Show the pnpm output' }).click()
    assert.equal(await row.getAttribute('aria-expanded'), 'true')
    await openState.getByText('10.33.4').waitFor()

    await row.click()
    assert.equal(await row.getAttribute('aria-expanded'), 'false')
    await openState.getByRole('button', { name: 'Show the pnpm output' }).waitFor()
  })

  it('keep nested rows apart, keep their state in a kept panel, and leave no hidden content to focus', async (t) => {
    let { page } = await open(t)
    let turn = example(page, 'Whole turn')
    let outer = turn.getByRole('button', { name: /^Worked for 2m 4s/ })
    let failed = turn.getByRole('button', { name: /^Failed to run pnpm --version/ })

    await failed.click()
    assert.equal(await failed.getAttribute('aria-expanded'), 'true')
    assert.equal(await turn.getByRole('button', { name: /^Thought/ }).getAttribute('aria-expanded'), 'false')

    // Focus the output, then close the whole turn: focus moves to its trigger.
    await turn.locator('[data-slot="code-block-content"]').focus()
    await outer.click()
    assert.equal(await focusedText(page), 'Worked for 2m 4s, 1 command failed (failed)')
    await page.keyboard.press('Tab')
    assert.equal(
      await page.evaluate(() => document.activeElement?.closest('[data-example]')?.getAttribute('data-example')),
      'Long content',
    )

    // The kept panel opens with the nested row as it was.
    await outer.click()
    assert.equal(await failed.getAttribute('aria-expanded'), 'true')

    // The same example in the themes keeps its own state.
    let light = page.locator('[data-panel="light"]')
    assert.equal(
      await light.getByRole('button', { name: /^Failed to run pnpm --version/ }).getAttribute('aria-expanded'),
      'false',
    )
  })

  it('wrap long content and move focus from a closing row with a long detail', async (t) => {
    let { page } = await open(t)
    let long = example(page, 'Long content')
    let trigger = long.getByRole('button', { name: /^Failed to fetch/ })
    let link = long.getByRole('link', { name: 'Open the full log' })

    let [box, list] = await Promise.all([long.locator('[data-slot="trace"]').boundingBox(), long.boundingBox()])
    assert.ok(box && list && box.x + box.width <= list.x + list.width)
    assert.equal(
      await long.locator('[data-slot="trace"] *').evaluateAll((nodes) => {
        let edge = nodes[0].closest('[data-slot="trace"]')!.getBoundingClientRect().right
        return nodes.filter((node) => node.getBoundingClientRect().right > edge + 0.5).length
      }),
      0,
    )

    await link.focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focusedText(page), await trigger.textContent().then((text) => text?.trim()))
    await page.keyboard.press('Enter')
    await link.waitFor({ state: 'detached' })
    await page.keyboard.press('Tab')
    assert.notEqual(
      await page.evaluate(() => document.activeElement?.closest('[data-example]')?.getAttribute('data-example')),
      'Long content',
    )
  })

  it('open a dialog and a sheet from a row, and return focus to the row', async (t) => {
    let { page } = await open(t)
    let row = example(page, 'Dialog').getByRole('button', { name: 'Searched the web for cache keys' })

    assert.equal(await row.getAttribute('aria-haspopup'), 'dialog')
    await row.focus()
    await page.keyboard.press('Enter')
    let dialog = page.getByRole('dialog', { name: 'Searched the web for cache keys' })
    await dialog.waitFor()
    await dialog.getByRole('link', { name: 'Caching build outputs (opens in a new tab)' }).waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await focusedText(page), 'Searched the web for cache keys')

    let sheetRow = example(page, 'Commit').getByRole('button', { name: /^Edited app\/login\/page\.tsx/ })
    await sheetRow.click()
    let sheet = page.getByRole('dialog', { name: 'app/login/page.tsx' })
    await sheet.getByText('2 additions, 2 deletions').waitFor()
    await sheet.getByRole('button', { name: 'Close' }).click()
    await sheet.waitFor({ state: 'hidden' })
  })

  it('stream reasoning open while it runs, close it when done, and let the reader decide', async (t) => {
    let { page } = await open(t)
    let thinking = example(page, 'Reasoning')

    await thinking.getByRole('button', { name: 'Send message' }).click()
    let running = thinking.getByRole('button', { name: 'Thinking (in progress)' })
    await running.waitFor()
    assert.equal(await running.getAttribute('aria-expanded'), 'true')

    let done = thinking.getByRole('button', { name: 'Thought', exact: true })
    await done.waitFor({ timeout: 10_000 })
    assert.equal(await done.getAttribute('aria-expanded'), 'false')
    await thinking.getByText('Image optimization is the bottleneck.', { exact: false }).waitFor()

    // Once the reader opens it, it stays open.
    await done.click()
    assert.equal(await done.getAttribute('aria-expanded'), 'true')

    await thinking.getByRole('button', { name: 'Reset' }).click()
    await thinking.getByRole('button', { name: 'Send message' }).click()
    await thinking.getByRole('button', { name: 'Thinking (in progress)' }).waitFor()
    await thinking.getByRole('button', { name: 'Reset' }).click()
    await thinking.getByRole('button', { name: 'Thinking (in progress)' }).waitFor({ state: 'detached' })
  })

  it('announce each change of a tool call through one polite region, and nothing on load', async (t) => {
    let { page } = await open(t)
    let calls = example(page, 'Tool calls')

    await calls.getByRole('button', { name: 'Send message' }).click()
    let region = calls.locator('[data-slot="trace-announcer"]')
    assert.equal(await region.getAttribute('role'), 'status')
    assert.equal(await region.textContent(), '')

    // Record every text the region shows while the calls run.
    await region.evaluate((node) => {
      let seen: string[] = []
      ;(window as unknown as { seen: string[] }).seen = seen
      new MutationObserver(() => seen.push(node.textContent ?? '')).observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    })
    await calls.getByText('Node 24 and npm 11 are installed. pnpm is not.').waitFor({ timeout: 10_000 })
    let seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen)

    assert.ok(seen.includes('Ran node --version'), seen.join(' | '))
    assert.ok(seen.includes('Ran npm --version'), seen.join(' | '))
    assert.equal(seen.at(-1), 'Failed to run pnpm --version (failed)')
    assert.ok(!seen.some((text) => text.includes('Running')), 'a call that starts is not announced')
  })

  it('play the whole demo, and start it over after a reset', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'Demo')

    await demo.getByRole('button', { name: 'Send message' }).click()
    await demo.getByRole('button', { name: 'Reset' }).waitFor({ timeout: 15_000 })
    for (let name of [
      'Thought for 5s',
      'Ran pnpm --version',
      'Failed to run pnpm install --frozen-lockfile (failed)',
    ]) {
      await demo.getByRole('button', { name, exact: true }).waitFor()
    }
    await demo.getByRole('button', { name: 'Used 2 sources' }).click()
    await demo.getByRole('link', { name: 'pnpm install | example.com (opens in a new tab)' }).waitFor()

    await demo.getByRole('button', { name: 'Reset' }).click()
    assert.equal(await demo.locator('[data-slot="trace-line"]').count(), 0)
    // A new run starts from the beginning, not where the last one stopped.
    await demo.getByRole('button', { name: 'Send message' }).click()
    await demo.getByRole('button', { name: 'Thinking (in progress)' }).waitFor()
    assert.equal(await demo.getByRole('button', { name: /^Ran / }).count(), 0)
  })

  it('render the first state on the server, keep it through hydration, and do nothing without JavaScript', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let before = await states(page)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    assert.deepEqual(await states(page), before)

    let staticPage = await withoutJavaScript(t, page, server.baseUrl)
    let turn = staticPage.locator('[data-example="Whole turn"]')
    let trigger = turn.getByRole('button', { name: /^Worked for/ })
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(await trigger.getAttribute('type'), 'button')
    await trigger.click()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(staticPage.url(), `${server.baseUrl}/`)

    let serverOnly = page.locator('[data-example="Server only"]')
    let closed = serverOnly.getByRole('button', { name: /^Failed to run pnpm --version/ })
    await closed.click()
    assert.equal(await closed.getAttribute('aria-expanded'), 'false')
  })

  it("pass axe's WCAG 2.2 A and AA rules in both color schemes, with rows open", async (t) => {
    let { page } = await open(t)
    await example(page, 'Collapsible').getByRole('button', { name: 'Ran node --version' }).click()
    await example(page, 'Chain of thought')
      .getByRole('button', { name: /^Searched for the checkout/ })
      .click()
    await example(page, 'Whole turn')
      .getByRole('button', { name: /^Thought/ })
      .click()
    await example(page, 'Tool calls').getByRole('button', { name: 'Send message' }).click()
    await example(page, 'Tool calls').getByRole('button', { name: 'Reset' }).waitFor({ timeout: 10_000 })

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('keep line, description and detail text at 4.5:1 or more, in every status and both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = `[data-theme="${theme}"] :is([data-slot="trace-title"], [data-slot="trace-description"], [data-slot="trace-collapsible-content-inner"])`
      let results = await paintColors(page, selector)
      assert.ok(results.length > 10, `${theme}: ${results.length} parts`)
      for (let { label, background, text } of results) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('keep a running title at 4.5:1 or more through its whole shimmer, in both color schemes', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let failures: string[] = []

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation instanceof CSSTransition)
            .map((animation) => animation.finished.catch(() => {})),
        ),
      )
      // The sweep runs from the text's color to the highlight and back, so both must reach 4.5:1.
      let results = await page.evaluate(() => {
        let canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        let context = canvas.getContext('2d', { willReadFrequently: true })!
        let paint = (color: string) => {
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
        let over = (background: number[], color: string) => {
          context.clearRect(0, 0, 1, 1)
          paint(`rgb(${background[0]} ${background[1]} ${background[2]})`)
          paint(color)
          return read()
        }

        return [...document.querySelectorAll<HTMLElement>('[data-slot="trace-title"]')]
          .filter((element) => getComputedStyle(element).animationName.includes('remixcn-shimmer'))
          .map((element) => {
            let layers: string[] = []
            for (let node: Element | null = element; node; node = node.parentElement) {
              let background = getComputedStyle(node).backgroundColor
              layers.unshift(background)
              if (isOpaque(background)) break
            }
            context.clearRect(0, 0, 1, 1)
            for (let layer of layers) paint(layer)
            let background = read()
            let probe = document.createElement('span')
            probe.style.color = 'var(--remixcn-shimmer-highlight)'
            element.append(probe)
            let highlight = getComputedStyle(probe).color
            probe.remove()
            return {
              label: element.textContent?.trim() ?? '',
              background,
              text: over(background, getComputedStyle(element).color),
              highlight: over(background, highlight),
            }
          })
      })
      assert.ok(results.length >= 4, `${colorScheme}: ${results.length} running titles`)
      for (let { label, background, text, highlight } of results) {
        for (let [end, color] of [
          ['text', text],
          ['highlight', highlight],
        ] as const) {
          let ratio = contrastRatio(toRgba(color), toRgba(background))
          if (ratio < 4.5) failures.push(`${colorScheme} ${label} ${end}: ${ratio.toFixed(2)}`)
        }
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('shimmer a running title and turn chevrons only without reduced motion, and keep text plain in forced colors', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let running = '[data-example="Status"] [data-status="running"] [data-slot="trace-title"]'
    let chevron = '[data-example="Collapsible"] [data-slot="trace-collapsible-trigger"] > [data-slot="trace-icon"] svg'

    assert.match(await style(page, running, 'animation-name'), /remixcn-shimmer/)
    assert.equal(await style(page, running, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')
    assert.equal(await style(page, chevron, 'transition-duration'), '0.2s')

    await page.emulateMedia({ forcedColors: 'active' })
    assert.equal(await style(page, running, 'animation-name'), 'none')
    assert.notEqual(await style(page, running, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')

    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' })
    assert.equal(await style(page, running, 'animation-name'), 'none')
    assert.notEqual(await style(page, running, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')
    assert.equal(await style(page, chevron, 'transition-duration'), '0s')
  })

  it('show a focus ring on row triggers, link rows and dialog rows, also in forced colors', async (t) => {
    let { page } = await open(t)
    let parts = [
      '[data-example="Collapsible"] [data-slot="trace-collapsible-trigger"]',
      '[data-example="Link"] a',
      '[data-example="Dialog"] [data-slot="dialog-trigger"]',
    ]

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      for (let part of parts) {
        await page.locator(part).first().focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        assert.deepEqual(
          await page
            .locator(part)
            .first()
            .evaluate((e) => [
              e.matches(':focus-visible'),
              getComputedStyle(e).outlineStyle,
              getComputedStyle(e).outlineWidth,
            ]),
          [true, 'solid', '2px'],
          `${part}, forced colors ${forcedColors}`,
        )
      }
    }
  })

  it('brighten a link row on hover, and keep a failed row red', async (t) => {
    let { page } = await open(t)
    let link = example(page, 'Link').locator('[data-slot="trace-line"]').first()
    let failed = example(page, 'Whole turn').locator('[data-slot="trace-line"][data-status="error"]').first()
    let foreground = await page.evaluate(() => {
      let probe = document.createElement('span')
      probe.style.color = 'var(--foreground)'
      document.body.append(probe)
      let color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    let color = (locator: typeof link) => locator.evaluate((e) => getComputedStyle(e).color)

    let resting = await color(link)
    await link.hover()
    await page.waitForFunction(
      ([selector, value]) => getComputedStyle(document.querySelector(selector)!).color === value,
      ['[data-example="Link"] [data-slot="trace-line"]', foreground] as const,
    )
    assert.notEqual(resting, foreground)

    let red = await color(failed)
    await failed.hover()
    assert.equal(await color(failed), red)
  })

  it('mirror chevrons and arrows, and start lines on the right, in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = page.locator('[aria-labelledby="direction"]')

    let trigger = rtl.getByRole('button', { name: /^Used 3 sources/ })
    let [chevron, title] = await Promise.all([
      trigger.locator('> [data-slot="trace-icon"]').boundingBox(),
      trigger.locator('[data-slot="trace-title"]').boundingBox(),
    ])
    assert.ok(chevron && title && chevron.x < title.x, 'the chevron sits on the left')
    // Open, it points down: mirrored, then turned.
    let matrix = await trigger
      .locator('> [data-slot="trace-icon"] svg')
      .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform))
    assert.deepEqual(
      [Math.round(matrix.a), Math.round(matrix.b), Math.round(matrix.c), Math.round(matrix.d)],
      [0, 1, 1, 0],
    )

    let onward = rtl
      .getByRole('link', { name: 'Read apps/v4/lib/docs.ts' })
      .first()
      .locator('[data-slot="trace-icon"]')
      .last()
    assert.equal(await onward.evaluate((e) => getComputedStyle(e).transform), 'matrix(-1, 0, 0, 1, 0, 0)')

    let line = rtl.locator('[data-slot="trace-line"]').first()
    let [icon, text] = await Promise.all([
      line.locator('[data-slot="trace-icon"]').first().boundingBox(),
      line.locator('[data-slot="trace-title"]').boundingBox(),
    ])
    assert.ok(icon && text && icon.x > text.x, 'the leading icon sits on the right')
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await example(page, 'Chain of thought')
      .getByRole('button', { name: /^Searching for the cache key/ })
      .click()

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
