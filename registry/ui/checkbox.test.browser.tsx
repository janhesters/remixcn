import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Checkbox } from './checkbox.tsx'

function shown(element: Element | null) {
  return element !== null && getComputedStyle(element).display !== 'none'
}

describe('Checkbox in the browser', () => {
  it('toggles from its label and shows the check only while checked', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <Checkbox id="terms" />
        <label for="terms">Accept the terms</label>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    assert.equal(shown($('[data-slot="checkbox-indicator"]')), false)
    await act(() => ($('label') as HTMLLabelElement).click())

    assert.equal(input.checked, true)
    assert.equal(shown($('[data-slot="checkbox-indicator"]')), true)
    assert.equal(shown($('[data-slot="checkbox-mixed-indicator"]')), false)
  })

  it('shows the mixed state without changing what the form submits', async (t) => {
    let { $, cleanup } = render(
      <form>
        <Checkbox name="all" value="yes" indeterminate />
      </form>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    assert.equal(input.indeterminate, true)
    assert.equal(input.matches(':indeterminate'), true)
    assert.equal(shown($('[data-slot="checkbox-mixed-indicator"]')), true)
    assert.equal(shown($('[data-slot="checkbox-indicator"]')), false)
    assert.equal(new FormData($('form') as HTMLFormElement).has('all'), false)
  })

  it('follows changes to checked and indeterminate', async (t) => {
    let { $, root, cleanup } = render(<Checkbox checked={false} indeterminate />)
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    root.render(<Checkbox checked indeterminate />)
    root.flush()
    assert.deepEqual([input.checked, input.indeterminate], [true, true])

    root.render(<Checkbox checked indeterminate={false} />)
    root.flush()
    assert.deepEqual([input.checked, input.indeterminate], [true, false])
    assert.equal(shown($('[data-slot="checkbox-indicator"]')), true)
  })

  it('leaves the mixed state alone when the caller passes none', async (t) => {
    let { $, root, cleanup } = render(<Checkbox />)
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    input.indeterminate = true
    root.render(<Checkbox checked />)
    root.flush()

    assert.equal(input.indeterminate, true)
  })

  it("tells the caller's change handler the new state, and clears the mixed state on a click", async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <Checkbox indeterminate mix={on('change', (event) => void changes.push(event.currentTarget.checked))} />,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    await act(() => input.click())

    assert.deepEqual(changes, [true])
    assert.equal(input.indeterminate, false)
  })

  it('stays controlled: a parent that owns checked decides the next state', async (t) => {
    function Terms(handle: Handle) {
      let accepted = false
      return () => (
        <Checkbox
          checked={accepted}
          mix={on('change', (event) => {
            accepted = event.currentTarget.checked
            handle.update()
          })}
        />
      )
    }
    function Locked() {
      return () => <Checkbox checked={false} />
    }

    let terms = render(<Terms />)
    t.after(terms.cleanup)
    await terms.act(() => (terms.$('input') as HTMLInputElement).click())
    assert.equal((terms.$('input') as HTMLInputElement).checked, true)

    let locked = render(<Locked />)
    t.after(locked.cleanup)
    let input = locked.$('input') as HTMLInputElement
    await locked.act(async () => {
      input.click()
      await Promise.resolve()
    })
    assert.equal(input.checked, false)
  })

  it('submits its value only while checked, skips a disabled box, and resets to its default', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <Checkbox name="reminders" value="email" defaultChecked />
        <Checkbox name="reminders" value="sms" />
        <Checkbox name="reminders" value="fax" defaultChecked disabled />
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    let [email, sms, fax] = [...form.querySelectorAll('input')]

    assert.deepEqual(new FormData(form).getAll('reminders'), ['email'])

    await act(() => {
      email.click()
      sms.click()
      fax.click()
    })
    assert.deepEqual(new FormData(form).getAll('reminders'), ['sms'])
    assert.equal(fax.checked, true)

    form.reset()
    assert.deepEqual(new FormData(form).getAll('reminders'), ['email'])
  })

  it('blocks a submission while a required box is unchecked', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <Checkbox name="terms" required />
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement

    assert.equal(form.checkValidity(), false)
    await act(() => ($('input') as HTMLInputElement).click())
    assert.equal(form.checkValidity(), true)
  })

  it('works as many independent boxes', async (t) => {
    let { $$, act, cleanup } = render(
      <div>
        <Checkbox aria-label="One" />
        <Checkbox aria-label="Two" indeterminate />
        <Checkbox aria-label="Three" defaultChecked />
      </div>,
    )
    t.after(cleanup)
    let [one, two, three] = [...$$('input')] as HTMLInputElement[]

    await act(() => one.click())

    assert.deepEqual(
      [one, two, three].map((input) => [input.checked, input.indeterminate]),
      [
        [true, false],
        [false, true],
        [true, false],
      ],
    )
  })

  it("fills the box with the theme's primary color once checked, and lets the caller's css apply", async (t) => {
    let { $, act, cleanup } = render(
      <div style={{ '--primary': 'rgb(0, 128, 0)' }}>
        <Checkbox mix={css({ width: '1.25rem' })} />
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    assert.equal(getComputedStyle(input).appearance, 'none')
    assert.equal(getComputedStyle(input).width, '20px')

    await act(() => input.click())
    assert.equal(getComputedStyle(input).backgroundColor, 'rgb(0, 128, 0)')
    assert.equal(getComputedStyle(input).borderTopColor, 'rgb(0, 128, 0)')
  })
})
