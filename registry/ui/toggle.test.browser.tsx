import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Toggle, ToggleChangeEvent, toggleChangeType } from './toggle.tsx'

function pressed(button: Element | null) {
  return button?.getAttribute('aria-pressed')
}

describe('Toggle in the browser', () => {
  it('flips aria-pressed on each click and reports the new state in a bubbling change event', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <div mix={on(toggleChangeType, (event) => void changes.push(event.pressed))}>
        <Toggle aria-label="Bold">B</Toggle>
      </div>,
    )
    t.after(cleanup)
    let button = $('button') as HTMLButtonElement

    await act(() => button.click())
    assert.equal(pressed(button), 'true')
    assert.equal(button.dataset.state, 'on')

    await act(() => button.click())
    assert.equal(pressed(button), 'false')
    assert.deepEqual(changes, [true, false])
  })

  it('keeps its state when a listener cancels the change', async (t) => {
    let { $, act, cleanup } = render(
      <Toggle aria-label="Bookmark" mix={on(toggleChangeType, (event) => event.preventDefault())} />,
    )
    t.after(cleanup)
    let button = $('button') as HTMLButtonElement

    await act(() => button.click())

    assert.equal(pressed(button), 'false')
  })

  it('follows a controlled pressed prop: the parent decides after each change event', async (t) => {
    function Formatting(handle: Handle) {
      let bold = false
      return () => (
        <div>
          <Toggle
            aria-label="Bold"
            pressed={bold}
            mix={on(toggleChangeType, (event) => {
              bold = event.pressed
              handle.update()
            })}
          />
          <Toggle aria-label="Locked" pressed={false} />
        </div>
      )
    }
    let { $$, act, cleanup } = render(<Formatting />)
    t.after(cleanup)
    let [bold, locked] = [...$$('button')]

    await act(() => {
      bold.click()
      locked.click()
    })

    assert.equal(pressed(bold), 'true')
    assert.equal(pressed(locked), 'false')
  })

  it('updates when its props change', async (t) => {
    let { $, root, cleanup } = render(<Toggle aria-label="Underline" pressed={false} />)
    t.after(cleanup)
    let button = $('button') as HTMLButtonElement

    root.render(<Toggle aria-label="Underline" pressed variant="outline" size="sm" disabled />)
    root.flush()

    assert.equal(pressed(button), 'true')
    assert.deepEqual([button.dataset.variant, button.dataset.size, button.disabled], ['outline', 'sm', true])
  })

  it('never submits a surrounding form and leaves no value in it', async (t) => {
    let submits = 0
    let { $, act, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <Toggle name="bold" value="yes" aria-label="Bold" />
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLButtonElement).click())

    assert.equal(submits, 0)
    assert.deepEqual([...new FormData($('form') as HTMLFormElement)], [])
  })

  it('ignores clicks while aria-disabled, and runs the caller’s own click handler otherwise', async (t) => {
    let clicks = 0
    let { $$, act, cleanup } = render(
      <div>
        <Toggle aria-label="Strike" aria-disabled="true" />
        <Toggle aria-label="Code" mix={on('click', () => void clicks++)} />
      </div>,
    )
    t.after(cleanup)
    let [strike, code] = [...$$('button')]

    await act(() => {
      strike.click()
      code.click()
    })

    assert.equal(pressed(strike), 'false')
    assert.deepEqual([pressed(code), clicks], ['true', 1])
  })

  it('works as many independent toggles', async (t) => {
    let { $$, act, cleanup } = render(
      <div>
        <Toggle aria-label="One" />
        <Toggle aria-label="Two" defaultPressed />
        <Toggle aria-label="Three" />
      </div>,
    )
    t.after(cleanup)
    let buttons = [...$$('button')]

    await act(() => buttons[0].click())

    assert.deepEqual(buttons.map(pressed), ['true', 'true', 'false'])
  })

  it('stops handling clicks once removed', async () => {
    let changes = 0
    let { $, cleanup } = render(<Toggle aria-label="Bold" />)
    let button = $('button') as HTMLButtonElement
    button.addEventListener(toggleChangeType, () => changes++)

    cleanup()
    button.click()

    assert.equal(changes, 0)
  })

  it('shows the pressed state with more than a color change', async (t) => {
    let { $, act, cleanup } = render(
      <div style={{ '--foreground': 'rgb(0, 0, 0)' }}>
        <Toggle aria-label="Bold" />
      </div>,
    )
    t.after(cleanup)
    let button = $('button') as HTMLButtonElement
    let before = getComputedStyle(button).boxShadow

    await act(() => button.click())

    assert.notEqual(getComputedStyle(button).boxShadow, before)
    assert.match(getComputedStyle(button).boxShadow, /inset/)
  })

  it('exposes its change event class for listeners that check the type', () => {
    let event = new ToggleChangeEvent(true)

    assert.deepEqual([event.type, event.pressed, event.bubbles, event.cancelable], [toggleChangeType, true, true, true])
  })
})
