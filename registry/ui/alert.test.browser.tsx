import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Alert, AlertAction, AlertDescription, AlertTitle } from './alert.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function box(container: HTMLElement, slot: string) {
  return container.querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect()
}

function alertWithAction(width: string) {
  return (
    <div style={{ width, '--spacing': '4px', fontSize: '14px' }}>
      <Alert>
        <svg width="16" height="16" aria-hidden="true" />
        <AlertTitle>Bank feed disconnected</AlertTitle>
        <AlertDescription>New payments won't match their invoices until you reconnect.</AlertDescription>
        <AlertAction>
          <button type="button">Reconnect</button>
        </AlertAction>
      </Alert>
    </div>
  )
}

describe('Alert in the browser', () => {
  it('puts the action in the end corner when the alert has room, and keeps the text clear of it', async (t) => {
    let { container } = mount(t, alertWithAction('480px'))
    let title = box(container, 'alert-title')
    let description = box(container, 'alert-description')
    let action = box(container, 'alert-action')

    assert.ok(action.top < title.bottom, 'the action sits beside the title')
    assert.ok(action.left >= description.right, 'the text stops before the action')
  })

  it('moves the action under the text in a narrow alert, so the text keeps its width', async (t) => {
    let { container } = mount(t, alertWithAction('240px'))
    let title = box(container, 'alert-title')
    let description = box(container, 'alert-description')
    let action = box(container, 'alert-action')

    assert.ok(action.top >= description.bottom, `action at ${action.top}, text ends at ${description.bottom}`)
    assert.equal(Math.round(action.left), Math.round(title.left))
    let alert = box(container, 'alert')
    // Only the alert's padding and the icon column sit beside the text.
    assert.ok(alert.right - title.right <= 17, `${alert.right - title.right}px after the title`)
  })

  it('breaks a long word instead of letting it run out of the alert', async (t) => {
    let { container } = mount(
      t,
      <div style={{ width: '120px' }}>
        <Alert>
          <AlertTitle>Reminderschedulingfailedagain</AlertTitle>
        </Alert>
      </div>,
    )
    let title = container.querySelector('[data-slot="alert-title"]')!

    assert.ok(title.scrollWidth <= title.clientWidth)
  })
})
