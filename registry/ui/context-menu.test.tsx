import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags } from '../../test/html.ts'

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './context-menu.tsx'

function Invoice() {
  return () => (
    <ContextMenu>
      <ContextMenuTrigger>Invoice INV-2041</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuCheckboxItem defaultChecked>Pinned</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Archive</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}

describe('ContextMenu on the server', () => {
  it('renders the trigger area and a closed menu that only the script opens', async () => {
    let html = await renderToString(<Invoice />)
    let trigger = attributes(html, 'slot:context-menu-trigger')
    let content = attributes(html, 'slot:context-menu-content')

    assert.equal(tags(html).find((tag) => tag.attributes.get('data-slot') === 'context-menu-trigger')?.name, 'div')
    assert.ok(!trigger.has('aria-haspopup'), 'the area is no button')
    assert.ok(!trigger.has('data-popup-open'))
    assert.equal(content.get('role'), 'menu')
    assert.ok(content.has('data-closed'))
    assert.ok(!content.has('aria-labelledby'), 'no button names it')
  })

  it('names every part after the context menu family', async () => {
    let html = await renderToString(<Invoice />)
    let slots = tags(html).map((tag) => tag.attributes.get('data-slot'))

    for (let slot of [
      'context-menu-item',
      'context-menu-checkbox-item',
      'context-menu-checkbox-item-indicator',
      'context-menu-separator',
      'context-menu-sub-trigger',
      'context-menu-sub-content',
    ]) {
      assert.ok(slots.includes(slot), `no ${slot}`)
    }
    assert.ok(!slots.some((slot) => slot?.startsWith('dropdown-menu')))
  })
})
