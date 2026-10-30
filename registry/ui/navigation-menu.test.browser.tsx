import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuValueChangeEvent,
  navigationMenuValueChangeType,
} from './navigation-menu.tsx'
import type { NavigationMenuProps, NavigationMenuValueChangeReason } from './navigation-menu.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function settle(ms = 20) {
  await wait(ms)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

function pointer(type: string, element: Element, at = center(element)) {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      ...at,
    }),
  )
}

function press(element: Element) {
  pointer('pointerdown', element)
  pointer('pointerup', element)
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...center(element) }))
}

function key(name: string, target: Element = document.activeElement ?? document.body) {
  let event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function focused() {
  return document.activeElement?.textContent?.trim() ?? ''
}

const at = css({ position: 'fixed', left: '100px', top: '100px', margin: 0 })

function Site(handle: Handle<Partial<NavigationMenuProps>>) {
  return () => (
    <div>
      <NavigationMenu aria-label="Main" {...handle.props} mix={[at, handle.props.mix]}>
        <NavigationMenuList>
          <NavigationMenuItem value="invoices">
            <NavigationMenuTrigger>Invoices</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="#all" active>
                All invoices
              </NavigationMenuLink>
              <NavigationMenuLink href="#drafts">Drafts</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="customers">
            <NavigationMenuTrigger>Customers</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="#customers">All customers</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="#reports">Reports</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuIndicator />
        </NavigationMenuList>
      </NavigationMenu>
      <button type="button">After</button>
    </div>
  )
}

function parts(container: ParentNode) {
  let trigger = (name: string) =>
    [...container.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"]')].find(
      (element) => element.textContent === name,
    )!
  let content = (name: string) => document.getElementById(trigger(name).getAttribute('aria-controls')!)!
  return { trigger, content }
}

function openPanels(container: ParentNode) {
  return [...container.querySelectorAll('[data-slot="navigation-menu-content"]:popover-open')].map(
    (content) => content.querySelector('a')?.textContent,
  )
}

describe('NavigationMenu in the browser', () => {
  it('opens a panel below its button on a click, and a second click closes it', async (t) => {
    let { container } = mount(t, <Site />)
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(trigger('Invoices').getAttribute('aria-expanded'), 'false')
    assert.ok(!trigger('Invoices').hasAttribute('popovertarget'))

    press(trigger('Invoices'))
    await settle()
    assert.deepEqual(openPanels(container), ['All invoices'])
    assert.equal(trigger('Invoices').getAttribute('aria-expanded'), 'true')
    let panel = content('Invoices').getBoundingClientRect()
    let button = trigger('Invoices').getBoundingClientRect()
    assert.equal(Math.round(panel.top), Math.round(button.bottom) + 8)
    assert.equal(Math.round(panel.left), Math.round(button.left))

    press(trigger('Invoices'))
    await settle()
    assert.deepEqual(openPanels(container), [])
  })

  it('opens on hover after a delay, switches at once to the next button, and closes once the pointer leaves', async (t) => {
    let { container } = mount(t, <Site delay={40} closeDelay={40} />)
    await settle()
    let { trigger } = parts(container)

    pointer('pointerenter', trigger('Invoices'))
    await wait(10)
    assert.deepEqual(openPanels(container), [])
    await settle(50)
    assert.deepEqual(openPanels(container), ['All invoices'])

    pointer('pointerleave', trigger('Invoices'), center(trigger('Customers')))
    pointer('pointerenter', trigger('Customers'))
    await settle()
    assert.deepEqual(openPanels(container), ['All customers'])
    assert.equal(
      document
        .querySelector('[data-slot="navigation-menu-content"][data-open]')
        ?.getAttribute('data-activation-direction'),
      'right',
    )

    // A click on a panel the pointer opened keeps it.
    press(trigger('Customers'))
    await settle()
    assert.deepEqual(openPanels(container), ['All customers'])

    pointer('pointerleave', trigger('Customers'), { clientX: 700, clientY: 600 })
    await settle(80)
    assert.deepEqual(openPanels(container), ['All customers'], 'a panel opened by press stays')
    press(trigger('Customers'))
    await settle()
    assert.deepEqual(openPanels(container), [])
  })

  it('never opens on focus, opens on Enter, moves into the panel with Arrow Down and back out with Escape', async (t) => {
    let { container } = mount(t, <Site />)
    await settle()
    let { trigger } = parts(container)

    trigger('Invoices').focus()
    await settle()
    assert.deepEqual(openPanels(container), [])

    trigger('Invoices').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    await settle()
    assert.deepEqual(openPanels(container), ['All invoices'])
    assert.equal(document.activeElement, trigger('Invoices'), 'focus stays on the button')

    key('ArrowDown')
    await settle()
    assert.equal(focused(), 'All invoices')
    key('ArrowDown')
    assert.equal(focused(), 'Drafts')
    key('ArrowDown')
    assert.equal(focused(), 'Drafts', 'stops at the last link')

    key('Escape')
    await settle()
    assert.deepEqual(openPanels(container), [])
    assert.equal(document.activeElement, trigger('Invoices'))

    // Arrow Down on a closed panel opens it and moves in.
    key('ArrowDown')
    await settle()
    assert.equal(focused(), 'All invoices')
  })

  it('moves between the buttons and links of the list with the arrows, Home and End', async (t) => {
    let { container } = mount(t, <Site />)
    await settle()
    let { trigger } = parts(container)

    trigger('Invoices').focus()
    key('ArrowRight')
    assert.equal(focused(), 'Customers')
    key('ArrowRight')
    assert.equal(focused(), 'Reports')
    key('Home')
    assert.equal(focused(), 'Invoices')
    key('End')
    assert.equal(focused(), 'Reports')
    key('ArrowLeft')
    assert.equal(focused(), 'Customers')
  })

  it('swaps the arrows in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div dir="rtl">
        <Site />
      </div>,
    )
    await settle()
    let { trigger } = parts(container)

    trigger('Invoices').focus()
    key('ArrowLeft')
    assert.equal(focused(), 'Customers')
    key('ArrowRight')
    assert.equal(focused(), 'Invoices')
  })

  it('closes when focus leaves the button and its panel, or on a press elsewhere', async (t) => {
    let { container } = mount(t, <Site />)
    await settle()
    let { trigger } = parts(container)
    let after = [...container.querySelectorAll('button')].find((button) => button.textContent === 'After')!

    trigger('Invoices').focus()
    press(trigger('Invoices'))
    await settle()
    after.focus()
    await settle()
    assert.deepEqual(openPanels(container), [])

    press(trigger('Invoices'))
    await settle()
    press(after)
    await settle()
    assert.deepEqual(openPanels(container), [])
  })

  it('reports each change with a reason, follows a value the app controls, and keeps it when canceled', async (t) => {
    let changes: Array<[string | null, NavigationMenuValueChangeReason]> = []
    function Controlled(handle: Handle) {
      let value: string | null = 'customers'
      return () => (
        <Site
          value={value}
          mix={on(navigationMenuValueChangeType, (event) => {
            assert.ok(event instanceof NavigationMenuValueChangeEvent)
            changes.push([event.value, event.reason])
            if (event.value === 'customers') return
            value = event.value
            void handle.update()
          })}
        />
      )
    }
    let { container } = mount(t, <Controlled />)
    await settle()
    let { trigger } = parts(container)
    assert.deepEqual(openPanels(container), ['All customers'])

    press(trigger('Customers'))
    await settle()
    assert.deepEqual(openPanels(container), [])
    press(trigger('Customers'))
    await settle()
    assert.deepEqual(openPanels(container), [], 'the app declines it')
    press(trigger('Invoices'))
    await settle()
    assert.deepEqual(openPanels(container), ['All invoices'])
    assert.deepEqual(changes, [
      [null, 'trigger-press'],
      ['customers', 'trigger-press'],
      ['invoices', 'trigger-press'],
    ])
  })

  it('never opens a panel on hover from a button a disabled fieldset disables, also while the delay runs', async (t) => {
    let { container } = mount(
      t,
      <div>
        <fieldset disabled>
          <Site />
        </fieldset>
        <fieldset>
          <NavigationMenu aria-label="Later" delay={60}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Billing</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <NavigationMenuLink href="#billing">Billing</NavigationMenuLink>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </fieldset>
      </div>,
    )
    await settle()
    let { trigger } = parts(container)

    pointer('pointerenter', trigger('Invoices'))
    await settle(80)
    assert.deepEqual(openPanels(container), [])

    let billing = trigger('Billing')
    pointer('pointerenter', billing)
    await wait(10)
    billing.closest('fieldset')!.disabled = true
    await settle(100)
    assert.deepEqual(openPanels(container), [], 'the delay finds it disabled')
  })

  it('closes on a link only when asked, and shows the indicator under the open button', async (t) => {
    // The page keeps the links from navigating, after the links ran.
    let { container } = mount(
      t,
      <div mix={on('click', (event) => event.preventDefault())}>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Invoices</NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink href="#all">All invoices</NavigationMenuLink>
                <NavigationMenuLink href="#drafts" closeOnClick>
                  Drafts
                </NavigationMenuLink>
              </NavigationMenuContent>
              <NavigationMenuIndicator />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let indicator = container.querySelector<HTMLElement>('[data-slot="navigation-menu-indicator"]')!
    assert.equal(getComputedStyle(indicator).visibility, 'hidden')

    press(trigger('Invoices'))
    await settle()
    assert.equal(getComputedStyle(indicator).visibility, 'visible')
    content('Invoices').querySelector<HTMLElement>('a[href="#all"]')!.click()
    await settle()
    assert.deepEqual(openPanels(container), ['All invoices'])
    content('Invoices').querySelector<HTMLElement>('a[href="#drafts"]')!.click()
    await settle()
    assert.deepEqual(openPanels(container), [])
  })
})
