import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createQuestionnaireExamples } from './fixtures/questionnaire/server.tsx'
import { tags } from './html.ts'
import { paintColors, toRgba } from './paint.ts'

// How long a page may take to hydrate once its document arrived, also while a full lane runs every e2e file at once.
const hydrationTimeout = 30_000

// Pages open with reduced motion, so transitions take 0s and every read sees the final style.
async function open(t: TestContext, { javaScriptEnabled = true, clock = false } = {}) {
  let examples = await createQuestionnaireExamples()
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
  page.on('console', (message) => ['error', 'warning'].includes(message.type()) && errors.push(message.text()))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  if (clock) await page.clock.install()
  // Firefox fires load only once the entry's top-level `await app.ready()` has hydrated every client entry, so a
  // navigation that waits for load times hydration against the 10s navigation limit there, and Chromium against the
  // 5s action limit. The navigation waits for the document; hydration, every questionnaire on this long page, gets its
  // own limit. A page without JavaScript has nothing to hydrate, and load also waits for its stylesheet.
  await page.goto('/', { waitUntil: javaScriptEnabled ? 'domcontentloaded' : 'load' })
  if (javaScriptEnabled)
    await page.locator('html[data-ready]').waitFor({ state: 'attached', timeout: hydrationTimeout })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, id: string) {
  return page.locator(`[data-example="${id}"]`)
}

function question(page: Page, id: string, name: string) {
  return example(page, id).locator(`fieldset[data-name="${name}"]`)
}

function activeName(page: Page, id: string) {
  return example(page, id).locator('fieldset[data-active]').first().getAttribute('data-name')
}

function focused(page: Page) {
  return page.evaluate(() => {
    let element = document.activeElement as HTMLElement | null
    if (!element) return null
    if (element.matches('fieldset')) return `item:${element.dataset.name}`
    if (element.matches('input[type="radio"], input[type="checkbox"]'))
      return `choice:${(element as HTMLInputElement).value}`
    return element.getAttribute('data-slot') ?? element.tagName.toLowerCase()
  })
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

/** Lists duplicate ids, references to missing ids, nested forms, and empty alerts on the page. */
function checkReferences(page: Page) {
  return page.evaluate(() => {
    let problems: string[] = []
    let ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
    for (let id of ids.filter((id, index) => ids.indexOf(id) !== index)) problems.push(`duplicate id ${id}`)
    for (let element of document.querySelectorAll('[aria-describedby], [aria-labelledby], label[for]')) {
      for (let attribute of ['aria-describedby', 'aria-labelledby', 'for']) {
        for (let id of (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) problems.push(`${attribute} names missing ${id}`)
        }
      }
    }
    if (document.querySelector('form form')) problems.push('a nested form')
    for (let alert of document.querySelectorAll('[role="alert"]')) {
      if (!alert.textContent?.trim()) problems.push(`empty alert ${alert.outerHTML.slice(0, 80)}`)
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

function result(page: Page, id: string) {
  return example(page, id).locator('[data-slot="questionnaire-example-result"]')
}

describe('Questionnaire examples', () => {
  it('render one native form per questionnaire on the server, and hydrate without errors', async (t) => {
    let { page, server, errors } = await open(t)
    let html = await (await fetch(server.baseUrl)).text()
    let forms = tags(html, 'form').filter((form) => form.attributes.get('data-slot') === 'questionnaire')

    assert.ok(forms.length >= 18, String(forms.length))
    assert.ok(forms.every((form) => !form.attributes.has('novalidate')))
    assert.ok(tags(html, 'fieldset').every((item) => !item.attributes.has('hidden')))
    assert.deepEqual(await checkReferences(page), [])
    assert.deepEqual(errors, [])
    assert.ok(
      await example(page, 'demo')
        .locator('form')
        .evaluate((form: HTMLFormElement) => form.noValidate),
    )
  })

  it("pass axe-core's WCAG 2.2 A and AA rules before and after hydration, in both color schemes", async (t) => {
    let { page } = await open(t)
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }

    // Before hydration: the module entry never loads, so the server's HTML stays.
    let examples = await createQuestionnaireExamples()
    t.after(() => void examples.close())
    let context = await page.context().browser()!.newContext()
    t.after(() => context.close())
    let before = await context.newPage()
    let server = await createTestServer(examples.fetch)
    await before.route(/\/assets\/(?!.*\.css)/, (route) => route.abort())
    await before.emulateMedia({ reducedMotion: 'reduce' })
    await before.goto(server.baseUrl)
    assert.deepEqual(await findAccessibilityViolations(before), [], 'before hydration')
  })

  it('keep the answers picked and typed before hydration', async (t) => {
    let examples = await createQuestionnaireExamples()
    t.after(() => void examples.close())
    let page = await t.serve(await createTestServer(examples.fetch))
    let release!: () => void
    let held = new Promise<void>((resolve) => (release = resolve))
    await page.route(/entry\.ts/, async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/', { waitUntil: 'commit' })
    let freeform = example(page, 'freeform')
    await freeform.getByLabel('Another prototype direction').waitFor()

    await example(page, 'demo')
      .getByRole('radio', { name: /Question prompts/ })
      .check()
    await freeform.getByLabel('Another prototype direction').fill('Inbox triage')
    // Navigation needs the script, so it waits, disabled.
    assert.ok(await example(page, 'demo').getByRole('button', { name: 'Next' }).isDisabled())
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })

    assert.equal(await question(page, 'demo', 'direction').getAttribute('data-status'), 'answered')
    await example(page, 'demo').getByRole('button', { name: 'Next' }).click()
    assert.equal(await activeName(page, 'demo'), 'signals')

    await freeform.getByRole('button', { name: 'Save answers' }).click()
    assert.equal(await result(page, 'freeform').textContent(), 'Saved. prototype: Inbox triage')
  })

  it('show every question without JavaScript, and let the browser check and post the form', async (t) => {
    let { page } = await open(t, { javaScriptEnabled: false })
    let demo = example(page, 'demo')

    for (let name of ['direction', 'signals', 'timing']) assert.ok(await question(page, 'demo', name).isVisible(), name)
    assert.ok(!(await demo.getByRole('button', { name: 'Next' }).isVisible()))
    assert.ok(!(await demo.getByRole('button', { name: 'Previous' }).isVisible()))
    assert.ok(await demo.getByRole('button', { name: 'Save answers' }).isVisible())
    assert.ok(!(await demo.locator('[data-slot="questionnaire-progress"]').isVisible()))
    assert.ok(!(await demo.locator('[data-slot="questionnaire-choice-shortcut"]').first().isVisible()))
    assert.ok(!(await question(page, 'conditional', 'environment').isVisible()), 'a disabled question stays out')

    let native = example(page, 'native')
    await native.getByRole('button', { name: 'Save reminders' }).click()
    assert.equal(new URL(page.url()).pathname, '/', 'the browser keeps an incomplete form')
    await native.getByLabel('Contact email').press('Enter')
    assert.equal(new URL(page.url()).pathname, '/', 'Enter submits nothing')

    await native.getByRole('radio', { name: 'A week before' }).check()
    await native.getByRole('checkbox', { name: 'Email' }).check()
    await native.getByLabel('Contact email').fill('billing@example.com')
    await native.getByRole('button', { name: 'Save reminders' }).click()
    assert.deepEqual(await received(page), ['reminder=week', 'channels=email', 'contact=billing@example.com'])
  })

  it('post the native form after its checks, without a skipped answer', async (t) => {
    let { page } = await open(t)
    let native = example(page, 'native')

    await native.getByRole('radio', { name: 'On the due date' }).check()
    await native.getByRole('button', { name: 'Next' }).click()
    await native.getByRole('button', { name: 'Skip' }).click()
    await native.getByLabel('Contact email').fill('billing@example.com')
    await native.getByRole('button', { name: 'Save reminders' }).click()

    assert.deepEqual(await received(page), ['reminder=due', 'contact=billing@example.com'])
  })

  it('work with the keyboard alone: Tab, the arrows, Space, Enter and letter keys', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'demo')

    // Tab enters the radio group, and the arrows select natively.
    await demo.getByRole('heading', { level: 3, name: 'Three questions' }).click()
    await demo.locator('[data-slot="questionnaire-progress"]').click()
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'choice:delegation')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'choice:questions')
    assert.ok(await demo.getByRole('radio', { name: /Question prompts/ }).isChecked())
    await page.keyboard.press('Enter')
    assert.equal(await activeName(page, 'demo'), 'signals')
    assert.equal(await focused(page), 'item:signals')

    // From the question, Down moves into the answers, and Space checks one.
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'choice:progress')
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    assert.equal(await focused(page), 'choice:risks')
    // Right continues from a checkbox, which has no Right of its own.
    await page.keyboard.press('ArrowRight')
    assert.equal(await activeName(page, 'demo'), 'timing')
  })

  it('move between questions with Left and Right outside the answers, and pick answers by letter', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'demo')

    await demo.getByRole('button', { name: 'Next' }).focus()
    await page.keyboard.press('b')
    assert.ok(await demo.getByRole('radio', { name: /Question prompts/ }).isChecked())
    assert.equal(await focused(page), 'choice:questions')

    await demo.getByRole('button', { name: 'Next' }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await activeName(page, 'demo'), 'signals')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await activeName(page, 'demo'), 'direction')
    assert.ok(await demo.getByRole('radio', { name: /Question prompts/ }).isChecked(), 'answers stay')

    // Keys pause while typing.
    await demo.getByLabel('Another direction').fill('')
    await demo.getByLabel('Another direction').press('a')
    assert.equal(await demo.getByLabel('Another direction').inputValue(), 'a')
    assert.ok(!(await demo.getByRole('radio', { name: /Sub-agent delegation/ }).isChecked()))
    assert.ok(!(await demo.getByRole('radio', { name: /Question prompts/ }).isChecked()), 'the text replaced it')
    await page.keyboard.press('ControlOrMeta+Enter')
    assert.equal(await activeName(page, 'demo'), 'signals')
  })

  it('answer by a click anywhere on a choice, and submit one snapshot', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'demo')

    await demo.getByText('Show choices while the agent waits for input.').click()
    await demo.getByRole('button', { name: 'Next' }).click()
    await demo.getByText('Decisions').click()
    await demo.getByText('Risks').click()
    await demo.getByRole('button', { name: 'Next' }).click()
    await demo.getByText('Next cycle').click()
    await demo.getByRole('button', { name: 'Previous' }).click()
    await demo.getByText('Decisions').click()
    await demo.getByRole('button', { name: 'Next' }).click()
    await demo.getByRole('button', { name: 'Save answers' }).click()

    assert.equal(
      await result(page, 'demo').textContent(),
      'Saved. direction: questions · signals: risks · timing: cycle',
    )
  })

  it('say why a question can’t go on, focus its answer, and drop the message once answered', async (t) => {
    let { page } = await open(t)
    let demo = example(page, 'demo')

    await demo.getByRole('button', { name: 'Next' }).click()
    let error = question(page, 'demo', 'direction').locator('[data-slot="questionnaire-error"]')
    assert.equal(await error.getAttribute('role'), 'alert')
    assert.equal((await error.textContent())?.trim(), 'Choose an answer to continue.')
    assert.equal(await focused(page), 'choice:delegation')
    assert.deepEqual(await checkReferences(page), [])

    await page.keyboard.press('Space')
    assert.ok(!(await error.isVisible()))
    await demo.getByRole('button', { name: 'Next' }).click()
    await demo.getByRole('button', { name: 'Next' }).click()
    assert.equal(
      (await question(page, 'demo', 'signals').locator('[data-slot="questionnaire-error"]').textContent())?.trim(),
      'Choose an answer or skip this question.',
    )
    // A press, not a click: in this layout, WebKit scrolls the page when a
    // mouse press focuses a Button and its :active style moves it, so the
    // release lands below the button.
    await demo.getByRole('button', { name: 'Skip' }).press('Enter')
    assert.equal(await activeName(page, 'demo'), 'timing')
    assert.equal(await question(page, 'demo', 'signals').getAttribute('data-status'), 'skipped')
  })

  it('wait for an async check, and show the code it refused', async (t) => {
    let { page } = await open(t)
    let validation = example(page, 'validation')
    let next = validation.getByRole('button', { name: /Next|Checking/ })

    await validation.getByLabel('Project code').fill('INV-9999')
    await next.click()
    assert.equal(await next.getAttribute('aria-disabled'), 'true')
    assert.equal((await next.textContent())?.trim(), 'Checking…')
    assert.equal(await validation.locator('form').getAttribute('aria-busy'), 'true')
    await next.click({ force: true })

    let error = question(page, 'validation', 'code').locator('[data-slot="questionnaire-error"]')
    await error.getByText('No project uses INV-9999.', { exact: false }).waitFor()
    assert.equal(await focused(page), 'questionnaire-input')
    assert.equal(await activeName(page, 'validation'), 'code')

    await validation.getByLabel('Project code').fill('inv-2041')
    assert.ok(!(await error.isVisible()))
    await next.click()
    await question(page, 'validation', 'detail').locator('legend').waitFor()
    assert.equal(await activeName(page, 'validation'), 'detail')
  })

  it('send once while a submit runs, keep every answer when it fails, and send again', async (t) => {
    // The example's send takes 800ms of the page's clock, held here so the forced click and the
    // shortcut run while it sends. A forced click measures Send before it presses: a send that
    // ended in between would show its error above Send and move it from under the press, and one
    // that ended before the shortcut would let the shortcut send again.
    let { page } = await open(t, { clock: true })
    await page.clock.pauseAt(Date.now() + 1000)
    let submitting = example(page, 'submitting')

    await submitting.getByText('Tonight at 22:00').click()
    await submitting.getByRole('button', { name: 'Next' }).click()
    await submitting.getByLabel('Approver').fill('Billing on-call')
    await submitting.getByLabel('Fail the next send').check()
    let send = submitting.locator('button[data-slot="questionnaire-submit"]')
    await send.click()
    assert.equal(await send.getAttribute('aria-disabled'), 'true')
    assert.ok((await send.textContent())?.includes('Sending…'))
    await send.click({ force: true })
    await page.keyboard.press('ControlOrMeta+Enter')
    assert.equal(await send.getAttribute('aria-disabled'), 'true', 'still sending')
    await page.clock.runFor(800)

    let error = submitting.locator('[data-slot="questionnaire-error"][data-scope="questionnaire"]')
    await error.getByText('The planning service didn’t answer.', { exact: false }).waitFor()
    assert.equal(await error.getAttribute('role'), 'alert')
    assert.equal(await focused(page), 'questionnaire-submit', 'focus stays on Send plan')
    assert.equal(await submitting.getByLabel('Approver').inputValue(), 'Billing on-call')

    await send.click()
    await page.clock.runFor(800)
    await result(page, 'submitting').getByText('Sent after 2 tries.', { exact: false }).waitFor()
    assert.ok(!(await error.isVisible()))
  })

  it('send the person back to the answer the server refused', async (t) => {
    let { page } = await open(t)
    let submitting = example(page, 'submitting')

    await submitting.getByText('Over the weekend').click()
    await submitting.getByRole('button', { name: 'Next' }).click()
    await submitting.getByLabel('Approver').fill('Billing on-call')
    await submitting.getByRole('button', { name: 'Send plan' }).click()

    let error = question(page, 'submitting', 'window').locator('[data-slot="questionnaire-error"]')
    await error.getByText('Weekend deploys need an on-call reviewer.', { exact: false }).waitFor()
    assert.equal(await activeName(page, 'submitting'), 'window')
    assert.equal(await focused(page), 'choice:weekend')
  })

  it('follow a caller that keeps the question, and move focus with it', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'controlled')

    await controlled.getByRole('button', { name: 'Output' }).click()
    assert.equal(await activeName(page, 'controlled'), 'output')
    assert.equal(await focused(page), 'item:output')
    assert.ok((await controlled.getByRole('status').first().textContent())?.includes('Current checkpoint: Output'))

    await controlled.getByText('Concise summary').click()
    assert.ok((await controlled.getByRole('status').first().textContent())?.includes('Answered: 1 of 3'))
    await controlled.getByRole('button', { name: 'Save workflow' }).click()
    assert.equal(await activeName(page, 'controlled'), 'scope', 'it goes back to the first question without an answer')
  })

  it('resume a saved draft, and reset to it', async (t) => {
    let { page } = await open(t)
    let resume = example(page, 'resume')

    assert.equal(await activeName(page, 'resume'), 'verification')
    assert.ok(await resume.getByRole('checkbox', { name: 'Run the typecheck' }).isChecked())
    await resume.getByText('Run the typecheck').click()
    await resume.getByRole('button', { name: 'Next' }).click()
    await resume.getByLabel('Saved migration note').fill('Ship it on Friday.')
    await resume.getByRole('button', { name: 'Reset changes' }).click()

    await result(page, 'resume').getByText('Saved answers restored.').waitFor()
    assert.equal(await activeName(page, 'resume'), 'verification')
    assert.ok(await resume.getByRole('checkbox', { name: 'Run the typecheck' }).isChecked())
    assert.equal(await resume.getByLabel('Saved migration note').inputValue(), 'Keep the existing public API stable.')
    await resume.getByRole('button', { name: 'Next' }).click()
    await resume.getByRole('button', { name: 'Update draft' }).click()
    assert.equal(
      await result(page, 'resume').textContent(),
      'Draft updated. change: incremental · verification: tests, typecheck · notes: Keep the existing public API stable.',
    )
  })

  it('add a question once an answer needs it, and take it out again', async (t) => {
    let { page } = await open(t)
    let conditional = example(page, 'conditional')
    let progress = conditional.locator('[data-slot="questionnaire-progress"]')

    assert.equal(await progress.textContent(), 'Question 1 of 2')
    await conditional.getByText('Cloud workspace').click()
    assert.equal(await progress.textContent(), 'Question 1 of 3')
    await conditional.getByRole('button', { name: 'Next' }).click()
    assert.equal(await activeName(page, 'conditional'), 'environment')
    await conditional.getByRole('button', { name: 'Previous' }).click()
    await conditional.getByText('Local workspace').click()
    await conditional.getByRole('button', { name: 'Next' }).click()
    assert.equal(await activeName(page, 'conditional'), 'approval')
    assert.equal(await progress.textContent(), 'Question 2 of 2')
  })

  it('keep Next disabled until the question has an answer, when the caller asks', async (t) => {
    let { page } = await open(t)
    let state = example(page, 'navigation-state')
    let next = state.getByRole('button', { name: 'Next' })

    assert.ok(await next.isDisabled())
    await state.getByText('Project files and tests').click()
    assert.ok(await next.isEnabled())
    await next.click()
    assert.ok(await state.getByRole('button', { name: 'Save permissions' }).isDisabled())
  })

  it('answer in a dialog, and close it on save', async (t) => {
    let { page } = await open(t)
    let dialog = example(page, 'dialog')

    await dialog.getByRole('button', { name: 'Open questionnaire' }).click()
    let popup = page.getByRole('dialog', { name: 'Plan an agent interface' })
    await popup.waitFor()
    await popup.getByText('Both together').click()
    await popup.getByRole('button', { name: 'Next' }).click()
    await popup.getByRole('button', { name: 'Skip' }).click()
    await popup.getByText('This week').click()
    await popup.getByRole('button', { name: 'Save answers' }).click()

    await popup.waitFor({ state: 'hidden' })
    assert.equal(await result(page, 'dialog').textContent(), 'Saved. direction: both · signals: skipped · timing: week')
  })

  it('keep questionnaires on one page apart', async (t) => {
    let { page } = await open(t)
    let light = page.locator('[data-theme="light"]')
    let dark = page.locator('[data-theme="dark"]')

    await light.getByText('Pro', { exact: true }).click()
    assert.ok(await light.getByRole('radio', { name: /Pro/ }).isChecked())
    assert.ok(!(await dark.getByRole('radio', { name: /Pro/ }).isChecked()))
    await dark.getByRole('button', { name: 'Save answers' }).click()
    assert.ok(await dark.locator('[data-slot="questionnaire-error"]').first().isVisible())
    assert.ok(!(await light.locator('[data-slot="questionnaire-error"]').first().isVisible()))
  })
})

describe('Questionnaire styles', () => {
  it('keep titles, descriptions, answers, errors and progress at 4.5:1 or more, in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []
    // Show an error in each theme panel first.
    for (let theme of ['light', 'dark']) {
      await page.locator(`[data-theme="${theme}"]`).getByRole('button', { name: 'Save answers' }).click()
    }

    for (let theme of ['light', 'dark']) {
      let selector = [
        '[data-slot="questionnaire-title"]',
        '[data-slot="questionnaire-description"]',
        '[data-slot="questionnaire-choice-label"]',
        '[data-slot="questionnaire-choice-description"]',
        '[data-slot="questionnaire-error"]:not([hidden])',
      ]
        .map((part) => `[data-theme="${theme}"] ${part}:not([data-disabled] *)`)
        .join(', ')
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }
    for (let { label, background, text } of await paintColors(
      page,
      '[data-example="demo"] [data-slot="questionnaire-progress"], [data-example="demo"] [data-slot="questionnaire-choice-shortcut"]',
    )) {
      let ratio = contrastRatio(toRgba(text), toRgba(background))
      if (ratio < 4.5) failures.push(`page ${label}: ${ratio.toFixed(2)}`)
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('show a focus ring around a choice and the question, also in forced colors', async (t) => {
    let { page } = await open(t)
    let panel = page.locator('[data-theme="light"]')

    // A checked radio is where Tab and Shift+Tab enter its group in every engine.
    await panel.getByText('Plus', { exact: true }).click()
    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      let radio = panel.getByRole('radio', { name: /Plus/ })
      await radio.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      assert.ok(await radio.evaluate((element) => element.matches(':focus-visible')))
      let row = panel.locator('label[data-slot="questionnaire-choice"]').first()
      assert.equal(await row.evaluate((element) => getComputedStyle(element).outlineStyle), 'solid', forcedColors)
      let ring = await panel.screenshot()
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      assert.notDeepEqual(ring, await panel.screenshot(), forcedColors)
    }
  })

  it('keep the choices’ edges and the checked choice visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active', reducedMotion: 'reduce' })
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return
    let panel = '[data-theme="light"]'

    let choice = `${panel} label[data-slot="questionnaire-choice"]`
    assert.equal(await computed(page, choice, 'border-top-style'), 'solid')
    assert.notEqual(await computed(page, choice, 'border-top-color'), 'rgba(0, 0, 0, 0)')
    assert.equal(await computed(page, `${panel} input[data-slot="questionnaire-choice-input"]`, 'appearance'), 'auto')

    await page.locator(panel).getByText('Pro', { exact: true }).click()
    assert.equal(await computed(page, `${choice}[data-checked]`, 'border-top-width'), '2px')
  })

  it('take no time to change colors or bring in a question with reduced motion', async (t) => {
    let { page } = await open(t)

    assert.equal((await computed(page, 'label[data-slot="questionnaire-choice"]', 'transition-duration')).trim(), '0s')
    assert.equal(
      (await computed(page, '[data-example="animated"] fieldset[data-active]', 'transition-duration')).trim(),
      '0s',
    )
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert.notEqual(
      (await computed(page, 'label[data-slot="questionnaire-choice"]', 'transition-duration')).trim(),
      '0s',
    )
  })

  it('mirror choices, keys and actions in right-to-left text, and swap Left and Right', async (t) => {
    let { page } = await open(t)
    let rtl = example(page, 'rtl')
    let current = rtl.locator('fieldset[data-active]')
    let choice = (await current.locator('label[data-slot="questionnaire-choice"]').first().boundingBox())!
    let radio = (await current.getByRole('radio').first().boundingBox())!
    let key = (await current.locator('[data-slot="questionnaire-choice-shortcut"]').first().boundingBox())!
    let previous = (await rtl.getByRole('button', { name: 'السابق' }).boundingBox())!
    let save = (await rtl.getByRole('button', { name: 'حفظ' }).boundingBox())!

    assert.ok(radio.x > choice.x + choice.width / 2, 'the radio starts the row on the right')
    assert.ok(key.x < choice.x + choice.width / 2, 'the key ends it on the left')
    assert.ok(previous.x > save.x, 'Previous on the right, Save on the left')
    assert.equal(await rtl.locator('[data-slot="questionnaire-progress"]').textContent(), 'السؤال 2 من 2')

    await rtl.getByRole('button', { name: 'حفظ' }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await activeName(page, 'rtl'), 'reminder', 'Right goes back in right-to-left text')
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
