import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  dropdownMenuOpenChangeType,
  dropdownMenuValueChangeType,
} from './dropdown-menu.tsx'
import type { DropdownMenuOpenChangeReason, DropdownMenuProps } from './dropdown-menu.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Waits for the render, the positioning frame and the focus frame after it. */
async function settle(ms = 20) {
  await wait(ms)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

/** A mouse press on `element`, as the browser sends it. */
function press(element: Element) {
  let at = center(element)
  let init = { bubbles: true, cancelable: true, composed: true, pointerId: 1, isPrimary: true, pointerType: 'mouse' }
  element.dispatchEvent(new PointerEvent('pointerdown', { ...init, ...at }))
  element.dispatchEvent(new PointerEvent('pointerup', { ...init, ...at }))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...at }))
}

/** The mouse moving onto `element`. */
function hover(element: Element) {
  let init = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', ...center(element) }
  element.dispatchEvent(new PointerEvent('pointerover', init))
  element.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }))
  element.dispatchEvent(new PointerEvent('pointermove', init))
}

function key(key: string, target: Element = document.activeElement ?? document.body, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function isOpen(content: Element) {
  return content.matches(':popover-open')
}

function item(container: ParentNode, name: string) {
  let found = [...container.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (element) => element.textContent?.trim() === name,
  )
  assert.ok(found, `no item ${name}`)
  return found
}

function parts(container: ParentNode, index = 0) {
  let trigger = container.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-trigger"]')[index]
  let content = container.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-content"]')[index]
  assert.ok(trigger && content, 'no menu')
  return { trigger, content }
}

function focused() {
  let active = document.activeElement
  return active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? ''
}

const at = (left: number, top: number) => css({ position: 'fixed', left: `${left}px`, top: `${top}px`, margin: 0 })

interface ThemeProps extends DropdownMenuProps {
  /** Every value the group was told about, in order. */
  log?: string[]
  /** Cancels every value change. */
  decline?: boolean
  left?: number
}

// A theme picker as an app writes one: it holds the value and updates it from the change event.
function Theme(handle: Handle<ThemeProps>) {
  let theme = 'system'
  return () => {
    let { log = [], decline = false, left = 100, ...root } = handle.props
    return (
      <DropdownMenu {...root}>
        <DropdownMenuTrigger mix={at(left, 100)}>Theme</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup
            aria-label="Theme"
            value={theme}
            mix={on(dropdownMenuValueChangeType, (event) => {
              log.push(event.value)
              if (decline) return event.preventDefault()
              theme = event.value
              void handle.update()
            })}
          >
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
}

function checked(content: Element) {
  return [...content.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')].map((radio) =>
    radio.textContent?.trim(),
  )
}

describe('Dropdown Menu in the browser', () => {
  it('opens below its trigger on a click with focus on the menu, and a choice under the mouse takes focus', async (t) => {
    let { container } = mount(t, <Theme />)
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(trigger.getAttribute('aria-haspopup'), 'menu')
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(!trigger.hasAttribute('popovertarget'), 'the native fallback stops once it runs')
    assert.equal(content.getAttribute('popover'), 'manual')
    assert.equal(content.getAttribute('aria-labelledby'), trigger.id)

    trigger.focus()
    press(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(content.dataset.side, 'bottom')
    assert.equal(
      Math.round(content.getBoundingClientRect().top),
      Math.round(trigger.getBoundingClientRect().bottom) + 4,
    )
    assert.equal(Math.round(content.getBoundingClientRect().left), Math.round(trigger.getBoundingClientRect().left))
    assert.equal(document.activeElement, content)

    hover(item(content, 'Dark'))
    assert.equal(document.activeElement, item(content, 'Dark'))
  })

  it('reports a choice once, moves the check to it, closes and returns focus to the trigger', async (t) => {
    let log: string[] = []
    let { container } = mount(t, <Theme log={log} />)
    await settle()
    let { trigger, content } = parts(container)
    assert.deepEqual(checked(content), ['System'])

    trigger.focus()
    press(trigger)
    await settle()
    press(item(content, 'Dark'))
    await settle()
    assert.deepEqual(log, ['dark'])
    assert.deepEqual(checked(content), ['Dark'])
    assert.ok(item(content, 'Dark').querySelector('[data-slot="dropdown-menu-radio-item-indicator"] svg'))
    assert.equal(item(content, 'System').querySelector('svg'), null)
    assert.equal(isOpen(content), false)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(document.activeElement, trigger)

    // The current choice again closes the menu and reports nothing.
    press(trigger)
    await settle()
    press(item(content, 'Dark'))
    await settle()
    assert.deepEqual(log, ['dark'])
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)
  })

  it('keeps the menu open and the choice as it was when a listener declines the change', async (t) => {
    let log: string[] = []
    let { container } = mount(t, <Theme log={log} decline />)
    await settle()
    let { trigger, content } = parts(container)
    press(trigger)
    await settle()
    press(item(content, 'Light'))
    await settle()
    assert.deepEqual(log, ['light'])
    assert.deepEqual(checked(content), ['System'])
    assert.equal(isOpen(content), true)
  })

  it('keeps an uncontrolled choice, and stays open for a choice that asks it to', async (t) => {
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup defaultValue="dark">
            <DropdownMenuRadioItem value="light" closeOnClick={false}>
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    trigger.click()
    await settle()
    press(item(content, 'Light'))
    await settle()
    assert.deepEqual(checked(content), ['Light'])
    assert.equal(isOpen(content), true)
    press(item(content, 'Dark'))
    await settle()
    assert.deepEqual(checked(content), ['Dark'])
    assert.equal(isOpen(content), false)
  })

  it('moves focus with the arrow keys, Home, End and typed letters, and closes on Escape', async (t) => {
    let { container } = mount(t, <Theme />)
    await settle()
    let { trigger, content } = parts(container)

    // Enter and Space click the trigger without a pointer, so the first choice takes focus.
    trigger.focus()
    trigger.click()
    await settle()
    assert.equal(focused(), 'Light')
    key('ArrowDown')
    assert.equal(focused(), 'Dark')
    key('End')
    assert.equal(focused(), 'System')
    key('ArrowDown')
    assert.equal(focused(), 'Light', 'the arrows wrap')
    key('ArrowUp')
    assert.equal(focused(), 'System')
    key('Home')
    assert.equal(focused(), 'Light')
    key('d')
    assert.equal(focused(), 'Dark')
    // Letters typed together spell one name; a pause starts a new one.
    await wait(600)
    key('s')
    key('y')
    assert.equal(focused(), 'System')
    await wait(600)
    key('l')
    assert.equal(focused(), 'Light')
    assert.equal(isOpen(content), true)

    key('Escape')
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    // ArrowUp opens it at the last choice, ArrowDown at the first.
    key('ArrowUp', trigger)
    await settle()
    assert.equal(focused(), 'System')
    key('Escape')
    await settle()
    key('ArrowDown', trigger)
    await settle()
    assert.equal(focused(), 'Light')
  })

  it('moves from the menu itself to a choice with the arrow keys and letters after a click opened it', async (t) => {
    let { container } = mount(t, <Theme />)
    await settle()
    let { trigger, content } = parts(container)

    for (let [keyName, expected] of [
      ['ArrowDown', 'Light'],
      ['ArrowUp', 'System'],
      ['Home', 'Light'],
      ['End', 'System'],
      ['d', 'Dark'],
    ]) {
      press(trigger)
      await settle()
      assert.equal(document.activeElement, content)
      key(keyName)
      assert.equal(focused(), expected, keyName)
      key('Escape')
      await settle()
    }
  })

  it('closes on Tab and moves on from the trigger, or back with Shift', async (t) => {
    let { container } = mount(
      t,
      <div>
        <button type="button">Before</button>
        <Theme />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    for (let [shiftKey, expected] of [
      [false, 'After'],
      [true, 'Before'],
    ] as const) {
      trigger.focus()
      trigger.click()
      await settle()
      let event = key('Tab', document.activeElement!, { shiftKey })
      assert.equal(event.defaultPrevented, true)
      await settle()
      assert.equal(isOpen(content), false)
      assert.equal(focused(), expected)
    }
  })

  it('closes on a press elsewhere, leaving focus where the press put it', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Theme modal={false} />
        <button type="button" mix={at(500, 500)}>
          Elsewhere
        </button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let elsewhere = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Elsewhere')!

    trigger.click()
    await settle()
    elsewhere.focus()
    press(elsewhere)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, elsewhere)
  })

  it('keeps the page inert while a modal menu is open, and lets it go when it closes', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Theme />
        <button type="button">Elsewhere</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let elsewhere = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Elsewhere')!

    trigger.click()
    await settle()
    assert.ok(elsewhere.closest('[inert]'), 'the page waits')
    assert.ok(!trigger.closest('[inert]') && !content.closest('[inert]'))
    key('Escape')
    await settle()
    assert.ok(!elsewhere.closest('[inert]'))
  })

  it('sends open changes with their reason, and keeps the state when a listener declines', async (t) => {
    let reasons: Array<[boolean, DropdownMenuOpenChangeReason]> = []
    let decline = false
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
        <DropdownMenuContent
          mix={on(dropdownMenuOpenChangeType, (event) => {
            reasons.push([event.open, event.reason])
            if (decline) event.preventDefault()
          })}
        >
          <DropdownMenuRadioGroup defaultValue="dark">
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()
    trigger.click()
    await settle()
    key('Escape')
    await settle()
    key('ArrowDown', trigger)
    await settle()
    press(item(content, 'Light'))
    await settle()
    decline = true
    trigger.click()
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
      [true, 'list-navigation'],
      [false, 'item-press'],
      [true, 'trigger-press'],
    ])
  })

  it('submits no form from its trigger or choices', async (t) => {
    let submits = 0
    let { container } = mount(
      t,
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <Theme />
      </form>,
    )
    await settle()
    let { trigger, content } = parts(container)
    for (let button of container.querySelectorAll('button')) assert.equal(button.type, 'button')
    press(trigger)
    await settle()
    press(item(content, 'Light'))
    await settle()
    assert.equal(submits, 0)
  })

  it('keeps two menus apart', async (t) => {
    let first: string[] = []
    let second: string[] = []
    let { container } = mount(
      t,
      <div>
        <Theme modal={false} log={first} />
        <Theme modal={false} log={second} left={300} />
      </div>,
    )
    await settle()
    let one = parts(container, 0)
    let two = parts(container, 1)
    assert.notEqual(one.content.id, two.content.id)
    assert.equal(one.trigger.getAttribute('aria-controls'), one.content.id)
    assert.equal(two.trigger.getAttribute('aria-controls'), two.content.id)

    press(one.trigger)
    await settle()
    assert.equal(isOpen(one.content), true)
    assert.equal(isOpen(two.content), false)
    press(item(one.content, 'Light'))
    await settle()
    assert.deepEqual(first, ['light'])
    assert.deepEqual(second, [])
    assert.deepEqual(checked(one.content), ['Light'])
    assert.deepEqual(checked(two.content), ['System'])
  })
})
