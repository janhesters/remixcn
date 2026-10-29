// RemixCN Resizable: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixElement, RemixNode } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// ---------------------------------------------------------------------------
// Sizes and layouts
//
// A layout maps each panel's id to its share of the group, in percent. The
// shares add up to 100. Sizes on panels may also use pixels and font or
// viewport units: the group turns them into percentages once the browser has
// measured it. Until then, on the server, only percentages count.
// ---------------------------------------------------------------------------

/**
 * A panel size. A number counts pixels, a string without a unit counts
 * percent, and a string may name `%`, `px`, `rem`, `em`, `vh` or `vw`, as in
 * react-resizable-panels.
 */
export type ResizableSize = number | `${number}` | `${number}${SizeUnit}`

type SizeUnit = '%' | 'px' | 'rem' | 'em' | 'vh' | 'vw'

/** Each panel's id and its share of the group in percent. The shares add up to 100. */
export type ResizableLayout = Record<string, number>

/** The size props of one panel, as checkPanels and resolveBounds read them. */
export interface PanelConstraints {
  id: string
  defaultSize?: ResizableSize
  minSize?: ResizableSize
  maxSize?: ResizableSize
  collapsible?: boolean
  collapsedSize?: ResizableSize
}

/** A panel's bounds in percent of the group, ready for fitLayout and adjustLayout. */
export interface PanelBounds {
  id: string
  defaultSize: number | undefined
  min: number
  max: number
  collapsible: boolean
  collapsedSize: number
}

/** What the browser measured, so pixels and font or viewport units become percentages. */
export interface ResizableMeasure {
  /** The pixels the panels share along the group's axis, without the handles. */
  panelSpace: number
  rootFontSize: number
  /** The group's own font size, for em. */
  fontSize: number
  viewportWidth: number
  viewportHeight: number
}

interface Length {
  value: number
  unit: SizeUnit
}

type SizeProp = 'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize'

const epsilon = 1e-6
const sizePattern = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(%|px|rem|em|vh|vw)?$/

function nearly(a: number, b: number) {
  return Math.abs(a - b) < epsilon
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function describeSize(size: ResizableSize) {
  return typeof size === 'number' ? String(size) : JSON.stringify(size)
}

function formatLength({ value, unit }: Length) {
  return `${value}${unit}`
}

function parseLength(size: ResizableSize, panel: string, prop: SizeProp): Length {
  let match = typeof size === 'number' ? undefined : sizePattern.exec(size.trim())
  let value = typeof size === 'number' ? size : match ? Number(match[1]) : Number.NaN
  let unit: SizeUnit = typeof size === 'number' ? 'px' : ((match?.[2] as SizeUnit | undefined) ?? '%')

  if (!Number.isFinite(value)) {
    throw new RangeError(
      `ResizablePanel "${panel}": ${prop} ${describeSize(size)} is not a size. Use a number of pixels or a string such as "25%", "240px" or "16rem".`,
    )
  }
  if (value < 0) throw new RangeError(`ResizablePanel "${panel}": ${prop} ${describeSize(size)} is negative.`)
  if (unit === '%' && value > 100) {
    throw new RangeError(`ResizablePanel "${panel}": ${prop} ${describeSize(size)} is more than 100% of the group.`)
  }

  return { value, unit }
}

// Two lengths compare without a measurement when they share a unit, or when one is 0.
function compareLengths(a: Length, b: Length): number | undefined {
  if (a.unit === b.unit) return a.value - b.value
  if (a.value === 0 || b.value === 0) return a.value - b.value
  return undefined
}

function lengthsOf(panel: PanelConstraints) {
  let read = (prop: SizeProp) => (panel[prop] === undefined ? undefined : parseLength(panel[prop], panel.id, prop))

  return {
    defaultSize: read('defaultSize'),
    minSize: read('minSize') ?? { value: 0, unit: '%' as const },
    maxSize: read('maxSize') ?? { value: 100, unit: '%' as const },
    collapsedSize: read('collapsedSize') ?? { value: 0, unit: '%' as const },
  }
}

/**
 * Rejects sizes that can never work: sizes it can't read, bounds that
 * contradict each other, and minimums or maximums that can't fill the group.
 * It throws a RangeError that names the panel and the prop. Mixed units, such
 * as a pixel minimum and a percentage maximum, only compare once the browser
 * has measured the group, so resolveBounds settles them.
 */
export function checkPanels(panels: PanelConstraints[]): void {
  let ids = new Set<string>()
  let mins: Length[] = []
  let maxes: Length[] = []

  for (let panel of panels) {
    if (ids.has(panel.id)) throw new RangeError(`ResizablePanelGroup: two panels with the id "${panel.id}".`)
    ids.add(panel.id)

    let { defaultSize, minSize, maxSize, collapsedSize } = lengthsOf(panel)
    let fail = (message: string) => {
      throw new RangeError(`ResizablePanel "${panel.id}": ${message}`)
    }
    let larger = (a: Length, b: Length) => (compareLengths(a, b) ?? 0) > epsilon

    if (larger(minSize, maxSize))
      fail(`minSize ${formatLength(minSize)} is larger than maxSize ${formatLength(maxSize)}.`)
    if (panel.collapsible && larger(collapsedSize, minSize)) {
      fail(`collapsedSize ${formatLength(collapsedSize)} is larger than minSize ${formatLength(minSize)}.`)
    }
    if (defaultSize) {
      let collapsed = panel.collapsible && compareLengths(defaultSize, collapsedSize) === 0
      if (!collapsed && larger(minSize, defaultSize)) {
        fail(`defaultSize ${formatLength(defaultSize)} is smaller than minSize ${formatLength(minSize)}.`)
      }
      if (larger(defaultSize, maxSize))
        fail(`defaultSize ${formatLength(defaultSize)} is larger than maxSize ${formatLength(maxSize)}.`)
    }

    mins.push(minSize)
    maxes.push(maxSize)
  }

  let percentages = (lengths: Length[]) =>
    lengths.every((length) => length.unit === '%' || length.value === 0)
      ? sum(lengths.map((length) => length.value))
      : undefined

  let minTotal = percentages(mins)
  if (minTotal !== undefined && minTotal > 100 + epsilon) {
    throw new RangeError(`ResizablePanelGroup: the minimum sizes add up to ${minTotal}%, more than the group.`)
  }
  let maxTotal = percentages(maxes)
  if (panels.length > 0 && maxTotal !== undefined && maxTotal < 100 - epsilon) {
    throw new RangeError(`ResizablePanelGroup: the maximum sizes add up to ${maxTotal}%, less than the group.`)
  }
}

function toPercent({ value, unit }: Length, measure: ResizableMeasure | undefined): number | undefined {
  if (unit === '%') return value
  if (!measure || measure.panelSpace <= 0) return undefined

  let pixels = {
    px: value,
    rem: value * measure.rootFontSize,
    em: value * measure.fontSize,
    vh: (value * measure.viewportHeight) / 100,
    vw: (value * measure.viewportWidth) / 100,
  }[unit]

  return (pixels / measure.panelSpace) * 100
}

/**
 * Turns each panel's sizes into percentages of the group. Without a
 * measurement, as on the server, it counts only percentages. Bounds that only
 * conflict at the measured size give way: a minimum wins over a smaller
 * maximum, minimums that overfill the group shrink in proportion, and
 * maximums that can't fill it grow in proportion.
 */
export function resolveBounds(panels: PanelConstraints[], measure?: ResizableMeasure): PanelBounds[] {
  let bounds = panels.map((panel): PanelBounds => {
    let lengths = lengthsOf(panel)
    let percent = (length: Length | undefined) => (length ? toPercent(length, measure) : undefined)
    let min = clamp(percent(lengths.minSize) ?? 0, 0, 100)
    let max = Math.max(min, clamp(percent(lengths.maxSize) ?? 100, 0, 100))
    let defaultSize = percent(lengths.defaultSize)

    return {
      id: panel.id,
      defaultSize: defaultSize === undefined ? undefined : clamp(defaultSize, 0, 100),
      min,
      max,
      collapsible: panel.collapsible ?? false,
      collapsedSize: Math.min(min, clamp(percent(lengths.collapsedSize) ?? 0, 0, 100)),
    }
  })

  let minTotal = sum(bounds.map((panel) => panel.min))
  if (minTotal > 100) {
    let scale = 100 / minTotal
    bounds = bounds.map((panel) => ({ ...panel, min: panel.min * scale, collapsedSize: panel.collapsedSize * scale }))
  }
  let maxTotal = sum(bounds.map((panel) => panel.max))
  if (bounds.length > 0 && maxTotal < 100) {
    let scale = 100 / maxTotal
    bounds = bounds.map((panel) => ({ ...panel, max: Math.min(100, panel.max * scale) }))
  }

  return bounds
}

function isCollapsed(panel: PanelBounds, size: number) {
  return panel.collapsible && nearly(size, panel.collapsedSize) && panel.collapsedSize < panel.min
}

// Halfway between the collapsed size and the minimum: below it a collapsible panel collapses.
function collapseThreshold(panel: PanelBounds) {
  return (panel.collapsedSize + panel.min) / 2
}

// Puts one size within a panel's bounds. A collapsible panel below its
// minimum snaps to whichever is nearer: collapsed or its minimum.
function clampSize(panel: PanelBounds, size: number) {
  if (size < panel.min - epsilon) {
    size = panel.collapsible && size < collapseThreshold(panel) ? panel.collapsedSize : panel.min
  }
  return Math.min(panel.max, size)
}

function toLayout(bounds: PanelBounds[], sizes: number[]): ResizableLayout {
  return Object.fromEntries(bounds.map((panel, index) => [panel.id, sizes[index] ?? 0]))
}

// Spreads the difference to 100 over the panels that can still move, in
// proportion to their sizes, so no single neighbor takes it all. `skip`
// keeps panels out, such as those that just met a bound.
function distribute(bounds: PanelBounds[], sizes: number[], skip: (index: number) => boolean) {
  for (let round = 0; round <= bounds.length; round++) {
    let remainder = 100 - sum(sizes)
    if (Math.abs(remainder) < epsilon) return

    let movable = bounds
      .map((panel, index) => ({ panel, index, size: sizes[index] ?? 0 }))
      .filter(({ index }) => !skip(index))
      .filter(({ panel, size }) => (remainder > 0 ? size < panel.max - epsilon : size > panel.min + epsilon))
    if (movable.length === 0) return

    let weight = sum(movable.map(({ size }) => size))
    for (let { panel, index, size } of movable) {
      let share = weight > 0 ? (remainder * size) / weight : remainder / movable.length
      sizes[index] = clamp(size + share, panel.min, panel.max)
    }
  }
}

function validate(bounds: PanelBounds[], sizes: number[]): ResizableLayout {
  let total = sum(sizes)
  let scaled = total > epsilon ? sizes.map((size) => (size * 100) / total) : sizes.map(() => 100 / bounds.length)
  let clamped = bounds.map((panel, index) => clampSize(panel, scaled[index] ?? 0))
  let pinned = new Set(clamped.flatMap((size, index) => (nearly(size, scaled[index] ?? 0) ? [] : [index])))
  let collapsed = (index: number) => isCollapsed(bounds[index] as PanelBounds, clamped[index] ?? 0)

  // First the panels that kept their size, then any that aren't collapsed, then all.
  distribute(bounds, clamped, (index) => pinned.has(index) || collapsed(index))
  distribute(bounds, clamped, collapsed)
  distribute(bounds, clamped, () => false)
  return toLayout(bounds, clamped)
}

/**
 * Fits a layout to the panels. Panels keep their stored share by id, a panel
 * without one takes its default size or an equal share, the others scale in
 * proportion, and every panel ends within its bounds. With no stored share at
 * all, the default sizes apply and the panels without one share the rest.
 */
export function fitLayout(bounds: PanelBounds[], source: Partial<ResizableLayout>): ResizableLayout {
  let stored = (panel: PanelBounds) => {
    let size = source[panel.id]
    return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined
  }

  if (bounds.length === 0) return {}

  let known = bounds.filter((panel) => stored(panel) !== undefined)
  let sizes: number[]

  if (known.length === 0) {
    let defaults = sum(bounds.map((panel) => panel.defaultSize ?? 0))
    let withoutDefault = bounds.filter((panel) => panel.defaultSize === undefined).length
    let share = withoutDefault > 0 ? Math.max(0, 100 - defaults) / withoutDefault : 0
    sizes = bounds.map((panel) => panel.defaultSize ?? share)
  } else {
    let added = bounds.map((panel) => (stored(panel) === undefined ? (panel.defaultSize ?? 100 / bounds.length) : 0))
    let room = Math.max(0, 100 - sum(added))
    let storedTotal = sum(known.map((panel) => stored(panel) ?? 0))
    sizes = bounds.map((panel, index) => {
      let size = stored(panel)
      if (size === undefined) return added[index] ?? 0
      return storedTotal > epsilon ? (size * room) / storedTotal : room / known.length
    })
  }

  return validate(bounds, sizes)
}

export type ResizeTrigger = 'pointer' | 'keyboard'

/**
 * Moves the separator after panel `index` by `delta` percent: positive grows
 * the panel before it. The panels on the shrinking side give way nearest
 * first, each down to its minimum, and the growing side takes the space
 * nearest first, each up to its maximum. A collapsible panel next to the
 * separator collapses once it goes past halfway from its minimum to its
 * collapsed size, and expands once it goes past the same point. From the
 * keyboard, one step at the minimum collapses it and one step expands it.
 * It returns the same layout when nothing can move.
 */
export function adjustLayout(
  bounds: PanelBounds[],
  layout: ResizableLayout,
  index: number,
  delta: number,
  trigger: ResizeTrigger,
): ResizableLayout {
  if (Math.abs(delta) < epsilon || index < 0 || index >= bounds.length - 1) return layout

  let sizes = bounds.map((panel) => layout[panel.id] ?? 0)
  let growing = delta > 0
  let shrinkOrder = growing ? range(index + 1, bounds.length) : range(index, -1)
  let growOrder = growing ? range(index, -1) : range(index + 1, bounds.length)
  let [shrinkPivot = -1] = shrinkOrder
  let [growPivot = -1] = growOrder
  let size = (at: number) => sizes[at] ?? 0
  let panel = (at: number) => bounds[at] as PanelBounds

  let distance = Math.abs(delta)
  let expands = isCollapsed(panel(growPivot), size(growPivot))
  if (expands) {
    let target = panel(growPivot)
    let passes = trigger === 'keyboard' || size(growPivot) + distance >= collapseThreshold(target) - epsilon
    if (!passes) return layout
    distance = Math.max(distance, target.min - target.collapsedSize)
  }

  let shrinking = panel(shrinkPivot)
  let collapses =
    shrinking.collapsible &&
    !isCollapsed(shrinking, size(shrinkPivot)) &&
    (trigger === 'keyboard'
      ? nearly(size(shrinkPivot), shrinking.min)
      : size(shrinkPivot) - distance < collapseThreshold(shrinking) - epsilon)
  let wanted = collapses ? Math.max(distance, size(shrinkPivot) - shrinking.collapsedSize) : distance

  // How far each side can move. Panels beyond the pivots never collapse or expand.
  let shrinkRoom = (at: number, collapse: boolean) =>
    at === shrinkPivot && collapse
      ? size(at) - panel(at).collapsedSize
      : isCollapsed(panel(at), size(at))
        ? 0
        : Math.max(0, size(at) - panel(at).min)
  let growRoom = (at: number) =>
    at !== growPivot && isCollapsed(panel(at), size(at)) ? 0 : Math.max(0, panel(at).max - size(at))

  let growCapacity = sum(growOrder.map(growRoom))
  let applied = Math.min(wanted, growCapacity, sum(shrinkOrder.map((at) => shrinkRoom(at, collapses))))
  if (collapses && applied < size(shrinkPivot) - shrinking.collapsedSize - epsilon) {
    collapses = false
    applied = Math.min(distance, growCapacity, sum(shrinkOrder.map((at) => shrinkRoom(at, false))))
  }
  if (expands && applied < panel(growPivot).min - panel(growPivot).collapsedSize - epsilon) return layout
  if (applied < epsilon) return layout

  let next = [...sizes]
  let give = applied
  for (let at of shrinkOrder) {
    let take = Math.min(shrinkRoom(at, collapses), give)
    next[at] = size(at) - take
    give -= take
  }
  let receive = applied
  for (let at of growOrder) {
    let take = Math.min(growRoom(at), receive)
    next[at] = size(at) + take
    receive -= take
  }

  return toLayout(bounds, next)
}

function range(from: number, to: number) {
  let step = to > from ? 1 : -1
  let values: number[] = []
  for (let at = from; at !== to; at += step) values.push(at)
  return values
}

/**
 * The separator's ARIA values: the size of the panel before it, and how
 * small and how large that panel can get by moving this separator.
 */
export function separatorValues(bounds: PanelBounds[], layout: ResizableLayout, index: number) {
  let before = bounds[index]
  if (!before) return { now: 0, min: 0, max: 0 }

  let now = layout[before.id] ?? 0
  let smallest = before.collapsible ? before.collapsedSize : before.min
  let min = adjustLayout(bounds, layout, index, smallest - now, 'pointer')[before.id] ?? now
  let max = adjustLayout(bounds, layout, index, before.max - now, 'pointer')[before.id] ?? now

  return { now, min, max }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export type ResizableOrientation = 'horizontal' | 'vertical'

export interface ResizablePanelGroupProps extends Omit<Props<'div'>, 'children'> {
  /** Side by side (horizontal, the default) or stacked (vertical). */
  orientation?: ResizableOrientation
  /** The layout its owner controls. The group renders it within the panels' bounds. */
  layout?: ResizableLayout
  /** The layout to start from, such as one the caller stored. It wins over the panels' default sizes. */
  defaultLayout?: ResizableLayout
  /** Keeps every handle from resizing. */
  disabled?: boolean
  /** ResizablePanel and ResizableHandle parts, as direct children. */
  children?: RemixNode
}

export interface ResizablePanelProps extends Props<'div'>, Omit<PanelConstraints, 'id'> {
  /**
   * Names the panel in the group's layout and is its element id. Give one to
   * panels that come and go, so the others keep their sizes.
   */
  id?: string
}

export interface ResizableHandleProps extends Omit<Props<'div'>, 'role' | 'children'> {
  /** Shows a grip on the line. */
  withHandle?: boolean
  /** Keeps this handle from resizing its panels. */
  disabled?: boolean
}

export const resizableLayoutChangeType = 'remixcn:resizable-layout-change' as const
export const resizableLayoutChangedType = 'remixcn:resizable-layout-changed' as const

/**
 * Dispatched on the group while a pointer, a key or a double click changes
 * its layout, before the change, and bubbles. `layout` is the next layout.
 * Cancel it with `preventDefault()` to keep the current one. It takes the
 * place of react-resizable-panels' `onLayoutChange`.
 */
export class ResizableLayoutChangeEvent extends Event {
  readonly layout: ResizableLayout

  constructor(layout: ResizableLayout) {
    super(resizableLayoutChangeType, { bubbles: true, cancelable: true })
    this.layout = layout
  }
}

/**
 * Dispatched on the group once a change is done: when the pointer is
 * released, or after a key. It bubbles, and takes the place of
 * `onLayoutChanged`. Store `layout` here to restore it with `defaultLayout`.
 */
export class ResizableLayoutChangedEvent extends Event {
  readonly layout: ResizableLayout

  constructor(layout: ResizableLayout) {
    super(resizableLayoutChangedType, { bubbles: true })
    this.layout = layout
  }
}

declare global {
  interface HTMLElementEventMap {
    [resizableLayoutChangeType]: ResizableLayoutChangeEvent
    [resizableLayoutChangedType]: ResizableLayoutChangedEvent
  }
}

// What the group hands each of its direct children through ResizableSlot.
interface GroupApi {
  pointerDown(index: number, event: PointerEvent): void
  keyDown(index: number, event: KeyboardEvent): void
  doubleClick(index: number, event: MouseEvent): void
  handleRemoved(separator: HTMLElement): void
}

type SlotValue =
  | { kind: 'panel'; group: GroupApi; id: string; size: number; collapsed: boolean }
  | {
      kind: 'handle'
      group: GroupApi
      index: number
      orientation: ResizableOrientation
      interactive: boolean
      disabled: boolean
      dragging: boolean
      controls: string | undefined
      values: { now: number; min: number; max: number } | undefined
    }

function ResizableSlot(handle: Handle<{ value: SlotValue; children?: RemixNode }, SlotValue>) {
  return () => {
    handle.context.set(handle.props.value)
    return handle.props.children
  }
}

interface Part {
  node: RemixNode
  key: string | undefined
  panel?: PanelConstraints & { elementId: string }
  handle?: true
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

// The group's direct children in order, with fragments and arrays flattened.
function partsOf(children: RemixNode, groupId: string): Part[] {
  let parts: Part[] = []
  let panelCount = 0

  let visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (isElement(node) && node.type === Fragment) return visit(node.props.children)

    let key = isElement(node) && node.key !== undefined && node.key !== null ? String(node.key) : undefined
    if (isElement(node) && node.type === ResizablePanel) {
      let props = node.props as unknown as ResizablePanelProps
      let id = props.id ?? (key === undefined ? `${groupId}-panel-${panelCount}` : `${groupId}-${key}`)
      panelCount++
      parts.push({
        node,
        key,
        panel: {
          id,
          elementId: id,
          defaultSize: props.defaultSize,
          minSize: props.minSize,
          maxSize: props.maxSize,
          collapsible: props.collapsible,
          collapsedSize: props.collapsedSize,
        },
      })
    } else if (isElement(node) && node.type === ResizableHandle) {
      parts.push({ node, key, handle: true })
    } else {
      parts.push({ node: node as RemixNode, key })
    }
  }

  visit(children)
  return parts
}

function sameLayout(a: ResizableLayout, b: ResizableLayout) {
  let keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length && keys.every((key) => nearly(a[key] ?? Number.NaN, b[key] ?? Number.NaN))
  )
}

const keyboardStep = 5

const groupStyles = css({
  display: 'flex',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  '&[data-orientation="vertical"]': { flexDirection: 'column' },
  '&[data-dragging]': { userSelect: 'none', WebkitUserSelect: 'none' },
  '&[data-dragging][data-orientation="horizontal"]': { cursor: 'col-resize' },
  '&[data-dragging][data-orientation="vertical"]': { cursor: 'row-resize' },
})

/**
 * Lays out ResizablePanels in a row or a column, with ResizableHandles
 * between them. The server renders the layout from the panels' percentage
 * sizes. Once the browser runs the group, inside a client entry of the app,
 * the handles take the pointer and the keyboard.
 */
export function ResizablePanelGroup(handle: Handle<ResizablePanelGroupProps, GroupApi>) {
  let group: HTMLElement | undefined
  let enhanced = false
  let measure: ResizableMeasure | undefined
  let measured = false
  // Whether any size uses pixels or font or viewport units, so a new group size changes the bounds.
  let needsMeasure = false
  let bounds: PanelBounds[] = []
  let elementIds: string[] = []
  // The layout of the last render, which each drag or key starts from.
  let current: ResizableLayout | undefined
  // Whether the group has its first layout with every size known. Until the
  // browser has measured the group, each render starts from the defaults, so
  // pixel and rem defaults still apply. From then on, each render starts from
  // the last one, so panels that come and go keep the others' proportions.
  let settled = false
  // The layout of the last render, to notice a panel that just collapsed.
  let lastRendered: ResizableLayout | undefined
  // The size each collapsible panel had before it last collapsed, for Enter.
  let expandedSizes = new Map<string, number>()
  let drag:
    | {
        index: number
        pointerId: number
        start: ResizableLayout
        origin: number
        separator: HTMLElement
        done: AbortController
      }
    | undefined

  function horizontal() {
    return (handle.props.orientation ?? 'horizontal') === 'horizontal'
  }

  function rtl() {
    return group ? getComputedStyle(group).direction === 'rtl' : false
  }

  function measureGroup(): ResizableMeasure | undefined {
    if (!group) return undefined

    let panels = [...group.children].filter((child) => child.getAttribute('data-slot') === 'resizable-panel')
    let panelSpace = sum(
      panels.map((panel) => {
        let box = panel.getBoundingClientRect()
        return horizontal() ? box.width : box.height
      }),
    )

    return {
      panelSpace,
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      fontSize: Number.parseFloat(getComputedStyle(group).fontSize) || 16,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  }

  function layout() {
    return current ?? {}
  }

  // Offers a layout to the caller and, unless it's canceled or controlled, renders it.
  function propose(next: ResizableLayout) {
    if (!group || sameLayout(next, layout())) return

    let accepted = group.dispatchEvent(new ResizableLayoutChangeEvent(next))
    if (!accepted) return

    if (handle.props.layout === undefined) {
      settled = true
      current = next
    }
    void handle.update()
  }

  // Reports a finished change after the next render, so a controlled owner
  // has rendered the layout it accepted, or kept the old one.
  function commit(start: ResizableLayout) {
    handle.queueTask(() => {
      if (group && !sameLayout(start, layout())) group.dispatchEvent(new ResizableLayoutChangedEvent(layout()))
    })
    void handle.update()
  }

  function canResize(index: number, separator: Element) {
    return (
      enhanced &&
      !handle.props.disabled &&
      separator.getAttribute('aria-disabled') !== 'true' &&
      index >= 0 &&
      index < bounds.length - 1
    )
  }

  function endDrag({ render = true } = {}) {
    if (!drag) return
    let { separator, pointerId, done } = drag
    drag = undefined
    done.abort()
    if (separator.hasPointerCapture(pointerId)) separator.releasePointerCapture(pointerId)
    if (render) void handle.update()
  }

  function cancelDrag() {
    if (!drag) return
    let { start } = drag
    propose(start)
    endDrag()
  }

  let api: GroupApi = {
    pointerDown(index, event) {
      let separator = event.currentTarget as HTMLElement
      if (event.defaultPrevented || !canResize(index, separator) || drag) return
      if (event.pointerType === 'mouse' && event.button !== 0) return

      // Keep text from being selected, and focus the handle so Escape cancels.
      event.preventDefault()
      separator.focus({ preventScroll: true })
      measure = measureGroup()

      let done = new AbortController()
      handle.signal.addEventListener('abort', () => done.abort(), { signal: done.signal })
      drag = {
        index,
        pointerId: event.pointerId,
        start: layout(),
        origin: horizontal() ? event.clientX : event.clientY,
        separator,
        done,
      }
      // Capture keeps the moves coming when the pointer leaves the handle. The
      // document hears them either way, so a failed capture still drags.
      try {
        separator.setPointerCapture(event.pointerId)
      } catch {}

      let options = { signal: done.signal }
      let finish = (end: PointerEvent) => {
        if (!drag || end.pointerId !== drag.pointerId) return
        let { start } = drag
        endDrag()
        commit(start)
      }
      separator.ownerDocument.addEventListener(
        'pointermove',
        (move) => {
          if (!drag || move.pointerId !== drag.pointerId) return
          let space = measure?.panelSpace ?? 0
          if (space <= 0) return

          let pixels = (horizontal() ? move.clientX : move.clientY) - drag.origin
          let delta = ((horizontal() && rtl() ? -pixels : pixels) / space) * 100
          propose(adjustLayout(bounds, drag.start, drag.index, delta, 'pointer'))
        },
        options,
      )
      separator.ownerDocument.addEventListener('pointerup', finish, options)
      separator.ownerDocument.addEventListener(
        'pointercancel',
        (cancel) => {
          if (drag && cancel.pointerId === drag.pointerId) cancelDrag()
        },
        options,
      )
      // The handle went away or another element took the pointer: keep what the drag did.
      separator.addEventListener('lostpointercapture', finish, options)
      void handle.update()
    },

    keyDown(index, event) {
      let separator = event.currentTarget as HTMLElement
      if (event.key === 'Escape' && drag) {
        event.preventDefault()
        cancelDrag()
        return
      }
      if (event.defaultPrevented || !canResize(index, separator)) return

      if (event.key === 'F6') {
        event.preventDefault()
        let separators = group
          ? [...group.children].filter(
              (child): child is HTMLElement => child.getAttribute('data-slot') === 'resizable-handle',
            )
          : []
        let at = separators.indexOf(separator)
        let next = event.shiftKey ? (at - 1 + separators.length) % separators.length : (at + 1) % separators.length
        separators[next]?.focus()
        return
      }

      let start = layout()
      let before = bounds[index] as PanelBounds
      let after = bounds[index + 1] as PanelBounds
      let next: ResizableLayout | undefined
      let step = (sign: number) => adjustLayout(bounds, start, index, sign * keyboardStep, 'keyboard')

      if (horizontal() && event.key === 'ArrowLeft') next = step(rtl() ? 1 : -1)
      else if (horizontal() && event.key === 'ArrowRight') next = step(rtl() ? -1 : 1)
      else if (!horizontal() && event.key === 'ArrowUp') next = step(-1)
      else if (!horizontal() && event.key === 'ArrowDown') next = step(1)
      else if (event.key === 'Home') next = adjustLayout(bounds, start, index, -100, 'keyboard')
      else if (event.key === 'End') next = adjustLayout(bounds, start, index, 100, 'keyboard')
      else if (event.key === 'Enter') {
        // Collapse or expand the panel before the handle, or else the one after it.
        let panel = before.collapsible ? before : after.collapsible ? after : undefined
        if (!panel) return
        let size = start[panel.id] ?? 0
        let target = isCollapsed(panel, size) ? (expandedSizes.get(panel.id) ?? panel.min) : panel.collapsedSize
        let delta = panel === before ? target - size : size - target
        next = adjustLayout(bounds, start, index, delta, 'pointer')
      } else return

      event.preventDefault()
      propose(next)
      commit(start)
    },

    // The handle under a drag left the group, such as with its panel. The
    // browser tells the document, not the handle, so the group ends the drag
    // here and keeps what it did. The group is rendering, so it updates after.
    handleRemoved(separator) {
      if (drag?.separator !== separator) return
      let { start } = drag
      endDrag({ render: false })
      queueMicrotask(() => {
        if (!handle.signal.aborted) commit(start)
      })
    },

    doubleClick(index, event) {
      let separator = event.currentTarget as HTMLElement
      if (event.defaultPrevented || !canResize(index, separator)) return

      // Puts the first neighbor with a default size back to it.
      let start = layout()
      let before = bounds[index] as PanelBounds
      let after = bounds[index + 1] as PanelBounds
      let delta =
        before.defaultSize !== undefined
          ? before.defaultSize - (start[before.id] ?? 0)
          : after.defaultSize !== undefined
            ? (start[after.id] ?? 0) - after.defaultSize
            : undefined
      if (delta === undefined) return

      event.preventDefault()
      propose(adjustLayout(bounds, start, index, delta, 'pointer'))
      commit(start)
    },
  }

  return () => {
    let {
      orientation = 'horizontal',
      layout: controlled,
      defaultLayout,
      disabled = false,
      children,
      mix,
      ...props
    } = handle.props

    let parts = partsOf(children, handle.id)
    let panels = parts.flatMap((part) => (part.panel ? [part.panel] : []))
    checkPanels(panels)

    bounds = resolveBounds(panels, measure)
    needsMeasure = panels.some((panel) =>
      [panel.defaultSize, panel.minSize, panel.maxSize, panel.collapsedSize].some(
        (size) => size !== undefined && (typeof size === 'number' || !/^[\d.]+%?$/.test(size.trim())),
      ),
    )
    elementIds = panels.map((panel) => panel.elementId)
    current = fitLayout(bounds, controlled ?? (settled ? current : undefined) ?? defaultLayout ?? {})
    let rendered = current
    if (enhanced && (!needsMeasure || (measure?.panelSpace ?? 0) > 0)) settled = true
    // Remember a panel's size when it collapses, whoever collapsed it, so Enter restores it.
    for (let panel of bounds) {
      let before = lastRendered?.[panel.id]
      if (before !== undefined && isCollapsed(panel, rendered[panel.id] ?? 0) && !isCollapsed(panel, before)) {
        expandedSizes.set(panel.id, before)
      }
    }
    lastRendered = rendered

    if (!enhanced) {
      handle.queueTask(() => {
        enhanced = true
        measure = measureGroup()
        void handle.update()
      })
    }
    handle.context.set(api)

    let panelIndex = 0
    let content = parts.map((part, at) => {
      let key = part.key ?? `part-${at}`
      if (part.panel) {
        let id = part.panel.id
        let size = rendered[id] ?? 0
        let panel = bounds[panelIndex] as PanelBounds
        panelIndex++
        return (
          <ResizableSlot key={key} value={{ kind: 'panel', group: api, id, size, collapsed: isCollapsed(panel, size) }}>
            {part.node}
          </ResizableSlot>
        )
      }
      if (part.handle) {
        let index = panelIndex - 1
        let valid = index >= 0 && index < bounds.length - 1
        let separatorProps = (part.node as unknown as { props: ResizableHandleProps }).props
        let interactive = enhanced && valid && !disabled && !separatorProps.disabled
        return (
          <ResizableSlot
            key={key}
            value={{
              kind: 'handle',
              group: api,
              index,
              orientation,
              interactive,
              disabled: enhanced && (disabled || Boolean(separatorProps.disabled)),
              dragging: drag?.index === index,
              controls: interactive ? elementIds[index] : undefined,
              values: interactive ? separatorValues(bounds, rendered, index) : undefined,
            }}
          >
            {part.node}
          </ResizableSlot>
        )
      }
      return part.node
    })

    return (
      <div
        {...props}
        data-slot="resizable-panel-group"
        data-orientation={orientation}
        data-disabled={disabled ? '' : undefined}
        data-dragging={drag ? '' : undefined}
        mix={[
          groupStyles,
          ref<HTMLDivElement>((node, signal) => {
            group = node
            let observer = new ResizeObserver(() => {
              if (!needsMeasure && measured) return
              measured = true
              let next = measureGroup()
              if (next && next.panelSpace !== measure?.panelSpace) {
                measure = next
                void handle.update()
              }
            })
            observer.observe(node)
            signal.addEventListener('abort', () => {
              observer.disconnect()
              drag?.done.abort()
              if (group === node) group = undefined
            })
          }),
          mix,
        ]}
      >
        {content}
      </div>
    )
  }
}

function readSlot(handle: Handle<object>, kind: SlotValue['kind'], part: string) {
  let slot = handle.context.get(ResizableSlot) as SlotValue | undefined
  let group = handle.context.get(ResizablePanelGroup) as GroupApi | undefined
  // A panel inside a panel would find its parent's slot: the parent marks it as taken.
  let taken = (handle.context.get(ResizablePanel) as { slot?: SlotValue } | undefined)?.slot
  if (!slot || slot.kind !== kind || slot.group !== group || taken === slot) {
    throw new Error(`${part} must be a direct child of a ResizablePanelGroup.`)
  }
  return slot
}

function withStyle(style: Props<'div'>['style'], extra: Record<string, string>) {
  if (typeof style === 'string') {
    return `${style}; ${Object.entries(extra)
      .map(([name, value]) => `${name}: ${value}`)
      .join('; ')}`
  }
  return { ...(style as object), ...extra }
}

const panelStyles = css({
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
})

/**
 * One panel of a ResizablePanelGroup. Its sizes are percentages of the group,
 * or pixels and font or viewport units the browser converts.
 */
export function ResizablePanel(handle: Handle<ResizablePanelProps, { slot?: SlotValue }>) {
  return () => {
    let slot = readSlot(handle, 'panel', 'ResizablePanel') as Extract<SlotValue, { kind: 'panel' }>
    handle.context.set({ slot })

    let {
      id: _id,
      defaultSize: _defaultSize,
      minSize: _minSize,
      maxSize: _maxSize,
      collapsible: _collapsible,
      collapsedSize: _collapsedSize,
      style,
      mix,
      ...props
    } = handle.props

    return (
      <div
        {...props}
        id={slot.id}
        data-slot="resizable-panel"
        data-collapsed={slot.collapsed ? '' : undefined}
        inert={slot.size < epsilon ? true : undefined}
        style={withStyle(style, { flex: `${slot.size} 1 0px` })}
        mix={[panelStyles, mix]}
      />
    )
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const handleStyles = css(
  mergeStyles(
    {
      position: 'relative',
      zIndex: 1,
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'content-box',
      borderColor: 'var(--input)',
      borderStyle: 'solid',
      borderWidth: 0,
      touchAction: 'none',
      // A wider hit area than the 1px line, larger again for touch.
      '&::after': { content: '""', position: 'absolute' },
      '&[aria-orientation="vertical"]': { width: 0, borderInlineStartWidth: '1px' },
      '&[aria-orientation="vertical"]::after': { top: 0, bottom: 0, left: space(-1), right: space(-1) },
      '&[aria-orientation="horizontal"]': { height: 0, borderBlockStartWidth: '1px' },
      '&[aria-orientation="horizontal"]::after': { left: 0, right: 0, top: space(-1), bottom: space(-1) },
      '@media (pointer: coarse)': {
        '&[aria-orientation="vertical"]::after': { left: space(-3), right: space(-3) },
        '&[aria-orientation="horizontal"]::after': { top: space(-3), bottom: space(-3) },
      },
      '&[tabindex][aria-orientation="vertical"]': { cursor: 'col-resize' },
      '&[tabindex][aria-orientation="horizontal"]': { cursor: 'row-resize' },
      '&[tabindex]:hover, &[data-dragging]': { borderColor: 'var(--foreground)' },
      '&[aria-disabled="true"]': { cursor: 'not-allowed' },
    },
    transition('border-color'),
  ),
)

const gripStyles = css({
  flexShrink: 0,
  borderRadius: 'var(--radius-lg)',
  border: '0.125rem solid',
  borderColor: 'inherit',
  backgroundColor: 'var(--background)',
  ':where([aria-orientation="vertical"]) > &': { width: space(1), height: space(6) },
  ':where([aria-orientation="horizontal"]) > &': { width: space(6), height: space(1) },
})

/**
 * The line between two panels. Once the browser runs the group, it is a
 * focusable separator: drag it, or use the arrow keys, Home, End, Enter to
 * collapse, F6 to move to the next handle, and a double click to reset.
 */
export function ResizableHandle(handle: Handle<ResizableHandleProps>) {
  return () => {
    let slot = readSlot(handle, 'handle', 'ResizableHandle') as Extract<SlotValue, { kind: 'handle' }>
    let { withHandle = false, disabled: _disabled, mix, ...props } = handle.props
    let { index, group, interactive, values } = slot

    return (
      <div
        {...props}
        role="separator"
        data-slot="resizable-handle"
        aria-orientation={slot.orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        tabIndex={interactive ? 0 : undefined}
        aria-controls={slot.controls}
        aria-valuenow={values ? Math.round(values.now) : undefined}
        aria-valuemin={values ? Math.round(values.min) : undefined}
        aria-valuemax={values ? Math.round(values.max) : undefined}
        aria-disabled={slot.disabled ? 'true' : undefined}
        data-dragging={slot.dragging ? '' : undefined}
        mix={[
          handleStyles,
          // The caller's handlers run first, so they can cancel a press, a key or a double click.
          mix,
          ref<HTMLDivElement>((node, signal) => signal.addEventListener('abort', () => group.handleRemoved(node))),
          on<HTMLDivElement, 'pointerdown'>('pointerdown', (event) => group.pointerDown(index, event)),
          on<HTMLDivElement, 'keydown'>('keydown', (event) => group.keyDown(index, event)),
          on<HTMLDivElement, 'dblclick'>('dblclick', (event) => group.doubleClick(index, event)),
        ]}
      >
        {withHandle ? <div data-slot="resizable-handle-icon" aria-hidden="true" mix={gripStyles} /> : null}
      </div>
    )
  }
}
