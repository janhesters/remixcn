import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Carousel,
  CarouselAutoplayToggle,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  carouselSelectType,
} from './carousel.tsx'
import type { CarouselApi, CarouselProps } from './carousel.tsx'

// Browser tests run without theme.css, so the frame sets the one token the
// carousel measures with: --spacing, for the 1rem gap between slides.
const frame = css({ '--spacing': '0.25rem', width: '300px', fontSize: '16px' })
const slideBody = css({ height: '80px' })

interface Selection {
  index: number
  previousIndex: number
  snapCount: number
  reason: string
}

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div mix={frame}>{node}</div>)
  t.after(result.cleanup)
  return result
}

/** Waits a frame at a time until the check passes. */
async function until(check: () => boolean, message: string | (() => string), timeout = 3000) {
  let start = performance.now()
  while (!check()) {
    if (performance.now() - start > timeout) assert.fail(typeof message === 'string' ? message : message())
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

function part(container: HTMLElement, slot: string, index = 0) {
  let found = container.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)[index]
  assert.ok(found, `no ${slot}`)
  return found
}

function scrollStart(viewport: HTMLElement) {
  return getComputedStyle(viewport).direction === 'rtl' ? -viewport.scrollLeft : viewport.scrollLeft
}

/** A carousel of numbered slides with every event recorded and its API kept. */
function setup(t: TestContext, props: Partial<CarouselProps> = {}, count = 3, extra?: (index: number) => RemixNode) {
  let events: Selection[] = []
  let api: CarouselApi | undefined
  let apiCalls = 0
  let result = mount(
    t,
    <Carousel
      aria-label="Invoices"
      {...props}
      setApi={(value) => {
        api = value
        apiCalls++
      }}
      mix={on(carouselSelectType, (event) => {
        if (event.target !== event.currentTarget) return
        events.push({
          index: event.index,
          previousIndex: event.previousIndex,
          snapCount: event.snapCount,
          reason: event.reason,
        })
      })}
    >
      <CarouselContent>
        {Array.from({ length: count }, (_, index) => (
          <CarouselItem key={index}>
            <div mix={slideBody}>
              Invoice {index + 1}
              {extra?.(index)}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  )
  let root = part(result.container, 'carousel')
  let viewport = part(result.container, 'carousel-content')
  return {
    ...result,
    root,
    viewport,
    events,
    previous: part(result.container, 'carousel-previous'),
    next: part(result.container, 'carousel-next'),
    get api() {
      assert.ok(api, 'no API yet')
      return api
    },
    get apiCalls() {
      return apiCalls
    },
    async ready() {
      await until(() => root.hasAttribute('data-ready') && api !== undefined, 'the carousel never ran')
    },
    async settled(position: number) {
      await until(
        () =>
          Math.abs(scrollStart(viewport) - position) < 1 &&
          root.querySelector('[data-slot="carousel-status"]') !== null,
        `the carousel never reached ${position}, it is at ${scrollStart(viewport)}`,
      )
      // A scroll counts as done a moment after its last scroll event.
      await new Promise((resolve) => setTimeout(resolve, 200))
    },
  }
}

function status(root: HTMLElement) {
  return part(root, 'carousel-status').textContent ?? ''
}

function key(target: HTMLElement, name: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

// Slides are 300px wide with a 16px gap, so snap n starts at n * 316.
const snap = (index: number) => index * 316

describe('Carousel in the browser', () => {
  it('turns its controls on and reports the first snap once it runs', async (t) => {
    let carousel = setup(t)
    await carousel.ready()

    assert.equal(carousel.apiCalls, 1)
    assert.equal(carousel.api.root, carousel.root)
    assert.equal(carousel.api.selectedIndex, 0)
    assert.equal(carousel.api.snapCount, 3)
    assert.equal(carousel.api.slides.length, 3)
    assert.deepEqual(carousel.events, [{ index: 0, previousIndex: 0, snapCount: 3, reason: 'init' }])

    // At the first snap, Previous is disabled but keeps its place in the tab order.
    assert.equal(carousel.previous.getAttribute('aria-disabled'), 'true')
    assert.equal(carousel.previous.hasAttribute('disabled'), false)
    assert.equal(carousel.next.hasAttribute('disabled'), false)
    assert.equal(carousel.next.hasAttribute('aria-disabled'), false)
    assert.equal(part(carousel.container, 'carousel-item').getAttribute('data-selected'), 'true')
  })

  it('scrolls one snap with each button, and keeps focus on a button at the end', async (t) => {
    let carousel = setup(t)
    await carousel.ready()

    carousel.next.focus()
    await carousel.act(() => carousel.next.click())
    assert.equal(carousel.api.selectedIndex, 1)
    await carousel.settled(snap(1))
    assert.equal(status(carousel.root), 'Slide 2 of 3')

    await carousel.act(() => carousel.next.click())
    await carousel.settled(snap(2))
    assert.equal(carousel.next.getAttribute('aria-disabled'), 'true')
    assert.equal(document.activeElement, carousel.next)
    assert.equal(status(carousel.root), 'Slide 3 of 3')

    // A disabled button does nothing.
    await carousel.act(() => carousel.next.click())
    assert.equal(carousel.api.selectedIndex, 2)

    await carousel.act(() => carousel.previous.click())
    await carousel.settled(snap(1))
    assert.deepEqual(
      carousel.events.slice(1).map(({ index, previousIndex, reason }) => [index, previousIndex, reason]),
      [
        [1, 0, 'user'],
        [2, 1, 'user'],
        [1, 2, 'user'],
      ],
    )
  })

  it('follows the arrow keys from the scroll container and the buttons', async (t) => {
    let carousel = setup(t)
    await carousel.ready()

    let right = key(carousel.viewport, 'ArrowRight')
    assert.equal(right.defaultPrevented, true)
    await carousel.settled(snap(1))

    key(carousel.next, 'ArrowRight')
    await carousel.settled(snap(2))
    key(carousel.previous, 'ArrowLeft')
    await carousel.settled(snap(1))

    // Other keys, and arrows with a modifier, stay the browser's.
    assert.equal(key(carousel.viewport, 'ArrowDown').defaultPrevented, false)
    assert.equal(key(carousel.viewport, 'ArrowRight', { shiftKey: true }).defaultPrevented, false)
    assert.equal(carousel.api.selectedIndex, 1)
  })

  it('swaps Left and Right in right-to-left text, and scrolls toward the left', async (t) => {
    let carousel = setup(t, { dir: 'rtl' })
    await carousel.ready()

    key(carousel.viewport, 'ArrowLeft')
    await carousel.settled(snap(1))
    assert.ok(carousel.viewport.scrollLeft < 0, `scrollLeft ${carousel.viewport.scrollLeft}`)
    assert.equal(carousel.api.selectedIndex, 1)

    key(carousel.viewport, 'ArrowRight')
    await carousel.settled(snap(0))
    assert.equal(carousel.api.selectedIndex, 0)
  })

  it('takes Up and Down in a vertical carousel', async (t) => {
    let events: number[] = []
    let api: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel
        aria-label="Reminders"
        orientation="vertical"
        setApi={(value) => (api = value)}
        mix={on(carouselSelectType, (event) => void events.push(event.index))}
      >
        <CarouselContent mix={css({ height: '100px' })}>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
          <CarouselItem>Three</CarouselItem>
        </CarouselContent>
      </Carousel>,
    )
    let viewport = part(container, 'carousel-content')
    await until(() => api !== undefined, 'the carousel never ran')

    assert.equal(key(viewport, 'ArrowRight').defaultPrevented, false)
    assert.equal(key(viewport, 'ArrowDown').defaultPrevented, true)
    await until(() => Math.abs(viewport.scrollTop - 116) < 1, `scrollTop ${viewport.scrollTop}`)
    key(viewport, 'ArrowUp')
    await until(() => viewport.scrollTop < 1, `scrollTop ${viewport.scrollTop}`)
    assert.deepEqual(events, [0, 1, 0])
  })

  it('leaves the arrow keys to fields and widgets inside a slide', async (t) => {
    let carousel = setup(t, {}, 3, (index) =>
      index === 0
        ? [
            <input key="input" aria-label="Amount" defaultValue="120" />,
            <textarea key="note" aria-label="Note" />,
            <div key="slider" role="slider" tabIndex={0} aria-label="Rate" aria-valuenow={1} />,
            <a key="link" href="#invoice">
              Open
            </a>,
          ]
        : null,
    )
    await carousel.ready()

    for (let selector of ['input', 'textarea', '[role="slider"]']) {
      let target = part(carousel.root, 'carousel-item').querySelector<HTMLElement>(selector)
      assert.ok(target)
      assert.equal(key(target, 'ArrowRight').defaultPrevented, false, selector)
    }
    assert.equal(carousel.api.selectedIndex, 0)

    // A link isn't a field: the arrows move the carousel from it, and focus stays on it.
    let link = carousel.root.querySelector('a')
    assert.ok(link)
    link.focus()
    assert.equal(key(link, 'ArrowRight').defaultPrevented, true)
    await carousel.settled(snap(1))
    assert.equal(document.activeElement, link)
  })

  it('lets a nested carousel take its own arrows first', async (t) => {
    let inner: CarouselApi | undefined
    let outer: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel aria-label="Outer" setApi={(api) => (outer = api)}>
        <CarouselContent>
          <CarouselItem>
            <Carousel aria-label="Inner" setApi={(api) => (inner = api)}>
              <CarouselContent>
                <CarouselItem>A</CarouselItem>
                <CarouselItem>B</CarouselItem>
              </CarouselContent>
            </Carousel>
          </CarouselItem>
          <CarouselItem>Two</CarouselItem>
        </CarouselContent>
      </Carousel>,
    )
    await until(() => inner !== undefined && outer !== undefined, 'the carousels never ran')

    key(part(container, 'carousel-content', 1), 'ArrowRight')
    assert.equal(inner?.selectedIndex, 1)
    assert.equal(outer?.selectedIndex, 0)
    assert.deepEqual(
      [...container.querySelectorAll('[data-slot="carousel-item"]')].map((item) => item.getAttribute('aria-label')),
      ['1 of 2', '1 of 2', '2 of 2', '2 of 2'],
    )
  })

  it('goes from the last snap to the first and back when it loops', async (t) => {
    let carousel = setup(t, { loop: true })
    await carousel.ready()

    assert.equal(carousel.previous.hasAttribute('aria-disabled'), false)
    await carousel.act(() => carousel.previous.click())
    assert.equal(carousel.api.selectedIndex, 2)
    await carousel.settled(snap(2))
    await carousel.act(() => carousel.next.click())
    assert.equal(carousel.api.selectedIndex, 0)
    await carousel.settled(snap(0))
    assert.equal(carousel.api.canScrollNext, true)
    assert.equal(carousel.api.canScrollPrevious, true)
  })

  it('scrolls to any snap through its API, and reports why', async (t) => {
    let carousel = setup(t, {}, 4)
    await carousel.ready()

    carousel.api.scrollTo(3, { instant: true })
    assert.equal(carousel.api.selectedIndex, 3)
    assert.equal(carousel.api.previousIndex, 0)
    await carousel.settled(snap(3))
    carousel.api.scrollPrevious()
    await carousel.settled(snap(2))
    carousel.api.scrollTo(99, { instant: true })
    await carousel.settled(snap(3))
    assert.equal(carousel.api.canScrollNext, false)
    carousel.api.scrollNext()
    assert.deepEqual(carousel.api.slidesInSnap(3), [3])
    assert.deepEqual(
      carousel.events.slice(1).map(({ index, reason }) => [index, reason]),
      [
        [3, 'api'],
        [2, 'api'],
        [3, 'api'],
      ],
    )
  })

  it('selects the snap a touch, wheel or focus scroll ends at', async (t) => {
    let carousel = setup(t, {}, 3, (index) => (index === 2 ? <a href="#last">Last invoice</a> : null))
    await carousel.ready()

    // A scroll the user makes, as touch and wheels do, with snapping taking it to a snap.
    carousel.viewport.scrollLeft = snap(1)
    await carousel.settled(snap(1))
    assert.equal(carousel.api.selectedIndex, 1)
    assert.equal(status(carousel.root), 'Slide 2 of 3')

    // Focus on a link in a slide out of view scrolls it into view, and the carousel follows.
    carousel.root.querySelector<HTMLElement>('a')?.focus()
    await until(() => carousel.api.selectedIndex === 2, 'the carousel never followed focus')
    assert.deepEqual(
      carousel.events.slice(1).map(({ index, reason }) => [index, reason]),
      [
        [1, 'user'],
        [2, 'user'],
      ],
    )
  })

  it('merges the snaps that several slides in view share, for each alignment', async (t) => {
    let three = css({ '--carousel-slides': '3', '--carousel-gap': '10px' })
    let snapsFor = async (align: 'start' | 'center' | 'end') => {
      let api: CarouselApi | undefined
      let { container, cleanup } = render(
        <div mix={[frame, three]}>
          <Carousel aria-label="Invoices" align={align} setApi={(value) => (api = value)}>
            <CarouselContent>
              {[1, 2, 3, 4, 5].map((number) => (
                <CarouselItem key={number}>{number}</CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>,
      )
      t.after(cleanup)
      await until(() => api !== undefined, 'the carousel never ran')
      let item = part(container, 'carousel-item')
      assert.ok(Math.abs(item.getBoundingClientRect().width - (300 - 20) / 3) < 0.5)
      let current = api as CarouselApi
      return Array.from({ length: current.snapCount }, (_, index) => current.slidesInSnap(index))
    }

    assert.deepEqual(await snapsFor('start'), [[0], [1], [2, 3, 4]])
    assert.deepEqual(await snapsFor('center'), [[0, 1], [2], [3, 4]])
    assert.deepEqual(await snapsFor('end'), [[0, 1, 2], [3], [4]])
  })

  it('measures again when it resizes, keeping the selected slide in view', async (t) => {
    let carousel = setup(t)
    await carousel.ready()
    carousel.api.scrollTo(2, { instant: true })
    await carousel.settled(snap(2))

    let wrapper = carousel.root.parentElement as HTMLElement
    wrapper.style.width = '200px'
    await until(
      () => Math.abs(carousel.viewport.scrollLeft - 2 * 216) < 1,
      `scrollLeft ${carousel.viewport.scrollLeft}`,
    )
    assert.equal(carousel.api.selectedIndex, 2)

    // Wide enough for every slide in one view: a single snap.
    wrapper.style.setProperty('--carousel-slides', '3')
    await until(
      () => carousel.api.snapCount === 1,
      () =>
        `snapCount ${carousel.api.snapCount}, scrollWidth ${carousel.viewport.scrollWidth}, clientWidth ${carousel.viewport.clientWidth}`,
    )
    assert.equal(carousel.api.selectedIndex, 0)
    assert.equal(carousel.next.getAttribute('aria-disabled'), 'true')
    assert.deepEqual(carousel.events.at(-1), { index: 0, previousIndex: 2, snapCount: 1, reason: 'layout' })
  })

  it('keeps the selected slide when a window resize re-snaps before the resize is observed', async (t) => {
    // The test runs in a frame: resizing the frame resizes its window. The
    // browser re-snaps at once and sends that scroll event before any
    // ResizeObserver callback, so the carousel must measure again first.
    let frame = window.frameElement as HTMLElement | null
    assert.ok(frame, 'browser tests run in a frame')
    let width = frame.style.width
    t.after(() => (frame.style.width = width))
    frame.style.width = '600px'

    let events: number[] = []
    let api: CarouselApi | undefined
    let { container, cleanup } = render(
      <div mix={css({ '--spacing': '0.25rem', width: '50vw' })}>
        <Carousel
          aria-label="Invoices"
          setApi={(value) => (api = value)}
          mix={on(carouselSelectType, (event) => void events.push(event.index))}
        >
          <CarouselContent>
            {[1, 2, 3, 4, 5].map((number) => (
              <CarouselItem key={number}>{number}</CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>,
    )
    t.after(cleanup)
    await until(() => api !== undefined, 'the carousel never ran')
    let viewport = part(container, 'carousel-content')
    let current = api as CarouselApi
    current.scrollTo(2, { instant: true })
    await until(() => Math.abs(viewport.scrollLeft - 2 * 316) < 1, `scrollLeft ${viewport.scrollLeft}`)
    await new Promise((resolve) => setTimeout(resolve, 200))

    frame.style.width = '400px'
    await until(() => viewport.clientWidth === 200, `width ${viewport.clientWidth}`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(current.selectedIndex, 2)
    assert.equal(Math.round(viewport.scrollLeft), 2 * 216)
    assert.deepEqual(events, [0, 2])
  })

  it('counts snaps from the slides, not from content that overflows the last one', async (t) => {
    let api: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel
        aria-label="Invoices"
        setApi={(value) => (api = value)}
        mix={css({ '--carousel-item-size': '90px', '--carousel-gap': '0px' })}
      >
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
          <CarouselItem>
            {/* Wider than its slide, such as a long word in a wide font: the scroll range grows by 60px. */}
            <div mix={css({ width: '150px' })}>Three</div>
          </CarouselItem>
        </CarouselContent>
        <CarouselNext />
      </Carousel>,
    )
    await until(() => api !== undefined, 'the carousel never ran')
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    let viewport = part(container, 'carousel-content')
    let current = api as CarouselApi

    assert.equal(viewport.scrollWidth - viewport.clientWidth, 30)
    assert.equal(current.snapCount, 1)
    assert.deepEqual(current.slidesInSnap(0), [0, 1, 2])
    assert.equal(part(container, 'carousel-next').getAttribute('aria-disabled'), 'true')
  })

  it('measures again when only the gap changes, so the controls follow', async (t) => {
    let api: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel
        aria-label="Invoices"
        align="start"
        setApi={(value) => (api = value)}
        mix={css({ '--carousel-item-size': '90px', '--carousel-gap': '0px' })}
      >
        <CarouselContent>
          {[1, 2, 3].map((number) => (
            <CarouselItem key={number}>{number}</CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext />
      </Carousel>,
    )
    await until(() => api !== undefined, 'the carousel never ran')
    let current = api as CarouselApi
    let next = part(container, 'carousel-next')
    assert.equal(current.snapCount, 1)
    assert.equal(next.getAttribute('aria-disabled'), 'true')

    // Let the observers deliver their first measurements.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    // The slides keep their size and nothing is added or removed: only the scroll range grows.
    part(container, 'carousel').style.setProperty('--carousel-gap', '30px')
    await until(() => current.snapCount === 2, `snapCount ${current.snapCount}`)
    await until(() => !next.hasAttribute('aria-disabled'), 'Next stayed disabled')
    assert.equal(current.canScrollNext, true)
  })

  it('measures again when a style for a narrower window moves the slides without resizing them', async (t) => {
    let frame = window.frameElement as HTMLElement | null
    assert.ok(frame, 'browser tests run in a frame')
    let width = frame.style.width
    t.after(() => (frame.style.width = width))
    frame.style.width = '600px'

    let api: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel
        aria-label="Invoices"
        align="start"
        setApi={(value) => (api = value)}
        mix={css({ '--carousel-item-size': '90px', '--carousel-gap': '0px' })}
      >
        <CarouselContent mix={css({ '@media (max-width: 500px)': { gap: '30px' } })}>
          {[1, 2, 3].map((number) => (
            <CarouselItem key={number}>{number}</CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext />
      </Carousel>,
    )
    await until(() => api !== undefined, 'the carousel never ran')
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    let current = api as CarouselApi
    assert.equal(current.snapCount, 1)

    // A track style for narrow windows widens the gap, which the gap probe doesn't see. The frame
    // stays wider than the 300px carousel, so nothing the carousel observes changes size.
    frame.style.width = '450px'
    let viewport = part(container, 'carousel-content')
    let track = part(container, 'carousel-track')
    await until(
      () => current.snapCount === 2,
      () =>
        `snapCount ${current.snapCount}, scrollWidth ${viewport.scrollWidth}, gap ${getComputedStyle(track).columnGap}`,
    )
    await until(() => !part(container, 'carousel-next').hasAttribute('aria-disabled'), 'Next stayed disabled')
  })

  it('marks the slides of the selected snap again when the alignment changes', async (t) => {
    let align: 'start' | 'end' = 'start'
    let update: () => Promise<AbortSignal> = async () => new AbortController().signal
    let api: CarouselApi | undefined

    function Numbers(handle: Handle) {
      update = () => handle.update()
      return () => (
        <Carousel
          aria-label="Numbers"
          align={align}
          setApi={(value) => (api = value)}
          mix={css({ '--carousel-slides': '3', '--carousel-gap': '10px' })}
        >
          <CarouselContent>
            {[1, 2, 3, 4, 5].map((number) => (
              <CarouselItem key={number}>{number}</CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )
    }

    let { container, act } = mount(t, <Numbers />)
    await until(() => api !== undefined, 'the carousel never ran')
    let marked = () =>
      [...container.querySelectorAll('[data-slot="carousel-item"]')].flatMap((item, index) =>
        item.hasAttribute('data-selected') ? [index] : [],
      )
    assert.deepEqual(marked(), [0])

    align = 'end'
    await act(update)
    let current = api as CarouselApi
    await until(() => current.slidesInSnap(0).length === 3, `snap 0 shows ${current.slidesInSnap(0)}`)
    assert.equal(current.selectedIndex, 0)
    await until(() => marked().length === 3, `marked ${marked()}`)
    assert.deepEqual(marked(), [0, 1, 2])
  })

  it('follows slides that come and go, keeping the selected one in view', async (t) => {
    let numbers = [1, 2, 3]
    let update: () => Promise<AbortSignal> = async () => new AbortController().signal
    let api: CarouselApi | undefined
    let events: Array<[number, number, string]> = []

    function Invoices(handle: Handle) {
      update = () => handle.update()
      return () => (
        <Carousel
          aria-label="Invoices"
          setApi={(value) => (api = value)}
          mix={on(carouselSelectType, (event) => void events.push([event.index, event.snapCount, event.reason]))}
        >
          <CarouselContent>
            {numbers.map((number) => (
              <CarouselItem key={number} data-number={number}>
                Invoice {number}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )
    }

    let { container, act } = mount(t, <Invoices />)
    await until(() => api !== undefined, 'the carousel never ran')
    let viewport = part(container, 'carousel-content')
    let current = () => api as CarouselApi
    current().scrollTo(1, { instant: true })
    await until(() => Math.abs(viewport.scrollLeft - snap(1)) < 1, 'never reached invoice 2')

    // A slide added before the selected one: invoice 2 stays in view, now at snap 2.
    numbers = [0, 1, 2, 3]
    await act(update)
    await until(() => current().snapCount === 4, 'never counted the new slide')
    await until(() => Math.abs(viewport.scrollLeft - snap(2)) < 1, `scrollLeft ${viewport.scrollLeft}`)
    assert.equal(current().selectedIndex, 2)
    assert.deepEqual(
      [...container.querySelectorAll('[data-slot="carousel-item"]')].map((item) => item.getAttribute('aria-label')),
      ['1 of 4', '2 of 4', '3 of 4', '4 of 4'],
    )

    // The selected slide removed: its snap keeps the index, and the next slide takes its place.
    numbers = [0, 1, 3]
    await act(update)
    await until(() => current().snapCount === 3, 'never dropped the slide')
    assert.equal(current().selectedIndex, 2)
    assert.deepEqual(events.slice(-2), [
      [2, 4, 'layout'],
      [2, 3, 'layout'],
    ])
  })

  it('drags with a mouse, and the click that ends a drag never reaches a link', async (t) => {
    let clicks = 0
    let carousel = setup(t, {}, 3, () => (
      <a
        href="#invoice"
        mix={on('click', (event) => {
          event.preventDefault()
          clicks++
        })}
      >
        Open
      </a>
    ))
    await carousel.ready()
    let link = carousel.root.querySelector('a') as HTMLAnchorElement
    let box = link.getBoundingClientRect()
    let pointer = (type: string, x: number, target: EventTarget = link) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'mouse',
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: box.top + 2,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      )

    // A press that barely moves stays a click.
    pointer('pointerdown', box.left + 2)
    pointer('pointermove', box.left + 5, window)
    pointer('pointerup', box.left + 5, window)
    link.click()
    assert.equal(clicks, 1)

    // A drag past a third of a slide moves on one snap and swallows its click.
    pointer('pointerdown', box.left + 200)
    for (let x of [190, 160, 120, 100]) pointer('pointermove', box.left + x, window)
    assert.equal(carousel.root.getAttribute('data-dragging'), null)
    await carousel.act(() => {})
    assert.ok(carousel.viewport.scrollLeft > 90, `scrollLeft ${carousel.viewport.scrollLeft}`)
    pointer('pointerup', box.left + 100, window)
    link.click()
    assert.equal(clicks, 1)
    await carousel.settled(snap(1))
    assert.equal(carousel.api.selectedIndex, 1)
    assert.equal(carousel.viewport.style.getPropertyValue('scroll-snap-type'), '')
    assert.equal(carousel.root.hasAttribute('data-dragging'), false)

    // Later clicks work again.
    link.click()
    assert.equal(clicks, 2)
  })

  it('never starts a drag from a field, or with mouseDrag off', async (t) => {
    let carousel = setup(t, {}, 3, () => <input aria-label="Amount" />)
    await carousel.ready()
    let input = carousel.root.querySelector('input') as HTMLInputElement
    let box = input.getBoundingClientRect()
    let pointer = (type: string, x: number, target: EventTarget) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 3,
          pointerType: 'mouse',
          button: 0,
          clientX: x,
          clientY: box.top + 2,
          bubbles: true,
        }),
      )

    pointer('pointerdown', box.left + 200, input)
    pointer('pointermove', box.left + 50, window)
    pointer('pointerup', box.left + 50, window)
    await carousel.act(() => {})
    assert.equal(carousel.viewport.scrollLeft, 0)

    let off = setup(t, { mouseDrag: false })
    await off.ready()
    let item = part(off.root, 'carousel-item')
    pointer('pointerdown', 250, item)
    pointer('pointermove', 50, window)
    pointer('pointerup', 50, window)
    assert.equal(off.viewport.scrollLeft, 0)
  })

  it('keeps two carousels apart', async (t) => {
    let first = setup(t)
    let second = setup(t)
    await first.ready()
    await second.ready()

    await first.act(() => first.next.click())
    await first.settled(snap(1))
    assert.equal(first.api.selectedIndex, 1)
    assert.equal(second.api.selectedIndex, 0)
    assert.equal(second.events.length, 1)
    assert.notEqual(first.api, second.api)
  })

  it('starts at startIndex once it runs', async (t) => {
    let carousel = setup(t, { startIndex: 2 })
    await carousel.ready()

    assert.equal(carousel.api.selectedIndex, 2)
    await carousel.settled(snap(2))
    assert.deepEqual(carousel.events[0], { index: 2, previousIndex: 0, snapCount: 3, reason: 'init' })
    // The start isn't a change the user made, so nothing is announced.
    assert.equal(status(carousel.root), '')
  })

  it('stops listening and fires nothing once removed', async (t) => {
    let carousel = setup(t)
    await carousel.ready()
    let api = carousel.api
    let viewport = carousel.viewport

    carousel.cleanup()
    assert.equal(api.connected, false)
    api.scrollNext()
    api.scrollTo(2)
    viewport.scrollLeft = snap(2)
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(api.selectedIndex, 0)
    assert.equal(carousel.events.length, 1)
  })

  it('ends a drag without a trace when it is removed in the middle of it', async (t) => {
    let carousel = setup(t)
    await carousel.ready()
    let item = part(carousel.root, 'carousel-item')
    let box = item.getBoundingClientRect()
    let pointer = (type: string, x: number, target: EventTarget) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 9,
          pointerType: 'mouse',
          button: 0,
          clientX: x,
          clientY: box.top + 2,
          bubbles: true,
          view: window,
        }),
      )

    pointer('pointerdown', box.left + 250, item)
    pointer('pointermove', box.left + 150, window)
    await carousel.act(() => {})
    assert.equal(carousel.root.getAttribute('data-dragging'), 'true')

    let api = carousel.api
    carousel.cleanup()
    pointer('pointermove', box.left + 50, window)
    pointer('pointerup', box.left + 50, window)
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(api.connected, false)
    assert.equal(carousel.events.length, 1)
  })
})

describe('Carousel autoplay in the browser', () => {
  it('rotates on its own, back to the first snap after the last, and never moves focus', async (t) => {
    let carousel = setup(t, { autoplay: { delay: 300 } })
    await carousel.ready()
    let outside = document.createElement('button')
    document.body.append(outside)
    t.after(() => outside.remove())
    outside.focus()

    assert.equal(carousel.root.getAttribute('data-autoplay'), 'running')
    assert.equal(carousel.api.autoplayState, 'running')
    await until(() => carousel.api.selectedIndex === 1, 'never advanced')
    await until(() => carousel.api.selectedIndex === 2, 'never advanced twice')
    await until(() => carousel.api.selectedIndex === 0, 'never went back to the first snap')
    assert.equal(document.activeElement, outside)
    assert.ok(carousel.events.slice(1).every((event) => event.reason === 'autoplay'))
    // Automatic changes aren't announced.
    assert.equal(status(carousel.root), '')
  })

  it('pauses while the mouse is over it or focus is inside, and on a hidden page', async (t) => {
    let carousel = setup(t, { autoplay: { delay: 200 } })
    await carousel.ready()

    carousel.root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await carousel.act(() => {})
    assert.equal(carousel.root.getAttribute('data-autoplay'), 'paused')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(carousel.api.selectedIndex, 0)
    carousel.root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))

    carousel.next.focus()
    await carousel.act(() => {})
    assert.equal(carousel.api.autoplayState, 'paused')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(carousel.api.selectedIndex, 0)
    carousel.next.blur()
    await carousel.act(() => {})
    assert.equal(carousel.api.autoplayState, 'running')

    // The frame can't hide itself, so the page's visibility is stubbed on the document.
    let show = () => delete (document as { visibilityState?: unknown }).visibilityState
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    t.after(show)
    document.dispatchEvent(new Event('visibilitychange'))
    await carousel.act(() => {})
    assert.equal(carousel.api.autoplayState, 'paused')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(carousel.api.selectedIndex, 0)

    show()
    document.dispatchEvent(new Event('visibilitychange'))
    await carousel.act(() => {})
    assert.equal(carousel.api.autoplayState, 'running')
    await until(() => carousel.api.selectedIndex === 1, 'never resumed')
  })

  it('never runs while reduced motion is preferred', async (t) => {
    let listeners = new Set<(event: MediaQueryListEvent) => void>()
    let reduce = true
    let original = window.matchMedia
    window.matchMedia = ((query: string) => {
      if (!query.includes('prefers-reduced-motion')) return original.call(window, query)
      return {
        get matches() {
          return reduce
        },
        media: query,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          listeners.delete(listener),
      } as unknown as MediaQueryList
    }) as typeof window.matchMedia
    t.after(() => (window.matchMedia = original))

    let carousel = setup(t, { autoplay: { delay: 200 } })
    await carousel.ready()
    assert.equal(carousel.api.autoplayState, 'paused')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(carousel.api.selectedIndex, 0)

    // With reduced motion, buttons jump instead of scrolling smoothly.
    await carousel.act(() => carousel.next.click())
    await until(() => Math.abs(carousel.viewport.scrollLeft - snap(1)) < 1, 'never jumped')

    reduce = false
    for (let listener of listeners) listener({ matches: false } as MediaQueryListEvent)
    await carousel.act(() => {})
    assert.equal(carousel.api.autoplayState, 'running')
  })

  it('stops and starts with the toggle and the API, which say what they do', async (t) => {
    let api: CarouselApi | undefined
    let { container, act } = mount(
      t,
      <Carousel aria-label="Offers" autoplay={{ delay: 200 }} setApi={(value) => (api = value)}>
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
        </CarouselContent>
        <CarouselAutoplayToggle />
      </Carousel>,
    )
    await until(() => api !== undefined, 'the carousel never ran')
    let toggle = part(container, 'carousel-autoplay-toggle') as HTMLButtonElement
    let current = api as CarouselApi

    assert.equal(toggle.disabled, false)
    assert.equal(toggle.textContent, 'Stop slide rotation')
    await act(() => toggle.click())
    assert.equal(current.playing, false)
    assert.equal(current.autoplayState, 'stopped')
    assert.equal(toggle.textContent, 'Start slide rotation')
    assert.equal(toggle.getAttribute('data-state'), 'stopped')

    // Starting it again rotates at once, although the click left focus on the toggle.
    toggle.focus()
    await act(() => toggle.click())
    assert.equal(current.autoplayState, 'running')
    await until(() => current.selectedIndex === 1, 'never rotated after the toggle started it')

    await act(() => current.pause())
    assert.equal(current.autoplayState, 'stopped')
    await act(() => current.play())
    assert.equal(current.autoplayState, 'running')
  })

  it('stays off unless the caller turns it on, with a disabled toggle', async (t) => {
    let api: CarouselApi | undefined
    let { container } = mount(
      t,
      <Carousel aria-label="Offers" setApi={(value) => (api = value)}>
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
        </CarouselContent>
        <CarouselAutoplayToggle />
      </Carousel>,
    )
    await until(() => api !== undefined, 'the carousel never ran')

    assert.equal(api?.autoplayState, undefined)
    assert.equal(part(container, 'carousel').hasAttribute('data-autoplay'), false)
    assert.equal((part(container, 'carousel-autoplay-toggle') as HTMLButtonElement).disabled, true)
    api?.play()
    assert.equal(api?.autoplayState, undefined)
  })

  it('clears its timer when removed', async (t) => {
    let carousel = setup(t, { autoplay: { delay: 100 } })
    await carousel.ready()
    carousel.cleanup()
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(carousel.events.length, 1)
  })
})
