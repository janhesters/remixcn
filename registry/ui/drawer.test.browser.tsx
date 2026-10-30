import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import type { DialogChangeReason } from './dialog.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerSnapPointButton,
  DrawerTitle,
  DrawerTrigger,
} from './drawer.tsx'
import type { DrawerProps, DrawerSnapPoint, DrawerSnapPointChangeReason, DrawerSwipeDirection } from './drawer.tsx'

// Browser tests run without theme.css, so the tokens the layout reads are set
// here. Without --duration-normal, every transition takes 0s, so each read
// sees the drawer where its styles put it.
const tokens = css({
  '--spacing': '0.25rem',
  '--radius-xl': '0.625rem',
  '--text-sm': '0.875rem',
  '--text-sm--line-height': '1.43',
})

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div mix={tokens}>{node}</div>)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
    document.documentElement.style.fontSize = ''
  })
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function button(name: string, root: ParentNode = document) {
  let found = [...root.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

function escape(target: Element = document.activeElement ?? document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

type PointerType = 'mouse' | 'touch' | 'pen'
interface Point {
  x: number
  y: number
}

/** Sends a pointer event with a timestamp of its own, so a drag's velocity is known. */
function pointer(target: EventTarget, type: string, { x, y }: Point, time: number, pointerType: PointerType = 'mouse') {
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: pointerType === 'mouse' ? 1 : 7,
    pointerType,
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
  })
  Object.defineProperty(event, 'timeStamp', { value: time })
  target.dispatchEvent(event)
  return event
}

interface DragOptions {
  pointerType?: PointerType
  /** How long the drag takes, in ms: 1000ms over 300px is slow, 40ms over 40px is fast. */
  duration?: number
  steps?: number
  /** What ends it: a release, a cancel by the browser, or nothing, so the test can look mid-drag. */
  end?: 'up' | 'cancel' | 'none'
}

let clock = 1000

/** Drags from `target`'s center by `dx` and `dy`, as a browser sends it: down, moves on the target, up. */
function drag(target: Element, dx: number, dy: number, options: DragOptions = {}) {
  let { pointerType = 'mouse', duration = 1000, steps = 10, end = 'up' } = options
  let rect = target.getBoundingClientRect()
  let from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  let start = (clock += 10_000)
  pointer(target, 'pointerdown', from, start, pointerType)
  for (let step = 1; step <= steps; step++) {
    let at = { x: from.x + (dx * step) / steps, y: from.y + (dy * step) / steps }
    pointer(target, 'pointermove', at, start + (duration * step) / steps, pointerType)
  }
  let to = { x: from.x + dx, y: from.y + dy }
  if (end === 'up') pointer(target, 'pointerup', to, start + duration, pointerType)
  if (end === 'cancel') pointer(target, 'pointercancel', to, start + duration, pointerType)
  return to
}

/** The drawer's translation along its axis, in px. */
function translation(dialog: HTMLElement) {
  let [x = '0px', y = '0px'] = getComputedStyle(dialog).translate.split(' ')
  let axis = dialog.dataset.swipeAxis === 'x' ? x : y
  return axis === 'none' ? 0 : Number.parseFloat(axis)
}

const paragraphs = Array.from({ length: 3 }, (_, index) => `Invoice note ${index + 1}: sent, paid on time, archived.`)

function InvoiceDrawer(
  handle: Handle<DrawerProps & { label?: string; body?: RemixNode; footer?: RemixNode; inner?: RemixNode }>,
) {
  return () => {
    let { label = 'Open drawer', body, footer, inner, ...props } = handle.props

    return (
      <Drawer {...props}>
        <DrawerTrigger>{label}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Invoice INV-0042</DrawerTitle>
            <DrawerDescription>Everything that happened to it.</DrawerDescription>
          </DrawerHeader>
          {body ?? paragraphs.map((text) => <p key={text}>{text}</p>)}
          {inner}
          <DrawerFooter>
            {footer}
            <DrawerClose>Close</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }
}

async function openDrawer(act: (callback: () => void) => Promise<void>, label = 'Open drawer') {
  await act(() => button(label).click())
  await nextFrame()
  let dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
  assert.ok(dialog, 'a drawer opened')
  return dialog
}

function swipeHandle(dialog: Element) {
  let handle = dialog.querySelector(':scope > [data-slot="drawer-swipe-handle"]')
  assert.ok(handle, 'the drawer shows its swipe handle')
  return handle
}

const directions: DrawerSwipeDirection[] = ['up', 'right', 'down', 'left']
// Which way each drawer closes, as a drag.
const away: Record<DrawerSwipeDirection, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }

describe('Drawer in the browser', () => {
  it('opens as a modal dialog at the bottom, focuses itself, and closes on Escape with focus back on the trigger', async (t) => {
    let changes: Array<[boolean, DialogChangeReason]> = []
    let { $, act } = mount(t, <InvoiceDrawer onOpenChange={(open, details) => changes.push([open, details.reason])} />)
    let trigger = button('Open drawer')
    trigger.focus()
    let dialog = await openDrawer(act)

    assert.equal(dialog, $('dialog'))
    assert.ok(dialog.matches(':modal'))
    assert.equal(document.activeElement, dialog, 'no virtual keyboard opens')
    assert.ok(Math.abs(dialog.getBoundingClientRect().bottom - innerHeight) < 1, 'it sits on the bottom edge')
    assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent, 'Invoice INV-0042')

    await act(() => escape())
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, trigger)
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
    ])
  })

  for (let direction of directions) {
    it(`sits on its edge for swipeDirection ${direction}, and closes when dragged past half its size toward it`, async (t) => {
      let reasons: DialogChangeReason[] = []
      let { act } = mount(
        t,
        <InvoiceDrawer
          swipeDirection={direction}
          showSwipeHandle
          onOpenChange={(open, details) => void (open || reasons.push(details.reason))}
        />,
      )
      let dialog = await openDrawer(act)
      let rect = dialog.getBoundingClientRect()
      let edges = { up: rect.top, left: rect.left, down: innerHeight - rect.bottom, right: innerWidth - rect.right }
      assert.ok(Math.abs(edges[direction]) < 1, `touches its edge: ${JSON.stringify(edges)}`)

      let [x, y] = away[direction]
      let size = direction === 'up' || direction === 'down' ? rect.height : rect.width
      await act(() => void drag(swipeHandle(dialog), x * size * 0.6, y * size * 0.6))
      await nextFrame()
      assert.equal(dialog.open, false)
      assert.deepEqual(reasons, ['swipe'])
    })
  }

  it('follows a mouse drag on its handle, resists past its open position, and slides back after a short drag', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)
    let handle = swipeHandle(dialog)

    drag(handle, 0, 60, { end: 'none' })
    assert.ok(dialog.hasAttribute('data-swiping'))
    // It follows from where the drag passed the slop, its first 6px move, so it doesn't jump.
    assert.ok(Math.abs(translation(dialog) - 54) < 1, `follows the pointer: ${translation(dialog)}`)
    pointer(dialog, 'pointerup', { x: 0, y: 0 }, clock + 2000)
    await nextFrame()
    assert.equal(dialog.hasAttribute('data-swiping'), false)
    assert.ok(dialog.open, 'a short, slow drag keeps it open')
    assert.equal(translation(dialog), 0)

    drag(handle, 0, -100, { end: 'none' })
    assert.ok(Math.abs(translation(dialog) + 10) < 1, `resists upward: ${translation(dialog)}`)
    pointer(dialog, 'pointerup', { x: 0, y: 0 }, clock + 2000)
    await nextFrame()
    assert.ok(dialog.open)
    assert.equal(translation(dialog), 0)
  })

  it('forgets a mouse press that was let go outside the drawer', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)
    let handle = swipeHandle(dialog)
    let rect = handle.getBoundingClientRect()

    pointer(handle, 'pointerdown', { x: rect.left + 10, y: rect.top + 2 }, (clock += 10_000))
    // The pointerup lands outside, where the drawer doesn't hear it, so the next move comes without buttons.
    let hover = new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: rect.left + 10,
      clientY: rect.top + 200,
      buttons: 0,
    })
    handle.dispatchEvent(hover)
    assert.equal(dialog.hasAttribute('data-swiping'), false)
    assert.equal(translation(dialog), 0)
  })

  it('closes on a fast flick toward its edge, even a short one', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)

    await act(() => void drag(swipeHandle(dialog), 0, 40, { duration: 40, steps: 4 }))
    await nextFrame()
    assert.equal(dialog.open, false)
  })

  it('leaves mouse and pen drags on its content to text selection, and lets touch drag from there', async (t) => {
    let { act } = mount(t, <InvoiceDrawer />)
    let dialog = await openDrawer(act)
    let text = dialog.querySelector('p')!

    for (let pointerType of ['mouse', 'pen'] as const) {
      drag(text, 0, 300, { pointerType })
      await nextFrame()
      assert.ok(dialog.open, `${pointerType} drags on the content select text`)
      assert.equal(dialog.hasAttribute('data-swiping'), false)
    }

    await act(() => void drag(text, 0, dialog.offsetHeight * 0.7, { pointerType: 'touch' }))
    await nextFrame()
    assert.equal(dialog.open, false, 'a touch drag on the content closes it')
  })

  it('drags with a pen on its handle', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)

    await act(() => void drag(swipeHandle(dialog), 0, dialog.offsetHeight * 0.7, { pointerType: 'pen' }))
    await nextFrame()
    assert.equal(dialog.open, false)
  })

  it('slides back when the browser cancels the pointer or capture is lost, and stays open', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)

    drag(swipeHandle(dialog), 0, dialog.offsetHeight * 0.8, { pointerType: 'touch', end: 'cancel' })
    await nextFrame()
    assert.ok(dialog.open)
    assert.equal(dialog.hasAttribute('data-swiping'), false)
    assert.equal(translation(dialog), 0)

    drag(swipeHandle(dialog), 0, dialog.offsetHeight * 0.8, { end: 'none' })
    pointer(dialog, 'lostpointercapture', { x: 0, y: 0 }, clock + 2000)
    await nextFrame()
    assert.ok(dialog.open)
    assert.equal(translation(dialog), 0)
  })

  it('ends a drag when Escape closes the drawer in the middle of it, and opens again at rest', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle />)
    let dialog = await openDrawer(act)

    drag(swipeHandle(dialog), 0, 90, { end: 'none' })
    assert.ok(dialog.hasAttribute('data-swiping'))
    await act(() => escape())
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(dialog.hasAttribute('data-swiping'), false)
    pointer(dialog, 'pointermove', { x: 0, y: 600 }, clock + 2000)

    dialog = await openDrawer(act)
    assert.equal(translation(dialog), 0)
    assert.equal(dialog.hasAttribute('data-swiping'), false)
  })

  it('keeps dragging when the element a touch started on loses its implicit capture to the drawer', async (t) => {
    let { act } = mount(t, <InvoiceDrawer />)
    let dialog = await openDrawer(act)
    let text = dialog.querySelector('p')!

    drag(text, 0, 80, { pointerType: 'touch', end: 'none', steps: 2 })
    // A browser fires this at the touched element once the drawer takes the pointer.
    pointer(text, 'lostpointercapture', { x: 0, y: 0 }, clock + 1000, 'touch')
    assert.ok(dialog.hasAttribute('data-swiping'))
    pointer(text, 'pointermove', { x: 0, y: 400 }, clock + 1100, 'touch')
    assert.ok(translation(dialog) > 100, `still follows the touch: ${translation(dialog)}`)
    pointer(dialog, 'pointercancel', { x: 0, y: 0 }, clock + 1200, 'touch')
  })

  it('never presses a control a touch drag started on', async (t) => {
    let pressed = 0
    let { act } = mount(
      t,
      <InvoiceDrawer
        footer={
          <button type="button" mix={on('click', () => void pressed++)}>
            Pay
          </button>
        }
      />,
    )
    let dialog = await openDrawer(act)
    let pay = button('Pay', dialog)

    drag(pay, 0, 30, { pointerType: 'touch' })
    pay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    await nextFrame()
    assert.equal(pressed, 0)
    assert.ok(dialog.open)

    await act(() => pay.click())
    assert.equal(pressed, 1, 'a plain press still works')
  })

  it('keeps a controlled drawer open when its owner says no, and slides it back', async (t) => {
    let asked: boolean[] = []
    let { act } = mount(
      t,
      <InvoiceDrawer showSwipeHandle open onOpenChange={(open, details) => void (asked.push(open), details)} />,
    )
    await nextFrame()
    let dialog = document.querySelector('dialog')!
    assert.ok(dialog.open)

    await act(() => void drag(swipeHandle(dialog), 0, dialog.offsetHeight * 0.8))
    await nextFrame()
    await nextFrame()
    assert.deepEqual(asked, [false])
    assert.ok(dialog.open)
    assert.equal(translation(dialog), 0)
    assert.equal(dialog.hasAttribute('data-swipe-dismiss'), false)
  })

  it('slides back when onOpenChange cancels a swipe', async (t) => {
    let { act } = mount(t, <InvoiceDrawer showSwipeHandle onOpenChange={(open, details) => open || details.cancel()} />)
    let dialog = await openDrawer(act)

    await act(() => void drag(swipeHandle(dialog), 0, dialog.offsetHeight * 0.8))
    await nextFrame()
    assert.ok(dialog.open)
    assert.equal(translation(dialog), 0)
  })

  it('works beside the page when it is not modal', async (t) => {
    let pressed = 0
    let { act } = mount(
      t,
      <main>
        <button type="button" mix={on('click', () => void pressed++)}>
          Behind
        </button>
        <InvoiceDrawer modal={false} disablePointerDismissal showSwipeHandle swipeDirection="right" />
      </main>,
    )
    let dialog = await openDrawer(act)
    assert.equal(dialog.matches(':modal'), false)
    await act(() => button('Behind').click())
    assert.equal(pressed, 1)
    assert.ok(dialog.open)

    await act(() => void drag(swipeHandle(dialog), dialog.offsetWidth * 0.7, 0))
    await nextFrame()
    assert.equal(dialog.open, false)
  })

  it('keeps a right drawer on the right in right-to-left text', async (t) => {
    let { act } = mount(
      t,
      <div dir="rtl">
        <InvoiceDrawer swipeDirection="right" />
      </div>,
    )
    let dialog = await openDrawer(act)
    assert.ok(Math.abs(dialog.getBoundingClientRect().right - innerWidth) < 1)
  })

  it('runs each instance on its own', async (t) => {
    let { act } = mount(
      t,
      <main>
        <InvoiceDrawer label="First" showSwipeHandle />
        <InvoiceDrawer label="Second" swipeDirection="left" />
      </main>,
    )
    let first = await openDrawer(act, 'First')
    await act(() => void drag(swipeHandle(first), 0, first.offsetHeight * 0.8))
    await nextFrame()
    assert.equal(first.open, false)

    let second = await openDrawer(act, 'Second')
    assert.notEqual(first, second)
    assert.equal(second.dataset.swipeDirection, 'left')
    assert.ok(second.open)
  })
})

function ListDrawer(handle: Handle<DrawerProps & { items?: number }>) {
  return () => {
    let { items = 20, ...props } = handle.props

    return (
      <Drawer {...props}>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Open invoices</DrawerTitle>
            <DrawerSnapPointButton snapPoint="160px">Peek</DrawerSnapPointButton>
            <DrawerSnapPointButton snapPoint={1}>Expand</DrawerSnapPointButton>
          </DrawerHeader>
          {Array.from({ length: items }, (_, index) => (
            <button key={index} type="button">
              Invoice {index + 1}
            </button>
          ))}
        </DrawerContent>
      </Drawer>
    )
  }
}

describe('Drawer snap points in the browser', () => {
  it('opens at the first snap point, showing that much of itself, with all of its content reachable', async (t) => {
    let { act } = mount(t, <ListDrawer snapPoints={['160px', 1]} showSwipeHandle />)
    let dialog = await openDrawer(act)

    assert.ok(dialog.hasAttribute('data-snap-points'))
    assert.equal(dialog.hasAttribute('data-expanded'), false)
    assert.ok(Math.abs(innerHeight - dialog.getBoundingClientRect().top - 160) < 1, 'shows 160px')
    let last = button('Invoice 20', dialog)
    last.focus()
    assert.ok(last.getBoundingClientRect().bottom <= innerHeight + 1, 'the last item scrolls into the part that shows')
    assert.equal(button('Peek', dialog).getAttribute('aria-pressed'), 'true')
  })

  it('settles on the closest snap point after a drag, and closes from the smallest one', async (t) => {
    let changes: Array<[DrawerSnapPoint | null, DrawerSnapPointChangeReason]> = []
    let { act } = mount(
      t,
      <ListDrawer
        snapPoints={['160px', 1]}
        showSwipeHandle
        onSnapPointChange={(point, details) => changes.push([point, details.reason])}
      />,
    )
    let dialog = await openDrawer(act)
    let offset = translation(dialog)
    assert.ok(offset > 100, `starts lower: ${offset}`)

    await act(() => void drag(swipeHandle(dialog), 0, -offset * 0.8))
    await nextFrame()
    assert.ok(Math.abs(translation(dialog)) < 1, 'expands')
    assert.ok(dialog.hasAttribute('data-expanded'))
    assert.equal(button('Expand', dialog).getAttribute('aria-pressed'), 'true')

    await act(() => void drag(swipeHandle(dialog), 0, offset * 0.8))
    await nextFrame()
    assert.ok(Math.abs(translation(dialog) - offset) < 1, 'back to the peek')

    await act(() => void drag(swipeHandle(dialog), 0, 140))
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.deepEqual(changes, [
      [1, 'swipe'],
      ['160px', 'swipe'],
    ])
  })

  it('moves between snap points with its buttons, and opens at the default one again after it closes', async (t) => {
    let { act } = mount(t, <ListDrawer snapPoints={['160px', 1]} />)
    let dialog = await openDrawer(act)
    let peek = translation(dialog)

    await act(() => button('Expand', dialog).click())
    await nextFrame()
    assert.ok(Math.abs(translation(dialog)) < 1)
    assert.equal(button('Expand', dialog).getAttribute('aria-pressed'), 'true')
    assert.equal(button('Peek', dialog).getAttribute('aria-pressed'), 'false')

    await act(() => escape())
    await nextFrame()
    dialog = await openDrawer(act)
    assert.ok(Math.abs(translation(dialog) - peek) < 1, 'opens at the peek again')
  })

  for (let sequential of [false, true]) {
    it(`${sequential ? 'moves one snap point' : 'skips a snap point'} on a fast flick${sequential ? ' with snapToSequentialPoints' : ''}`, async (t) => {
      let snapped: Array<DrawerSnapPoint | null> = []
      let { act } = mount(
        t,
        <ListDrawer
          snapPoints={['120px', 0.5, 1]}
          snapToSequentialPoints={sequential}
          showSwipeHandle
          onSnapPointChange={(point) => snapped.push(point)}
        />,
      )
      let dialog = await openDrawer(act)
      await act(() => void drag(swipeHandle(dialog), 0, -40, { duration: 30, steps: 3 }))
      await nextFrame()
      assert.deepEqual(snapped, [sequential ? 0.5 : 1])
    })
  }

  it('stays at a controlled snap point its owner keeps, and follows the one it renders', async (t) => {
    function Owner(handle: Handle<{ accept: boolean }>) {
      let point: DrawerSnapPoint | null = '160px'
      return () => (
        <ListDrawer
          snapPoints={['160px', 1]}
          snapPoint={point}
          showSwipeHandle
          defaultOpen
          onSnapPointChange={(next) => {
            if (!handle.props.accept) return
            point = next
            void handle.update()
          }}
        />
      )
    }
    let { act, root } = mount(t, <Owner accept={false} />)
    await nextFrame()
    let dialog = document.querySelector('dialog')!
    let peek = translation(dialog)

    await act(() => button('Expand', dialog).click())
    await nextFrame()
    assert.ok(Math.abs(translation(dialog) - peek) < 1, 'the owner kept the peek')

    await act(() =>
      root.render(
        <div mix={tokens}>
          <Owner accept />
        </div>,
      ),
    )
    await act(() => button('Expand', dialog).click())
    await nextFrame()
    assert.ok(Math.abs(translation(dialog)) < 1)
  })

  it('stays at its snap point when onSnapPointChange cancels a drag to another one', async (t) => {
    let { act } = mount(
      t,
      <ListDrawer
        snapPoints={['160px', 1]}
        showSwipeHandle
        onSnapPointChange={(_point, details) => details.cancel()}
      />,
    )
    let dialog = await openDrawer(act)
    let peek = translation(dialog)

    await act(() => void drag(swipeHandle(dialog), 0, -peek * 0.8))
    await nextFrame()
    assert.ok(Math.abs(translation(dialog) - peek) < 1, `back at the peek: ${translation(dialog)}`)
    assert.equal(button('Peek', dialog).getAttribute('aria-pressed'), 'true')
  })

  it('falls back to the default snap point when the snap points change under it', async (t) => {
    function Owner(handle: Handle<{ points: DrawerSnapPoint[] }>) {
      return () => <ListDrawer snapPoints={handle.props.points} defaultOpen />
    }
    let { act, root } = mount(t, <Owner points={['160px', 1]} />)
    await nextFrame()
    let dialog = document.querySelector('dialog')!
    await act(() => button('Expand', dialog).click())
    await nextFrame()
    assert.ok(Math.abs(translation(dialog)) < 1)

    await act(() =>
      root.render(
        <div mix={tokens}>
          <Owner points={['200px', 0.9]} />
        </div>,
      ),
    )
    await nextFrame()
    assert.ok(Math.abs(innerHeight - dialog.getBoundingClientRect().top - 200) < 1, 'shows the new first point')
  })

  it('keeps its snap point through a change of size, without sliding, and under a dragging pointer', async (t) => {
    let { act } = mount(t, <ListDrawer snapPoints={['10rem', 1]} showSwipeHandle />)
    let dialog = await openDrawer(act)
    assert.ok(Math.abs(innerHeight - dialog.getBoundingClientRect().top - 160) < 1)

    document.documentElement.style.fontSize = '20px'
    dispatchEvent(new Event('resize'))
    assert.ok(dialog.hasAttribute('data-resizing'), 'no transition while it resizes')
    assert.ok(Math.abs(innerHeight - dialog.getBoundingClientRect().top - 200) < 1, '10rem is 200px now')
    await nextFrame()
    assert.equal(dialog.hasAttribute('data-resizing'), false)

    drag(swipeHandle(dialog), 0, -50, { end: 'none' })
    let top = dialog.getBoundingClientRect().top
    document.documentElement.style.fontSize = '16px'
    dispatchEvent(new Event('resize'))
    assert.ok(Math.abs(dialog.getBoundingClientRect().top - top) < 1, 'stays under the pointer')
    pointer(dialog, 'pointercancel', { x: 0, y: 0 }, clock + 2000)
  })
})

describe('Drawer scrolling in the browser', () => {
  function Scrolling(handle: Handle<{ direction?: DrawerSwipeDirection }>) {
    return () => (
      <InvoiceDrawer
        swipeDirection={handle.props.direction ?? 'down'}
        body={
          <div data-testid="region" style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {Array.from({ length: 30 }, (_, index) => (
              <p key={index}>Line {index + 1}</p>
            ))}
          </div>
        }
      />
    )
  }

  it('leaves a scroll region to the browser until it reaches the edge the swipe starts from', async (t) => {
    let { act } = mount(t, <Scrolling />)
    let dialog = await openDrawer(act)
    let region = dialog.querySelector<HTMLElement>('[data-testid="region"]')!
    let content = dialog.querySelector<HTMLElement>('[data-slot="drawer-content"]')!
    let directional = CSS.supports('touch-action', 'pan-down')

    assert.equal(content.style.touchAction, 'pan-x pinch-zoom', 'the content column itself doesn’t scroll')
    assert.equal(region.style.touchAction, directional ? 'pan-x pan-down pinch-zoom' : '')

    region.scrollTop = 100
    await nextFrame()
    assert.equal(region.style.touchAction, '', 'scrolled down, every pan scrolls it')

    region.scrollTop = 0
    await nextFrame()
    assert.equal(region.style.touchAction, directional ? 'pan-x pan-down pinch-zoom' : '')
  })

  it('moves only when a touch in a scroll region starts at its edge and heads for the drawer’s edge', async (t) => {
    let { act } = mount(t, <Scrolling />)
    let dialog = await openDrawer(act)
    let region = dialog.querySelector<HTMLElement>('[data-testid="region"]')!

    region.scrollTop = 100
    await nextFrame()
    drag(region, 0, 80, { pointerType: 'touch', end: 'none' })
    assert.equal(dialog.hasAttribute('data-swiping'), false, 'the region scrolls instead')
    pointer(region, 'pointerup', { x: 0, y: 0 }, clock + 2000, 'touch')

    region.scrollTop = 0
    await nextFrame()
    drag(region, 0, -80, { pointerType: 'touch', end: 'none' })
    assert.equal(dialog.hasAttribute('data-swiping'), false, 'up from the top scrolls the region')
    pointer(region, 'pointerup', { x: 0, y: 0 }, clock + 2000, 'touch')

    drag(region, 0, 80, { pointerType: 'touch', end: 'none' })
    assert.ok(dialog.hasAttribute('data-swiping'), 'down from the top moves the drawer')
    assert.ok(translation(dialog) > 60)
    pointer(region, 'pointercancel', { x: 0, y: 0 }, clock + 2000, 'touch')
  })

  it('hands a touch along the other axis to the browser', async (t) => {
    let { act } = mount(t, <InvoiceDrawer />)
    let dialog = await openDrawer(act)
    drag(dialog.querySelector('p')!, 80, 10, { pointerType: 'touch', end: 'none' })
    assert.equal(dialog.hasAttribute('data-swiping'), false)
    pointer(dialog, 'pointerup', { x: 0, y: 0 }, clock + 2000, 'touch')
  })

  it('ignores drags on range inputs and on elements marked data-swipe-ignore', async (t) => {
    let { act } = mount(
      t,
      <InvoiceDrawer
        inner={
          <div>
            <input type="range" aria-label="Amount" />
            <div data-swipe-ignore="">Map</div>
            <div data-swipe-ignore="x">Carousel</div>
          </div>
        }
      />,
    )
    let dialog = await openDrawer(act)
    let [range, map, carousel] = [
      dialog.querySelector('input')!,
      ...dialog.querySelectorAll('[data-swipe-ignore]'),
    ] as Element[]

    for (let target of [range, map]) {
      drag(target, 0, 80, { pointerType: 'touch', end: 'none' })
      assert.equal(dialog.hasAttribute('data-swiping'), false)
      pointer(dialog, 'pointerup', { x: 0, y: 0 }, clock + 2000, 'touch')
    }
    drag(carousel, 0, 80, { pointerType: 'touch', end: 'none' })
    assert.ok(dialog.hasAttribute('data-swiping'), 'a carousel that takes x leaves y to the drawer')
    pointer(dialog, 'pointercancel', { x: 0, y: 0 }, clock + 2000, 'touch')
  })
})

describe('Drawer scroll regions across snap points in the browser', () => {
  // A list that fits at the full height and overflows at the 160px peek.
  function FittingList() {
    return () => (
      <Drawer snapPoints={['160px', 1]} defaultSnapPoint={1}>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Open invoices</DrawerTitle>
          <DrawerSnapPointButton snapPoint="160px">Peek</DrawerSnapPointButton>
          <DrawerSnapPointButton snapPoint={1}>Expand</DrawerSnapPointButton>
          <div data-testid="list" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            <div style={{ height: `${innerHeight - 96 - 140}px` }} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  it('gives a scroll region its touch scrolling back when a snap point makes it overflow', async (t) => {
    let { act } = mount(t, <FittingList />)
    let dialog = await openDrawer(act)
    let list = dialog.querySelector<HTMLElement>('[data-testid="list"]')!
    let directional = CSS.supports('touch-action', 'pan-down')
    assert.ok(list.scrollHeight <= list.clientHeight, 'the list fits at the full height')
    assert.equal(list.style.touchAction, 'pan-x pinch-zoom', 'nothing to scroll, so the drawer takes vertical pans')

    await act(() => button('Peek', dialog).click())
    await nextFrame()
    assert.ok(list.scrollHeight > list.clientHeight, 'the list overflows at the peek')
    assert.equal(list.style.touchAction, directional ? 'pan-x pan-down pinch-zoom' : '', 'it scrolls again')

    await act(() => button('Expand', dialog).click())
    await nextFrame()
    assert.equal(list.style.touchAction, 'pan-x pinch-zoom')
  })

  it('looks again once the snap point’s transition has finished', async (t) => {
    // With a motion token, the padding that makes room for the peek moves over 200ms.
    let { act } = mount(
      t,
      <div style={{ '--duration-normal': '100ms' }}>
        <FittingList />
      </div>,
    )
    let dialog = await openDrawer(act)
    let list = dialog.querySelector<HTMLElement>('[data-testid="list"]')!
    let content = dialog.querySelector<HTMLElement>('[data-slot="drawer-content"]')!
    assert.ok(
      getComputedStyle(content).transitionDuration.includes('0.2s'),
      getComputedStyle(content).transitionDuration,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(list.style.touchAction, 'pan-x pinch-zoom')

    await act(() => button('Peek', dialog).click())
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.ok(list.scrollHeight > list.clientHeight)
    assert.equal(list.style.touchAction, CSS.supports('touch-action', 'pan-down') ? 'pan-x pan-down pinch-zoom' : '')
  })
})

describe('Nested drawers in the browser', () => {
  function Nested(handle: Handle<{ onOuterChange?: (open: boolean, reason: DialogChangeReason) => void }>) {
    return () => (
      <InvoiceDrawer
        showSwipeHandle
        label="Outer"
        onOpenChange={(open, details) => handle.props.onOuterChange?.(open, details.reason)}
        inner={<InvoiceDrawer label="Inner" showSwipeHandle body={<p>Nested</p>} />}
      />
    )
  }

  it('stacks the outer drawer behind an inner one, which Escape closes first', async (t) => {
    let { act } = mount(t, <Nested />)
    let outer = await openDrawer(act, 'Outer')
    let inner = await openDrawer(act, 'Inner')
    await nextFrame()

    assert.ok(inner.matches(':modal'))
    assert.ok(inner.hasAttribute('data-nested'))
    assert.ok(outer.hasAttribute('data-nested-drawer-open'))
    assert.equal(outer.style.getPropertyValue('--nested-drawers'), '1')
    assert.ok(Number.parseFloat(getComputedStyle(outer).scale) < 1, 'it scales down')

    drag(swipeHandle(outer), 0, 200, { end: 'none' })
    assert.equal(outer.hasAttribute('data-swiping'), false, 'the drawer behind doesn’t move')
    pointer(outer, 'pointerup', { x: 0, y: 0 }, clock + 2000)

    drag(swipeHandle(inner), 0, 40, { end: 'none' })
    assert.ok(outer.hasAttribute('data-nested-drawer-swiping'), 'the drawer behind follows the inner one')
    pointer(inner, 'pointercancel', { x: 0, y: 0 }, clock + 2000)
    assert.equal(outer.hasAttribute('data-nested-drawer-swiping'), false)

    await act(() => escape())
    await nextFrame()
    assert.equal(inner.open, false)
    assert.ok(outer.open)
    assert.equal(outer.hasAttribute('data-nested-drawer-open'), false)
    assert.equal(outer.style.getPropertyValue('--nested-drawers'), '')
  })

  for (let [outerSnaps, innerSnaps] of [
    [true, false],
    [true, true],
    [false, true],
  ]) {
    let points: DrawerSnapPoint[] | undefined = ['160px', 1]
    it(`peeks out above an inner drawer ${outerSnaps ? 'from' : 'without'} a snap point of its own, ${innerSnaps ? 'with' : 'without'} snap points on the inner one`, async (t) => {
      let { act } = mount(
        t,
        <InvoiceDrawer
          label="Outer"
          snapPoints={outerSnaps ? points : undefined}
          showSwipeHandle
          inner={
            <InvoiceDrawer
              label="Inner"
              snapPoints={innerSnaps ? points : undefined}
              body={<DrawerSnapPointButton snapPoint={1}>Expand inner</DrawerSnapPointButton>}
            />
          }
        />,
      )
      let outer = await openDrawer(act, 'Outer')
      if (outerSnaps) assert.ok(translation(outer) > 0, 'the outer drawer sits at its peek')
      let inner = await openDrawer(act, 'Inner')
      await nextFrame()

      let peeks = (when: string) => {
        let front = inner.getBoundingClientRect()
        let behind = outer.getBoundingClientRect()
        assert.ok(behind.top < front.top, `${when}: the outer edge shows above: ${behind.top} < ${front.top}`)
        assert.ok(front.top - behind.top < 32, `${when}: by about the 1rem peek: ${front.top - behind.top}`)
      }
      peeks('opened')
      if (innerSnaps) {
        assert.ok(
          Math.abs(innerHeight - inner.getBoundingClientRect().top - 160) < 1,
          'the inner one opens at its peek',
        )
        await act(() => button('Expand inner', inner).click())
        await nextFrame()
        peeks('the inner one expanded')
      }

      await act(() => escape())
      await nextFrame()
      if (outerSnaps) {
        assert.ok(Math.abs(innerHeight - outer.getBoundingClientRect().top - 160) < 1, 'back at its peek')
      }
    })
  }

  it('keeps the stack peeking when a resize changes what the inner drawer shows, at the same popup size', async (t) => {
    let { act } = mount(
      t,
      <InvoiceDrawer
        label="Outer"
        showSwipeHandle
        inner={
          <Drawer snapPoints={['5rem', 1]}>
            <DrawerTrigger>Inner</DrawerTrigger>
            <DrawerContent style={{ height: '200px' }}>
              <DrawerTitle>Payment</DrawerTitle>
            </DrawerContent>
          </Drawer>
        }
      />,
    )
    let outer = await openDrawer(act, 'Outer')
    let inner = await openDrawer(act, 'Inner')
    await nextFrame()

    let peeks = (when: string) => {
      let peek = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      let gap = inner.getBoundingClientRect().top - outer.getBoundingClientRect().top
      assert.ok(gap > 0 && gap < peek + 2, `${when}: the outer edge peeks out about 1rem: ${gap}`)
    }
    assert.ok(Math.abs(innerHeight - inner.getBoundingClientRect().top - 80) < 1, 'the inner one shows 5rem')
    peeks('opened')

    document.documentElement.style.fontSize = '32px'
    dispatchEvent(new Event('resize'))
    await nextFrame()
    assert.equal(inner.offsetHeight, 200, 'the inner popup keeps its size')
    assert.ok(Math.abs(innerHeight - inner.getBoundingClientRect().top - 160) < 1, '5rem is 160px now')
    peeks('after the resize')
  })

  it('closes the inner drawer when the outer one is swiped closed', async (t) => {
    let { act } = mount(t, <Nested />)
    let outer = await openDrawer(act, 'Outer')
    let inner = await openDrawer(act, 'Inner')
    await act(() => button('Close', inner).click())
    await nextFrame()

    await act(() => void drag(swipeHandle(outer), 0, outer.offsetHeight * 0.8))
    await nextFrame()
    assert.equal(outer.open, false)
    assert.equal(inner.open, false)
  })
})

describe('Drawer cleanup in the browser', () => {
  it('lets go of everything when it unmounts in the middle of a drag', async (t) => {
    function Toggle(handle: Handle<{ shown: boolean }>) {
      return () => (handle.props.shown ? <InvoiceDrawer showSwipeHandle /> : <p>Gone</p>)
    }
    let { act, root } = mount(t, <Toggle shown />)
    let dialog = await openDrawer(act)
    let content = dialog.querySelector<HTMLElement>('[data-slot="drawer-content"]')!
    assert.notEqual(content.style.touchAction, '')

    let frames: number[] = []
    let cancelled: number[] = []
    let request = window.requestAnimationFrame
    let cancel = window.cancelAnimationFrame
    window.requestAnimationFrame = (callback) => {
      let id = request(callback)
      frames.push(id)
      return id
    }
    window.cancelAnimationFrame = (id) => {
      cancelled.push(id)
      cancel(id)
    }
    t.after(() => {
      window.requestAnimationFrame = request
      window.cancelAnimationFrame = cancel
    })

    drag(swipeHandle(dialog), 0, 50, { end: 'none' })
    document.documentElement.style.fontSize = '18px'
    dispatchEvent(new Event('resize'))
    await act(() =>
      root.render(
        <div mix={tokens}>
          <Toggle shown={false} />
        </div>,
      ),
    )
    window.requestAnimationFrame = request
    window.cancelAnimationFrame = cancel
    await nextFrame()

    assert.equal(dialog.isConnected, false)
    assert.equal(content.style.touchAction, '', 'touch-action is restored')
    assert.equal(getOpenLayers(document).length, 0)
    assert.ok(frames.length > 0, 'the resize asked for a frame')
    assert.ok(
      frames.every((id) => cancelled.includes(id)),
      'every frame the drawer asked for is cancelled',
    )
    // A pointer event after unmounting reaches nothing.
    pointer(document.body, 'pointerup', { x: 0, y: 0 }, clock + 3000)
  })
})
