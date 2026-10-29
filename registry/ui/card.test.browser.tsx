import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Card, CardAction, CardDescription, CardHeader, CardTitle } from './card.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function box(container: HTMLElement, slot: string) {
  return container.querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect()
}

describe('Card in the browser', () => {
  it('puts the action in the end column, beside the title and the description', async (t) => {
    let { container } = mount(
      t,
      <div style={{ width: '320px', '--spacing': '4px' }}>
        <Card>
          <CardHeader>
            <CardTitle>Send a reminder</CardTitle>
            <CardDescription>Acme Labs gets an email with a link to pay.</CardDescription>
            <CardAction>
              <button type="button">Preview</button>
            </CardAction>
          </CardHeader>
        </Card>
      </div>,
    )
    let title = box(container, 'card-title')
    let description = box(container, 'card-description')
    let action = box(container, 'card-action')

    assert.ok(action.left >= title.right, `action at ${action.left}, title ends at ${title.right}`)
    assert.ok(action.left >= description.right)
    assert.equal(Math.round(action.top), Math.round(title.top))
    assert.equal(Math.round(box(container, 'card-header').right - action.right), 24)
  })
})
