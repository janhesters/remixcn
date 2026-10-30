import type { Handle, RemixNode } from 'remix/component'
import { on } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from './combobox.tsx'
import type { ComboboxInputValueChangeDetails, ComboboxMultipleProps, ComboboxSingleProps } from './combobox.tsx'

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
async function press(element: Element) {
  let at = center(element)
  let init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    pointerType: 'mouse',
    button: 0,
    ...at,
  }
  element.dispatchEvent(new PointerEvent('pointerdown', init))
  let down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...at })
  element.dispatchEvent(down)
  if (!down.defaultPrevented && element instanceof HTMLElement) element.focus()
  element.dispatchEvent(new PointerEvent('pointerup', init))
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, ...at }))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0, ...at }))
  await settle()
}

async function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  await settle()
  return event
}

/** Types into the input as the browser does: the text changes, then input fires. */
async function type(input: HTMLInputElement, text: string) {
  for (let character of text) {
    input.value += character
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: character }))
    await settle()
  }
}

async function replaceText(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: text === '' ? 'deleteContentBackward' : 'insertText' }),
  )
  await settle()
}

function parts(root: ParentNode = document) {
  let input = root.querySelector<HTMLInputElement>('input[role="combobox"]')!
  let native = root.querySelector<HTMLSelectElement>('select')!
  let content = root.querySelector<HTMLElement>('[data-slot="combobox-content"]')!
  let list = root.querySelector<HTMLElement>('[role="listbox"]')!
  let status = root.querySelector<HTMLElement>('[data-slot="combobox-status"]')!
  return { input, native, content, list, status }
}

function isOpen(content: HTMLElement) {
  return content.matches(':popover-open')
}

/** The highlighted item's text, after checking the input points at it and it shows. */
function highlighted(input: HTMLElement) {
  let id = input.getAttribute('aria-activedescendant')
  if (!id) return null
  let options = document.querySelectorAll(`[id="${id}"]`)
  assert.equal(options.length, 1, `aria-activedescendant points at one element, ${id}`)
  let option = options[0] as HTMLElement
  assert.equal(option.getAttribute('role'), 'option')
  assert.ok(option.hasAttribute('data-highlighted'))
  assert.ok(option.getClientRects().length > 0, `${option.textContent} shows`)
  return option.textContent?.trim() ?? ''
}

function shownItems(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')].map((option) => option.textContent?.trim())
}

function item(root: ParentNode, text: string) {
  let found = [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent?.trim() === text,
  )
  assert.ok(found, `no item ${text}`)
  return found
}

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro']

type FrameworkProps = Partial<ComboboxSingleProps<string>> & {
  class?: string
  style?: string
  inputId?: string
  disabledItems?: string[]
  showClear?: boolean
  extra?: RemixNode
}

function Framework(handle: Handle<FrameworkProps>) {
  return () => {
    let { inputId, disabledItems = [], showClear, extra, class: className, style, ...props } = handle.props
    return (
      <Combobox name="framework" items={frameworks} {...props}>
        <ComboboxInput
          {...(className === undefined ? {} : { class: className })}
          {...(style === undefined ? {} : { style })}
          id={inputId}
          aria-label={inputId ? undefined : 'Framework'}
          placeholder="Select a framework"
          showClear={showClear}
        />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {(entry: string) => (
              <ComboboxItem key={entry} value={entry} disabled={disabledItems.includes(entry)}>
                {entry}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
        {extra}
      </Combobox>
    )
  }
}

function MultipleFrameworks(handle: Handle<Partial<Omit<ComboboxMultipleProps<string>, 'multiple'>>>) {
  return () => (
    <Combobox name="frameworks" items={frameworks} {...handle.props} multiple>
      <ComboboxChips>
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((value) => (
                <ComboboxChip key={value}>{value}</ComboboxChip>
              ))}
              <ComboboxChipsInput aria-label="Frameworks" placeholder="Add framework" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(entry: string) => (
            <ComboboxItem key={entry} value={entry}>
              {entry}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function formValues(form: HTMLFormElement, name = 'framework') {
  return new FormData(form).getAll(name)
}

function chips(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>('[data-slot="combobox-chip"]')]
}

describe('Combobox', () => {
  it('hides the native select and shows the input once it runs, with the label’s id and ARIA', async (t) => {
    let { container } = mount(
      t,
      <form>
        <label for="framework">Framework</label>
        <Framework inputId="framework" defaultValue="Remix" />
      </form>,
    )
    await settle()
    let { input, native, list } = parts(container)
    let group = container.querySelector<HTMLElement>('[data-slot="combobox-input"]')!

    assert.equal(group.hasAttribute('data-pending'), false)
    assert.ok(input.getClientRects().length > 0)
    assert.equal(input.id, 'framework')
    assert.notEqual(native.id, 'framework')
    assert.equal(native.getAttribute('aria-hidden'), 'true')
    assert.equal(native.tabIndex, -1)
    assert.equal(container.querySelector('label')?.control, input, 'the label names the input')
    assert.equal(input.value, 'Remix')
    assert.equal(input.getAttribute('aria-controls'), list.id)
    assert.deepEqual(formValues(container.querySelector('form')!), ['Remix'])
  })

  it('filters while you type, opens, and says how many items match once the search settles', async (t) => {
    let inputs: Array<[string, string]> = []
    let { container } = mount(
      t,
      <Framework onInputValueChange={(text, details) => void inputs.push([text, details.reason])} />,
    )
    await settle()
    let { input, content, list, status } = parts(container)
    input.focus()

    await type(input, 'x')
    assert.ok(isOpen(content))
    assert.equal(input.getAttribute('aria-expanded'), 'true')
    assert.deepEqual(shownItems(list), ['Next.js', 'Nuxt.js', 'Remix'])
    assert.equal(highlighted(input), null, 'typing highlights nothing without autoHighlight')
    assert.equal(status.textContent, '', 'the count waits for the search to settle')
    await wait(800)
    assert.equal(status.textContent, '3 results available.')

    await type(input, 't')
    assert.deepEqual(shownItems(list), ['Next.js', 'Nuxt.js'])
    await type(input, '.')
    await type(input, 'j')
    assert.deepEqual(shownItems(list), ['Next.js', 'Nuxt.js'])
    await replaceText(input, 'zz')
    assert.deepEqual(shownItems(list), [])
    assert.ok(content.hasAttribute('data-empty'))
    let empty = container.querySelector('[data-slot="combobox-empty"]')!
    assert.equal(empty.textContent, 'No items found.')
    assert.ok(empty.getClientRects().length > 0)
    await wait(800)
    assert.equal(status.textContent, '', 'ComboboxEmpty speaks for zero results')
    assert.deepEqual(inputs.at(0), ['x', 'input-change'])
  })

  it('moves the highlight with the arrow keys, through the input with loopFocus, and chooses with Enter', async (t) => {
    let changes: Array<[unknown, string]> = []
    let { container } = mount(
      t,
      <form>
        <Framework
          disabledItems={['Nuxt.js']}
          onValueChange={(value, details) => void changes.push([value, details.reason])}
        />
      </form>,
    )
    await settle()
    let { input, content, native } = parts(container)
    let form = container.querySelector('form')!
    let events: string[] = []
    form.addEventListener('change', () => events.push(`change ${formValues(form)}`))
    input.focus()

    await key(input, 'ArrowDown')
    assert.ok(isOpen(content))
    assert.equal(highlighted(input), 'Next.js')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'SvelteKit')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Remix', 'the disabled Nuxt.js is skipped')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), null, 'past the last item, the input itself')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Next.js')
    await key(input, 'ArrowUp')
    assert.equal(highlighted(input), null)
    await key(input, 'ArrowUp')
    assert.equal(highlighted(input), 'Astro')

    let enter = await key(input, 'Enter')
    assert.ok(enter.defaultPrevented, 'Enter on an item never submits the form')
    assert.equal(isOpen(content), false)
    assert.equal(input.value, 'Astro')
    assert.equal(native.value, 'Astro')
    assert.equal(input.hasAttribute('aria-activedescendant'), false)
    assert.deepEqual(changes, [['Astro', 'item-press']])
    assert.deepEqual(events, ['change Astro'])
    assert.equal(document.activeElement, input)
  })

  it('takes keys pressed while the list opens, before it renders', async (t) => {
    let { container } = mount(t, <MultipleFrameworks />)
    await settle()
    let input = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    input.focus()

    let press = (name: string) =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
    press('ArrowDown')
    press('ArrowDown')
    press('ArrowDown')
    press('Enter')
    await settle()
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Nuxt.js'],
    )
  })

  it('stays at the ends without loopFocus, and opens with the chosen item highlighted', async (t) => {
    let { container } = mount(t, <Framework loopFocus={false} defaultValue="SvelteKit" />)
    await settle()
    let { input } = parts(container)
    input.focus()

    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'SvelteKit')
    await key(input, 'ArrowUp')
    await key(input, 'ArrowUp')
    assert.equal(highlighted(input), 'Next.js')
    await key(input, 'Escape')
    await key(input, 'ArrowUp')
    assert.equal(highlighted(input), 'SvelteKit')
    for (let index = 0; index < 5; index++) await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
  })

  it('keeps the list beside its input through the renders that follow opening', async (t) => {
    let { container } = mount(
      t,
      <div style="padding-block-start: 1rem">
        <Framework />
        <Framework class="from-you" style="--from-you: 1" />
      </div>,
    )
    await settle()
    for (let index of [0, 1]) {
      let group = container.querySelectorAll<HTMLElement>('[data-slot="combobox-input"]')[index]
      let input = group.querySelector<HTMLInputElement>('input')!
      let content = container.querySelectorAll<HTMLElement>('[data-slot="combobox-content"]')[index]
      input.focus()
      // Only the highlight moves, so the list keeps its size and nothing measures it again.
      await key(input, 'ArrowDown')
      await key(input, 'ArrowDown')
      await key(input, 'ArrowDown')
      assert.equal(highlighted(input), 'Nuxt.js')
      let box = group.getBoundingClientRect()
      let popup = content.getBoundingClientRect()
      let beside = Math.abs(popup.top - (box.bottom + 6)) < 1.5 || Math.abs(popup.bottom - (box.top - 6)) < 1.5
      assert.ok(
        beside,
        `the list stays 6px from its input: list ${popup.top}..${popup.bottom}, input ${box.top}..${box.bottom}`,
      )
      assert.ok(
        Math.abs(popup.left - box.left) < 1.5,
        `the list starts where its input does: ${popup.left} and ${box.left}`,
      )
      await key(input, 'Escape')
    }
    let yours = container.querySelectorAll<HTMLElement>('[data-slot="combobox-input"]')[1]
    assert.ok(yours.classList.contains('from-you'), 'your class stays on the group')
    assert.equal(yours.style.getPropertyValue('--from-you'), '1', 'your style stays on the group')
  })

  it('keeps the list beside its input when your style for the input changes or goes while it is open', async (t) => {
    let setStyle = (_style: string | undefined) => {}
    function Styled(handle: Handle) {
      let style: string | undefined = '--caller: 1'
      setStyle = (next) => {
        style = next
        void handle.update()
      }
      return () => <Framework {...(style === undefined ? {} : { style })} />
    }
    let { container } = mount(
      t,
      <div style="padding-block-start: 1rem">
        <Styled />
      </div>,
    )
    await settle()
    let group = container.querySelector<HTMLElement>('[data-slot="combobox-input"]')!
    let input = group.querySelector<HTMLInputElement>('input')!
    let content = container.querySelector<HTMLElement>('[data-slot="combobox-content"]')!
    let besideInput = (when: string) => {
      let box = group.getBoundingClientRect()
      let popup = content.getBoundingClientRect()
      let beside = Math.abs(popup.top - (box.bottom + 6)) < 1.5 || Math.abs(popup.bottom - (box.top - 6)) < 1.5
      assert.ok(
        beside && Math.abs(popup.left - box.left) < 1.5,
        `${when}: list at ${popup.left},${popup.top}, input at ${box.left},${box.top}`,
      )
    }
    input.focus()
    await key(input, 'ArrowDown')
    besideInput('opened')

    setStyle('--caller: 2')
    await settle()
    assert.equal(group.style.getPropertyValue('--caller'), '2')
    besideInput('after your style changed')
    setStyle(undefined)
    await settle()
    assert.equal(group.style.getPropertyValue('--caller'), '')
    besideInput('after your style went')
    assert.ok(isOpen(content))
  })

  it('chooses with a click, highlights under the pointer, and keeps focus in the input', async (t) => {
    let { container } = mount(t, <Framework />)
    await settle()
    let { input, content } = parts(container)

    await press(input)
    assert.ok(isOpen(content))
    assert.equal(document.activeElement, input)
    let remix = item(container, 'Remix')
    remix.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }))
    await settle()
    assert.equal(highlighted(input), 'Remix')

    await press(remix)
    assert.equal(isOpen(content), false)
    assert.equal(input.value, 'Remix')
    assert.equal(document.activeElement, input)
    assert.equal(item(container, 'Remix').getAttribute('aria-selected'), 'true')
  })

  it('never chooses a disabled item', async (t) => {
    let changes: unknown[] = []
    let { container } = mount(
      t,
      <Framework disabledItems={['Remix']} onValueChange={(value) => void changes.push(value)} />,
    )
    await settle()
    let { input, content } = parts(container)
    await press(input)

    item(container, 'Remix').click()
    await settle()
    assert.ok(isOpen(content))
    assert.deepEqual(changes, [])
    assert.equal(item(container, 'Remix').getAttribute('aria-disabled'), 'true')
  })

  it('treats the text as a search: it goes back to the chosen label when the list closes', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework defaultValue="Astro" />
        <button type="button">Elsewhere</button>
      </form>,
    )
    await settle()
    let { input, content } = parts(container)
    let form = container.querySelector('form')!
    input.focus()

    await replaceText(input, 'Rem')
    assert.ok(isOpen(content))
    assert.deepEqual(shownItems(container), ['Remix'])
    container.querySelector<HTMLButtonElement>('button[type="button"]:not([data-slot])')!.focus()
    await wait(20)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(input.value, 'Astro', 'the typed text never becomes the value')
    assert.deepEqual(formValues(form), ['Astro'])
    // The next opening shows every item again.
    input.focus()
    await key(input, 'ArrowDown')
    assert.deepEqual(shownItems(container), frameworks)
  })

  it('clears a single value when you empty the input, and with Escape on the closed list', async (t) => {
    let changes: Array<[unknown, string]> = []
    let { container } = mount(
      t,
      <form>
        <Framework
          defaultValue="Astro"
          onValueChange={(value, details) => void changes.push([value, details.reason])}
        />
      </form>,
    )
    await settle()
    let { input, native } = parts(container)
    let form = container.querySelector('form')!
    input.focus()

    await replaceText(input, '')
    assert.equal(native.value, '')
    assert.deepEqual(formValues(form), [''])
    assert.deepEqual(changes, [[null, 'input-clear']])

    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.equal(input.value, 'Next.js')
    let escape = await key(input, 'Escape')
    assert.ok(escape.defaultPrevented, 'Escape cleared the value, so a dialog around it stays open')
    assert.equal(input.value, '')
    assert.deepEqual(changes.at(-1), [null, 'escape-key'])
    let again = await key(input, 'Escape')
    assert.equal(again.defaultPrevented, false, 'nothing left to clear: Escape is the page’s')
  })

  it('closes on Escape without changing the value', async (t) => {
    let { container } = mount(t, <Framework defaultValue="Remix" />)
    await settle()
    let { input, content } = parts(container)
    input.focus()

    await key(input, 'ArrowDown')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
    let escape = await key(input, 'Escape')
    assert.ok(escape.defaultPrevented)
    assert.equal(isOpen(content), false)
    assert.equal(input.value, 'Remix')
  })

  it('submits the form with Enter when no item is highlighted', async (t) => {
    let { container } = mount(t, <Framework />)
    await settle()
    let { input, content } = parts(container)
    input.focus()

    await type(input, 'r')
    assert.ok(isOpen(content))
    let enter = await key(input, 'Enter')
    assert.equal(enter.defaultPrevented, false)
    assert.equal(isOpen(content), false)
  })

  it('highlights the first match while you type with autoHighlight', async (t) => {
    let { container } = mount(t, <Framework autoHighlight disabledItems={['Next.js']} />)
    await settle()
    let { input } = parts(container)
    input.focus()

    await type(input, 'n')
    assert.equal(highlighted(input), 'Nuxt.js', 'the first enabled match, past disabled Next.js')
    await replaceText(input, 'r')
    assert.equal(highlighted(input), 'Remix')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
    await key(input, 'Enter')
    assert.equal(input.value, 'Astro')
  })

  it('leaves the text alone while an input method composes, and Enter confirms the composition only', async (t) => {
    let changes: unknown[] = []
    let texts: string[] = []
    let { container } = mount(
      t,
      <Framework
        autoHighlight
        onValueChange={(value) => void changes.push(value)}
        onInputValueChange={(text) => void texts.push(text)}
      />,
    )
    await settle()
    let { input, list } = parts(container)
    input.focus()

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    input.value = 'r'
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'r', isComposing: true }),
    )
    await settle()
    assert.deepEqual(texts, [], 'no search while composing')
    assert.deepEqual(shownItems(list), frameworks)

    // A render while composing never writes over the text.
    input.value = 're'
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 're', isComposing: true }),
    )
    await settle()
    assert.equal(input.value, 're')

    // Enter confirms the composition; it chooses nothing.
    let enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })
    input.dispatchEvent(enter)
    await settle()
    assert.equal(enter.defaultPrevented, false)
    assert.deepEqual(changes, [])

    input.value = 'Rem'
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'Rem' }))
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Rem' }))
    await settle()
    assert.deepEqual(texts, ['Rem'], 'the committed text searches once')
    assert.deepEqual(shownItems(list), ['Remix'])
    assert.equal(highlighted(input), 'Remix')
  })

  it('removes chips with Backspace, the arrow keys and their buttons, keeping focus in the combobox', async (t) => {
    let changes: Array<[unknown, string]> = []
    let { container } = mount(
      t,
      <form>
        <MultipleFrameworks
          defaultValue={['Next.js', 'Remix', 'Astro']}
          onValueChange={(value, details) => void changes.push([value, details.reason])}
        />
      </form>,
    )
    await settle()
    let input = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    let form = container.querySelector('form')!
    input.focus()

    assert.deepEqual(formValues(form, 'frameworks'), ['Next.js', 'Remix', 'Astro'])
    await key(input, 'Backspace')
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Next.js', 'Remix'],
    )
    assert.deepEqual(formValues(form, 'frameworks'), ['Next.js', 'Remix'])

    await key(input, 'ArrowLeft')
    assert.equal(document.activeElement, chips(container)[1], 'the arrow toward the chips focuses the last one')
    await key(chips(container)[1], 'ArrowLeft')
    assert.equal(document.activeElement, chips(container)[0], 'the arrow moves between chips')
    await key(chips(container)[0], 'Delete')
    await wait(10)
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Remix'],
    )
    assert.equal(document.activeElement, chips(container)[0], 'focus moves to the chip that took its place')
    await key(chips(container)[0], 'ArrowRight')
    assert.equal(document.activeElement, input, 'past the last chip, the input')

    let remove = container.querySelector<HTMLButtonElement>('[data-slot="combobox-chip-remove"]')!
    assert.equal(remove.getAttribute('aria-label'), 'Remove Remix')
    await press(remove)
    await wait(10)
    assert.deepEqual(chips(container), [])
    let replaced = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    assert.equal(document.activeElement, replaced, 'the remove button hands focus to the input')
    assert.deepEqual(formValues(form, 'frameworks'), [])
    assert.deepEqual(
      changes.map(([, reason]) => reason),
      ['none', 'none', 'chip-remove-press'],
    )
  })

  it('moves focus to the next chip in the same task that removes the focused one', async (t) => {
    let { container } = mount(t, <MultipleFrameworks defaultValue={['Next.js', 'Remix', 'Astro']} />)
    await settle()
    let middle = chips(container)[1]
    middle.focus()

    // A timer started before the key runs before any timer the combobox starts for it, so it sees
    // the page as the task that removed the chip left it.
    let seen = new Promise<[string[], string | null | undefined]>((resolve) =>
      setTimeout(() =>
        resolve([chips(container).map((chip) => chip.textContent ?? ''), document.activeElement?.textContent]),
      ),
    )
    middle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    let [left, focused] = await seen
    assert.deepEqual(left, ['Next.js', 'Astro'])
    assert.equal(focused, 'Astro', 'focus never rests on the page')
  })

  it('keeps focus in the input when Backspace removes the last chip and your JSX renders it anew', async (t) => {
    let { container } = mount(t, <MultipleFrameworks defaultValue={['Remix']} />)
    await settle()
    let input = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    input.focus()

    await key(input, 'Backspace')
    await wait(10)
    let current = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    assert.deepEqual(chips(container), [])
    assert.equal(document.activeElement, current)
    await type(current, 'a')
    assert.ok(isOpen(parts(container).content))
  })

  it('toggles items in a multiple combobox and keeps the list open until a search', async (t) => {
    let { container } = mount(t, <MultipleFrameworks />)
    await settle()
    let input = container.querySelector<HTMLInputElement>('[data-slot="combobox-chip-input"]')!
    let { content } = parts(container)
    input.focus()

    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.ok(isOpen(content), 'the list stays open without a search')
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Next.js'],
    )
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Next.js', 'SvelteKit'],
    )
    await key(input, 'Enter')
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Next.js'],
      'Enter on a chosen item removes it',
    )

    await type(input, 'ast')
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.equal(isOpen(content), false, 'choosing from a search closes the list')
    assert.equal(input.value, '')
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Next.js', 'Astro'],
      'chips keep the order they were chosen in',
    )
  })

  it('returns to the default value and its label on a form reset', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework defaultValue="SvelteKit" />
        <MultipleFrameworks defaultValue={['Remix']} />
      </form>,
    )
    await settle()
    let form = container.querySelector('form')!
    let [single, multiple] = container.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
    single.focus()
    await key(single, 'ArrowDown')
    await key(single, 'ArrowDown')
    await key(single, 'Enter')
    multiple.focus()
    await key(multiple, 'ArrowDown')
    await key(multiple, 'Enter')
    assert.deepEqual(formValues(form), ['Nuxt.js'])
    assert.deepEqual(formValues(form, 'frameworks'), ['Remix', 'Next.js'])

    form.reset()
    await wait(10)
    await settle()
    assert.equal(single.value, 'SvelteKit')
    assert.deepEqual(formValues(form), ['SvelteKit'])
    assert.deepEqual(formValues(form, 'frameworks'), ['Remix'])
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Remix'],
    )
  })

  it('keeps its value when a listener cancels the form reset', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework defaultValue="Remix" />
        <MultipleFrameworks defaultValue={['Remix']} />
      </form>,
    )
    await settle()
    let form = container.querySelector('form')!
    form.addEventListener('reset', (event) => event.preventDefault())
    let [single, multiple] = container.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
    single.focus()
    await key(single, 'ArrowUp')
    await key(single, 'ArrowDown')
    await key(single, 'Enter')
    multiple.focus()
    await key(multiple, 'ArrowDown')
    await key(multiple, 'Enter')
    assert.equal(single.value, 'Astro')
    assert.deepEqual(formValues(form, 'frameworks'), ['Remix', 'Next.js'])

    form.reset()
    await wait(10)
    await settle()
    assert.equal(single.value, 'Astro')
    assert.deepEqual(formValues(form), ['Astro'])
    assert.deepEqual(formValues(form, 'frameworks'), ['Remix', 'Next.js'])
    assert.deepEqual(
      chips(container).map((chip) => chip.textContent),
      ['Remix', 'Next.js'],
    )
  })

  it('blocks a required form without a value and marks the input invalid until a choice', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework required />
      </form>,
    )
    await settle()
    let form = container.querySelector('form')!
    let { input, native } = parts(container)

    assert.equal(form.checkValidity(), false)
    native.dispatchEvent(new Event('invalid'))
    await settle()
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    input.focus()
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    await settle()
    assert.equal(form.checkValidity(), true)
    assert.equal(input.hasAttribute('aria-invalid'), false)
  })

  it('clears the value with the clear button, which shows only while there is one', async (t) => {
    let { container } = mount(t, <Framework showClear defaultValue="Remix" />)
    await settle()
    let { input } = parts(container)
    let clear = container.querySelector<HTMLButtonElement>('[data-slot="combobox-clear"]')!
    let trigger = container.querySelector<HTMLButtonElement>('[data-slot="combobox-trigger"]')!

    assert.equal(clear.getAttribute('aria-label'), 'Clear')
    assert.equal(trigger.getClientRects().length, 0, 'the chevron gives way to the clear button')
    await press(clear)
    assert.equal(input.value, '')
    assert.equal(container.querySelector('[data-slot="combobox-clear"]'), null)
    assert.ok(trigger.getClientRects().length > 0)
    assert.equal(document.activeElement, input)
  })

  it('opens and closes from the chevron without leaving the input', async (t) => {
    let { container } = mount(t, <Framework />)
    await settle()
    let { input, content } = parts(container)
    let trigger = container.querySelector<HTMLButtonElement>('[data-slot="combobox-trigger"]')!

    assert.equal(trigger.tabIndex, -1)
    await press(trigger)
    assert.ok(isOpen(content))
    assert.equal(document.activeElement, input)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    await press(trigger)
    assert.equal(isOpen(content), false)
  })

  it('shows the label of the value its owner keeps when the owner declines a choice', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework value="Remix" onValueChange={() => {}} />
      </form>,
    )
    await settle()
    let { input, content } = parts(container)
    let form = container.querySelector('form')!
    input.focus()

    await key(input, 'ArrowDown')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
    await key(input, 'Enter')
    assert.equal(isOpen(content), false)
    assert.deepEqual(formValues(form), ['Remix'])
    assert.equal(input.value, 'Remix', 'the input shows what the form submits')
    await key(input, 'ArrowDown')
    assert.deepEqual(shownItems(container), frameworks, 'the next opening shows every item')
    await key(input, 'Escape')

    // The typed text is already the declined item's full label.
    await replaceText(input, 'Astro')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Astro')
    await key(input, 'Enter')
    assert.equal(isOpen(content), false)
    assert.deepEqual(formValues(form), ['Remix'])
    assert.equal(input.value, 'Remix', 'a typed label the owner declines goes back too')
  })

  it('shows the kept label when the owner declines a clear, from the button or Escape', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework value="Remix" onValueChange={() => {}} showClear />
        <button type="button">Elsewhere</button>
      </form>,
    )
    await settle()
    let { input } = parts(container)
    let form = container.querySelector('form')!
    let elsewhere = container.querySelector<HTMLButtonElement>('button[type="button"]:not([data-slot])')!

    await press(container.querySelector<HTMLButtonElement>('[data-slot="combobox-clear"]')!)
    elsewhere.focus()
    await settle()
    assert.deepEqual(formValues(form), ['Remix'])
    assert.equal(input.value, 'Remix', 'a declined clear leaves the kept label')

    input.focus()
    await key(input, 'Escape')
    assert.deepEqual(formValues(form), ['Remix'])
    assert.equal(input.value, 'Remix', 'a declined Escape leaves it too')
  })

  it('keeps emptied text while you edit, and shows the kept label once you leave, when the owner declines', async (t) => {
    let { container } = mount(
      t,
      <form>
        <Framework value="Remix" onValueChange={() => {}} />
        <button type="button">Elsewhere</button>
      </form>,
    )
    await settle()
    let { input, content } = parts(container)
    let form = container.querySelector('form')!
    let elsewhere = container.querySelector<HTMLButtonElement>('button[type="button"]:not([data-slot])')!
    input.focus()
    input.select()

    await replaceText(input, '')
    assert.equal(isOpen(content), false)
    assert.equal(input.value, '', 'the text stays as you edit it')
    assert.deepEqual(formValues(form), ['Remix'])

    elsewhere.focus()
    await wait(10)
    await settle()
    assert.equal(input.value, 'Remix', 'once focus leaves, the input shows what the form submits')
    assert.deepEqual(formValues(form), ['Remix'])
  })

  it('starts no work for a combobox that goes away while focus leaves it', async (t) => {
    let calls: Array<[string, boolean]> = []
    let signals: AbortSignal[] = []
    let remove = () => {}
    function Removable(handle: Handle) {
      let shown = true
      remove = () => {
        shown = false
        void handle.update()
      }
      return () => (
        <form>
          {shown ? (
            <Framework
              value="Remix"
              onValueChange={() => {}}
              onInputValueChange={(text, details) => {
                calls.push([text, shown])
                signals.push(details.signal)
              }}
            />
          ) : null}
          <button type="button" mix={on('focus', () => remove())}>
            Elsewhere
          </button>
        </form>
      )
    }
    let { container } = mount(t, <Removable />)
    await settle()
    let { input } = parts(container)
    input.focus()
    input.select()
    await replaceText(input, '')

    container.querySelector<HTMLButtonElement>('button[type="button"]:not([data-slot])')!.focus()
    await wait(20)
    await settle()
    assert.equal(container.querySelector('input[role="combobox"]'), null)
    assert.deepEqual(calls, [['', true]], 'no text change reaches the owner after the combobox went away')
    assert.ok(
      signals.every((signal) => signal.aborted),
      'every search signal aborted',
    )
  })

  it('follows a controlled value and text, and returns to them when the owner declines', async (t) => {
    function Controlled(handle: Handle) {
      let value: string | null = 'Remix'
      let text = 'Remix'
      return () => (
        <>
          <Framework
            value={value}
            inputValue={text}
            onValueChange={(next) => {
              if (next !== 'Astro') return
              value = next
              void handle.update()
            }}
            onInputValueChange={(next) => {
              if (next.includes('!')) return
              text = next
              void handle.update()
            }}
          />
        </>
      )
    }
    let { container } = mount(t, <Controlled />)
    await settle()
    let { input } = parts(container)
    input.focus()

    await type(input, '!')
    assert.equal(input.value, 'Remix', 'the owner declined the text')
    await replaceText(input, 'Ne')
    assert.equal(input.value, 'Ne')
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.equal(parts(container).native.value, 'Remix', 'the owner declined Next.js')
    await replaceText(input, 'Ast')
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    assert.equal(parts(container).native.value, 'Astro')
    assert.equal(input.value, 'Astro')
  })

  it('keeps the highlight on its item, and never on a missing one, while the items change', async (t) => {
    let actions = { prepend() {}, drop(_name: string) {} }
    function Changing(handle: Handle) {
      let items = [...frameworks]
      actions = {
        prepend() {
          items = ['Qwik', ...items]
          void handle.update()
        },
        drop(name) {
          items = items.filter((entry) => entry !== name)
          void handle.update()
        },
      }
      return () => <Framework items={items} />
    }
    let { container } = mount(t, <Changing />)
    await settle()
    let { input } = parts(container)
    input.focus()
    await key(input, 'ArrowDown')
    await key(input, 'ArrowDown')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Nuxt.js')
    let id = input.getAttribute('aria-activedescendant')

    actions.prepend()
    await settle()
    assert.equal(highlighted(input), 'Nuxt.js', 'a new item above doesn’t move the highlight')
    assert.equal(input.getAttribute('aria-activedescendant'), id, 'the highlighted item keeps its id')

    actions.drop('Nuxt.js')
    await settle()
    assert.equal(highlighted(input), null, 'the highlight leaves with its item')
    await key(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Qwik')
  })

  it('closes when it turns off, and takes a new default as its reset value only', async (t) => {
    let props = { set(_next: { disabled?: boolean; defaultValue?: string }) {} }
    function Changing(handle: Handle) {
      let current: { disabled?: boolean; defaultValue?: string } = { defaultValue: 'Remix' }
      props.set = (next) => {
        current = next
        void handle.update()
      }
      return () => (
        <form>
          <Framework {...current} />
        </form>
      )
    }
    let { container } = mount(t, <Changing />)
    await settle()
    let { input, content } = parts(container)
    let form = container.querySelector('form')!
    input.focus()
    await key(input, 'ArrowDown')
    assert.ok(isOpen(content))

    props.set({ defaultValue: 'Remix', disabled: true })
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(input.disabled, true)
    assert.deepEqual(formValues(form), [], 'a disabled combobox leaves the form')

    props.set({ defaultValue: 'Astro' })
    await settle()
    assert.equal(input.disabled, false)
    assert.equal(input.value, 'Remix', 'a new default doesn’t change the value')
    assert.deepEqual(formValues(form), ['Remix'])
    form.reset()
    await wait(10)
    await settle()
    assert.equal(input.value, 'Astro')
    assert.deepEqual(formValues(form), ['Astro'])
  })

  it('aborts the signal of an older search, so its results can be dropped', async (t) => {
    let signals: AbortSignal[] = []
    function Async(handle: Handle) {
      let results: string[] = []
      return () => (
        <Framework
          items={results}
          filter={null}
          onInputValueChange={(text, details: ComboboxInputValueChangeDetails) => {
            signals.push(details.signal)
            // An answer that arrives late, after a newer search started.
            let delay = text === 'r' ? 60 : 10
            setTimeout(() => {
              if (details.signal.aborted) return
              results = frameworks.filter((entry) => entry.toLowerCase().includes(text.toLowerCase()))
              void handle.update()
            }, delay)
          }}
        />
      )
    }
    let { container } = mount(t, <Async />)
    await settle()
    let { input, list } = parts(container)
    input.focus()

    await type(input, 'r')
    await type(input, 'e')
    await wait(100)
    await settle()
    assert.equal(signals[0].aborted, true)
    assert.equal(signals[1].aborted, false)
    assert.deepEqual(shownItems(list), ['Remix'], 'the late answer for “r” was dropped')
  })

  it('opens a popup with a search from its trigger, moves focus there and back', async (t) => {
    let { container } = mount(
      t,
      <Combobox name="framework" items={frameworks} defaultValue="Astro">
        <ComboboxTrigger aria-label="Framework">
          <ComboboxValue placeholder="Select a framework" />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput showTrigger={false} placeholder="Search" aria-label="Search frameworks" />
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>{(entry: string) => <ComboboxItem value={entry}>{entry}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )
    await settle()
    let trigger = container.querySelector<HTMLButtonElement>('[data-slot="combobox-trigger"]')!
    let { input, content } = parts(container)

    assert.equal(trigger.getAttribute('role'), 'combobox')
    assert.equal(trigger.tabIndex, 0)
    trigger.focus()
    await key(trigger, 'ArrowDown')
    assert.ok(isOpen(content))
    assert.equal(document.activeElement, input)
    assert.equal(content.getAttribute('role'), 'dialog')
    await type(input, 'rem')
    await key(input, 'ArrowDown')
    await key(input, 'Enter')
    await wait(10)
    assert.equal(isOpen(content), false)
    assert.equal(trigger.textContent?.trim(), 'Remix')
    assert.equal(document.activeElement, trigger)
    assert.equal(input.value, '', 'the search starts over next time')
  })

  it('renders groups through a collection and names each by its label', async (t) => {
    let zones = [
      { value: 'Americas', items: ['New York', 'Chicago'] },
      { value: 'Europe', items: ['London', 'Paris'] },
    ]
    let { container } = mount(
      t,
      <Combobox items={zones}>
        <ComboboxInput aria-label="Time zone" />
        <ComboboxContent>
          <ComboboxList>
            {(group: (typeof zones)[number]) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(entry: string) => (
                    <ComboboxItem key={entry} value={entry}>
                      {entry}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )
    await settle()
    let { input, list } = parts(container)
    input.focus()

    await type(input, 'o')
    assert.deepEqual(shownItems(list), ['New York', 'Chicago', 'London'])
    let groups = [...list.querySelectorAll('[role="group"]')]
    assert.deepEqual(
      groups.map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent),
      ['Americas', 'Europe'],
    )
    await replaceText(input, 'par')
    assert.equal(list.querySelectorAll('[role="group"]').length, 1, 'a group without matches leaves')
  })

  it('opens the list but chooses nothing when read-only', async (t) => {
    let changes: unknown[] = []
    let { container } = mount(
      t,
      <Framework readOnly defaultValue="Remix" onValueChange={(value) => void changes.push(value)} />,
    )
    await settle()
    let { input, content } = parts(container)
    input.focus()

    assert.equal(input.readOnly, true)
    await key(input, 'ArrowDown')
    assert.ok(isOpen(content))
    let enter = await key(input, 'Enter')
    assert.ok(enter.defaultPrevented)
    item(container, 'Astro').click()
    await settle()
    assert.deepEqual(changes, [])
    assert.equal(input.value, 'Remix')
  })

  it('keeps a modal list’s page inert, and moves focus on with Tab once it is back', async (t) => {
    let { container } = mount(
      t,
      <div>
        <button type="button">Before</button>
        <Framework modal />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { input, content } = parts(container)
    let [before, after] = [...container.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => !button.hasAttribute('data-slot'),
    )
    input.focus()

    await key(input, 'ArrowDown')
    assert.ok(after.closest('[inert]'), 'the page is inert while the list is open')
    assert.equal(input.closest('[inert]'), null)
    await key(input, 'Tab')
    await wait(10)
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, after)
    assert.equal(after.closest('[inert]'), null)

    input.focus()
    await key(input, 'ArrowDown')
    await key(input, 'Tab', { shiftKey: true })
    await wait(10)
    assert.equal(document.activeElement, before)
  })

  it('keeps several comboboxes apart, and releases its layer when it goes away', async (t) => {
    let hide = () => {}
    function Pair(handle: Handle) {
      let shown = true
      hide = () => {
        shown = false
        void handle.update()
      }
      return () => (
        <>
          {shown ? <Framework /> : null}
          <MultipleFrameworks />
        </>
      )
    }
    let { container } = mount(t, <Pair />)
    await settle()
    let [first, second] = container.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
    let ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    assert.equal(new Set(ids).size, ids.length)

    first.focus()
    await key(first, 'ArrowDown')
    assert.equal(getOpenLayers(document).length, 1)
    second.focus()
    await wait(20)
    await settle()
    assert.equal(getOpenLayers(document).length, 0, 'focus leaving closes the first')
    first.focus()
    await key(first, 'ArrowDown')
    assert.equal(getOpenLayers(document).length, 1)
    hide()
    await settle()
    assert.equal(getOpenLayers(document).length, 0)
  })
})
