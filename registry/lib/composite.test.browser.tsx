import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'

import { createRoot } from 'remix/component'
import type { Handle } from 'remix/component'

import { activeDescendant, highlightItem, rovingFocus } from '#remixcn/lib/composite.ts'

function press(target: Element, key: string) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function focused() {
  return document.activeElement?.textContent
}

function focusedText(element: Element) {
  return element.textContent?.trim()
}

interface ToolbarProps {
  dir?: 'ltr' | 'rtl'
  typeahead?: boolean
  onActiveChange?: (item: HTMLElement) => void
}

function Toolbar(handle: Handle<ToolbarProps>) {
  let props = handle.props
  return () => (
    <div
      role="toolbar"
      dir={props.dir}
      mix={rovingFocus({
        items: 'button',
        orientation: 'horizontal',
        typeahead: props.typeahead,
        onActiveChange: props.onActiveChange,
      })}
    >
      <button type="button">Bold</button>
      <button type="button" disabled>
        Italic
      </button>
      <button type="button" aria-disabled="true">
        Underline
      </button>
      <button type="button">Bullets</button>
      <button type="button" data-label="Align">
        ⇤
      </button>
    </div>
  )
}

describe('rovingFocus', () => {
  it('keeps one enabled item in the tab order and moves focus with the arrows', async (t) => {
    let changes: string[] = []
    let { $$, cleanup } = render(<Toolbar onActiveChange={(item) => changes.push(item.textContent ?? '')} />)
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    assert.deepEqual(
      [...buttons].map((button) => button.getAttribute('tabindex')),
      ['0', '-1', '-1', '-1', '-1'],
    )

    buttons[0].focus()
    assert.ok(press(buttons[0], 'ArrowRight').defaultPrevented)
    assert.equal(focused(), 'Bullets')
    assert.equal(buttons[3].getAttribute('tabindex'), '0')
    assert.equal(buttons[0].getAttribute('tabindex'), '-1')

    press(buttons[3], 'End')
    assert.equal(focused(), '⇤')
    press(buttons[4], 'Home')
    assert.equal(focused(), 'Bold')
    press(buttons[0], 'ArrowLeft')
    assert.equal(focused(), '⇤')
    assert.deepEqual(changes, ['Bullets', '⇤', 'Bold', '⇤'])
  })

  it('reverses the arrows in right-to-left text', async (t) => {
    let { $$, cleanup } = render(<Toolbar dir="rtl" />)
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    buttons[0].focus()
    press(buttons[0], 'ArrowLeft')
    assert.equal(focused(), 'Bullets')
    press(buttons[3], 'ArrowRight')
    assert.equal(focused(), 'Bold')
  })

  it('moves to the item matching typed text, by label or text', async (t) => {
    let { $$, cleanup } = render(<Toolbar typeahead />)
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    buttons[0].focus()
    press(buttons[0], 'b')
    assert.equal(focused(), 'Bullets')
    press(buttons[3], 'a')
    assert.equal(focused(), 'Bullets')
    await new Promise((resolve) => setTimeout(resolve, 600))
    press(buttons[3], 'a')
    assert.equal(focused(), '⇤')
    press(buttons[4], 'u')
    assert.equal(focused(), '⇤', 'skips the aria-disabled Underline')
  })

  it('makes a focused item active and starts at the selected item', async (t) => {
    let { $$, cleanup } = render(
      <div role="tablist" mix={rovingFocus({ items: '[role=tab]', orientation: 'horizontal' })}>
        <button role="tab" aria-selected="false" type="button">
          One
        </button>
        <button role="tab" aria-selected="true" type="button">
          Two
        </button>
        <button role="tab" aria-selected="false" type="button">
          Three
        </button>
      </div>,
    )
    t.after(cleanup)
    let tabs = $$('[role=tab]') as NodeListOf<HTMLButtonElement>

    assert.equal(tabs[1].getAttribute('tabindex'), '0')
    tabs[2].focus()
    assert.equal(tabs[2].getAttribute('tabindex'), '0')
    assert.equal(tabs[1].getAttribute('tabindex'), '-1')
  })

  it('moves the tab stop back to the selected item when focus leaves, with resetOnLeave', async (t) => {
    let { $$, cleanup } = render(
      <div>
        <div role="tablist" mix={rovingFocus({ items: '[role=tab]', orientation: 'horizontal', resetOnLeave: true })}>
          <button role="tab" aria-selected="true" type="button">
            One
          </button>
          <button role="tab" aria-selected="false" type="button">
            Two
          </button>
        </div>
        <input aria-label="Note" />
      </div>,
    )
    t.after(cleanup)
    let tabs = $$('[role=tab]') as NodeListOf<HTMLButtonElement>

    tabs[0].focus()
    press(tabs[0], 'ArrowRight')
    assert.equal(tabs[1].getAttribute('tabindex'), '0')

    ;($$('input')[0] as HTMLInputElement).focus()
    assert.equal(tabs[0].getAttribute('tabindex'), '0')
    assert.equal(tabs[1].getAttribute('tabindex'), '-1')
  })

  it('moves the tab stop with the selection while focus is outside, with resetOnLeave', async (t) => {
    let { $$, cleanup } = render(
      <div role="tablist" mix={rovingFocus({ items: '[role=tab]', orientation: 'horizontal', resetOnLeave: true })}>
        <button role="tab" aria-selected="true" type="button">
          One
        </button>
        <button role="tab" aria-selected="false" type="button">
          Two
        </button>
        <button role="tab" aria-selected="false" type="button">
          Three
        </button>
      </div>,
    )
    t.after(cleanup)
    let tabs = $$('[role=tab]') as NodeListOf<HTMLButtonElement>

    tabs[0].setAttribute('aria-selected', 'false')
    tabs[1].setAttribute('aria-selected', 'true')
    await new Promise((resolve) => setTimeout(resolve))
    assert.deepEqual(
      [...tabs].map((tab) => tab.getAttribute('tabindex')),
      ['-1', '0', '-1'],
    )

    // Inside the group, the arrows still move the tab stop away from the selected item.
    tabs[1].focus()
    press(tabs[1], 'ArrowRight')
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(document.activeElement, tabs[2])
    assert.equal(tabs[2].getAttribute('tabindex'), '0')
  })

  it('moves the tab stop when the active item becomes disabled or is removed', async (t) => {
    let { $$, cleanup } = render(<Toolbar />)
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    buttons[0].disabled = true
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(buttons[3].getAttribute('tabindex'), '0')

    buttons[3].remove()
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(buttons[4].getAttribute('tabindex'), '0')
  })

  it('starts at the pressed item, as it does at a selected one', async (t) => {
    let { $$, cleanup } = render(
      <div role="group" mix={rovingFocus({ items: 'button' })}>
        <button type="button" aria-pressed="false">
          Bold
        </button>
        <button type="button" aria-pressed="true">
          Italic
        </button>
      </div>,
    )
    t.after(cleanup)

    assert.deepEqual(
      [...$$('button')].map((button) => button.getAttribute('tabindex')),
      ['-1', '0'],
    )
  })

  it('skips hidden and inert items for the tab stop and the arrow keys', async (t) => {
    let { $$, cleanup } = render(
      <div role="toolbar" mix={rovingFocus({ items: 'button', orientation: 'horizontal' })}>
        <button type="button" style={{ display: 'none' }}>
          One
        </button>
        <button type="button">Two</button>
        <button type="button" style={{ visibility: 'hidden' }}>
          Three
        </button>
        <span inert>
          <button type="button">Four</button>
        </span>
        <button type="button">Five</button>
      </div>,
    )
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    assert.deepEqual(
      [...buttons].map((button) => button.getAttribute('tabindex')),
      ['-1', '0', '-1', '-1', '-1'],
    )
    buttons[1].focus()
    press(buttons[1], 'ArrowRight')
    assert.equal(focused(), 'Five')
    press(buttons[4], 'ArrowRight')
    assert.equal(focused(), 'Two')
    press(buttons[1], 'End')
    assert.equal(focused(), 'Five')
  })

  it('moves the tab stop off an item a style sheet hides before Tab moves focus', async (t) => {
    let { $, $$, cleanup } = render(
      <div>
        <style>
          {'.no-grid [data-view="grid"] { visibility: hidden } .no-list [data-view="list"] { display: none }'}
        </style>
        <div role="toolbar" mix={rovingFocus({ items: 'button' })}>
          <button type="button" data-view="grid">
            Grid
          </button>
          <button type="button" data-view="list">
            List
          </button>
          <button type="button" data-view="table">
            Table
          </button>
        </div>
      </div>,
    )
    t.after(cleanup)
    let wrapper = $('div') as HTMLElement
    let tabStops = () => [...$$('button')].filter((button) => button.getAttribute('tabindex') === '0').map(focusedText)

    // A class outside the group changes no attribute the group observes and no
    // item's size, so the group checks its items when Tab is pressed.
    wrapper.classList.add('no-grid')
    press(document.body, 'Tab')
    assert.deepEqual(tabStops(), ['List'])

    wrapper.classList.add('no-list')
    press(document.body, 'Tab')
    assert.deepEqual(tabStops(), ['Table'])
  })

  it('leaves the items of a nested roving group to that group', async (t) => {
    let { $$, cleanup } = render(
      <div role="toolbar" mix={rovingFocus({ items: 'button', orientation: 'horizontal' })}>
        <button type="button">One</button>
        <div role="group" mix={rovingFocus({ items: 'button', orientation: 'horizontal' })}>
          <button type="button">Two</button>
          <button type="button">Three</button>
        </div>
        <button type="button">Four</button>
      </div>,
    )
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    assert.deepEqual(
      [...buttons].map((button) => button.getAttribute('tabindex')),
      ['0', '0', '-1', '-1'],
    )
    buttons[0].focus()
    press(buttons[0], 'ArrowRight')
    assert.equal(focused(), 'Four')
    buttons[1].focus()
    press(buttons[1], 'ArrowRight')
    assert.equal(focused(), 'Three')
    assert.equal(buttons[0].getAttribute('tabindex'), '-1', 'the outer group keeps Four as its tab stop')
    assert.equal(buttons[3].getAttribute('tabindex'), '0')
  })

  it('keeps focus in the group when the focused item is removed or disabled', async (t) => {
    let { $$, cleanup } = render(<Toolbar />)
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>

    buttons[3].focus()
    buttons[3].remove()
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(focused(), 'Bold')
    assert.equal(buttons[0].getAttribute('tabindex'), '0')

    buttons[0].disabled = true
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(focused(), '⇤')
    assert.equal(buttons[4].getAttribute('tabindex'), '0')
  })

  it('leaves focus alone when it left the group before an item changes', async (t) => {
    let { $$, cleanup } = render(
      <div>
        <Toolbar />
        <input aria-label="Note" />
      </div>,
    )
    t.after(cleanup)
    let buttons = $$('button') as NodeListOf<HTMLButtonElement>
    let note = $$('input')[0] as HTMLInputElement

    buttons[0].focus()
    note.focus()
    buttons[0].remove()
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(document.activeElement, note)

    buttons[3].focus()
    buttons[3].blur()
    await new Promise((resolve) => setTimeout(resolve))
    buttons[3].remove()
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(document.activeElement, document.body)
  })

  it('restores the original tabindex when the mixin goes away', async (t) => {
    let { $$, act, root, cleanup } = render(
      <div mix={rovingFocus({ items: 'button' })}>
        <button type="button" tabindex={2}>
          One
        </button>
        <button type="button">Two</button>
      </div>,
    )
    t.after(cleanup)
    let buttons = $$('button')
    assert.equal(buttons[0].getAttribute('tabindex'), '0')

    await act(() =>
      root.render(
        <div>
          <button type="button" tabindex={2}>
            One
          </button>
          <button type="button">Two</button>
        </div>,
      ),
    )
    assert.equal(buttons[0].getAttribute('tabindex'), '2')
    assert.equal(buttons[1].hasAttribute('tabindex'), false)
  })

  it('refuses to share a control with activeDescendant', (t) => {
    t.mock.method(console, 'error', () => {})
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<div mix={[rovingFocus({ items: 'li' }), activeDescendant({ items: 'li' })]} />)
    root.flush()

    assert.match(String(errors[0]), /either roving focus or active descendant/)
  })

  it('lets a control switch from roving focus to active descendant', async (t) => {
    let { act, root, cleanup } = render(<ul mix={rovingFocus({ items: 'li' })} />)
    t.after(cleanup)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push((event as ErrorEvent).error))

    await act(() => root.render(<ul mix={activeDescendant({ items: 'li' })} />))
    assert.deepEqual(errors, [])
  })
})

describe('activeDescendant', () => {
  function Listbox() {
    return () => (
      <ul role="listbox" tabindex={0} mix={activeDescendant({ items: '[role=option]', orientation: 'vertical' })}>
        <li role="option">Apple</li>
        <li role="option" aria-disabled="true">
          Apricot
        </li>
        <li role="option">Banana</li>
        <li role="option" id="cherry">
          Cherry
        </li>
      </ul>
    )
  }

  it('moves the highlight while focus stays on the owner', async (t) => {
    let { $, $$, cleanup } = render(<Listbox />)
    t.after(cleanup)
    let listbox = $('[role=listbox]') as HTMLElement
    let options = $$('[role=option]')
    listbox.focus()

    press(listbox, 'ArrowDown')
    assert.equal(document.activeElement, listbox)
    assert.equal(listbox.getAttribute('aria-activedescendant'), options[0].id)
    assert.ok(options[0].id)
    assert.ok(options[0].hasAttribute('data-highlighted'))

    press(listbox, 'ArrowDown')
    assert.equal(listbox.getAttribute('aria-activedescendant'), options[2].id, 'skips the disabled option')
    assert.ok(!options[0].hasAttribute('data-highlighted'))

    press(listbox, 'End')
    assert.equal(listbox.getAttribute('aria-activedescendant'), 'cherry', 'keeps an existing id')
    press(listbox, 'a')
    assert.equal(listbox.getAttribute('aria-activedescendant'), options[0].id)
  })

  it('leaves Home, End and typing to a text field and reads items from a function', async (t) => {
    let { $, $$, cleanup } = render(
      <div>
        <input
          role="combobox"
          mix={activeDescendant({
            items: () => $$('[role=option]') as NodeListOf<HTMLElement>,
            orientation: 'vertical',
          })}
        />
        <ul role="listbox">
          <li role="option">Apple</li>
          <li role="option">Banana</li>
        </ul>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement
    let options = $$('[role=option]')
    input.focus()

    press(input, 'ArrowUp')
    assert.equal(input.getAttribute('aria-activedescendant'), options[1].id)
    assert.equal(press(input, 'Home').defaultPrevented, false)
    assert.equal(press(input, 'a').defaultPrevented, false)
    assert.equal(press(input, 'ArrowLeft').defaultPrevented, false)
    assert.equal(input.getAttribute('aria-activedescendant'), options[1].id)
  })

  it('moves the highlight with Home and End on a text field that asks for them', async (t) => {
    let { $, $$, cleanup } = render(
      <div>
        <input
          role="combobox"
          mix={activeDescendant({
            items: () => $$('[role=option]') as NodeListOf<HTMLElement>,
            orientation: 'vertical',
            homeAndEnd: true,
          })}
        />
        <ul role="listbox">
          <li role="option">Apple</li>
          <li role="option">Banana</li>
          <li role="option">Cherry</li>
        </ul>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement
    let options = $$('[role=option]')
    input.focus()

    assert.equal(press(input, 'End').defaultPrevented, true)
    assert.equal(input.getAttribute('aria-activedescendant'), options[2].id)
    assert.equal(press(input, 'Home').defaultPrevented, true)
    assert.equal(input.getAttribute('aria-activedescendant'), options[0].id)
    assert.equal(press(input, 'a').defaultPrevented, false, 'typing still edits the text')

    let composing = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(composing)
    assert.equal(composing.defaultPrevented, false, 'keys that pick a character in an input method stay with it')
    assert.equal(input.getAttribute('aria-activedescendant'), options[0].id)
  })

  it('maps other keys onto the navigation keys', async (t) => {
    let { $, $$, cleanup } = render(
      <div>
        <input
          role="combobox"
          mix={activeDescendant({
            items: () => $$('[role=option]') as NodeListOf<HTMLElement>,
            orientation: 'vertical',
            loop: false,
            keyAliases: (event) =>
              event.ctrlKey && event.key === 'n'
                ? 'ArrowDown'
                : event.metaKey && event.key === 'ArrowDown'
                  ? 'End'
                  : undefined,
          })}
        />
        <ul role="listbox">
          <li role="option">Apple</li>
          <li role="option" aria-disabled="true">
            Apricot
          </li>
          <li role="option">Banana</li>
          <li role="option">Cherry</li>
        </ul>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement
    let options = $$('[role=option]')
    input.focus()

    let press = (key: string, init: KeyboardEventInit = {}) => {
      let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
      input.dispatchEvent(event)
      return event
    }

    assert.equal(press('n', { ctrlKey: true }).defaultPrevented, true)
    assert.equal(input.getAttribute('aria-activedescendant'), options[0].id)
    press('n', { ctrlKey: true })
    assert.equal(input.getAttribute('aria-activedescendant'), options[2].id, 'an alias skips disabled items too')
    press('ArrowDown', { metaKey: true })
    assert.equal(input.getAttribute('aria-activedescendant'), options[3].id)
    assert.equal(press('b', { ctrlKey: true }).defaultPrevented, false, 'other modified keys stay with the browser')
    assert.equal(press('ArrowUp', { metaKey: true }).defaultPrevented, false)
  })

  it('lets the owner render the highlight from its own state', async (t) => {
    let highlighted: HTMLElement[] = []
    let { $, $$, cleanup } = render(
      <div>
        <input
          role="combobox"
          mix={activeDescendant({
            items: () => $$('[role=option]') as NodeListOf<HTMLElement>,
            orientation: 'vertical',
            highlight: (item) => highlighted.push(item),
          })}
        />
        <ul role="listbox">
          <li role="option" id="apple">
            Apple
          </li>
          <li role="option" id="banana">
            Banana
          </li>
        </ul>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement
    let options = $$('[role=option]')
    input.focus()

    assert.equal(press(input, 'ArrowDown').defaultPrevented, true)
    assert.deepEqual(highlighted, [options[0]])
    assert.equal(input.hasAttribute('aria-activedescendant'), false, 'the owner writes the highlight')
    assert.equal(options[0].hasAttribute('data-highlighted'), false)

    input.setAttribute('aria-activedescendant', 'apple')
    press(input, 'ArrowDown')
    assert.deepEqual(highlighted, [options[0], options[1]], 'the next key starts from the highlight the owner rendered')
  })

  it('steps from the item the owner names as current, before its render shows it', async (t) => {
    let current: HTMLElement | null = null
    let highlighted: HTMLElement[] = []
    let { $, $$, cleanup } = render(
      <div>
        <input
          role="combobox"
          mix={activeDescendant({
            items: () => $$('[role=option]') as NodeListOf<HTMLElement>,
            orientation: 'vertical',
            current: () => current,
            highlight: (item) => {
              highlighted.push(item)
              current = item
            },
          })}
        />
        <ul role="listbox">
          <li role="option" id="apple">
            Apple
          </li>
          <li role="option" id="banana">
            Banana
          </li>
          <li role="option" id="cherry">
            Cherry
          </li>
        </ul>
      </div>,
    )
    t.after(cleanup)
    let input = $('input') as HTMLInputElement
    let options = $$('[role=option]')
    input.focus()

    // Two keys before any render writes aria-activedescendant.
    press(input, 'ArrowDown')
    press(input, 'ArrowDown')
    assert.deepEqual(
      highlighted.map((item) => item.id),
      [options[0].id, options[1].id],
    )
    assert.equal(input.hasAttribute('aria-activedescendant'), false)
  })

  it('lets pointer hover and filtering set the highlight, and clears it on removal', async (t) => {
    let { $, $$, act, root, cleanup } = render(<Listbox />)
    t.after(cleanup)
    let listbox = $('[role=listbox]') as HTMLElement
    let options = $$('[role=option]') as NodeListOf<HTMLElement>

    highlightItem(listbox, options[2])
    press(listbox, 'ArrowDown')
    assert.equal(listbox.getAttribute('aria-activedescendant'), 'cherry')

    await act(() => root.render(<ul role="listbox" />))
    assert.equal(listbox.hasAttribute('aria-activedescendant'), false)
  })
})
