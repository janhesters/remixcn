// RemixCN Message Scroller: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, MixValue, Props, RemixNode } from 'remix/component'

import { ArrowDownIcon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'

// A chat transcript in a native scroll container. The server renders every
// row, so the transcript reads, scrolls and searches without JavaScript. In
// the browser, inside a client entry of the app, the provider keeps the
// reader's place: it opens at the end or at the last turn, follows new
// content only while the reader follows the end, starts a new turn near the
// top, holds the visible row when rows arrive above it or change size, and
// jumps to any row. It never moves focus while it scrolls.
//
// Scrolling and streaming change the scroll state on every frame, so the
// provider writes it to the DOM as data attributes instead of rendering
// again. Only the jump buttons and the components that watch the state
// render when it changes.

export type MessageScrollerDefaultScrollPosition = 'start' | 'end' | 'last-anchor'
export type MessageScrollerScrollAlign = 'start' | 'center' | 'end' | 'nearest'
export type MessageScrollerButtonDirection = 'start' | 'end'

/** Options for scrollToMessage, scrollToEnd and scrollToStart. */
export interface MessageScrollerScrollOptions {
  /** Where the message lands in the viewport. Defaults to start. */
  align?: MessageScrollerScrollAlign
  /** The native scroll behavior. Defaults to auto. Smooth turns instant for reduced motion. */
  behavior?: ScrollBehavior
  /** Pixels between the message and the aligned edge. Defaults to the provider's scrollMargin. */
  scrollMargin?: number
}

/** Which edges the viewport can still scroll toward. */
export interface MessageScrollerScrollable {
  /** Content is hidden above. */
  start: boolean
  /** Content is hidden below. Stays false while the scroller follows the end. */
  end: boolean
}

/** Where the reader is in the transcript. */
export interface MessageScrollerVisibility {
  /** The last anchored row at or above the reading line. It stays set after the row scrolls out above. */
  currentAnchorId: string | null
  /** The messageId of every row in view, top to bottom. */
  visibleMessageIds: string[]
}

/** The commands and the state of the nearest MessageScrollerProvider. */
export interface MessageScrollerApi {
  /**
   * Scrolls a row with this messageId into view. Before any row has mounted,
   * it waits for that row. Returns false when no row has the id.
   */
  scrollToMessage(messageId: string, options?: MessageScrollerScrollOptions): boolean
  /** Scrolls to the latest row and follows the end again when autoScroll is on. Returns false before the viewport mounts. */
  scrollToEnd(options?: MessageScrollerScrollOptions): boolean
  /** Scrolls to the first row. Returns false before the viewport mounts. */
  scrollToStart(options?: MessageScrollerScrollOptions): boolean
  /** Which edges the viewport can scroll toward now. */
  readonly scrollable: MessageScrollerScrollable
  /** Where the reader is, while something tracks it with onVisibilityChange or watchMessageScrollerVisibility. */
  readonly visibility: MessageScrollerVisibility
  /** Calls the listener whenever scrollable changes, until the signal aborts. */
  onScrollableChange(listener: (scrollable: MessageScrollerScrollable) => void, signal: AbortSignal): void
  /** Tracks which rows are in view and calls the listener when that changes, until the signal aborts. */
  onVisibilityChange(listener: (visibility: MessageScrollerVisibility) => void, signal: AbortSignal): void
}

export interface MessageScrollerProviderProps {
  children?: RemixNode
  /** Follows new content while the reader is at the end. Scrolling away pauses it, and scrollToEnd resumes it. */
  autoScroll?: boolean
  /** Where a transcript opens once it has rows: the end (default), the start, or the last anchored turn. */
  defaultScrollPosition?: MessageScrollerDefaultScrollPosition
  /** Pixels from an edge that still count as being at it. Defaults to 8. */
  scrollEdgeThreshold?: number
  /** Pixels of the previous row kept in view above a new anchored turn. Defaults to 64. */
  scrollPreviousItemPeek?: number
  /** Pixels between a jump target and the aligned edge. Defaults to 0. */
  scrollMargin?: number
}

export interface MessageScrollerProps extends Props<'div'> {}

export interface MessageScrollerViewportProps extends Props<'div'> {
  /** Keeps the first visible row in place when older rows are added above it. Defaults to true. */
  preserveScrollOnPrepend?: boolean
}

export interface MessageScrollerContentProps extends Props<'div'> {
  /** Mixins for the spacer after the rows, which makes room to start a new turn near the top. */
  spacerMix?: MixValue
}

export interface MessageScrollerItemProps extends Props<'div'> {
  /** A stable id for jumps, visibility and keeping the place when rows arrive above. */
  messageId?: string
  /** Marks the row that starts a turn: a new one lands near the top, and last-anchor opens there. */
  scrollAnchor?: boolean
}

export interface MessageScrollerButtonProps extends ButtonProps {
  /** The edge the button scrolls to. Defaults to end. */
  direction?: MessageScrollerButtonDirection
  /** The scroll behavior. Defaults to smooth, which turns instant for reduced motion. */
  behavior?: ScrollBehavior
}

type Mode =
  // autoScroll is on and the reader is at the end.
  | 'following-bottom'
  // The reader scrolled away. The position stays, and rows added above it keep their place.
  | 'free-scrolling'
  // A new turn is held near the top while its reply streams in below.
  | 'anchored-to-message'
  // A jump to a message moved the view. Following waits for the reader's next gesture.
  | 'settling-jump'

interface Options {
  autoScroll: boolean
  defaultScrollPosition: MessageScrollerDefaultScrollPosition
  scrollEdgeThreshold: number
  scrollPreviousItemPeek: number
  scrollMargin: number
}

interface Anchor {
  element: HTMLElement
  top: number
  height: number
}

// Two scroll positions this close are the same, for zoom and HiDPI rounding.
const epsilon = 0.5
// How long data-autoscrolling stays after a scroll to the end starts.
const autoscrollingFor = 180
// Keys that scroll the viewport, and so pause following.
const scrollKeys = new Set(['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '])
const emptyScrollable: MessageScrollerScrollable = { start: false, end: false }
const emptyVisibility: MessageScrollerVisibility = { currentAnchorId: null, visibleMessageIds: [] }

function readOptions(props: MessageScrollerProviderProps): Options {
  return {
    autoScroll: props.autoScroll ?? false,
    defaultScrollPosition: props.defaultScrollPosition ?? 'end',
    scrollEdgeThreshold: props.scrollEdgeThreshold ?? 8,
    scrollPreviousItemPeek: props.scrollPreviousItemPeek ?? 64,
    scrollMargin: props.scrollMargin ?? 0,
  }
}

function pixels(value: string | undefined) {
  let number = Number.parseFloat(value ?? '')
  return Number.isFinite(number) ? number : 0
}

function blockPadding(element: Element) {
  let style = getComputedStyle(element)
  return { start: pixels(style.paddingBlockStart), end: pixels(style.paddingBlockEnd) }
}

function rowGap(element: Element) {
  let style = getComputedStyle(element)
  return pixels(style.rowGap === 'normal' ? '0' : style.rowGap)
}

function isAnchor(item: HTMLElement) {
  return item.dataset.scrollAnchor === 'true'
}

// An element's top in the viewport's scrolled content, and relative to its visible top edge.
function contentTop(element: Element, viewport: HTMLElement) {
  return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
}

function viewportTop(element: Element, viewport: HTMLElement) {
  return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
}

function maxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight)
}

function sameScrollable(a: MessageScrollerScrollable, b: MessageScrollerScrollable) {
  return a.start === b.start && a.end === b.end
}

function sameVisibility(a: MessageScrollerVisibility, b: MessageScrollerVisibility) {
  return (
    a.currentAnchorId === b.currentAnchorId &&
    a.visibleMessageIds.length === b.visibleMessageIds.length &&
    a.visibleMessageIds.every((id, index) => id === b.visibleMessageIds[index])
  )
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * One transcript's scroll behavior. The provider makes one per instance and
 * the parts attach their elements to it. Everything it starts, observers,
 * listeners, frames and timers, stops when its parts or the provider leave.
 */
function createScroller(initial: Options) {
  let options = initial
  let root: HTMLElement | undefined
  let viewport: HTMLElement | undefined
  let content: HTMLElement | undefined
  let spacer: HTMLElement | undefined
  let preserveScrollOnPrepend = true

  let mode: Mode = options.autoScroll ? 'following-bottom' : 'free-scrolling'
  // The server can't scroll, so the viewport stays hidden until the browser applies the opening position.
  let pending = options.defaultScrollPosition !== 'start'
  let openingApplied = false
  let itemCount = 0
  // The first row with a messageId. Message rows that arrive before it are older history.
  let firstMessage: HTMLElement | null = null
  let lastScrollTop = 0
  let autoscrolling = false
  let autoscrollingTimer: ReturnType<typeof setTimeout> | undefined
  // The turn held near the top while its reply streams in below it.
  let heldTurn: HTMLElement | null = null
  let pendingTarget: { messageId: string; options?: MessageScrollerScrollOptions } | null = null
  // The first visible row, so rows added or resized above it can't move it.
  let anchor: Anchor | null = null
  // The message the last jump aimed for, and whether a smooth scroll is still on its way there.
  let jump: { element: HTMLElement; options: MessageScrollerScrollOptions; top: number; smooth: boolean } | null = null
  let spacerHeight = 0
  // Anchored rows the scroller has already seen. Only a row it hasn't seen starts a new turn.
  let seenAnchors = new WeakSet<HTMLElement>()

  let scrollable = emptyScrollable
  let visibility = emptyVisibility
  let scrollableListeners = new Set<(scrollable: MessageScrollerScrollable) => void>()
  let visibilityListeners = new Set<(visibility: MessageScrollerVisibility) => void>()
  let visibilityObserver: IntersectionObserver | undefined
  let observed = new Set<HTMLElement>()
  let inView = new Set<Element>()
  let frames = new Map<string, number>()

  function schedule(name: string, task: () => void) {
    if (frames.has(name)) return
    frames.set(
      name,
      requestAnimationFrame(() => {
        frames.delete(name)
        task()
      }),
    )
  }

  function items() {
    if (!content) return []
    return Array.from(content.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child !== spacer,
    )
  }

  function findItem(messageId: string) {
    return items().find((item) => item.dataset.messageId === messageId)
  }

  // The bottom of the rows, without the spacer, in the viewport's scrolled content.
  function contentBottom() {
    if (!content || !viewport) return 0
    let padding = blockPadding(content)
    let top = viewport.getBoundingClientRect().top
    let bottom = padding.start + padding.end
    for (let item of items()) {
      bottom = Math.max(bottom, item.getBoundingClientRect().bottom - top + viewport.scrollTop + padding.end)
    }
    return bottom
  }

  function measureScrollable(): MessageScrollerScrollable {
    if (!viewport || !content) return emptyScrollable
    return {
      start: viewport.scrollTop > options.scrollEdgeThreshold,
      end: contentBottom() - viewport.scrollTop - viewport.clientHeight > options.scrollEdgeThreshold,
    }
  }

  // The state last written to the frame and the viewport, so a scroll that changes nothing writes nothing.
  let written = ''

  function writeAttributes({ force = false } = {}) {
    let edges = [scrollable.start && 'start', scrollable.end && 'end'].filter(Boolean).join(' ')
    let state = `${edges}|${autoscrolling}`
    if (state === written && !force) return
    written = state
    for (let element of [root, viewport]) {
      if (!element) continue
      if (edges) element.setAttribute('data-scrollable', edges)
      else element.removeAttribute('data-scrollable')
      element.toggleAttribute('data-autoscrolling', autoscrolling)
    }
  }

  // Arms following at the end and releases it when the reader moves up, also
  // by dragging the scrollbar while a reply streams. The scroller's own
  // scrolls to the end only move down, so they never release it. A held turn
  // reads as "at the end" because of the spacer, so it can't arm it.
  function reconcileFollowMode(next: MessageScrollerScrollable) {
    let top = viewport?.scrollTop ?? 0
    // Content growing past the end also reads as not at the end, but only a reader moves scrollTop up.
    let scrolledUp = top < lastScrollTop - epsilon
    lastScrollTop = top

    if (options.autoScroll && !next.end && mode !== 'settling-jump' && mode !== 'anchored-to-message') {
      mode = 'following-bottom'
    } else if (mode === 'following-bottom' && next.end && scrolledUp) {
      mode = 'free-scrolling'
    }
  }

  function commitScrollState() {
    let next = measureScrollable()
    reconcileFollowMode(next)
    // While following, the scroller closes each gap a streamed chunk opens, so the end button doesn't flicker.
    let published = mode === 'following-bottom' ? { ...next, end: false } : next
    let changed = !sameScrollable(scrollable, published)
    if (changed) scrollable = published
    writeAttributes()
    if (changed) for (let listener of scrollableListeners) listener(scrollable)
  }

  function scheduleStateCommit() {
    schedule('state', commitScrollState)
  }

  function measureVisibility(): MessageScrollerVisibility {
    if (!content || !viewport) return emptyVisibility
    let box = viewport.getBoundingClientRect()
    // Rows only peeking in above the reading line haven't been read down to yet.
    let line = box.top + options.scrollMargin + options.scrollPreviousItemPeek
    let byLayout = !visibilityObserver
    let visible: string[] = []
    let currentAnchorId: string | null = null

    for (let item of items()) {
      let id = item.dataset.messageId
      if (!id) continue
      let rect = isAnchor(item) || byLayout ? item.getBoundingClientRect() : undefined
      let isVisible = byLayout && rect ? rect.bottom > line && rect.top < box.bottom : inView.has(item)
      if (isVisible) visible.push(id)
      if (isAnchor(item) && rect && rect.top <= line + epsilon) currentAnchorId = id
    }

    return visible.length === 0 && currentAnchorId === null
      ? emptyVisibility
      : { currentAnchorId, visibleMessageIds: visible }
  }

  function scheduleVisibilitySync() {
    if (visibilityListeners.size === 0) return
    schedule('visibility', () => {
      // The last listener may have left since.
      if (visibilityListeners.size === 0) return
      let next = measureVisibility()
      if (sameVisibility(visibility, next)) return
      visibility = next
      for (let listener of visibilityListeners) listener(visibility)
    })
  }

  function startVisibility() {
    if (visibilityListeners.size === 0 || !viewport || visibilityObserver) return
    if (typeof IntersectionObserver !== 'function') return scheduleVisibilitySync()
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (let entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target)
          else inView.delete(entry.target)
        }
        scheduleVisibilitySync()
      },
      {
        root: viewport,
        // The top edge sits on the reading line, as in measureVisibility.
        rootMargin: `${-(options.scrollMargin + options.scrollPreviousItemPeek)}px 0px 0px 0px`,
        threshold: [0, 0.01, 0.5, 1],
      },
    )
    observed.clear()
    observeItems()
    scheduleVisibilitySync()
  }

  function stopVisibility() {
    visibilityObserver?.disconnect()
    visibilityObserver = undefined
    observed.clear()
    inView.clear()
    let frame = frames.get('visibility')
    if (frame !== undefined) cancelAnimationFrame(frame)
    frames.delete('visibility')
    visibility = emptyVisibility
  }

  function observeItems() {
    if (!visibilityObserver) return
    let current = new Set(items().filter((item) => item.dataset.messageId))
    for (let item of observed) {
      if (current.has(item)) continue
      visibilityObserver.unobserve(item)
      observed.delete(item)
      inView.delete(item)
    }
    for (let item of current) {
      if (observed.has(item)) continue
      visibilityObserver.observe(item)
      observed.add(item)
    }
  }

  function setAutoscrolling(on: boolean) {
    clearTimeout(autoscrollingTimer)
    autoscrollingTimer = undefined
    if (autoscrolling !== on) {
      autoscrolling = on
      commitScrollState()
    }
    if (on) {
      autoscrollingTimer = setTimeout(() => {
        autoscrollingTimer = undefined
        autoscrolling = false
        commitScrollState()
      }, autoscrollingFor)
    }
  }

  function setSpacerHeight(height: number) {
    if (!spacer) return
    let next = Math.max(0, Math.ceil(height))
    if (next === spacerHeight) return
    spacerHeight = next
    spacer.hidden = next === 0
    spacer.style.height = `${next}px`
    // The spacer adds no gap of its own after the last row.
    spacer.style.marginBlockStart = next > 0 && content ? `${-rowGap(content)}px` : ''
  }

  function scrollToPosition(
    top: number,
    { behavior = 'auto', autoscroll = false }: { behavior?: ScrollBehavior; autoscroll?: boolean },
  ) {
    if (!viewport) return
    let next = Math.max(0, top)
    if (Math.abs(viewport.scrollTop - next) <= epsilon) {
      viewport.scrollTop = next
      commitScrollState()
      return
    }
    if (autoscroll) setAutoscrolling(true)
    viewport.scrollTo({ top: next, behavior: behavior === 'smooth' && prefersReducedMotion() ? 'auto' : behavior })
    scheduleStateCommit()
  }

  function scrollToStart({ behavior = 'auto' }: MessageScrollerScrollOptions = {}) {
    if (!viewport) return false
    setSpacerHeight(0)
    heldTurn = null
    mode = 'free-scrolling'
    scrollToPosition(0, { behavior })
    scheduleVisibilitySync()
    return true
  }

  // Only a command, the end button or the opening position marks the scroll as
  // automatic. Following a streamed reply doesn't, so its scrollbar stays visible to grab.
  function scrollToEnd({ behavior = 'auto' }: MessageScrollerScrollOptions = {}, { mark = true } = {}) {
    if (!viewport) return false
    setSpacerHeight(0)
    heldTurn = null
    mode = options.autoScroll ? 'following-bottom' : 'free-scrolling'
    scrollToPosition(maxScrollTop(viewport), { behavior, autoscroll: mark })
    scheduleVisibilitySync()
    return true
  }

  function follow() {
    return scrollToEnd({}, { mark: false })
  }

  // The scrollTop that puts the element at the aligned edge, inside the content's padding.
  function targetScrollTop(element: HTMLElement, align: MessageScrollerScrollAlign, margin: number) {
    if (!viewport || !content) return 0
    let top = contentTop(element, viewport)
    let height = element.getBoundingClientRect().height
    let padding = blockPadding(content)
    let visibleHeight = viewport.clientHeight

    if (align === 'center') {
      let inset = Math.max(0, visibleHeight - padding.start - padding.end)
      return top - padding.start - (inset - height) / 2 - margin
    }
    if (align === 'end') return top - visibleHeight + height + padding.end + margin
    if (align === 'nearest') {
      let bottom = top + height
      let viewTop = viewport.scrollTop + padding.start
      let viewBottom = viewport.scrollTop + visibleHeight - padding.end
      if (top >= viewTop && bottom <= viewBottom) return viewport.scrollTop
      if (top < viewTop) return top - padding.start - margin
      return bottom - visibleHeight + padding.end + margin
    }
    return top - padding.start - margin
  }

  function scrollToElement(
    element: HTMLElement,
    { align = 'start', behavior = 'auto', scrollMargin = options.scrollMargin }: MessageScrollerScrollOptions = {},
    { keepPreviousPeek = false } = {},
  ) {
    if (!content || !viewport || !content.contains(element)) return false
    let top = targetScrollTop(
      element,
      align,
      keepPreviousPeek ? scrollMargin + options.scrollPreviousItemPeek : scrollMargin,
    )
    // A turn near the top of a short transcript needs room below it to scroll there.
    setSpacerHeight(top + viewport.clientHeight - contentBottom())
    mode = keepPreviousPeek ? 'anchored-to-message' : 'settling-jump'
    heldTurn = keepPreviousPeek ? element : null
    let smooth = behavior === 'smooth' && !prefersReducedMotion()
    jump = keepPreviousPeek
      ? null
      : {
          element,
          options: { align, behavior, scrollMargin },
          top: Math.min(Math.max(0, top), maxScrollTop(viewport)),
          smooth,
        }
    scrollToPosition(top, { behavior })
    // Rows that arrive above before the scroll event keep the target in place.
    anchor = capture(element)
    scheduleVisibilitySync()
    return true
  }

  // Whether a smooth jump is still on its way to its message. One that content
  // stopped short counts as on its way, so the next change aims it again.
  function jumpInFlight() {
    if (mode !== 'settling-jump' || !jump?.smooth || !viewport) return false
    if (Math.abs(viewport.scrollTop - jump.top) <= 1) jump.smooth = false
    return jump.smooth
  }

  // Aims a smooth jump again at its message, which rows above it moved.
  function rejump() {
    if (!jump || !jump.element.isConnected) return false
    return scrollToElement(jump.element, jump.options)
  }

  // Free scrolling, or a jump that has arrived: the first visible row stays where it is.
  function keepsPlace() {
    return mode === 'free-scrolling' || (mode === 'settling-jump' && !jumpInFlight())
  }

  // Places the held turn again, with a spacer for the reply's new height.
  function reanchor() {
    if (!heldTurn || !heldTurn.isConnected || mode !== 'anchored-to-message') return false
    return scrollToElement(heldTurn, { align: 'start' }, { keepPreviousPeek: true })
  }

  function markOpeningApplied() {
    openingApplied = true
    clearPending()
  }

  function clearPending() {
    if (!pending) return
    pending = false
    root?.removeAttribute('data-pending-scroll')
    viewport?.removeAttribute('data-pending-scroll')
  }

  function scrollToMessage(messageId: string, scrollOptions?: MessageScrollerScrollOptions) {
    let element = findItem(messageId)
    if (!element) {
      // Rows that haven't mounted yet, such as a transcript that loads in the browser.
      if (itemCount > 0) return false
      pendingTarget = { messageId, options: scrollOptions }
      markOpeningApplied()
      return true
    }
    // An explicit jump wins over the opening position.
    markOpeningApplied()
    if (scrollToElement(element, scrollOptions)) pendingTarget = null
    else pendingTarget = { messageId, options: scrollOptions }
    return true
  }

  function flushPendingTarget() {
    if (!pendingTarget) return false
    let element = findItem(pendingTarget.messageId)
    if (!element || !scrollToElement(element, pendingTarget.options)) return false
    pendingTarget = null
    markOpeningApplied()
    return true
  }

  function applyOpening() {
    if (openingApplied || itemCount === 0 || !viewport || !content) return false
    let position = options.defaultScrollPosition
    let handled = false

    if (position === 'last-anchor') {
      let last = items().findLast(isAnchor)
      // A last turn that fits shows whole at the end, without a gap below it.
      let fits = last ? contentBottom() - contentTop(last, viewport) <= viewport.clientHeight : true
      handled = last && !fits ? scrollToElement(last, { align: 'start' }, { keepPreviousPeek: true }) : scrollToEnd()
    } else {
      handled = position === 'end' ? scrollToEnd() : scrollToStart()
    }

    if (handled) markOpeningApplied()
    return handled
  }

  function capture(element: HTMLElement): Anchor | null {
    if (!viewport) return null
    return { element, top: viewportTop(element, viewport), height: element.getBoundingClientRect().height }
  }

  function captureAnchor() {
    if (!viewport || !content) {
      anchor = null
      return
    }
    let box = viewport.getBoundingClientRect()
    let first = items().find((item) => {
      if (!item.dataset.messageId) return false
      let rect = item.getBoundingClientRect()
      return rect.bottom > box.top && rect.top < box.bottom
    })
    anchor = first ? capture(first) : null
  }

  // Moves the anchored row back to where it was. Where the browser's own
  // scroll anchoring already kept it, nothing moves, so this only corrects
  // engines without it. With `ifUnchanged`, a row that changed its own size
  // stays as the browser left it, since its inside may be what the browser
  // kept in place.
  function restoreAnchor({ ifUnchanged = false } = {}) {
    if (!anchor || !viewport || !anchor.element.isConnected) return false
    let now = capture(anchor.element)
    if (!now) return false
    let resized = Math.abs(now.height - anchor.height) > epsilon
    let delta = now.top - anchor.top
    if ((ifUnchanged && resized) || Math.abs(delta) <= epsilon) {
      anchor = now
      return false
    }
    viewport.scrollTop += delta
    anchor = capture(anchor.element)
    scheduleStateCommit()
    scheduleVisibilitySync()
    return true
  }

  // Decides what the view does after rows were added, removed or replaced.
  // The order matters: a queued jump, the first rows, rows added above, a
  // new turn, then everything else.
  function reconcileRows(list: HTMLElement[], previousCount: number, previousFirst: HTMLElement | null) {
    if (flushPendingTarget()) return

    if (previousCount === 0) {
      if (applyOpening()) return
      if (list.length === 0) clearPending()
      else if (options.autoScroll && follow()) return
      commitScrollState()
      scheduleVisibilitySync()
      return
    }

    // Rows without a messageId, such as a "load earlier" row, may stay above the history.
    let previousFirstIndex = previousFirst ? list.indexOf(previousFirst) : -1
    let prepended = list.slice(0, Math.max(0, previousFirstIndex)).some((item) => item.dataset.messageId)
    if (preserveScrollOnPrepend && prepended) {
      // Older rows above aren't new turns. Where the browser anchored the scroll, this does nothing.
      if (jumpInFlight()) rejump()
      else restoreAnchor()
      scheduleStateCommit()
      scheduleVisibilitySync()
      return
    }

    let newTurns = list.filter((item) => isAnchor(item) && !seenAnchors.has(item))
    if (newTurns.length > 1 && options.autoScroll && mode === 'following-bottom') {
      // Several turns at once, such as a reconnect, keep following instead of jumping back to the first.
      follow()
      return
    }
    let [newTurn] = newTurns
    if (newTurn) {
      scrollToElement(newTurn, { align: 'start' }, { keepPreviousPeek: true })
      return
    }

    if (mode === 'following-bottom' && options.autoScroll) follow()
    else if (jumpInFlight()) rejump()
    else {
      // A row added or removed above the reader moves nothing either.
      if (keepsPlace()) restoreAnchor({ ifUnchanged: true })
      commitScrollState()
      scheduleVisibilitySync()
    }
  }

  function handleResize() {
    if (mode === 'following-bottom' && options.autoScroll) {
      follow()
      return
    }
    if (jumpInFlight()) {
      rejump()
      return
    }

    let previousSpacer = spacerHeight
    if (reanchor()) {
      // Once the reply under a held turn has used up the spacer, it fills the
      // viewport and the reader is at the end, so following takes over. A turn
      // taller than the viewport never had a spacer, and stays held.
      if (options.autoScroll && previousSpacer > 0 && spacerHeight === 0) follow()
      return
    }

    scheduleStateCommit()
    scheduleVisibilitySync()
  }

  function onResize() {
    // Before the frame paints, so engines without scroll anchoring don't show a jump.
    if (keepsPlace()) restoreAnchor({ ifUnchanged: true })
    // In a frame, since the spacer is inside the observed content.
    schedule('resize', handleResize)
  }

  function userScrollIntent() {
    // A gesture releases following, a held turn and a jump in flight, so nothing fights the reader.
    if (mode === 'free-scrolling') return
    heldTurn = null
    mode = 'free-scrolling'
  }

  let scroller = {
    get scrollable() {
      return scrollable
    },
    get visibility() {
      return visibility
    },
    get pending() {
      return pending
    },
    set preserveScrollOnPrepend(value: boolean) {
      preserveScrollOnPrepend = value
    },

    scrollToMessage,
    scrollToEnd,
    scrollToStart,

    onScrollableChange(listener: (scrollable: MessageScrollerScrollable) => void, signal: AbortSignal) {
      if (signal.aborted) return
      scrollableListeners.add(listener)
      signal.addEventListener('abort', () => scrollableListeners.delete(listener), { once: true })
    },

    onVisibilityChange(listener: (visibility: MessageScrollerVisibility) => void, signal: AbortSignal) {
      if (signal.aborted) return
      visibilityListeners.add(listener)
      startVisibility()
      signal.addEventListener(
        'abort',
        () => {
          visibilityListeners.delete(listener)
          if (visibilityListeners.size === 0) stopVisibility()
        },
        { once: true },
      )
    },

    /** Takes the provider's latest props. Returns true when the browser must act on them after the commit. */
    configure(next: Options) {
      let previous = options
      options = next
      if (
        previous.scrollMargin !== next.scrollMargin ||
        previous.scrollPreviousItemPeek !== next.scrollPreviousItemPeek
      ) {
        // The observer's reading line moved.
        if (visibilityObserver) {
          stopVisibility()
          startVisibility()
        }
      }
      if (previous.defaultScrollPosition !== next.defaultScrollPosition) openingApplied = false
      if (previous.autoScroll && !next.autoScroll && mode === 'following-bottom') mode = 'free-scrolling'
      return previous.defaultScrollPosition !== next.defaultScrollPosition || previous.autoScroll !== next.autoScroll
    },

    /** Applies changed props once the browser committed them. */
    optionsChanged() {
      if (applyOpening()) return
      if (options.autoScroll && mode === 'following-bottom' && itemCount > 0) follow()
      else commitScrollState()
    },

    attachRoot(node: HTMLElement, signal: AbortSignal) {
      root = node
      if (!pending) node.removeAttribute('data-pending-scroll')
      writeAttributes({ force: true })
      signal.addEventListener('abort', () => {
        if (root === node) root = undefined
      })
    },

    attachViewport(node: HTMLElement, signal: AbortSignal) {
      viewport = node
      lastScrollTop = node.scrollTop
      if (!pending) node.removeAttribute('data-pending-scroll')
      writeAttributes({ force: true })
      let resize = new ResizeObserver(onResize)
      resize.observe(node)
      // Passive, so they never hold up scrolling.
      let listen = { passive: true, signal }
      node.addEventListener('wheel', userScrollIntent, listen)
      node.addEventListener('touchmove', userScrollIntent, listen)
      startVisibility()
      signal.addEventListener('abort', () => {
        resize.disconnect()
        if (viewport !== node) return
        viewport = undefined
        stopVisibility()
      })
    },

    attachContent(node: HTMLElement, signal: AbortSignal) {
      content = node
      let resize = new ResizeObserver(onResize)
      resize.observe(node)
      // Only the rows themselves: a reply streaming inside a row is a resize.
      let rows = new MutationObserver(() => scroller.reconcile())
      rows.observe(node, { childList: true })
      signal.addEventListener('abort', () => {
        resize.disconnect()
        rows.disconnect()
        if (content === node) content = undefined
      })
    },

    attachSpacer(node: HTMLElement, signal: AbortSignal) {
      spacer = node
      spacerHeight = 0
      signal.addEventListener('abort', () => {
        if (spacer === node) spacer = undefined
      })
    },

    /** Runs after rows were added, removed or replaced. */
    reconcile() {
      if (!content) return
      let list = items()
      let previousCount = itemCount
      let previousFirst = firstMessage
      itemCount = list.length
      firstMessage = list.find((item) => item.dataset.messageId) ?? null
      observeItems()
      reconcileRows(list, previousCount, previousFirst)
      for (let item of list) if (isAnchor(item)) seenAnchors.add(item)
      captureAnchor()
    },

    /** A row changed its messageId or scrollAnchor without being replaced. */
    itemChanged(item: HTMLElement) {
      // A row that becomes an anchor in place isn't a new turn, so nothing moves.
      if (isAnchor(item)) seenAnchors.add(item)
      if (pendingTarget && item.dataset.messageId === pendingTarget.messageId) schedule('target', flushPendingTarget)
      observeItems()
      scheduleVisibilitySync()
    },

    scrolled() {
      // Notes when a smooth jump arrives.
      jumpInFlight()
      commitScrollState()
      scheduleVisibilitySync()
      captureAnchor()
    },

    keyDown(event: KeyboardEvent) {
      if (scrollKeys.has(event.key)) userScrollIntent()
    },

    focusViewport() {
      viewport?.focus({ preventScroll: true })
    },

    destroy() {
      for (let frame of frames.values()) cancelAnimationFrame(frame)
      frames.clear()
      clearTimeout(autoscrollingTimer)
      stopVisibility()
      scrollableListeners.clear()
      visibilityListeners.clear()
    },
  }

  return scroller
}

type Scroller = ReturnType<typeof createScroller>

function getScroller(handle: Handle<any, any>, part: string): Scroller {
  let scroller = handle.context.get(MessageScrollerProvider) as Scroller | undefined
  if (!scroller) throw new Error(`${part} must be inside a MessageScrollerProvider.`)
  return scroller
}

/**
 * The commands and the state of the nearest MessageScrollerProvider, for any
 * component inside it, also outside the MessageScroller frame. It replaces
 * shadcn's useMessageScroller().
 */
export function getMessageScroller(handle: Handle<any, any>): MessageScrollerApi {
  return getScroller(handle, 'getMessageScroller')
}

const scrollableWatchers = new WeakSet<object>()
const visibilityWatchers = new WeakSet<object>()

/**
 * Returns which edges the nearest MessageScroller can scroll toward, and
 * renders the component again whenever that changes, until it's removed.
 * Call it while rendering. It replaces shadcn's useMessageScrollerScrollable().
 */
export function watchMessageScrollerScrollable(handle: Handle<any, any>): MessageScrollerScrollable {
  let scroller = getScroller(handle, 'watchMessageScrollerScrollable')
  if (!scrollableWatchers.has(handle)) {
    scrollableWatchers.add(handle)
    scroller.onScrollableChange(() => void handle.update(), handle.signal)
  }
  return scroller.scrollable
}

/**
 * Returns where the reader is in the nearest MessageScroller, and renders
 * the component again whenever that changes. Tracking runs only while a
 * component or listener watches it. Call it while rendering. It replaces
 * shadcn's useMessageScrollerVisibility().
 */
export function watchMessageScrollerVisibility(handle: Handle<any, any>): MessageScrollerVisibility {
  let scroller = getScroller(handle, 'watchMessageScrollerVisibility')
  if (!visibilityWatchers.has(handle)) {
    visibilityWatchers.add(handle)
    scroller.onVisibilityChange(() => void handle.update(), handle.signal)
  }
  return scroller.visibility
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const viewportSlot = '[data-slot="message-scroller-viewport"]'

const rootStyles = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  // The viewport's fade would clip its own ring, so the frame draws it inside its edge.
  [`&:has(> ${viewportSlot}:focus-visible)`]: { outline: '2px solid var(--ring)', outlineOffset: '-2px' },
})

const fade = `linear-gradient(to bottom, #000 calc(100% - min(12%, ${space(10)})), transparent)`

const viewportStyles = css({
  // Shows a transcript the browser never got to place, such as when its script failed to load.
  '@keyframes remixcn-message-scroller-reveal': { to: { visibility: 'visible' } },
  width: '100%',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  scrollbarGutter: 'stable',
  contain: 'content',
  '&:focus-visible': { outline: 'none' },
  // Hidden until the browser applies the opening position, so the transcript doesn't jump.
  '&[data-pending-scroll]': {
    visibility: 'hidden',
    animation: 'remixcn-message-scroller-reveal 0s 2s forwards',
  },
  '@media (scripting: none)': { '&[data-pending-scroll]': { visibility: 'visible', animation: 'none' } },
  '@media not (forced-colors: active)': {
    '&[data-scrollable~="end"]': { maskImage: fade },
    '&[data-autoscrolling]': { scrollbarColor: 'transparent transparent' },
  },
})

const contentStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(8),
  height: 'max-content',
  minHeight: '100%',
})

// Every row renders, unlike shadcn's rows with content-visibility: auto. A row
// the browser skips has a guessed height, so a jump, the opening position or a
// new turn would land beside the row it aims for.
const itemStyles = css({ minWidth: 0, flexShrink: 0 })

const buttonStyles = css(
  mergeStyles(
    {
      '--message-scroller-button-x': '-50%',
      position: 'absolute',
      insetInlineStart: '50%',
      translate: 'var(--message-scroller-button-x) 0',
      '&:dir(rtl)': { '--message-scroller-button-x': '50%' },
      '&[data-direction="end"]': { bottom: space(4) },
      '&[data-direction="start"]': { top: space(4) },
      '&[data-direction="start"] svg': { rotate: '180deg' },
      '&[data-variant="secondary"]': {
        borderColor: 'var(--border)',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      },
      '&[data-variant="secondary"]:hover': { backgroundColor: 'var(--muted)' },
      // Out of the way while there's nothing to scroll to. It's inert then too.
      '&[data-active="false"]': { pointerEvents: 'none', scale: '0.95', opacity: 0 },
      '&[data-active="false"][data-direction="end"]': { translate: 'var(--message-scroller-button-x) 100%' },
      '&[data-active="false"][data-direction="start"]': { translate: 'var(--message-scroller-button-x) -100%' },
    },
    transition('translate', 'scale', 'opacity', 'background-color'),
    { transitionDuration: 'var(--duration-normal)' },
  ),
)

const hiddenText = css(visuallyHidden)

/**
 * Owns one transcript's scroll behavior and renders no element. Put the
 * MessageScroller and anything that calls getMessageScroller inside it. It
 * runs in the browser inside a client entry of your app, like every part.
 */
export function MessageScrollerProvider(handle: Handle<MessageScrollerProviderProps, Scroller>) {
  let scroller = createScroller(readOptions(handle.props))
  handle.signal.addEventListener('abort', () => scroller.destroy())

  return () => {
    if (scroller.configure(readOptions(handle.props))) handle.queueTask(() => scroller.optionsChanged())
    handle.context.set(scroller)
    return handle.props.children
  }
}

/**
 * The frame around the viewport and the jump buttons. It fills its parent, so
 * give the parent a height. It carries data-scrollable, data-autoscrolling and
 * data-pending-scroll, as the viewport does.
 */
export function MessageScroller(handle: Handle<MessageScrollerProps>) {
  return () => {
    let scroller = getScroller(handle, 'MessageScroller')
    let { mix, ...props } = handle.props

    return (
      <div
        {...props}
        data-slot="message-scroller"
        {...(scroller.pending ? { 'data-pending-scroll': '' } : {})}
        mix={[rootStyles, ref<HTMLDivElement>((node, signal) => scroller.attachRoot(node, signal)), mix]}
      />
    )
  }
}

/**
 * The native scroll container: a labelled region in the tab order, so the
 * keyboard scrolls it. The wheel, touch, the scroll keys and the scrollbar
 * all scroll it as usual, and each pauses following.
 */
export function MessageScrollerViewport(handle: Handle<MessageScrollerViewportProps>) {
  return () => {
    let scroller = getScroller(handle, 'MessageScrollerViewport')
    let {
      mix,
      preserveScrollOnPrepend = true,
      role = 'region',
      tabIndex = 0,
      'aria-label': label,
      'aria-labelledby': labelledBy,
      ...props
    } = handle.props
    scroller.preserveScrollOnPrepend = preserveScrollOnPrepend

    return (
      <div
        {...props}
        data-slot="message-scroller-viewport"
        role={role}
        aria-label={label ?? (labelledBy ? undefined : 'Messages')}
        aria-labelledby={labelledBy}
        tabIndex={tabIndex}
        {...(scroller.pending ? { 'data-pending-scroll': '' } : {})}
        mix={[
          viewportStyles,
          ref<HTMLDivElement>((node, signal) => scroller.attachViewport(node, signal)),
          mix,
          on<HTMLDivElement, 'scroll'>('scroll', () => scroller.scrolled()),
          on<HTMLDivElement, 'keydown'>('keydown', (event) => scroller.keyDown(event)),
        ]}
      />
    )
  }
}

/**
 * The rows of the transcript, each a MessageScrollerItem. It's a log, so
 * screen readers announce new rows, not every streamed word.
 */
export function MessageScrollerContent(handle: Handle<MessageScrollerContentProps>) {
  let started = false

  return () => {
    let scroller = getScroller(handle, 'MessageScrollerContent')
    let { mix, children, spacerMix, role = 'log', 'aria-relevant': relevant = 'additions', ...props } = handle.props

    if (!started) {
      started = true
      // Tasks run only in the browser. Later changes to the rows reach the scroller through its observer.
      handle.queueTask(() => scroller.reconcile())
    }

    return (
      <div
        {...props}
        data-slot="message-scroller-content"
        role={role}
        aria-relevant={relevant}
        mix={[contentStyles, ref<HTMLDivElement>((node, signal) => scroller.attachContent(node, signal)), mix]}
      >
        {children}
        <div
          data-slot="message-scroller-spacer"
          aria-hidden="true"
          hidden
          mix={[ref<HTMLDivElement>((node, signal) => scroller.attachSpacer(node, signal)), spacerMix]}
        />
      </div>
    )
  }
}

/**
 * One row of the transcript: a message, a marker, a typing indicator or a
 * "load earlier" row. Key rows by their message, so rows added above are
 * new elements.
 */
export function MessageScrollerItem(handle: Handle<MessageScrollerItemProps>) {
  let element: HTMLElement | undefined
  let previous: { messageId?: string; scrollAnchor: boolean } | undefined

  return () => {
    let scroller = getScroller(handle, 'MessageScrollerItem')
    let { mix, messageId, scrollAnchor = false, ...props } = handle.props

    if (previous && (previous.messageId !== messageId || previous.scrollAnchor !== scrollAnchor)) {
      handle.queueTask(() => {
        if (element) scroller.itemChanged(element)
      })
    }
    previous = { messageId, scrollAnchor }

    return (
      <div
        {...props}
        data-slot="message-scroller-item"
        data-message-id={messageId}
        data-scroll-anchor={scrollAnchor ? 'true' : 'false'}
        mix={[
          itemStyles,
          ref<HTMLDivElement>((node, signal) => {
            element = node
            signal.addEventListener('abort', () => {
              if (element === node) element = undefined
            })
          }),
          mix,
        ]}
      />
    )
  }
}

/**
 * A Button that scrolls to the end or the start. While there's nothing to
 * scroll to in its direction it's hidden, inert and out of the tab order,
 * also before the browser runs it. Pressing it moves focus to the viewport,
 * since the button goes away once it arrives.
 */
export function MessageScrollerButton(handle: Handle<MessageScrollerButtonProps>) {
  let watching = false

  return () => {
    let scroller = getScroller(handle, 'MessageScrollerButton')
    if (!watching) {
      watching = true
      scroller.onScrollableChange(() => void handle.update(), handle.signal)
    }

    let {
      direction = 'end',
      behavior = 'smooth',
      variant = 'secondary',
      size = 'icon-sm',
      tabIndex,
      children,
      mix,
      ...props
    } = handle.props
    let active = scroller.scrollable[direction]

    return (
      <Button
        {...props}
        variant={variant}
        size={size}
        data-slot="message-scroller-button"
        data-direction={direction}
        data-active={active ? 'true' : 'false'}
        tabIndex={active ? tabIndex : -1}
        {...(active ? {} : { inert: true })}
        mix={[
          buttonStyles,
          // The caller's handlers run first, so they can cancel the scroll.
          mix,
          on<HTMLButtonElement, 'click'>('click', (event) => {
            if (event.defaultPrevented || !scroller.scrollable[direction]) return
            let focused = event.currentTarget.ownerDocument.activeElement === event.currentTarget
            if (direction === 'start') scroller.scrollToStart({ behavior })
            else scroller.scrollToEnd({ behavior })
            if (focused) scroller.focusViewport()
          }),
        ]}
      >
        {children ?? (
          <>
            <ArrowDownIcon />
            <span mix={hiddenText}>{direction === 'end' ? 'Scroll to end' : 'Scroll to start'}</span>
          </>
        )}
      </Button>
    )
  }
}
