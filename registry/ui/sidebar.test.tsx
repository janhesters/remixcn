import { renderToString } from 'remix/component/server'
import type { RemixNode } from 'remix/component'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Collapsible, CollapsibleTrigger } from './collapsible.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarGroupLabelVariants,
  sidebarMenuButtonVariants,
} from './sidebar.tsx'
import type { SidebarProps, SidebarProviderProps } from './sidebar.tsx'

/** The data-slot of the element that directly holds the first element with this slot. */
function parentSlot(html: string, slot: string) {
  let stack: (string | undefined)[] = []
  let markup = html.replaceAll(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  for (let [tag, closing, name = '', rest = ''] of markup.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/g)) {
    if (closing) {
      stack.pop()
      continue
    }
    let own = rest.match(/data-slot="([^"]*)"/)?.[1]
    if (own === slot) return stack.at(-1)
    if (!['input', 'br', 'hr', 'img'].includes(name) && !tag.endsWith('/>')) stack.push(own)
  }
  throw new Error(`No ${slot} in ${html}`)
}

function bySlot(html: string, slot: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === slot)
}

function page(
  provider: Omit<SidebarProviderProps, 'children'> = {},
  sidebar: Omit<SidebarProps, 'children'> = {},
  menu?: RemixNode,
) {
  return renderToString(
    <SidebarProvider {...provider}>
      <Sidebar {...sidebar}>
        <SidebarHeader>Acme</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Billing</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menu ?? (
                  <SidebarMenuItem>
                    <SidebarMenuButton href="/invoices">Invoices</SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>Signed in</SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <h1>Invoices</h1>
      </SidebarInset>
    </SidebarProvider>,
  )
}

describe('Sidebar on the server', () => {
  it('renders an expanded sidebar beside a <main>, waiting for the browser', async () => {
    let html = await page()
    let wrapper = attributes(html, 'slot:sidebar-wrapper')
    let root = attributes(html, 'slot:sidebar')
    let container = attributes(html, 'slot:sidebar-container')
    let inner = attributes(html, 'slot:sidebar-inner')

    assert.ok(wrapper)
    assert.equal(root.get('data-state'), 'expanded')
    assert.equal(root.get('data-collapsible'), '')
    assert.equal(root.get('data-variant'), 'sidebar')
    assert.equal(root.get('data-side'), 'left')
    assert.ok(root.has('data-pending'))
    assert.ok(attributes(html, 'slot:sidebar-gap'))
    assert.equal(container.get('data-side'), 'left')
    assert.ok(container.get('id'))
    assert.equal(inner.get('data-sidebar'), 'sidebar')
    assert.ok(!inner.has('inert'))
    assert.equal(attributes(html, 'main').get('data-slot'), 'sidebar-inset')
    assert.match(text(html), /AcmeBillingInvoicesSigned in/)
  })

  it('renders the state, side and variant it is given, with the collapsible kind only while collapsed', async () => {
    let collapsed = attributes(await page({ defaultOpen: false }, { collapsible: 'icon' }), 'slot:sidebar')
    let controlled = attributes(
      await page({ open: true, defaultOpen: false }, { side: 'right', variant: 'floating' }),
      'slot:sidebar',
    )
    let offcanvas = attributes(await page({ open: false }), 'slot:sidebar')

    assert.equal(collapsed.get('data-state'), 'collapsed')
    assert.equal(collapsed.get('data-collapsible'), 'icon')
    assert.equal(controlled.get('data-state'), 'expanded')
    assert.equal(controlled.get('data-side'), 'right')
    assert.equal(controlled.get('data-variant'), 'floating')
    assert.equal(offcanvas.get('data-collapsible'), 'offcanvas')
  })

  it("keeps a collapsed sidebar's links in the server HTML, never inert, so they work before any script", async () => {
    let html = await page({ defaultOpen: false })

    assert.ok(!attributes(html, 'slot:sidebar-inner').has('inert'))
    assert.equal(attributes(html, 'a').get('href'), '/invoices')
  })

  it("puts the rail on the sidebar's edge outside the parts, out of the tab order", async () => {
    let html = await page()
    let slots = tags(html)
      .map((tag) => tag.attributes.get('data-slot'))
      .filter(Boolean)
    let rail = attributes(html, 'slot:sidebar-rail')

    assert.ok(slots.indexOf('sidebar-rail') > slots.indexOf('sidebar-footer'))
    assert.equal(rail.get('type'), 'button')
    assert.equal(rail.get('tabindex'), '-1')
    assert.equal(rail.get('aria-label'), 'Toggle Sidebar')
    assert.equal(rail.get('title'), 'Toggle Sidebar')
    assert.equal(parentSlot(html, 'sidebar-rail'), 'sidebar-container')
    assert.equal(parentSlot(html, 'sidebar-footer'), 'sidebar-inner')
  })

  it('renders a ghost icon trigger named Toggle Sidebar, without a state before it runs', async () => {
    let html = await page()
    let trigger = attributes(html, 'slot:sidebar-trigger')

    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('data-variant'), 'ghost')
    assert.equal(trigger.get('data-size'), 'icon-sm')
    assert.equal(trigger.get('data-sidebar'), 'trigger')
    assert.ok(!trigger.has('aria-expanded'))
    assert.ok(!trigger.has('aria-controls'))
    assert.match(text(html), /Toggle Sidebar/)
    assert.equal(attributes(html, 'svg').get('aria-hidden'), 'true')
  })

  it("lets a trigger's children replace its icon and name", async () => {
    let html = await renderToString(
      <SidebarProvider>
        <SidebarTrigger variant="outline">Menu</SidebarTrigger>
      </SidebarProvider>,
    )

    assert.equal(attributes(html, 'slot:sidebar-trigger').get('data-variant'), 'outline')
    assert.equal(text(html), 'Menu')
  })

  it('marks the current page on links and the active state on buttons', async () => {
    let html = await page(
      {},
      {},
      <>
        <SidebarMenuItem>
          <SidebarMenuButton href="/invoices" isActive>
            Invoices
          </SidebarMenuButton>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton href="/invoices/open" isActive size="sm">
                Open
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton isActive variant="outline" size="lg">
            Reports
          </SidebarMenuButton>
        </SidebarMenuItem>
      </>,
    )
    let [link, button] = bySlot(html, 'sidebar-menu-button').map((tag) => tag)
    let sub = attributes(html, 'slot:sidebar-menu-sub-button')

    assert.equal(link?.name, 'a')
    assert.equal(link?.attributes.get('aria-current'), 'page')
    assert.ok(link?.attributes.has('data-active'))
    assert.equal(link?.attributes.get('data-sidebar'), 'menu-button')
    assert.equal(button?.name, 'button')
    assert.equal(button?.attributes.get('type'), 'button')
    assert.ok(button?.attributes.has('data-active'))
    assert.ok(!button?.attributes.has('aria-current'))
    assert.equal(button?.attributes.get('data-variant'), 'outline')
    assert.equal(button?.attributes.get('data-size'), 'lg')
    assert.equal(sub.get('aria-current'), 'page')
    assert.equal(sub.get('data-size'), 'sm')
    assert.ok(sub.has('data-active'))
  })

  it("keeps the caller's aria-current and leaves inactive rows unmarked", async () => {
    let html = await page(
      {},
      {},
      <>
        <SidebarMenuItem>
          <SidebarMenuButton href="/2026" isActive aria-current="date">
            2026
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton href="/2025">2025</SidebarMenuButton>
        </SidebarMenuItem>
      </>,
    )
    let [current, other] = bySlot(html, 'sidebar-menu-button')

    assert.equal(current?.attributes.get('aria-current'), 'date')
    assert.ok(!other?.attributes.has('aria-current'))
    assert.ok(!other?.attributes.has('data-active'))
  })

  it('shows a tooltip for collapsed labels that repeats the name without describing the row twice', async () => {
    let html = await page(
      { defaultOpen: false },
      { collapsible: 'icon' },
      <SidebarMenuItem>
        <SidebarMenuButton href="/invoices" tooltip="Invoices">
          <span>Invoices</span>
        </SidebarMenuButton>
      </SidebarMenuItem>,
    )
    let row = attributes(html, 'slot:sidebar-menu-button')
    let tip = attributes(html, 'slot:tooltip-content')

    assert.equal(row.get('data-slot'), 'sidebar-menu-button')
    assert.ok(!row.has('aria-describedby'))
    assert.equal(tip.get('role'), 'tooltip')
    assert.equal(tip.get('aria-hidden'), 'true')
    assert.equal(tip.get('popover'), 'manual')
  })

  it('renders actions as buttons beside the row, never inside it', async () => {
    let html = await page(
      {},
      {},
      <SidebarMenuItem>
        <SidebarMenuButton href="/projects/atlas">Atlas</SidebarMenuButton>
        <SidebarMenuAction showOnHover>
          <span>More for Atlas</span>
        </SidebarMenuAction>
        <SidebarMenuBadge>12</SidebarMenuBadge>
      </SidebarMenuItem>,
    )
    let action = attributes(html, 'slot:sidebar-menu-action')

    assert.equal(action.get('type'), 'button')
    assert.ok(action.has('data-show-on-hover'))
    assert.equal(attributes(html, 'slot:sidebar-menu-badge').get('data-sidebar'), 'menu-badge')
    assert.doesNotMatch(html, /<a[^>]*>(?:(?!<\/a>).)*<button/s)
    assert.equal(
      tags(html, 'button').filter((tag) => tag.attributes.get('data-slot') === 'sidebar-menu-action').length,
      1,
    )
  })

  it('renders every part with its slot and native element', async () => {
    let html = await renderToString(
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <SidebarInput aria-label="Search" />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Projects</SidebarGroupLabel>
              <SidebarGroupAction>
                <span>Add project</span>
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu aria-busy="true">
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    )

    assert.equal(attributes(html, 'slot:sidebar-input').get('data-sidebar'), 'input')
    assert.equal(attributes(html, 'input').get('aria-label'), 'Search')
    assert.equal(attributes(html, 'slot:sidebar-separator').get('role'), 'separator')
    assert.equal(attributes(html, 'slot:sidebar-group-action').get('type'), 'button')
    assert.equal(tags(html, 'ul')[0]?.attributes.get('data-slot'), 'sidebar-menu')
    assert.equal(tags(html, 'li')[0]?.attributes.get('data-slot'), 'sidebar-menu-item')
    let skeleton = attributes(html, 'slot:sidebar-menu-skeleton')
    assert.equal(skeleton.get('aria-hidden'), 'true')
    assert.equal(bySlot(html, 'skeleton').length, 2)
    for (let slot of [
      'sidebar-header',
      'sidebar-content',
      'sidebar-group',
      'sidebar-group-label',
      'sidebar-group-content',
    ]) {
      assert.ok(bySlot(html, slot).length === 1, `no ${slot}`)
    }
  })

  it('renders a sidebar that never collapses as a plain column', async () => {
    let html = await renderToString(
      <SidebarProvider>
        <Sidebar collapsible="none" aria-label="Settings">
          <SidebarContent>Profile</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    )
    let root = attributes(html, 'slot:sidebar')

    assert.equal(root.get('aria-label'), 'Settings')
    assert.ok(!root.has('data-state'))
    assert.equal(bySlot(html, 'sidebar-container').length, 0)
  })

  it("lets other elements take the parts' looks, such as a summary that opens a group", async () => {
    let html = await renderToString(
      <details>
        <summary mix={sidebarGroupLabelVariants()}>Help</summary>
        <summary mix={sidebarMenuButtonVariants({ size: 'sm', isActive: true })}>Projects</summary>
      </details>,
    )
    let [label, button] = tags(html, 'summary')

    assert.equal(label?.attributes.get('data-slot'), 'sidebar-group-label')
    assert.equal(button?.attributes.get('data-slot'), 'sidebar-menu-button')
    assert.equal(button?.attributes.get('data-size'), 'sm')
    assert.ok(button?.attributes.has('data-active'))

    let collapsible = await renderToString(
      <Collapsible>
        <CollapsibleTrigger mix={sidebarMenuButtonVariants()}>Settings</CollapsibleTrigger>
      </Collapsible>,
    )
    let trigger = attributes(collapsible, 'button')
    assert.equal(trigger.get('data-sidebar'), 'menu-button')
    assert.equal(trigger.get('aria-expanded'), 'false')
  })

  it('gives every provider its own sidebar id', async () => {
    let html = await renderToString(
      <>
        <SidebarProvider>
          <Sidebar>Mail</Sidebar>
        </SidebarProvider>
        <SidebarProvider>
          <Sidebar>Calendar</Sidebar>
        </SidebarProvider>
      </>,
    )
    let ids = bySlot(html, 'sidebar-container').map((tag) => tag.attributes.get('id'))

    assert.equal(ids.length, 2)
    assert.notEqual(ids[0], ids[1])
  })

  it('says where a part belongs when it sits outside a provider', async () => {
    await assert.rejects(() => renderToString(<SidebarTrigger />), /SidebarTrigger must sit inside SidebarProvider/)
    await assert.rejects(() => renderToString(<Sidebar>Mail</Sidebar>), /Sidebar must sit inside SidebarProvider/)
  })
})
