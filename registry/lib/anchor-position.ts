// RemixCN Anchor positioning: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS) and Remix (MIT, Copyright (c) 2025 Shopify Inc.).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

// Places a floating element, such as a popover, menu or tooltip, next to an
// anchor element or a pointer position, inside the visible part of the page
// minus the collision padding. Where the browser supports CSS anchor
// positioning, the browser places, flips and shifts the element and keeps it
// attached while the page scrolls. A measurement fallback computes the same
// placement for pointer positions, for browsers without CSS anchor
// positioning, and whenever the browser's placement leaves those bounds: the
// browser knows neither a boundary element nor a pinch-zoomed viewport.
//
// The floating element gets the resolved `data-side` and `data-align`,
// `data-anchor-hidden` while its anchor is detached or scrolled out of view,
// and the CSS variables `--anchor-width`, `--anchor-height`,
// `--available-width`, `--available-height` and `--transform-origin`.

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'
export type PhysicalSide = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'
export type Direction = 'ltr' | 'rtl'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Viewport coordinates to anchor to instead of an element, such as a pointer's `clientX` and `clientY`. */
export interface AnchorPoint {
  x: number
  y: number
  width?: number
  height?: number
}

export interface PlacementOptions {
  /** The side of the anchor to place on (defaults to `'bottom'`). */
  side?: Side
  /** How to align along that side (defaults to `'center'`). */
  align?: Align
  /** Gap between anchor and floating element, in pixels (defaults to `0`). */
  sideOffset?: number
  /** Shift along the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /** Space to keep from the boundary edges, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** Whether to flip to the opposite side when the preferred one overflows (defaults to `true`). */
  flip?: boolean
  /** Whether to shift along the edge to stay inside the boundary (defaults to `true`). */
  shift?: boolean
  /** Text direction for start, end and inline sides (defaults to the floating element's computed direction). */
  dir?: Direction
}

export interface Position {
  x: number
  y: number
  side: PhysicalSide
  align: Align
  availableWidth: number
  availableHeight: number
}

const opposite: Record<PhysicalSide, PhysicalSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

function resolveSide(side: Side, dir: Direction): PhysicalSide {
  if (side === 'inline-start') return dir === 'rtl' ? 'right' : 'left'
  if (side === 'inline-end') return dir === 'rtl' ? 'left' : 'right'
  return side
}

function isVertical(side: PhysicalSide) {
  return side === 'top' || side === 'bottom'
}

function alignOn(start: number, size: number, floatingSize: number, align: Align, reverse: boolean) {
  if (align === 'center') return start + (size - floatingSize) / 2
  let atStart = (align === 'start') !== reverse
  return atStart ? start : start + size - floatingSize
}

function coordinates(anchor: Rect, floating: Pick<Rect, 'width' | 'height'>, side: PhysicalSide, options: Required<PlacementOptions>) {
  let { align, sideOffset, alignOffset, dir } = options
  let rtl = dir === 'rtl'
  // A positive align offset moves away from the aligned edge, mirrored in right-to-left text.
  let crossOffset = (align === 'end' ? -alignOffset : alignOffset) * (rtl && isVertical(side) ? -1 : 1)

  if (isVertical(side)) {
    return {
      x: alignOn(anchor.x, anchor.width, floating.width, align, rtl) + crossOffset,
      y: side === 'bottom' ? anchor.y + anchor.height + sideOffset : anchor.y - sideOffset - floating.height,
    }
  }
  return {
    x: side === 'right' ? anchor.x + anchor.width + sideOffset : anchor.x - sideOffset - floating.width,
    y: alignOn(anchor.y, anchor.height, floating.height, align, false) + crossOffset,
  }
}

function mainOverflow(position: { x: number; y: number }, floating: Pick<Rect, 'width' | 'height'>, side: PhysicalSide, bounds: Rect) {
  if (side === 'bottom') return position.y + floating.height - (bounds.y + bounds.height)
  if (side === 'top') return bounds.y - position.y
  if (side === 'right') return position.x + floating.width - (bounds.x + bounds.width)
  return bounds.x - position.x
}

function crossOverflow(position: { x: number; y: number }, floating: Pick<Rect, 'width' | 'height'>, side: PhysicalSide, bounds: Rect) {
  if (isVertical(side)) return Math.max(bounds.x - position.x, position.x + floating.width - (bounds.x + bounds.width))
  return Math.max(bounds.y - position.y, position.y + floating.height - (bounds.y + bounds.height))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

/**
 * Computes where a floating element of the given size goes next to an anchor
 * rectangle inside a boundary, in viewport coordinates. It flips to the opposite
 * side when that overflows less, and shifts along the edge to stay inside the
 * boundary minus `collisionPadding`.
 */
export function computePosition(
  anchor: Rect,
  floating: Pick<Rect, 'width' | 'height'>,
  boundary: Rect,
  options: PlacementOptions = {},
): Position {
  let resolved: Required<PlacementOptions> = {
    side: 'bottom',
    align: 'center',
    sideOffset: 0,
    alignOffset: 0,
    collisionPadding: 5,
    flip: true,
    shift: true,
    dir: 'ltr',
    ...options,
  }
  let padding = resolved.collisionPadding
  let bounds = {
    x: boundary.x + padding,
    y: boundary.y + padding,
    width: Math.max(boundary.width - 2 * padding, 0),
    height: Math.max(boundary.height - 2 * padding, 0),
  }

  let side = resolveSide(resolved.side, resolved.dir)
  let align = resolved.align
  let place = (candidate: [PhysicalSide, Align]) => coordinates(anchor, floating, candidate[0], { ...resolved, align: candidate[1] })

  // Like CSS position-try-fallbacks: the preferred placement, the opposite
  // side, then the other alignment on each side. The first that fits wins.
  let candidates: Array<[PhysicalSide, Align]> = [[side, align]]
  if (resolved.flip) {
    candidates.push([opposite[side], align])
    if (align !== 'center') {
      let flipped: Align = align === 'start' ? 'end' : 'start'
      candidates.push([side, flipped], [opposite[side], flipped])
    }
  }
  let fitting = candidates.find((candidate) => {
    let position = place(candidate)
    return mainOverflow(position, floating, candidate[0], bounds) <= 0 && crossOverflow(position, floating, candidate[0], bounds) <= 0
  })

  if (fitting) [side, align] = fitting
  else if (resolved.flip && mainOverflow(place([opposite[side], align]), floating, opposite[side], bounds) < mainOverflow(place([side, align]), floating, side, bounds)) {
    side = opposite[side]
  }

  let position = place([side, align])
  if (resolved.shift) {
    if (isVertical(side)) position.x = clamp(position.x, bounds.x, bounds.x + bounds.width - floating.width)
    else position.y = clamp(position.y, bounds.y, bounds.y + bounds.height - floating.height)
  }

  let { sideOffset } = resolved
  let availableHeight = bounds.height
  let availableWidth = bounds.width
  if (side === 'bottom') availableHeight = bounds.y + bounds.height - (anchor.y + anchor.height + sideOffset)
  if (side === 'top') availableHeight = anchor.y - sideOffset - bounds.y
  if (side === 'right') availableWidth = bounds.x + bounds.width - (anchor.x + anchor.width + sideOffset)
  if (side === 'left') availableWidth = anchor.x - sideOffset - bounds.x

  return {
    ...position,
    side,
    align,
    availableWidth: Math.max(availableWidth, 0),
    availableHeight: Math.max(availableHeight, 0),
  }
}

export interface FloatingOptions extends PlacementOptions {
  /** An element whose box also limits where the floating element may go, besides the viewport. */
  boundary?: Element | null
  /** `'auto'` uses CSS anchor positioning where supported, while its placement fits; `'measure'` always uses the measurement fallback (defaults to `'auto'`). */
  strategy?: 'auto' | 'measure'
}

/** Whether the browser supports the CSS anchor positioning features this helper uses. */
export function supportsCssAnchorPositioning(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    CSS.supports('anchor-name', '--remixcn') &&
    CSS.supports('position-area', 'bottom span-right') &&
    CSS.supports('position-try-fallbacks', 'flip-block')
  )
}

/** Records the inline styles and attributes it changes so they can be put back. */
function createRestorer(element: HTMLElement) {
  let styles = new Map<string, [value: string, priority: string]>()
  let attributes = new Map<string, string | null>()

  return {
    style(property: string, value: string) {
      if (!styles.has(property)) {
        styles.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
      }
      if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value)
    },
    /** Puts one style back as it was before. */
    reset(property: string) {
      let saved = styles.get(property)
      if (!saved) return
      styles.delete(property)
      if (saved[0]) element.style.setProperty(property, saved[0], saved[1])
      else element.style.removeProperty(property)
    },
    attribute(name: string, value: string | null) {
      if (!attributes.has(name)) attributes.set(name, element.getAttribute(name))
      if (value === null) element.removeAttribute(name)
      else if (element.getAttribute(name) !== value) element.setAttribute(name, value)
    },
    restore() {
      for (let [property, [value, priority]] of styles) {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      }
      for (let [name, value] of attributes) {
        if (value === null) element.removeAttribute(name)
        else element.setAttribute(name, value)
      }
      styles.clear()
      attributes.clear()
    },
  }
}

function intersect(a: Rect, b: Rect): Rect {
  let x = Math.max(a.x, b.x)
  let y = Math.max(a.y, b.y)
  let right = Math.min(a.x + a.width, b.x + b.width)
  let bottom = Math.min(a.y + a.height, b.y + b.height)
  return { x, y, width: Math.max(right - x, 0), height: Math.max(bottom - y, 0) }
}

const tolerance = 1

/** The visible part of the page, in the layout viewport's coordinates: smaller and offset while pinch-zoomed. */
function getViewport(document: Document): Rect {
  let visual = document.defaultView?.visualViewport
  if (visual) return { x: visual.offsetLeft, y: visual.offsetTop, width: visual.width, height: visual.height }
  let root = document.documentElement
  return { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight }
}

function contains(outer: Rect, inner: DOMRect) {
  return (
    inner.left >= outer.x - tolerance &&
    inner.top >= outer.y - tolerance &&
    inner.right <= outer.x + outer.width + tolerance &&
    inner.bottom <= outer.y + outer.height + tolerance
  )
}

function clipsOverflow(element: Element) {
  let { overflowX, overflowY } = getComputedStyle(element)
  return overflowX !== 'visible' || overflowY !== 'visible'
}

/** Whether any part of the anchor shows inside the viewport and every scroll container around it. */
function isAnchorVisible(anchor: Element, rect: Rect) {
  if (!anchor.isConnected || (rect.width === 0 && rect.height === 0 && !anchor.getClientRects().length)) return false

  let visible = getViewport(anchor.ownerDocument)
  for (let parent = anchor.parentElement; parent && parent !== anchor.ownerDocument.documentElement; parent = parent.parentElement) {
    if (clipsOverflow(parent)) visible = intersect(visible, parent.getBoundingClientRect())
  }

  let shown = intersect(visible, rect)
  return rect.width === 0 || rect.height === 0
    ? rect.x >= visible.x && rect.x <= visible.x + visible.width && rect.y >= visible.y && rect.y <= visible.y + visible.height
    : shown.width > 0 && shown.height > 0
}

/** Reads which side of the anchor the browser placed the element on. */
function readSide(floating: DOMRect, anchor: Rect, fallback: PhysicalSide): PhysicalSide {
  if (floating.top >= anchor.y + anchor.height - tolerance) return 'bottom'
  if (floating.bottom <= anchor.y + tolerance) return 'top'
  if (floating.left >= anchor.x + anchor.width - tolerance) return 'right'
  if (floating.right <= anchor.x + tolerance) return 'left'
  return fallback
}

/** Reads which anchor edge the browser aligned the element with; a shifted element keeps the requested alignment. */
function readAlign(floating: DOMRect, anchor: Rect, side: PhysicalSide, dir: Direction, fallback: Align): Align {
  let [start, end, size, anchorStart, anchorSize] = isVertical(side)
    ? [floating.left, floating.right, floating.width, anchor.x, anchor.width]
    : [floating.top, floating.bottom, floating.height, anchor.y, anchor.height]
  let atStart = Math.abs(start - anchorStart) <= tolerance
  let atEnd = Math.abs(end - (anchorStart + anchorSize)) <= tolerance
  if (atStart === atEnd) {
    return Math.abs(start + size / 2 - (anchorStart + anchorSize / 2)) <= tolerance ? 'center' : fallback
  }
  let reverse = isVertical(side) && dir === 'rtl'
  return atStart !== reverse ? 'start' : 'end'
}

function getPositionArea(side: PhysicalSide, align: Align, dir: Direction) {
  if (align === 'center') return side
  if (isVertical(side)) {
    let towardRight = (align === 'start') !== (dir === 'rtl')
    return `${side} span-${towardRight ? 'right' : 'left'}`
  }
  return `${side} span-${align === 'start' ? 'bottom' : 'top'}`
}

/** The same order computePosition tries: the opposite side, then the other alignment on each side. */
function getTryFallbacks(side: PhysicalSide, align: Align) {
  let [sideFlip, alignFlip] = isVertical(side) ? ['flip-block', 'flip-inline'] : ['flip-inline', 'flip-block']
  return align === 'center' ? sideFlip : `${sideFlip}, ${alignFlip}, ${sideFlip} ${alignFlip}`
}

const edges = ['top', 'right', 'bottom', 'left'] as const

/**
 * Margins for the browser's placement: the side offset toward the anchor, the
 * align offset on the aligned edge, and the collision padding on the outer
 * edges. The browser keeps the margin box inside the viewport when it flips
 * and shifts, and mirrors the margins with the placement.
 */
function getCssMargins(side: PhysicalSide, options: Required<PlacementOptions>): Record<PhysicalSide, number> {
  let { align, sideOffset, alignOffset, collisionPadding: padding, dir } = options
  let margins = { top: 0, right: 0, bottom: 0, left: 0 }
  margins[opposite[side]] = sideOffset
  margins[side] = padding

  let [startEdge, endEdge]: PhysicalSide[] = isVertical(side) ? (dir === 'rtl' ? ['right', 'left'] : ['left', 'right']) : ['top', 'bottom']
  if (align === 'start') {
    margins[startEdge] = alignOffset
    margins[endEdge] = padding
  } else if (align === 'end') {
    margins[startEdge] = padding
    margins[endEdge] = alignOffset
  } else {
    // Unequal margins move a centered box by half their difference.
    margins[startEdge] = padding + alignOffset
    margins[endEdge] = padding - alignOffset
  }
  return margins
}

let anchorCount = 0

/**
 * Positions `floating` against an anchor element or point and keeps it there
 * through scrolling, resizing and zooming until the returned cleanup runs. The
 * cleanup disconnects every observer and listener and restores the inline
 * styles and attributes this helper changed on both elements.
 */
export function positionFloating(
  floating: HTMLElement,
  anchor: Element | AnchorPoint,
  options: FloatingOptions = {},
): () => void {
  let document = floating.ownerDocument
  let view = document.defaultView!
  let anchorElement = anchor instanceof view.Element ? anchor : null
  let dir = options.dir ?? (getComputedStyle(floating).direction === 'rtl' ? 'rtl' : 'ltr')
  let placement: Required<PlacementOptions> = {
    side: 'bottom',
    align: 'center',
    sideOffset: 0,
    alignOffset: 0,
    collisionPadding: 5,
    flip: true,
    shift: true,
    ...options,
    dir,
  }
  let requestedSide = resolveSide(placement.side, dir)
  let floatingStyles = createRestorer(floating)
  let anchorStyles = anchorElement instanceof view.HTMLElement ? createRestorer(anchorElement) : null
  let canUseCss = anchorStyles !== null && options.strategy !== 'measure' && supportsCssAnchorPositioning()
  let controller = new AbortController()
  let frame = 0

  floatingStyles.style('position', 'fixed')
  if (canUseCss) {
    let name = `--remixcn-anchor-${++anchorCount}`
    let existing = (anchorElement as HTMLElement).style.getPropertyValue('anchor-name')
    anchorStyles!.style('anchor-name', existing && existing !== 'none' ? `${existing}, ${name}` : name)
    floatingStyles.style('position-anchor', name)
  }

  // Longhands only, so restoring them can't disturb a shorthand set before.
  function setBox(insets: Record<PhysicalSide, string>, margins: Record<PhysicalSide, number>) {
    for (let edge of edges) {
      floatingStyles.style(edge, insets[edge])
      floatingStyles.style(`margin-${edge}`, `${margins[edge]}px`)
    }
  }

  let auto = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' }
  let cssMargins = getCssMargins(requestedSide, placement)

  function useBrowserPlacement() {
    floatingStyles.style('position-area', getPositionArea(requestedSide, placement.align, dir))
    floatingStyles.style('position-try-fallbacks', placement.flip ? getTryFallbacks(requestedSide, placement.align) : 'none')
    setBox(auto, cssMargins)
  }

  function useMeasuredPlacement(position: Position) {
    if (canUseCss) {
      floatingStyles.style('position-area', 'none')
      floatingStyles.style('position-try-fallbacks', 'none')
    }
    setBox({ ...auto, top: `${position.y}px`, left: `${position.x}px` }, { top: 0, right: 0, bottom: 0, left: 0 })
  }

  function readAnchor(): Rect {
    if (anchorElement) return anchorElement.getBoundingClientRect()
    let point = anchor as AnchorPoint
    return { x: point.x, y: point.y, width: point.width ?? 0, height: point.height ?? 0 }
  }

  function update() {
    let anchorRect = readAnchor()
    let hidden = anchorElement ? !isAnchorVisible(anchorElement, anchorRect) : false
    floatingStyles.attribute('data-anchor-hidden', hidden ? '' : null)
    if (hidden) {
      floatingStyles.style('visibility', 'hidden')
      return
    }
    floatingStyles.reset('visibility')

    let boundary = getViewport(document)
    if (options.boundary) boundary = intersect(boundary, options.boundary.getBoundingClientRect())
    let size = { width: floating.offsetWidth, height: floating.offsetHeight }
    let position = computePosition(anchorRect, size, boundary, placement)
    let padding = placement.collisionPadding
    let bounds = {
      x: boundary.x + padding,
      y: boundary.y + padding,
      width: boundary.width - 2 * padding,
      height: boundary.height - 2 * padding,
    }

    // The browser knows only the layout viewport, and it always shifts. Keep
    // its placement while it stays inside the bounds and, without shift, while
    // it needed no shift; otherwise, as with a boundary element or a
    // pinch-zoomed viewport, measure instead.
    function readBrowserPlacement(): Position | undefined {
      useBrowserPlacement()
      let rect = floating.getBoundingClientRect()
      if (!contains(bounds, rect)) return undefined

      let side = readSide(rect, anchorRect, position.side)
      let placed = (align: Align) => computePosition(anchorRect, size, boundary, { ...placement, side, align, flip: false })
      // The browser flips start and end alignment only when it may flip.
      let alignments: Align[] =
        placement.flip && placement.align !== 'center' ? ['start', 'end'] : [placement.align]
      let align = placement.shift
        ? alignments.length === 1
          ? alignments[0]
          : readAlign(rect, anchorRect, side, dir, position.align)
        : alignments.find((candidate) => {
            let unshifted = placed(candidate)
            return Math.abs(unshifted.x - rect.x) <= tolerance && Math.abs(unshifted.y - rect.y) <= tolerance
          })
      return align && { ...placed(align), x: rect.x, y: rect.y }
    }

    let browserPosition = canUseCss ? readBrowserPlacement() : undefined
    if (browserPosition) position = browserPosition
    else useMeasuredPlacement(position)

    let { side, x, y } = position
    let { sideOffset } = placement
    let originX = clamp(anchorRect.x + anchorRect.width / 2 - x, 0, size.width)
    let originY = clamp(anchorRect.y + anchorRect.height / 2 - y, 0, size.height)
    let origin = {
      bottom: `${originX}px ${-sideOffset}px`,
      top: `${originX}px ${size.height + sideOffset}px`,
      right: `${-sideOffset}px ${originY}px`,
      left: `${size.width + sideOffset}px ${originY}px`,
    }[side]

    floatingStyles.attribute('data-side', side)
    floatingStyles.attribute('data-align', position.align)
    floatingStyles.style('--anchor-width', `${anchorRect.width}px`)
    floatingStyles.style('--anchor-height', `${anchorRect.height}px`)
    floatingStyles.style('--available-width', `${position.availableWidth}px`)
    floatingStyles.style('--available-height', `${position.availableHeight}px`)
    floatingStyles.style('--transform-origin', origin)
  }

  function schedule() {
    if (frame || controller.signal.aborted) return
    frame = view.requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  let listen = { passive: true, signal: controller.signal }
  document.addEventListener('scroll', schedule, { ...listen, capture: true })
  view.addEventListener('resize', schedule, listen)
  view.visualViewport?.addEventListener('resize', schedule, listen)
  view.visualViewport?.addEventListener('scroll', schedule, listen)
  let observer = new view.ResizeObserver(schedule)
  observer.observe(floating)
  if (anchorElement) observer.observe(anchorElement)
  if (options.boundary) observer.observe(options.boundary)

  update()

  return () => {
    if (controller.signal.aborted) return
    controller.abort()
    view.cancelAnimationFrame(frame)
    observer.disconnect()
    floatingStyles.restore()
    anchorStyles?.restore()
  }
}

export type AnchorTarget = Element | AnchorPoint | null

export interface AnchorPositionOptions extends FloatingOptions {
  /** The anchor element or point, or a function that returns it when positioning starts. */
  anchor: AnchorTarget | (() => AnchorTarget)
  /** Whether to position now (defaults to `true`). Set it to the popup's open state. */
  open?: boolean
}

function sameAnchor(a: AnchorTarget, b: AnchorTarget) {
  if (a === b) return true
  if (!a || !b || a instanceof Element || b instanceof Element) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function samePlacement(a: FloatingOptions, b: FloatingOptions) {
  let keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof FloatingOptions & keyof AnchorPositionOptions>
  keys.delete('anchor' as never)
  keys.delete('open' as never)
  return [...keys].every((key) => a[key] === b[key])
}

/**
 * Positions the host against `anchor` while `open` isn't false, with
 * `positionFloating`. It restarts when an option changes and cleans up when
 * the popup closes or unmounts.
 */
export const anchorPosition: MixinFactory<HTMLElement, [options: AnchorPositionOptions]> = createMixin<
  HTMLElement,
  [options: AnchorPositionOptions]
>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: AnchorPositionOptions
    let started: { anchor: AnchorTarget; options: FloatingOptions } | null = null
    let stop: (() => void) | null = null

    function sync() {
      let anchor = typeof options.anchor === 'function' ? options.anchor() : options.anchor
      let active = host !== null && anchor !== null && options.open !== false
      if (stop && (!active || !sameAnchor(started!.anchor, anchor) || !samePlacement(started!.options, options))) {
        stop()
        stop = null
      }
      if (active && !stop) {
        started = { anchor, options }
        stop = positionFloating(host!, anchor!, options)
      }
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      sync()
    })

    handle.addEventListener('remove', () => {
      host = null
      sync()
    })

    return (nextOptions) => {
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)
