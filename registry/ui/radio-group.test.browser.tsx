import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { RadioGroup, RadioGroupItem } from './radio-group.tsx'

function checkedValues(container: ParentNode) {
  return [...container.querySelectorAll('input')].filter((input) => input.checked).map((input) => input.value)
}

function shown(element: Element | null) {
  return element !== null && getComputedStyle(element).display !== 'none'
}

describe('Radio Group in the browser', () => {
  it('selects one radio at a time, also from its label, and shows the dot on it', async (t) => {
    let { $, act, container, cleanup } = render(
      <RadioGroup defaultValue="default" aria-label="Density">
        <RadioGroupItem value="default" id="density-default" />
        <RadioGroupItem value="compact" id="density-compact" />
        <label for="density-compact">Compact</label>
      </RadioGroup>,
    )
    t.after(cleanup)

    await act(() => ($('label') as HTMLLabelElement).click())

    assert.deepEqual(checkedValues(container), ['compact'])
    let dots = [...container.querySelectorAll('[data-slot="radio-group-indicator"]')].map(shown)
    assert.deepEqual(dots, [false, true])
  })

  it('keeps groups without names apart', async (t) => {
    let { $$, act, cleanup } = render(
      <div>
        <RadioGroup aria-label="Plan" defaultValue="free">
          <RadioGroupItem value="free" />
          <RadioGroupItem value="pro" />
        </RadioGroup>
        <RadioGroup aria-label="Billing" defaultValue="monthly">
          <RadioGroupItem value="monthly" />
          <RadioGroupItem value="yearly" />
        </RadioGroup>
      </div>,
    )
    t.after(cleanup)
    let [plan, billing] = [...$$('[role="radiogroup"]')]

    await act(() => (plan.querySelector('[value="pro"]') as HTMLInputElement).click())

    assert.deepEqual(checkedValues(plan), ['pro'])
    assert.deepEqual(checkedValues(billing), ['monthly'])
  })

  it('submits the selected value, resets to the default, and blocks submission while a required group is empty', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <RadioGroup name="plan" defaultValue="free" aria-label="Plan">
          <RadioGroupItem value="free" />
          <RadioGroupItem value="pro" />
        </RadioGroup>
        <RadioGroup name="billing" required aria-label="Billing">
          <RadioGroupItem value="monthly" />
          <RadioGroupItem value="yearly" />
        </RadioGroup>
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement

    assert.equal(form.checkValidity(), false)
    await act(() => {
      ;(form.querySelector('[value="pro"]') as HTMLInputElement).click()
      ;(form.querySelector('[value="yearly"]') as HTMLInputElement).click()
    })
    assert.equal(form.checkValidity(), true)
    assert.deepEqual(
      [...new FormData(form)],
      [
        ['plan', 'pro'],
        ['billing', 'yearly'],
      ],
    )

    form.reset()
    assert.deepEqual([...new FormData(form)], [['plan', 'free']])
  })

  it('leaves a disabled group out of the form and ignores clicks on it', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <RadioGroup name="battery" defaultValue="medium" disabled aria-label="Battery">
          <RadioGroupItem value="high" />
          <RadioGroupItem value="medium" />
        </RadioGroup>
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement

    await act(() => (form.querySelector('[value="high"]') as HTMLInputElement).click())

    assert.deepEqual(checkedValues(form), ['medium'])
    assert.deepEqual([...new FormData(form)], [])
  })

  it('follows a controlled value, and a parent that owns it updates from change events', async (t) => {
    function Plan(handle: Handle) {
      let plan = 'free'
      return () => (
        <RadioGroup
          aria-label="Plan"
          value={plan}
          mix={on('change', (event) => {
            plan = (event.target as HTMLInputElement).value
            handle.update()
          })}
        >
          <RadioGroupItem value="free" />
          <RadioGroupItem value="pro" />
          <output>{plan}</output>
        </RadioGroup>
      )
    }
    let { $, act, container, cleanup } = render(<Plan />)
    t.after(cleanup)

    await act(() => ($('[value="pro"]') as HTMLInputElement).click())

    assert.deepEqual(checkedValues(container), ['pro'])
    assert.equal($('output')?.textContent, 'pro')
  })

  it('keeps the controlled radio selected when its owner declines a change, so the form keeps its value', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <RadioGroup name="plan" value="free" required aria-label="Plan">
          <RadioGroupItem value="free" />
          <RadioGroupItem value="pro" />
        </RadioGroup>
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement

    await act(async () => {
      ;($('[value="pro"]') as HTMLInputElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    assert.deepEqual(checkedValues(form), ['free'])
    assert.deepEqual([...new FormData(form)], [['plan', 'free']])
    assert.equal(form.checkValidity(), true)
  })

  it('follows an owner that accepts the change from an ancestor', async (t) => {
    function Billing(handle: Handle) {
      let period = 'monthly'
      return () => (
        <div
          mix={on('change', (event) => {
            period = (event.target as HTMLInputElement).value
            handle.update()
          })}
        >
          <RadioGroup aria-label="Billing" value={period}>
            <RadioGroupItem value="monthly" />
            <RadioGroupItem value="yearly" />
          </RadioGroup>
        </div>
      )
    }
    let { $, act, container, cleanup } = render(<Billing />)
    t.after(cleanup)

    await act(async () => {
      ;($('[value="yearly"]') as HTMLInputElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    assert.deepEqual(checkedValues(container), ['yearly'])
  })

  it('updates the checked radio, disabled state and name when its props change', async (t) => {
    let group = (props: { value: string; disabled?: boolean; name?: string }) => (
      <RadioGroup aria-label="Size" {...props}>
        <RadioGroupItem value="small" />
        <RadioGroupItem value="large" />
      </RadioGroup>
    )
    let { root, container, cleanup } = render(group({ value: 'small' }))
    t.after(cleanup)

    root.render(group({ value: 'large', disabled: true, name: 'size' }))
    root.flush()

    let inputs = [...container.querySelectorAll('input')]
    assert.deepEqual(checkedValues(container), ['large'])
    assert.deepEqual(
      inputs.map((input) => [input.disabled, input.name]),
      [
        [true, 'size'],
        [true, 'size'],
      ],
    )
  })
})
