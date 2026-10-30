import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  menuOpenChangeType,
} from './context-menu.tsx'
import type { ContextMenuProps, MenuOpenChangeReason } from './context-menu.tsx'

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

/** A right click at (x, y), as the browser sends its contextmenu event. Returns whether the native menu would show. */
function rightClick(x: number, y: number, target: Element = document.elementFromPoint(x, y) ?? document.body) {
  return target.dispatchEvent(
    new PointerEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 2,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    }),
  )
}

function touch(type: string, target: Element, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
    }),
  )
}

function key(name: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) {
  let event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function isOpen(content: Element) {
  return content.matches(':popover-open')
}

function focused() {
  return document.activeElement?.textContent?.trim() ?? ''
}

const areaStyles = css({ position: 'fixed', left: '100px', top: '100px', width: '400px', height: '200px', margin: 0 })

function Invoice(handle: Handle<ContextMenuProps & { onClickLink?: () => void }>) {
  return () => {
    let { onClickLink, ...props } = handle.props
    return (
      <ContextMenu {...props}>
        <ContextMenuTrigger mix={areaStyles}>
          <button type="button">INV-2041</button>
          <a href="#invoice" mix={on('click', (event) => (event.preventDefault(), onClickLink?.()))}>
            Open invoice
          </a>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Open</ContextMenuItem>
          <ContextMenuItem>Duplicate</ContextMenuItem>
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
}

function parts(container: ParentNode) {
  let trigger = container.querySelector<HTMLElement>('[data-slot="context-menu-trigger"]')
  let content = container.querySelector<HTMLElement>('[data-slot="context-menu-content"]')
  assert.ok(trigger && content, 'no context menu')
  return { trigger, content }
}

describe('ContextMenu in the browser', () => {
  it('opens at the pointer on a right click, instead of the browser menu', async (t) => {
    let { container } = mount(t, <Invoice />)
    await settle()
    let { trigger, content } = parts(container)

    let native = rightClick(250, 180)
    await settle()
    assert.equal(native, false, 'the browser menu stays away')
    assert.equal(isOpen(content), true)
    assert.ok(trigger.hasAttribute('data-popup-open'))
    let rect = content.getBoundingClientRect()
    assert.equal(Math.round(rect.left), 250)
    assert.equal(Math.round(rect.top), 184, 'four pixels below the pointer')
    assert.equal(document.activeElement, content)

    key('ArrowDown')
    assert.equal(focused(), 'Open')
    key('Escape')
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('stays on screen at the edges of the window', async (t) => {
    let { container } = mount(t, <Invoice />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.style.cssText = 'position: fixed; inset: 0; margin: 0'

    let x = innerWidth - 10
    let y = innerHeight - 10
    rightClick(x, y)
    await settle()
    let rect = content.getBoundingClientRect()
    assert.ok(rect.right <= innerWidth - 4, 'flips to the left of the pointer')
    assert.ok(rect.bottom <= innerHeight - 4, 'and moves up')
    assert.ok(rect.right <= x + 1)
  })

  it('opens to the left of the pointer in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div dir="rtl">
        <Invoice />
      </div>,
    )
    await settle()
    let { content } = parts(container)

    rightClick(400, 150)
    await settle()
    assert.equal(Math.round(content.getBoundingClientRect().right), 400)
    assert.equal(content.dataset.side, 'left')
  })

  it('opens at the focused element with Shift+F10 and the Context Menu key, and returns focus there', async (t) => {
    let { container } = mount(t, <Invoice />)
    await settle()
    let { content } = parts(container)
    let invoice = container.querySelector('button')!

    for (let init of [{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }]) {
      invoice.focus()
      let event = key(init.key, init)
      assert.equal(event.defaultPrevented, true)
      await settle()
      assert.equal(isOpen(content), true)
      assert.equal(focused(), 'Open', 'the keys start at the first item')
      let rect = content.getBoundingClientRect()
      let anchor = invoice.getBoundingClientRect()
      assert.equal(Math.round(rect.left), Math.round(anchor.left))
      assert.ok(Math.abs(rect.top - (anchor.bottom + 4)) < 1)

      // The contextmenu event the key sends after its keydown changes nothing.
      let follow = new PointerEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 0,
        clientY: 0,
      })
      document.body.dispatchEvent(follow)
      assert.equal(follow.defaultPrevented, true)
      await settle()
      assert.equal(Math.round(content.getBoundingClientRect().left), Math.round(anchor.left))

      key('Escape')
      await settle()
      assert.equal(isOpen(content), false)
      assert.equal(document.activeElement, invoice)
    }
  })

  it('moves to a right click elsewhere in its area, and closes on one outside it', async (t) => {
    let { container } = mount(t, <Invoice />)
    await settle()
    let { content } = parts(container)

    rightClick(150, 150)
    await settle()
    // The area waits behind the menu, so the click reaches the page.
    assert.equal(rightClick(400, 250, document.body), false)
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(Math.round(content.getBoundingClientRect().left), 400)

    assert.equal(rightClick(700, 500, document.body), true, 'outside, the browser shows its menu')
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('opens on a long touch at the finger, and swallows the tap that ends it', async (t) => {
    let followed = 0
    let { container } = mount(t, <Invoice onClickLink={() => followed++} />)
    await settle()
    let { content } = parts(container)
    let link = container.querySelector('a')!
    let rect = link.getBoundingClientRect()
    let x = rect.left + 5
    let y = rect.top + 5

    touch('pointerdown', link, x, y)
    await wait(300)
    assert.equal(isOpen(content), false)
    await settle(300)
    assert.equal(isOpen(content), true)
    assert.equal(Math.round(content.getBoundingClientRect().left), Math.round(x))
    touch('pointerup', link, x, y)
    link.click()
    assert.equal(followed, 0)

    key('Escape')
    await settle()
    // A short tap still follows the link.
    touch('pointerdown', link, x, y)
    touch('pointerup', link, x, y)
    link.click()
    await settle(550)
    assert.equal(followed, 1)
    assert.equal(isOpen(content), false)
  })

  it('cancels a long touch that moves or that the browser takes over to scroll', async (t) => {
    let { container } = mount(t, <Invoice />)
    await settle()
    let { trigger, content } = parts(container)

    touch('pointerdown', trigger, 200, 150)
    touch('pointermove', trigger, 200, 170)
    await settle(550)
    assert.equal(isOpen(content), false)

    touch('pointerdown', trigger, 200, 150)
    touch('pointercancel', trigger, 200, 150)
    await settle(550)
    assert.equal(isOpen(content), false)

    touch('pointerdown', trigger, 200, 150)
    window.dispatchEvent(new Event('scroll'))
    document.dispatchEvent(new Event('scroll'))
    await settle(550)
    assert.equal(isOpen(content), false)
  })

  it('leaves the browser menu alone when disabled', async (t) => {
    let { container } = mount(t, <Invoice disabled />)
    await settle()
    let { content } = parts(container)

    assert.equal(rightClick(250, 180), true)
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('reports the reasons, and opens submenus beside itself', async (t) => {
    let changes: Array<[boolean, MenuOpenChangeReason]> = []
    let { container } = mount(
      t,
      <ContextMenu>
        <ContextMenuTrigger mix={areaStyles}>Area</ContextMenuTrigger>
        <ContextMenuContent mix={on(menuOpenChangeType, (event) => void changes.push([event.open, event.reason]))}>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Archive</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    )
    await settle()
    let { content } = parts(container)
    let sub = container.querySelector<HTMLElement>('[data-slot="context-menu-sub-content"]')!

    rightClick(200, 150)
    await settle()
    key('ArrowDown')
    key('ArrowRight')
    await settle()
    assert.equal(isOpen(sub), true)
    assert.ok(sub.getBoundingClientRect().left >= content.getBoundingClientRect().right - 1)
    key('Enter')
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [false, 'item-press'],
    ])
  })
})
