// RemixCN Carousel: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixElement, RemixNode } from 'remix/component'

import { ChevronLeftIcon, ChevronRightIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl, visuallyHidden } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'

// A carousel is a native scroll container with CSS scroll snapping, so it
// scrolls by touch, trackpad and keyboard before any script runs. In the
// browser, a small controller in Carousel measures the snap positions,
// tracks the selected one, and adds the buttons, keys, mouse drag, autoplay
// and announcements. It replaces Embla, which moves slides with transforms.

export type CarouselOrientation = 'horizontal' | 'vertical'
export type CarouselAlign = 'start' | 'center' | 'end'
export type CarouselDirection = 'ltr' | 'rtl'

/**
 * Why the selected snap or the number of snaps changed: `'init'` once the
 * carousel runs in the browser, `'user'` for its buttons, keys, mouse drags,
 * touch, wheel and focus, `'api'` for CarouselApi calls, `'autoplay'` for
 * automatic rotation, and `'layout'` when a resize or added and removed
 * slides change the snaps.
 */
export type CarouselSelectReason = 'init' | 'user' | 'api' | 'autoplay' | 'layout'

/**
 * Autoplay's state: `'running'` while it rotates, `'paused'` while hover,
 * focus, a hidden page or reduced motion holds it, and `'stopped'` after
 * pause() or the toggle stopped it.
 */
export type CarouselAutoplayState = 'running' | 'paused' | 'stopped'

export const carouselSelectType = 'remixcn:carousel-select' as const

/**
 * Dispatched on the carousel when the selected snap or the number of snaps
 * changes, and once when it starts running in the browser. It bubbles, so
 * check `event.target` when you listen above a nested carousel. It takes the
 * place of Embla's `select`, `init` and `reInit` events.
 */
export class CarouselSelectEvent extends Event {
  readonly index: number
  readonly previousIndex: number
  readonly snapCount: number
  readonly reason: CarouselSelectReason

  constructor(index: number, previousIndex: number, snapCount: number, reason: CarouselSelectReason) {
    super(carouselSelectType, { bubbles: true })
    this.index = index
    this.previousIndex = previousIndex
    this.snapCount = snapCount
    this.reason = reason
  }
}

declare global {
  interface HTMLElementEventMap {
    [carouselSelectType]: CarouselSelectEvent
  }
}

/** The texts the carousel writes itself. Pass your own to translate them. */
export interface CarouselMessages {
  /** A slide's name when you give it no aria-label, such as "2 of 5". */
  slide(position: number, count: number): string
  /** What the carousel announces after a change that isn't automatic, such as "Slide 2 of 5". */
  selected(first: number, last: number, count: number): string
}

export const defaultCarouselMessages: CarouselMessages = {
  slide: (position, count) => `${position} of ${count}`,
  selected: (first, last, count) =>
    first === last ? `Slide ${first} of ${count}` : `Slides ${first} to ${last} of ${count}`,
}

export interface CarouselAutoplayOptions {
  /** How long each snap shows before the next, in milliseconds. 4000 by default, as Embla's Autoplay. */
  delay?: number
}

export interface CarouselScrollOptions {
  /** Jumps instead of scrolling smoothly. With reduced motion the carousel always jumps. */
  instant?: boolean
}

/**
 * The carousel's imperative API. setApi hands it over once the carousel runs
 * in the browser. After the carousel is removed, `connected` is false, the
 * methods do nothing, and no more events fire.
 */
export interface CarouselApi {
  /** The carousel element, which dispatches CarouselSelectEvent. */
  readonly root: HTMLElement
  readonly connected: boolean
  /** The selected snap, from 0. */
  readonly selectedIndex: number
  /** The snap selected before the last change. */
  readonly previousIndex: number
  /** How many snap positions there are. With several slides in view, fewer than the slides. */
  readonly snapCount: number
  /** The slide elements, in order. */
  readonly slides: HTMLElement[]
  /** The indexes of the slides a snap shows from its start. */
  slidesInSnap(index: number): number[]
  readonly canScrollPrevious: boolean
  readonly canScrollNext: boolean
  scrollTo(index: number, options?: CarouselScrollOptions): void
  scrollPrevious(options?: CarouselScrollOptions): void
  scrollNext(options?: CarouselScrollOptions): void
  /** Whether autoplay should rotate: true until pause() or the toggle stops it. */
  readonly playing: boolean
  /** undefined without autoplay. */
  readonly autoplayState: CarouselAutoplayState | undefined
  /** Starts autoplay, at once, also while the pointer or focus is on the carousel. */
  play(): void
  /** Stops autoplay until play() or the toggle starts it again. */
  pause(): void
}

interface CarouselOptions {
  /** Scrolls sideways, or up and down. Up and Down then take the place of Left and Right. */
  orientation?: CarouselOrientation
  /** Where a snap lines a slide up in the view: its start, its center or its end. */
  align?: CarouselAlign
  /** Lets the buttons, keys, API and autoplay go from the last snap to the first, and back. */
  loop?: boolean
  /** The snap to show once the carousel runs in the browser. The server shows the first. */
  startIndex?: number
  /** Rotates the snaps on its own. Off by default. */
  autoplay?: boolean | CarouselAutoplayOptions
  /** Lets a mouse drag the slides. On by default; touch always scrolls natively. */
  mouseDrag?: boolean
  /** Receives the API once the carousel runs in the browser. */
  setApi?: (api: CarouselApi) => void
  /** Translates the slide names and announcements. */
  messages?: Partial<CarouselMessages>
}

/** A carousel needs a name: give it aria-label or aria-labelledby. */
export type CarouselProps = Props<'div'> & CarouselOptions & ({ 'aria-label': string } | { 'aria-labelledby': string })

/**
 * What Carousel gives the parts inside it. A custom part reads it with
 * handle.context.get(Carousel) while it renders, in place of shadcn's
 * useCarousel(). It renders again on every change.
 */
export interface CarouselContext {
  orientation: CarouselOrientation
  align: CarouselAlign
  loop: boolean
  /** Whether the carousel runs in the browser yet. Until then, its controls are disabled. */
  ready: boolean
  selectedIndex: number
  snapCount: number
  /** The slides of the selected snap, by index. */
  selectedSlides: readonly number[]
  canScrollPrevious: boolean
  canScrollNext: boolean
  /** Whether the carousel has autoplay. */
  autoplay: boolean
  playing: boolean
  autoplayState: CarouselAutoplayState | undefined
  messages: CarouselMessages
  /** The API, once the carousel runs in the browser. */
  api: CarouselApi | undefined
  scrollTo(index: number): void
  scrollPrevious(): void
  scrollNext(): void
  play(): void
  pause(): void
  /** Connects CarouselContent's scroll container. Parts other than CarouselContent don't call it. */
  connect(viewport: HTMLElement, track: HTMLElement, signal: AbortSignal): void
}

/** A slide's place, measured along the scroll axis from the start of the scrolled content. */
export interface CarouselSlideBox {
  start: number
  size: number
}

/** A scroll position the carousel stops at, and the slides it shows from its start. */
export interface CarouselSnap {
  position: number
  slides: number[]
}

// Positions closer than this count as one, as scroll positions round to pixels.
const tolerance = 1

/**
 * The snap positions of slides in a view, as CSS scroll snapping finds them:
 * each slide lines up by `align` and stops at the ends of the scroll range,
 * and slides that land on one position share a snap. Embla calls this
 * `containScroll: 'trimSnaps'`.
 */
export function carouselSnaps(
  slides: CarouselSlideBox[],
  viewSize: number,
  maxScroll: number,
  align: CarouselAlign,
): CarouselSnap[] {
  let snaps: CarouselSnap[] = []

  slides.forEach((slide, index) => {
    let offset = align === 'start' ? 0 : align === 'center' ? (viewSize - slide.size) / 2 : viewSize - slide.size
    let position = Math.min(Math.max(slide.start - offset, 0), maxScroll)
    let last = snaps[snaps.length - 1]
    if (last && Math.abs(last.position - position) < tolerance) last.slides.push(index)
    else snaps.push({ position, slides: [index] })
  })

  return snaps
}

/** The snap closest to a scroll position, the earlier one on a tie. */
export function nearestSnap(snaps: CarouselSnap[], position: number): number {
  let nearest = 0
  snaps.forEach((snap, index) => {
    let best = snaps[nearest] as CarouselSnap
    if (Math.abs(snap.position - position) < Math.abs(best.position - position)) nearest = index
  })
  return nearest
}

function sameSnaps(a: CarouselSnap[], b: CarouselSnap[]) {
  return (
    a.length === b.length &&
    a.every((snap, index) => {
      let other = b[index] as CarouselSnap
      return Math.abs(snap.position - other.position) < tolerance && snap.slides.join() === other.slides.join()
    })
  )
}

/** The snap one step away, stopping at the ends, or wrapping around them in a loop. */
export function stepSnap(index: number, step: -1 | 1, count: number, loop: boolean): number {
  if (count <= 0) return 0
  let next = index + step
  if (loop) return (next + count) % count
  return Math.min(Math.max(next, 0), count - 1)
}

/** The step an arrow key takes: Left and Right sideways, swapped in right-to-left text, or Up and Down. */
export function carouselKeyStep(
  key: string,
  orientation: CarouselOrientation,
  direction: CarouselDirection,
): -1 | 1 | undefined {
  if (orientation === 'vertical') return key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : undefined
  let back = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  let onward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  return key === back ? -1 : key === onward ? 1 : undefined
}

export interface AutoplayConditions {
  enabled: boolean
  playing: boolean
  ready: boolean
  snapCount: number
  hovered: boolean
  focused: boolean
  hidden: boolean
  reducedMotion: boolean
}

/** Whether autoplay rotates now: it's on and playing, and no hover, focus, hidden page or reduced motion holds it. */
export function autoplayRuns(conditions: AutoplayConditions): boolean {
  let { enabled, playing, ready, snapCount, hovered, focused, hidden, reducedMotion } = conditions
  return enabled && playing && ready && snapCount > 1 && !hovered && !focused && !hidden && !reducedMotion
}

const defaultDelay = 4000
// A mouse moves this far along the axis before a press becomes a drag, so clicks stay clicks.
const dragThreshold = 8
// A drag this long moves on one snap, even when it ends nearer the snap it started from.
const flickDistance = 24
// Without a scrollend event, a scroll counts as done this long after its last
// scroll event. The carousel's own smooth scrolls get longer to start moving.
const settleDelay = 150
const ownScrollDelay = 1000

// Keys inside these controls belong to them, so the carousel leaves the arrows alone.
const arrowKeyRoles = ['combobox', 'grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'scrollbar', 'slider']
const arrowKeyOwners = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  ...[...arrowKeyRoles, 'spinbutton', 'tablist', 'textbox', 'tree', 'treegrid'].map((role) => `[role="${role}"]`),
].join(', ')

// A mouse press on these never starts a drag, so fields keep their own pointer behavior.
const dragExcluded = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"])'

// A pointerdown in a nested carousel is the inner one's to drag.
const claimedPresses = new WeakSet<Event>()

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function delayOf(autoplay: CarouselOptions['autoplay']) {
  let delay = typeof autoplay === 'object' ? autoplay.delay : undefined
  return delay !== undefined && Number.isFinite(delay) && delay > 0 ? delay : defaultDelay
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
// Custom properties a caller sets on the carousel, the content, or anywhere above the slides.
const gap = `var(--carousel-gap, ${space(4)})`
const perView = 'var(--carousel-slides, 1)'

const rootStyles = css({
  position: 'relative',
  '&[data-dragging]': { userSelect: 'none', cursor: 'grabbing' },
})

const viewportStyles = css({
  overflow: 'hidden',
  '&[data-orientation="horizontal"]': {
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    // A swipe past the ends doesn't go back in history or scroll the page sideways.
    overscrollBehaviorX: 'contain',
  },
  '&[data-orientation="vertical"]': { overflowY: 'auto', scrollSnapType: 'y mandatory' },
  // Until the controls run, the scrollbar shows, so a mouse can still scroll.
  '&[data-ready]': { scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } },
})

const trackStyles = css({
  display: 'flex',
  gap,
  '&[data-orientation="vertical"]': { flexDirection: 'column' },
})

const itemStyles = css({
  minWidth: 0,
  minHeight: 0,
  flexGrow: 0,
  flexShrink: 0,
  // One slide fills the view by default; --carousel-slides fits more, with --carousel-gap between them.
  flexBasis: `var(--carousel-item-size, calc((100% - (${perView} - 1) * ${gap}) / ${perView}))`,
  scrollSnapStop: 'always',
  '&[data-align="start"]': { scrollSnapAlign: 'start' },
  '&[data-align="center"]': { scrollSnapAlign: 'center' },
  '&[data-align="end"]': { scrollSnapAlign: 'end' },
})

const hiddenText = css(visuallyHidden)

// Measures the gap for the carousel's ResizeObserver. It takes no room and adds no gap.
const gapProbeStyles = css({
  position: 'absolute',
  insetBlockStart: 0,
  insetInlineStart: 0,
  inlineSize: gap,
  blockSize: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
})

// The buttons sit outside the slides, before and after them, as in shadcn.
// They use translate and rotate, so Button's pressed transform still works.
function navigationStyles(side: 'previous' | 'next') {
  let inline = side === 'previous' ? 'insetInlineStart' : 'insetInlineEnd'
  let block = side === 'previous' ? 'top' : 'bottom'
  return css({
    position: 'absolute',
    touchAction: 'manipulation',
    '&[data-orientation="horizontal"]': { [inline]: space(-12), insetBlockStart: '50%', translate: '0 -50%' },
    '&[data-orientation="vertical"]': { [block]: space(-12), left: '50%', translate: '-50% 0', rotate: '90deg' },
    // The chevrons point the way the slides move. In a column they turn with the button instead.
    '&[data-orientation="horizontal"] svg': mirrorInRtl,
  })
}

const previousStyles = navigationStyles('previous')
const nextStyles = navigationStyles('next')

interface SlideSlot {
  position: number
  count: number
}

// Hands each direct child of CarouselContent its position, also through a component that renders the item.
function CarouselSlot(handle: Handle<{ value: SlideSlot; children?: RemixNode }, SlideSlot>) {
  return () => {
    handle.context.set(handle.props.value)
    return handle.props.children
  }
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

// CarouselContent's children in order, with arrays and fragments flattened.
function childNodes(children: RemixNode): RemixNode[] {
  let nodes: RemixNode[] = []
  let visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (isElement(node) && node.type === Fragment) return visit(node.props.children)
    nodes.push(node as RemixNode)
  }
  visit(children)
  return nodes
}

/**
 * A carousel of slides that scroll natively, with snap points. Name it with
 * aria-label or aria-labelledby. It runs in the browser inside your client
 * entry. Before that, the slides scroll with the system's scrollbar, touch
 * and keys, and the buttons are disabled.
 */
export function Carousel(handle: Handle<CarouselProps, CarouselContext>) {
  let root: HTMLElement | undefined
  let viewport: HTMLElement | undefined
  let track: HTMLElement | undefined
  let ready = false
  let snaps: CarouselSnap[] = []
  let slideList: HTMLElement[] = []
  let selected = 0
  let previous = 0
  // A scroll the carousel started, until it settles. Scroll events don't change the selection meanwhile.
  let pending: number | undefined
  let pendingReason: CarouselSelectReason = 'user'
  let announce = false
  let status = ''
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let measured: { orientation: CarouselOrientation; align: CarouselAlign; size: string; slides: number } | undefined

  let drag:
    | { pointerId: number; x: number; y: number; scroll: number; index: number; moved: boolean; stop: AbortController }
    | undefined
  let dragging = false
  let restoreSnapping = false

  let autoplayEnabled = Boolean(handle.props.autoplay)
  let playing = autoplayEnabled
  let hovered = false
  let focused = false
  let hidden = false
  // Asked anew each time: a preference can change just before a press, and
  // WebKit updates an existing query's matches, and sends its change event,
  // only at its next rendering step.
  let reducedMotionQuery = '(prefers-reduced-motion: reduce)'
  let reducedMotion = () => Boolean(root?.ownerDocument.defaultView?.matchMedia(reducedMotionQuery).matches)
  let timer: ReturnType<typeof setTimeout> | undefined
  let renderedAutoplay: CarouselAutoplayState | undefined

  let api: CarouselApi | undefined

  let orientation = () => handle.props.orientation ?? 'horizontal'
  let align = () => handle.props.align ?? 'center'
  let horizontal = () => orientation() === 'horizontal'
  let direction = (): CarouselDirection => (viewport && getComputedStyle(viewport).direction === 'rtl' ? 'rtl' : 'ltr')
  let live = () => ready && !handle.signal.aborted && viewport !== undefined
  let messages = (): CarouselMessages => ({ ...defaultCarouselMessages, ...handle.props.messages })

  // Scroll positions are logical: they grow from the start edge, also in right-to-left text.
  function scrollPosition() {
    if (!viewport) return 0
    if (!horizontal()) return viewport.scrollTop
    return direction() === 'rtl' ? -viewport.scrollLeft : viewport.scrollLeft
  }

  function scrollViewport(position: number, behavior: ScrollBehavior) {
    if (!viewport) return
    if (horizontal()) viewport.scrollTo({ left: direction() === 'rtl' ? -position : position, behavior })
    else viewport.scrollTo({ top: position, behavior })
  }

  function slideElements() {
    if (!track) return []
    return [...track.children].filter(
      (child): child is HTMLElement => child.getAttribute('data-slot') === 'carousel-item',
    )
  }

  function measure() {
    if (!viewport) return []
    let box = viewport.getBoundingClientRect()
    let position = scrollPosition()
    let rtl = direction() === 'rtl'
    slideList = slideElements()
    let boxes = slideList.map((slide) => {
      let rect = slide.getBoundingClientRect()
      if (!horizontal()) return { start: rect.top - box.top + position, size: rect.height }
      return { start: (rtl ? box.right - rect.right : rect.left - box.left) + position, size: rect.width }
    })
    let view = horizontal() ? viewport.clientWidth : viewport.clientHeight
    let range = horizontal()
      ? viewport.scrollWidth - viewport.clientWidth
      : viewport.scrollHeight - viewport.clientHeight
    // The snaps end where the last slide ends, as in Embla. Content that
    // overflows a slide, such as a long word, still scrolls into view, but
    // makes no snap of its own.
    let end = Math.max(0, ...boxes.map((slide) => slide.start + slide.size))
    let max = Math.max(0, Math.min(range, end - view))
    measured = { orientation: orientation(), align: align(), size: viewportSize(), slides: slideList.length }
    return carouselSnaps(boxes, view, max, align())
  }

  function viewportSize() {
    if (!viewport) return ''
    return [viewport.clientWidth, viewport.clientHeight, viewport.scrollWidth, viewport.scrollHeight].join(' ')
  }

  // Whether the snaps describe the layout as it is: a window resize re-snaps,
  // and sends its scroll event before any ResizeObserver callback.
  function measuredLayout() {
    return measured?.size === viewportSize() && measured.slides === slideElements().length
  }

  function dispatch(reason: CarouselSelectReason) {
    root?.dispatchEvent(new CarouselSelectEvent(selected, previous, snaps.length, reason))
  }

  function select(index: number, reason: CarouselSelectReason) {
    if (index === selected) return
    previous = selected
    selected = index
    if (reason === 'user' || reason === 'api') {
      announce = true
      syncAutoplay(true)
    }
    dispatch(reason)
    void handle.update()
  }

  function canScroll(step: -1 | 1) {
    if (!ready || snaps.length < 2) return false
    if (handle.props.loop) return true
    return step < 0 ? selected > 0 : selected < snaps.length - 1
  }

  function scrollToSnap(index: number, reason: CarouselSelectReason, instant = false) {
    if (!live() || snaps.length === 0 || !Number.isFinite(index)) return
    let target = clamp(Math.trunc(index), 0, snaps.length - 1)
    let position = (snaps[target] as CarouselSnap).position
    select(target, reason)
    if (Math.abs(scrollPosition() - position) < tolerance) {
      pending = undefined
      settle()
      return
    }
    pending = target
    pendingReason = reason
    scrollViewport(position, instant || reducedMotion() ? 'instant' : 'smooth')
    waitForSettle()
  }

  function step(delta: -1 | 1, reason: CarouselSelectReason, instant = false) {
    if (!canScroll(delta)) return
    scrollToSnap(stepSnap(selected, delta, snaps.length, Boolean(handle.props.loop)), reason, instant)
  }

  function waitForSettle() {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(settle, pending === undefined ? settleDelay : ownScrollDelay)
  }

  // A scroll ended: the carousel's own, a touch or wheel scroll, or a drag's last snap.
  function settle() {
    clearTimeout(settleTimer)
    settleTimer = undefined
    if (dragging || !viewport) return
    // Where a scroll of the carousel's own ended counts as its change, so autoplay stays unannounced.
    let reason = pending === undefined ? 'user' : pendingReason
    pending = undefined
    if (restoreSnapping) {
      restoreSnapping = false
      viewport.style.removeProperty('scroll-snap-type')
    }
    // Someone may have scrolled on while the carousel's own scroll ran.
    select(nearestSnap(snaps, scrollPosition()), reason)
    if (announce) {
      announce = false
      let slides = snaps[selected]?.slides ?? []
      let first = (slides[0] ?? 0) + 1
      let last = (slides[slides.length - 1] ?? 0) + 1
      status = messages().selected(first, last, slideList.length)
      void handle.update()
    }
  }

  function onScroll() {
    if (ready && !measuredLayout()) remeasure('layout')
    else if (pending === undefined && !dragging) select(nearestSnap(snaps, scrollPosition()), 'user')
    if (!dragging) waitForSettle()
  }

  // The first slide of the selected snap stays selected and in view when slides come and go or the size changes.
  function remeasure(reason: 'init' | 'layout') {
    if (!ready || !viewport) return
    let count = snaps.length
    let before = selected
    let anchor = slideList[snaps[pending ?? selected]?.slides[0] ?? -1]
    let old = snaps
    snaps = measure()

    let index: number
    if (reason === 'init')
      index = clamp(Math.trunc(handle.props.startIndex ?? 0) || 0, 0, Math.max(0, snaps.length - 1))
    else if (anchor && slideList.includes(anchor)) {
      let slide = slideList.indexOf(anchor)
      index = Math.max(
        0,
        snaps.findIndex((snap) => snap.slides.includes(slide)),
      )
    } else {
      // The slide is gone: as in Embla, the snap keeps its index, so the next slide takes its place.
      index = clamp(pending ?? selected, 0, Math.max(0, snaps.length - 1))
    }

    if (index !== before) {
      previous = before
      selected = index
    }
    // A scroll still on its way aims at an old position, so the carousel jumps to the new one.
    if (!dragging) {
      pending = undefined
      alignTo(index)
    }
    if (reason === 'init' || count !== snaps.length || index !== before) {
      dispatch(reason)
      syncAutoplay()
      void handle.update()
    } else if (!sameSnaps(old, snaps)) {
      // Snaps that moved or regrouped their slides, such as after a new
      // alignment, change what the parts show, though no event fires.
      void handle.update()
    }
  }

  function alignTo(index: number) {
    let snap = snaps[index]
    if (!snap || Math.abs(scrollPosition() - snap.position) < tolerance) return
    pending = index
    pendingReason = 'layout'
    scrollViewport(snap.position, 'instant')
    waitForSettle()
  }

  // A scrollend can belong to an earlier scroll, such as a drag's last move,
  // while the carousel's own scroll still runs. That one settles at its snap,
  // or once the scroll events stop.
  function onScrollEnd() {
    let target = pending === undefined ? undefined : snaps[pending]
    if (target && Math.abs(scrollPosition() - target.position) >= tolerance) waitForSettle()
    else settle()
  }

  // Layout changes arrive in a ResizeObserver or MutationObserver callback,
  // before the scroll events that the browser's re-snapping sends. Measuring
  // right away keeps those events from meeting the old snaps.
  let measureLayout = () => remeasure('layout')

  function connect(element: HTMLElement, content: HTMLElement, signal: AbortSignal) {
    viewport = element
    track = content
    let resizes = new ResizeObserver(measureLayout)
    let watch = () => {
      resizes.disconnect()
      resizes.observe(element)
      for (let slide of slideElements()) resizes.observe(slide)
      // A new gap moves the slides without resizing any of them. The probe is as wide as the gap.
      let probe = content.querySelector(':scope > [data-slot="carousel-gap"]')
      if (probe) resizes.observe(probe)
    }
    let mutations = new MutationObserver(() => {
      watch()
      measureLayout()
    })
    watch()
    mutations.observe(content, { childList: true })

    element.addEventListener('scroll', onScroll, { passive: true, signal })
    element.addEventListener('scrollend', onScrollEnd, { signal })
    element.addEventListener('pointerdown', onPointerDown, { signal })
    element.addEventListener('dragstart', (event) => drag && event.preventDefault(), { signal })

    signal.addEventListener('abort', () => {
      resizes.disconnect()
      mutations.disconnect()
      if (viewport !== element) return
      viewport = undefined
      track = undefined
      snaps = []
      slideList = []
      pending = undefined
      restoreSnapping = false
      clearTimeout(settleTimer)
      endDrag(true)
      if (!handle.signal.aborted && ready) void handle.update()
    })
    if (ready) measureLayout()
  }

  function onPointerDown(event: PointerEvent) {
    if (!live() || handle.props.mouseDrag === false || claimedPresses.has(event)) return
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.defaultPrevented) return
    if (event.target instanceof Element && event.target.closest(dragExcluded)) return
    if (snaps.length < 2) return
    claimedPresses.add(event)

    endDrag(true)
    let stop = new AbortController()
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scroll: scrollPosition(),
      index: selected,
      moved: false,
      stop,
    }
    let view = event.view ?? window
    let options = { signal: stop.signal }
    view.addEventListener('pointermove', onPointerMove, options)
    view.addEventListener('pointerup', (up) => up.pointerId === drag?.pointerId && endDrag(false), options)
    view.addEventListener('pointercancel', (cancel) => cancel.pointerId === drag?.pointerId && endDrag(true), options)
    handle.signal.addEventListener('abort', () => stop.abort(), options)
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId || !viewport) return
    let along = horizontal() ? event.clientX - drag.x : event.clientY - drag.y
    let across = horizontal() ? event.clientY - drag.y : event.clientX - drag.x

    if (!drag.moved) {
      if (Math.abs(along) < dragThreshold) return
      // A press that moves across the carousel selects text or scrolls the page instead.
      if (Math.abs(across) > Math.abs(along)) return endDrag(true)
      drag.moved = true
      dragging = true
      pending = undefined
      clearTimeout(settleTimer)
      // Snapping would pull every scroll position back to a snap while the mouse moves.
      viewport.style.setProperty('scroll-snap-type', 'none')
      restoreSnapping = true
      viewport.ownerDocument.getSelection()?.removeAllRanges()
      try {
        viewport.setPointerCapture(event.pointerId)
      } catch {
        // A script's synthetic pointer can't be captured. The window listeners still follow it.
      }
      void handle.update()
    }

    event.preventDefault()
    let sign = horizontal() && direction() === 'rtl' ? -1 : 1
    scrollViewport(drag.scroll - along * sign, 'instant')
  }

  function endDrag(cancelled: boolean) {
    let ended = drag
    drag = undefined
    if (!ended) return
    ended.stop.abort()
    if (!ended.moved) return
    dragging = false
    // Removed in the middle of a drag: there's nothing left to snap.
    if (!live() || !viewport) return

    // The click that ends a drag doesn't follow a link or press a button in a slide.
    let swallow = new AbortController()
    viewport.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        swallow.abort()
      },
      { capture: true, signal: swallow.signal },
    )
    setTimeout(() => swallow.abort(), 0)

    let position = scrollPosition()
    let moved = position - ended.scroll
    let index = nearestSnap(snaps, position)
    if (!cancelled && index === ended.index && Math.abs(moved) > flickDistance) {
      index = clamp(ended.index + Math.sign(moved), 0, snaps.length - 1)
    }
    scrollToSnap(index, 'user')
    void handle.update()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!live() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    let delta = carouselKeyStep(event.key, orientation(), direction())
    if (!delta) return
    let owner = event.target instanceof Element ? event.target.closest(arrowKeyOwners) : null
    if (owner && root?.contains(owner)) return
    event.preventDefault()
    step(delta, 'user')
  }

  function autoplayState(): CarouselAutoplayState | undefined {
    if (!autoplayEnabled || !ready) return undefined
    if (!playing) return 'stopped'
    let runs = autoplayRuns({
      enabled: autoplayEnabled,
      playing,
      ready,
      snapCount: snaps.length,
      hovered,
      focused,
      hidden,
      reducedMotion: reducedMotion(),
    })
    return runs ? 'running' : 'paused'
  }

  // Starts or stops the timer to match the conditions. A change the user or
  // the API makes starts the delay over.
  function syncAutoplay(restart = false) {
    let state = autoplayState()
    if (state !== 'running' || handle.signal.aborted) {
      clearTimeout(timer)
      timer = undefined
    } else if (restart || timer === undefined) {
      clearTimeout(timer)
      timer = setTimeout(advance, delayOf(handle.props.autoplay))
    }
    if (state !== renderedAutoplay && ready && !handle.signal.aborted) void handle.update()
  }

  // Autoplay moves on one snap, and back to the first after the last, as
  // Embla's Autoplay does. It never moves focus.
  function advance() {
    timer = undefined
    if (autoplayState() !== 'running') return
    scrollToSnap(selected + 1 < snaps.length ? selected + 1 : 0, 'autoplay')
    syncAutoplay()
  }

  function play() {
    if (!autoplayEnabled) return
    playing = true
    // Pressing play wins over the hover and focus that pressing it took.
    hovered = false
    focused = false
    syncAutoplay(true)
  }

  function pause() {
    if (!autoplayEnabled) return
    playing = false
    syncAutoplay()
  }

  let rootEvents = [
    on<HTMLDivElement, 'keydown'>('keydown', onKeyDown),
    on<HTMLDivElement, 'pointerenter'>('pointerenter', (event) => {
      if (event.pointerType === 'touch') return
      hovered = true
      syncAutoplay()
    }),
    on<HTMLDivElement, 'pointerleave'>('pointerleave', () => {
      hovered = false
      syncAutoplay()
    }),
    on<HTMLDivElement, 'focusin'>('focusin', () => {
      focused = true
      syncAutoplay()
    }),
    // Focus may move inside the carousel, or the focused element may be removed. Decide once it settles.
    on<HTMLDivElement, 'focusout'>('focusout', () => {
      queueMicrotask(() => {
        let element = root
        focused = Boolean(element && element.contains(element.ownerDocument.activeElement))
        syncAutoplay()
      })
    }),
    ref<HTMLDivElement>((node, signal) => {
      root = node
      signal.addEventListener('abort', () => {
        if (root === node) root = undefined
      })
    }),
  ]

  function createApi(element: HTMLElement): CarouselApi {
    return {
      root: element,
      get connected() {
        return live() && root === element
      },
      get selectedIndex() {
        return selected
      },
      get previousIndex() {
        return previous
      },
      get snapCount() {
        return snaps.length
      },
      get slides() {
        return live() ? slideElements() : []
      },
      slidesInSnap: (index) => [...(snaps[index]?.slides ?? [])],
      get canScrollPrevious() {
        return live() && canScroll(-1)
      },
      get canScrollNext() {
        return live() && canScroll(1)
      },
      scrollTo: (index, options) => scrollToSnap(index, 'api', options?.instant),
      scrollPrevious: (options) => live() && step(-1, 'api', options?.instant),
      scrollNext: (options) => live() && step(1, 'api', options?.instant),
      get playing() {
        return playing
      },
      get autoplayState() {
        return autoplayState()
      },
      play: () => live() && play(),
      pause: () => live() && pause(),
    }
  }

  function init() {
    if (ready || !root || handle.signal.aborted) return
    ready = true
    let element = root
    let document = element.ownerDocument
    let view = document.defaultView ?? window

    view.matchMedia(reducedMotionQuery).addEventListener('change', () => syncAutoplay(), { signal: handle.signal })
    // Styles for other widths, such as padding in a media query, can move the
    // slides without resizing them. Media queries apply after the resize
    // event, so the carousel looks in the next frame.
    let frame = 0
    view.addEventListener(
      'resize',
      () => {
        view.cancelAnimationFrame(frame)
        frame = view.requestAnimationFrame(() => {
          if (viewport && !measuredLayout()) remeasure('layout')
        })
      },
      { signal: handle.signal },
    )
    handle.signal.addEventListener('abort', () => view.cancelAnimationFrame(frame))
    hidden = document.visibilityState === 'hidden'
    document.addEventListener(
      'visibilitychange',
      () => {
        hidden = document.visibilityState === 'hidden'
        syncAutoplay()
      },
      { signal: handle.signal },
    )
    handle.signal.addEventListener('abort', () => {
      clearTimeout(timer)
      clearTimeout(settleTimer)
      endDrag(true)
    })

    remeasure('init')
    api = createApi(element)
    handle.props.setApi?.(api)
    syncAutoplay()
    void handle.update()
  }

  return () => {
    let {
      orientation: _orientation,
      align: _align,
      loop = false,
      startIndex: _startIndex,
      autoplay,
      mouseDrag: _mouseDrag,
      setApi: _setApi,
      messages: _messages,
      children,
      mix,
      ...props
    } = handle.props

    // Turning autoplay on later starts it, as it starts on the first render.
    if (Boolean(autoplay) !== autoplayEnabled) {
      autoplayEnabled = Boolean(autoplay)
      playing = autoplayEnabled
      handle.queueTask(() => syncAutoplay(true))
    }
    // Snap positions follow the orientation and alignment, which no observer sees change.
    if (ready && measured && (measured.orientation !== orientation() || measured.align !== align())) {
      handle.queueTask(() => remeasure('layout'))
    }
    if (!ready) handle.queueTask(init)

    let state = autoplayState()
    renderedAutoplay = state
    let context: CarouselContext = {
      orientation: orientation(),
      align: align(),
      loop,
      ready,
      selectedIndex: selected,
      snapCount: snaps.length,
      selectedSlides: snaps[selected]?.slides ?? [],
      canScrollPrevious: canScroll(-1),
      canScrollNext: canScroll(1),
      autoplay: autoplayEnabled,
      playing,
      autoplayState: state,
      messages: messages(),
      api,
      scrollTo: (index) => scrollToSnap(index, 'user'),
      scrollPrevious: () => step(-1, 'user'),
      scrollNext: () => step(1, 'user'),
      play,
      pause,
      connect,
    }
    handle.context.set(context)

    return (
      <div
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
        data-orientation={orientation()}
        data-ready={ready ? 'true' : undefined}
        data-autoplay={state}
        data-dragging={dragging ? 'true' : undefined}
        mix={[rootStyles, mix, rootEvents]}
      >
        {children}
        <div data-slot="carousel-status" aria-live="polite" aria-atomic="true" mix={hiddenText}>
          {status}
        </div>
      </div>
    )
  }
}

/**
 * The scroll container and the row or column of slides inside it. Its props
 * go to the row, as in shadcn: give a vertical carousel's content a height.
 * The scroll container takes keyboard focus, so the arrows reach it.
 */
export function CarouselContent(handle: Handle<Props<'div'>>) {
  let viewportRef = ref<HTMLDivElement>((node, signal) => {
    let content = node.firstElementChild
    let carousel = handle.context.get(Carousel) as CarouselContext | undefined
    if (carousel && content instanceof HTMLElement) carousel.connect(node, content, signal)
  })

  return () => {
    let carousel = handle.context.get(Carousel) as CarouselContext | undefined
    let { children, mix, ...props } = handle.props
    let orientation = carousel?.orientation ?? 'horizontal'
    let nodes = childNodes(children)
    let count = nodes.filter(isElement).length
    let position = 0

    return (
      <div
        data-slot="carousel-content"
        data-orientation={orientation}
        data-ready={carousel?.ready ? 'true' : undefined}
        tabIndex={0}
        mix={[viewportStyles, viewportRef]}
      >
        <div data-slot="carousel-track" data-orientation={orientation} {...props} mix={[trackStyles, mix]}>
          {nodes.map((node) => {
            if (!isElement(node)) return node
            position++
            let key = node.key === undefined || node.key === null ? `#${position}` : String(node.key)
            return (
              <CarouselSlot key={key} value={{ position, count }}>
                {node}
              </CarouselSlot>
            )
          })}
          <div data-slot="carousel-gap" aria-hidden="true" mix={gapProbeStyles} />
        </div>
      </div>
    )
  }
}

/**
 * One slide: a group named by its position, such as "2 of 5", unless you
 * give it an aria-label. Put one in each child of CarouselContent.
 * `data-selected` marks the slides of the selected snap.
 */
export function CarouselItem(handle: Handle<Props<'div'>>) {
  return () => {
    let carousel = handle.context.get(Carousel) as CarouselContext | undefined
    let slot = handle.context.get(CarouselSlot) as SlideSlot | undefined
    let { mix, ...props } = handle.props
    let messages = carousel?.messages ?? defaultCarouselMessages
    let selected = Boolean(slot && carousel?.ready && carousel.selectedSlides.includes(slot.position - 1))

    return (
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={slot ? messages.slide(slot.position, slot.count) : undefined}
        data-slot="carousel-item"
        data-orientation={carousel?.orientation ?? 'horizontal'}
        data-align={carousel?.align ?? 'center'}
        data-selected={selected ? 'true' : undefined}
        {...props}
        mix={[itemStyles, mix]}
      />
    )
  }
}

export interface CarouselButtonProps extends ButtonProps {
  /** The button's name, hidden but read aloud. Your children replace the icon and the name. */
  label?: string
}

function navigationButton(side: 'previous' | 'next') {
  let slot = side === 'previous' ? 'carousel-previous' : 'carousel-next'
  let defaultLabel = side === 'previous' ? 'Previous slide' : 'Next slide'
  let styles = side === 'previous' ? previousStyles : nextStyles
  let Chevron = side === 'previous' ? ChevronLeftIcon : ChevronRightIcon

  return function CarouselNavigation(handle: Handle<CarouselButtonProps>) {
    let carousel: CarouselContext | undefined
    let click = on<HTMLButtonElement, 'click'>('click', () =>
      side === 'previous' ? carousel?.scrollPrevious() : carousel?.scrollNext(),
    )

    return () => {
      carousel = handle.context.get(Carousel) as CarouselContext | undefined
      let {
        label = defaultLabel,
        variant = 'outline',
        size = 'icon-sm',
        disabled,
        children,
        mix,
        ...props
      } = handle.props
      let enabled = Boolean(
        carousel?.ready && (side === 'previous' ? carousel.canScrollPrevious : carousel.canScrollNext),
      )

      return (
        <Button
          data-slot={slot}
          data-orientation={carousel?.orientation ?? 'horizontal'}
          variant={variant}
          size={size}
          {...props}
          // At an end the button stays focusable, so focus doesn't drop to the page.
          disabled={disabled || !enabled}
          focusableWhenDisabled
          mix={[styles, mix, click]}
        >
          {children ?? [
            <Chevron key="icon" />,
            <span key="label" mix={hiddenText}>
              {label}
            </span>,
          ]}
        </Button>
      )
    }
  }
}

/** Scrolls to the previous snap. It sits before the slides, outside them, and is disabled at the first snap unless the carousel loops. */
export const CarouselPrevious = navigationButton('previous')

/** Scrolls to the next snap. It sits after the slides, outside them, and is disabled at the last snap unless the carousel loops. */
export const CarouselNext = navigationButton('next')

function PauseIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M8.5 5.5v13M15.5 5.5v13" />
    </Icon>
  )
}

function PlayIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M7.5 5v14l11-7Z" />
    </Icon>
  )
}

export interface CarouselAutoplayToggleProps extends ButtonProps {
  /** The name while autoplay rotates. */
  stopLabel?: string
  /** The name while autoplay is stopped. */
  startLabel?: string
}

/**
 * Stops and starts autoplay: the rotation control that WCAG's Pause, Stop,
 * Hide asks for. Place it where you like inside the carousel. It's disabled
 * without autoplay, and until the carousel runs in the browser.
 */
export function CarouselAutoplayToggle(handle: Handle<CarouselAutoplayToggleProps>) {
  let carousel: CarouselContext | undefined
  let click = on<HTMLButtonElement, 'click'>('click', () => (carousel?.playing ? carousel.pause() : carousel?.play()))

  return () => {
    carousel = handle.context.get(Carousel) as CarouselContext | undefined
    let {
      stopLabel = 'Stop slide rotation',
      startLabel = 'Start slide rotation',
      variant = 'outline',
      size = 'icon-sm',
      disabled,
      mix,
      ...props
    } = handle.props
    let playing = carousel?.playing ?? false

    return (
      <Button
        data-slot="carousel-autoplay-toggle"
        data-state={playing ? 'playing' : 'stopped'}
        variant={variant}
        size={size}
        {...props}
        disabled={disabled || !carousel?.ready || !carousel.autoplay}
        mix={[mix, click]}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        <span mix={hiddenText}>{playing ? stopLabel : startLabel}</span>
      </Button>
    )
  }
}
