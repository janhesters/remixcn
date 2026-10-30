import * as assert from 'remix/assert'
import { ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { anchorPosition, positionFloating } from '#remixcn/lib/anchor-position.ts'
import type { FloatingOptions } from '#remixcn/lib/anchor-position.ts'

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function setup(t: TestContext, anchorStyle: string) {
  let anchor = document.createElement('button')
  anchor.textContent = 'Anchor'
  anchor.style.cssText = `position: fixed; width: 40px; height: 20px; padding: 0; border: 0; ${anchorStyle}`
  let floating = document.createElement('div')
  floating.popover = 'manual'
  floating.style.cssText = 'width: 200px; height: 100px; padding: 0; border: 0'
  document.body.append(anchor, floating)
  floating.showPopover()
  t.after(() => {
    anchor.remove()
    floating.remove()
  })
  return { anchor, floating }
}

/**
 * Gives the visual viewport the size and offsets a pinch zoom would, and fires
 * its resize event. Browser tests can't zoom the page itself.
 */
function pinchZoom(
  t: TestContext,
  geometry: { width: number; height: number; offsetLeft?: number; offsetTop?: number },
) {
  let viewport = window.visualViewport!
  let values = { offsetLeft: 0, offsetTop: 0, scale: innerWidth / geometry.width, ...geometry }
  for (let [key, value] of Object.entries(values)) {
    Object.defineProperty(viewport, key, { configurable: true, get: () => value })
  }
  t.after(() => {
    for (let key of Object.keys(values)) delete (viewport as unknown as Record<string, unknown>)[key]
  })
  viewport.dispatchEvent(new Event('resize'))
}

function start(
  t: TestContext,
  floating: HTMLElement,
  anchor: Element | { x: number; y: number },
  options: FloatingOptions,
) {
  let cleanup = positionFloating(floating, anchor, options)
  t.after(cleanup)
  return cleanup
}

function box(element: Element) {
  let { left, top, right, bottom } = element.getBoundingClientRect()
  return { left: Math.round(left), top: Math.round(top), right: Math.round(right), bottom: Math.round(bottom) }
}

for (let strategy of ['auto', 'measure'] as const) {
  describe(`positionFloating (${strategy === 'auto' ? 'CSS anchor positioning' : 'measurement fallback'})`, () => {
    it('places the floating element against the anchor and reports the placement', async (t) => {
      let { anchor, floating } = setup(t, 'left: 100px; top: 50px')
      start(t, floating, anchor, { strategy, align: 'start', sideOffset: 4 })
      await nextFrame()

      assert.deepEqual(box(floating), { left: 100, top: 74, right: 300, bottom: 174 })
      assert.equal(floating.dataset.side, 'bottom')
      assert.equal(floating.dataset.align, 'start')
      assert.equal(floating.style.getPropertyValue('--anchor-width'), '40px')
      assert.equal(floating.style.getPropertyValue('--available-height'), `${innerHeight - 5 - 74}px`)
      assert.equal(floating.style.getPropertyValue('--transform-origin'), '20px -4px')
      assert.equal(floating.style.getPropertyValue('--anchor-center-x'), '20px')
    })

    it('sets the anchor size before it measures, so a popup as wide as its anchor lands right at once', (t) => {
      let { anchor, floating } = setup(t, 'left: 100px; top: 50px')
      floating.style.width = 'var(--anchor-width)'
      start(t, floating, anchor, { strategy, align: 'end' })

      // Before any frame, so no observer has corrected it yet.
      assert.deepEqual(box(floating), { left: 100, top: 70, right: 140, bottom: 170 })
    })

    it('flips away from the edges it would cross, side first, then alignment', async (t) => {
      let { anchor, floating } = setup(t, `left: ${innerWidth - 50}px; top: ${innerHeight - 30}px`)
      start(t, floating, anchor, { strategy, align: 'start', collisionPadding: 0 })
      await nextFrame()

      assert.equal(floating.dataset.side, 'top')
      assert.equal(floating.dataset.align, 'end')
      assert.equal(box(floating).bottom, innerHeight - 30)
      assert.equal(box(floating).right, innerWidth - 10)
    })

    it('shifts along the edge when no placement fits', async (t) => {
      let { anchor, floating } = setup(t, 'left: 5px; top: 50px')
      start(t, floating, anchor, { strategy, collisionPadding: 0 })
      await nextFrame()

      assert.equal(floating.dataset.side, 'bottom')
      assert.equal(floating.dataset.align, 'center')
      assert.equal(box(floating).left, 0)
      // The anchor's center, inside the shifted floating element, for an arrow that points at it.
      assert.equal(floating.style.getPropertyValue('--anchor-center-x'), '25px')
    })

    it('mirrors start alignment in right-to-left text', async (t) => {
      let { anchor, floating } = setup(t, 'left: 300px; top: 50px')
      floating.dir = 'rtl'
      start(t, floating, anchor, { strategy, align: 'start' })
      await nextFrame()

      assert.equal(box(floating).right, 340)
    })

    it('places inline sides and alignment in right-to-left text, wherever the anchor is', async (t) => {
      // Firefox's CSS anchor positioning mirrors right-to-left placements to the wrong spot, often still on screen.
      for (let [left, side, align, expected] of [
        [300, 'inline-start', 'center', { left: 340, top: 10 }],
        [300, 'inline-end', 'center', { left: 100, top: 10 }],
        [400, 'bottom', 'start', { left: 240, top: 70 }],
      ] as const) {
        let wrapper = document.createElement('div')
        wrapper.dir = 'rtl'
        document.body.append(wrapper)
        t.after(() => wrapper.remove())
        let { anchor, floating } = setup(t, `left: ${left}px; top: 50px`)
        wrapper.append(anchor, floating)
        floating.showPopover()
        let stop = start(t, floating, anchor, { strategy, side, align })
        await nextFrame()

        assert.deepEqual(
          { left: box(floating).left, top: box(floating).top },
          expected,
          `${side} ${align} at ${left}px`,
        )
        stop()
      }
    })

    it('follows the anchor through nested scroll containers and hides when it scrolls away', async (t) => {
      let outer = document.createElement('div')
      outer.style.cssText = 'position: fixed; left: 0; top: 0; width: 300px; height: 150px; overflow: auto'
      let inner = document.createElement('div')
      inner.style.cssText = 'margin-top: 40px; height: 100px; overflow: auto'
      let anchor = document.createElement('button')
      anchor.style.cssText = 'display: block; margin-top: 20px; width: 40px; height: 20px; padding: 0; border: 0'
      inner.append(anchor, Object.assign(document.createElement('div'), { style: 'height: 400px' }))
      outer.append(inner, Object.assign(document.createElement('div'), { style: 'height: 400px' }))
      let floating = document.createElement('div')
      floating.popover = 'manual'
      floating.style.cssText = 'width: 100px; height: 50px; padding: 0; border: 0'
      document.body.append(outer, floating)
      floating.showPopover()
      t.after(() => {
        outer.remove()
        floating.remove()
      })
      start(t, floating, anchor, { strategy, align: 'start' })
      await nextFrame()
      assert.equal(box(floating).top, 80)

      inner.scrollTop = 10
      outer.scrollTop = 5
      await nextFrame()
      assert.equal(box(floating).top, 65)
      assert.equal(floating.hasAttribute('data-anchor-hidden'), false)

      inner.scrollTop = 60
      await nextFrame()
      assert.equal(floating.hasAttribute('data-anchor-hidden'), true)
      assert.equal(getComputedStyle(floating).visibility, 'hidden')

      inner.scrollTop = 0
      await nextFrame()
      assert.equal(floating.hasAttribute('data-anchor-hidden'), false)
      assert.equal(getComputedStyle(floating).visibility, 'visible')
    })

    it('repositions when the window resizes and the anchor changes size', async (t) => {
      let frame = window.frameElement as HTMLIFrameElement
      let width = frame.width
      t.after(() => {
        frame.width = width
      })
      let { anchor, floating } = setup(t, 'right: 10px; top: 50px')
      start(t, floating, anchor, { strategy, align: 'end' })
      await nextFrame()
      assert.equal(box(floating).right, innerWidth - 10)

      frame.width = String(innerWidth - 100)
      await nextFrame()
      await nextFrame()
      assert.equal(box(floating).right, innerWidth - 10)

      anchor.style.width = '60px'
      await nextFrame()
      await nextFrame()
      assert.equal(floating.style.getPropertyValue('--anchor-width'), '60px')
    })

    it('keeps the collision padding when it shifts and when it flips', async (t) => {
      let shifted = setup(t, 'left: 0; top: 50px')
      start(t, shifted.floating, shifted.anchor, { strategy, collisionPadding: 8 })
      // 110px stay below the anchor: enough for the 4px gap and 100px popup, but not the 8px padding too.
      let flipped = setup(t, `left: 300px; top: ${innerHeight - 130}px`)
      start(t, flipped.floating, flipped.anchor, { strategy, sideOffset: 4, collisionPadding: 8 })
      await nextFrame()

      assert.equal(box(shifted.floating).left, 8)
      assert.equal(flipped.floating.dataset.side, 'top')
      assert.equal(box(flipped.floating).bottom, innerHeight - 134)
    })

    it('stays inside a boundary element', async (t) => {
      let boundary = document.createElement('div')
      boundary.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 300px'
      document.body.append(boundary)
      t.after(() => boundary.remove())
      let { anchor, floating } = setup(t, 'left: 300px; top: 220px')
      start(t, floating, anchor, { strategy, boundary, align: 'start', collisionPadding: 0 })
      await nextFrame()

      assert.deepEqual(box(floating), { left: 140, top: 120, right: 340, bottom: 220 })
      assert.equal(floating.dataset.side, 'top')
      assert.equal(floating.dataset.align, 'end')
    })

    it('follows a boundary element that changes size', async (t) => {
      let boundary = document.createElement('div')
      boundary.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 300px'
      document.body.append(boundary)
      t.after(() => boundary.remove())
      let { anchor, floating } = setup(t, 'left: 300px; top: 220px')
      start(t, floating, anchor, { strategy, boundary, align: 'start', collisionPadding: 0 })
      await nextFrame()
      assert.equal(box(floating).right, 340)

      boundary.style.width = '300px'
      await nextFrame()
      await nextFrame()
      assert.equal(box(floating).right, 300)
    })

    it("doesn't shift when shift is false, keeping the requested alignment", async (t) => {
      let { anchor, floating } = setup(t, 'left: 0; top: 100px')
      start(t, floating, anchor, { strategy, shift: false, collisionPadding: 0 })
      await nextFrame()

      assert.equal(box(floating).left, -80)
      assert.equal(floating.dataset.align, 'center')
    })

    it('reports the requested alignment for a shifted popup that may not flip its alignment', async (t) => {
      let edge = setup(t, `left: ${innerWidth - 40}px; top: 100px`)
      start(t, edge.floating, edge.anchor, { strategy, align: 'start', flip: false, collisionPadding: 0 })
      let centered = setup(t, 'left: 0; top: 200px')
      start(t, centered.floating, centered.anchor, { strategy, collisionPadding: 0 })
      await nextFrame()

      assert.deepEqual([box(edge.floating).left, edge.floating.dataset.align], [innerWidth - 200, 'start'])
      assert.deepEqual([box(centered.floating).left, centered.floating.dataset.align], [0, 'center'])
    })

    it('keeps the requested placement when neither shift nor flip is allowed', async (t) => {
      let { anchor, floating } = setup(t, `left: ${innerWidth - 40}px; top: 100px`)
      start(t, floating, anchor, { strategy, align: 'start', shift: false, flip: false, collisionPadding: 0 })
      await nextFrame()

      assert.equal(box(floating).left, innerWidth - 40)
      assert.equal(floating.dataset.side, 'bottom')
      assert.equal(floating.dataset.align, 'start')
    })

    it('stays in the visible part of a pinch-zoomed viewport and follows it as it pans', async (t) => {
      let { anchor, floating } = setup(t, 'left: 350px; top: 100px')
      start(t, floating, anchor, { strategy, collisionPadding: 0 })
      await nextFrame()
      assert.equal(box(floating).right, 470)

      pinchZoom(t, { width: 400, height: 300 })
      await nextFrame()
      assert.deepEqual(box(floating), { left: 200, top: 120, right: 400, bottom: 220 })

      pinchZoom(t, { width: 400, height: 300, offsetLeft: 200 })
      await nextFrame()
      assert.equal(box(floating).left, 270)

      pinchZoom(t, { width: 400, height: 300, offsetLeft: 400 })
      await nextFrame()
      assert.equal(floating.hasAttribute('data-anchor-hidden'), true, 'the anchor left the visible part')
    })

    it('marks a detached anchor hidden', async (t) => {
      let { anchor, floating } = setup(t, 'left: 100px; top: 50px')
      floating.style.visibility = 'visible'
      start(t, floating, anchor, { strategy })
      await nextFrame()
      assert.equal(floating.style.visibility, 'visible')

      anchor.remove()
      await nextFrame()
      await nextFrame()
      assert.equal(floating.hasAttribute('data-anchor-hidden'), true)
      assert.equal(getComputedStyle(floating).visibility, 'hidden')
    })

    it('restores every style and attribute and stops listening on cleanup', async (t) => {
      let { anchor, floating } = setup(t, 'left: 100px; top: 50px; anchor-name: --mine')
      floating.style.setProperty('margin', '3px', 'important')
      floating.style.color = 'red'
      let anchorStyle = anchor.getAttribute('style')
      let floatingStyle = floating.getAttribute('style')
      let disconnect = t.mock.method(ResizeObserver.prototype, 'disconnect')

      let cleanup = start(t, floating, anchor, { strategy })
      await nextFrame()
      assert.notEqual(floating.getAttribute('style'), floatingStyle)
      cleanup()

      assert.equal(anchor.getAttribute('style'), anchorStyle)
      assert.equal(floating.getAttribute('style'), floatingStyle)
      assert.equal(floating.hasAttribute('data-side'), false)
      assert.equal(disconnect.mock.calls.length, 1)

      anchor.style.left = '200px'
      dispatchEvent(new Event('resize'))
      await nextFrame()
      assert.equal(floating.getAttribute('style'), floatingStyle)
    })
  })
}

describe('positionFloating strategy', () => {
  it('uses CSS anchor positioning for anchor elements where the browser supports it', async (t) => {
    let { anchor, floating } = setup(t, 'left: 100px; top: 50px')
    start(t, floating, anchor, { side: 'right', align: 'end' })

    assert.match(anchor.style.getPropertyValue('anchor-name'), /^--remixcn-anchor-\d+$/)
    assert.equal(floating.style.getPropertyValue('position-anchor'), anchor.style.getPropertyValue('anchor-name'))
    assert.equal(floating.style.getPropertyValue('position-area'), 'right span-top')
    assert.equal(
      floating.style.getPropertyValue('position-try-fallbacks'),
      'flip-inline, flip-block, flip-inline flip-block',
    )
    assert.equal(floating.style.getPropertyValue('top'), 'auto')
  })

  it('keeps the browser placement while it fits the padded bounds, and measures where it cannot', async (t) => {
    let padded = setup(t, 'left: 0; top: 50px')
    start(t, padded.floating, padded.anchor, { collisionPadding: 8 })
    let boundary = document.createElement('div')
    boundary.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px; height: 300px'
    document.body.append(boundary)
    t.after(() => boundary.remove())
    let bounded = setup(t, 'left: 300px; top: 220px')
    start(t, bounded.floating, bounded.anchor, { boundary, align: 'start' })
    let unshifted = setup(t, 'left: 500px; top: 100px')
    start(t, unshifted.floating, unshifted.anchor, { shift: false, align: 'end', sideOffset: 3 })
    await nextFrame()

    assert.equal(padded.floating.style.getPropertyValue('position-area'), 'bottom')
    assert.equal(padded.floating.style.getPropertyValue('margin-left'), '8px')
    assert.equal(box(padded.floating).left, 8)
    assert.equal(bounded.floating.style.getPropertyValue('position-area'), 'none')
    assert.equal(bounded.floating.style.getPropertyValue('top'), '120px')
    assert.notEqual(unshifted.floating.style.getPropertyValue('position-area'), 'none')
    assert.deepEqual(box(unshifted.floating), { left: 340, top: 123, right: 540, bottom: 223 })
  })

  it('falls back to measuring where CSS anchor positioning is missing', async (t) => {
    t.mock.method(CSS, 'supports', () => false)
    let { anchor, floating } = setup(t, 'left: 100px; top: 50px')
    start(t, floating, anchor, { align: 'start' })

    assert.equal(anchor.style.getPropertyValue('anchor-name'), '')
    assert.equal(floating.style.getPropertyValue('top'), '70px')
    assert.equal(floating.style.getPropertyValue('left'), '100px')
  })

  it('anchors to pointer coordinates', async (t) => {
    let { floating } = setup(t, 'left: 0; top: 0')
    start(t, floating, { x: 120, y: 60 }, { align: 'start' })
    await nextFrame()

    assert.deepEqual(box(floating), { left: 120, top: 60, right: 320, bottom: 160 })
  })
})

describe('anchorPosition', () => {
  function Popup(handle: Handle<{ open: boolean; side: 'top' | 'bottom' }>) {
    let trigger: HTMLElement | null = null
    return () => (
      <div>
        <button
          type="button"
          style={{ position: 'fixed', left: '100px', top: '150px', width: '40px', height: '20px' }}
          mix={ref((node) => (trigger = node as HTMLElement))}
        >
          Open
        </button>
        <div
          popover="manual"
          style={{ width: '100px', height: '50px', padding: 0, border: 0 }}
          mix={anchorPosition({
            anchor: () => trigger,
            open: handle.props.open,
            side: handle.props.side,
            align: 'start',
          })}
        />
      </div>
    )
  }

  it('positions while open, restarts on option changes and cleans up when closed or removed', async (t) => {
    let { $, act, root, cleanup } = render(<Popup open side="bottom" />)
    t.after(cleanup)
    let popup = $('[popover]') as HTMLElement
    popup.showPopover()
    await nextFrame()
    assert.deepEqual(box(popup), { left: 100, top: 170, right: 200, bottom: 220 })

    await act(() => root.render(<Popup open side="top" />))
    await nextFrame()
    assert.equal(box(popup).bottom, 150)

    await act(() => root.render(<Popup open={false} side="top" />))
    assert.equal(popup.hasAttribute('data-side'), false)
    assert.equal(popup.style.getPropertyValue('position-anchor'), '')

    await act(() => root.render(<Popup open side="top" />))
    assert.equal(popup.dataset.side, 'top')
    await act(() => root.render(<div />))
    assert.equal(popup.hasAttribute('data-side'), false)
  })
})
