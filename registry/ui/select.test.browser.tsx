import { renderToString } from 'remix/component/server'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './select.tsx'
import type { SelectContentProps, SelectProps, SelectValueChangeDetails } from './select.tsx'

// Browser tests run without theme.css, so the tokens the layout reads are set here.
const tokens = '--spacing: 0.25rem; --text-sm: 0.875rem; --text-sm--line-height: 1.25rem; --radius-md: 6px;'

function mount(t: TestContext, node: RemixNode, container?: HTMLElement) {
  let result = render(<div style={tokens}>{node}</div>, container ? { container } : undefined)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
  })
  return result
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Lets the renders, tasks and the positioning frame run. */
async function settle() {
  for (let round = 0; round < 4; round++) await wait()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await wait()
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

/** A mouse press on `element`, as the browser sends it. */
async function press(element: Element, pointerType = 'mouse') {
  let at = center(element)
  let init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    pointerType,
    button: 0,
    ...at,
  }
  element.dispatchEvent(new PointerEvent('pointerdown', init))
  element.dispatchEvent(new PointerEvent('pointerup', init))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...at }))
  await settle()
}

async function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  await settle()
  return event
}

async function type(target: Element, text: string) {
  for (let character of text) await key(target, character)
}

function parts(root: ParentNode = document) {
  let trigger = root.querySelector<HTMLButtonElement>('[data-slot="select-trigger"]')!
  let native = root.querySelector<HTMLSelectElement>('select')!
  let content = root.querySelector<HTMLElement>('[data-slot="select-content"]')!
  let list = root.querySelector<HTMLElement>('[role="listbox"]')!
  return { trigger, native, content, list }
}

function isOpen(content: HTMLElement) {
  return content.matches(':popover-open')
}

/** The highlighted item's text, after checking the trigger points at it and it shows. */
function highlighted(trigger: HTMLElement) {
  let id = trigger.getAttribute('aria-activedescendant')
  if (!id) return null
  let option = document.getElementById(id)
  assert.ok(option, `aria-activedescendant points at ${id}, which isn't in the document`)
  assert.ok(option.hasAttribute('data-highlighted'))
  assert.ok(option.getClientRects().length > 0, `${option.textContent} shows`)
  return option.textContent?.trim() ?? ''
}

function item(root: ParentNode, text: string) {
  let found = [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent?.trim() === text,
  )
  assert.ok(found, `no item ${text}`)
  return found
}

function valueText(trigger: HTMLElement) {
  return trigger.querySelector('[data-slot="select-value"]')?.textContent?.trim()
}

const fruits = ['Apple', 'Banana', 'Blueberry', 'Grapes', 'Pineapple']

type FruitProps = SelectProps & { content?: SelectContentProps; extra?: RemixNode; triggerId?: string }

function Fruit(handle: Handle<FruitProps>) {
  return () => {
    let { content = { alignItemWithTrigger: false }, extra, triggerId, ...props } = handle.props
    return (
      <Select name="fruit" {...props}>
        <SelectTrigger id={triggerId} aria-label={triggerId ? undefined : 'Fruit'}>
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent {...content}>
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            {fruits.map((fruit) => (
              <SelectItem key={fruit} value={fruit.toLowerCase()} disabled={fruit === 'Grapes'}>
                {fruit}
              </SelectItem>
            ))}
          </SelectGroup>
          {extra}
        </SelectContent>
      </Select>
    )
  }
}

function formValues(form: HTMLFormElement, name = 'fruit') {
  return new FormData(form).getAll(name)
}

describe('Select', () => {
  it('turns the native select into a hidden value holder and shows the trigger once it runs', async (t) => {
    let { container } = mount(
      t,
      <form>
        <label for="fruit">Fruit</label>
        <Fruit triggerId="fruit" defaultValue="banana" />
        <p id="fruit-help">Pick one.</p>
      </form>,
    )
    await settle()
    let { trigger, native } = parts(container)

    assert.equal(trigger.hasAttribute('data-pending'), false)
    assert.ok(trigger.getClientRects().length > 0)
    assert.equal(trigger.id, 'fruit')
    assert.notEqual(native.id, 'fruit')
    assert.equal(native.getAttribute('aria-hidden'), 'true')
    assert.equal(native.tabIndex, -1)
    assert.equal(container.querySelector('label')?.control, trigger, 'the label names the trigger')
    assert.equal(valueText(trigger), 'Banana')
    assert.deepEqual(formValues(container.querySelector('form')!), ['banana'])
  })

  it('opens on a press, highlights the chosen item, and chooses another with a click', async (t) => {
    let changes: Array<[unknown, string]> = []
    let { container } = mount(
      t,
      <form>
        <Fruit defaultValue="banana" onValueChange={(value, details) => void changes.push([value, details.reason])} />
      </form>,
    )
    await settle()
    let { trigger, content, native } = parts(container)
    let form = container.querySelector('form')!
    let events: string[] = []
    form.addEventListener('input', () => events.push(`input ${formValues(form)}`))
    form.addEventListener('change', () => events.push(`change ${formValues(form)}`))

    await press(trigger)
    assert.ok(isOpen(content))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(document.activeElement, trigger)
    assert.equal(highlighted(trigger), 'Banana')
    assert.equal(item(container, 'Banana').getAttribute('aria-selected'), 'true')

    item(container, 'Pineapple').click()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Pineapple')
    assert.equal(native.value, 'pineapple')
    assert.deepEqual(changes, [['pineapple', 'item-press']])
    assert.deepEqual(events, ['input pineapple', 'change pineapple'])
    assert.equal(document.activeElement, trigger)
  })

  it('moves the highlight with the keyboard and chooses with Enter', async (t) => {
    let { container } = mount(t, <Fruit />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()

    await key(trigger, 'ArrowDown')
    assert.ok(isOpen(content))
    assert.equal(highlighted(trigger), 'Apple')
    await key(trigger, 'ArrowDown')
    assert.equal(highlighted(trigger), 'Banana')
    await key(trigger, 'End')
    assert.equal(highlighted(trigger), 'Pineapple')
    await key(trigger, 'ArrowUp')
    assert.equal(highlighted(trigger), 'Blueberry', 'the disabled Grapes is skipped')
    await key(trigger, 'Home')
    assert.equal(highlighted(trigger), 'Apple')
    await key(trigger, 'ArrowUp')
    assert.equal(highlighted(trigger), 'Apple', 'the list doesn’t wrap')

    await key(trigger, 'ArrowDown')
    await key(trigger, 'Enter')
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Banana')
    assert.equal(trigger.hasAttribute('aria-activedescendant'), false)
  })

  it('opens with Space, Enter, Home and End, and chooses with Space', async (t) => {
    let { container } = mount(t, <Fruit defaultValue="blueberry" />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()

    await key(trigger, ' ')
    assert.equal(highlighted(trigger), 'Blueberry')
    await key(trigger, 'ArrowDown')
    await key(trigger, ' ')
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Pineapple')

    await key(trigger, 'Home')
    assert.equal(highlighted(trigger), 'Apple')
    await key(trigger, 'Escape')
    await key(trigger, 'End')
    assert.equal(highlighted(trigger), 'Pineapple')
    await key(trigger, 'Escape')
    await key(trigger, 'Enter')
    assert.equal(highlighted(trigger), 'Pineapple')
  })

  it('closes on Escape, and on Tab with focus moving on, without changing the value', async (t) => {
    let changes: unknown[] = []
    let { container } = mount(
      t,
      <div>
        <button type="button">Before</button>
        <Fruit defaultValue="apple" onValueChange={(value) => void changes.push(value)} />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let [before, after] = container.querySelectorAll<HTMLButtonElement>('button[type="button"]:not([role])')
    trigger.focus()

    await key(trigger, 'ArrowDown')
    await key(trigger, 'ArrowDown')
    assert.equal(highlighted(trigger), 'Banana')
    let escape = await key(trigger, 'Escape')
    assert.ok(escape.defaultPrevented)
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Apple')

    // The open list keeps the page inert, so the select moves focus on itself once the page is back.
    await key(trigger, 'ArrowDown')
    assert.ok(after.closest('[inert]'))
    await key(trigger, 'Tab')
    await wait(10)
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, after)
    assert.equal(after.closest('[inert]'), null)

    trigger.focus()
    await key(trigger, 'ArrowDown')
    await key(trigger, 'Tab', { shiftKey: true })
    await wait(10)
    assert.equal(document.activeElement, before)
    assert.equal(valueText(trigger), 'Apple')
    assert.deepEqual(changes, [])
  })

  it('leaves Tab to the browser when the select isn’t modal', async (t) => {
    let { container } = mount(t, <Fruit modal={false} />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()

    await key(trigger, 'ArrowDown')
    assert.equal(document.querySelector('[inert]'), null)
    let tab = await key(trigger, 'Tab')
    assert.equal(tab.defaultPrevented, false)
    assert.equal(isOpen(content), false)
  })

  it('finds items by typing, in the open list and on the closed trigger', async (t) => {
    let { container } = mount(t, <Fruit />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.focus()

    // Closed, typing chooses, as a native select does.
    await type(trigger, 'b')
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Banana')
    await type(trigger, 'b')
    assert.equal(valueText(trigger), 'Blueberry', 'the same letter again cycles')
    await wait(600)

    await key(trigger, 'ArrowDown')
    await type(trigger, 'pi')
    assert.equal(highlighted(trigger), 'Pineapple')
    await wait(600)
    await type(trigger, 'g')
    assert.equal(highlighted(trigger), 'Pineapple', 'the disabled Grapes never lights up')
  })

  it('keeps a typed word across the renders its letters cause on the closed trigger', async (t) => {
    let { container } = mount(t, <Fruit />)
    await settle()
    let { trigger } = parts(container)
    trigger.focus()

    await key(trigger, 'b')
    assert.equal(valueText(trigger), 'Banana')
    await wait(100)
    await key(trigger, 'l')
    assert.equal(valueText(trigger), 'Blueberry', 'b, then l, finds Blueberry')
  })

  it('keeps disabled items and the items of a disabled group from being chosen', async (t) => {
    let { container } = mount(
      t,
      <Fruit
        extra={
          <SelectGroup disabled>
            <SelectLabel>Sold out</SelectLabel>
            <SelectItem value="mango">Mango</SelectItem>
          </SelectGroup>
        }
      />,
    )
    await settle()
    let { trigger } = parts(container)

    await press(trigger)
    item(container, 'Grapes').click()
    item(container, 'Mango').click()
    await settle()
    assert.equal(valueText(trigger), 'Select a fruit')
    assert.equal(item(container, 'Mango').getAttribute('aria-disabled'), 'true')
    await key(trigger, 'End')
    assert.equal(highlighted(trigger), 'Pineapple')
    let mango = [...parts(container).native.options].find((option) => option.value === 'mango')!
    assert.ok(mango.disabled)
  })

  it('shows the placeholder until a choice, and an item without a value clears it', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Select name="theme">
          <SelectTrigger aria-label="Theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={null}>Select a theme</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </form>,
    )
    await settle()
    let { trigger } = parts(container)
    let form = container.querySelector('form')!

    assert.ok(trigger.hasAttribute('data-placeholder'))
    assert.equal(valueText(trigger), 'Select a theme')
    assert.deepEqual(formValues(form, 'theme'), [''])

    await press(trigger)
    item(container, 'Dark').click()
    await settle()
    assert.equal(trigger.hasAttribute('data-placeholder'), false)
    assert.deepEqual(formValues(form, 'theme'), ['dark'])

    await press(trigger)
    item(container, 'Select a theme').click()
    await settle()
    assert.ok(trigger.hasAttribute('data-placeholder'))
    assert.deepEqual(formValues(form, 'theme'), [''])
  })

  it('asks a controlled owner, and shows only the value it renders', async (t) => {
    let calls: Array<[unknown, SelectValueChangeDetails['reason']]> = []
    let accept = false
    function Controlled(handle: Handle) {
      let value = 'apple'
      return () => (
        <form>
          <Fruit
            value={value}
            onValueChange={(next, details) => {
              calls.push([next, details.reason])
              if (!accept) return
              value = next ?? ''
              void handle.update()
            }}
          />
        </form>
      )
    }
    let { container } = mount(t, <Controlled />)
    await settle()
    let { trigger, native } = parts(container)

    await press(trigger)
    item(container, 'Banana').click()
    await settle()
    assert.equal(valueText(trigger), 'Apple', 'the owner declined')
    assert.equal(native.value, 'apple')

    accept = true
    await press(trigger)
    item(container, 'Blueberry').click()
    await settle()
    assert.equal(valueText(trigger), 'Blueberry')
    assert.equal(native.value, 'blueberry')
    assert.deepEqual(calls, [
      ['banana', 'item-press'],
      ['blueberry', 'item-press'],
    ])
  })

  it('cancels a change from onValueChange', async (t) => {
    let { container } = mount(t, <Fruit defaultValue="apple" onValueChange={(_value, details) => details.cancel()} />)
    await settle()
    let { trigger, native } = parts(container)

    await press(trigger)
    item(container, 'Banana').click()
    await settle()
    assert.equal(valueText(trigger), 'Apple')
    assert.equal(native.value, 'apple')
  })

  it('returns to the default value on a form reset', async (t) => {
    let changes: unknown[] = []
    let { container } = mount(
      t,
      <form>
        <Fruit defaultValue="banana" onValueChange={(value, details) => void changes.push([value, details.reason])} />
        <button type="reset">Reset</button>
      </form>,
    )
    await settle()
    let { trigger } = parts(container)
    let form = container.querySelector('form')!

    await press(trigger)
    item(container, 'Apple').click()
    await settle()
    assert.deepEqual(formValues(form), ['apple'])

    container.querySelector<HTMLButtonElement>('button[type="reset"]')!.click()
    await wait(20)
    await settle()
    assert.equal(valueText(trigger), 'Banana')
    assert.deepEqual(formValues(form), ['banana'])
    assert.deepEqual(changes, [
      ['apple', 'item-press'],
      ['banana', 'reset'],
    ])
  })

  it('submits a chosen item of a disabled group, which the list never offers again', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Fruit
          defaultValue="mango"
          extra={
            <SelectGroup disabled>
              <SelectLabel>Sold out</SelectLabel>
              <SelectItem value="mango">Mango</SelectItem>
              <SelectItem value="papaya">Papaya</SelectItem>
            </SelectGroup>
          }
        />
      </form>,
    )
    await settle()
    let { trigger, native } = parts(container)
    let form = container.querySelector('form')!

    assert.equal(valueText(trigger), 'Mango')
    assert.deepEqual(formValues(form), ['mango'])
    let papaya = [...native.options].find((option) => option.value === 'papaya')!
    assert.ok(papaya.disabled, 'the rest of the group stays off')
  })

  it('returns to a default value without an item on a form reset, also a changed one', async (t) => {
    let setDefault: (value: string) => void = () => {}
    function Host(handle: Handle) {
      let defaultValue = 'kiwi'
      setDefault = (value) => {
        defaultValue = value
        void handle.update()
      }
      return () => (
        <form>
          <Fruit defaultValue={defaultValue} />
          <button type="reset">Reset</button>
        </form>
      )
    }
    let { container } = mount(t, <Host />)
    await settle()
    let { trigger } = parts(container)
    let form = container.querySelector('form')!
    let reset = async () => {
      form.reset()
      await wait(20)
      await settle()
    }

    assert.deepEqual(formValues(form), ['kiwi'])
    await press(trigger)
    item(container, 'Apple').click()
    await settle()
    assert.deepEqual(formValues(form), ['apple'])
    await reset()
    assert.equal(valueText(trigger), 'kiwi')
    assert.deepEqual(formValues(form), ['kiwi'])

    setDefault('lime')
    await settle()
    assert.deepEqual(formValues(form), ['kiwi'], 'a new default doesn’t change the choice')
    await reset()
    assert.equal(valueText(trigger), 'lime')
    assert.deepEqual(formValues(form), ['lime'])
  })

  it('follows an item that a component of yours updates on its own', async (t) => {
    let rename: (label: string) => void = () => {}
    function Items(handle: Handle) {
      let label = 'Banana'
      rename = (next) => {
        label = next
        void handle.update()
      }
      return () => [
        <SelectItem key="apple" value="apple">
          Apple
        </SelectItem>,
        <SelectItem key="banana" value="banana">
          {label}
        </SelectItem>,
      ]
    }
    let { container } = mount(
      t,
      <Select name="fruit" defaultValue="banana">
        <SelectTrigger aria-label="Fruit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <Items />
        </SelectContent>
      </Select>,
    )
    await settle()
    let { trigger, native } = parts(container)
    assert.equal(valueText(trigger), 'Banana')

    rename('Ripe banana')
    await settle()
    assert.equal(valueText(trigger), 'Ripe banana')
    assert.equal(native.selectedOptions[0]?.textContent, 'Ripe banana')
  })

  it('follows items that a component of yours mounts later, on its own', async (t) => {
    let load: () => void = () => {}
    function LoadedItems(handle: Handle) {
      let loaded = false
      load = () => {
        loaded = true
        void handle.update()
      }
      return () =>
        loaded ? (
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectGroup>
        ) : null
    }
    let { container } = mount(
      t,
      <Select name="fruit" defaultValue="banana">
        <SelectTrigger aria-label="Fruit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <LoadedItems />
        </SelectContent>
      </Select>,
    )
    await settle()
    let { trigger, native } = parts(container)
    assert.equal(valueText(trigger), 'banana', 'the raw value, until its item loads')

    load()
    await settle()
    assert.equal(valueText(trigger), 'Banana')
    assert.deepEqual(
      [...native.options].map((option) => `${option.value}:${option.textContent}`),
      [':', 'apple:Apple', 'banana:Banana'],
    )
    assert.equal(native.querySelector('optgroup')?.label, 'Fruits')
    assert.equal(native.value, 'banana')
  })

  it('chooses several items in a multiple select, which stays open', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Fruit multiple defaultValue={['blueberry']} />
      </form>,
    )
    await settle()
    let { trigger, content, native, list } = parts(container)
    let form = container.querySelector('form')!

    assert.ok(native.multiple)
    assert.equal(list.getAttribute('aria-multiselectable'), 'true')
    await press(trigger)
    item(container, 'Apple').click()
    await settle()
    assert.ok(isOpen(content))
    await key(trigger, 'End')
    await key(trigger, 'Enter')
    assert.ok(isOpen(content))
    assert.deepEqual(formValues(form), ['apple', 'blueberry', 'pineapple'])
    assert.equal(valueText(trigger), 'Apple, Blueberry, Pineapple')

    item(container, 'Blueberry').click()
    await settle()
    assert.deepEqual(formValues(form), ['apple', 'pineapple'])
    assert.equal(item(container, 'Blueberry').getAttribute('aria-selected'), 'false')
  })

  it('follows items that come and go, also while the list is open', async (t) => {
    let set: (next: string[]) => void = () => {}
    function Dynamic(handle: Handle) {
      let names = ['Apple', 'Banana', 'Cherry']
      set = (next) => {
        names = next
        void handle.update()
      }
      return () => (
        <Select name="fruit" defaultValue="banana">
          <SelectTrigger aria-label="Fruit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {names.map((name) => (
              <SelectItem key={name} value={name.toLowerCase()}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    let { container } = mount(t, <Dynamic />)
    await settle()
    let { trigger, native } = parts(container)

    trigger.focus()
    await key(trigger, 'ArrowDown')
    await key(trigger, 'ArrowDown')
    assert.equal(highlighted(trigger), 'Cherry')

    set(['Apple', 'Banana', 'Date'])
    await settle()
    assert.equal(highlighted(trigger), 'Banana', 'the highlight moves back to the chosen item')
    assert.deepEqual(
      [...native.options].map((option) => option.value),
      ['', 'apple', 'banana', 'date'],
    )
    await key(trigger, 'End')
    assert.equal(highlighted(trigger), 'Date')

    // The chosen item goes: the value stays, and the form keeps submitting it.
    set(['Apple', 'Date'])
    await settle()
    assert.equal(valueText(trigger), 'banana')
    assert.equal(native.value, 'banana')
    assert.equal(item(container, 'Apple').getAttribute('aria-selected'), 'false')
  })

  it('keeps the server’s choice through hydration when nobody changed it', async (t) => {
    let changes: unknown[] = []
    let node = (
      <div style={tokens}>
        <Fruit defaultValue="banana" onValueChange={(value) => void changes.push(value)} />
      </div>
    )
    let container = document.createElement('div')
    container.innerHTML = (await renderToString(node)).replace(/<head>[\s\S]*?<\/head>/, '')
    document.body.append(container)

    let { cleanup } = render(node, { container })
    t.after(cleanup)
    await settle()
    await settle()
    let { trigger, native } = parts(container)

    assert.equal(native.value, 'banana')
    assert.equal(valueText(trigger), 'Banana')
    assert.equal(trigger.hasAttribute('data-pending'), false)
    assert.deepEqual(changes, [])
  })

  it('hands a failed required check to the trigger', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Fruit required />
        <button>Submit</button>
      </form>,
    )
    await settle()
    let { trigger, native } = parts(container)
    let form = container.querySelector('form')!

    assert.equal(trigger.getAttribute('aria-required'), 'true')
    assert.equal(form.checkValidity(), false)
    native.dispatchEvent(new Event('invalid', { cancelable: true }))
    native.focus()
    await settle()
    assert.equal(document.activeElement, trigger, 'focus goes on to the trigger')
    assert.equal(trigger.getAttribute('aria-invalid'), 'true')
    let box = native.parentElement!.getBoundingClientRect()
    let target = trigger.getBoundingClientRect()
    assert.ok(
      Math.abs(box.left - target.left) < 1 && Math.abs(box.top - target.top) < 1,
      'the select sits over the trigger',
    )

    await press(trigger)
    item(container, 'Apple').click()
    await settle()
    assert.equal(trigger.hasAttribute('aria-invalid'), false)
    assert.ok(form.checkValidity())
  })

  it('submits one value from one control', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Fruit defaultValue="apple" />
        <Fruit defaultValue="banana" />
      </form>,
    )
    await settle()
    let form = container.querySelector('form')!

    assert.deepEqual(formValues(form), ['apple', 'banana'])
    assert.equal(container.querySelectorAll('[name]').length, 2)
    let [first, second] = container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]')
    await press(first)
    assert.equal(getOpenLayers(document).length, 1)
    item(container, 'Blueberry').click()
    await settle()
    assert.deepEqual(formValues(form), ['blueberry', 'banana'])
    assert.equal(valueText(second), 'Banana')
  })

  it('keeps the highlighted item of a long list in view without scrolling the page', async (t) => {
    let numbers = Array.from({ length: 60 }, (_, index) => `Item ${index}`)
    let { container } = mount(
      t,
      <Select name="item">
        <SelectTrigger aria-label="Item">
          <SelectValue placeholder="Pick an item" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {numbers.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    await settle()
    let { trigger, list, content } = parts(container)
    let pageScroll = document.scrollingElement!.scrollTop

    trigger.focus()
    await key(trigger, 'ArrowDown')
    assert.ok(list.scrollHeight > list.clientHeight, 'the list scrolls')
    let down = content.querySelector<HTMLElement>('[data-slot="select-scroll-down-button"]')!
    let up = content.querySelector<HTMLElement>('[data-slot="select-scroll-up-button"]')!
    assert.ok(down.hasAttribute('data-visible'))
    assert.equal(up.hasAttribute('data-visible'), false)

    await key(trigger, 'End')
    assert.equal(highlighted(trigger), 'Item 59')
    let rect = item(container, 'Item 59').getBoundingClientRect()
    let box = list.getBoundingClientRect()
    assert.ok(rect.bottom <= box.bottom + 1 && rect.top >= box.top - 1, 'the last item shows')
    assert.ok(up.hasAttribute('data-visible'))
    assert.equal(down.hasAttribute('data-visible'), false)
    assert.equal(document.scrollingElement!.scrollTop, pageScroll)
  })

  it('lines the chosen item up with the value, and opens beside the trigger near an edge', async (t) => {
    let { container } = mount(
      t,
      <div style="padding: 200px 40px;">
        <Fruit defaultValue="blueberry" content={{}} />
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    await press(trigger)
    assert.equal(content.getAttribute('data-side'), 'none')
    let text = item(container, 'Blueberry').querySelector('[data-slot="select-item-text"]')!.getBoundingClientRect()
    let value = trigger.querySelector('[data-slot="select-value"]')!.getBoundingClientRect()
    assert.ok(Math.abs(text.left - value.left) <= 1, `text at ${text.left}, value at ${value.left}`)
    let triggerBox = trigger.getBoundingClientRect()
    let middle = (text.top + text.bottom) / 2
    assert.ok(Math.abs(middle - (triggerBox.top + triggerBox.bottom) / 2) <= 1)
    await key(trigger, 'Escape')

    // A touch opens it beside the trigger.
    await press(trigger, 'touch')
    assert.equal(content.getAttribute('data-side'), 'bottom')
  })

  it('opens beside the trigger when lining up doesn’t fit', async (t) => {
    let { container } = mount(
      t,
      <div style="position: fixed; top: 4px; left: 20px;">
        <Fruit defaultValue="pineapple" content={{}} />
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    await press(trigger)
    assert.ok(isOpen(content))
    assert.equal(content.getAttribute('data-side'), 'bottom')
    assert.ok(content.getBoundingClientRect().top >= trigger.getBoundingClientRect().bottom)
  })

  it('chooses with a press on the trigger dragged onto an item', async (t) => {
    let { container } = mount(t, <Fruit />)
    await settle()
    let { trigger, content } = parts(container)

    let start = center(trigger)
    trigger.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0, ...start }),
    )
    await settle()
    assert.ok(isOpen(content))
    let target = item(container, 'Banana')
    let end = center(target)
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', ...end }))
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', ...end }))
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(valueText(trigger), 'Banana')
  })

  it('highlights an item under the pointer, and lets a label focus the trigger without opening it', async (t) => {
    let { container } = mount(
      t,
      <div>
        <label for="pick">Fruit</label>
        <Fruit triggerId="pick" />
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    container.querySelector('label')!.click()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    await press(trigger)
    item(container, 'Blueberry').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }))
    await settle()
    assert.equal(highlighted(trigger), 'Blueberry')
  })

  it('closes on a press outside and gives focus back to the trigger', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Fruit />
        <p>Outside</p>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    await press(trigger)
    assert.ok(isOpen(content))
    assert.ok(container.querySelector('p')!.closest('[inert]'), 'a modal select keeps the page still')
    await press(document.body)
    await wait(10)
    assert.equal(isOpen(content), false)
    assert.equal(container.querySelector('p')!.closest('[inert]'), null)
    assert.equal(document.activeElement, trigger)
  })

  it('reports open changes and lets a controlled owner keep it closed', async (t) => {
    let reasons: string[] = []
    let { container } = mount(
      t,
      <Fruit open={false} onOpenChange={(open, details) => void reasons.push(`${open} ${details.reason}`)} />,
    )
    await settle()
    let { trigger, content } = parts(container)

    await press(trigger)
    trigger.focus()
    await key(trigger, 'ArrowDown')
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, ['true trigger-press', 'true trigger-press'])
  })

  it('ignores the user while disabled, and closes when it turns off', async (t) => {
    let toggle: (disabled: boolean) => void = () => {}
    function Toggle(handle: Handle) {
      let disabled = false
      toggle = (next) => {
        disabled = next
        void handle.update()
      }
      return () => <Fruit disabled={disabled} />
    }
    let { container } = mount(t, <Toggle />)
    await settle()
    let { trigger, content, native } = parts(container)

    await press(trigger)
    assert.ok(isOpen(content))
    toggle(true)
    await settle()
    assert.equal(isOpen(content), false)
    assert.ok(trigger.disabled)
    assert.ok(native.disabled)
    await press(trigger)
    assert.equal(isOpen(content), false)
  })

  it('cleans up its layer, scroll lock and listeners when it goes away', async (t) => {
    let show: (shown: boolean) => void = () => {}
    function Host(handle: Handle) {
      let shown = true
      show = (next) => {
        shown = next
        void handle.update()
      }
      return () => (shown ? <Fruit /> : <p>Gone</p>)
    }
    let { container } = mount(t, <Host />)
    await settle()
    let { trigger } = parts(container)

    await press(trigger)
    assert.equal(getOpenLayers(document).length, 1)
    assert.equal(document.documentElement.style.overflowY, 'hidden')
    show(false)
    await settle()
    assert.equal(getOpenLayers(document).length, 0)
    assert.equal(document.documentElement.style.overflowY, '')
    assert.equal(document.querySelector('[inert]'), null)
  })

  it('names a group by a label that a component of yours renders', async (t) => {
    function Heading() {
      return () => <SelectLabel>Citrus</SelectLabel>
    }
    let { container } = mount(
      t,
      <Select name="citrus">
        <SelectTrigger aria-label="Citrus">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <Heading />
            <SelectItem value="lemon">Lemon</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    await settle()
    let group = container.querySelector('[role="group"]')!
    let label = container.querySelector('[data-slot="select-label"]')!

    assert.equal(group.getAttribute('aria-labelledby'), label.id)
    assert.equal(container.querySelector('optgroup')?.label, 'Citrus')
  })

  it('names the list after the trigger’s label', async (t) => {
    let { container } = mount(
      t,
      <div>
        <label for="named">Favorite fruit</label>
        <Fruit triggerId="named" />
      </div>,
    )
    await settle()
    let { trigger, list } = parts(container)

    await press(trigger)
    let labelledBy = list.getAttribute('aria-labelledby')
    assert.ok(labelledBy)
    assert.equal(document.getElementById(labelledBy)?.textContent, 'Favorite fruit')
  })
})
