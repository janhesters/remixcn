import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags } from '../../test/html.ts'

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarShortcut,
  MenubarTrigger,
} from './menubar.tsx'

function App() {
  return () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New invoice <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup defaultValue="month">
            <MenubarRadioItem value="month">By month</MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

describe('Menubar on the server', () => {
  it('renders a menubar of menu buttons with the menuitem role', async () => {
    let html = await renderToString(<App />)
    let menubar = attributes(html, 'slot:menubar')
    let triggers = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'menubar-trigger')
    let contents = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'menubar-content')

    assert.equal(menubar.get('role'), 'menubar')
    assert.equal(menubar.get('aria-orientation'), 'horizontal')
    assert.ok(menubar.has('data-modal'))
    assert.equal(triggers.length, 2)
    for (let [index, trigger] of triggers.entries()) {
      assert.equal(trigger.name, 'button')
      assert.equal(trigger.attributes.get('role'), 'menuitem')
      assert.equal(trigger.attributes.get('aria-haspopup'), 'menu')
      assert.equal(trigger.attributes.get('popovertarget'), contents[index].attributes.get('id'))
      assert.equal(contents[index].attributes.get('aria-labelledby'), trigger.attributes.get('id'))
    }
  })

  it('names the parts inside its menus after the menubar family', async () => {
    let html = await renderToString(<App />)
    let slots = tags(html).map((tag) => tag.attributes.get('data-slot'))

    for (let slot of ['menubar-item', 'menubar-shortcut', 'menubar-radio-group', 'menubar-radio-item']) {
      assert.ok(slots.includes(slot), `no ${slot}`)
    }
  })
})
