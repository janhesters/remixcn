import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Switch } from './switch.tsx'

function thumbOffset(container: Element) {
  let input = container.querySelector('input') as HTMLInputElement
  let thumb = container.querySelector('[data-slot="switch-thumb"]') as HTMLElement
  return thumb.getBoundingClientRect().left - input.getBoundingClientRect().left
}

describe('Switch in the browser', () => {
  it('turns on from its label and moves the thumb to the end', async (t) => {
    let { $, act, container, cleanup } = render(
      <div>
        <Switch id="airplane" />
        <label for="airplane">Airplane mode</label>
      </div>,
    )
    t.after(cleanup)
    let off = thumbOffset(container)

    await act(() => ($('label') as HTMLLabelElement).click())

    assert.equal(($('input') as HTMLInputElement).checked, true)
    // 32px track, 16px thumb and 1px borders: the thumb moves 14px.
    assert.equal(Math.round(thumbOffset(container) - off), 14)
  })

  it('moves the thumb the other way in right-to-left text', async (t) => {
    let { $, act, container, cleanup } = render(
      <div dir="rtl">
        <Switch aria-label="Bluetooth" />
      </div>,
    )
    t.after(cleanup)
    let off = thumbOffset(container)

    await act(() => ($('input') as HTMLInputElement).click())

    assert.equal(Math.round(thumbOffset(container) - off), -14)
  })

  it('draws the small size smaller', async (t) => {
    let { $$, cleanup } = render(
      <div>
        <Switch aria-label="Small" size="sm" />
        <Switch aria-label="Default" />
      </div>,
    )
    t.after(cleanup)
    let [small, regular] = [...$$('input')].map((input) => input.getBoundingClientRect())

    assert.deepEqual([small.width, regular.width], [24, 32])
    assert.ok(small.height < regular.height)
  })

  it('submits its value while on, ignores clicks while disabled, and resets to its default', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <Switch name="wifi" defaultChecked />
        <Switch name="bluetooth" value="enabled" />
        <Switch name="nfc" disabled />
      </form>,
    )
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    let [wifi, bluetooth, nfc] = [...form.querySelectorAll('input')]

    assert.deepEqual([...new FormData(form)], [['wifi', 'on']])
    await act(() => {
      wifi.click()
      bluetooth.click()
      nfc.click()
    })
    assert.deepEqual([...new FormData(form)], [['bluetooth', 'enabled']])
    assert.equal(nfc.checked, false)

    form.reset()
    assert.deepEqual([...new FormData(form)], [['wifi', 'on']])
  })

  it('follows a controlled checked prop and reports changes through native change events', async (t) => {
    function Setting(handle: Handle) {
      let enabled = true
      return () => (
        <Switch
          aria-label="Share across devices"
          checked={enabled}
          mix={on('change', (event) => {
            enabled = event.currentTarget.checked
            handle.update()
          })}
        />
      )
    }
    let { $, act, cleanup } = render(<Setting />)
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    await act(() => input.click())
    assert.equal(input.checked, false)

    await act(() => input.click())
    assert.equal(input.checked, true)
  })

  it('updates when its props change', async (t) => {
    let { $, root, cleanup } = render(<Switch aria-label="Focus" checked={false} />)
    t.after(cleanup)
    let input = $('input') as HTMLInputElement

    root.render(<Switch aria-label="Focus" checked size="sm" />)
    root.flush()

    assert.equal(input.checked, true)
    assert.equal(input.getBoundingClientRect().width, 24)
  })
})
