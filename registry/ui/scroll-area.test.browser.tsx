import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { ScrollArea, ScrollBar } from './scroll-area.tsx'

// Browser tests run without theme.css, so the frame sets the spacing token the scrollbars use.
const frame = '--spacing: 0.25rem; font-size: 16px;'
const box = 'width: 200px; height: 200px;'

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div style={frame}>{node}</div>)
  t.after(result.cleanup)
  return result
}

async function settle(act: (fn: () => void) => Promise<void>) {
  await act(() => {})
  await act(() => {})
}

// Scroll events arrive in the next frame. This waits for the scroll area to see one.
function scrollTo(viewport: HTMLElement, position: { top?: number; left?: number }) {
  return new Promise<void>((resolve) => {
    viewport.addEventListener('scroll', () => resolve(), { once: true })
    if (position.top !== undefined) viewport.scrollTop = position.top
    if (position.left !== undefined) viewport.scrollLeft = position.left
  })
}

function frames(count = 2) {
  return new Promise<void>((resolve) => {
    let step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)))
    step(count)
  })
}

function parts(container: ParentNode) {
  let root = container.querySelector('[data-slot="scroll-area"]') as HTMLElement
  let viewport = root.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
  let bar = (orientation: string) =>
    root.querySelector(`:scope > [data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`) as HTMLElement
  let thumb = (orientation: string) => bar(orientation)?.querySelector('[data-slot="scroll-area-thumb"]') as HTMLElement
  let corner = root.querySelector(':scope > [data-slot="scroll-area-corner"]') as HTMLElement
  return { root, viewport, bar, thumb, corner }
}

function offset(thumb: HTMLElement) {
  return Number.parseFloat(thumb.style.getPropertyValue('--scroll-area-thumb-offset'))
}

function pointer(target: EventTarget, type: string, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    }),
  )
}

function Tall(handle: Handle<{ rows?: number; children?: RemixNode }>) {
  return () => (
    <ScrollArea style={box} aria-label="Tags">
      {Array.from({ length: handle.props.rows ?? 50 }, (_, index) => (
        <div key={index} style="height: 20px">
          Tag {index + 1}
        </div>
      ))}
      {handle.props.children}
    </ScrollArea>
  )
}

function Wide(handle: Handle<{ horizontal?: boolean; tall?: boolean }>) {
  return () => (
    <ScrollArea style={box}>
      <div style={`display: flex; gap: 8px; height: ${handle.props.tall ? 600 : 120}px`}>
        {Array.from({ length: 6 }, (_, index) => (
          <figure key={index} style="flex: 0 0 150px; margin: 0">
            Photo {index + 1}
          </figure>
        ))}
      </div>
      {handle.props.horizontal ? <ScrollBar orientation="horizontal" /> : null}
    </ScrollArea>
  )
}

describe('Scroll Area in the browser', () => {
  it('draws a vertical thumb that follows the scroll position, in place of the native scrollbar', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { root, viewport, bar, thumb } = parts(container)

    assert.equal(root.getAttribute('data-scrollbars'), 'custom')
    assert.equal(root.hasAttribute('data-has-overflow-y'), true)
    assert.equal(root.hasAttribute('data-has-overflow-x'), false)
    assert.equal(root.hasAttribute('data-overflow-y-start'), false)
    assert.equal(root.hasAttribute('data-overflow-y-end'), true)
    assert.equal(getComputedStyle(viewport).scrollbarWidth, 'none')
    assert.equal(getComputedStyle(bar('vertical')).display, 'flex')
    // A 198px track shows 200 of 1000px: a 39.6px thumb.
    assert.equal(Math.round(thumb('vertical').getBoundingClientRect().height * 10) / 10, 39.6)
    // The thumb fills the track's thickness inside its 1px padding.
    assert.equal(thumb('vertical').getBoundingClientRect().width, bar('vertical').clientWidth - 2)

    await scrollTo(viewport, { top: 800 })
    assert.equal(Math.round(offset(thumb('vertical')) * 10) / 10, 158.4)
    assert.equal(root.hasAttribute('data-overflow-y-start'), true)
    assert.equal(root.hasAttribute('data-overflow-y-end'), false)
    assert.equal(viewport.style.getPropertyValue('--scroll-area-overflow-y-start'), '800px')
  })

  it('keeps the native scrollbars while an axis overflows without its own scrollbar', async (t) => {
    let { act, container } = mount(t, <Wide />)
    await settle(act)
    let { root, viewport, bar } = parts(container)

    assert.equal(root.hasAttribute('data-has-overflow-x'), true)
    assert.equal(root.getAttribute('data-scrollbars'), 'native')
    // As an unstyled element, which Playwright's Firefox reports as none too.
    assert.equal(getComputedStyle(viewport).scrollbarWidth, getComputedStyle(document.body).scrollbarWidth)
    assert.equal(getComputedStyle(bar('vertical')).display, 'none')
  })

  it('draws both scrollbars and the corner between them', async (t) => {
    let { act, container } = mount(t, <Wide horizontal tall />)
    await settle(act)
    let { root, bar, thumb, corner } = parts(container)

    assert.equal(root.getAttribute('data-scrollbars'), 'custom')
    assert.equal(getComputedStyle(bar('vertical')).display, 'flex')
    assert.equal(getComputedStyle(bar('horizontal')).display, 'flex')
    assert.equal(getComputedStyle(corner).display, 'block')
    assert.equal(corner.offsetWidth, bar('vertical').offsetWidth)
    assert.equal(corner.offsetHeight, bar('horizontal').offsetHeight)
    // The bars stop at the corner, so they never overlap.
    assert.ok(bar('vertical').getBoundingClientRect().bottom <= corner.getBoundingClientRect().top + 0.5)
    assert.ok(thumb('horizontal').getBoundingClientRect().width > 0)
    assert.equal(thumb('horizontal').getBoundingClientRect().height, bar('horizontal').clientHeight - 2)
  })

  it('scrolls when its thumb is dragged, in proportion to the content', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { viewport, thumb } = parts(container)
    let start = thumb('vertical').getBoundingClientRect()

    await act(() => pointer(thumb('vertical'), 'pointerdown', start.x + 2, start.y + 5))
    await act(() => pointer(document, 'pointermove', start.x + 2, start.y + 45))
    // 40px of thumb travel over a 158.4px range moves 800px of scroll by about 202px.
    assert.ok(Math.abs(viewport.scrollTop - 202) <= 2, String(viewport.scrollTop))
    await act(() => pointer(document, 'pointerup', start.x + 2, start.y + 45))

    await act(() => pointer(document, 'pointermove', start.x + 2, start.y + 120))
    assert.ok(Math.abs(viewport.scrollTop - 202) <= 2)
  })

  it('turns off scroll snapping while the thumb is dragged, as native scrollbars do', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { viewport, thumb } = parts(container)
    viewport.style.scrollSnapType = 'y mandatory'
    let start = thumb('vertical').getBoundingClientRect()

    await act(() => pointer(thumb('vertical'), 'pointerdown', start.x + 2, start.y + 5))
    assert.equal(viewport.style.scrollSnapType, 'none')
    await act(() => pointer(document, 'pointerup', start.x + 2, start.y + 5))
    assert.equal(viewport.style.scrollSnapType, 'y mandatory')
  })

  it('jumps to where its track is pressed, without taking focus', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { viewport, bar } = parts(container)
    let track = bar('vertical').getBoundingClientRect()

    let mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    bar('vertical').dispatchEvent(mousedown)
    assert.equal(mousedown.defaultPrevented, true)

    await act(() => pointer(bar('vertical'), 'pointerdown', track.x + 3, track.bottom - 2))
    await act(() => pointer(document, 'pointerup', track.x + 3, track.bottom - 2))
    assert.equal(viewport.scrollTop, 800)
  })

  it('scrolls with the wheel over a scrollbar, and leaves the wheel to the page at the edges', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { viewport, bar } = parts(container)
    let wheel = (deltaY: number) => {
      let event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
      bar('vertical').dispatchEvent(event)
      return event.defaultPrevented
    }

    assert.equal(wheel(-100), false)
    assert.equal(wheel(100), true)
    assert.equal(viewport.scrollTop, 100)
    viewport.scrollTop = 800
    assert.equal(wheel(100), false)
    assert.equal(viewport.scrollTop, 800)
  })

  it('mirrors the horizontal thumb in right-to-left text', async (t) => {
    let { act, container } = mount(
      t,
      <div dir="rtl">
        <Wide horizontal />
      </div>,
    )
    await settle(act)
    let { root, viewport, thumb } = parts(container)
    let scrollable = viewport.scrollWidth - viewport.clientWidth

    assert.equal(offset(thumb('horizontal')), 0)
    assert.equal(root.hasAttribute('data-overflow-x-start'), false)
    assert.ok(thumb('horizontal').getBoundingClientRect().right >= viewport.getBoundingClientRect().right - 2)

    await scrollTo(viewport, { left: -scrollable })
    assert.ok(offset(thumb('horizontal')) < 0)
    assert.equal(root.hasAttribute('data-overflow-x-start'), true)
    assert.equal(root.hasAttribute('data-overflow-x-end'), false)

    // Dragging the thumb right, back toward the start, scrolls back.
    let start = thumb('horizontal').getBoundingClientRect()
    await act(() => pointer(thumb('horizontal'), 'pointerdown', start.x + 5, start.y + 2))
    await act(() => pointer(document, 'pointermove', start.x + 1000, start.y + 2))
    await act(() => pointer(document, 'pointerup', start.x + 1000, start.y + 2))
    assert.equal(viewport.scrollLeft, 0)
  })

  it('follows focus into view and lets the keyboard reach a viewport that scrolls', async (t) => {
    let { act, container } = mount(
      t,
      <Tall rows={20}>
        <button type="button">Load more tags</button>
      </Tall>,
    )
    await settle(act)
    let { root, viewport, thumb } = parts(container)
    assert.equal(viewport.tabIndex, 0)

    let scrolled = new Promise<void>((resolve) => viewport.addEventListener('scroll', () => resolve(), { once: true }))
    container.querySelector('button')?.focus()
    await scrolled
    assert.ok(viewport.scrollTop > 0)
    assert.ok(offset(thumb('vertical')) > 0)
    assert.equal(root.hasAttribute('data-overflow-y-start'), true)
  })

  it('takes a viewport with nothing to scroll out of the tab order, and notices content that grows', async (t) => {
    function Growing(handle: Handle) {
      let rows = 3
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              rows = 30
              void handle.update()
            })}
          >
            More
          </button>
          <Tall rows={rows} />
        </div>
      )
    }

    let { act, container } = mount(t, <Growing />)
    await settle(act)
    let { root, viewport, bar } = parts(container)
    assert.equal(viewport.tabIndex, -1)
    assert.equal(root.hasAttribute('data-has-overflow-y'), false)
    assert.equal(getComputedStyle(bar('vertical')).display, 'none')

    await act(() => (container.querySelector('button') as HTMLButtonElement).click())
    await frames()
    await settle(act)
    assert.equal(viewport.tabIndex, 0)
    assert.equal(root.hasAttribute('data-has-overflow-y'), true)
    assert.equal(getComputedStyle(bar('vertical')).display, 'flex')
  })

  it('switches to its own scrollbars once a horizontal ScrollBar joins', async (t) => {
    function Toggled(handle: Handle) {
      let horizontal = false
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              horizontal = !horizontal
              void handle.update()
            })}
          >
            Toggle
          </button>
          <Wide horizontal={horizontal} />
        </div>
      )
    }

    let { act, container } = mount(t, <Toggled />)
    await settle(act)
    let { root } = parts(container)
    let toggle = container.querySelector('button') as HTMLButtonElement
    assert.equal(root.getAttribute('data-scrollbars'), 'native')

    await act(() => toggle.click())
    await settle(act)
    assert.equal(root.getAttribute('data-scrollbars'), 'custom')
    await act(() => toggle.click())
    await settle(act)
    assert.equal(root.getAttribute('data-scrollbars'), 'native')
  })

  it('stops a thumb drag when its scrollbar goes away while the area stays', async (t) => {
    function Removable(handle: Handle) {
      let horizontal = true
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              horizontal = false
              void handle.update()
            })}
          >
            Remove
          </button>
          <Wide horizontal={horizontal} />
        </div>
      )
    }

    let { act, container } = mount(t, <Removable />)
    await settle(act)
    let { viewport, thumb } = parts(container)
    viewport.style.scrollSnapType = 'x mandatory'
    let start = thumb('horizontal').getBoundingClientRect()

    await act(() => pointer(thumb('horizontal'), 'pointerdown', start.x + 5, start.y + 2))
    await act(() => (container.querySelector('button') as HTMLButtonElement).click())
    await settle(act)
    await act(() => pointer(document, 'pointermove', start.x + 105, start.y + 2))

    assert.equal(viewport.scrollLeft, 0)
    assert.equal(viewport.style.scrollSnapType, 'x mandatory')
    assert.equal(parts(container).root.getAttribute('data-scrollbars'), 'native')
  })

  it('keeps nested scroll areas apart', async (t) => {
    let { act, container } = mount(
      t,
      <ScrollArea style="width: 300px; height: 300px" data-testid="outer">
        <div style="height: 200px">Intro</div>
        <ScrollArea style="width: 200px; height: 100px" data-testid="inner">
          <div style="height: 500px">Inner content</div>
        </ScrollArea>
        <div style="height: 400px">More</div>
      </ScrollArea>,
    )
    await settle(act)
    let outer = container.querySelector('[data-testid="outer"]') as HTMLElement
    let inner = container.querySelector('[data-testid="inner"]') as HTMLElement
    let viewportOf = (root: HTMLElement) =>
      root.querySelector(':scope > [data-slot="scroll-area-viewport"]') as HTMLElement
    let thumbOf = (root: HTMLElement) =>
      root.querySelector(':scope > [data-slot="scroll-area-scrollbar"] [data-slot="scroll-area-thumb"]') as HTMLElement

    await scrollTo(viewportOf(inner), { top: 400 })
    assert.equal(inner.hasAttribute('data-overflow-y-start'), true)
    assert.equal(outer.hasAttribute('data-overflow-y-start'), false)
    assert.ok(offset(thumbOf(inner)) > 0)
    assert.equal(offset(thumbOf(outer)), 0)
  })

  it('marks the area as scrolling, then clears the mark', async (t) => {
    let { act, container } = mount(t, <Tall />)
    await settle(act)
    let { root, viewport, bar } = parts(container)

    await scrollTo(viewport, { top: 100 })
    assert.equal(root.hasAttribute('data-scrolling'), true)
    assert.equal(bar('vertical').hasAttribute('data-scrolling'), true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    assert.equal(root.hasAttribute('data-scrolling'), false)
  })

  it('disconnects its observers and stops a drag once removed', async (t) => {
    let observers = { observed: 0, disconnected: 0 }
    let Original = window.ResizeObserver
    window.ResizeObserver = class extends Original {
      observe(target: Element, options?: ResizeObserverOptions) {
        observers.observed++
        super.observe(target, options)
      }
      disconnect() {
        observers.disconnected++
        super.disconnect()
      }
    }
    t.after(() => {
      window.ResizeObserver = Original
    })

    let { act, container, cleanup } = render(
      <div style={frame}>
        <Tall />
      </div>,
    )
    await settle(act)
    let { viewport, thumb } = parts(container)
    let start = thumb('vertical').getBoundingClientRect()
    await act(() => pointer(thumb('vertical'), 'pointerdown', start.x + 2, start.y + 5))
    cleanup()

    pointer(document, 'pointermove', start.x + 2, start.y + 100)
    assert.equal(viewport.scrollTop, 0)
    assert.equal(observers.observed, 2)
    assert.equal(observers.disconnected, 1)
  })
})
