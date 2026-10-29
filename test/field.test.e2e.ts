import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createFieldExamples } from './fixtures/field/server.tsx'
import { tags } from './html.ts'
import { paintColors, toRgba } from './paint.ts'

// Pages open with reduced motion, so transitions take 0s and every read sees the final style.
async function open(t: TestContext, { javaScriptEnabled = true } = {}) {
  let examples = await createFieldExamples()
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

function example(page: Page, id: string) {
  return page.locator(`[data-example="${id}"]`)
}

function invoice(page: Page) {
  return example(page, 'field-invoice')
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** Lists duplicate ids, references to missing ids, and empty alerts on the page. */
function checkReferences(page: Page) {
  return page.evaluate(() => {
    let problems: string[] = []
    let ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
    for (let id of ids.filter((id, index) => ids.indexOf(id) !== index)) problems.push(`duplicate id ${id}`)
    for (let element of document.querySelectorAll(
      '[aria-describedby], [aria-labelledby], label[for], [list], [form]',
    )) {
      for (let attribute of ['aria-describedby', 'aria-labelledby', 'for', 'list', 'form']) {
        for (let id of (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) problems.push(`${attribute} names missing ${id}`)
        }
      }
    }
    for (let alert of document.querySelectorAll('[role="alert"]')) {
      if (!alert.textContent?.trim()) problems.push(`empty alert ${alert.outerHTML.slice(0, 80)}`)
    }
    return problems
  })
}

/**
 * The names and values a form sent, as the echo page lists them. Remix's
 * runtime may change the URL before it renders the answer, so this waits
 * for the list.
 */
async function received(page: Page) {
  await page.locator('[data-echo="fields"]').waitFor()
  return page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.querySelector('dt')!.textContent}=${row.querySelector('dd')!.textContent}`),
    )
}

async function fillInvoice(page: Page, values: { customer: string; email: string; amount: string; due: string }) {
  let form = invoice(page)
  await form.getByLabel('Customer (required)').fill(values.customer)
  await form.getByLabel('Billing email (required)').fill(values.email)
  await form.getByLabel('Amount (required)').fill(values.amount)
  await form.getByLabel('Due date (required)').fill(values.due)
}

describe('Field examples', () => {
  it('render native controls with literal states on the server, and hydrate without errors', async (t) => {
    let { page, server, errors } = await open(t)
    let html = await (await fetch(server.baseUrl)).text()
    let invalid = tags(html).filter((tag) => tag.attributes.has('aria-invalid'))

    assert.ok(invalid.length > 0)
    assert.deepEqual(
      [...new Set(invalid.map((tag) => tag.attributes.get('aria-invalid')))].sort(),
      ['false', 'true'],
      'aria-invalid is always "true" or "false", never empty',
    )
    assert.deepEqual(
      tags(html)
        .filter((tag) => tag.attributes.get('data-slot') === 'field')
        .flatMap((tag) => [tag.attributes.get('data-invalid'), tag.attributes.get('data-disabled')])
        .filter((value) => value !== undefined && value !== 'true'),
      [],
    )
    assert.deepEqual(await checkReferences(page), [])
    assert.deepEqual(errors, [])
  })

  it("pass axe-core's WCAG 2.2 A and AA rules, in both color schemes", async (t) => {
    let { page } = await open(t)
    // Slider thumbs are stacked native inputs that axe sizes by the whole
    // track; the Slider tests check their real targets.
    let thumbs = { rule: 'target-size', selector: 'input[data-slot="slider-thumb"]' }

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      assert.deepEqual(await findAccessibilityViolations(page, { except: [thumbs] }), [], colorScheme)
    }
  })

  it('name each control by its label, and focus or toggle it on a click of the label', async (t) => {
    let { page } = await open(t)

    await example(page, 'field-inputs').getByText('Company name').click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'field-demo-basic')

    let checkbox = example(page, 'field-checkboxes').getByRole('checkbox', { name: 'Send me a copy' })
    await example(page, 'field-checkboxes').getByText('Send me a copy').click()
    assert.equal(await checkbox.isChecked(), true)

    let card = example(page, 'field-checkboxes').getByRole('checkbox', { name: 'Pay automatically' })
    assert.equal(await card.getAttribute('aria-describedby'), 'field-demo-autopay-hint')
    await example(page, 'field-checkboxes').getByText('We charge the card on file').click()
    assert.equal(await card.isChecked(), true, 'a click anywhere on a choice card toggles it')

    let pro = example(page, 'field-radios').getByRole('radio', { name: 'Pro' })
    let free = example(page, 'field-radios').getByRole('radio', { name: 'Free' })
    await example(page, 'field-radios').getByText('Ten invoices a month.').click()
    assert.equal(await free.isChecked(), true)
    assert.equal(await pro.isChecked(), false)
  })

  it('group choices in field sets that their legends name', async (t) => {
    let { page } = await open(t)
    let radios = example(page, 'field-radios')

    assert.equal(await radios.getByRole('group', { name: 'Billing cycle' }).getByRole('radio').count(), 2)
    assert.equal(await radios.getByRole('group', { name: 'Archive' }).getByRole('radio', { disabled: true }).count(), 2)
    assert.equal(
      await radios.getByRole('group', { name: 'Delivery' }).getAttribute('aria-describedby'),
      'field-demo-delivery-error',
    )
  })

  it('move through a form with Tab in document order, skipping disabled fields and stopping on read-only ones', async (t) => {
    let { page } = await open(t)
    let form = invoice(page)
    await form.getByLabel('Customer (required)').focus()
    let visited: string[] = []
    for (let step = 0; step < 16; step++) {
      let id = await page.evaluate(() => document.activeElement?.id ?? '')
      if (visited.at(-1) !== id) visited.push(id)
      await page.keyboard.press('Tab')
    }
    let textFields = ['customer', 'email', 'amount', 'due', 'terms', 'number', 'note', 'reference'].map(
      (name) => `invoice-${name}`,
    )

    assert.deepEqual(
      visited.filter((id) => textFields.includes(id)),
      textFields,
    )
    assert.ok(!visited.includes('invoice-workspace'))
  })

  it('keep what the user typed and picked before hydration', async (t) => {
    let examples = await createFieldExamples()
    t.after(() => void examples.close())
    let page = await t.serve(await createTestServer(examples.fetch))
    let release!: () => void
    let held = new Promise<void>((resolve) => (release = resolve))
    await page.route(/entry\.ts/, async (route) => {
      await held
      await route.continue()
    })
    // A module script holds DOMContentLoaded, so wait for the server's HTML instead.
    await page.goto('/', { waitUntil: 'commit' })
    let form = invoice(page)
    await form.getByLabel('Customer (required)').waitFor()

    await form.getByLabel('Customer (required)').fill('Globex AG')
    await form.getByLabel('Currency').selectOption('EUR')
    await form.getByLabel('Payment terms').fill('Net 15')
    await form.getByLabel('Note').fill('Thanks for the quick payment.')
    await example(page, 'native-select-controlled').getByLabel('Currency').selectOption('USD')
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })

    assert.equal(await form.getByLabel('Customer (required)').inputValue(), 'Globex AG')
    assert.equal(await form.getByLabel('Currency').inputValue(), 'EUR')
    assert.equal(await form.getByLabel('Payment terms').inputValue(), 'Net 15')
    assert.equal(await form.getByLabel('Note').inputValue(), 'Thanks for the quick payment.')
    // A controlled select shows its owner's value once it runs.
    assert.equal(await example(page, 'native-select-controlled').getByLabel('Currency').inputValue(), 'CHF')
  })

  it('validate in the browser without JavaScript, and show the server errors in the HTML', async (t) => {
    let { page } = await open(t, { javaScriptEnabled: false })
    let form = invoice(page)

    await form.getByRole('button', { name: 'Create invoice' }).click()
    assert.equal(new URL(page.url()).pathname, '/', 'the browser keeps an incomplete form')

    await fillInvoice(page, { customer: 'Globex AG', email: 'ap@globex.example', amount: '25000', due: '2026-12-01' })
    await form.getByRole('button', { name: 'Create invoice' }).click()
    await page.waitForURL(/\/invoices$/)

    let amount = invoice(page).getByLabel('Amount (required)')
    assert.equal(await amount.getAttribute('aria-invalid'), 'true')
    assert.equal(await amount.getAttribute('aria-describedby'), 'invoice-amount-hint invoice-amount-error')
    assert.equal(
      await invoice(page).locator('#invoice-amount-error').textContent(),
      'Invoices over 10,000 need a second approver.',
    )
    assert.equal(await invoice(page).locator('#invoice-amount-error').getAttribute('role'), 'alert')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'invoice-amount', 'the first error has focus')
    assert.equal(await invoice(page).getByLabel('Customer (required)').getAttribute('aria-invalid'), 'false')
    assert.equal(await invoice(page).getByLabel('Customer (required)').inputValue(), 'Globex AG')
    assert.equal(await invoice(page).getByLabel('Due date (required)').inputValue(), '2026-12-01')
    assert.deepEqual(await checkReferences(page), [])
  })

  it("show the browser's messages in FieldError once hydrated, focus the first one, and clear each when fixed", async (t) => {
    let { page } = await open(t)
    let form = invoice(page)
    let customer = form.getByLabel('Customer (required)')
    let email = form.getByLabel('Billing email (required)')

    await form.getByRole('button', { name: 'Create invoice' }).click()
    await form.locator('#invoice-customer-error').waitFor()
    assert.equal(new URL(page.url()).pathname, '/')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'invoice-customer')
    for (let name of ['customer', 'email', 'amount', 'due']) {
      let control = form.locator(`#invoice-${name}`)
      assert.equal(await control.getAttribute('aria-invalid'), 'true', name)
      assert.ok((await form.locator(`#invoice-${name}-error`).textContent())?.trim(), name)
      assert.ok((await control.getAttribute('aria-describedby'))?.endsWith(`invoice-${name}-error`), name)
    }
    assert.equal(await form.locator('#invoice-currency').getAttribute('aria-invalid'), 'false')

    await customer.fill('Globex AG')
    assert.equal(await customer.getAttribute('aria-invalid'), 'false')
    assert.equal(await customer.getAttribute('aria-describedby'), null)
    assert.equal(await form.locator('#invoice-customer-error').count(), 0)

    await email.fill('ap@')
    assert.equal(await email.getAttribute('aria-invalid'), 'true', 'a field stays invalid until it is valid')
    await email.fill('ap@globex.example')
    assert.equal(await email.getAttribute('aria-describedby'), 'invoice-email-hint')
    assert.deepEqual(await checkReferences(page), [])
  })

  it('report a refused save for the whole form, without marking a field invalid', async (t) => {
    let { page } = await open(t)
    await fillInvoice(page, {
      customer: 'Closed Account Ltd',
      email: 'ap@closed.example',
      amount: '120',
      due: '2026-12-01',
    })
    await invoice(page).getByRole('button', { name: 'Create invoice' }).click()
    // Remix's runtime sends the form and renders the answer in place, so the page stays live.
    await page.locator('#invoice-form-error').waitFor()
    let form = invoice(page).locator('form')

    assert.equal(await form.getAttribute('aria-describedby'), 'invoice-form-error')
    assert.equal(await page.locator('#invoice-form-error').getAttribute('role'), 'alert')
    assert.match(
      (await page.locator('#invoice-form-error').textContent()) ?? '',
      /closed account, so nothing was saved/,
    )
    assert.equal(await form.locator('[aria-invalid="true"]').count(), 0)
    assert.equal(await form.locator('[data-slot="field-error"]').count(), 0)
    assert.equal(await invoice(page).getByLabel('Customer (required)').inputValue(), 'Closed Account Ltd')
  })

  it('send every field of the form, including one outside it, but not a disabled one', async (t) => {
    let { page } = await open(t)
    await fillInvoice(page, { customer: 'Globex AG', email: 'ap@globex.example', amount: '120.50', due: '2026-12-01' })
    await invoice(page).getByLabel('Currency').selectOption('EUR')
    await invoice(page).getByLabel('Internal reference').fill('PO-77')
    await invoice(page).getByRole('button', { name: 'Create invoice' }).click()
    await page.waitForURL(/\/invoices$/)

    assert.deepEqual(await received(page), [
      'customer=Globex AG',
      'email=ap@globex.example',
      'amount=120.50',
      'currency=EUR',
      'due=2026-12-01',
      'terms=Net 30',
      'number=INV-2026-0042',
      'note=',
      'reference=PO-77',
    ])
  })

  it('reset every field to its starting value, also outside the form, and drop the messages', async (t) => {
    let { page } = await open(t)
    let form = invoice(page)
    await form.getByRole('button', { name: 'Create invoice' }).click()
    await form.locator('#invoice-customer-error').waitFor()
    await form.getByLabel('Customer (required)').fill('Globex AG')
    await form.getByLabel('Currency').selectOption('USD')
    await form.getByLabel('Payment terms').fill('Net 60')
    await form.getByLabel('Internal reference').fill('PO-77')

    await form.getByRole('button', { name: 'Reset' }).click()

    assert.equal(await form.getByLabel('Customer (required)').inputValue(), '')
    assert.equal(await form.getByLabel('Currency').inputValue(), 'CHF')
    assert.equal(await form.getByLabel('Payment terms').inputValue(), 'Net 30')
    assert.equal(await form.getByLabel('Internal reference').inputValue(), '')
    assert.equal(await form.locator('[role="alert"]').count(), 0)
    assert.equal(await form.locator('[aria-invalid="true"]').count(), 0)
  })

  it('add and remove changing fields, each with its own ids, error and focus', async (t) => {
    let { page } = await open(t)
    let recipients = example(page, 'field-recipients')
    let add = recipients.getByRole('button', { name: 'Add recipient' })

    await add.click()
    await add.click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'recipient-3', 'a new row takes focus')
    await recipients.getByLabel('Recipient 2', { exact: true }).fill('not an address')
    await recipients.getByLabel('Recipient 2', { exact: true }).press('Tab')
    let second = recipients.locator('#recipient-2')
    assert.equal(await second.getAttribute('aria-invalid'), 'true')
    assert.equal(await second.getAttribute('aria-describedby'), 'recipients-hint recipient-2-error')
    assert.equal(await recipients.locator('[role="alert"]').count(), 1)
    assert.equal(await recipients.locator('[data-invalid="true"]').count(), 1)

    await recipients.getByRole('button', { name: 'Remove recipient 1' }).click()
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Add recipient')
    assert.equal(
      await recipients.getByLabel('Recipient 1', { exact: true }).getAttribute('id'),
      'recipient-2',
      'rows keep their ids',
    )
    assert.equal(await second.getAttribute('aria-describedby'), 'recipients-hint recipient-2-error')

    await second.fill('ar@acme.example')
    assert.equal(await second.getAttribute('aria-invalid'), 'false')
    assert.equal(await recipients.locator('[role="alert"]').count(), 0)

    await add.click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'recipient-4', 'ids are never reused')
    assert.deepEqual(await checkReferences(page), [])
  })

  it('send forms with native types, suggestions and selects, and block a required field', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'input-form')
    assert.equal(
      await example(page, 'input-datalist')
        .getByLabel('Payment terms')
        .evaluate((input: HTMLInputElement) => input.list?.id),
      'input-demo-terms-list',
    )

    await form.getByRole('button', { name: 'Submit' }).click()
    assert.equal(new URL(page.url()).pathname, '/')
    await form.getByLabel('Name').fill('Ada Lovelace')
    await form.getByLabel('Email').fill('ada@example.com')
    await form.getByLabel('Country').selectOption('de')
    await form.getByRole('button', { name: 'Submit' }).click()
    await page.waitForURL(/\/echo\?/)

    assert.deepEqual(await received(page), [
      'name=Ada Lovelace',
      'email=ada@example.com',
      'phone=',
      'country=de',
      'address=',
    ])
  })

  it('follow a controlled select, and keep a native select working with the keyboard', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'native-select-controlled')

    await controlled.getByLabel('Currency').selectOption('EUR')
    assert.equal(await controlled.locator('[data-value="currency"]').textContent(), 'Invoices show amounts in EUR.')

    let country = example(page, 'native-select-field').getByLabel('Country')
    await country.focus()
    assert.equal(await country.evaluate((select) => select.matches(':focus-visible')), true)
    assert.equal(await country.inputValue(), 'ch')
  })
})

describe('Field styles', () => {
  it('keep labels, descriptions, errors and values at 4.5:1 or more, in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = [
        'label[data-slot="field-label"]',
        'legend[data-slot="field-legend"]',
        '[data-slot="field-description"]',
        '[data-slot="field-error"]',
        '[data-slot="field-separator-content"]',
        '[data-slot="input"]',
        '[data-slot="textarea"]',
        'select[data-slot="native-select"]',
      ]
        .map((part) => `[data-theme="${theme}"] ${part}:not(:disabled):not([data-slot="field"][data-disabled] *)`)
        .join(', ')
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('show a focus ring on inputs, selects and choice cards, also in forced colors', async (t) => {
    let { page } = await open(t)
    let panel = page.locator('[data-panel="light"]')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      for (let control of [
        panel.getByLabel('Customer', { exact: true }),
        panel.getByLabel('Currency', { exact: true }),
        panel.getByRole('checkbox', { name: 'Pay automatically' }),
      ]) {
        // Tab and Shift+Tab mark keyboard focus in every engine.
        await control.focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        assert.equal(await control.evaluate((element) => element.matches(':focus-visible')), true)
        // The ring sits outside the control's box, so the picture takes the whole panel.
        let focused = await panel.screenshot()
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        let blurred = await panel.screenshot()

        assert.notDeepEqual(focused, blurred, `${forcedColors}: ${await control.getAttribute('id')}`)
      }
    }
  })

  it('keep borders, separators and the chevron visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active', reducedMotion: 'reduce' })
    // WebKit has no forced colors mode, so there is nothing to keep visible.
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return
    let panel = '[data-panel="light"]'

    for (let selector of [
      `${panel} [data-slot="input"]`,
      `${panel} [data-slot="textarea"]`,
      `${panel} select[data-slot="native-select"]`,
      `${panel} label:has(> [data-slot="field"])`,
    ]) {
      assert.equal(await computed(page, selector, 'border-top-style'), 'solid', selector)
      assert.notEqual(await computed(page, selector, 'border-top-color'), 'rgba(0, 0, 0, 0)', selector)
    }
    assert.equal(
      await computed(page, `${panel} [data-slot="field-separator"] [role="separator"]`, 'border-top-style'),
      'solid',
    )
    assert.notEqual(await computed(page, `${panel} [data-slot="native-select-icon"]`, 'color'), 'rgba(0, 0, 0, 0)')
  })

  it('take no time to change colors with reduced motion', async (t) => {
    let { page } = await open(t)

    assert.equal((await computed(page, '[data-slot="input"]', 'transition-duration')).trim(), '0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert.notEqual((await computed(page, '[data-slot="input"]', 'transition-duration')).trim(), '0s')
  })

  it('mirror chevrons, choices, separators and errors in right-to-left text', async (t) => {
    let { page } = await open(t)
    let fields = example(page, 'rtl-fields')
    let select = (await fields.getByLabel('البلد').boundingBox())!
    let chevron = (await fields.locator('[data-slot="native-select-icon"]').boundingBox())!
    let error = (await fields.locator('[data-slot="field-error"]').boundingBox())!
    let icon = (await fields.locator('[data-slot="field-error"] svg').boundingBox())!

    assert.ok(chevron.x - select.x < 24, 'the chevron sits at the left end')
    assert.ok(error.x + error.width - (icon.x + icon.width) < 2, 'the error icon starts the line on the right')

    let choices = example(page, 'rtl-choices')
    let checkbox = (await choices.getByRole('checkbox', { name: 'قبل تاريخ الاستحقاق' }).boundingBox())!
    let label = (await choices.getByText('قبل تاريخ الاستحقاق').boundingBox())!
    assert.ok(checkbox.x > label.x, 'the checkbox comes first, on the right')
  })

  it('put a responsive field in a row on a wide screen and stack it on a narrow one', async (t) => {
    let { page } = await open(t)
    let field = example(page, 'field-responsive').locator('[data-slot="field"]').first()
    let layout = async () => {
      let label = (await field.locator('label').boundingBox())!
      let input = (await field.locator('input').boundingBox())!
      return input.y >= label.y + label.height ? 'stacked' : 'row'
    }

    assert.equal(await layout(), 'row')
    await page.setViewportSize({ width: 390, height: 800 })
    assert.equal(await layout(), 'stacked')
  })

  it('fit 320px without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 800 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)
  })
})
