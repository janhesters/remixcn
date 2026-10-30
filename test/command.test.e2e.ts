import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createCommandExamples } from './fixtures/command/server.tsx'
import { paintColors, toRgba } from './paint.ts'

// Pages open with reduced motion, so transitions take 0s and every read sees the final style.
async function open(t: TestContext, { javaScriptEnabled = true } = {}) {
  let examples = await createCommandExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  if (!javaScriptEnabled) {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/')
  if (javaScriptEnabled) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

/** The first example titled `title`; the themes section repeats Inline and Groups further down. */
function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

/**
 * The text of the option the focused combobox highlights, checking that the
 * option shows. An option's label is its first span of text, or the first
 * line in it, else its text.
 */
function highlighted(page: Page) {
  return page.evaluate(() => {
    let input = document.activeElement
    let id = input?.getAttribute('aria-activedescendant')
    if (!id) return null
    let option = document.getElementById(id)
    if (!option || option.hidden || option.getClientRects().length === 0) throw new Error(`${id} doesn't show`)
    let span = option.querySelector(':scope > span:not([data-slot])')
    return (span?.querySelector('span') ?? span)?.textContent ?? option.textContent?.trim() ?? ''
  })
}

/** The labels of the options of a list that show, in the order they appear on screen. */
function shown(page: Page, scope: string) {
  return page.locator(`${scope} [role=option]`).evaluateAll((options) =>
    options
      .filter((option) => option.getClientRects().length > 0)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((option) => {
        let span = option.querySelector(':scope > span:not([data-slot])')
        return (span?.querySelector('span') ?? span)?.textContent ?? option.textContent?.trim()
      }),
  )
}

/** Opens the palette of a dialog example, and waits for the dialog's first frames, when it moves focus. */
async function openPalette(page: Page, title: string, { keyboard = false } = {}) {
  let trigger = page.locator(`section[aria-labelledby="dialog"] [data-example="${title}"]`).getByRole('button')
  if (keyboard) {
    await trigger.focus()
    await page.keyboard.press('Enter')
  } else {
    await trigger.click()
  }
  await page.waitForFunction(() => document.activeElement?.closest('dialog[open]')?.matches(':modal'))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return trigger
}

const openDialog = (page: Page) => page.locator('dialog[open]')

describe('Command examples', () => {
  it('search, sort and run commands with the keyboard, and leave left and right to the caret', async (t) => {
    let { page, errors } = await open(t)
    let inline = example(page, 'Inline')
    let input = inline.getByRole('combobox', { name: 'Search commands' })

    await input.click()
    assert.equal(await highlighted(page), 'Calendar')
    await page.keyboard.type('account')
    assert.deepEqual(await shown(page, '[data-example="Inline"]'), ['Profile'], 'a keyword finds Profile')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Control+a')
    await page.keyboard.type('ca')
    assert.deepEqual(await shown(page, '[data-example="Inline"]'), ['Calendar', 'Calculator'])

    await page.keyboard.press('End')
    assert.equal(await highlighted(page), 'Calculator')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.selectionStart), 1)
    await page.keyboard.press('Home')
    assert.equal(await highlighted(page), 'Calendar')
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.selectionStart), 1, 'Home moved no caret')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(await inline.locator('p[role=status]').textContent(), 'Selected: Calculator')
    assert.equal(await input.inputValue(), 'ca', 'Enter runs the command and keeps the search')
    assert.deepEqual(errors, [])
  })

  it('run a command with the pointer and keep focus in the input', async (t) => {
    let { page } = await open(t)
    let inline = example(page, 'Inline')
    let input = inline.getByRole('combobox')

    await input.click()
    let billing = inline.getByRole('option', { name: 'Billing' })
    await billing.hover()
    assert.equal(await highlighted(page), 'Billing')
    await billing.click()
    assert.equal(await inline.locator('p[role=status]').textContent(), 'Selected: Billing')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'combobox')
  })

  it('open a command dialog with its input named and focused, run a command, and return focus', async (t) => {
    let { page } = await open(t)
    let trigger = await openPalette(page, 'Groups', { keyboard: true })
    let dialog = openDialog(page)

    assert.equal(await dialog.getAttribute('aria-labelledby'), await dialog.locator('h2').getAttribute('id'))
    let input = page.getByRole('combobox', { name: 'Command Palette' })
    assert.equal(await input.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.type('bil')
    assert.deepEqual(await shown(page, 'dialog[open]'), ['Billing'])
    await page.keyboard.press('Enter')

    await dialog.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    let figure = page.locator('section[aria-labelledby="dialog"] [data-example="Groups"]')
    assert.equal(await figure.locator('p[role=status]').textContent(), 'Selected: Billing')
  })

  it('close the dialog on Escape, return focus, and start afresh when it opens again', async (t) => {
    let { page } = await open(t)
    let trigger = await openPalette(page, 'Groups')

    await page.keyboard.type('set')
    await page.keyboard.press('Escape')
    await openDialog(page).waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)

    await openPalette(page, 'Groups')
    assert.equal(await page.getByRole('combobox', { name: 'Command Palette' }).inputValue(), '')
    assert.equal(await highlighted(page), 'Calendar')
    assert.equal((await shown(page, 'dialog[open]')).length, 6)
  })

  it('sort matches best first, keep your order among equal ones, and say when nothing matches', async (t) => {
    let { page } = await open(t)
    await openPalette(page, 'Groups')

    // Search Emoji and Settings both start with "s"; Billing only has a keyword with an "s" in it.
    await page.keyboard.type('s')
    assert.deepEqual(await shown(page, 'dialog[open]'), ['Search Emoji', 'Settings', 'Billing'])
    await page.keyboard.type('zzz')
    assert.deepEqual(await shown(page, 'dialog[open]'), [])
    assert.equal(await openDialog(page).locator('[data-slot=command-empty]').textContent(), 'No results found.')
    assert.equal(await openDialog(page).getByRole('status').textContent(), 'No results found.')
    assert.equal(await highlighted(page), null)
    await page.keyboard.press('Enter')
    assert.equal(await openDialog(page).count(), 1, 'Enter with nothing highlighted runs nothing')
  })

  it('scroll the highlighted command into view in a long list', async (t) => {
    let { page } = await open(t)
    await openPalette(page, 'Many groups')
    let list = openDialog(page).getByRole('listbox')

    await page.keyboard.press('End')
    assert.equal(await highlighted(page), 'Code Editor')
    let inView = () =>
      list.evaluate((element) => {
        let box = element.getBoundingClientRect()
        let item = document.getElementById(document.activeElement!.getAttribute('aria-activedescendant')!)!
        let rect = item.getBoundingClientRect()
        return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1
      })
    assert.equal(await inView(), true)
    await page.keyboard.press('Alt+ArrowUp')
    assert.equal(await highlighted(page), 'Profile', 'Alt+ArrowUp goes to the first item of the group before')
    await page.keyboard.press('Home')
    assert.equal(await highlighted(page), 'Home')
    assert.equal(await inView(), true)
    assert.equal(await list.evaluate((element) => element.scrollTop), 0)
  })

  it('open and close from the shortcut the example wires, and keep Ctrl+J for moving down inside', async (t) => {
    let { page } = await open(t)
    await page.locator('body').click({ position: { x: 1, y: 1 } })

    await page.keyboard.press('Control+j')
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await highlighted(page), 'Calendar')
    await page.keyboard.press('Control+j')
    assert.equal(await highlighted(page), 'Search Emoji', 'inside, Ctrl+J moves down')
    assert.equal(await openDialog(page).count(), 1)
    await page.keyboard.press('Meta+j')
    await openDialog(page).waitFor({ state: 'detached' })
  })

  it('filter with your own matching when shouldFilter is false', async (t) => {
    let { page } = await open(t)
    let figure = example(page, 'Your filter')

    await figure.getByRole('combobox', { name: 'Search customers' }).click()
    await page.keyboard.type('glob')
    assert.deepEqual(await shown(page, '[data-example="Your filter"]'), ['Globex Corporation'])
    await page.keyboard.press('Enter')
    assert.equal(await figure.locator('p[role=status]').textContent(), 'Selected: Globex Corporation')
    await page.keyboard.type('zzz')
    assert.equal(await figure.locator('[data-slot=command-empty]').textContent(), 'No customer matches “globzzz”.')
  })

  it('check the chosen item, tell assistive technology, and skip the disabled one', async (t) => {
    let { page } = await open(t)
    let figure = example(page, 'Checked')

    await figure.getByRole('combobox').click()
    await page.keyboard.press('End')
    assert.equal(await highlighted(page), 'Overdue', 'Void is disabled')
    await page.keyboard.press('Enter')
    assert.equal(await figure.getByRole('option', { name: 'Overdue' }).getAttribute('aria-checked'), 'true')
    assert.equal(await figure.getByRole('option', { name: 'Sent' }).getAttribute('aria-checked'), 'false')
    assert.equal(
      await figure.locator('p[role=status]').textContent(),
      "INV-0042 is overdue. A void invoice can't change.",
    )
  })

  it('show the commands from the server HTML, with the search and openers off, without JavaScript', async (t) => {
    let { page } = await open(t, { javaScriptEnabled: false })

    let inputs = page.getByRole('combobox')
    assert.ok((await inputs.count()) >= 5)
    for (let input of await inputs.all()) {
      assert.equal(await input.isDisabled(), true)
      assert.equal(await input.getAttribute('aria-activedescendant'), null)
    }
    for (let button of await page.locator('section[aria-labelledby="dialog"]').getByRole('button').all()) {
      assert.equal(await button.isDisabled(), true)
    }
    assert.equal(await example(page, 'Inline').getByRole('option').count(), 6)
    assert.equal(await page.locator('[data-slot=command-empty]').count(), 0)
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('keep the server-only command off once the page runs, and its items inert', async (t) => {
    let { page } = await open(t)
    let figure = example(page, 'Server only')

    assert.equal(await figure.getByRole('combobox', { name: 'Search reports' }).isDisabled(), true)
    assert.equal(await figure.getByRole('option').count(), 2)
  })

  it('pass axe-core on the page, with a search in the dialog, and in the empty state', async (t) => {
    let { page } = await open(t)
    assert.deepEqual(await findAccessibilityViolations(page), [])

    await openPalette(page, 'Groups')
    await page.keyboard.type('bi')
    assert.deepEqual(await findAccessibilityViolations(page), [])
    await page.keyboard.type('zzz')
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })

  it('pass axe-core before hydration', async (t) => {
    let { page: served, server } = await open(t, { javaScriptEnabled: true })
    let context = await served.context().browser()!.newContext({ baseURL: server.baseUrl })
    t.after(() => context.close())
    let page = await context.newPage()
    // Keep the module scripts from loading, so the page stays as the server rendered it.
    await page.route('**/assets/**', (route) =>
      route.request().url().endsWith('.css') ? route.continue() : route.abort(),
    )
    await page.goto('/')

    assert.equal(await page.getByRole('combobox').first().isDisabled(), true)
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })

  it('keep 4.5:1 for the text of the highlighted item, the shortcuts and the placeholder in both themes', async (t) => {
    let { page } = await open(t)
    await example(page, 'Inline').getByRole('combobox').click()
    await page.keyboard.press('End')

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      let samples = [
        ...(await paintColors(page, '[data-example="Inline"] [role=option][data-selected]')),
        ...(await paintColors(page, '[data-example="Inline"] [data-slot=command-shortcut]')),
        ...(await paintColors(page, '[data-example="Inline"] [data-slot=command-group-heading]')),
      ]
      for (let { label, background, text } of samples) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        assert.ok(ratio >= 4.5, `${colorScheme} ${label}: ${ratio.toFixed(2)}`)
      }

      let placeholder = await example(page, 'Inline')
        .getByRole('combobox')
        .evaluate((input) => {
          let group = input.closest('[data-slot=command-input-group]')!
          return { color: getComputedStyle(input, '::placeholder').color, group: group.getAttribute('data-slot') }
        })
      let [painted] = await paintColors(page, '[data-example="Inline"] [data-slot=command-input-group]')
      let color = await page.evaluate((value) => {
        let canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        let context = canvas.getContext('2d')!
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data]
      }, placeholder.color)
      let ratio = contrastRatio(toRgba(color), toRgba(painted.background))
      assert.ok(ratio >= 4.5, `${colorScheme} placeholder: ${ratio.toFixed(2)}`)
    }
  })

  it('draw the focus ring around the input and on the highlighted item, also in forced colors', async (t) => {
    let { page } = await open(t)
    let inline = example(page, 'Inline')
    await inline.getByRole('combobox').focus()
    await page.keyboard.press('ArrowDown')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      let styles = await inline.evaluate((figure) => {
        let outline = (element: Element) => {
          let style = getComputedStyle(element)
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
        }
        return {
          group: outline(figure.querySelector('[data-slot=command-input-group]')!),
          item: outline(figure.querySelector('[role=option][data-selected]')!),
          other: outline(figure.querySelector('[role=option]:not([data-selected])')!),
        }
      })
      assert.equal(styles.group.style, 'solid', forcedColors)
      assert.ok(styles.group.width >= 2, forcedColors)
      assert.equal(styles.item.style, 'solid', forcedColors)
      assert.ok(styles.item.width >= 2, forcedColors)
      assert.equal(styles.other.style, 'none', forcedColors)
    }
  })

  it('put the search icon at the start and the shortcuts at the end in right-to-left text', async (t) => {
    let { page } = await open(t)
    let figure = example(page, 'أوامر')

    let icon = (await figure.locator('[data-slot=command-input-icon]').boundingBox())!
    let input = (await figure.getByRole('combobox').boundingBox())!
    assert.ok(icon.x > input.x, 'the icon sits on the right, where the line starts')

    let profile = figure.getByRole('option', { name: /الملف الشخصي/ })
    let shortcut = (await profile.locator('[data-slot=command-shortcut]').boundingBox())!
    let label = (await profile.locator('span').first().boundingBox())!
    assert.ok(shortcut.x < label.x, 'the shortcut sits on the left, at the end')
    assert.equal(await profile.locator('[data-slot=command-shortcut]').textContent(), '⌘P')
  })

  it('fit 320px without scrolling sideways, also with text at 200% and the dialog open', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)

    await openPalette(page, 'Groups')
    let fits = await openDialog(page).evaluate((dialog) => {
      let box = dialog.getBoundingClientRect()
      let list = dialog.querySelector('[role=listbox]')!
      return {
        inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        sideways: list.scrollWidth - list.clientWidth,
      }
    })
    assert.deepEqual(fits, { inside: true, sideways: 0 })
    await page.keyboard.press('End')
    assert.equal(await highlighted(page), 'Settings', 'the list scrolls inside the dialog to its last item')
  })
})
