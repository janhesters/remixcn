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
