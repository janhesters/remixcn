import { css, on, ref } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Button, buttonVariants } from './button.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function button(container: HTMLElement, name: string) {
  let found = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

/** Records each submission of the form, with the data the browser would send, and keeps the page in place. */
function recordSubmissions(form: HTMLFormElement) {
  let submissions: Array<Record<string, string>> = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    let data = new FormData(form, event.submitter)
    submissions.push(Object.fromEntries([...data].map(([name, value]) => [name, String(value)])))
  })
  return submissions
}

describe('Button in the browser', () => {
  it("runs the caller's events, refs and mixins on the native button", async (t) => {
    let clicks = 0
    let node: HTMLButtonElement | undefined
    let { container, act } = mount(
      t,
      <Button
        mix={[ref((element) => (node = element)), on('click', () => void clicks++), css({ letterSpacing: '3px' })]}
      >
        Remind
      </Button>,
    )
    let element = button(container, 'Remind')

    await act(() => element.click())

    assert.equal(node, element)
    assert.equal(clicks, 1)
    assert.equal(getComputedStyle(element).letterSpacing, '3px')
  })

  it('never submits its form unless it is a submit button, which sends its name and value', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <input name="customer" value="Acme Labs" />
        <Button>Preview</Button>
        <Button type="submit" name="intent" value="send">
          Send
        </Button>
      </form>,
    )
    let submissions = recordSubmissions(container.querySelector('form')!)

    await act(() => button(container, 'Preview').click())
    assert.deepEqual(submissions, [])

    await act(() => button(container, 'Send').click())
    assert.deepEqual(submissions, [{ customer: 'Acme Labs', intent: 'send' }])
  })

  it('keeps submitter overrides on the native button', async (t) => {
    let { container } = mount(
      t,
      <form action="/reminders" method="post">
        <Button type="submit" formAction="/reminders/schedule" formMethod="get" formNoValidate>
          Schedule
        </Button>
      </form>,
    )
    let schedule = button(container, 'Schedule')

    assert.equal(new URL(schedule.formAction).pathname, '/reminders/schedule')
    assert.equal(schedule.formMethod, 'get')
    assert.equal(schedule.formNoValidate, true)
  })

  it('resets its form when it is a reset button', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <input name="note" defaultValue="Pay by Friday" />
        <Button type="reset">Clear</Button>
      </form>,
    )
    let note = container.querySelector('input')!
    note.value = 'Changed'

    await act(() => button(container, 'Clear').click())

    assert.equal(note.value, 'Pay by Friday')
  })

  it('reads changing props on every render', async (t) => {
    let { container, root } = mount(t, <Button>Save</Button>)
    let element = button(container, 'Save')
    let defaultClass = element.className

    root.render(
      <Button variant="outline" size="sm" type="submit" disabled>
        Saved
      </Button>,
    )
    root.flush()

    assert.equal(button(container, 'Saved'), element)
    assert.equal(element.dataset.variant, 'outline')
    assert.equal(element.dataset.size, 'sm')
    assert.equal(element.type, 'submit')
    assert.equal(element.disabled, true)
    assert.notEqual(element.className, defaultClass)
  })

  it('ignores clicks while natively disabled', async (t) => {
    let clicks = 0
    let { container, act } = mount(
      t,
      <Button disabled mix={on('click', () => void clicks++)}>
        Archive
      </Button>,
    )

    await act(() => button(container, 'Archive').click())

    assert.equal(clicks, 0)
  })

  it('keeps focus while disabled once hydrated, and cancels clicks until enabled again', async (t) => {
    let clicks = 0
    let form = (disabled: boolean) => (
      <form>
        <Button type="submit" focusableWhenDisabled disabled={disabled} mix={on('click', () => void clicks++)}>
          Save
        </Button>
      </form>
    )
    let { container, root, act } = mount(t, form(false))
    let submissions = recordSubmissions(container.querySelector('form')!)
    let save = button(container, 'Save')
    save.focus()

    await act(() => root.render(form(true)))

    assert.equal(document.activeElement, save)
    assert.equal(save.disabled, false)
    assert.equal(save.getAttribute('aria-disabled'), 'true')

    await act(() => save.click())
    assert.equal(clicks, 0)
    assert.deepEqual(submissions, [])

    await act(() => root.render(form(false)))
    await act(() => save.click())

    assert.equal(save.hasAttribute('aria-disabled'), false)
    assert.equal(clicks, 1)
    assert.equal(submissions.length, 1)
  })

  it('cancels clicks while you mark it aria-disabled yourself', async (t) => {
    let clicks = 0
    let { container, act } = mount(
      t,
      <form>
        <Button type="submit" aria-disabled="true" mix={on('click', () => void clicks++)}>
          Pay
        </Button>
      </form>,
    )
    let submissions = recordSubmissions(container.querySelector('form')!)
    await act(() => {})

    await act(() => button(container, 'Pay').click())

    assert.equal(button(container, 'Pay').disabled, false)
    assert.equal(clicks, 0)
    assert.deepEqual(submissions, [])
  })

  it('keeps focus when you mark a focused button aria-disabled', async (t) => {
    let pay = (ariaDisabled: boolean) => (
      <Button type="submit" aria-disabled={ariaDisabled ? 'true' : undefined}>
        Pay
      </Button>
    )
    let { container, root, act } = mount(t, pay(false))
    let element = button(container, 'Pay')
    element.focus()
    // The browser drops focus from a disabled element only when it next renders,
    // so watch the attribute: even a passing native disabled would drop it there.
    let changes: MutationRecord[] = []
    let observer = new MutationObserver((records) => changes.push(...records))
    observer.observe(element, { attributeFilter: ['disabled'] })

    await act(() => root.render(pay(true)))

    changes.push(...observer.takeRecords())
    observer.disconnect()
    assert.equal(changes.length, 0)
    assert.equal(document.activeElement, element)
    assert.equal(element.getAttribute('aria-disabled'), 'true')
  })

  it('keeps the state of each instance apart', async (t) => {
    let clicks: string[] = []
    let { container, act } = mount(
      t,
      <div>
        <Button focusableWhenDisabled disabled mix={on('click', () => void clicks.push('first'))}>
          First
        </Button>
        <Button focusableWhenDisabled mix={on('click', () => void clicks.push('second'))}>
          Second
        </Button>
      </div>,
    )
    await act(() => {})

    await act(() => button(container, 'First').click())
    await act(() => button(container, 'Second').click())

    assert.equal(button(container, 'First').getAttribute('aria-disabled'), 'true')
    assert.equal(button(container, 'Second').hasAttribute('aria-disabled'), false)
    assert.deepEqual(clicks, ['second'])
  })

  it("ends the caller's ref signal when the button is removed", async (t) => {
    let signal: AbortSignal | undefined
    let { cleanup } = mount(t, <Button mix={ref((_element, refSignal) => (signal = refSignal))}>Close</Button>)

    assert.equal(signal?.aborted, false)
    cleanup()

    assert.equal(signal?.aborted, true)
  })

  it("leaves a native link's click to the browser, so it follows its href", async (t) => {
    let { container } = mount(
      t,
      <a href="#invoices" mix={buttonVariants({ variant: 'link' })}>
        Invoices
      </a>,
    )
    let link = container.querySelector('a')!
    // A document listener runs after the link's own: it records whether they
    // cancelled the click, then stops the navigation, which the e2e test covers.
    let cancelled: boolean | undefined
    let record = (event: Event) => {
      cancelled = event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', record)
    t.after(() => document.removeEventListener('click', record))

    link.click()

    assert.equal(cancelled, false)
    assert.equal(link.getAttribute('href'), '#invoices')
  })
})
