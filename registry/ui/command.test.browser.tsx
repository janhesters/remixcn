import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  getCommandContext,
} from './command.tsx'
import type { CommandDialogProps, CommandProps } from './command.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
  })
  return result
}

/** Lets Remix's queued tasks, updates and observers run. */
async function settle() {
  for (let round = 0; round < 4; round++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

async function type(input: HTMLInputElement, text: string) {
  input.focus({ preventScroll: true })
  input.value = text
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
  await settle()
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

async function pressAndSettle(target: Element, key: string, init: KeyboardEventInit = {}) {
  let event = press(target, key, init)
  await settle()
  return event
}

/** The options that show, in the order they appear on screen. */
function shown(root: ParentNode = document) {
  return [...root.querySelectorAll<HTMLElement>('[role=option]')]
    .filter((option) => option.getClientRects().length > 0)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .map((option) => option.textContent?.trim())
}

function highlighted(input: HTMLInputElement) {
  let id = input.getAttribute('aria-activedescendant')
  if (!id) return null
  let option = document.getElementById(id)
  assert.ok(option, `aria-activedescendant points at ${id}, which isn't in the document`)
  assert.equal(option.getAttribute('aria-selected'), 'true')
  assert.ok(option.hasAttribute('data-selected'))
  assert.equal(option.hidden, false, 'the highlighted option shows')
  let shows =
    option.getClientRects().length > 0 &&
    getComputedStyle(option).visibility === 'visible' &&
    option.closest('[inert]') === null
  assert.ok(shows, `the highlighted option ${option.textContent} is on screen and not inert`)
  return option.textContent?.trim() ?? ''
}

function Palette(handle: Handle<CommandProps & { onSelect?: (value: string) => void; extra?: RemixNode }>) {
  return () => {
    let { onSelect, extra, ...props } = handle.props
    return (
      <Command {...props}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={onSelect}>Calendar</CommandItem>
            <CommandItem onSelect={onSelect}>Search emoji</CommandItem>
            <CommandItem onSelect={onSelect} disabled>
              Calculator
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={onSelect} keywords={['account']}>
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={onSelect}>Billing</CommandItem>
            <CommandItem onSelect={onSelect}>Settings</CommandItem>
          </CommandGroup>
          {extra}
        </CommandList>
      </Command>
    )
  }
}

function setup(t: TestContext, node: RemixNode = <Palette />) {
  let result = mount(t, node)
  let input = result.$('input') as HTMLInputElement
  return { ...result, input }
}

describe('Command', () => {
  it('turns the input on and lights up the first item once it runs', async (t) => {
    let { input, $ } = setup(t)
    await settle()

    assert.equal(input.disabled, false)
    assert.equal(highlighted(input), 'Calendar')
    assert.equal(input.getAttribute('aria-label'), 'Command menu')
    assert.equal(input.getAttribute('aria-controls'), $('[role=listbox]')?.id)
    assert.equal($('[data-slot=command-empty]'), null)
  })

  it('filters the items as you type and hides groups and separators without a match', async (t) => {
    let { input, $, $$ } = setup(t)
    await settle()

    await type(input, 'cal')
    assert.deepEqual(shown(), ['Calendar', 'Calculator'])
    assert.equal(highlighted(input), 'Calendar')
    let [suggestions, settings] = $$('[data-slot=command-group]') as NodeListOf<HTMLElement>
    assert.equal(suggestions.hidden, false)
    assert.equal(settings.hidden, true)
    assert.equal(($('[data-slot=command-separator]') as HTMLElement).hidden, true)

    await type(input, '')
    assert.deepEqual(shown(), ['Calendar', 'Search emoji', 'Calculator', 'Profile⌘P', 'Billing', 'Settings'])
    assert.equal(($('[data-slot=command-separator]') as HTMLElement).hidden, false)
  })

  it('shows the best match first, and the group with the best match first, and the keys follow', async (t) => {
    let { input } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          <CommandGroup heading="Archive">
            <CommandItem>Old invoices</CommandItem>
            <CommandItem>Vendors</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Billing">
            <CommandItem>Draft an invoice</CommandItem>
            <CommandItem>Invoices</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    )
    await settle()

    await type(input, 'invoice')
    assert.deepEqual(shown(), ['Invoices', 'Draft an invoice', 'Old invoices'])
    let place = (label: string) => {
      let option = [...document.querySelectorAll('[role=option]')].find((element) => element.textContent === label)!
      return `${option.getAttribute('aria-posinset')} of ${option.getAttribute('aria-setsize')}`
    }
    assert.deepEqual(
      ['Invoices', 'Draft an invoice', 'Old invoices'].map(place),
      ['1 of 2', '2 of 2', '1 of 1'],
      'assistive technology hears the order on screen',
    )
    assert.equal(highlighted(input), 'Invoices', 'the best match lights up')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Draft an invoice')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Old invoices')

    await type(input, '')
    assert.deepEqual(shown(), ['Old invoices', 'Vendors', 'Draft an invoice', 'Invoices'], 'your order comes back')
    assert.equal(place('Invoices'), 'null of null')
  })

  it('keeps your order among equal matches, also after you reorder the items', async (t) => {
    let order = ['Billing plan', 'Billing address', 'Billing history']
    function Reorderable(handle: Handle) {
      return () => (
        <Command>
          <CommandInput />
          <CommandList>
            {order.map((label) => (
              <CommandItem key={label}>{label}</CommandItem>
            ))}
            <button
              type="button"
              mix={on('click', () => {
                order = [...order].reverse()
                void handle.update()
              })}
            >
              Reverse
            </button>
          </CommandList>
        </Command>
      )
    }
    let { input, $ } = setup(t, <Reorderable />)
    await settle()

    await type(input, 'billing')
    assert.deepEqual(shown(), ['Billing plan', 'Billing address', 'Billing history'])
    ;($('button') as HTMLButtonElement).click()
    await settle()
    assert.deepEqual(shown(), ['Billing history', 'Billing address', 'Billing plan'])
  })

  it('shows the empty state when nothing matches, and then Enter runs nothing', async (t) => {
    let selected: string[] = []
    let { input, $ } = setup(t, <Palette onSelect={(value) => selected.push(value)} />)
    await settle()

    await type(input, 'zzz')
    assert.deepEqual(shown(), [])
    assert.equal($('[data-slot=command-empty]')?.textContent, 'No results found.')
    assert.equal($('[data-slot=command-empty]')?.getAttribute('aria-hidden'), 'true', 'a listbox holds only options')
    assert.equal($('[role=status]')?.textContent, 'No results found.', 'the status says it instead')
    assert.equal(highlighted(input), null)
    assert.equal(press(input, 'Enter').defaultPrevented, true)
    await settle()
    assert.deepEqual(selected, [])

    await type(input, 'bill')
    assert.equal($('[data-slot=command-empty]'), null)
    assert.equal($('[role=status]')?.textContent, '')
    assert.equal(highlighted(input), 'Billing')
  })

  it('matches keywords and takes your filter', async (t) => {
    let { input } = setup(t)
    await settle()
    await type(input, 'account')
    assert.deepEqual(shown(), ['Profile⌘P'])

    let custom = setup(t, <Palette filter={(value, search) => (value.toLowerCase().endsWith(search) ? 1 : 0)} />)
    await settle()
    await type(custom.input, 's')
    assert.deepEqual(shown(custom.$('[data-slot=command]')!), ['Settings'], 'only what your filter scores')
  })

  it('leaves the filtering to you with shouldFilter={false}', async (t) => {
    let all = ['Calendar', 'Calculator', 'Billing']
    function Remote(handle: Handle) {
      let search = ''
      return () => {
        let matches = all.filter((label) => label.toLowerCase().includes(search))
        return (
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={(next) => {
                search = next
                void handle.update()
              }}
            />
            <CommandList>
              <CommandEmpty>Nothing found.</CommandEmpty>
              {matches.map((label) => (
                <CommandItem key={label} value={label}>
                  {label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )
      }
    }
    let { input, $ } = setup(t, <Remote />)
    await settle()

    await type(input, 'b')
    assert.deepEqual(shown(), ['Billing'])
    assert.equal(highlighted(input), 'Billing')
    await type(input, 'q')
    assert.deepEqual(shown(), [])
    assert.equal($('[data-slot=command-empty]')?.textContent, 'Nothing found.')
    assert.equal(highlighted(input), null)
  })

  it('moves the highlight with the arrow keys, Home and End, past disabled items', async (t) => {
    let { input } = setup(t)
    await settle()

    assert.equal((await pressAndSettle(input, 'ArrowDown')).defaultPrevented, true)
    assert.equal(highlighted(input), 'Search emoji')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Profile⌘P', 'skips the disabled Calculator')
    await pressAndSettle(input, 'End')
    assert.equal(highlighted(input), 'Settings')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Settings', "doesn't wrap unless asked")
    await pressAndSettle(input, 'Home')
    assert.equal(highlighted(input), 'Calendar')
    await pressAndSettle(input, 'ArrowUp')
    assert.equal(highlighted(input), 'Calendar')
    assert.equal(press(input, 'ArrowLeft').defaultPrevented, false, 'left and right move the caret')
    assert.equal(press(input, 'ArrowRight').defaultPrevented, false)
  })

  it('wraps around with loop', async (t) => {
    let { input } = setup(t, <Palette loop />)
    await settle()

    await pressAndSettle(input, 'ArrowUp')
    assert.equal(highlighted(input), 'Settings')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Calendar')
  })

  it('takes Ctrl+N, Ctrl+J, Ctrl+P and Ctrl+K, Meta with an arrow for the ends, and Alt with an arrow for the groups', async (t) => {
    let { input } = setup(t)
    await settle()

    await pressAndSettle(input, 'n', { ctrlKey: true })
    assert.equal(highlighted(input), 'Search emoji')
    await pressAndSettle(input, 'j', { ctrlKey: true })
    assert.equal(highlighted(input), 'Profile⌘P')
    await pressAndSettle(input, 'p', { ctrlKey: true })
    assert.equal(highlighted(input), 'Search emoji')
    await pressAndSettle(input, 'k', { ctrlKey: true })
    assert.equal(highlighted(input), 'Calendar')
    await pressAndSettle(input, 'ArrowDown', { metaKey: true })
    assert.equal(highlighted(input), 'Settings')
    await pressAndSettle(input, 'ArrowUp', { metaKey: true })
    assert.equal(highlighted(input), 'Calendar')
    await pressAndSettle(input, 'ArrowDown', { altKey: true })
    assert.equal(highlighted(input), 'Profile⌘P', 'the first item of the next group')
    await pressAndSettle(input, 'ArrowUp', { altKey: true })
    assert.equal(highlighted(input), 'Calendar', 'the first item of the group before')

    let plain = setup(t, <Palette vimBindings={false} />)
    await settle()
    assert.equal(press(plain.input, 'n', { ctrlKey: true }).defaultPrevented, false)
    await settle()
    assert.equal(highlighted(plain.input), 'Calendar')
  })

  it('runs the highlighted item on Enter with its value, and keeps a form around it from sending', async (t) => {
    let selected: string[] = []
    let submitted = 0
    let { input, $ } = setup(
      t,
      <form mix={on('submit', (event) => (submitted++, event.preventDefault()))}>
        <Palette onSelect={(value) => selected.push(value)} />
      </form>,
    )
    await settle()

    await pressAndSettle(input, 'End')
    assert.equal(press(input, 'Enter').defaultPrevented, true)
    await settle()
    assert.deepEqual(selected, ['Settings'])
    assert.equal(submitted, 0)

    press(input, 'Enter', { isComposing: true })
    await settle()
    assert.deepEqual(selected, ['Settings'], 'Enter that ends a composition runs nothing')
    assert.ok($('form'))
  })

  it('runs an item on click, but not a disabled one, and lets your click handler cancel it', async (t) => {
    let selected: string[] = []
    let { $$ } = setup(
      t,
      <Palette
        onSelect={(value) => selected.push(value)}
        extra={
          <CommandItem onSelect={(value) => selected.push(value)} mix={on('click', (event) => event.preventDefault())}>
            Canceled
          </CommandItem>
        }
      />,
    )
    await settle()
    let options = [...$$('[role=option]')] as HTMLElement[]
    let byText = (label: string) => options.find((option) => option.textContent?.trim() === label)!

    byText('Billing').click()
    byText('Calculator').click()
    byText('Canceled').click()
    await settle()
    assert.deepEqual(selected, ['Billing'])
  })

  it("lets your keydown handler cancel Command's keys", async (t) => {
    let selected: string[] = []
    let { input } = setup(
      t,
      <Command>
        <CommandInput mix={on('keydown', (event) => event.preventDefault())} />
        <CommandList>
          <CommandItem onSelect={(value) => selected.push(value)}>Calendar</CommandItem>
          <CommandItem>Billing</CommandItem>
        </CommandList>
      </Command>,
    )
    await settle()

    await pressAndSettle(input, 'ArrowDown')
    await pressAndSettle(input, 'Enter')
    assert.equal(highlighted(input), 'Calendar')
    assert.deepEqual(selected, [])
  })

  it('lights up the item under a moving pointer, unless asked not to', async (t) => {
    let { input, $$ } = setup(t)
    await settle()
    let billing = [...$$('[role=option]')].find((option) => option.textContent === 'Billing')!

    billing.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await settle()
    assert.equal(highlighted(input), 'Billing')

    let still = setup(t, <Palette disablePointerSelection />)
    await settle()
    let other = [...still.$$('[role=option]')].find((option) => option.textContent === 'Billing')!
    other.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await settle()
    assert.equal(highlighted(still.input), 'Calendar')
  })

  it('keeps focus in the input on a press in the list', async (t) => {
    let { input, $ } = setup(t)
    await settle()
    input.focus()

    let press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    $('[role=option]')!.dispatchEvent(press)
    assert.equal(press.defaultPrevented, true)
  })

  it('reports the highlight, and follows a value you control', async (t) => {
    let changes: string[] = []
    let value = 'Billing'
    let accept = true
    function Controlled(handle: Handle) {
      return () => (
        <Palette
          value={value}
          onValueChange={(next) => {
            changes.push(next)
            if (!accept) return
            value = next
            void handle.update()
          }}
        />
      )
    }
    let { input } = setup(t, <Controlled />)
    await settle()

    assert.equal(highlighted(input), 'Billing')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Settings')
    accept = false
    await pressAndSettle(input, 'ArrowUp')
    assert.deepEqual(changes, ['Settings', 'Billing'])
    assert.equal(highlighted(input), 'Settings', 'an owner that declines keeps its value')
  })

  it('filters by a search you control', async (t) => {
    let search = 'set'
    let reported: string[] = []
    function Controlled(handle: Handle) {
      return () => (
        <Command>
          <CommandInput
            value={search}
            onValueChange={(next) => {
              reported.push(next)
              search = next
              void handle.update()
            }}
          />
          <CommandList>
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Settings</CommandItem>
          </CommandList>
        </Command>
      )
    }
    let { input } = setup(t, <Controlled />)
    await settle()

    assert.equal(input.value, 'set')
    assert.deepEqual(shown(), ['Settings'])
    await type(input, 'cal')
    assert.deepEqual(reported, ['cal'])
    assert.deepEqual(shown(), ['Calendar'])
    assert.equal(highlighted(input), 'Calendar')
  })

  it('follows a form reset, and an owner of the search may keep its own', async (t) => {
    let reported: string[] = []
    let { input, $ } = setup(
      t,
      <form>
        <Palette />
        <Command>
          <CommandInput value="set" onValueChange={(next) => reported.push(next)} data-testid="controlled" />
          <CommandList>
            <CommandItem>Settings</CommandItem>
          </CommandList>
        </Command>
      </form>,
    )
    await settle()
    let controlled = $('[data-testid=controlled]') as HTMLInputElement
    let first = $('[data-slot=command]') as HTMLElement

    await type(input, 'bil')
    assert.deepEqual(shown(first), ['Billing'])
    ;($('form') as HTMLFormElement).reset()
    await settle()
    assert.equal(input.value, '')
    assert.equal(shown(first).length, 6, 'the reset search shows every item again')
    assert.equal(highlighted(input), 'Calendar')
    assert.deepEqual(reported, [''], 'the owner hears the reset')
    assert.equal(controlled.value, 'set', 'an owner that keeps its search keeps it in the input')
  })

  it('keeps the highlight on a live item while items come, go and change during a search', async (t) => {
    let labels = ['Invoice 1001', 'Invoice 1002', 'Invoice 1003']
    let disabled = new Set<string>()
    let rerender = () => {}
    function Live(handle: Handle) {
      rerender = () => void handle.update()
      return () => (
        <Command>
          <CommandInput />
          <CommandList>
            <CommandEmpty>No invoices.</CommandEmpty>
            {labels.map((label) => (
              <CommandItem key={label} disabled={disabled.has(label)}>
                {label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      )
    }
    let { input } = setup(t, <Live />)
    await settle()

    await type(input, 'invoice')
    await pressAndSettle(input, 'ArrowDown')
    assert.equal(highlighted(input), 'Invoice 1002')

    labels = ['Invoice 1000', ...labels, 'Receipt 7']
    rerender()
    await settle()
    assert.deepEqual(shown(), ['Invoice 1000', 'Invoice 1001', 'Invoice 1002', 'Invoice 1003'])
    assert.equal(highlighted(input), 'Invoice 1002', 'new items leave the highlight where it is')

    labels = labels.filter((label) => label !== 'Invoice 1002')
    rerender()
    await settle()
    assert.equal(highlighted(input), 'Invoice 1000', 'a removed item hands the highlight to the first')

    disabled.add('Invoice 1000')
    rerender()
    await settle()
    assert.equal(highlighted(input), 'Invoice 1001', 'a disabled item hands it on too')

    labels = []
    rerender()
    await settle()
    assert.equal(highlighted(input), null)
    assert.equal(input.hasAttribute('aria-activedescendant'), false)
  })

  it('never highlights or runs an item your styles or a hidden ancestor hide', async (t) => {
    let selected: string[] = []
    let select = (value: string) => selected.push(value)
    let { input, $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          <CommandItem onSelect={select} style={{ display: 'none' }}>
            Alpha
          </CommandItem>
          <div hidden>
            <CommandItem onSelect={select}>Inside a hidden box</CommandItem>
          </div>
          <CommandItem onSelect={select}>Beta</CommandItem>
          <CommandItem onSelect={select}>Gamma</CommandItem>
          <CommandItem onSelect={select}>Delta</CommandItem>
        </CommandList>
      </Command>,
    )
    await settle()
    let option = (label: string) =>
      [...$$('[role=option]')].find((element) => element.textContent === label) as HTMLElement

    assert.equal(highlighted(input), 'Beta')
    await pressAndSettle(input, 'Home')
    assert.equal(highlighted(input), 'Beta', 'Home skips what the page hides')
    await pressAndSettle(input, 'End')
    assert.equal(highlighted(input), 'Delta')

    // Your styles hide the highlighted item later, without a render.
    option('Delta').style.display = 'none'
    await settle()
    assert.equal(highlighted(input), 'Beta', 'the highlight leaves an item that stops showing')

    // visibility: hidden changes no size, and still moves the highlight before any key.
    option('Beta').style.visibility = 'hidden'
    await settle()
    await nextFrame()
    assert.equal(highlighted(input), 'Gamma', 'the highlight leaves an item that turns invisible')
    await pressAndSettle(input, 'Enter')
    assert.deepEqual(selected, ['Gamma'])
  })

  it('moves the highlight off items that turn inert or invisible, inside or around the command, without a key', async (t) => {
    let style = document.createElement('style')
    style.textContent = '.gone { visibility: hidden }'
    document.head.append(style)
    t.after(() => style.remove())
    let { input, $, $$ } = setup(
      t,
      <div data-testid="around">
        <Command>
          <CommandInput />
          <CommandList>
            <CommandGroup heading="Suggestions">
              <CommandItem>Calendar</CommandItem>
              <CommandItem>Calculator</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem>Profile</CommandItem>
              <CommandItem>Billing</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>,
    )
    await settle()
    let [suggestions] = [...$$('[data-slot=command-group]')] as HTMLElement[]
    let around = $('[data-testid=around]') as HTMLElement
    let settled = async () => {
      await settle()
      await nextFrame()
    }

    assert.equal(highlighted(input), 'Calendar')
    suggestions.inert = true
    await settled()
    assert.equal(highlighted(input), 'Profile', 'an inert group gives up the highlight')

    ;[...$$('[role=option]')].find((option) => option.textContent === 'Profile')!.classList.add('gone')
    await settled()
    assert.equal(highlighted(input), 'Billing', 'a class that hides the item moves it on')

    around.inert = true
    await settled()
    assert.equal(highlighted(input), null, 'nothing is highlighted while the whole command is inert')
    around.inert = false
    await settled()
    assert.equal(highlighted(input), 'Billing', 'the same item lights up again')
  })

  it('lights up a result again when you replace the filter during a search', async (t) => {
    let selected: string[] = []
    let filter = (value: string) => (value === 'Alpha' ? 1 : 0)
    let rerender = () => {}
    function Swapping(handle: Handle) {
      rerender = () => void handle.update()
      return () => (
        <Command filter={filter}>
          <CommandInput />
          <CommandList>
            <CommandItem onSelect={(value) => selected.push(value)}>Alpha</CommandItem>
            <CommandItem onSelect={(value) => selected.push(value)}>Beta</CommandItem>
          </CommandList>
        </Command>
      )
    }
    let { input } = setup(t, <Swapping />)
    await settle()

    await type(input, 'a')
    assert.deepEqual(shown(), ['Alpha'])
    assert.equal(highlighted(input), 'Alpha')

    filter = (value: string) => (value === 'Beta' ? 1 : 0)
    rerender()
    await settle()
    assert.deepEqual(shown(), ['Beta'])
    assert.equal(highlighted(input), 'Beta')
    await pressAndSettle(input, 'Enter')
    assert.deepEqual(selected, ['Beta'])
  })

  it('scrolls only its own list, never the page, also when it mounts below the fold', async (t) => {
    // The scroll positions of this page and the pages around it: the test runs in a frame.
    let pages = () => {
      let tops: number[] = []
      for (let view: Window = window; ; view = view.parent) {
        tops.push(view.document.scrollingElement!.scrollTop)
        if (view === view.parent) return tops
      }
    }
    let before = pages()
    let { input, $ } = setup(
      t,
      <div>
        <div style={{ height: '4000px' }}>Above the command</div>
        <Command>
          <CommandInput />
          <CommandList>
            {Array.from({ length: 40 }, (_, index) => (
              <CommandItem key={index}>{`Invoice ${1000 + index}`}</CommandItem>
            ))}
          </CommandList>
        </Command>
      </div>,
    )
    await settle()
    await nextFrame()
    assert.deepEqual(pages(), before, 'mounting moves nothing on the page')

    let list = $('[role=listbox]') as HTMLElement
    input.focus({ preventScroll: true })
    await type(input, 'invoice 10')
    await pressAndSettle(input, 'End')
    assert.ok(list.scrollTop > 0, 'the list scrolls to the last item')
    assert.deepEqual(pages(), before, 'the keys scroll the list, not the page')
  })

  it('moves the highlight off an item the search hides', async (t) => {
    let { input } = setup(t)
    await settle()
    await pressAndSettle(input, 'End')
    assert.equal(highlighted(input), 'Settings')

    await type(input, 'bil')
    assert.equal(highlighted(input), 'Billing')
  })

  it('keeps several commands apart', async (t) => {
    let { $$ } = setup(
      t,
      <div>
        <Palette />
        <Palette />
      </div>,
    )
    await settle()
    let [first, second] = [...$$('input')] as HTMLInputElement[]
    let [firstRoot, secondRoot] = [...$$('[data-slot=command]')]

    await type(first, 'bill')
    await pressAndSettle(second, 'End')
    assert.deepEqual(shown(firstRoot), ['Billing'])
    assert.equal(shown(secondRoot).length, 6)
    assert.equal(highlighted(first), 'Billing')
    assert.equal(highlighted(second), 'Settings')
    assert.notEqual(first.getAttribute('aria-controls'), second.getAttribute('aria-controls'))
  })

  it('stops reporting once it leaves', async (t) => {
    let changes: string[] = []
    let { input, root, act } = setup(t, <Palette onValueChange={(value) => changes.push(value)} />)
    await settle()
    let count = changes.length

    await act(() => root.render(<div />))
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    press(input, 'ArrowDown')
    await settle()
    assert.equal(changes.length, count)
  })

  it('reads the value from the text without the shortcut, and from text your own component renders', async (t) => {
    let selected: string[] = []
    function Label() {
      return () => <span>Reports</span>
    }
    let { input, $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          <CommandItem onSelect={(value) => selected.push(value)}>
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={(value) => selected.push(value)}>
            <Label />
          </CommandItem>
        </CommandList>
      </Command>,
    )
    await settle()

    let [profile, reports] = [...$$('[role=option]')]
    assert.equal(profile.getAttribute('data-value'), 'Profile')
    assert.equal(reports.getAttribute('data-value'), 'Reports')
    await type(input, 'rep')
    assert.deepEqual(shown(), ['Reports'])
    await pressAndSettle(input, 'Enter')
    assert.deepEqual(selected, ['Reports'])
  })

  it('keeps forced items and separators that always render, and forced items count as no result', async (t) => {
    let { input, $, $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandItem>Calendar</CommandItem>
          <CommandSeparator alwaysRender />
          <CommandItem forceMount>Create a new command</CommandItem>
          <CommandGroup heading="Help" forceMount>
            <CommandItem>Shortcuts</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    )
    await settle()

    await type(input, 'zzz')
    assert.deepEqual(shown(), ['Create a new command', 'Shortcuts'])
    assert.equal($('[data-slot=command-empty]')?.textContent, 'No results found.')
    assert.equal(($('[data-slot=command-separator]') as HTMLElement).hidden, false)
    assert.equal(($$('[data-slot=command-group]')[0] as HTMLElement).hidden, false)
    assert.equal(highlighted(input), 'Create a new command')
  })

  it('shows the check of a checked item and tells assistive technology', async (t) => {
    let { $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          <CommandItem checked>Remix</CommandItem>
          <CommandItem checked={false}>Astro</CommandItem>
          <CommandItem>Hono</CommandItem>
        </CommandList>
      </Command>,
    )
    await settle()
    let [remix, astro, hono] = [...$$('[role=option]')]
    let indicator = (option: Element) => getComputedStyle(option.querySelector('[data-slot=command-item-indicator]')!)

    assert.equal(remix.getAttribute('aria-checked'), 'true')
    assert.equal(astro.getAttribute('aria-checked'), 'false')
    assert.equal(hono.hasAttribute('aria-checked'), false)
    assert.equal(indicator(remix).opacity, '1')
    assert.equal(indicator(astro).opacity, '0', 'an unchecked item keeps the place of its check')
    assert.equal(indicator(hono).display, 'none', 'an item that is never checked leaves the room to its text')
  })

  it('scrolls the highlighted item into view', async (t) => {
    let { input, $, $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          {Array.from({ length: 40 }, (_, index) => (
            <CommandItem key={index}>{`Invoice ${1000 + index}`}</CommandItem>
          ))}
        </CommandList>
      </Command>,
    )
    await settle()
    let list = $('[role=listbox]') as HTMLElement
    let last = $$('[role=option]')[39] as HTMLElement

    await pressAndSettle(input, 'End')
    let box = list.getBoundingClientRect()
    let item = last.getBoundingClientRect()
    assert.ok(list.scrollTop > 0)
    assert.ok(
      item.bottom <= box.bottom + 1 && item.top >= box.top - 1,
      `${item.top}–${item.bottom} in ${box.top}–${box.bottom}`,
    )
  })

  it('scrolls a long list of groups as a whole, and never cuts a group short', async (t) => {
    let { input, $, $$ } = setup(
      t,
      <Command>
        <CommandInput />
        <CommandList>
          {['Navigation', 'Actions', 'View', 'Account'].map((heading) => (
            <CommandGroup key={heading} heading={heading}>
              {Array.from({ length: 6 }, (_, index) => (
                <CommandItem key={index}>{`${heading} ${index + 1}`}</CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>,
    )
    await settle()
    let list = $('[role=listbox]') as HTMLElement

    for (let group of $$('[data-slot=command-group]') as NodeListOf<HTMLElement>) {
      assert.ok(group.scrollHeight <= group.clientHeight + 1, `${group.textContent?.slice(0, 10)} shows all its items`)
    }
    await pressAndSettle(input, 'End')
    let last = $$('[role=option]')[23] as HTMLElement
    let box = list.getBoundingClientRect()
    let item = last.getBoundingClientRect()
    assert.ok(list.scrollTop > 0, 'the list scrolls')
    assert.ok(
      item.bottom <= box.bottom + 1 && item.top >= box.top - 1,
      `${item.top}–${item.bottom} in ${box.top}–${box.bottom}`,
    )
  })

  it('shares its state with parts you build on it', async (t) => {
    function Count(handle: Handle) {
      return () => {
        let command = getCommandContext(handle, 'Count')
        return (
          <p data-testid="count">{command.ready ? `${command.count} for “${command.search}”, ${command.value}` : ''}</p>
        )
      }
    }
    let { input, $ } = setup(t, <Palette extra={<Count />} />)
    await settle()

    await type(input, 'bil')
    assert.equal($('[data-testid=count]')?.textContent, '1 for “bil”, Billing')
  })

  it('names the input and the list as you ask', async (t) => {
    let { input, $ } = setup(t, <Palette label="Search invoices" />)
    assert.equal(input.getAttribute('aria-label'), 'Search invoices')
    assert.equal($('[role=listbox]')?.getAttribute('aria-label'), 'Suggestions')
  })
})

function DialogPalette(handle: Handle<Omit<CommandDialogProps, 'children'> & { onSelect?: (value: string) => void }>) {
  return () => {
    let { onSelect, ...props } = handle.props
    return (
      <CommandDialog {...props}>
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem onSelect={onSelect}>Calendar</CommandItem>
              <CommandItem onSelect={onSelect}>Billing</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    )
  }
}

function Opener(handle: Handle<{ cancelClose?: boolean; closeOnSelect?: boolean }>) {
  let open = false
  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          open = true
          void handle.update()
        })}
      >
        Open the palette
      </button>
      <DialogPalette
        open={open}
        onOpenChange={(next, details) => {
          if (!next && handle.props.cancelClose) return details.cancel()
          open = next
          void handle.update()
        }}
        onSelect={() => {
          if (!handle.props.closeOnSelect) return
          open = false
          void handle.update()
        }}
      />
    </div>
  )
}

async function open(t: TestContext, node: RemixNode = <Opener />) {
  let result = mount(t, node)
  await settle()
  let trigger = result.$('button') as HTMLButtonElement
  trigger.focus()
  trigger.click()
  await settle()
  await nextFrame()
  await settle()
  let dialog = result.$('dialog') as HTMLDialogElement
  let input = result.$('input') as HTMLInputElement
  return { ...result, trigger, dialog, input }
}

describe('CommandDialog', () => {
  it('opens modally with the input focused and named by the title', async (t) => {
    let { dialog, input, $ } = await open(t)

    assert.equal(dialog.open, true)
    assert.ok(dialog.matches(':modal'))
    assert.equal(document.activeElement, input)
    assert.equal(input.disabled, false)
    assert.equal(highlighted(input), 'Calendar')
    let title = $('h2') as HTMLElement
    assert.equal(dialog.getAttribute('aria-labelledby'), title.id)
    assert.equal(input.getAttribute('aria-labelledby'), title.id)
    assert.equal(title.textContent, 'Command Palette')
    assert.ok(dialog.contains(title), 'the hidden title sits inside the dialog')
  })

  it('closes on Escape from the input and returns focus to the trigger', async (t) => {
    let { dialog, input, trigger } = await open(t)

    await type(input, 'bil')
    press(input, 'Escape')
    await settle()
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, trigger)
  })

  it('stays open when the owner cancels the close', async (t) => {
    let { dialog, input } = await open(t, <Opener cancelClose />)

    press(input, 'Escape')
    await settle()
    assert.equal(dialog.open, true)
  })

  it('closes from an item the owner wires to close it, and returns focus', async (t) => {
    let { dialog, input, trigger } = await open(t, <Opener closeOnSelect />)

    await pressAndSettle(input, 'ArrowDown')
    await pressAndSettle(input, 'Enter')
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, trigger)
  })

  it('starts afresh each time it opens', async (t) => {
    let { dialog, input, trigger, $ } = await open(t)
    await type(input, 'bil')
    press(input, 'Escape')
    await settle()
    await nextFrame()

    trigger.click()
    await settle()
    await nextFrame()
    await settle()
    let fresh = $('input') as HTMLInputElement
    assert.equal(fresh === input, false, 'a new input')
    assert.equal(dialog.open, true)
    assert.equal(fresh.value, '')
    assert.deepEqual(shown(dialog), ['Calendar', 'Billing'])
    assert.equal(highlighted(fresh), 'Calendar')
    assert.equal(document.activeElement, fresh)
  })

  it('focuses the input of a dialog that starts open', async (t) => {
    mount(t, <DialogPalette defaultOpen />)
    await settle()
    await nextFrame()
    await settle()

    assert.equal(document.activeElement?.getAttribute('role'), 'combobox')
  })
})
