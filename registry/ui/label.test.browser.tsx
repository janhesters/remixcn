import { css, on } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Label } from './label.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function label(container: HTMLElement, name: string) {
  let found = [...container.querySelectorAll('label')].find((element) => element.textContent?.trim() === name)
  assert.ok(found instanceof HTMLLabelElement, `no label named ${name}`)
  return found
}

describe('Label in the browser', () => {
  it('names its control and focuses it on a click, through for or by wrapping it', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <Label for="label-test-number">Invoice number</Label>
        <input id="label-test-number" name="number" />
        <Label>
          <input type="checkbox" name="remind" />
          Remind the customer
        </Label>
      </form>,
    )
    let input = container.querySelector<HTMLInputElement>('#label-test-number')!
    let checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!

    assert.deepEqual(
      [...input.labels!].map((element) => element.textContent),
      ['Invoice number'],
    )
    await act(() => label(container, 'Invoice number').click())
    assert.equal(document.activeElement, input)

    await act(() => label(container, 'Remind the customer').click())
    assert.equal(checkbox.checked, true)
  })

  it('dims beside a disabled control, around one, and in a disabled fieldset or field', async (t) => {
    let { container } = mount(
      t,
      <div>
        <input type="checkbox" id="label-test-archived" disabled />
        <Label for="label-test-archived">Archived</Label>
        <Label>
          <input type="checkbox" disabled />
          Locked
        </Label>
        <fieldset disabled>
          <Label for="label-test-plan">Plan</Label>
          <input id="label-test-plan" />
        </fieldset>
        <div data-slot="field" data-disabled="true">
          <Label for="label-test-company">Company</Label>
          <input id="label-test-company" disabled />
        </div>
        <Label for="label-test-name">Name</Label>
        <input id="label-test-name" />
      </div>,
    )
    let opacity = (name: string) => getComputedStyle(label(container, name)).opacity

    assert.equal(opacity('Archived'), '0.5')
    assert.equal(opacity('Locked'), '0.5')
    assert.equal(opacity('Plan'), '0.5')
    assert.equal(opacity('Company'), '0.5')
    assert.equal(opacity('Name'), '1')
  })

  it("runs the caller's events and styles on the native label", async (t) => {
    let clicks = 0
    let { container, act } = mount(
      t,
      <Label mix={[on('click', () => void clicks++), css({ letterSpacing: '3px' })]}>Due date</Label>,
    )
    let element = label(container, 'Due date')

    await act(() => element.click())

    assert.equal(clicks, 1)
    assert.equal(getComputedStyle(element).letterSpacing, '3px')
  })
})
