import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags } from '../../test/html.ts'

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from './navigation-menu.tsx'

function Site() {
  return () => (
    <NavigationMenu aria-label="Main">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Invoices</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="/invoices" active>
              All invoices
            </NavigationMenuLink>
            <NavigationMenuLink href="/invoices/drafts">Drafts</NavigationMenuLink>
          </NavigationMenuContent>
          <NavigationMenuIndicator />
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="/reports" mix={navigationMenuTriggerStyle()}>
            Reports
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

describe('NavigationMenu on the server', () => {
  it('renders a nav landmark with a list, and links that work without JavaScript', async () => {
    let html = await renderToString(<Site />)
    let root = tags(html).find((tag) => tag.attributes.get('data-slot') === 'navigation-menu')!
    let links = tags(html, 'a')

    assert.equal(root.name, 'nav')
    assert.equal(root.attributes.get('aria-label'), 'Main')
    assert.equal(tags(html).find((tag) => tag.attributes.get('data-slot') === 'navigation-menu-list')?.name, 'ul')
    assert.equal(tags(html).filter((tag) => tag.attributes.get('data-slot') === 'navigation-menu-item').length, 2)
    assert.deepEqual(
      links.map((link) => link.attributes.get('href')),
      ['/invoices', '/invoices/drafts', '/reports'],
    )
    assert.ok(links.every((link) => !link.attributes.has('role') && !link.attributes.has('tabindex')))
  })

  it('marks the current page, and styles a link like the buttons on request', async () => {
    let html = await renderToString(<Site />)
    let [current, drafts, reports] = tags(html, 'a')

    assert.equal(current.attributes.get('aria-current'), 'page')
    assert.ok(current.attributes.has('data-active'))
    assert.ok(!drafts.attributes.has('aria-current'))
    assert.ok(reports.attributes.has('data-trigger-style'))
  })

  it('renders a button that opens its panel natively until the browser runs it', async () => {
    let html = await renderToString(<Site />)
    let trigger = attributes(html, 'slot:navigation-menu-trigger')
    let content = attributes(html, 'slot:navigation-menu-content')

    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('aria-controls'), content.get('id'))
    assert.equal(trigger.get('popovertarget'), content.get('id'))
    assert.ok(!trigger.has('aria-expanded'))
    assert.ok(!trigger.has('aria-haspopup'), 'a disclosure, not a menu button')
    assert.equal(content.get('popover'), 'auto')
    assert.ok(!content.has('role'))
    assert.ok(content.has('data-closed'))
    assert.equal(attributes(html, 'slot:navigation-menu-indicator').get('aria-hidden'), 'true')
  })

  it('renders every panel closed, also with a default value', async () => {
    let html = await renderToString(
      <NavigationMenu defaultValue="invoices">
        <NavigationMenuList>
          <NavigationMenuItem value="invoices">
            <NavigationMenuTrigger>Invoices</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/invoices">All invoices</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    )
    assert.ok(attributes(html, 'slot:navigation-menu-content').has('data-closed'))
    assert.ok(!attributes(html, 'slot:navigation-menu-trigger').has('data-popup-open'))
  })
})
