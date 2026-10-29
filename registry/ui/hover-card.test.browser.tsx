import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  HoverCard,
  HoverCardContent,
  HoverCardOpenChangeEvent,
  HoverCardTrigger,
  hoverCardOpenChangeType,
} from './hover-card.tsx'
import type { HoverCardOpenChangeReason } from './hover-card.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

function parts(container: HTMLElement) {
  let trigger = container.querySelector<HTMLElement>('[data-slot="hover-card-trigger"]')
  let content = container.querySelector<HTMLElement>('[data-slot="hover-card-content"]')
  assert.ok(trigger && content, 'no hover card')
  return { trigger, content }
}

function isOpen(content: HTMLElement) {
  return content.matches(':popover-open')
}

const at = (left: number, top: number) => css({ position: 'fixed', left: `${left}px`, top: `${top}px` })

function Card(handle: Handle<{ delay?: number; closeDelay?: number }>) {
  return () => (
    <HoverCard>
      <HoverCardTrigger href="#acme" delay={handle.props.delay} closeDelay={handle.props.closeDelay} mix={at(200, 200)}>
        Acme Labs
      </HoverCardTrigger>
      <HoverCardContent>
        <p>Customer since 2021</p>
        <a href="#acme-invoices">Open invoices</a>
      </HoverCardContent>
    </HoverCard>
  )
}

describe('Hover Card in the browser', () => {
  it('opens below its link after the delay, and closes after the close delay', async (t) => {
    let { container } = mount(t, <Card delay={60} closeDelay={60} />)
    await settle()
    let { trigger, content } = parts(container)

    // A timer shorter than the delay fires first: frames, which settle() waits for, may lag far behind.
    pointer('pointerenter', trigger)
    await wait(20)
    assert.equal(isOpen(content), false)
    await settle(60)
    assert.equal(isOpen(content), true)
    assert.equal(content.dataset.side, 'bottom')
    assert.equal(
      Math.round(content.getBoundingClientRect().top),
      Math.round(trigger.getBoundingClientRect().bottom) + 4,
    )
    assert.ok(trigger.hasAttribute('data-popup-open'))

    pointer('pointerleave', trigger, 'mouse', { x: 1, y: 1 })
    await wait(20)
    assert.equal(isOpen(content), true)
    await settle(60)
    assert.equal(isOpen(content), false)
  })

  it("waits Base UI's 600ms before it opens by default", async (t) => {
    let { container } = mount(t, <Card />)
    await settle()
    let { trigger, content } = parts(container)

    pointer('pointerenter', trigger)
    await wait(300)
    assert.equal(isOpen(content), false)
    await settle(350)
    assert.equal(isOpen(content), true)
  })

  it('stays open while the pointer crosses to the card and uses the link in it', async (t) => {
    let clicked = 0
    let { container } = mount(t, <Card delay={0} closeDelay={0} />)
    await settle()
    let { trigger, content } = parts(container)
    let link = content.querySelector('a')!
    link.addEventListener('click', (event) => (event.preventDefault(), clicked++))

    pointer('pointerenter', trigger)
    await settle()
    let below = trigger.getBoundingClientRect()
    let gap = { x: below.left + 5, y: below.bottom + 2 }
    pointer('pointerleave', trigger, 'mouse', gap)
    pointer('pointermove', document.body, 'mouse', gap)
    await wait(0)
    pointer('pointerenter', content)
    pointer('pointerenter', link)
    await settle()
    assert.equal(isOpen(content), true)

    link.click()
    assert.equal(clicked, 1)
    pointer('pointerleave', content, 'mouse', { x: 1, y: 1 })
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('opens at once on keyboard focus, stays open as focus moves into the card, and closes as it leaves', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Card />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    await settle()
    assert.equal(isOpen(content), true)

    content.querySelector('a')!.focus()
    await settle()
    assert.equal(isOpen(content), true)

    container.querySelector<HTMLElement>('button')!.focus()
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('puts focus back on its link when Escape closes it with focus inside, and leaves focus alone otherwise', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Card />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let invoices = content.querySelector('a')!

    trigger.focus()
    await settle()
    invoices.focus()
    await settle()
    invoices.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    // Escape with focus on the link itself keeps it there; a press elsewhere keeps focus where it went.
    trigger.blur()
    trigger.focus()
    await settle()
    let after = container.querySelector<HTMLElement>('button')!
    after.focus()
    pointer('pointerdown', after)
    pointer('pointerup', after)
    after.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, after)
  })

  it('closes on Escape and on a press elsewhere, and asks first with an event', async (t) => {
    let reasons: Array<[boolean, HoverCardOpenChangeReason]> = []
    let { container } = mount(
      t,
      <div>
        <HoverCard>
          <HoverCardTrigger href="#acme">Acme Labs</HoverCardTrigger>
          <HoverCardContent
            mix={on(hoverCardOpenChangeType, (event) => {
              assert.ok(event instanceof HoverCardOpenChangeEvent)
              reasons.push([event.open, event.reason])
            })}
          >
            Customer since 2021
          </HoverCardContent>
        </HoverCard>
        <p>Elsewhere</p>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    await settle()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    assert.equal(isOpen(content), false)

    trigger.blur()
    trigger.focus()
    await settle()
    let elsewhere = container.querySelector('p')!
    pointer('pointerdown', elsewhere)
    pointer('pointerup', elsewhere)
    elsewhere.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, [
      [true, 'trigger-focus'],
      [false, 'escape-key'],
      [true, 'trigger-focus'],
      [false, 'outside-press'],
    ])
  })

  it('follows its link on the first tap and opens nothing on touch', async (t) => {
    let followed = 0
    let { container } = mount(t, <Card delay={0} />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.addEventListener('click', (event) => (event.preventDefault(), followed++))

    pointer('pointerenter', trigger, 'touch')
    pointer('pointerdown', trigger, 'touch')
    pointer('pointerup', trigger, 'touch')
    trigger.click()
    await settle()

    assert.equal(followed, 1)
    assert.equal(isOpen(content), false)
  })

  it('closes when its trigger is removed, and never opens after it unmounts', async (t) => {
    let shown = true
    let remove: () => Promise<AbortSignal>

    function Removable(handle: Handle) {
      remove = () => {
        shown = false
        return handle.update()
      }
      return () => (
        <HoverCard defaultOpen>
          {shown ? <HoverCardTrigger href="#acme">Acme Labs</HoverCardTrigger> : null}
          <HoverCardContent>Customer since 2021</HoverCardContent>
        </HoverCard>
      )
    }

    let { container } = mount(t, <Removable />)
    await settle()
    let content = container.querySelector<HTMLElement>('[data-slot="hover-card-content"]')!
    assert.equal(isOpen(content), true)
    await remove!()
    await settle()
    assert.equal(isOpen(content), false)

    let other = render(<Card delay={40} />)
    await settle()
    pointer('pointerenter', parts(other.container).trigger)
    other.cleanup()
    await settle(80)
    assert.equal(document.querySelector(':popover-open'), null)
  })

  it('follows its open prop and its placement props as they change', async (t) => {
    let open = true
    let side: 'bottom' | 'top' = 'bottom'
    let change: (next: { open?: boolean; side?: 'bottom' | 'top' }) => Promise<AbortSignal>

    function Controlled(handle: Handle) {
      change = (next) => {
        open = next.open ?? open
        side = next.side ?? side
        return handle.update()
      }
      return () => (
        <HoverCard open={open}>
          <HoverCardTrigger href="#acme" mix={at(200, 300)}>
            Acme Labs
          </HoverCardTrigger>
          <HoverCardContent side={side}>Customer since 2021</HoverCardContent>
        </HoverCard>
      )
    }

    let { container } = mount(t, <Controlled />)
    await settle()
    let { content } = parts(container)
    assert.equal(content.dataset.side, 'bottom')

    await change!({ side: 'top' })
    await settle()
    assert.equal(content.dataset.side, 'top')

    await change!({ open: false })
    await settle()
    assert.equal(isOpen(content), false)
  })
})
