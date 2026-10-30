import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  MenuCheckedChangeEvent,
  MenuOpenChangeEvent,
  MenuValueChangeEvent,
  menuCheckedChangeType,
  menuOpenChangeType,
  menuValueChangeType,
  dropdownMenuTrigger,
} from './dropdown-menu.tsx'
import type { DropdownMenuContentProps, DropdownMenuProps, MenuOpenChangeReason } from './dropdown-menu.tsx'

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

/** A mouse press on `element`, as the browser sends it. */
function press(element: Element) {
  let at = center(element)
  pointer('pointerdown', element, at)
  pointer('pointerup', element, at)
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...at }))
}

/** The click Enter or Space sends to a focused button. */
function keyClick(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
}

/** Moves the mouse onto `element`, as the browser reports it. */
function hover(element: Element) {
  pointer('pointerenter', element)
  pointer('pointermove', element)
}

function unhover(element: Element) {
  let rect = element.getBoundingClientRect()
  pointer('pointerleave', element, { clientX: rect.right + 200, clientY: rect.bottom + 200 })
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
  let active = document.activeElement
  return active?.getAttribute('data-label') ?? active?.textContent?.trim() ?? ''
}

function item(container: ParentNode, text: string) {
  let found = [...container.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    (element) => element.textContent?.trim() === text,
  )
  assert.ok(found, `no item ${text}`)
  return found
}

function parts(container: ParentNode, index = 0) {
  let trigger = container.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]:not([role^="menuitem"])')[index]
  let content = container.querySelectorAll<HTMLElement>('[data-slot$="menu-content"]')[index]
  assert.ok(trigger && content, 'no menu')
  return { trigger, content }
}

const at = (left: number, top: number) => css({ position: 'fixed', left: `${left}px`, top: `${top}px`, margin: 0 })

function Edit(handle: Handle<DropdownMenuProps & { content?: Partial<DropdownMenuContentProps> }>) {
  return () => {
    let { content, ...root } = handle.props
    return (
      <DropdownMenu {...root}>
        <DropdownMenuTrigger mix={at(200, 100)}>Edit</DropdownMenuTrigger>
        <DropdownMenuContent {...content}>
          <DropdownMenuItem>Undo</DropdownMenuItem>
          <DropdownMenuItem disabled>Redo</DropdownMenuItem>
          <DropdownMenuItem hidden>Repeat</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Cut</DropdownMenuItem>
          <DropdownMenuItem>Copy</DropdownMenuItem>
          <DropdownMenuItem>Paste</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
}

describe('DropdownMenu in the browser', () => {
  it('opens below its trigger on a click with the menu focused, and a second click closes it with focus back', async (t) => {
    let { container } = mount(t, <Edit />)
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(!trigger.hasAttribute('popovertarget'), 'the native fallback stops once it runs')
    assert.equal(content.getAttribute('popover'), 'manual')

    trigger.focus()
    press(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.ok(trigger.hasAttribute('data-popup-open'))
    assert.equal(content.dataset.side, 'bottom')
    assert.equal(
      Math.round(content.getBoundingClientRect().top),
      Math.round(trigger.getBoundingClientRect().bottom) + 4,
    )
    assert.equal(document.activeElement, content, 'a pointer opens it without highlighting an item')

    // From the menu itself, Arrow Down starts at the first item.
    key('ArrowDown')
    assert.equal(focused(), 'Undo')

    press(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)
  })

  it('keeps focus on an item the keys reached before the frame in which a click moves focus to the menu', async (t) => {
    let { container } = mount(t, <Edit />)
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    press(trigger)
    // The menu shows once the update commits, and takes focus only on the next frame.
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(isOpen(content), true)
    key('ArrowDown', {}, trigger)
    assert.equal(focused(), 'Undo')
    await settle()
    assert.equal(focused(), 'Undo', 'the frame leaves focus where the keys put it')
  })

  it('opens from the keyboard at the first or the last item', async (t) => {
    let { container } = mount(t, <Edit />)
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    keyClick(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(focused(), 'Undo')

    key('Escape')
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    assert.equal(key('ArrowUp').defaultPrevented, true)
    await settle()
    assert.equal(focused(), 'Paste')

    key('Escape')
    await settle()
    key('ArrowDown')
    await settle()
    assert.equal(focused(), 'Undo')
  })

  it('moves with the arrows, Home, End and typing, past disabled and hidden items', async (t) => {
    let { container } = mount(t, <Edit />)
    await settle()
    let { trigger } = parts(container)
    trigger.focus()
    key('ArrowDown')
    await settle()

    key('ArrowDown')
    assert.equal(focused(), 'Cut', 'skips the disabled and the hidden item')
    key('ArrowUp')
    assert.equal(focused(), 'Undo')
    key('ArrowUp')
    assert.equal(focused(), 'Paste', 'wraps around')
    key('Home')
    assert.equal(focused(), 'Undo')
    key('End')
    assert.equal(focused(), 'Paste')
    key('c')
    assert.equal(focused(), 'Cut')
    key('c')
    assert.equal(focused(), 'Copy', 'the same letter again moves to the next match')
    key('r')
    assert.equal(focused(), 'Copy', 'typing skips the disabled and the hidden item')
  })

  it('starts at the first or last item with the arrows along a horizontal menu, mirrored in right-to-left text', async (t) => {
    for (let [dir, first, last] of [
      ['ltr', 'ArrowRight', 'ArrowLeft'],
      ['rtl', 'ArrowLeft', 'ArrowRight'],
    ] as const) {
      let { container } = mount(
        t,
        <div dir={dir}>
          <Edit orientation="horizontal" />
        </div>,
      )
      await settle()
      let { trigger, content } = parts(container)

      press(trigger)
      await settle()
      assert.equal(document.activeElement, content, 'a pointer opens it without highlighting an item')
      assert.equal(content.getAttribute('aria-orientation'), 'horizontal')
      assert.equal(key(first).defaultPrevented, true)
      assert.equal(focused(), 'Undo', dir)

      content.focus()
      key(last)
      assert.equal(focused(), 'Paste', dir)
      key('Escape')
      await settle()
    }
  })

  it('closes when its menu becomes disabled, and stays closed when it starts open and disabled', async (t) => {
    let setDisabled: (disabled: boolean) => void = () => {}
    function Switchable(handle: Handle) {
      let disabled = false
      setDisabled = (next) => {
        disabled = next
        void handle.update()
      }
      return () => <Edit defaultOpen modal={false} disabled={disabled} />
    }
    let { container } = mount(
      t,
      <div>
        <Switchable />
        <Edit defaultOpen disabled />
      </div>,
    )
    await settle()
    let switchable = parts(container, 0)
    let disabledFromTheStart = parts(container, 1)
    assert.equal(isOpen(switchable.content), true)
    assert.equal(isOpen(disabledFromTheStart.content), false)
    assert.equal(document.documentElement.style.overflow, '', 'no modal state either')

    setDisabled(true)
    await settle()
    assert.equal(isOpen(switchable.content), false)
    assert.ok(switchable.content.hasAttribute('data-closed'))
    assert.equal(switchable.trigger.getAttribute('aria-expanded'), 'false')
    assert.ok((switchable.trigger as HTMLButtonElement).disabled)

    setDisabled(false)
    await settle()
    assert.equal(isOpen(switchable.content), false, 'enabling it again leaves it closed')
  })

  it('never opens from a trigger the caller disabled, on hover, a click or the keys', async (t) => {
    let { container } = mount(
      t,
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger disabled openOnHover delay={0} mix={at(100, 100)}>
            Native
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Undo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <span
            role="button"
            tabIndex={0}
            aria-disabled="true"
            mix={[at(300, 100), dropdownMenuTrigger({ openOnHover: true, delay: 0 })]}
          >
            Focusable
          </span>
          <DropdownMenuContent>
            <DropdownMenuItem>Redo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    )
    await settle()
    let native = parts(container, 0)
    let focusable = parts(container, 1)

    for (let { trigger } of [native, focusable]) {
      hover(trigger)
      press(trigger)
      trigger.focus()
      key('ArrowDown', {}, trigger)
      keyClick(trigger)
    }
    await settle(50)
    assert.equal(isOpen(native.content), false)
    assert.equal(isOpen(focusable.content), false)
    assert.ok(!native.trigger.hasAttribute('popovertarget'))
  })

  it('never opens on hover inside a disabled fieldset, also one disabled while the delay runs, but does in its first legend', async (t) => {
    function Hovered(handle: Handle<{ name: string; left: number; delay: number }>) {
      return () => (
        <DropdownMenu>
          <DropdownMenuTrigger openOnHover delay={handle.props.delay} mix={at(handle.props.left, 100)}>
            {handle.props.name}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{`${handle.props.name} item`}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    let { container } = mount(
      t,
      <div>
        <fieldset disabled>
          <legend>
            <Hovered name="Legend" left={100} delay={0} />
          </legend>
          <Hovered name="Disabled" left={300} delay={0} />
        </fieldset>
        <fieldset>
          <Hovered name="Later" left={500} delay={60} />
        </fieldset>
      </div>,
    )
    await settle()
    let legend = parts(container, 0)
    let disabled = parts(container, 1)
    let later = parts(container, 2)
    assert.ok(disabled.trigger.matches(':disabled'))
    assert.ok(!legend.trigger.matches(':disabled'), 'the first legend stays usable, natively')

    hover(disabled.trigger)
    await settle()
    assert.equal(isOpen(disabled.content), false)

    hover(legend.trigger)
    await settle()
    assert.equal(isOpen(legend.content), true)
    unhover(legend.trigger)
    await settle()

    hover(later.trigger)
    await wait(10)
    later.trigger.closest('fieldset')!.disabled = true
    await settle(100)
    assert.equal(isOpen(later.content), false, 'the delay finds it disabled')
  })

  it('stops at the ends without loopFocus', async (t) => {
    let { container } = mount(t, <Edit loopFocus={false} />)
    await settle()
    let { trigger } = parts(container)
    trigger.focus()
    key('ArrowUp')
    await settle()

    key('ArrowDown')
    assert.equal(focused(), 'Paste')
    key('Home')
    key('ArrowUp')
    assert.equal(focused(), 'Undo')
  })

  it('runs an item on Enter, Space and a click, then closes with focus back on the trigger', async (t) => {
    let ran: string[] = []
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem mix={on('click', (event) => void ran.push(`undo ${event.detail}`))}>Undo</DropdownMenuItem>
          <DropdownMenuItem mix={on('click', () => void ran.push('cut'))}>Cut</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)

    for (let name of ['Enter', ' ']) {
      trigger.focus()
      key('ArrowDown')
      await settle()
      let event = key(name)
      assert.equal(event.defaultPrevented, true)
      await settle()
      assert.equal(isOpen(content), false)
      assert.equal(document.activeElement, trigger)
    }
    assert.deepEqual(ran, ['undo 0', 'undo 0'])

    press(trigger)
    await settle()
    press(item(content, 'Cut'))
    await settle()
    assert.deepEqual(ran.at(-1), 'cut')
    assert.equal(isOpen(content), false)
  })

  it('keeps the menu open and the item highlighted when a click handler cancels it, or the item asks', async (t) => {
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem mix={on('click', (event) => event.preventDefault())}>Undo</DropdownMenuItem>
          <DropdownMenuItem closeOnClick={false}>Cut</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()
    key('ArrowDown')
    await settle()

    key('Enter')
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(focused(), 'Undo')
    key('ArrowDown')
    key(' ')
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(focused(), 'Cut')
  })

  it('never runs a disabled item, by key or pointer, and the pointer skips it', async (t) => {
    let ran = 0
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Undo</DropdownMenuItem>
          <DropdownMenuItem disabled mix={on('click', () => void ran++)}>
            Redo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    press(trigger)
    await settle()
    let redo = item(content, 'Redo')
    assert.equal(getComputedStyle(redo).pointerEvents, 'none')

    hover(item(content, 'Undo'))
    assert.equal(focused(), 'Undo')
    unhover(item(content, 'Undo'))
    assert.equal(document.activeElement, content, 'leaving an item clears the highlight')

    // A script that focuses and presses it anyway changes nothing.
    redo.focus()
    key('Enter')
    redo.click()
    await settle()
    assert.equal(ran, 0)
    assert.equal(isOpen(content), true)
  })

  it('closes on Escape and on a press outside, which reaches nothing while it is modal', async (t) => {
    let outsideClicks = 0
    let { container } = mount(
      t,
      <div>
        <Edit />
        <button type="button" mix={[at(500, 500), on('click', () => void outsideClicks++)]}>
          Elsewhere
        </button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    press(trigger)
    await settle()
    let outside = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Elsewhere')!
    assert.ok(outside.closest('[inert]'), 'the rest of the page waits')
    assert.equal(getComputedStyle(document.documentElement).overflow, 'hidden')
    press(document.elementFromPoint(510, 510) ?? document.body)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(outsideClicks, 0)
    assert.ok(!outside.closest('[inert]'))
  })

  it('leaves the page alone when it is not modal', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Edit modal={false} />
        <button type="button" mix={at(500, 500)}>
          Elsewhere
        </button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    press(trigger)
    await settle()
    let outside = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Elsewhere')!
    assert.ok(!outside.closest('[inert]'))

    // Focus that moves outside closes it.
    outside.focus()
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('closes on Tab and Shift+Tab, and moves focus on from its trigger, as from a native select', async (t) => {
    let { container } = mount(
      t,
      <div>
        <button type="button">Before</button>
        <Edit />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    for (let [shiftKey, next] of [
      [false, 'After'],
      [true, 'Before'],
    ] as const) {
      trigger.focus()
      key('ArrowDown')
      await settle()
      let event = key('Tab', { shiftKey })
      assert.equal(event.defaultPrevented, true, 'every engine moves the same way')
      await settle()
      assert.equal(isOpen(content), false)
      assert.equal(focused(), next)
    }
  })

  it('reports each change with a reason, and stays as it is when the change is canceled', async (t) => {
    let changes: Array<[boolean, MenuOpenChangeReason]> = []
    let cancel = false
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
        <DropdownMenuContent
          mix={on(menuOpenChangeType, (event) => {
            assert.ok(event instanceof MenuOpenChangeEvent)
            changes.push([event.open, event.reason])
            if (cancel) event.preventDefault()
          })}
        >
          <DropdownMenuItem>Undo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)

    cancel = true
    press(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(document.documentElement.style.overflow, '', 'no scroll lock is left behind')

    cancel = false
    trigger.focus()
    key('ArrowDown')
    await settle()
    cancel = true
    key('Escape')
    await settle()
    assert.equal(isOpen(content), true, 'a canceled close keeps it open')
    assert.equal(focused(), 'Undo', 'and the highlight where it was')

    cancel = false
    key('Enter')
    await settle()
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [true, 'trigger-press'],
      [false, 'escape-key'],
      [false, 'item-press'],
    ])
  })

  it('follows an open state the app controls', async (t) => {
    let opens = 0
    function Controlled(handle: Handle) {
      let open = false
      return () => (
        <DropdownMenu open={open}>
          <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
          <DropdownMenuContent
            mix={on(menuOpenChangeType, (event) => {
              if (event.open && ++opens > 1) return
              open = event.open
              void handle.update()
            })}
          >
            <DropdownMenuItem>Undo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    let { container } = mount(t, <Controlled />)
    await settle()
    let { trigger, content } = parts(container)

    press(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    key('Escape')
    await settle()
    assert.equal(isOpen(content), false)

    // The app declines the second opening.
    press(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  })

  it('leaves focus where it is when it starts open, so several menus can start open at once', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Edit defaultOpen modal={false} />
        <Edit defaultOpen modal={false} />
      </div>,
    )
    await settle()
    let first = parts(container, 0)
    let second = parts(container, 1)
    assert.equal(isOpen(first.content), true)
    assert.equal(isOpen(second.content), true)
    assert.ok(!first.content.contains(document.activeElement) && !second.content.contains(document.activeElement))

    // Once the keys open it again, they start at the first item.
    first.trigger.focus()
    key('Escape')
    await settle()
    key('ArrowDown')
    await settle()
    assert.equal(focused(), 'Undo')
  })

  it('checks checkbox items in place, and announces the state through aria-checked', async (t) => {
    let changes: boolean[] = []
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent
          mix={on(menuCheckedChangeType, (event) => {
            assert.ok(event instanceof MenuCheckedChangeEvent)
            changes.push(event.checked)
            if ((event.target as Element).textContent === 'Panel') event.preventDefault()
          })}
        >
          <DropdownMenuCheckboxItem defaultChecked>Status bar</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Activity bar</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Panel</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()
    key('ArrowDown')
    await settle()

    key(' ')
    await settle()
    assert.equal(item(content, 'Status bar').getAttribute('aria-checked'), 'false')
    assert.equal(isOpen(content), true, 'checkbox items keep the menu open')
    press(item(content, 'Activity bar'))
    await settle()
    assert.equal(item(content, 'Activity bar').getAttribute('aria-checked'), 'true')
    assert.ok(item(content, 'Activity bar').querySelector('svg'), 'the check shows')

    // The listener declines this one.
    press(item(content, 'Panel'))
    await settle()
    assert.equal(item(content, 'Panel').getAttribute('aria-checked'), 'false')
    assert.deepEqual(changes, [false, true, true])
  })

  it('checks one radio item of a group, and keeps the value when the change is canceled', async (t) => {
    let values: string[] = []
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>Panel</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Position</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              defaultValue="bottom"
              mix={on(menuValueChangeType, (event) => {
                assert.ok(event instanceof MenuValueChangeEvent)
                values.push(event.value)
                if (event.value === 'right') event.preventDefault()
              })}
            >
              <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="left" disabled>
                Left
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let checked = () =>
      [...content.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')].map((radio) => radio.textContent)

    press(trigger)
    await settle()
    press(item(content, 'Top'))
    await settle()
    assert.deepEqual(checked(), ['Top'])
    assert.equal(isOpen(content), true)
    press(item(content, 'Right'))
    await settle()
    assert.deepEqual(checked(), ['Top'])
    item(content, 'Left').click()
    await settle()
    assert.deepEqual(checked(), ['Top'])
    assert.deepEqual(values, ['top', 'right'])
  })

  it('opens a submenu with the arrow toward it and closes it with the other, from the keyboard', async (t) => {
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>File</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>New</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Email</DropdownMenuItem>
              <DropdownMenuItem>Message</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>Print</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let subTrigger = item(content, 'Share')
    let sub = content.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-content"]')!
    trigger.focus()
    key('ArrowDown')
    await settle()
    key('ArrowDown')
    assert.equal(document.activeElement, subTrigger)
    assert.equal(isOpen(sub), false, 'focus alone opens nothing')

    key('ArrowRight')
    await settle()
    assert.equal(isOpen(sub), true)
    assert.equal(subTrigger.getAttribute('aria-expanded'), 'true')
    assert.equal(focused(), 'Email')
    assert.ok(sub.getBoundingClientRect().left >= content.getBoundingClientRect().right - 1, 'beside the menu')
    key('ArrowDown')
    assert.equal(focused(), 'Message', 'the submenu has its own items')
    key('ArrowDown')
    assert.equal(focused(), 'Email')

    key('ArrowLeft')
    await settle()
    assert.equal(isOpen(sub), false)
    assert.equal(isOpen(content), true)
    assert.equal(document.activeElement, subTrigger)

    keyClick(subTrigger)
    await settle()
    assert.equal(focused(), 'Email', 'Enter opens it too')
    key('Escape')
    await settle()
    assert.equal(isOpen(sub), false, 'Escape closes only the submenu')
    assert.equal(isOpen(content), true)
    assert.equal(document.activeElement, subTrigger)

    key('ArrowRight')
    await settle()
    key('Enter')
    await settle()
    assert.equal(isOpen(content), false, 'an item of the submenu closes every menu')
    assert.equal(isOpen(sub), false)
    assert.equal(document.activeElement, trigger)
  })

  it('swaps the arrows that open and close a submenu in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div dir="rtl">
        <DropdownMenu>
          <DropdownMenuTrigger mix={at(400, 100)}>File</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Email</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let sub = content.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-content"]')!
    trigger.focus()
    key('ArrowDown')
    await settle()

    key('ArrowRight')
    await settle()
    assert.equal(isOpen(sub), false)
    key('ArrowLeft')
    await settle()
    assert.equal(isOpen(sub), true)
    assert.equal(sub.dataset.side, 'left')
    assert.ok(sub.getBoundingClientRect().right <= content.getBoundingClientRect().left + 1)
    key('ArrowRight')
    await settle()
    assert.equal(isOpen(sub), false)
  })

  it('opens a submenu after the pointer rests on its trigger, and closes it when the pointer moves to another item', async (t) => {
    let { container } = mount(
      t,
      <DropdownMenu>
        <DropdownMenuTrigger>File</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger delay={40}>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Email</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>Print</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let subTrigger = item(content, 'Share')
    let sub = content.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-content"]')!
    press(trigger)
    await settle()

    hover(subTrigger)
    assert.equal(document.activeElement, subTrigger, 'the pointer highlights it')
    await wait(10)
    assert.equal(isOpen(sub), false)
    await settle(50)
    assert.equal(isOpen(sub), true)
    assert.equal(document.activeElement, subTrigger, 'focus stays on the trigger')

    // Onto the submenu: it stays, and its item lights up.
    let email = item(sub, 'Email')
    pointer('pointerleave', subTrigger, center(email))
    hover(sub)
    hover(email)
    await settle()
    assert.equal(isOpen(sub), true)
    assert.equal(focused(), 'Email')

    // Onto another item of the outer menu: it closes.
    unhover(email)
    pointer('pointerleave', sub, center(item(content, 'Print')))
    hover(item(content, 'Print'))
    await settle()
    assert.equal(isOpen(sub), false)
    assert.equal(focused(), 'Print')
  })

  it('follows props that change while it is open: a disabled item, a checked item and the side', async (t) => {
    let set: (next: { disabled: boolean; checked: boolean; side: 'bottom' | 'top' }) => void = () => {}
    function Changing(handle: Handle) {
      let state = { disabled: false, checked: false, side: 'bottom' as 'bottom' | 'top' }
      set = (next) => {
        state = next
        void handle.update()
      }
      return () => (
        <DropdownMenu>
          <DropdownMenuTrigger mix={at(200, 300)}>View</DropdownMenuTrigger>
          <DropdownMenuContent side={state.side}>
            <DropdownMenuItem>Zoom in</DropdownMenuItem>
            <DropdownMenuItem disabled={state.disabled}>Zoom out</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={state.checked}>Grid</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    let { container } = mount(t, <Changing />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()
    key('ArrowDown')
    await settle()

    set({ disabled: true, checked: true, side: 'top' })
    await settle()
    key('ArrowDown')
    assert.equal(focused(), 'Grid', 'skips the item that became disabled')
    assert.equal(item(content, 'Grid').getAttribute('aria-checked'), 'true')
    assert.equal(content.dataset.side, 'top')
    assert.ok(content.getBoundingClientRect().bottom <= trigger.getBoundingClientRect().top)

    set({ disabled: false, checked: false, side: 'top' })
    await settle()
    key('ArrowUp')
    assert.equal(focused(), 'Zoom out')
    assert.equal(item(content, 'Grid').getAttribute('aria-checked'), 'false')
  })

  it('moves focus to the item in its place when the focused item leaves', async (t) => {
    function Removable(handle: Handle) {
      let items = ['Invoice 1', 'Invoice 2', 'Invoice 3']
      return () => (
        <DropdownMenu>
          <DropdownMenuTrigger>Invoices</DropdownMenuTrigger>
          <DropdownMenuContent>
            {items.map((name) => (
              <DropdownMenuItem
                key={name}
                closeOnClick={false}
                mix={on('click', () => {
                  items = items.filter((other) => other !== name)
                  void handle.update()
                })}
              >
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    let { container } = mount(t, <Removable />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()
    key('ArrowDown')
    await settle()
    key('ArrowDown')
    assert.equal(focused(), 'Invoice 2')

    key('Enter')
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(focused(), 'Invoice 3')
    key('ArrowUp')
    assert.equal(focused(), 'Invoice 1', 'the keys still work')
  })

  it('names a group by its label and gives each menu its own ids', async (t) => {
    let { container } = mount(
      t,
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger>One</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem>Profile</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger>Two</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLinkItem href="#billing">Billing</DropdownMenuLinkItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    )
    await settle()
    let group = container.querySelector('[role="group"]')!
    let label = document.getElementById(group.getAttribute('aria-labelledby')!)
    assert.equal(label?.textContent, 'Account')
    let first = parts(container, 0)
    let second = parts(container, 1)
    assert.notEqual(first.content.id, second.content.id)
    assert.equal(second.content.getAttribute('aria-labelledby'), second.trigger.id)
    assert.equal(
      item(second.content, 'Billing').getAttribute('tabindex'),
      '-1',
      'the menu moves focus to its link item',
    )
  })

  it('closes when its trigger leaves, and releases the page when it unmounts while open', async (t) => {
    function Toggle(handle: Handle) {
      let shown = true
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              shown = false
              void handle.update()
            })}
          >
            Remove
          </button>
          {shown ? <Edit /> : null}
        </div>
      )
    }
    let { container } = mount(t, <Toggle />)
    await settle()
    let { trigger } = parts(container)
    press(trigger)
    await settle()
    assert.equal(getComputedStyle(document.documentElement).overflow, 'hidden')

    container.querySelector('button')!.click()
    await settle()
    assert.equal(container.querySelector('[role="menu"]'), null)
    assert.notEqual(getComputedStyle(document.documentElement).overflow, 'hidden')
    assert.equal(document.querySelector('[inert]'), null)
  })
})
