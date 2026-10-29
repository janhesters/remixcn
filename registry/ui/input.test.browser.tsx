import { css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Input } from './input.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// The browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  '--input': 'rgb(120, 120, 120)',
  '--ring': 'rgb(0, 0, 200)',
  '--destructive': 'rgb(200, 0, 0)',
  '--spacing': '4px',
  '--radius-md': '6px',
}

function input(container: HTMLElement, name: string) {
  let found = container.querySelector(`input[name="${name}"]`)
  assert.ok(found instanceof HTMLInputElement, `no input named ${name}`)
  return found
}

function formData(form: HTMLFormElement) {
  return [...new FormData(form)].map(([name, value]) => `${name}=${value instanceof File ? value.name : value}`)
}

// Shows an error on the email input and clears it again, as a form owner would.
function EmailWithError(handle: Handle) {
  let invalid = true

  return () => (
    <div>
      <Input
        name="email"
        type="email"
        defaultValue="ada@"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? 'input-test-hint input-test-error' : 'input-test-hint'}
      />
      <button
        type="button"
        mix={on('click', () => {
          invalid = !invalid
          void handle.update()
        })}
      >
        Toggle
      </button>
    </div>
  )
}

describe('Input in the browser', () => {
  it("runs the caller's events, refs and styles on the native input", async (t) => {
    let typed: string[] = []
    let node: HTMLInputElement | undefined
    let { container, act } = mount(
      t,
      <Input
        name="customer"
        mix={[
          ref((element) => (node = element)),
          on('input', (event) => void typed.push(event.currentTarget.value)),
          css({ letterSpacing: '3px' }),
        ]}
      />,
    )
    let element = input(container, 'customer')

    await act(() => {
      element.value = 'Acme'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })

    assert.equal(node, element)
    assert.deepEqual(typed, ['Acme'])
    assert.equal(getComputedStyle(element).letterSpacing, '3px')
  })

  it('draws the border in the input token, red when invalid, and dims when disabled', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Input name="name" />
        <Input name="email" aria-invalid={true} />
        <Input name="company" disabled />
      </div>,
    )

    assert.equal(getComputedStyle(input(container, 'name')).borderTopColor, 'rgb(120, 120, 120)')
    assert.equal(getComputedStyle(input(container, 'email')).borderTopColor, 'rgb(200, 0, 0)')
    assert.equal(getComputedStyle(input(container, 'company')).opacity, '0.5')
    assert.equal(getComputedStyle(input(container, 'company')).cursor, 'not-allowed')
  })

  it('submits, validates and resets as a native input, also from outside its form', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <form id="input-test-form">
          <Input name="customer" defaultValue="Acme Labs" />
          <Input name="email" type="email" required />
          <Input name="reference" defaultValue="INV-0042" readOnly />
          <Input name="company" defaultValue="Hidden Ltd" disabled />
        </form>
        <Input name="note" form="input-test-form" defaultValue="Outside" />
      </div>,
    )
    let form = container.querySelector('form')!
    let email = input(container, 'email')

    assert.equal(form.checkValidity(), false, 'a required input blocks the submission')
    assert.equal(email.validity.valueMissing, true)
    await act(() => {
      email.value = 'not an email'
    })
    assert.equal(email.validity.typeMismatch, true)
    await act(() => {
      email.value = 'ada@example.com'
    })
    assert.equal(form.checkValidity(), true)
    assert.deepEqual(formData(form), [
      'customer=Acme Labs',
      'email=ada@example.com',
      'reference=INV-0042',
      'note=Outside',
    ])

    await act(() => {
      input(container, 'customer').value = 'Changed'
      input(container, 'note').value = 'Changed too'
      form.reset()
    })
    assert.equal(input(container, 'customer').value, 'Acme Labs')
    assert.equal(input(container, 'note').value, 'Outside')
    assert.equal(email.value, '')
  })

  it('suggests the options of its datalist', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Input name="currency" list="input-test-currencies" />
        <datalist id="input-test-currencies">
          <option value="CHF" />
          <option value="EUR" />
        </datalist>
      </div>,
    )

    assert.equal(input(container, 'currency').list?.id, 'input-test-currencies')
  })

  it('writes a changing invalid state and description list, and removes them when the owner does', async (t) => {
    let { container, act } = mount(t, <EmailWithError />)
    let email = input(container, 'email')
    let toggle = container.querySelector('button')!

    assert.equal(email.getAttribute('aria-invalid'), 'true')
    assert.equal(email.getAttribute('aria-describedby'), 'input-test-hint input-test-error')

    await act(() => toggle.click())
    assert.equal(email.hasAttribute('aria-invalid'), false)
    assert.equal(email.getAttribute('aria-describedby'), 'input-test-hint')

    await act(() => toggle.click())
    assert.equal(email.getAttribute('aria-invalid'), 'true')
  })

  it('keeps what the user typed when the owner renders again with the same starting value', async (t) => {
    let { container, act } = mount(t, <EmailWithError />)
    let email = input(container, 'email')

    await act(() => {
      email.value = 'ada@example.com'
      email.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => container.querySelector('button')!.click())

    assert.equal(email.value, 'ada@example.com')
  })
})
