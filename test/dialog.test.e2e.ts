import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createDialogExamples } from './fixtures/dialog/server.tsx'

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(
  t: TestContext,
  { reducedMotion = 'reduce' as 'reduce' | 'no-preference', path = '/', hydrate = true } = {},
) {
  let examples = await createDialogExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto(path)
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

type Section = 'dialog' | 'alert-dialog' | 'sheet'

/** The example titled `title` in a section of the page. Dialog and Sheet both have a "With form" and a "No close button". */
function example(page: Page, section: Section, title: string) {
  return page.locator(`section[aria-labelledby="${section}"] [data-example="${title}"]`)
}

const openDialog = (page: Page) => page.locator('dialog[open]').last()

/** Whether the engine runs invoker commands (commandfor and command), which open and close dialogs without a script. */
function hasInvokerCommands(page: Page) {
  return page.evaluate(() => 'command' in HTMLButtonElement.prototype)
}

/**
 * Opens a dialog from the trigger named `name` in an example, waits until
 * focus moved inside, and checks it opened the section's own kind of dialog,
 * or `slot` when the example opens another kind first.
 */
async function openFrom(
  page: Page,
  section: Section,
  title: string,
  name: string,
  { keyboard = false, slot = `${section}-content` } = {},
) {
  let trigger = example(page, section, title).getByRole('button', { name, exact: true })
  if (keyboard) {
    await trigger.focus()
    await page.keyboard.press('Enter')
  } else {
    await trigger.click()
  }
  await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
  assert.equal(await openDialog(page).getAttribute('data-slot'), slot, `${section} › ${title} › ${name}`)
  return trigger
}

/** Where focus is: the accessible text of the focused element and whether it sits in the open dialog. */
function focus(page: Page) {
  return page.evaluate(() => {
    let active = document.activeElement
    let dialog = [...document.querySelectorAll('dialog[open]')].at(-1)
    return {
      name: active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? '',
      tag: active?.localName ?? '',
      inside: Boolean(dialog && active && dialog.contains(active)),
    }
  })
}

describe('Dialog examples', () => {
  it('keep Tab and Shift+Tab inside a modal dialog, then return focus to the trigger on Escape', async (t) => {
    let { page } = await open(t)
    let trigger = await openFrom(page, 'dialog', 'With form', 'Edit customer', { keyboard: true })
    assert.deepEqual(await focus(page), { name: '', tag: 'input', inside: true })

    let forward: string[] = []
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press('Tab')
      let { name, tag, inside } = await focus(page)
      assert.ok(inside, `Tab ${step + 1} left the dialog for ${tag} ${name}`)
      forward.push(name || tag)
    }
    // Email, Cancel, Save changes and the corner Close, then around to the Name field, never to the browser's toolbar.
    assert.deepEqual(forward.slice(0, 6), ['input', 'Cancel', 'Save changes', 'Close', 'input', 'input'])

    let backward: string[] = []
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Shift+Tab')
      let { name, tag, inside } = await focus(page)
      assert.ok(inside, `Shift+Tab ${step + 1} left the dialog for ${tag} ${name}`)
      backward.push(name || tag)
    }
    // Ten Tabs end on the Name field. From there, around to Close and back through the dialog to Close again.
    assert.deepEqual(backward, ['Close', 'Save changes', 'Cancel', 'input', 'input', 'Close'])

    await page.keyboard.press('Escape')
    await openDialog(page)
      .waitFor({ state: 'detached' })
      .catch(() => {})
    assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  })

  it('keep Tab and Shift+Tab inside when a native radio group comes first', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'dialog', 'With choices', 'Reminder schedule', { keyboard: true })
    let radio = () => page.evaluate(() => (document.activeElement as HTMLInputElement).value)
    assert.equal(await radio(), 'biweekly', 'focus starts on the checked radio, the one stop of its group')

    await page.keyboard.press('Shift+Tab')
    assert.deepEqual(await focus(page), { name: 'Close', tag: 'button', inside: true })
    await page.keyboard.press('Tab')
    assert.equal(await radio(), 'biweekly')

    // The arrow keys move the check, and the group's stop with it.
    await page.keyboard.press('ArrowDown')
    assert.equal(await radio(), 'monthly')
    await page.keyboard.press('Shift+Tab')
    assert.deepEqual(await focus(page), { name: 'Close', tag: 'button', inside: true })
    await page.keyboard.press('Tab')
    assert.equal(await radio(), 'monthly')
  })

  it('make the page behind inert and stop it from scrolling while modal', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 800, height: 500 })
    await openFrom(page, 'dialog', 'With form', 'Edit customer')

    await page.mouse.move(5, 5)
    await page.mouse.wheel(0, 400)
    await page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await page.evaluate(() => scrollY), 0, 'the wheel scrolls nothing behind the dialog')
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden')

    // A real click on the page behind lands on the backdrop and closes the dialog.
    await page.mouse.click(5, 5)
    assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible')
  })

  it('submit the fields of a dialog with the form around it', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'dialog', 'With form', 'Edit customer')
    await openDialog(page).getByLabel('Name').fill('Acme Labs AG')
    await openDialog(page).getByRole('button', { name: 'Save changes' }).click()

    await page.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await page.locator('[data-echo="fields"] dd').allInnerTexts(), [
      'Acme Labs AG',
      'billing@acme.example',
    ])
  })

  it('open and close natively without JavaScript, with Escape and the close buttons, and still submit', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    let trigger = example(static_, 'dialog', 'With form').getByRole('button', { name: 'Edit customer' })
    await trigger.click()
    if (!(await hasInvokerCommands(page))) {
      // Without invoker commands, the trigger waits for the script, and nothing hidden becomes reachable.
      assert.equal(await static_.locator('dialog[open]').count(), 0)
      return
    }
    assert.equal(await openDialog(static_).evaluate((dialog) => dialog.matches(':modal')), true)
    await static_.keyboard.press('Escape')
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    await trigger.click()
    await openDialog(static_).getByRole('button', { name: 'Close' }).click()
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    await trigger.click()
    await openDialog(static_).getByRole('button', { name: 'Save changes' }).click()
    await static_.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await static_.locator('[data-echo="fields"] dt').allInnerTexts(), ['name', 'email'])
  })

  it('run natively when the page renders them outside a client entry', async (t) => {
    let { page } = await open(t)
    let serverOnly = example(page, 'dialog', 'Server only')

    await serverOnly.getByRole('button', { name: 'Open native dialog' }).click()
    if (!(await hasInvokerCommands(page))) return assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.equal(await openDialog(page).evaluate((dialog) => dialog.matches(':modal')), true)
    await openDialog(page).getByRole('button', { name: 'Close', exact: true }).first().click()
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('read a dialog that starts open before any script runs, and make it modal once hydrated', async (t) => {
    let { page, server } = await open(t, { path: '/starts-open' })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/starts-open')
    assert.equal(await static_.getByRole('heading', { name: 'New payment terms' }).isVisible(), true)
    assert.equal(await openDialog(static_).evaluate((dialog) => dialog.matches(':modal')), false)

    assert.equal(await openDialog(page).evaluate((dialog) => dialog.matches(':modal')), true)
    await page.waitForFunction(() => document.activeElement?.textContent === 'Got it')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog[open]').count(), 0)
    await page.waitForFunction(() => document.activeElement?.textContent === 'Show notice')
  })

  it('work beside the page when not modal, and close when focus leaves them', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'dialog', 'Not modal', 'Keyboard shortcuts', { keyboard: true })
    assert.equal(await openDialog(page).evaluate((dialog) => dialog.matches(':modal')), false)
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible')

    // From the last element inside, Tab moves on into the page.
    await openDialog(page).getByRole('button', { name: 'Close' }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('report why a controlled dialog changed, from either trigger', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'dialog', 'Controlled')

    await openFrom(page, 'dialog', 'Controlled', 'Open from the toolbar')
    await page.keyboard.press('Escape')
    await controlled.getByText('Last change: escape-key').waitFor()
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open from the toolbar')

    await openFrom(page, 'dialog', 'Controlled', 'Open from the list')
    await controlled.getByText('Last change: trigger-press').waitFor()
    await page.mouse.click(5, 5)
    await controlled.getByText('Last change: outside-press').waitFor()
  })

  it('reach long content in their own scroll region with the keyboard', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'dialog', 'Scrollable content', 'Payment terms', { keyboard: true })
    let region = openDialog(page).getByRole('region', { name: 'Terms' })

    assert.equal(await region.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press('End')
    await page.waitForFunction(() => {
      let element = document.querySelector('dialog[open] [role="region"]')!
      return element.scrollTop > 0
    })
  })
})

describe('Alert Dialog examples', () => {
  it('start on the cancel button, and never confirm from a held Enter or from closing', async (t) => {
    let { page } = await open(t)
    let destructive = example(page, 'alert-dialog', 'Destructive')
    let trigger = destructive.getByRole('button', { name: 'Delete invoice' })

    // Enter held down on the trigger opens the alert dialog and keeps repeating.
    await trigger.focus()
    await page.keyboard.down('Enter')
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
    assert.deepEqual(await focus(page), { name: 'Cancel', tag: 'button', inside: true })
    await page.keyboard.down('Enter')
    await page.keyboard.down('Enter')
    await page.keyboard.up('Enter')
    assert.notEqual(await destructive.getByRole('status').innerText(), 'INV-0042 deleted.')

    // Outside presses don't close it; Escape cancels.
    if (await page.locator('dialog[open]').count()) {
      await page.mouse.click(5, 5)
      assert.equal(await page.locator('dialog[open]').count(), 1)
      await page.keyboard.press('Escape')
    }
    await destructive.getByRole('status').getByText('INV-0042 kept.').waitFor()

    await trigger.click()
    await openDialog(page).getByRole('button', { name: 'Delete' }).click()
    await destructive.getByRole('status').getByText('INV-0042 deleted.').waitFor()
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('confirm a form only from the action, never from Enter in its field', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'alert-dialog', 'With form', 'Write off invoice')
    let field = openDialog(page).getByLabel('Reason')

    await field.fill('Paid by credit note')
    await field.press('Enter')
    assert.equal(await page.locator('dialog[open]').count(), 1)
    assert.equal(await field.evaluate((element) => element === document.activeElement), true)
    assert.equal(new URL(page.url()).pathname, '/')

    await openDialog(page).getByRole('button', { name: 'Write off' }).press('Enter')
    await page.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await page.locator('[data-echo="fields"] dd').allInnerTexts(), [
      'Paid by credit note',
      'write-off',
    ])
  })

  it('confirm a form only from the action without JavaScript too, never from Enter in its field', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    if (!(await hasInvokerCommands(page))) return
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    await example(static_, 'alert-dialog', 'With form').getByRole('button', { name: 'Write off invoice' }).click()
    let field = openDialog(static_).getByLabel('Reason')
    await field.fill('Paid by credit note')
    await field.press('Enter')
    assert.equal(new URL(static_.url()).pathname, '/', 'Enter in the field submitted nothing')
    assert.equal(await static_.locator('dialog[open]').count(), 1)

    await openDialog(static_).getByRole('button', { name: 'Write off' }).click()
    await static_.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await static_.locator('[data-echo="fields"] dd').allInnerTexts(), [
      'Paid by credit note',
      'write-off',
    ])
  })

  it('close only the alert dialog on Escape when it opened from a dialog', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'alert-dialog', 'In a dialog', 'Open dialog', { keyboard: true, slot: 'dialog-content' })
    await openDialog(page).getByRole('button', { name: 'Void invoice' }).press('Enter')
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cancel')
    assert.equal(await page.locator('dialog[open]').count(), 2)

    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog[open]').count(), 1)
    await page.waitForFunction(() => document.activeElement?.textContent === 'Void invoice')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('put the media beside the text in a wide default alert dialog, and above it in a small one', async (t) => {
    let { page } = await open(t)

    for (let [title, name, beside] of [
      ['With media', 'With media', true],
      ['Small with media', 'Small with media', false],
    ] as const) {
      await openFrom(page, 'alert-dialog', title, name)
      let { media, heading } = await openDialog(page).evaluate((dialog) => ({
        media: dialog.querySelector('[data-slot="alert-dialog-media"]')!.getBoundingClientRect().toJSON(),
        heading: dialog.querySelector('h2')!.getBoundingClientRect().toJSON(),
      }))
      assert.equal(heading.left >= media.right, beside, `${title}: ${JSON.stringify({ media, heading })}`)
      await page.keyboard.press('Escape')
    }
  })
})

describe('Sheet examples', () => {
  for (let width of [1280, 320]) {
    it(`open on each edge at ${width}px, inside the screen, with the title and the close button in view`, async (t) => {
      let { page } = await open(t)
      await page.setViewportSize({ width, height: 640 })

      for (let side of ['Top', 'Right', 'Bottom', 'Left']) {
        await openFrom(page, 'sheet', 'Sides', side)
        let layout = await openDialog(page).evaluate((dialog) => {
          let inView = (element: Element) => {
            let rect = element.getBoundingClientRect()
            return rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth
          }
          let close = [...dialog.querySelectorAll('button')].find(
            (button) => button.textContent === 'Close' && button.querySelector('svg'),
          )!
          return {
            side: dialog.dataset.side,
            sheet: inView(dialog),
            title: inView(dialog.querySelector('h2')!),
            close: inView(close),
            name: document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent,
          }
        })
        assert.deepEqual(layout, {
          side: side.toLowerCase(),
          sheet: true,
          title: true,
          close: true,
          name: 'Invoice history',
        })
        await page.keyboard.press('Escape')
      }
    })
  }

  it('keep the close button in the corner while long content scrolls on a narrow screen', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await openFrom(page, 'sheet', 'Long content', 'Long content')

    await openDialog(page).evaluate((dialog) => (dialog.scrollTop = dialog.scrollHeight))
    let close = openDialog(page).getByRole('button', { name: 'Close' })
    let box = (await close.boundingBox())!
    assert.ok(box.y >= 0 && box.y + box.height <= 640, JSON.stringify(box))
    await close.click()
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })
})

describe('Dialog, Alert Dialog and Sheet styles', () => {
  it('pass axe-core while open, in both themes', async (t) => {
    let { page } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (let [section, title, name] of [
        ['dialog', 'With form', 'Edit customer'],
        ['alert-dialog', 'Destructive', 'Delete invoice'],
        ['alert-dialog', 'With media', 'With media'],
        ['sheet', 'Sides', 'Right'],
      ] as const) {
        await openFrom(page, section, title, name)
        assert.deepEqual(await findAccessibilityViolations(page), [], `${colorScheme}: ${title}`)
        await page.keyboard.press('Escape')
      }
    }
  })

  it('show the focus ring and the dialog edge, also in forced colors', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'dialog', 'With form', 'Edit customer', { keyboard: true })
    let close = openDialog(page).getByRole('button', { name: 'Close' })
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      assert.deepEqual(
        await close.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth]),
        ['solid', '2px'],
      )
      assert.equal(await openDialog(page).evaluate((e) => getComputedStyle(e).borderTopStyle), 'solid')
    }
  })

  it('fade and zoom with the motion tokens, and not at all for reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    await openFrom(page, 'dialog', 'With form', 'Edit customer')
    let durations = () => openDialog(page).evaluate((e) => getComputedStyle(e).transitionDuration)

    assert.ok(
      (await durations()).split(', ').every((duration) => duration === '0.1s'),
      await durations(),
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.ok(
      (await durations()).split(', ').every((duration) => duration === '0s'),
      await durations(),
    )
  })

  it('mirror the close button and the text in right-to-left text', async (t) => {
    let { page } = await open(t)
    await page.locator('#direction ~ div [data-example]').first().getByRole('button', { name: 'Edit customer' }).click()
    let { dialog, close } = await openDialog(page).evaluate((element) => ({
      dialog: element.getBoundingClientRect().toJSON(),
      close: element.querySelector(':scope > [data-slot="dialog-close"]')!.getBoundingClientRect().toJSON(),
    }))
    assert.ok(close.left - dialog.left < dialog.right - close.right, 'the close button sits at the left edge')
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
      for (let [section, title, name] of [
        ['dialog', 'With form', 'Edit customer'],
        ['alert-dialog', 'Small with media', 'Small with media'],
        ['alert-dialog', 'Destructive', 'Delete invoice'],
        ['sheet', 'Sides', 'Left'],
      ] as const) {
        await openFrom(page, section, title, name)
        let overflow = await openDialog(page).evaluate((dialog) => ({
          page: document.documentElement.scrollWidth,
          dialog: dialog.scrollWidth - dialog.clientWidth,
          right: dialog.getBoundingClientRect().right,
        }))
        assert.deepEqual(overflow.page, 320, `${title} at ${fontSize || 'default'}: ${JSON.stringify(overflow)}`)
        assert.ok(
          overflow.dialog <= 0 && overflow.right <= 320,
          `${title} at ${fontSize || 'default'}: ${JSON.stringify(overflow)}`,
        )
        await page.keyboard.press('Escape')
      }
    }
  })
})
