import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Tooltip,
  TooltipContent,
  TooltipOpenChangeEvent,
  TooltipProvider,
  TooltipTrigger,
  tooltipOpenChangeType,
  tooltipTrigger,
} from './tooltip.tsx'
import type { TooltipOpenChangeReason } from './tooltip.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Waits for timers, the render they cause, and the positioning frame after it. */
async function settle(ms = 30) {
  await wait(ms)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function pointer(type: string, target: Element, pointerType = 'mouse', at?: { x: number; y: number }) {
  let rect = target.getBoundingClientRect()
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      cancelable: true,
      composed: true,
      pointerId: pointerType === 'touch' ? 2 : 1,
      isPrimary: true,
      pointerType,
      clientX: at?.x ?? rect.left + rect.width / 2,
      clientY: at?.y ?? rect.top + rect.height / 2,
    }),
  )
}

const hover = (target: Element) => pointer('pointerenter', target)
const unhover = (target: Element, at = { x: 1, y: 1 }) => pointer('pointerleave', target, 'mouse', at)

function escape(target: Element) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

function parts(container: HTMLElement, index = 0) {
  let trigger = container.querySelectorAll<HTMLElement>('[data-slot="tooltip-trigger"]')[index]
  let content = container.querySelectorAll<HTMLElement>('[data-slot="tooltip-content"]')[index]
  assert.ok(trigger && content, 'no tooltip')
  return { trigger, content }
}

function isOpen(content: HTMLElement) {
  return content.matches(':popover-open')
}

const fixed = (left: number, top: number) =>
  css({ position: 'fixed', left: `${left}px`, top: `${top}px`, width: '100px', height: '30px', margin: 0 })

describe('Tooltip in the browser', () => {
  it('opens on hover above its trigger in the top layer, and closes as the pointer leaves', async (t) => {
    let { container } = mount(
      t,
      <Tooltip>
        <TooltipTrigger mix={fixed(200, 200)}>Archive</TooltipTrigger>
        <TooltipContent>Moves the invoice to the archive</TooltipContent>
      </Tooltip>,
    )
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(isOpen(content), false)

    hover(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    assert.ok(content.hasAttribute('data-open'))
    assert.ok(trigger.hasAttribute('data-popup-open'))
    assert.equal(content.dataset.side, 'top')
    assert.equal(Math.round(content.getBoundingClientRect().bottom), 196)

    unhover(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.ok(content.hasAttribute('data-closed'))
    assert.ok(!trigger.hasAttribute('data-popup-open'))
  })

  it('opens at once on keyboard focus despite a delay, and Escape closes it with focus kept', async (t) => {
    let { container } = mount(
      t,
      <Tooltip>
        <TooltipTrigger delay={1000}>Archive</TooltipTrigger>
        <TooltipContent>Moves the invoice to the archive</TooltipContent>
      </Tooltip>,
    )
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    await settle()
    assert.equal(isOpen(content), true)

    escape(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    // Still focused, so only coming back opens it again.
    await settle(50)
    assert.equal(isOpen(content), false)
    trigger.blur()
    trigger.focus()
    await settle()
    assert.equal(isOpen(content), true)
  })

  it('waits for the delay on hover and opens nothing if the pointer leaves first', async (t) => {
    // Its own provider, so no tooltip that just closed in another test opens it at once.
    let { container } = mount(
      t,
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger delay={80}>Archive</TooltipTrigger>
          <TooltipContent>Moves the invoice to the archive</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    await settle()
    let { trigger, content } = parts(container)

    hover(trigger)
    await wait(20)
    unhover(trigger)
    await settle(100)
    assert.equal(isOpen(content), false)

    // A timer shorter than the delay fires first: frames, which settle() waits for, may lag far behind.
    hover(trigger)
    await wait(20)
    assert.equal(isOpen(content), false)
    await settle(100)
    assert.equal(isOpen(content), true)
  })

  it('stays open while the pointer crosses to it, unless it is not hoverable', async (t) => {
    for (let hoverable of [true, false]) {
      let { container, cleanup } = render(
        <Tooltip disableHoverablePopup={!hoverable}>
          <TooltipTrigger mix={fixed(200, 200)}>Archive</TooltipTrigger>
          <TooltipContent>Moves the invoice to the archive</TooltipContent>
        </Tooltip>,
      )
      t.after(cleanup)
      await settle()
      let { trigger, content } = parts(container)

      hover(trigger)
      await settle()
      let gap = { x: 250, y: 198 }
      unhover(trigger, gap)
      pointer('pointermove', document.body, 'mouse', gap)
      hover(content)
      await settle()
      assert.equal(isOpen(content), hoverable, hoverable ? 'closed on the way' : 'stayed open')
      cleanup()
    }
  })

  it('closes on a click on the trigger and on a press elsewhere', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Tooltip>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Moves the invoice to the archive</TooltipContent>
        </Tooltip>
        <p>Elsewhere</p>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    hover(trigger)
    await settle()
    trigger.click()
    await settle()
    assert.equal(isOpen(content), false)

    unhover(trigger)
    hover(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    let elsewhere = container.querySelector('p')!
    pointer('pointerdown', elsewhere)
    pointer('pointerup', elsewhere)
    elsewhere.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('asks before each change with a cancelable event on the content, and follows its open prop', async (t) => {
    let reasons: Array<[boolean, TooltipOpenChangeReason]> = []
    let open = false

    function Controlled(handle: Handle) {
      return () => (
        <Tooltip open={open}>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent
            mix={on(tooltipOpenChangeType, (event) => {
              assert.ok(event instanceof TooltipOpenChangeEvent)
              reasons.push([event.open, event.reason])
              open = event.open
              void handle.update()
            })}
          >
            Moves the invoice to the archive
          </TooltipContent>
        </Tooltip>
      )
    }

    let { container } = mount(t, <Controlled />)
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    await settle()
    assert.equal(isOpen(content), true)
    escape(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, [
      [true, 'trigger-focus'],
      [false, 'escape-key'],
    ])
  })

  it('stays as it is when the change is canceled', async (t) => {
    let { container } = mount(
      t,
      <Tooltip>
        <TooltipTrigger>Archive</TooltipTrigger>
        <TooltipContent mix={on(tooltipOpenChangeType, (event) => event.preventDefault())}>Archive</TooltipContent>
      </Tooltip>,
    )
    await settle()
    let { trigger, content } = parts(container)

    hover(trigger)
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('opens by default once it runs, and closes when disabled', async (t) => {
    let disabled = false
    let setDisabled: (value: boolean) => Promise<AbortSignal>

    function Toggle(handle: Handle) {
      setDisabled = (value) => {
        disabled = value
        return handle.update()
      }
      return () => (
        <Tooltip defaultOpen disabled={disabled}>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
      )
    }

    let { container } = mount(t, <Toggle />)
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(isOpen(content), true)

    await setDisabled!(true)
    await settle()
    assert.equal(isOpen(content), false)
    assert.ok(trigger.hasAttribute('data-trigger-disabled'))
    hover(trigger)
    trigger.focus()
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('updates the description when the content id changes', async (t) => {
    let id = 'first-tip'
    let rename: () => Promise<AbortSignal>

    function Renamed(handle: Handle) {
      rename = () => {
        id = 'second-tip'
        return handle.update()
      }
      return () => (
        <Tooltip>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent id={id}>Archive</TooltipContent>
        </Tooltip>
      )
    }

    let { container } = mount(t, <Renamed />)
    await settle()
    assert.equal(parts(container).trigger.getAttribute('aria-describedby'), 'first-tip')

    await rename!()
    assert.equal(parts(container).trigger.getAttribute('aria-describedby'), 'second-tip')
    assert.equal(parts(container).content.id, 'second-tip')
  })

  it('follows the id of content inside another component, also as it changes', async (t) => {
    let id = 'first-tip'
    let rename: () => Promise<AbortSignal>

    function Wrapped(handle: Handle) {
      rename = () => {
        id = 'second-tip'
        return handle.update()
      }
      return () => <TooltipContent id={id}>Archive</TooltipContent>
    }

    let { container } = mount(
      t,
      <Tooltip>
        <TooltipTrigger>Archive</TooltipTrigger>
        <Wrapped />
      </Tooltip>,
    )
    await settle()
    assert.equal(parts(container).trigger.getAttribute('aria-describedby'), 'first-tip')

    await rename!()
    await settle()
    assert.equal(parts(container).content.id, 'second-tip')
    assert.equal(parts(container).trigger.getAttribute('aria-describedby'), 'second-tip')
  })

  it('opens the next tooltip of a provider at once and closes the one before', async (t) => {
    let { container } = mount(
      t,
      <TooltipProvider delay={150}>
        <Tooltip>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Delete</TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    await settle()
    let first = parts(container, 0)
    let second = parts(container, 1)

    hover(first.trigger)
    await wait(60)
    assert.equal(isOpen(first.content), false)
    await settle(150)
    assert.equal(isOpen(first.content), true)

    // Straight from one trigger to the next: no delay.
    unhover(first.trigger)
    hover(second.trigger)
    await settle()
    assert.equal(isOpen(first.content), false)
    assert.equal(isOpen(second.content), true)

    // One open by focus closes when another opens by hover.
    unhover(second.trigger)
    await settle()
    first.trigger.focus()
    await settle()
    hover(second.trigger)
    await settle()
    assert.equal(isOpen(second.content), true)
    assert.equal(isOpen(first.content), false)
  })

  it('gives tooltips outside a provider no delay, and each instance its own state', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Tooltip>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <Tooltip defaultOpen>
          <TooltipTrigger>Delete</TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>,
    )
    await settle()
    let first = parts(container, 0)
    let second = parts(container, 1)
    assert.equal(isOpen(second.content), true)
    assert.equal(isOpen(first.content), false)

    hover(first.trigger)
    await settle(0)
    assert.equal(isOpen(first.content), true)
  })

  it('never opens after it unmounts with a delay running', async (t) => {
    let errors: unknown[] = []
    let onError = (event: ErrorEvent) => errors.push(event.error)
    window.addEventListener('error', onError)
    t.after(() => window.removeEventListener('error', onError))
    let { container, cleanup } = render(
      <Tooltip>
        <TooltipTrigger delay={40}>Archive</TooltipTrigger>
        <TooltipContent>Archive</TooltipContent>
      </Tooltip>,
    )
    await settle()

    hover(parts(container).trigger)
    cleanup()
    await settle(80)
    assert.deepEqual(errors, [])
    assert.equal(document.querySelector(':popover-open'), null)
  })

  it('closes when its trigger is removed', async (t) => {
    let shown = true
    let remove: () => Promise<AbortSignal>
    let reasons: TooltipOpenChangeReason[] = []

    function Removable(handle: Handle) {
      remove = () => {
        shown = false
        return handle.update()
      }
      return () => (
        <Tooltip defaultOpen>
          {shown ? <TooltipTrigger>Archive</TooltipTrigger> : null}
          <TooltipContent mix={on(tooltipOpenChangeType, (event) => void reasons.push(event.reason))}>
            Archive
          </TooltipContent>
        </Tooltip>
      )
    }

    let { container } = mount(t, <Removable />)
    await settle()
    let content = container.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!
    assert.equal(isOpen(content), true)

    await remove!()
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, ['trigger-removed'])
  })

  it('points its arrow at the trigger when it shifts away from the edge', async (t) => {
    let { container } = mount(
      t,
      <Tooltip defaultOpen>
        <TooltipTrigger mix={css({ position: 'fixed', left: '10px', top: '200px', width: '24px', height: '24px' })}>
          A
        </TooltipTrigger>
        <TooltipContent>Archive the invoice and every reminder sent for it</TooltipContent>
      </Tooltip>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let arrow = content.querySelector('[data-slot="tooltip-arrow"]')!
    let triggerBox = trigger.getBoundingClientRect()
    let arrowBox = arrow.getBoundingClientRect()

    assert.equal(content.dataset.side, 'top')
    assert.ok(content.getBoundingClientRect().left >= 5)
    assert.ok(
      Math.abs(arrowBox.left + arrowBox.width / 2 - (triggerBox.left + triggerBox.width / 2)) <= 1,
      `arrow at ${arrowBox.left + arrowBox.width / 2}, trigger center at ${triggerBox.left + triggerBox.width / 2}`,
    )
    // Its center sits 2px inside the edge that faces the trigger.
    assert.ok(Math.abs(arrowBox.top + arrowBox.height / 2 - (content.getBoundingClientRect().bottom - 2)) <= 1)
  })

  it('tightens its end padding around a keyboard key, as shadcn does', async (t) => {
    let { container } = mount(
      t,
      <div mix={css({ '--spacing': '4px' })}>
        <Tooltip defaultOpen>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipContent>Save changes</TooltipContent>
        </Tooltip>
        <Tooltip defaultOpen>
          <TooltipTrigger>Save draft</TooltipTrigger>
          <TooltipContent>
            Save changes <kbd data-slot="kbd">S</kbd>
          </TooltipContent>
        </Tooltip>
      </div>,
    )
    await settle()
    let [plain, withKey] = [0, 1].map((index) => getComputedStyle(parts(container, index).content))

    assert.equal(plain.paddingInlineEnd, '12px')
    assert.equal(withKey.paddingInlineEnd, '6px')
    assert.equal(withKey.paddingInlineStart, '12px')
  })

  it('places inline sides by the text direction', async (t) => {
    let { container } = mount(
      t,
      <div dir="rtl">
        <Tooltip defaultOpen>
          <TooltipTrigger mix={fixed(300, 200)}>أرشفة</TooltipTrigger>
          <TooltipContent side="inline-start">أرشفة الفاتورة</TooltipContent>
        </Tooltip>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    assert.equal(content.dataset.side, 'right')
    assert.equal(
      Math.round(content.getBoundingClientRect().left),
      Math.round(trigger.getBoundingClientRect().right) + 4,
    )
  })

  it('shows in full inside a box that clips its overflow', async (t) => {
    let { container } = mount(
      t,
      <div
        mix={css({
          position: 'fixed',
          left: '200px',
          top: '200px',
          width: '120px',
          height: '40px',
          overflow: 'hidden',
        })}
      >
        <Tooltip defaultOpen>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Moves the invoice to the archive</TooltipContent>
        </Tooltip>
      </div>,
    )
    await settle()
    let { content } = parts(container)
    let box = content.getBoundingClientRect()

    assert.ok(box.bottom <= 200, 'not above the clipping box')
    let hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    assert.ok(content.contains(hit), 'covered or clipped')
  })

  it('opens nothing on touch, so the first tap on a link follows it', async (t) => {
    let followed = 0
    let { container } = mount(
      t,
      <Tooltip>
        <a
          href="#terms"
          mix={[
            tooltipTrigger(),
            on('click', (event) => {
              event.preventDefault()
              followed++
            }),
          ]}
        >
          Payment terms
        </a>
        <TooltipContent>Net 30</TooltipContent>
      </Tooltip>,
    )
    await settle()
    let link = container.querySelector('a')!
    let { content } = parts(container)

    pointer('pointerenter', link, 'touch')
    pointer('pointerdown', link, 'touch')
    pointer('pointerup', link, 'touch')
    link.click()
    pointer('pointerleave', link, 'touch')
    await settle()

    assert.equal(followed, 1)
    assert.equal(isOpen(content), false)
    assert.equal(link.getAttribute('aria-describedby'), content.id)
  })
})
