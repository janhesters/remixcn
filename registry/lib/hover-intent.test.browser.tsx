import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { createHoverIntent, hoverIntent } from '#remixcn/lib/hover-intent.ts'
import type { HoverIntentOptions, HoverIntentReason } from '#remixcn/lib/hover-intent.ts'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A 100×40 trigger at (100, 100) and a 200×80 popup 4px below it. */
function setup(t: TestContext) {
  let trigger = document.createElement('button')
  trigger.textContent = 'Trigger'
  trigger.style.cssText = 'position: fixed; left: 100px; top: 100px; width: 100px; height: 40px; margin: 0'
  let popup = document.createElement('div')
  popup.style.cssText = 'position: fixed; left: 100px; top: 144px; width: 200px; height: 80px'
  let link = document.createElement('a')
  link.href = '#card'
  link.textContent = 'Card link'
  popup.append(link)
  let outside = document.createElement('button')
  outside.textContent = 'Outside'
  outside.style.cssText = 'position: fixed; left: 400px; top: 400px'
  document.body.append(trigger, popup, outside)
  t.after(() => {
    trigger.remove()
    popup.remove()
    outside.remove()
  })
  return { trigger, popup, link, outside }
}

/** Tracks the open state the way a popup root would: it follows every request. */
function track(t: TestContext, trigger: HTMLElement, options: Partial<HoverIntentOptions> = {}) {
  let changes: Array<[boolean, HoverIntentReason]> = []
  let state = { open: false }
  let current: HoverIntentOptions
  let configure = (next: Partial<HoverIntentOptions>) => {
    current = {
      ...current,
      ...next,
      open: state.open,
      onOpenChange(open, reason) {
        changes.push([open, reason])
        state.open = open
        intent.update({ ...current, open })
      },
    }
    return current
  }
  current = { open: false, onOpenChange() {} }
  let intent = createHoverIntent(trigger, configure(options))
  t.after(() => intent.release())
  return {
    intent,
    changes,
    state,
    update(next: Partial<HoverIntentOptions>) {
      intent.update(configure(next))
    },
  }
}

function pointer(type: string, target: Element, x: number, y: number, pointerType = 'mouse') {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      cancelable: true,
      composed: true,
      pointerId: pointerType === 'touch' ? 2 : 1,
      isPrimary: true,
      pointerType,
      clientX: x,
      clientY: y,
    }),
  )
}

const enter = (target: Element, x: number, y: number, pointerType?: string) =>
  pointer('pointerenter', target, x, y, pointerType)
const leave = (target: Element, x: number, y: number, pointerType?: string) =>
  pointer('pointerleave', target, x, y, pointerType)
const move = (x: number, y: number) => pointer('pointermove', document.elementFromPoint(x, y) ?? document.body, x, y)

describe('createHoverIntent', () => {
  it('opens after the delay while the pointer stays, and not when it leaves first', async (t) => {
    let { trigger } = setup(t)
    let { changes } = track(t, trigger, { delay: 40 })

    enter(trigger, 150, 120)
    await wait(10)
    leave(trigger, 90, 120)
    await wait(60)
    assert.deepEqual(changes, [])

    enter(trigger, 150, 120)
    await wait(20)
    assert.deepEqual(changes, [])
    await wait(40)
    assert.deepEqual(changes, [[true, 'trigger-hover']])
  })

  it('opens at once without a delay, and reads a delay function when the pointer arrives', async (t) => {
    let { trigger } = setup(t)
    let delays = 0
    let { changes } = track(t, trigger, { delay: () => (delays++, 0) })

    enter(trigger, 150, 120)
    assert.deepEqual(changes, [[true, 'trigger-hover']])
    assert.equal(delays, 1)
  })

  it('ignores touch, so a tap on a link activates it the first time', async (t) => {
    let { trigger } = setup(t)
    let { changes } = track(t, trigger)

    enter(trigger, 150, 120, 'touch')
    pointer('pointerdown', trigger, 150, 120, 'touch')
    pointer('pointerup', trigger, 150, 120, 'touch')
    leave(trigger, 150, 120, 'touch')
    await wait(20)
    assert.deepEqual(changes, [])

    enter(trigger, 150, 120, 'pen')
    assert.deepEqual(changes, [[true, 'trigger-hover']])
  })

  it('closes after the close delay once the pointer leaves, unless it comes back first', async (t) => {
    let { trigger } = setup(t)
    let { changes } = track(t, trigger, { closeDelay: 40 })

    enter(trigger, 150, 120)
    leave(trigger, 90, 120)
    await wait(10)
    enter(trigger, 150, 120)
    await wait(60)
    assert.deepEqual(changes, [[true, 'trigger-hover']])

    leave(trigger, 90, 120)
    await wait(20)
    assert.equal(changes.length, 1)
    await wait(40)
    assert.deepEqual(changes.at(-1), [false, 'trigger-hover'])
  })

  it('keeps a hoverable popup open while the pointer crosses the gap and rests on it', async (t) => {
    let { trigger, popup } = setup(t)
    let { changes, state } = track(t, trigger, { popup: () => popup })

    enter(trigger, 150, 120)
    leave(trigger, 150, 142)
    move(150, 143)
    enter(popup, 150, 150)
    await wait(20)
    assert.deepEqual(changes, [[true, 'trigger-hover']])
    assert.equal(state.open, true)

    // Back across the gap to the trigger, then away from both.
    leave(popup, 150, 143)
    move(150, 142)
    enter(trigger, 150, 138)
    await wait(20)
    assert.equal(state.open, true)

    leave(trigger, 90, 120)
    await wait(20)
    assert.deepEqual(changes.at(-1), [false, 'trigger-hover'])
  })

  it('closes when the pointer leaves the gap sideways, and without a popup to hover', async (t) => {
    let { trigger, popup } = setup(t)
    let hoverable = track(t, trigger, { popup: () => popup })

    enter(trigger, 150, 120)
    leave(trigger, 150, 142)
    move(150, 143)
    move(320, 143)
    await wait(20)
    assert.deepEqual(hoverable.changes.at(-1), [false, 'trigger-hover'])

    hoverable.intent.release()
    let plain = track(t, trigger)
    enter(trigger, 150, 120)
    leave(trigger, 150, 142)
    enter(popup, 150, 150)
    await wait(20)
    assert.deepEqual(plain.changes, [
      [true, 'trigger-hover'],
      [false, 'trigger-hover'],
    ])
  })

  it('opens at once on keyboard focus and stays open while focus moves into the popup', async (t) => {
    let { trigger, popup, link, outside } = setup(t)
    let { changes } = track(t, trigger, { delay: 500, popup: () => popup })

    trigger.focus()
    assert.ok(trigger.matches(':focus-visible'))
    assert.deepEqual(changes, [[true, 'trigger-focus']])

    link.focus()
    await wait(20)
    assert.equal(changes.length, 1)

    outside.focus()
    await wait(20)
    assert.deepEqual(changes.at(-1), [false, 'focus-out'])
  })

  it('opens at once on keyboard focus while a hover delay runs', async (t) => {
    let { trigger } = setup(t)
    let { changes } = track(t, trigger, { delay: 500 })

    enter(trigger, 150, 120)
    trigger.focus()
    assert.ok(trigger.matches(':focus-visible'))
    assert.deepEqual(changes, [[true, 'trigger-focus']])

    // The hover wait is gone, so nothing asks again.
    await wait(550)
    assert.equal(changes.length, 1)
  })

  it('stays open while focused after the pointer leaves, and while hovered after focus leaves', async (t) => {
    let { trigger, outside } = setup(t)
    let { changes, state } = track(t, trigger)

    trigger.focus()
    enter(trigger, 150, 120)
    leave(trigger, 90, 120)
    await wait(20)
    assert.equal(state.open, true)

    enter(trigger, 150, 120)
    outside.focus()
    await wait(20)
    assert.equal(state.open, true)
    assert.equal(changes.length, 1)
  })

  it('never opens on focus without openOnFocus, but focus inside keeps an open popup open', async (t) => {
    let { trigger, popup, link, outside } = setup(t)
    let { changes, state } = track(t, trigger, { openOnFocus: false, delay: 30, popup: () => popup })

    trigger.focus()
    await wait(50)
    assert.deepEqual(changes, [])

    // Focus that arrives while the hover delay runs leaves the delay alone.
    leave(trigger, 90, 120)
    trigger.blur()
    enter(trigger, 150, 120)
    trigger.focus()
    assert.deepEqual(changes, [])
    await wait(50)
    assert.deepEqual(changes, [[true, 'trigger-hover']])

    // Any focus counts, not only keyboard focus, as when a menu focuses the item under the pointer.
    link.focus()
    leave(trigger, 90, 120)
    await wait(20)
    assert.equal(state.open, true)

    outside.focus()
    await wait(20)
    assert.deepEqual(changes.at(-1), [false, 'focus-out'])
  })

  it('closes on a click when asked, and stays closed until the pointer comes back', async (t) => {
    let { trigger } = setup(t)
    let { changes, state } = track(t, trigger, { closeOnClick: true, delay: 30 })

    enter(trigger, 150, 120)
    await wait(50)
    trigger.click()
    assert.deepEqual(changes.at(-1), [false, 'trigger-press'])
    await wait(50)
    assert.equal(state.open, false)

    // A click while the open delay runs cancels it.
    leave(trigger, 90, 120)
    enter(trigger, 150, 120)
    trigger.click()
    await wait(50)
    assert.equal(state.open, false)

    leave(trigger, 90, 120)
    enter(trigger, 150, 120)
    await wait(50)
    assert.equal(state.open, true)
  })

  it('never calls back once released, even with a timer running', async (t) => {
    let { trigger } = setup(t)
    let { intent, changes } = track(t, trigger, { delay: 30 })

    enter(trigger, 150, 120)
    intent.release()
    await wait(50)
    enter(trigger, 150, 120)
    trigger.focus()
    assert.deepEqual(changes, [])
  })

  it('cancels a pending open when disabled, and restarts it when the delay changes', async (t) => {
    let { trigger } = setup(t)
    let { changes, update } = track(t, trigger, { delay: 30 })

    enter(trigger, 150, 120)
    update({ disabled: true })
    await wait(50)
    assert.deepEqual(changes, [])

    update({ disabled: false, delay: 30 })
    leave(trigger, 90, 120)
    enter(trigger, 150, 120)
    await wait(20)
    update({ delay: 60 })
    await wait(20)
    assert.deepEqual(changes, [])
    await wait(60)
    assert.deepEqual(changes, [[true, 'trigger-hover']])
  })

  it('drops a pending close once the popup closes another way', async (t) => {
    let { trigger } = setup(t)
    let { changes, state, update } = track(t, trigger, { closeDelay: 30 })

    enter(trigger, 150, 120)
    leave(trigger, 90, 120)
    state.open = false
    update({})
    await wait(50)
    assert.deepEqual(changes, [[true, 'trigger-hover']])
  })
})

describe('hoverIntent', () => {
  function mount(t: TestContext, changes: boolean[]) {
    let options: HoverIntentOptions = { open: false, delay: 30, onOpenChange: (open) => changes.push(open) }
    let result = render(<button mix={hoverIntent(options)}>Hover me</button>)
    t.after(result.cleanup)
    return { ...result, button: result.container.querySelector('button')! }
  }

  it('tracks its host while mounted', async (t) => {
    let changes: boolean[] = []
    let { button } = mount(t, changes)

    enter(button, 10, 10)
    await wait(50)
    assert.deepEqual(changes, [true])
  })

  it('cancels its timers when its host is removed', async (t) => {
    let changes: boolean[] = []
    let { button, cleanup } = mount(t, changes)

    enter(button, 10, 10)
    cleanup()
    await wait(50)
    assert.deepEqual(changes, [])
  })
})
