import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from './menubar.tsx'
import type { MenubarProps } from './menubar.tsx'

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

function pointer(type: string, element: Element) {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      ...center(element),
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

function App(handle: Handle<Partial<MenubarProps>>) {
  return () => (
    <div>
      <Menubar {...handle.props} mix={at}>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New invoice</MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>PDF</MenubarItem>
                <MenubarItem>CSV</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Undo</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu disabled>
          <MenubarTrigger>Share</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Email</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem>Status bar</MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <button type="button">After</button>
    </div>
  )
}

function parts(container: ParentNode) {
  let menubar = container.querySelector<HTMLElement>('[role="menubar"]')!
  let triggers = [...container.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]')]
  let contents = [...container.querySelectorAll<HTMLElement>('[data-slot="menubar-content"]')]
  let trigger = (name: string) => triggers.find((element) => element.textContent === name)!
  let content = (name: string) => contents[triggers.indexOf(trigger(name))]
  return { menubar, triggers, trigger, content }
}

function openMenus(container: ParentNode) {
  return [...container.querySelectorAll('[data-slot="menubar-content"]:popover-open')].map(
    (content) => document.getElementById(content.getAttribute('aria-labelledby')!)?.textContent,
  )
}

describe('Menubar in the browser', () => {
  it('keeps one tab stop and moves between its buttons with the arrows, past a disabled one', async (t) => {
    let { container } = mount(t, <App />)
    await settle()
    let { triggers, trigger } = parts(container)
    assert.deepEqual(
      triggers.map((element) => element.tabIndex),
      [0, -1, -1, -1],
    )

    trigger('File').focus()
    key('ArrowRight')
    assert.equal(focused(), 'Edit')
    key('ArrowRight')
    assert.equal(focused(), 'View', 'skips the disabled menu')
    key('ArrowRight')
    assert.equal(focused(), 'File', 'wraps around')
    key('End')
    assert.equal(focused(), 'View')
    assert.equal(trigger('View').tabIndex, 0)
  })

  it('opens a menu at its first item with Arrow Down, and Escape returns to its button', async (t) => {
    let { container } = mount(t, <App />)
    await settle()
    let { trigger, content, menubar } = parts(container)

    trigger('Edit').focus()
    key('ArrowDown')
    await settle()
    assert.deepEqual(openMenus(container), ['Edit'])
    assert.equal(focused(), 'Undo')
    assert.ok(menubar.hasAttribute('data-has-submenu-open'))
    assert.ok(content('Edit').getBoundingClientRect().top >= trigger('Edit').getBoundingClientRect().bottom + 7)

    key('Escape')
    await settle()
    assert.deepEqual(openMenus(container), [])
    assert.equal(document.activeElement, trigger('Edit'))
    assert.ok(!menubar.hasAttribute('data-has-submenu-open'))
  })

  it('moves to the menu beside it with Arrow Left and Right, unless they open or close a submenu', async (t) => {
    let { container } = mount(t, <App />)
    await settle()
    let { trigger } = parts(container)

    trigger('File').focus()
    key('ArrowDown')
    await settle()
    key('ArrowRight')
    await settle()
    assert.deepEqual(openMenus(container), ['Edit'])
    assert.equal(focused(), 'Undo')

    key('ArrowLeft')
    await settle()
    assert.deepEqual(openMenus(container), ['File'])
    key('ArrowDown')
    assert.equal(focused(), 'Export')
    key('ArrowRight')
    await settle()
    assert.equal(focused(), 'PDF', 'the submenu opens instead')
    key('ArrowLeft')
    await settle()
    assert.equal(focused(), 'Export', 'and closes first')

    key('ArrowLeft')
    await settle()
    assert.deepEqual(openMenus(container), ['View'], 'wraps around, past the disabled menu')
    assert.equal(focused(), 'Status bar')
  })

  it('opens the menu under the pointer once one is open, and a click there keeps it', async (t) => {
    let { container } = mount(t, <App />)
    await settle()
    let { trigger } = parts(container)

    pointer('pointerenter', trigger('Edit'))
    await settle()
    assert.deepEqual(openMenus(container), [], 'hover alone opens nothing')

    press(trigger('File'))
    await settle()
    assert.deepEqual(openMenus(container), ['File'])
    pointer('pointerenter', trigger('Edit'))
    await settle()
    assert.deepEqual(openMenus(container), ['Edit'])
    press(trigger('Edit'))
    await settle()
    assert.deepEqual(openMenus(container), ['Edit'], 'the click keeps the menu the pointer opened')
    press(trigger('Edit'))
    await settle()
    assert.deepEqual(openMenus(container), [])
  })

  it('keeps the menubar usable while the rest of the page waits', async (t) => {
    let { container } = mount(t, <App />)
    await settle()
    let { trigger, menubar } = parts(container)
    let after = [...container.querySelectorAll('button')].find((button) => button.textContent === 'After')!

    press(trigger('File'))
    await settle()
    assert.ok(after.closest('[inert]'))
    assert.equal(menubar.closest('[inert]'), null)
    press(trigger('View'))
    await settle()
    assert.deepEqual(openMenus(container), ['View'])
  })

  it('closes every menu when the whole menubar is disabled', async (t) => {
    let { container } = mount(t, <App disabled />)
    await settle()
    let { trigger } = parts(container)

    press(trigger('File'))
    trigger('Edit').focus()
    key('ArrowDown')
    await settle()
    assert.deepEqual(openMenus(container), [])
  })
})
