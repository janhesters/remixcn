import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.tsx'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverOpenChangeEvent,
  PopoverTitle,
  PopoverTrigger,
  popoverOpenChangeType,
} from './popover.tsx'
import type { PopoverContentProps, PopoverOpenChangeReason } from './popover.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Waits for the render, the positioning frame and the focus frame after it. */
async function settle(ms = 20) {
  await wait(ms)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

/** A mouse press on `element`, as the browser sends it. */
function press(element: Element) {
  let at = center(element)
  let init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    pointerType: 'mouse',
    ...at,
  }
  element.dispatchEvent(new PointerEvent('pointerdown', init))
  element.dispatchEvent(new PointerEvent('pointerup', init))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...at }))
}

function escape(target: Element = document.activeElement ?? document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

function isOpen(content: Element) {
  return content.matches(':popover-open')
}

function byText(container: ParentNode, text: string) {
  let found = [...container.querySelectorAll<HTMLElement>('button, a, input, p')].find(
    (element) => element.textContent?.trim() === text || element.getAttribute('aria-label') === text,
  )
  assert.ok(found, `nothing named ${text}`)
  return found
}

function parts(container: ParentNode, index = 0) {
  let trigger = container.querySelectorAll<HTMLElement>('[data-slot="popover-trigger"]')[index]
  let content = container.querySelectorAll<HTMLElement>('[data-slot="popover-content"]')[index]
  assert.ok(trigger && content, 'no popover')
  return { trigger, content }
}

const at = (left: number, top: number) => css({ position: 'fixed', left: `${left}px`, top: `${top}px`, margin: 0 })

function Dimensions(handle: Handle<Partial<PopoverContentProps> & { trigger?: string }>) {
  return () => {
    let { trigger = 'Dimensions', ...content } = handle.props
    return (
      <Popover>
        <PopoverTrigger mix={at(200, 200)}>{trigger}</PopoverTrigger>
        <PopoverContent {...content}>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
          <input aria-label="Width" defaultValue="100%" />
          <PopoverClose>Done</PopoverClose>
        </PopoverContent>
      </Popover>
    )
  }
}

describe('Popover in the browser', () => {
  it('opens below its trigger on click with focus inside, and a second click closes it with focus back', async (t) => {
    let { container } = mount(t, <Dimensions />)
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(!trigger.hasAttribute('popovertarget'), 'the native fallback stops once it runs')
    assert.equal(content.getAttribute('popover'), 'manual')

    trigger.focus()
    press(trigger)
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(content.dataset.side, 'bottom')
    assert.equal(
      Math.round(content.getBoundingClientRect().top),
      Math.round(trigger.getBoundingClientRect().bottom) + 4,
    )
    assert.equal(document.activeElement, byText(content, 'Width'))

    press(trigger)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)
  })

  it('closes on Escape with focus back on the trigger, and on a press elsewhere without taking focus back', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Dimensions />
        <button type="button" mix={at(500, 500)}>
          Elsewhere
        </button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let elsewhere = byText(container, 'Elsewhere')

    trigger.click()
    await settle()
    escape()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    trigger.click()
    await settle()
    elsewhere.focus()
    press(elsewhere)
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, elsewhere)
  })

  it('closes with its close button and when Tab takes focus out of it', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Dimensions />
        <button type="button">After</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)

    trigger.click()
    await settle()
    byText(content, 'Done').click()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, trigger)

    trigger.click()
    await settle()
    byText(container, 'After').focus()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(document.activeElement, byText(container, 'After'))
  })

  it('closes when focus leaves through its trigger, also when it never took focus', async (t) => {
    for (let initialFocus of [undefined, false] as const) {
      let { container, cleanup } = render(
        <div>
          <button type="button">Before</button>
          <Dimensions initialFocus={initialFocus} />
        </div>,
      )
      t.after(cleanup)
      await settle()
      let { trigger, content } = parts(container)

      trigger.focus()
      trigger.click()
      await settle()
      // Back to the trigger keeps it open; on past the trigger closes it.
      trigger.focus()
      await settle()
      assert.equal(isOpen(content), true, `initialFocus ${initialFocus}`)
      byText(container, 'Before').focus()
      await settle()
      assert.equal(isOpen(content), false, `initialFocus ${initialFocus}`)
      cleanup()
    }
  })

  it('keeps an outer popover open for presses and focus in a nested one, and Escape closes the inner first', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Popover>
          <PopoverTrigger mix={at(100, 100)}>Filters</PopoverTrigger>
          <PopoverContent>
            <p>Status</p>
            <Popover>
              <PopoverTrigger>Customer</PopoverTrigger>
              <PopoverContent side="right">
                <input aria-label="Customer name" />
              </PopoverContent>
            </Popover>
          </PopoverContent>
        </Popover>
        <p mix={at(600, 500)}>Elsewhere</p>
      </div>,
    )
    await settle()
    let outer = parts(container, 0)
    let inner = parts(container, 1)

    outer.trigger.click()
    await settle()
    inner.trigger.click()
    await settle()
    assert.equal(isOpen(inner.content), true)
    assert.equal(document.activeElement, byText(inner.content, 'Customer name'))

    press(byText(inner.content, 'Customer name'))
    await settle()
    assert.equal(isOpen(outer.content), true)

    escape()
    await settle()
    assert.equal(isOpen(inner.content), false)
    assert.equal(isOpen(outer.content), true)
    assert.equal(document.activeElement, inner.trigger)

    inner.trigger.click()
    await settle()
    press(byText(container, 'Elsewhere'))
    await settle()
    assert.equal(isOpen(inner.content), false)
    assert.equal(isOpen(outer.content), false)
  })

  it('lets Escape close a tooltip inside it before the popover', async (t) => {
    let { container } = mount(
      t,
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>
          <Tooltip>
            <TooltipTrigger>Status</TooltipTrigger>
            <TooltipContent>Paid, open or overdue</TooltipContent>
          </Tooltip>
        </PopoverContent>
      </Popover>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let tooltip = container.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!

    trigger.click()
    await settle()
    // Focus moved to the tooltip's trigger, the first tabbable element, and opened the tooltip.
    assert.equal(isOpen(tooltip), true)

    escape()
    await settle()
    assert.equal(isOpen(tooltip), false)
    assert.equal(isOpen(content), true)

    escape()
    await settle()
    assert.equal(isOpen(content), false)
  })

  it('keeps a hover card inside it open for presses in the card, and Escape closes the card first', async (t) => {
    let { container } = mount(
      t,
      <Popover>
        <PopoverTrigger>Customer</PopoverTrigger>
        <PopoverContent>
          <HoverCard>
            <HoverCardTrigger href="#acme">Acme Labs</HoverCardTrigger>
            <HoverCardContent>
              <p>Customer since 2021</p>
            </HoverCardContent>
          </HoverCard>
        </PopoverContent>
      </Popover>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let card = container.querySelector<HTMLElement>('[data-slot="hover-card-content"]')!

    trigger.click()
    await settle()
    // Focus moved to the card's link, the first tabbable element, and opened the card.
    assert.equal(isOpen(card), true)

    press(byText(card, 'Customer since 2021'))
    await settle()
    assert.equal(isOpen(content), true)
    assert.equal(isOpen(card), true)

    escape()
    await settle()
    assert.equal(isOpen(card), false)
    assert.equal(isOpen(content), true)
  })

  it('makes the rest of the page inert and still while modal, until it closes', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Popover modal>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverContent>
            <button type="button">Apply</button>
          </PopoverContent>
        </Popover>
        <button type="button">Elsewhere</button>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let elsewhere = byText(container, 'Elsewhere')

    trigger.click()
    await settle()
    assert.ok(elsewhere.closest('[inert]'), 'the page outside is inert')
    assert.equal(trigger.closest('[inert]'), null, 'the trigger can still close it')
    assert.equal(getComputedStyle(document.documentElement).overflowY, 'hidden')

    escape()
    await settle()
    assert.equal(isOpen(content), false)
    assert.equal(elsewhere.closest('[inert]'), null)
    assert.notEqual(getComputedStyle(document.documentElement).overflowY, 'hidden')
  })

  it('asks before each change with a cancelable event, and follows its open prop', async (t) => {
    let reasons: Array<[boolean, PopoverOpenChangeReason]> = []
    let open = false
    let keepOpen = false

    function Controlled(handle: Handle) {
      return () => (
        <Popover open={open}>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverContent
            mix={on(popoverOpenChangeType, (event) => {
              assert.ok(event instanceof PopoverOpenChangeEvent)
              reasons.push([event.open, event.reason])
              if (keepOpen && !event.open) return event.preventDefault()
              open = event.open
              void handle.update()
            })}
          >
            <PopoverClose>Done</PopoverClose>
          </PopoverContent>
        </Popover>
      )
    }

    let { container } = mount(t, <Controlled />)
    await settle()
    let { trigger, content } = parts(container)

    trigger.click()
    await settle()
    keepOpen = true
    escape()
    await settle()
    assert.equal(isOpen(content), true)

    keepOpen = false
    byText(content, 'Done').click()
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
      [false, 'close-press'],
    ])
  })

  it('leaves focus on the trigger with initialFocus false', async (t) => {
    let { container } = mount(t, <Dimensions initialFocus={false} />)
    await settle()
    let { trigger, content } = parts(container)

    trigger.focus()
    trigger.click()
    await settle()
    assert.equal(isOpen(content), true)
    assert.ok(document.activeElement === trigger, `focus on ${document.activeElement?.outerHTML.slice(0, 80)}`)
  })

  it('returns focus where finalFocus says, and nowhere with finalFocus false', async (t) => {
    let target: HTMLElement | null = null
    let { container } = mount(
      t,
      <div>
        <Dimensions finalFocus={() => target} trigger="First" />
        <Dimensions finalFocus={false} trigger="Second" />
        <button type="button">Summary</button>
      </div>,
    )
    await settle()
    target = byText(container, 'Summary')
    let first = parts(container, 0)
    let second = parts(container, 1)

    first.trigger.click()
    await settle()
    escape()
    await settle()
    assert.ok(document.activeElement === target, `focus on ${document.activeElement?.outerHTML.slice(0, 80)}`)

    second.trigger.click()
    await settle()
    assert.ok(second.content.contains(document.activeElement))
    escape()
    await settle()
    assert.notEqual(document.activeElement, second.trigger)
  })

  it('places on the side and alignment asked, flips at the edge, and mirrors start in right-to-left text', async (t) => {
    let cases = [
      { dir: 'ltr', top: 200, props: { side: 'right', sideOffset: 8 }, side: 'right' },
      { dir: 'ltr', top: innerHeight - 40, props: {}, side: 'top' },
      { dir: 'rtl', top: 200, props: { align: 'start' }, side: 'bottom' },
    ] as const
    for (let { dir, top, props, side } of cases) {
      let { container, cleanup } = render(
        <div dir={dir}>
          <Popover defaultOpen>
            <PopoverTrigger mix={css({ position: 'fixed', left: '300px', top: `${top}px`, width: '100px' })}>
              Filters
            </PopoverTrigger>
            <PopoverContent {...props} mix={css({ width: '160px', height: '80px', padding: 0 })}>
              Filters
            </PopoverContent>
          </Popover>
        </div>,
      )
      t.after(cleanup)
      await settle()
      let { trigger, content } = parts(container)
      let box = content.getBoundingClientRect()
      let anchor = trigger.getBoundingClientRect()

      assert.equal(content.dataset.side, side, `${dir} ${JSON.stringify(props)}`)
      if (side === 'right') assert.equal(Math.round(box.left), Math.round(anchor.right) + 8)
      if (side === 'top') assert.equal(Math.round(box.bottom), Math.round(anchor.top) - 4)
      if (dir === 'rtl') assert.equal(Math.round(box.right), Math.round(anchor.right))
      cleanup()
    }
  })

  it('follows its trigger as a box scrolls, and hides while the trigger is scrolled out of view', async (t) => {
    let { container } = mount(
      t,
      <div
        mix={css({ position: 'fixed', left: '100px', top: '100px', width: '300px', height: '200px', overflow: 'auto' })}
      >
        <div mix={css({ height: '1000px', paddingTop: '50px' })}>
          <Popover defaultOpen>
            <PopoverTrigger>Filters</PopoverTrigger>
            <PopoverContent>Filters</PopoverContent>
          </Popover>
        </div>
      </div>,
    )
    await settle()
    let { trigger, content } = parts(container)
    let scroller = container.firstElementChild!
    let gap = () => Math.round(content.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom)
    assert.equal(gap(), 4)

    scroller.scrollTop = 30
    await settle()
    assert.equal(gap(), 4)
    assert.ok(!content.hasAttribute('data-anchor-hidden'))

    scroller.scrollTop = 400
    await settle()
    assert.ok(content.hasAttribute('data-anchor-hidden'))
    assert.equal(getComputedStyle(content).visibility, 'hidden')
  })

  it('shows in full inside a box that clips its overflow', async (t) => {
    let { container } = mount(
      t,
      <div
        mix={css({
          position: 'fixed',
          left: '100px',
          top: '100px',
          width: '120px',
          height: '40px',
          overflow: 'hidden',
        })}
      >
        <Popover defaultOpen>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverContent>
            <button type="button">Apply</button>
          </PopoverContent>
        </Popover>
      </div>,
    )
    await settle()
    let apply = byText(parts(container).content, 'Apply')
    let box = apply.getBoundingClientRect()
    // A point of the button outside the clipping box, which spans 100px to 220px across.
    let x = box.right - 4
    let y = box.top + box.height / 2

    assert.ok(x > 220, `the button ends at ${box.right}`)
    assert.equal(document.elementFromPoint(x, y), apply)
  })

  it('closes when its trigger is removed and puts focus on a neighbor', async (t) => {
    let shown = true
    let remove: () => Promise<AbortSignal>
    let reasons: PopoverOpenChangeReason[] = []

    function Removable(handle: Handle) {
      remove = () => {
        shown = false
        return handle.update()
      }
      return () => (
        <section>
          <button type="button">Before</button>
          <Popover>
            {shown ? <PopoverTrigger>Filters</PopoverTrigger> : null}
            <PopoverContent mix={on(popoverOpenChangeType, (event) => void reasons.push(event.reason))}>
              <button type="button">Apply</button>
            </PopoverContent>
          </Popover>
        </section>
      )
    }

    let { container } = mount(t, <Removable />)
    await settle()
    let { trigger, content } = parts(container)
    trigger.click()
    await settle()
    assert.equal(document.activeElement, byText(content, 'Apply'))

    await remove!()
    await settle()
    assert.equal(isOpen(content), false)
    assert.deepEqual(reasons, ['trigger-press', 'trigger-removed'])
    assert.equal(document.activeElement, byText(container, 'Before'))
  })

  it('follows the ids of content and a title inside other components, also as they change', async (t) => {
    let suffix = 'first'
    let rename: () => Promise<AbortSignal>

    function Heading() {
      return () => <PopoverTitle id={`${suffix}-title`}>Filters</PopoverTitle>
    }

    function Wrapped(handle: Handle) {
      rename = () => {
        suffix = 'second'
        return handle.update()
      }
      return () => (
        <PopoverContent id={`${suffix}-popover`}>
          <Heading />
        </PopoverContent>
      )
    }

    let { container } = mount(
      t,
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <Wrapped />
      </Popover>,
    )
    await settle()
    let { trigger, content } = parts(container)
    assert.equal(trigger.getAttribute('aria-controls'), 'first-popover')
    assert.equal(content.getAttribute('aria-labelledby'), 'first-title')

    await rename!()
    await settle()
    assert.equal(content.id, 'second-popover')
    assert.equal(trigger.getAttribute('aria-controls'), 'second-popover')
    assert.equal(content.getAttribute('aria-labelledby'), 'second-title')
  })

  it('names the dialog from a title inside another component without an id of its own', async (t) => {
    function Heading() {
      return () => <PopoverTitle>Filters</PopoverTitle>
    }

    let { container } = mount(
      t,
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>
          <Heading />
        </PopoverContent>
      </Popover>,
    )
    await settle()
    let { content } = parts(container)
    let title = container.querySelector('[data-slot="popover-title"]')!

    assert.ok(title.id)
    assert.equal(content.getAttribute('aria-labelledby'), title.id)
  })

  it('keeps each instance apart', async (t) => {
    let { container } = mount(
      t,
      <div>
        <Dimensions trigger="First" />
        <Popover>
          <PopoverTrigger mix={at(400, 200)}>Second</PopoverTrigger>
          <PopoverContent>Second</PopoverContent>
        </Popover>
      </div>,
    )
    await settle()
    let first = parts(container, 0)
    let second = parts(container, 1)

    first.trigger.click()
    await settle()
    assert.equal(isOpen(first.content), true)
    assert.equal(isOpen(second.content), false)
    assert.notEqual(first.content.id, second.content.id)
  })
})
