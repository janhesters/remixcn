import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slotTag, slots, tags } from '../../test/html.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  dropdownMenuTrigger,
} from './dropdown-menu.tsx'

function ThemePicker() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Theme</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup aria-label="Theme" defaultValue="dark">
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('Dropdown Menu on the server', () => {
  it('lets the trigger open the menu natively until the browser runs it', async () => {
    let html = await renderToString(<ThemePicker />)
    let trigger = attributes(html, 'slot:dropdown-menu-trigger')
    let content = attributes(html, 'slot:dropdown-menu-content')

    assert.equal(slotTag(html, 'dropdown-menu-trigger'), 'button')
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('aria-haspopup'), 'menu')
    assert.equal(trigger.get('popovertarget'), content.get('id'))
    assert.equal(trigger.get('aria-controls'), content.get('id'))
    assert.equal(trigger.has('aria-expanded'), false, 'the browser reports a popovertarget button itself')

    assert.equal(content.get('role'), 'menu')
    assert.equal(content.get('popover'), 'auto')
    assert.equal(content.get('aria-labelledby'), trigger.get('id'))
    assert.ok(content.has('data-closed'))
  })

  it('renders the choices as radio buttons that submit no form, with a check on the chosen one', async () => {
    let html = await renderToString(<ThemePicker />)
    let items = tags(html).filter((tag) => tag.attributes.get('role') === 'menuitemradio')
    assert.deepEqual(
      items.map((tag) => [tag.name, tag.attributes.get('type'), tag.attributes.get('aria-checked')]),
      [
        ['button', 'button', 'false'],
        ['button', 'button', 'true'],
        ['button', 'button', 'false'],
      ],
    )
    assert.deepEqual(
      slots(html, 'dropdown-menu-radio-item').map((item) => item.has('data-checked')),
      [false, true, false],
    )
    let indicators = html.split('data-slot="dropdown-menu-radio-item-indicator"').slice(1)
    assert.deepEqual(
      indicators.map((rest) => rest.slice(0, rest.indexOf('</span>')).includes('<svg')),
      [false, true, false],
    )
    let group = attributes(html, 'slot:dropdown-menu-radio-group')
    assert.equal(group.get('role'), 'group')
    assert.equal(group.get('aria-label'), 'Theme')
  })

  it('takes the value of a group you control', async () => {
    let html = await renderToString(
      <DropdownMenu>
        <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="system">
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    assert.deepEqual(
      slots(html, 'dropdown-menu-radio-item').map((item) => item.get('aria-checked')),
      ['false', 'true'],
    )
  })

  it('makes any element a trigger with the mixin, keeping its own id', async () => {
    let html = await renderToString(
      <DropdownMenu>
        <button type="button" id="theme" mix={dropdownMenuTrigger()}>
          Theme
        </button>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    let trigger = attributes(html, 'button')
    assert.equal(trigger.get('id'), 'theme')
    assert.equal(trigger.get('aria-haspopup'), 'menu')
    assert.ok(trigger.get('popovertarget'))
  })

  it('refuses parts outside a menu, and a choice outside a radio group', async () => {
    await assert.rejects(
      () => renderToString(<DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>),
      /inside a DropdownMenu/,
    )
    await assert.rejects(
      () =>
        renderToString(
          <DropdownMenu>
            <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            </DropdownMenuContent>
          </DropdownMenu>,
        ),
      /inside a DropdownMenuRadioGroup/,
    )
  })
})
