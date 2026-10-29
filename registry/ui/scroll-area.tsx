// RemixCN Scroll Area: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixElement, RemixNode } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// The viewport is a native scroll container, so the keyboard, the wheel,
// touch, focus and scroll chaining work as on any page. Until the browser
// runs the scroll area, and whenever its own scrollbars couldn't reach all
// the content, the native scrollbars stay. Once it runs, it draws thin
// scrollbars for the axes that overflow and hides the native ones, except in
// forced colors, where the system's scrollbars return.
//
// Scrolling changes the thumbs on every frame, so the scroll area writes
// their sizes, its state attributes and its CSS variables straight to the
// DOM instead of rendering again.

export type ScrollBarOrientation = 'vertical' | 'horizontal'

export interface ScrollAreaProps extends Props<'div'> {
  /**
   * The content, and any ScrollBar parts. A ScrollBar child is drawn beside
   * the viewport, not inside it. Without a vertical one, the scroll area
   * draws its own.
   */
  children?: RemixNode
}

export interface ScrollBarProps extends Omit<Props<'div'>, 'children'> {
  /** The axis the scrollbar scrolls. Defaults to vertical. */
  orientation?: ScrollBarOrientation
}

const minThumbSize = 16
const scrollingFor = 500

interface Bar {
  scrollbar: HTMLElement
  thumb: HTMLElement
}

interface AreaApi {
  register(orientation: ScrollBarOrientation, bar: Bar, signal: AbortSignal): void
  pointerDown(orientation: ScrollBarOrientation, event: PointerEvent): void
  wheel(orientation: ScrollBarOrientation, event: WheelEvent): void
}

function ScrollAreaSlot(handle: Handle<{ value: AreaApi; children?: RemixNode }, AreaApi>) {
  return () => {
    handle.context.set(handle.props.value)
    return handle.props.children
  }
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

// Splits the top-level children into the content and the ScrollBar parts.
function partition(children: RemixNode) {
  let content: RemixNode[] = []
  let bars: Partial<Record<ScrollBarOrientation, RemixNode>> = {}

  let visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (isElement(node) && node.type === Fragment) return visit(node.props.children)
    if (isElement(node) && node.type === ScrollBar) {
      let orientation = (node.props as unknown as ScrollBarProps).orientation ?? 'vertical'
      bars[orientation] = node
      return
    }
    content.push(node as RemixNode)
  }

  visit(children)
  return { content, bars }
}

function setFlag(element: Element, name: string, on: boolean) {
  if (on) element.setAttribute(name, '')
  else element.removeAttribute(name)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function paddingAlong(element: HTMLElement, vertical: boolean) {
  let style = getComputedStyle(element)
  let [start, end] = vertical ? [style.paddingTop, style.paddingBottom] : [style.paddingLeft, style.paddingRight]
  return (Number.parseFloat(start) || 0) + (Number.parseFloat(end) || 0)
}

const rootStyles = css({ position: 'relative' })

// Hide the native scrollbars only while the scroll area's own ones cover
// every axis that overflows, and never in forced colors.
const viewportStyles = css(
  mergeStyles(
    {
      width: '100%',
      height: '100%',
      overflow: 'auto',
      borderRadius: 'inherit',
      '@media not (forced-colors: active)': {
        ':where([data-scrollbars="custom"]) > &': { scrollbarWidth: 'none' },
        ':where([data-scrollbars="custom"]) > &::-webkit-scrollbar': { display: 'none' },
      },
    },
    transition('outline-color'),
  ),
)

// fit-content lets the content grow wider than the viewport, so the browser
// reports a new size when it overflows sideways.
const contentStyles = css({ minWidth: 'fit-content' })

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const scrollbarStyles = css(
  mergeStyles(
    {
      position: 'absolute',
      display: 'none',
      padding: '1px',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      borderColor: 'transparent',
      borderStyle: 'solid',
      borderWidth: 0,
      '&[data-orientation="vertical"]': {
        top: 0,
        bottom: 'var(--scroll-area-corner-height, 0px)',
        insetInlineEnd: 0,
        width: space(2.5),
        borderInlineStartWidth: '1px',
      },
      '&[data-orientation="horizontal"]': {
        bottom: 0,
        insetInlineStart: 0,
        insetInlineEnd: 'var(--scroll-area-corner-width, 0px)',
        height: space(2.5),
        flexDirection: 'column',
        borderBlockStartWidth: '1px',
      },
      ':where([data-scrollbars="custom"][data-has-overflow-y]) > &[data-orientation="vertical"]': { display: 'flex' },
      ':where([data-scrollbars="custom"][data-has-overflow-x]) > &[data-orientation="horizontal"]': { display: 'flex' },
      '@media (forced-colors: active)': {
        ':where([data-scrollbars]) > &[data-orientation]': { display: 'none' },
      },
    },
    transition('background-color'),
  ),
)

const thumbStyles = css(
  mergeStyles(
    {
      position: 'relative',
      // Fills the track's thickness; its length comes from the variable below.
      flex: '1 1 0',
      borderRadius: '9999px',
      backgroundColor: 'var(--input)',
      '&[data-orientation="vertical"]': {
        height: 'var(--scroll-area-thumb-height, 0px)',
        transform: 'translateY(var(--scroll-area-thumb-offset, 0px))',
      },
      '&[data-orientation="horizontal"]': {
        width: 'var(--scroll-area-thumb-width, 0px)',
        transform: 'translateX(var(--scroll-area-thumb-offset, 0px))',
      },
      ':where([data-dragging]) > &, :where(:hover) > &': { backgroundColor: 'var(--muted-foreground)' },
    },
    transition('background-color'),
  ),
)

const cornerStyles = css({
  position: 'absolute',
  bottom: 0,
  insetInlineEnd: 0,
  display: 'none',
  width: 'var(--scroll-area-corner-width, 0px)',
  height: 'var(--scroll-area-corner-height, 0px)',
  ':where([data-scrollbars="custom"][data-has-overflow-x][data-has-overflow-y]) > &': { display: 'block' },
  '@media (forced-colors: active)': { ':where([data-scrollbars]) > &': { display: 'none' } },
})

/**
 * A native scroll container with thin scrollbars in shadcn's style. The
 * server renders the content and the native scrollbars. Once the browser runs
 * the scroll area, inside a client entry of the app, its own scrollbars
 * follow the scroll position and take the pointer.
 */
export function ScrollArea(handle: Handle<ScrollAreaProps>) {
  let root: HTMLElement | undefined
  let viewport: HTMLElement | undefined
  let bars = new Map<ScrollBarOrientation, Bar>()
  let enhanced = false
  let scrollingTimer: ReturnType<typeof setTimeout> | undefined
  let drag:
    | {
        orientation: ScrollBarOrientation
        pointerId: number
        origin: number
        start: number
        thumb: HTMLElement
        done: AbortController
        snap: string
      }
    | undefined

  handle.signal.addEventListener('abort', () => {
    clearTimeout(scrollingTimer)
    drag?.done.abort()
  })

  function rtl() {
    return viewport ? getComputedStyle(viewport).direction === 'rtl' : false
  }

  // The track a thumb moves along, and the pixels of scroll one pixel of thumb travel stands for.
  function travel(orientation: ScrollBarOrientation) {
    let bar = bars.get(orientation)
    if (!bar || !viewport) return undefined

    let vertical = orientation === 'vertical'
    let track =
      (vertical ? bar.scrollbar.clientHeight : bar.scrollbar.clientWidth) - paddingAlong(bar.scrollbar, vertical)
    let thumb = vertical ? bar.thumb.offsetHeight : bar.thumb.offsetWidth
    let scrollable = vertical
      ? viewport.scrollHeight - viewport.clientHeight
      : viewport.scrollWidth - viewport.clientWidth
    let room = track - thumb

    return { bar, track, thumb, ratio: room > 0 ? scrollable / room : 0, scrollable }
  }

  function sync() {
    if (!root || !viewport || !enhanced) return

    let { scrollWidth, scrollHeight, clientWidth, clientHeight, scrollLeft, scrollTop } = viewport
    let overflowX = scrollWidth > clientWidth
    let overflowY = scrollHeight > clientHeight
    let maxX = Math.max(0, scrollWidth - clientWidth)
    let maxY = Math.max(0, scrollHeight - clientHeight)
    let mirrored = rtl()
    let fromStartX = clamp(mirrored ? -scrollLeft : scrollLeft, 0, maxX)
    let fromStartY = clamp(scrollTop, 0, maxY)
    let custom = (!overflowX || bars.has('horizontal')) && (!overflowY || bars.has('vertical'))

    root.setAttribute('data-scrollbars', custom ? 'custom' : 'native')
    setFlag(root, 'data-has-overflow-x', overflowX)
    setFlag(root, 'data-has-overflow-y', overflowY)
    setFlag(root, 'data-overflow-x-start', fromStartX > 0)
    setFlag(root, 'data-overflow-x-end', maxX - fromStartX > 0)
    setFlag(root, 'data-overflow-y-start', fromStartY > 0)
    setFlag(root, 'data-overflow-y-end', maxY - fromStartY > 0)

    viewport.style.setProperty('--scroll-area-overflow-x-start', `${fromStartX}px`)
    viewport.style.setProperty('--scroll-area-overflow-x-end', `${maxX - fromStartX}px`)
    viewport.style.setProperty('--scroll-area-overflow-y-start', `${fromStartY}px`)
    viewport.style.setProperty('--scroll-area-overflow-y-end', `${maxY - fromStartY}px`)
    // Keep a viewport with nothing to scroll out of the tab order.
    viewport.tabIndex = overflowX || overflowY ? 0 : -1

    let vertical = bars.get('vertical')
    let horizontal = bars.get('horizontal')
    let corner = custom && overflowX && overflowY
    root.style.setProperty(
      '--scroll-area-corner-width',
      corner && vertical ? `${vertical.scrollbar.offsetWidth}px` : '0px',
    )
    root.style.setProperty(
      '--scroll-area-corner-height',
      corner && horizontal ? `${horizontal.scrollbar.offsetHeight}px` : '0px',
    )

    for (let [orientation, bar] of bars) {
      let isVertical = orientation === 'vertical'
      let track =
        (isVertical ? bar.scrollbar.clientHeight : bar.scrollbar.clientWidth) - paddingAlong(bar.scrollbar, isVertical)
      let visible = isVertical ? clientHeight : clientWidth
      let total = isVertical ? scrollHeight : scrollWidth
      let max = isVertical ? maxY : maxX
      let fromStart = isVertical ? fromStartY : fromStartX
      let size = total > 0 ? Math.min(track, Math.max(minThumbSize, (track * visible) / total)) : track
      let offset = max > 0 ? ((track - size) * fromStart) / max : 0

      bar.thumb.style.setProperty(
        isVertical ? '--scroll-area-thumb-height' : '--scroll-area-thumb-width',
        `${Math.max(0, size)}px`,
      )
      bar.thumb.style.setProperty('--scroll-area-thumb-offset', `${!isVertical && mirrored ? -offset : offset}px`)
    }
  }

  function markScrolling() {
    if (!root) return
    setFlag(root, 'data-scrolling', true)
    for (let bar of bars.values()) setFlag(bar.scrollbar, 'data-scrolling', true)
    clearTimeout(scrollingTimer)
    scrollingTimer = setTimeout(() => {
      if (root) setFlag(root, 'data-scrolling', false)
      for (let bar of bars.values()) setFlag(bar.scrollbar, 'data-scrolling', false)
    }, scrollingFor)
  }

  function setHovering(hovering: boolean) {
    if (root) setFlag(root, 'data-hovering', hovering)
    for (let bar of bars.values()) setFlag(bar.scrollbar, 'data-hovering', hovering)
  }

  function endDrag() {
    if (!drag) return
    let { thumb, pointerId, done, snap } = drag
    drag = undefined
    done.abort()
    thumb.parentElement?.removeAttribute('data-dragging')
    // Snapping returns, and the viewport settles on the nearest snap point.
    if (viewport) viewport.style.scrollSnapType = snap
    if (thumb.hasPointerCapture(pointerId)) thumb.releasePointerCapture(pointerId)
  }

  let api: AreaApi = {
    register(orientation, bar, signal) {
      bars.set(orientation, bar)
      // A scrollbar that comes or goes after the first render changes which scrollbars show.
      queueMicrotask(sync)
      signal.addEventListener('abort', () => {
        // A scrollbar removed in the middle of a drag takes the drag with it.
        if (drag?.thumb === bar.thumb) endDrag()
        if (bars.get(orientation) !== bar) return
        bars.delete(orientation)
        queueMicrotask(sync)
      })
    },

    pointerDown(orientation, event) {
      if (event.defaultPrevented || event.button !== 0 || drag || !viewport) return
      let measured = travel(orientation)
      if (!measured) return

      let { bar, track, thumb, ratio, scrollable } = measured
      let vertical = orientation === 'vertical'
      let point = vertical ? event.clientY : event.clientX
      // Scroll snapping would make the thumb jump between snap points, as native scrollbars don't.
      let snap = viewport.style.scrollSnapType
      viewport.style.scrollSnapType = 'none'
      // A press on the track first jumps so the thumb's middle sits under the pointer.
      if (!bar.thumb.contains(event.target as Node) && track - thumb > 0) {
        let box = bar.scrollbar.getBoundingClientRect()
        let padding = paddingAlong(bar.scrollbar, vertical) / 2
        let position = point - (vertical ? box.top : box.left) - padding - thumb / 2
        let fraction = clamp(position / (track - thumb), 0, 1)
        if (vertical) viewport.scrollTop = fraction * scrollable
        else viewport.scrollLeft = rtl() ? -(1 - fraction) * scrollable : fraction * scrollable
        sync()
      }

      event.preventDefault()
      let done = new AbortController()
      drag = {
        orientation,
        pointerId: event.pointerId,
        origin: point,
        start: vertical ? viewport.scrollTop : viewport.scrollLeft,
        thumb: bar.thumb,
        done,
        snap,
      }
      bar.scrollbar.setAttribute('data-dragging', '')
      try {
        bar.thumb.setPointerCapture(event.pointerId)
      } catch {}

      let options = { signal: done.signal }
      let document = bar.thumb.ownerDocument
      document.addEventListener(
        'pointermove',
        (move) => {
          if (!drag || !viewport || move.pointerId !== drag.pointerId) return
          let delta = ((vertical ? move.clientY : move.clientX) - drag.origin) * ratio
          if (vertical) viewport.scrollTop = drag.start + delta
          else viewport.scrollLeft = drag.start + delta
          markScrolling()
        },
        options,
      )
      let finish = (end: PointerEvent) => {
        if (drag && end.pointerId === drag.pointerId) endDrag()
      }
      document.addEventListener('pointerup', finish, options)
      document.addEventListener('pointercancel', finish, options)
      bar.thumb.addEventListener('lostpointercapture', finish, options)
    },

    // The scrollbar sits beside the viewport, so a wheel over it scrolls the
    // viewport here. At an edge the event goes on, and the page scrolls.
    wheel(orientation, event) {
      if (!viewport || event.ctrlKey) return
      let vertical = orientation === 'vertical'
      let delta = vertical ? event.deltaY : event.deltaX || event.deltaY
      if (delta === 0) return

      let max = vertical ? viewport.scrollHeight - viewport.clientHeight : viewport.scrollWidth - viewport.clientWidth
      let mirrored = !vertical && rtl()
      let min = mirrored ? -max : 0
      let top = mirrored ? 0 : max
      let value = vertical ? viewport.scrollTop : viewport.scrollLeft
      if ((value <= min && delta < 0) || (value >= top && delta > 0)) return

      event.preventDefault()
      let next = clamp(value + delta, min, top)
      if (vertical) viewport.scrollTop = next
      else viewport.scrollLeft = next
    },
  }

  return () => {
    let { children, mix, 'aria-label': label, 'aria-labelledby': labelledBy, ...props } = handle.props
    let { content, bars: parts } = partition(children)

    if (!enhanced) {
      handle.queueTask(() => {
        enhanced = true
        sync()
      })
    }

    return (
      <div
        {...props}
        data-slot="scroll-area"
        mix={[
          rootStyles,
          ref<HTMLDivElement>((node, signal) => {
            root = node
            signal.addEventListener('abort', () => {
              if (root === node) root = undefined
            })
          }),
          on<HTMLDivElement, 'pointerenter'>('pointerenter', (event) => {
            if (event.pointerType !== 'touch') setHovering(true)
          }),
          on<HTMLDivElement, 'pointerleave'>('pointerleave', () => setHovering(false)),
          mix,
        ]}
      >
        <div
          data-slot="scroll-area-viewport"
          tabIndex={0}
          role={label || labelledBy ? 'region' : undefined}
          aria-label={label}
          aria-labelledby={labelledBy}
          mix={[
            viewportStyles,
            ref<HTMLDivElement>((node, signal) => {
              viewport = node
              let observer = new ResizeObserver(() => sync())
              observer.observe(node)
              if (node.firstElementChild) observer.observe(node.firstElementChild)
              signal.addEventListener('abort', () => {
                observer.disconnect()
                if (viewport === node) viewport = undefined
              })
            }),
            on<HTMLDivElement, 'scroll'>('scroll', () => {
              sync()
              markScrolling()
            }),
          ]}
        >
          <div data-slot="scroll-area-content" mix={contentStyles}>
            {content}
          </div>
        </div>
        <ScrollAreaSlot value={api}>{parts.vertical ?? <ScrollBar />}</ScrollAreaSlot>
        {parts.horizontal ? <ScrollAreaSlot value={api}>{parts.horizontal}</ScrollAreaSlot> : null}
        <div data-slot="scroll-area-corner" aria-hidden="true" mix={cornerStyles} />
      </div>
    )
  }
}

/**
 * A scrollbar of a ScrollArea, as its direct child. It is decorative for
 * assistive technology, which scrolls the viewport itself. Drag its thumb,
 * press its track to jump there, or turn the wheel over it.
 */
export function ScrollBar(handle: Handle<ScrollBarProps>) {
  let thumb: HTMLElement | undefined

  return () => {
    let area = handle.context.get(ScrollAreaSlot) as AreaApi | undefined
    if (!area) throw new Error('ScrollBar must be a direct child of a ScrollArea.')

    let { orientation = 'vertical', mix, ...props } = handle.props

    return (
      <div
        {...props}
        data-slot="scroll-area-scrollbar"
        data-orientation={orientation}
        aria-hidden="true"
        mix={[
          scrollbarStyles,
          ref<HTMLDivElement>((node, signal) => {
            let found = node.querySelector<HTMLElement>('[data-slot="scroll-area-thumb"]') ?? thumb
            if (found) area.register(orientation, { scrollbar: node, thumb: found }, signal)
          }),
          // The caller's handlers run first, so they can cancel a press.
          mix,
          on<HTMLDivElement, 'pointerdown'>('pointerdown', (event) => area.pointerDown(orientation, event)),
          // Like native scrollbars, pressing one never moves focus.
          on<HTMLDivElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
          on<HTMLDivElement, 'wheel'>('wheel', (event) => area.wheel(orientation, event)),
        ]}
      >
        <div
          data-slot="scroll-area-thumb"
          data-orientation={orientation}
          mix={[
            thumbStyles,
            ref<HTMLDivElement>((node) => {
              thumb = node
            }),
          ]}
        />
      </div>
    )
  }
}
