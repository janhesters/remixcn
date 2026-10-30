import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createInputGroupExamples } from './fixtures/input-group/server.tsx'
import { tags } from './html.ts'
import { paintColors, toRgba } from './paint.ts'

interface OpenOptions {
  // off: the browser runs no script. never: scripting is on, but the page's scripts never load.
  javaScript?: 'on' | 'off' | 'never'
  // Holds the page's entry module, and with it hydration, until this settles.
  hold?: Promise<void>
  // Runs in the page before its own scripts.
  init?: () => void
}

// Pages open with reduced motion, so transitions take 0s and every read sees the final style.
async function open(t: TestContext, { javaScript = 'on', hold, init }: OpenOptions = {}) {
  let examples = await createInputGroupExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  if (javaScript === 'off') {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  if (javaScript === 'never') {
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )
  }
  if (hold) {
    await page.route('**/entry.ts*', async (route) => {
      await hold
      await route.continue()
    })
  }
  if (init) await page.addInitScript(init)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  // A held entry module also holds the load event, so such a page is read once it commits.
  await page.goto('/', { waitUntil: hold ? 'commit' : 'load' })
  if (javaScript === 'on' && !hold) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

/**
 * Makes every timer a compositionend listener starts wait a second, as on a
 * busy machine, so a read right after the composition comes first.
 */
function holdCommitTimers() {
  let ending = false
  window.addEventListener('compositionend', () => (ending = true), true)
  window.addEventListener('compositionend', () => (ending = false))
  let setTimeout_ = window.setTimeout.bind(window)
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
    setTimeout_(handler, ending ? 1000 : timeout, ...rest)) as typeof window.setTimeout
}

function example(page: Page, id: string) {
  return page.locator(`[data-example="${id}"]`)
}

function engine(page: Page) {
  return page.context().browser()?.browserType().name()
}

/** What each slot of a code shows. */
function slots(page: Page, input: string) {
  return page
    .locator(`[data-slot="input-otp"]:has(> input#${input}) [data-slot="input-otp-slot"]`)
    .evaluateAll((elements) =>
      elements
        .map((slot) => (slot.firstChild?.nodeType === Node.TEXT_NODE ? slot.firstChild.textContent : ''))
        .join('|'),
    )
}

/** Which slots of a code are active, and which draws the caret. */
function marks(page: Page, input: string) {
  return page
    .locator(`[data-slot="input-otp"]:has(> input#${input}) [data-slot="input-otp-slot"]`)
    .evaluateAll((elements) =>
      elements
        .map((slot) =>
          slot.querySelector('[data-slot="input-otp-caret"]')
            ? 'caret'
            : slot.getAttribute('data-active') === 'true'
              ? 'on'
              : '-',
        )
        .join(' '),
    )
}

function selection(page: Page, input: string) {
  return page
    .locator(`#${input}`)
    .evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** Lists duplicate ids and references to missing ids on the page. */
function checkReferences(page: Page) {
  return page.evaluate(() => {
    let problems: string[] = []
    let ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
    for (let id of ids.filter((id, index) => ids.indexOf(id) !== index)) problems.push(`duplicate id ${id}`)
    for (let element of document.querySelectorAll('[aria-describedby], [aria-labelledby], label[for], [form]')) {
      for (let attribute of ['aria-describedby', 'aria-labelledby', 'for', 'form']) {
        for (let id of (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) problems.push(`${attribute} names missing ${id}`)
        }
      }
    }
    return problems
  })
}

/** The names and values a form sent, as the echo page lists them. */
async function received(page: Page) {
  await page.locator('[data-echo="fields"]').waitFor()
  return page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.querySelector('dt')!.textContent}=${row.querySelector('dd')!.textContent}`),
    )
}

/**
 * Pastes text into the focused input through the browser's own clipboard,
 * with the keyboard: it copies the text from a scratch textarea first, which
 * works in every engine without clipboard permissions. Focus returns to the
 * input, which selects as it does on any focus.
 */
async function paste(page: Page, text: string) {
  let target = await page.evaluate(() => document.activeElement?.id)
  assert.ok(target, 'paste into a focused element with an id')
  await page.evaluate((value) => {
    let scratch = document.createElement('textarea')
    scratch.id = 'clipboard-scratch'
    scratch.value = value
    document.body.append(scratch)
  }, text)
  await page.locator('#clipboard-scratch').focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('ControlOrMeta+C')
  await page.evaluate(() => document.getElementById('clipboard-scratch')?.remove())
  await page.locator(`#${target}`).focus()
  await page.keyboard.press('ControlOrMeta+V')
}

// WCAG 1.4.3 exempts the text of an inactive component, such as the addons a
// disabled control dims with it, but axe can't tell they belong to it. The
// contrast test below measures them at full strength.
const disabledGroup =
  '[data-slot="input-group"]:is([data-disabled="true"], :has([data-slot="input-group-control"]:disabled))'
const dimmedAddons = {
  rule: 'color-contrast',
  selector: `${disabledGroup} [data-slot="input-group-addon"], ${disabledGroup} [data-slot="input-group-addon"] *`,
}

describe('Input Group and Input OTP examples', () => {
  it('render one native control per part with literal states, and hydrate without errors', async (t) => {
    let { page, server, errors } = await open(t)
    let html = await (await fetch(server.baseUrl)).text()
    let all = tags(html)

    assert.deepEqual(
      [
        ...new Set(
          all.filter((tag) => tag.attributes.has('aria-invalid')).map((tag) => tag.attributes.get('aria-invalid')),
        ),
      ].sort(),
      ['false', 'true'],
      'aria-invalid is always "true" or "false", never empty',
    )
    let codes = all.filter((tag) => tag.attributes.get('data-slot') === 'input-otp-input')
    assert.ok(codes.length >= 10)
    for (let code of codes) {
      assert.equal(code.name, 'input')
      assert.equal(code.attributes.get('autocomplete') ?? 'off', code.attributes.get('autocomplete'))
    }
    assert.equal(
      all.filter((tag) => tag.name === 'input' && tag.attributes.get('autocomplete') === 'one-time-code').length,
      codes.length - 1,
      'every code but the masked PIN is an autofill target for one-time codes',
    )
    assert.equal(
      await page
        .locator('[data-slot="input-otp"]')
        .evaluateAll((boxes) => boxes.filter((box) => box.querySelectorAll('input').length !== 1).length),
      0,
      'each code is one input',
    )
    assert.deepEqual(await checkReferences(page), [])
    assert.deepEqual(errors, [])
  })

  it("pass axe-core's WCAG 2.2 A and AA rules, in both color schemes", async (t) => {
    let { page } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      assert.deepEqual(await findAccessibilityViolations(page, { except: [dimmedAddons] }), [], colorScheme)
    }
  })

  it('pass them before the scripts run too', async (t) => {
    // axe runs as a script, so the server HTML is checked with the page's own modules held back.
    let { page } = await open(t)
    let held = await page
      .context()
      .browser()!
      .newContext({ baseURL: new URL(page.url()).origin })
    t.after(() => held.close())
    let before = await held.newPage()
    await before.route('**/assets/**', (route) =>
      route.request().resourceType() === 'stylesheet' ? route.continue() : route.abort(),
    )
    await before.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await before.goto('/')

    assert.deepEqual(await findAccessibilityViolations(before, { except: [dimmedAddons] }), [])
  })
})

describe('Input Group', () => {
  it('focuses the control on a press of an addon, and keeps a press of its button on the button', async (t) => {
    let { page } = await open(t)
    let addons = example(page, 'input-group-addons')

    await addons.getByText('incl. VAT').click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'input-group-demo-amount')

    let textarea = example(page, 'input-group-textareas')
    await textarea.getByText('Replies go to the customer').click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'input-group-demo-reply')

    let send = textarea.getByRole('button', { name: 'Send' })
    await send.click()
    assert.equal(
      await send.evaluate((button) => button === document.activeElement || !document.activeElement?.id),
      true,
    )
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'input-group-demo-reply')
  })

  it('moves focus in the order the parts are written, from the input to its buttons', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'input-group-search')

    await form.getByRole('searchbox', { name: 'Search invoices' }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Clear')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Search')
  })

  it('draws the ring and the border on the group while the control has keyboard focus, also in forced colors', async (t) => {
    let { page } = await open(t)
    let group = '[data-panel="light"] [data-slot="input-group"]:has(#light-website)'

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      await page.locator('#light-website').focus()
      assert.equal(await computed(page, group, 'outline-style'), 'solid', forcedColors)
      assert.notEqual(await computed(page, group, 'outline-color'), 'rgba(0, 0, 0, 0)', forcedColors)
      assert.equal(await computed(page, '#light-website', 'outline-style'), 'none', 'the ring moves to the group')
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      assert.equal(await computed(page, group, 'outline-style'), 'none')
      assert.equal(await computed(page, group, 'border-top-style'), 'solid')
    }
  })

  it('sends its search, keeps the button types, and resets with Clear', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'input-group-search')
    let search = form.getByRole('searchbox', { name: 'Search invoices' })

    await search.fill('INV-0042')
    await form.getByRole('button', { name: 'Clear' }).click()
    assert.equal(await search.inputValue(), '')
    assert.equal(new URL(page.url()).pathname, '/', 'Clear submits nothing')

    // Enter presses the form's default button, its first submit button, which sends its own name and value.
    await search.fill('0042')
    await search.press('Enter')
    assert.deepEqual(await received(page), ['q=0042', 'scope=invoices'])

    await page.goto('/')
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    let again = example(page, 'input-group-search')
    assert.equal(await again.getByRole('button', { name: 'Clear' }).getAttribute('type'), 'reset')
    await again.getByRole('searchbox', { name: 'Search invoices' }).fill('Acme')
    await again.getByRole('button', { name: 'Search', exact: true }).click()
    assert.deepEqual(await received(page), ['q=Acme', 'scope=invoices'])
  })

  it('sends the fields of a card form, with the textarea in a group', async (t) => {
    let { page } = await open(t)
    let card = example(page, 'input-group-card')

    await card.getByLabel('Email address').fill('ap@acme.example')
    await card.getByLabel('Website').fill('acme.example')
    await card.getByLabel('Notes for accounts payable').fill('PO-118')
    await card.getByRole('button', { name: 'Save contact' }).click()

    assert.deepEqual(await received(page), ['email=ap@acme.example', 'website=acme.example', 'notes=PO-118'])
  })

  it('keeps focus and its description links while the count and the error change', async (t) => {
    let { page } = await open(t)
    let counter = example(page, 'input-group-counter')
    let message = counter.getByLabel('Message to the customer')

    await message.fill('Thanks!')
    assert.equal(await counter.getByText('7/280 characters').count(), 1)
    assert.equal(await message.getAttribute('aria-invalid'), 'false')
    assert.equal(await message.getAttribute('aria-describedby'), 'input-group-demo-counter-count')

    await message.fill('x'.repeat(285))
    assert.equal(await message.getAttribute('aria-invalid'), 'true')
    assert.equal(
      await message.getAttribute('aria-describedby'),
      'input-group-demo-counter-count input-group-demo-counter-error',
    )
    assert.equal(await counter.getByText('Shorten the message by 5 characters.').count(), 1)

    await message.press('Backspace')
    await message.press('Backspace')
    await message.press('Backspace')
    await message.press('Backspace')
    await message.press('Backspace')
    assert.equal(await message.evaluate((element) => element === document.activeElement), true)
    assert.equal(await message.getAttribute('aria-invalid'), 'false')
    assert.deepEqual(await checkReferences(page), [])
  })

  it('copies a link and says whether it worked', async (t) => {
    let { page } = await open(t)
    let copy = example(page, 'input-group-copy')
    if (engine(page) === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await copy.getByRole('button', { name: 'Copy link' }).click()
    let status = copy.getByRole('status')
    await page.waitForFunction(
      () => !document.querySelector('#input-group-demo-link-status')?.textContent?.startsWith('Anyone'),
    )

    if (engine(page) === 'chromium') {
      assert.equal(await status.textContent(), 'Copied to the clipboard.')
      assert.equal(await copy.getByRole('button', { name: 'Copied' }).count(), 1)
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://pay.example/inv/0042')
    } else {
      assert.ok(
        [
          'Copied to the clipboard.',
          'The browser refused the clipboard. Select the link and copy it yourself.',
        ].includes((await status.textContent()) ?? ''),
      )
    }
  })

  it('works without JavaScript: the form sends its fields', async (t) => {
    let { page } = await open(t, { javaScript: 'off' })
    let form = example(page, 'input-group-search')

    await form.getByRole('searchbox', { name: 'Search invoices' }).fill('0042')
    await form.getByRole('button', { name: 'Search', exact: true }).click()

    assert.deepEqual(await received(page), ['q=0042', 'scope=invoices'])
  })
})

describe('Input OTP', () => {
  it('fills the slots as the user types, skips refused characters, and moves the active slot', async (t) => {
    let { page } = await open(t)
    let input = page.locator('#input-otp-demo-digits')

    await input.click()
    assert.equal(await marks(page, 'input-otp-demo-digits'), 'caret - - - - -')
    await page.keyboard.type('1a2-３')
    let typed = await input.inputValue()
    assert.equal(typed, '123', `refused characters stay out, and a full-width digit becomes a digit, not ${typed}`)
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.validity.patternMismatch), false)
    assert.equal(await slots(page, 'input-otp-demo-digits'), '1|2|3|○|○|○'.replace(/○/g, ''))
    assert.equal(await marks(page, 'input-otp-demo-digits'), '- - - caret - -')

    await page.keyboard.type('456')
    assert.equal(await input.inputValue(), '123456')
    assert.equal(await marks(page, 'input-otp-demo-digits'), '- - - - - on', 'a full code selects its last character')

    await page.keyboard.type('7')
    assert.equal(await input.inputValue(), '123457', 'typing replaces it, so the length caps the code')
  })

  it('filters a character an input method commits before the next read, also when timers run late', async (t) => {
    // In Firefox, Playwright types a character a US keyboard lacks, such as ３,
    // as an input method's commit. The code used to clean it up only in a timer,
    // which the read right after typing could beat on a busy machine (PR #72).
    let { page } = await open(t, { init: holdCommitTimers })
    let input = page.locator('#input-otp-demo-digits')

    await input.click()
    await page.keyboard.type('1a2-３')
    let typed = await input.inputValue()
    assert.equal(typed, '123', `the commit is clean once typing returns, not ${typed}`)
  })

  it('steps through the slots with the arrow keys, replaces the selected character and deletes with Backspace', async (t) => {
    let { page } = await open(t)
    let input = page.locator('#input-otp-demo-pairs')

    await input.focus()
    assert.deepEqual(await selection(page, 'input-otp-demo-pairs'), [5, 6])

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    assert.deepEqual(await selection(page, 'input-otp-demo-pairs'), [3, 4])
    assert.equal(await marks(page, 'input-otp-demo-pairs'), '- - - on - -')

    await page.keyboard.type('9')
    assert.equal(await input.inputValue(), '123956')
    assert.deepEqual(await selection(page, 'input-otp-demo-pairs'), [4, 5])

    await page.keyboard.press('Backspace')
    assert.equal(await input.inputValue(), '12396')
    assert.equal(await slots(page, 'input-otp-demo-pairs'), '1|2|3|9|6|')

    await page.keyboard.press('End')
    assert.equal(await marks(page, 'input-otp-demo-pairs'), '- - - - - caret')
    await page.keyboard.press('Backspace')
    assert.equal(await input.inputValue(), '1239')

    await page.keyboard.press('ControlOrMeta+A')
    assert.equal(await marks(page, 'input-otp-demo-pairs'), 'on on on on - -')
    await page.keyboard.type('0')
    assert.equal(await input.inputValue(), '0')
  })

  it('selects the character of a pressed slot', async (t) => {
    let { page } = await open(t)
    let slot = page.locator('[data-slot="input-otp"]:has(> #input-otp-demo-pairs) [data-slot="input-otp-slot"]')

    // The clear input lies over the slots and takes the press, as it does for a user.
    await slot.nth(2).scrollIntoViewIfNeeded()
    let box = (await slot.nth(2).boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    assert.deepEqual(await selection(page, 'input-otp-demo-pairs'), [2, 3])
    await page.keyboard.type('0')
    assert.equal(await page.locator('#input-otp-demo-pairs').inputValue(), '120456')
  })

  it('pastes a code without the characters its pattern refuses, capped at the length', async (t) => {
    let { page } = await open(t)
    let input = page.locator('#input-otp-demo-digits')

    await input.focus()
    await paste(page, ' 123-456-789 ')
    assert.equal(await input.inputValue(), '123456')
    assert.equal(await slots(page, 'input-otp-demo-digits'), '1|2|3|4|5|6')

    let key = page.locator('#input-otp-demo-alphanumeric')
    await key.focus()
    await paste(page, 'ab-12-CD')
    assert.equal(await key.inputValue(), 'ab12CD')

    await key.focus()
    await page.keyboard.press('ControlOrMeta+Z')
    assert.equal(await key.inputValue(), '', 'the paste is one step to undo')
  })

  it('keeps a short paste from passing the minimum length, filtered or not', async (t) => {
    let { page } = await open(t)
    let code = page.locator('#input-otp-demo-form-code')
    let verify = example(page, 'input-otp-form').getByRole('button', { name: 'Verify' })
    let blocked = () =>
      code.evaluate((input: HTMLInputElement) => ({ value: input.value, valid: input.form!.checkValidity() }))

    await code.focus()
    await paste(page, '12')
    assert.deepEqual(await blocked(), { value: '12', valid: false })
    await verify.click()
    assert.equal(new URL(page.url()).pathname, '/', 'Verify sends nothing')

    await code.evaluate((input: HTMLInputElement) => input.form!.reset())
    await code.focus()
    await paste(page, '1-2')
    assert.deepEqual(await blocked(), { value: '12', valid: false })
    await verify.click()
    assert.equal(new URL(page.url()).pathname, '/')
  })

  it('fires the native change once the user leaves after a paste, and none after an unchanged paste or a reset', async (t) => {
    let { page } = await open(t)
    await page.evaluate(() => {
      let changes: string[] = []
      Object.assign(window, { changes })
      for (let id of ['input-otp-demo-digits', 'input-otp-demo-form-code']) {
        document.getElementById(id)!.addEventListener('change', (event) => {
          changes.push(`${id}=${(event.target as HTMLInputElement).value}`)
        })
      }
    })
    let changes = () => page.evaluate(() => (window as unknown as { changes: string[] }).changes)
    let leave = () => page.locator('#input-group-demo-search').focus()

    await page.locator('#input-otp-demo-digits').focus()
    await paste(page, '12-34-56')
    await leave()
    assert.deepEqual(await changes(), ['input-otp-demo-digits=123456'])

    await page.locator('#input-otp-demo-digits').focus()
    await paste(page, '12 34 56')
    await leave()
    assert.deepEqual(await changes(), ['input-otp-demo-digits=123456'], 'the same code changes nothing')

    await page.locator('#input-otp-demo-form-code').focus()
    await paste(page, '1-2')
    await leave()
    await page.locator('#input-otp-demo-form-code').evaluate((input: HTMLInputElement) => input.form!.reset())
    await page.locator('#input-otp-demo-form-code').focus()
    await leave()
    assert.equal(await page.locator('#input-otp-demo-form-code').inputValue(), '')
    assert.deepEqual(
      await changes(),
      ['input-otp-demo-digits=123456', 'input-otp-demo-form-code=12'],
      'a reset fires no change',
    )
  })

  it('sends the code with its leading zeroes once it is complete', async (t) => {
    let { page } = await open(t)
    let code = page.locator('#input-otp-demo-form-code')

    await code.click()
    await page.keyboard.type('007123')

    assert.deepEqual(await received(page), ['code=007123'])
  })

  it('lets the browser refuse an incomplete code', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'input-otp-form')

    await page.locator('#input-otp-demo-form-code').click()
    await page.keyboard.type('12')
    await form.getByRole('button', { name: 'Verify' }).click()

    assert.equal(new URL(page.url()).pathname, '/')
    assert.equal(
      await page.locator('#input-otp-demo-form-code').evaluate((input: HTMLInputElement) => input.validity.tooShort),
      true,
    )
  })

  it('follows a controlled value and clears it from outside', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'input-otp-controlled')

    await page.locator('#input-otp-demo-controlled').click()
    await page.keyboard.type('042')
    assert.equal(await controlled.getByText('You entered: 042').count(), 1)

    await controlled.getByRole('button', { name: 'Clear' }).click()
    assert.equal(await page.locator('#input-otp-demo-controlled').inputValue(), '')
    assert.equal(await slots(page, 'input-otp-demo-controlled'), '|||||')
    assert.equal(await controlled.getByText('Enter your one-time password.').count(), 1)
  })

  it('keeps codes apart, masks a PIN, and leaves a disabled code alone', async (t) => {
    let { page } = await open(t)

    await page.locator('#input-otp-demo-masked').click()
    await page.keyboard.type('4821')
    assert.equal(await slots(page, 'input-otp-demo-masked'), '•|•|•|•')
    assert.equal(await page.locator('#input-otp-demo-masked').getAttribute('type'), 'password')
    assert.equal(await slots(page, 'input-otp-demo-pin'), '|||')

    let disabled = page.locator('#input-otp-demo-disabled')
    assert.equal(await disabled.isDisabled(), true)
    assert.equal(await computed(page, '[data-slot="input-otp"]:has(> #input-otp-demo-disabled)', 'opacity'), '0.5')
  })

  it('keeps a code typed before the page hydrates', async (t) => {
    let release: () => void = () => {}
    let { page, errors } = await open(t, { hold: new Promise<void>((resolve) => (release = resolve)) })

    await page.locator('#input-otp-demo-digits').click()
    await page.keyboard.type('1234')
    assert.equal(await page.locator('html[data-ready]').count(), 0, 'the page has not hydrated yet')
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await page.waitForFunction(() => !document.querySelector('#input-otp-demo-digits')?.hasAttribute('data-pending'))

    assert.equal(await page.locator('#input-otp-demo-digits').inputValue(), '1234')
    assert.equal(await slots(page, 'input-otp-demo-digits'), '1|2|3|4||')
    assert.deepEqual(errors, [])
  })

  it('works without JavaScript as a plain text box that validates and submits', async (t) => {
    let { page } = await open(t, { javaScript: 'off' })
    let code = page.locator('#input-otp-demo-form-code')

    assert.notEqual(await computed(page, '#input-otp-demo-form-code', 'color'), 'rgba(0, 0, 0, 0)')
    await code.fill('12345a')
    await example(page, 'input-otp-form').getByRole('button', { name: 'Verify' }).click()
    assert.equal(new URL(page.url()).pathname, '/', 'the native pattern refuses the letter')

    await code.fill('007123')
    await example(page, 'input-otp-form').getByRole('button', { name: 'Verify' }).click()
    assert.deepEqual(await received(page), ['code=007123'])
  })

  it("shows a plain text box two seconds after the page's scripts failed to load", async (t) => {
    let { page } = await open(t, { javaScript: 'never' })
    let color = () => computed(page, '#server-code', 'color')

    assert.equal(await color(), 'rgba(0, 0, 0, 0)', 'the slots show at first')
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('#server-code')!).color !== 'rgba(0, 0, 0, 0)',
      undefined,
      { timeout: 5000 },
    )
    await page.locator('#server-code').fill('482915')
    assert.equal(await page.locator('#server-code').inputValue(), '482915')
  })

  it('draws the ring on the active slot, and the caret only with motion', async (t) => {
    let { page } = await open(t)
    let slot = (index: number) =>
      `[data-panel="light"] [data-slot="input-otp"]:has(> #light-code) [data-slot="input-otp-slot"]:nth-child(${index})`

    await page.locator('#light-code').focus()
    assert.equal(await computed(page, '#light-code', 'outline-style'), 'none')
    assert.equal(await marks(page, 'light-code'), '- - - - caret -')
    assert.equal(
      await computed(page, '[data-panel="light"] [data-slot="input-otp-caret"] > div', 'animation-name'),
      'none',
    )

    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
    assert.notEqual(
      await computed(page, '[data-panel="light"] [data-slot="input-otp-caret"] > div', 'animation-name'),
      'none',
    )
    assert.equal(await computed(page, `${slot(1)}`, 'outline-style'), 'none')
    let active = '[data-panel="light"] [data-slot="input-otp"]:has(> #light-code) [data-active="true"]'
    assert.equal(await computed(page, active, 'outline-style'), 'solid')
  })

  it('keep slots, separators and the ring visible in forced colors, and hide the running input there', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active', reducedMotion: 'reduce' })
    // WebKit has no forced colors mode, so there is nothing to keep visible.
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return
    let box = '[data-panel="light"] [data-slot="input-otp"]:has(> #light-code)'

    await page.locator('#light-code').focus()
    assert.equal(await computed(page, '#light-code', 'opacity'), '0')
    assert.equal(await computed(page, `${box} [data-slot="input-otp-slot"]`, 'border-top-style'), 'solid')
    assert.equal(await computed(page, `${box} [data-active="true"]`, 'outline-style'), 'solid')
    assert.equal(
      await computed(page, `${box} [data-slot="input-otp-caret"] > div`, 'border-inline-start-style'),
      'solid',
    )
    assert.notEqual(await computed(page, `${box} [data-slot="input-otp-separator"] svg`, 'color'), 'rgba(0, 0, 0, 0)')
  })
})

describe('Input Group and Input OTP styles', () => {
  it('keep text, addons, slots and placeholders at 4.5:1 or more, in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = [
        '[data-slot="input-group-control"]',
        '[data-slot="input-group-addon"]:not(:has(> *))',
        '[data-slot="input-group-text"]',
        '[data-slot="input-otp-slot"]:not(:empty)',
      ]
        .map((part) => `[data-theme="${theme}"] ${part}:not([data-slot="field"][data-disabled] *)`)
        .join(', ')
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('mirror addons and slots in right-to-left text', async (t) => {
    let { page } = await open(t)
    let input = (await page.locator('#rtl-search').boundingBox())!
    let start = (await page.getByText('الفواتير').boundingBox())!
    let end = (await page.getByText('١٢ نتيجة').boundingBox())!

    assert.ok(start.x >= input.x + input.width - 1, 'the start addon sits on the right')
    assert.ok(end.x + end.width <= input.x + 1, 'the end addon sits on the left')

    let slot = page.locator('[data-slot="input-otp"]:has(> #rtl-code) [data-slot="input-otp-slot"]')
    let first = (await slot.nth(0).boundingBox())!
    let last = (await slot.nth(5).boundingBox())!
    assert.ok(first.x > last.x, 'the first slot sits on the right')
    assert.equal(await slots(page, 'rtl-code'), '1|2|3|||')
  })

  it('take no time to change colors with reduced motion', async (t) => {
    let { page } = await open(t)

    assert.equal((await computed(page, '[data-slot="input-group"]', 'transition-duration')).trim(), '0s')
    assert.equal((await computed(page, '[data-slot="input-otp-slot"]', 'transition-duration')).trim(), '0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert.notEqual((await computed(page, '[data-slot="input-group"]', 'transition-duration')).trim(), '0s')
  })

  it('fit 320px without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 800 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    let spilled = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-slot="input-group"], [data-slot="input-otp"]')]
          .filter((box) => box.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .map((box) => box.querySelector('input, textarea')?.id),
      )

    // Every slot stays inside its code's input, where a press reaches the input.
    let escaped = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLInputElement>('input[data-slot="input-otp-input"]')].flatMap((input) =>
          [...input.parentElement!.querySelectorAll('[data-slot="input-otp-slot"]')]
            .filter((slot) => {
              slot.scrollIntoView({ block: 'center' })
              let inner = slot.getBoundingClientRect()
              let outer = input.getBoundingClientRect()
              let hit = document.elementFromPoint(inner.left + inner.width / 2, inner.top + inner.height / 2)
              return (
                inner.left < outer.left - 0.5 ||
                inner.right > outer.right + 0.5 ||
                inner.top < outer.top - 0.5 ||
                inner.bottom > outer.bottom + 0.5 ||
                hit !== input
              )
            })
            .map((slot) => `${input.id}[${slot.getAttribute('data-index')}]`),
        ),
      )

    assert.equal(await overflow(), 0)
    assert.deepEqual(await spilled(), [])
    assert.deepEqual(await escaped(), [])
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)
    assert.deepEqual(await spilled(), [])
    assert.deepEqual(await escaped(), [])
  })
})
