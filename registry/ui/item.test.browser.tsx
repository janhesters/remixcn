import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from './item.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function row(width: string) {
  return (
    <div style={{ width, '--spacing': '4px', fontSize: '14px' }}>
      <Item variant="outline">
        <ItemMedia variant="image">
          <span style={{ display: 'block', width: '40px', height: '40px' }} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Quarterly revenue report</ItemTitle>
        </ItemContent>
        <ItemActions>
          <button type="button">Open</button>
        </ItemActions>
      </Item>
    </div>
  )
}

describe('Item in the browser', () => {
  it('keeps media, content and actions on one row when they fit', async (t) => {
    let { container } = mount(t, row('480px'))
    let media = container.querySelector('[data-slot="item-media"]')!.getBoundingClientRect()
    let content = container.querySelector('[data-slot="item-content"]')!.getBoundingClientRect()
    let actions = container.querySelector('[data-slot="item-actions"]')!.getBoundingClientRect()

    assert.ok(content.left > media.right && actions.left > content.right)
    assert.ok(Math.abs(content.top - media.top) < 20)
  })

  it('wraps the content onto a line of its own instead of squeezing it on a narrow row', async (t) => {
    let { container } = mount(t, row('180px'))
    let content = container.querySelector<HTMLElement>('[data-slot="item-content"]')!
    let title = container.querySelector<HTMLElement>('[data-slot="item-title"]')!

    assert.ok(content.getBoundingClientRect().width >= 128, `${content.getBoundingClientRect().width}px`)
    assert.ok(title.scrollWidth <= title.clientWidth)
  })
})
