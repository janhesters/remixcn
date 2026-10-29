import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { ToggleGroup, ToggleGroupChangeEvent, ToggleGroupItem, toggleGroupChangeType } from './toggle-group.tsx'
import type { ToggleGroupProps } from './toggle-group.tsx'

function pressedValues(container: ParentNode) {
  return [...container.querySelectorAll('[data-slot="toggle-group-item"]')]
    .filter((item) => item.getAttribute('aria-pressed') === 'true')
    .map((item) => item.getAttribute('value'))
}

function tabStops(container: ParentNode) {
  return [...container.querySelectorAll('button')]
    .filter((button) => button.tabIndex === 0)
    .map((button) => button.value)
}

function press(key: string) {
  let target = document.activeElement as HTMLElement
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function focused() {
  return (document.activeElement as HTMLButtonElement | null)?.value
}

// theme.css's rule, so a hidden item stays hidden over its own display.
const hiddenRule = '[hidden] { display: none !important }'

// The group watches its items for changes that don't render it, and syncs in a later task.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

interface ItemSpec {
  value: string
  hidden?: boolean
}

/** Items that a component below the group renders and updates on its own. */
function OwnItems(handle: Handle<{ items: ItemSpec[]; control: { set?: (items: ItemSpec[]) => void } }>) {
  let items = handle.props.items
  handle.props.control.set = (next) => {
    items = next
    void handle.update()
  }

  return () => (
    <>
      {items.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value} hidden={item.hidden} />
      ))}
    </>
  )
}

function Alignment(handle: Handle<Partial<ToggleGroupProps> & { disabledItem?: string }>) {
  return () => {
    let { disabledItem, ...groupProps } = handle.props
    return (
      <ToggleGroup aria-label="Alignment" {...groupProps}>
        {['left', 'center', 'right', 'justify'].map((value) => (
          <ToggleGroupItem key={value} value={value} aria-label={value} disabled={value === disabledItem} />
        ))}
      </ToggleGroup>
    )
  }
}

describe('Toggle Group in the browser', () => {
  it('presses one item at a time by default, and lets the pressed item be released', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <div mix={on(toggleGroupChangeType, (event) => void changes.push(event.value))}>
        <Alignment />
      </div>,
    )
    t.after(cleanup)
    let item = (value: string) => $(`[value="${value}"]`) as HTMLButtonElement

    await act(() => item('left').click())
    await act(() => item('right').click())
    assert.deepEqual(pressedValues(container), ['right'])

    await act(() => item('right').click())
    assert.deepEqual(pressedValues(container), [])
    assert.deepEqual(changes, [['left'], ['right'], []])
  })

  it('presses several items in multiple mode', async (t) => {
    let { $, act, container, cleanup } = render(<Alignment multiple defaultValue={['center']} />)
    t.after(cleanup)
    let item = (value: string) => $(`[value="${value}"]`) as HTMLButtonElement

    await act(() => item('left').click())
    await act(() => item('justify').click())
    await act(() => item('center').click())

    assert.deepEqual(pressedValues(container), ['left', 'justify'])
  })

  it('keeps its value when a listener cancels the change', async (t) => {
    let { $, act, container, cleanup } = render(
      <div mix={on(toggleGroupChangeType, (event) => event.preventDefault())}>
        <Alignment defaultValue={['left']} />
      </div>,
    )
    t.after(cleanup)

    await act(() => ($('[value="right"]') as HTMLButtonElement).click())

    assert.deepEqual(pressedValues(container), ['left'])
  })

  it('follows a controlled value, and a parent that owns it updates from change events', async (t) => {
    function Filter(handle: Handle) {
      let value = ['all']
      return () => (
        <ToggleGroup
          aria-label="Filter"
          value={value}
          mix={on(toggleGroupChangeType, (event) => {
            value = event.value.length > 0 ? event.value : ['all']
            handle.update()
          })}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
        </ToggleGroup>
      )
    }
    let { $, act, container, cleanup } = render(<Filter />)
    t.after(cleanup)
    let item = (value: string) => $(`[value="${value}"]`) as HTMLButtonElement

    await act(() => item('active').click())
    assert.deepEqual(pressedValues(container), ['active'])

    await act(() => item('active').click())
    assert.deepEqual(pressedValues(container), ['all'])
  })

  it('updates its items when its props change', async (t) => {
    let { root, container, cleanup } = render(<Alignment value={['left']} />)
    t.after(cleanup)

    root.render(<Alignment value={['center', 'right']} multiple variant="outline" size="lg" disabled />)
    root.flush()

    let items = [...container.querySelectorAll('button')]
    assert.deepEqual(pressedValues(container), ['center', 'right'])
    assert.ok(items.every((item) => item.disabled && item.dataset.variant === 'outline' && item.dataset.size === 'lg'))
  })

  it('ignores clicks while disabled, and never submits a surrounding form', async (t) => {
    let submits = 0
    let { $, $$, act, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <Alignment disabled />
        <Alignment />
      </form>,
    )
    t.after(cleanup)
    let [disabled, enabled] = [...$$('[role="group"]')]

    await act(() => {
      ;(disabled.querySelector('[value="left"]') as HTMLButtonElement).click()
      ;(enabled.querySelector('[value="left"]') as HTMLButtonElement).click()
    })

    assert.deepEqual([pressedValues(disabled), pressedValues(enabled), submits], [[], ['left'], 0])
    assert.deepEqual([...new FormData($('form') as HTMLFormElement)], [])
  })

  it('gives the group one tab stop: the first pressed item, or else the first enabled one', async (t) => {
    let pressed = render(<Alignment defaultValue={['right']} />)
    t.after(pressed.cleanup)
    let none = render(<Alignment disabledItem="left" />)
    t.after(none.cleanup)

    assert.deepEqual(tabStops(pressed.container), ['right'])
    assert.deepEqual(tabStops(none.container), ['center'])
  })

  it('moves focus with the arrow keys, skips disabled items and wraps around', async (t) => {
    let { $, container, cleanup } = render(<Alignment disabledItem="right" />)
    t.after(cleanup)
    ;($('[value="left"]') as HTMLButtonElement).focus()

    press('ArrowRight')
    assert.equal(focused(), 'center')
    press('ArrowRight')
    assert.equal(focused(), 'justify')
    press('ArrowRight')
    assert.equal(focused(), 'left')
    press('ArrowLeft')
    assert.equal(focused(), 'justify')
    press('ArrowDown')
    assert.equal(focused(), 'justify')

    assert.deepEqual(tabStops(container), ['justify'])
  })

  it('jumps to the ends with Home and End, and stops there without wrapping when asked', async (t) => {
    let { $, cleanup } = render(<Alignment loopFocus={false} />)
    t.after(cleanup)
    ;($('[value="center"]') as HTMLButtonElement).focus()

    press('End')
    assert.equal(focused(), 'justify')
    press('ArrowRight')
    assert.equal(focused(), 'justify')
    press('Home')
    assert.equal(focused(), 'left')
    press('ArrowLeft')
    assert.equal(focused(), 'left')
  })

  it('mirrors the arrow keys in right-to-left text, and uses up and down when vertical', async (t) => {
    let rtl = render(
      <div dir="rtl">
        <Alignment />
      </div>,
    )
    t.after(rtl.cleanup)
    ;(rtl.$('[value="left"]') as HTMLButtonElement).focus()
    press('ArrowLeft')
    assert.equal(focused(), 'center')

    let vertical = render(<Alignment orientation="vertical" />)
    t.after(vertical.cleanup)
    ;(vertical.$('[value="left"]') as HTMLButtonElement).focus()
    press('ArrowRight')
    assert.equal(focused(), 'left')
    press('ArrowDown')
    assert.equal(focused(), 'center')
    press('ArrowUp')
    assert.equal(focused(), 'left')
  })

  it('keeps one tab stop as items come and go', async (t) => {
    function Growing(handle: Handle<{ count: number }>) {
      return () => (
        <ToggleGroup aria-label="Pages">
          {Array.from({ length: handle.props.count }, (_, index) => (
            <ToggleGroupItem key={index} value={String(index + 1)} />
          ))}
        </ToggleGroup>
      )
    }
    let { root, container, cleanup } = render(<Growing count={2} />)
    t.after(cleanup)
    ;(container.querySelector('[value="2"]') as HTMLButtonElement).focus()

    root.render(<Growing count={4} />)
    root.flush()
    assert.deepEqual(tabStops(container), ['2'])

    root.render(<Growing count={1} />)
    root.flush()
    assert.deepEqual(tabStops(container), ['1'])
  })

  it('keeps one tab stop when a component below the group adds or removes items', async (t) => {
    let control: { set?: (items: ItemSpec[]) => void } = {}
    let { act, container, cleanup } = render(
      <ToggleGroup aria-label="Pages">
        <OwnItems items={[{ value: 'a' }, { value: 'b' }]} control={control} />
      </ToggleGroup>,
    )
    t.after(cleanup)
    assert.deepEqual(tabStops(container), ['a'])

    await act(async () => {
      control.set?.([{ value: 'b' }])
      await settle()
    })
    assert.deepEqual(tabStops(container), ['b'])

    await act(async () => {
      control.set?.([{ value: 'a' }, { value: 'b' }, { value: 'c' }])
      await settle()
    })
    assert.deepEqual(tabStops(container), ['b'])
  })

  it('skips hidden items for the tab stop and the arrow keys', async (t) => {
    let { $, cleanup } = render(
      <div>
        <style>{hiddenRule}</style>
        <ToggleGroup aria-label="Hidden first">
          <ToggleGroupItem value="a" style={{ display: 'none' }} />
          <ToggleGroupItem value="b" />
        </ToggleGroup>
        <ToggleGroup aria-label="Hidden middle">
          <ToggleGroupItem value="c" />
          <ToggleGroupItem value="d" style={{ display: 'none' }} />
          <ToggleGroupItem value="e" hidden />
          <ToggleGroupItem value="f" style={{ visibility: 'hidden' }} />
          <ToggleGroupItem value="g" />
        </ToggleGroup>
      </div>,
    )
    t.after(cleanup)

    assert.deepEqual(tabStops($('[aria-label="Hidden first"]') as HTMLElement), ['b'])

    ;($('[value="c"]') as HTMLButtonElement).focus()
    press('ArrowRight')
    assert.equal(focused(), 'g')
    press('ArrowRight')
    assert.equal(focused(), 'c')
    press('End')
    assert.equal(focused(), 'g')
  })

  it('moves the tab stop off an item that a component below the group hides', async (t) => {
    let control: { set?: (items: ItemSpec[]) => void } = {}
    let { act, container, cleanup } = render(
      <div>
        <style>{hiddenRule}</style>
        <ToggleGroup aria-label="Views">
          <OwnItems items={[{ value: 'grid' }, { value: 'list' }]} control={control} />
        </ToggleGroup>
      </div>,
    )
    t.after(cleanup)

    await act(async () => {
      control.set?.([{ value: 'grid', hidden: true }, { value: 'list' }])
      await settle()
    })

    assert.deepEqual(tabStops(container), ['list'])
  })

  it('moves the tab stop off an item that a style sheet outside the group hides, before Tab moves focus', async (t) => {
    let { $, container, cleanup } = render(
      <div>
        <style>{'.no-grid [value="grid"] { visibility: hidden } .no-list [value="list"] { display: none }'}</style>
        <ToggleGroup aria-label="Views">
          <ToggleGroupItem value="grid" />
          <ToggleGroupItem value="list" />
          <ToggleGroupItem value="table" />
        </ToggleGroup>
      </div>,
    )
    t.after(cleanup)
    let wrapper = $('div') as HTMLElement
    let pressTab = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    assert.deepEqual(tabStops(container), ['grid'])

    // A class on an ancestor changes nothing inside the group, and visibility
    // changes no size, so the group checks its items when Tab is pressed.
    wrapper.classList.add('no-grid')
    pressTab()
    assert.deepEqual(tabStops(container), ['list'])

    wrapper.classList.add('no-list')
    pressTab()
    assert.deepEqual(tabStops(container), ['table'])
  })

  it('leaves nested groups to themselves', async (t) => {
    let { $, cleanup } = render(
      <ToggleGroup aria-label="Outer">
        <ToggleGroupItem value="a" />
        <ToggleGroup aria-label="Inner">
          <ToggleGroupItem value="b" />
          <ToggleGroupItem value="c" />
        </ToggleGroup>
        <ToggleGroupItem value="d" />
      </ToggleGroup>,
    )
    t.after(cleanup)
    ;($('[value="a"]') as HTMLButtonElement).focus()

    press('ArrowRight')

    assert.equal(focused(), 'd')
  })

  it('exposes its change event class for listeners that check the type', () => {
    let event = new ToggleGroupChangeEvent(['bold'])

    assert.deepEqual(
      [event.type, event.value, event.bubbles, event.cancelable],
      [toggleGroupChangeType, ['bold'], true, true],
    )
  })
})
