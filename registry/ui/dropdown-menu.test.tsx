import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags } from '../../test/html.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  dropdownMenuTrigger,
} from './dropdown-menu.tsx'

function slot(html: string, name: string, index = 0) {
  let found = tags(html).filter((tag) => tag.attributes.get('data-slot') === name)[index]
  assert.ok(found, `no ${name} at ${index}`)
  return found
}

function Account() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Account</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuItem>
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Billing</DropdownMenuItem>
          <DropdownMenuItem inset variant="destructive">
            Delete
          </DropdownMenuItem>
          <DropdownMenuLinkItem href="/settings">Settings</DropdownMenuLinkItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem defaultChecked>Status bar</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false}>Activity bar</DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup defaultValue="bottom">
          <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Invite</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Email</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu on the server', () => {
  it('renders a menu button that opens the menu natively until the browser runs it', async () => {
    let html = await renderToString(<Account />)
    let trigger = attributes(html, 'slot:dropdown-menu-trigger')
    let content = attributes(html, 'slot:dropdown-menu-content')
    let id = content.get('id')

    assert.ok(id)
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('data-variant'), 'outline', "the Button's styles stay")
    assert.equal(trigger.get('aria-haspopup'), 'menu')
    assert.equal(trigger.get('aria-controls'), id)
    assert.equal(trigger.get('popovertarget'), id)
    // The browser reports the expanded state of a popovertarget button itself.
    assert.ok(!trigger.has('aria-expanded'))
    assert.equal(content.get('role'), 'menu')
    assert.equal(content.get('popover'), 'auto')
    assert.equal(content.get('aria-labelledby'), trigger.get('id'))
    assert.equal(content.get('tabindex'), '-1')
    assert.ok(content.has('data-closed'))
  })

  it('renders items with their roles, states and slots', async () => {
    let html = await renderToString(<Account />)
    let [profile, billing, remove] = tags(html).filter(
      (tag) => tag.attributes.get('data-slot') === 'dropdown-menu-item',
    )

    assert.equal(profile.name, 'div')
    assert.equal(profile.attributes.get('role'), 'menuitem')
    assert.equal(profile.attributes.get('tabindex'), '-1')
    assert.equal(profile.attributes.get('data-variant'), 'default')
    assert.ok(!profile.attributes.has('aria-disabled'))
    assert.equal(billing.attributes.get('aria-disabled'), 'true')
    assert.ok(billing.attributes.has('data-disabled'))
    assert.equal(remove.attributes.get('data-variant'), 'destructive')
    assert.ok(remove.attributes.has('data-inset'))
    assert.equal(slot(html, 'dropdown-menu-shortcut').name, 'span')
    assert.equal(slot(html, 'dropdown-menu-separator').attributes.get('role'), 'separator')
  })

  it('renders a link item as a link that Tab reaches without JavaScript', async () => {
    let html = await renderToString(<Account />)
    let link = slot(html, 'dropdown-menu-link-item')

    assert.equal(link.name, 'a')
    assert.equal(link.attributes.get('role'), 'menuitem')
    assert.equal(link.attributes.get('href'), '/settings')
    assert.ok(!link.attributes.has('tabindex'))
  })

  it('names a group by its label', async () => {
    let html = await renderToString(<Account />)
    let group = slot(html, 'dropdown-menu-group').attributes
    let label = slot(html, 'dropdown-menu-label').attributes

    assert.equal(group.get('role'), 'group')
    assert.ok(label.get('id'))
    assert.equal(group.get('aria-labelledby'), label.get('id'))
  })

  it('checks checkbox and radio items from their props', async () => {
    let html = await renderToString(<Account />)
    let [status, activity] = tags(html).filter(
      (tag) => tag.attributes.get('data-slot') === 'dropdown-menu-checkbox-item',
    )
    let [top, bottom] = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'dropdown-menu-radio-item')

    assert.equal(status.attributes.get('role'), 'menuitemcheckbox')
    assert.equal(status.attributes.get('aria-checked'), 'true')
    assert.ok(status.attributes.has('data-checked'))
    assert.equal(activity.attributes.get('aria-checked'), 'false')
    assert.ok(activity.attributes.has('data-unchecked'))
    assert.equal(slot(html, 'dropdown-menu-radio-group').attributes.get('role'), 'group')
    assert.equal(top.attributes.get('role'), 'menuitemradio')
    assert.equal(top.attributes.get('aria-checked'), 'false')
    assert.equal(bottom.attributes.get('aria-checked'), 'true')
    // Only a checked item shows its indicator's check.
    let indicators = [
      ...html.matchAll(/data-slot="dropdown-menu-(?:checkbox|radio)-item-indicator"[^>]*>(.*?)<\/span>/g),
    ]
    assert.deepEqual(
      indicators.map(([, inner]) => inner.includes('<svg')),
      [true, false, false, true],
    )
  })

  it('renders a submenu whose trigger is an item of the outer menu', async () => {
    let html = await renderToString(<Account />)
    let trigger = slot(html, 'dropdown-menu-sub-trigger').attributes
    let content = slot(html, 'dropdown-menu-sub-content').attributes

    assert.equal(trigger.get('role'), 'menuitem')
    assert.equal(trigger.get('aria-haspopup'), 'menu')
    assert.equal(trigger.get('aria-expanded'), 'false')
    assert.equal(trigger.get('aria-controls'), content.get('id'))
    assert.equal(content.get('role'), 'menu')
    assert.equal(content.get('aria-labelledby'), trigger.get('id'))
    assert.notEqual(content.get('id'), attributes(html, 'slot:dropdown-menu-content').get('id'))
  })

  it('renders closed until the browser shows it, also when open or open by default', async () => {
    for (let node of [
      <DropdownMenu open>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    ]) {
      let html = await renderToString(node)
      assert.ok(!attributes(html, 'slot:dropdown-menu-trigger').has('data-popup-open'))
      assert.ok(attributes(html, 'slot:dropdown-menu-content').has('data-closed'))
    }
  })

  it("keeps the caller's trigger id, disables the trigger of a disabled menu, and gives each instance its own ids", async () => {
    let html = await renderToString(
      <div>
        <DropdownMenu>
          <button type="button" id="actions" mix={[buttonVariants({ variant: 'ghost' }), dropdownMenuTrigger()]}>
            Actions
          </button>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu disabled>
          <DropdownMenuTrigger>More</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    )
    let [styled, disabled] = tags(html).filter((tag) => tag.attributes.get('aria-haspopup') === 'menu')
    let contents = tags(html).filter((tag) => tag.attributes.get('role') === 'menu')

    assert.equal(styled.attributes.get('id'), 'actions')
    assert.equal(styled.attributes.get('data-slot'), 'button', "the Button's own slot stays")
    assert.equal(contents[0].attributes.get('aria-labelledby'), 'actions')
    assert.ok(disabled.attributes.has('disabled'))
    assert.ok(!disabled.attributes.has('popovertarget'))
    assert.equal(new Set(contents.map((content) => content.attributes.get('id'))).size, 2)
  })
})
