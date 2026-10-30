// RemixCN Drawer: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css, on, ref } from 'remix/component'
import type { Handle, MixinFactory, Props, RemixNode } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Dialog, DialogClose, DialogPopup, DialogTrigger, getDialogContext } from '#remixcn/ui/dialog.tsx'
import type {
  DialogChangeDetails,
  DialogChangeReason,
  DialogCloseProps,
  DialogContext,
  DialogPopupProps,
  DialogProps,
  DialogTriggerProps,
} from '#remixcn/ui/dialog.tsx'

// A Drawer is a Dialog along one edge of the screen that follows the
// pointer: drag it toward its edge to close it, or between snap points to
// resize it. Everything a Dialog does, it does: a native <dialog> in the top
// layer, modal or not, controlled or not, nested, with the same focus, Escape
// and outside-press rules. Gestures are optional: its close buttons, Escape,
// and DrawerSnapPointButton reach every state from the keyboard.
//
// Drags use Pointer Events and pointer capture. touch-action tells the
// browser which touch pans are its own: the drawer blocks pans along its
// axis, so they reach the drag, while every scroll container inside keeps
// its native scrolling until it reaches the edge the swipe starts from.
// Mouse and pen drags start only outside DrawerContent's content, such as on
// the swipe handle, so they can still select text.
//
// The server renders a closed <dialog> that opens and closes with invoker
// commands before any script runs, as a Dialog does. It slides in from its
// edge, without gestures, until the drawer runs in your client entry.

export type DrawerSwipeDirection = 'up' | 'right' | 'down' | 'left'

/** A fraction of the viewport's height from 0 to 1, a pixel height above 1, or a string in px or rem. */
export type DrawerSnapPoint = number | string

export interface ResolvedSnapPoint {
  value: DrawerSnapPoint
  /** The height the drawer shows at this point, in px. */
  height: number
  /** How far the drawer sits from its open position toward its edge, in px. */
  offset: number
}

export interface SnapPointMeasures {
  viewportHeight: number
  popupHeight: number
  rootFontSize: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function resolveHeight(snapPoint: DrawerSnapPoint, viewportHeight: number, rootFontSize: number): number | null {
  if (typeof snapPoint === 'number') {
    if (!Number.isFinite(snapPoint)) return null
    return snapPoint <= 1 ? clamp(snapPoint, 0, 1) * viewportHeight : snapPoint
  }
  let match = /^\s*(-?\d*\.?\d+)(px|rem)\s*$/.exec(snapPoint)
  if (!match) return null
  let value = Number(match[1])
  return match[2] === 'rem' ? value * rootFontSize : value
}

/**
 * Resolves snap points to heights and offsets, as Base UI does: each height
 * clamps to the popup and the viewport, values it can't read are dropped,
 * and of two points within a pixel of each other the later one stays.
 */
export function resolveSnapPoints(
  snapPoints: readonly DrawerSnapPoint[] | undefined,
  { viewportHeight, popupHeight, rootFontSize }: SnapPointMeasures,
): ResolvedSnapPoint[] {
  if (!snapPoints?.length || !(viewportHeight > 0) || !(popupHeight > 0)) return []
  let max = Math.min(popupHeight, viewportHeight)
  let resolved: ResolvedSnapPoint[] = []
  for (let value of snapPoints) {
    let height = resolveHeight(value, viewportHeight, rootFontSize)
    if (height === null) continue
    height = clamp(height, 0, max)
    resolved.push({ value, height, offset: Math.max(0, popupHeight - height) })
  }

  let kept: ResolvedSnapPoint[] = []
  for (let point of resolved.reverse()) {
    if (!kept.some((later) => Math.abs(later.height - point.height) <= 1)) kept.unshift(point)
  }
  return kept
}

function closestIndex(values: readonly number[], target: number) {
  let closest = -1
  let distance = Infinity
  values.forEach((value, index) => {
    if (Math.abs(value - target) < distance) {
      distance = Math.abs(value - target)
      closest = index
    }
  })
  return closest
}

/** The resolved point of the active snap point: the same value, else the closest height. */
export function findSnapPoint(
  points: readonly ResolvedSnapPoint[],
  active: DrawerSnapPoint | null | undefined,
  measures: SnapPointMeasures,
): ResolvedSnapPoint | undefined {
  if (active === null || active === undefined) return undefined
  let exact = points.find((point) => Object.is(point.value, active))
  if (exact) return exact
  let height = resolveHeight(active, measures.viewportHeight, measures.rootFontSize)
  if (height === null) return undefined
  height = clamp(height, 0, Math.min(measures.popupHeight, measures.viewportHeight))
  return points[
    closestIndex(
      points.map((point) => point.height),
      height,
    )
  ]
}

/** The drag's movement from a snap point's offset: it follows the pointer, and resists past the open position. */
export function snapPointMovement(baseOffset: number, delta: number): number {
  let next = baseOffset + delta
  return next >= 0 ? delta : -Math.sqrt(-next) - baseOffset
}

/** Movement past the open position grows with the square root of the drag, so the drawer resists it. */
function resist(delta: number) {
  return delta >= 0 ? delta : -Math.sqrt(-delta)
}

const MIN_SWIPE_THRESHOLD = 10
const FAST_SWIPE_VELOCITY = 0.5
const SNAP_VELOCITY_THRESHOLD = 0.5
const SNAP_VELOCITY_MULTIPLIER = 300
const MAX_SNAP_VELOCITY = 4
const MIN_RELEASE_VELOCITY = 0.2
const MAX_RELEASE_VELOCITY = 4
const MIN_RELEASE_DURATION = 80
const MAX_RELEASE_DURATION = 360
const MIN_RELEASE_STRENGTH = 0.1

export interface SwipeRelease {
  /** How far the drag moved toward the drawer's edge, in px. Negative moves away from it. */
  delta: number
  /** Whether the drag moved along the drawer's axis, in a direction the drawer can go. */
  attributed: boolean
  /** The drawer's size along its axis, in px. */
  size: number
  /** The drag's average velocity toward the edge, in px per ms. */
  velocity: number
  /** The velocity toward the edge as the pointer let go, in px per ms. */
  releaseVelocity: number
  /** The resolved snap points of a vertical drawer that has them. */
  snap?: {
    points: readonly ResolvedSnapPoint[]
    activeOffset: number
    popupHeight: number
    sequential: boolean
  }
}

export type SwipeDecision = { type: 'rest' } | { type: 'close' } | { type: 'snap'; snapPoint: ResolvedSnapPoint }

/**
 * Decides what a released drag does, with Base UI's thresholds: past half
 * the drawer's size or faster than 0.5px/ms toward its edge, it closes. With
 * snap points, the velocity carries the drag on, and it settles on the
 * closest snap point, or closes when closed is closer. A drag that never
 * moved along the drawer's axis may settle but never closes.
 */
export function decideSwipeRelease({
  delta,
  attributed,
  size,
  velocity,
  releaseVelocity,
  snap,
}: SwipeRelease): SwipeDecision {
  if (!snap || snap.points.length === 0) {
    if (!attributed || delta <= 0) return { type: 'rest' }
    if (velocity >= FAST_SWIPE_VELOCITY) return { type: 'close' }
    return delta > Math.max(size * 0.5, MIN_SWIPE_THRESHOLD) ? { type: 'close' } : { type: 'rest' }
  }

  let { points, activeOffset, popupHeight, sequential } = snap
  let direction = Math.sign(delta)
  let speed = releaseVelocity
  // A touch that turns around as it lets go doesn't flip the decision.
  if (direction !== 0 && Math.abs(delta) >= MIN_SWIPE_THRESHOLD && Math.sign(speed) === -direction) speed = velocity

  let dragTarget = clamp(activeOffset + delta, 0, popupHeight)
  let fling =
    Math.abs(speed) >= SNAP_VELOCITY_THRESHOLD
      ? clamp(speed, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) * SNAP_VELOCITY_MULTIPLIER
      : 0
  let target = sequential ? dragTarget : clamp(dragTarget + fling, 0, popupHeight)
  let close = (fallback: ResolvedSnapPoint): SwipeDecision =>
    attributed ? { type: 'close' } : { type: 'snap', snapPoint: fallback }
  let settle = (point: ResolvedSnapPoint, at: number): SwipeDecision =>
    Math.abs(at - popupHeight) < Math.abs(at - point.offset) ? close(point) : { type: 'snap', snapPoint: point }

  if (sequential) {
    let ordered = [...points].sort((a, b) => a.offset - b.offset)
    let offsets = ordered.map((point) => point.offset)
    let current = closestIndex(offsets, activeOffset)
    let point = ordered[closestIndex(offsets, target)]
    let at = target
    if (direction !== 0 && Math.sign(speed) === direction && Math.abs(speed) >= SNAP_VELOCITY_THRESHOLD) {
      let next = clamp(current + direction, 0, ordered.length - 1)
      if (next === current && direction > 0) return close(point)
      let adjacent = ordered[next]
      if (next !== current && (direction > 0 ? target < adjacent.offset : target > adjacent.offset)) {
        point = adjacent
        at = adjacent.offset
      }
    }
    return settle(point, at)
  }

  let closest =
    points[
      closestIndex(
        points.map((point) => point.offset),
        target,
      )
    ]
  if (speed >= FAST_SWIPE_VELOCITY && delta > 0) return close(closest)
  return settle(closest, target)
}

/**
 * Scales the closing transition after a swipe, from 0.1 to 1: the faster the
 * release and the shorter the distance left, the shorter it is. Returns
 * `null` for a release too slow to scale, which keeps the full duration.
 */
export function swipeReleaseStrength({
  size,
  travelled,
  velocity,
}: {
  size: number
  travelled: number
  velocity: number
}): number | null {
  let remaining = size - travelled
  if (!(size > 0) || remaining <= 0 || !(velocity > MIN_RELEASE_VELOCITY)) return null
  let duration = clamp(
    remaining / clamp(velocity, MIN_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY),
    MIN_RELEASE_DURATION,
    MAX_RELEASE_DURATION,
  )
  let normalized = (duration - MIN_RELEASE_DURATION) / (MAX_RELEASE_DURATION - MIN_RELEASE_DURATION)
  return MIN_RELEASE_STRENGTH + normalized * (1 - MIN_RELEASE_STRENGTH)
}

const pans: Record<DrawerSwipeDirection, { cross: string; away: string }> = {
  down: { cross: 'pan-x', away: 'pan-down' },
  up: { cross: 'pan-x', away: 'pan-up' },
  right: { cross: 'pan-y', away: 'pan-right' },
  left: { cross: 'pan-y', away: 'pan-left' },
}

/**
 * The touch-action of a scroll container inside a drawer. While it can
 * scroll the way a swipe toward the drawer's edge goes (`toward`), the
 * browser keeps every pan. At that edge, the swipe belongs to the drawer:
 * only the other way (`away`) still scrolls, where the browser can tell pans
 * apart by direction (`directional`), and nowhere else.
 */
export function touchActionFor(
  direction: DrawerSwipeDirection,
  { toward, away }: { toward: boolean; away: boolean },
  directional: boolean,
): string {
  if (toward) return ''
  let { cross, away: pan } = pans[direction]
  if (!away) return `${cross} pinch-zoom`
  return directional ? `${cross} ${pan} pinch-zoom` : ''
}

/** How much of the layout viewport a virtual keyboard covers, from the visual viewport. 0 while pinch-zoomed. */
export function keyboardInset({
  layoutHeight,
  height,
  offsetTop,
  scale,
}: {
  layoutHeight: number
  height: number
  offsetTop: number
  scale: number
}): number {
  if (Math.abs(scale - 1) > 0.01) return 0
  return Math.max(0, Math.round(layoutHeight - offsetTop - height))
}

/** Why the snap point changes: a Dialog's change reasons, as the drawer closes, plus `snap-point-press`. */
export type DrawerSnapPointChangeReason = DialogChangeReason | 'snap-point-press'

export interface DrawerSnapPointChangeDetails {
  reason: DrawerSnapPointChangeReason
  /** The event that asked for the change, if any. */
  event?: Event
  /** Keeps the current snap point. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface DrawerProps extends Omit<DialogProps, 'role'> {
  /** The direction a swipe closes the drawer, which is the edge it sits on (defaults to `down`). Physical, so `right` stays right in right-to-left text. */
  swipeDirection?: DrawerSwipeDirection
  /** Heights a vertical drawer settles at, from small to large or in any order. */
  snapPoints?: DrawerSnapPoint[]
  /** The active snap point, for a drawer you control. Render the new value from onSnapPointChange. */
  snapPoint?: DrawerSnapPoint | null
  /** The snap point it opens at, for a drawer that keeps its own (defaults to the first snap point). */
  defaultSnapPoint?: DrawerSnapPoint | null
  /** Called before the snap point changes. Call `details.cancel()` to keep the current one. */
  onSnapPointChange?: (snapPoint: DrawerSnapPoint | null, details: DrawerSnapPointChangeDetails) => void
  /** Moves one snap point at a time: a fast swipe no longer skips snap points (defaults to `false`). */
  snapToSequentialPoints?: boolean
  /** Shows the swipe handle at the drawer's inner edge (defaults to `false`). */
  showSwipeHandle?: boolean
}

interface SnapPointRequest {
  reason: DrawerSnapPointChangeReason
  event?: Event
}

/** What the Drawer root shares with its parts, and with a drawer nested inside it. */
export interface DrawerContext {
  readonly swipeDirection: DrawerSwipeDirection
  readonly snapPoints: readonly DrawerSnapPoint[] | undefined
  /** The active snap point, or `null`. */
  readonly snapPoint: DrawerSnapPoint | null
  readonly snapToSequentialPoints: boolean
  readonly showSwipeHandle: boolean
  /** How many drawers are open in front of this one, nested inside it. */
  readonly nestedOpen: number
  /** The height the frontmost drawer nested inside this one shows while it's open, at its snap point, else 0. */
  readonly frontmostHeight: number
  /** The drawer this one is nested in. */
  readonly parent: DrawerContext | null
  /** Asks the root to change the snap point. Returns `false` when `onSnapPointChange` canceled it. */
  setSnapPoint(snapPoint: DrawerSnapPoint | null, request: SnapPointRequest): boolean
  /** The drawer's popup, once DrawerContent rendered it in the browser. */
  getPopup(): HTMLElement | null
  /** DrawerContent tells its root its popup, whether it's open, and the height it shows. */
  report(popup: HTMLElement | null, open: boolean, height: number): void
  /** A drawer nested inside this one tells it how deep its open stack is, and its frontmost height. */
  reportNested(id: string, depth: number, height: number): void
}

/** The context of the nearest Drawer. Throws when `part` sits outside one. */
export function getDrawerContext(handle: Handle<any>, part: string): DrawerContext {
  let context = handle.context.get(Drawer) as DrawerContext | undefined
  if (!context) throw new Error(`${part} must sit inside Drawer`)
  return context
}

/**
 * Holds the open state and the snap point of a drawer, and shares them with
 * its parts. It renders no element of its own. Without `open` or
 * `snapPoint`, it keeps its own state.
 */
export function Drawer(handle: Handle<DrawerProps, DrawerContext>) {
  let parent = (handle.context.get(Drawer) as DrawerContext | undefined) ?? null
  let uncontrolledSnapPoint: DrawerSnapPoint | null | undefined
  let popup: HTMLElement | null = null
  let own = { open: false, height: 0 }
  let nested = new Map<string, { depth: number; height: number }>()
  let reported = { depth: 0, height: 0 }

  function defaultSnapPoint() {
    let { defaultSnapPoint, snapPoints } = handle.props
    return defaultSnapPoint !== undefined ? defaultSnapPoint : (snapPoints?.[0] ?? null)
  }

  function activeSnapPoint(): DrawerSnapPoint | null {
    let { snapPoint, snapPoints } = handle.props
    if (snapPoint !== undefined) return snapPoint
    let current = uncontrolledSnapPoint
    // Snap points that changed under an uncontrolled drawer fall back to the default.
    if (current === undefined || (snapPoints?.length && !snapPoints.some((point) => Object.is(point, current)))) {
      return defaultSnapPoint()
    }
    return current
  }

  function setSnapPoint(next: DrawerSnapPoint | null, { reason, event }: SnapPointRequest) {
    if (Object.is(next, activeSnapPoint())) return true
    let canceled = false
    let details: DrawerSnapPointChangeDetails = {
      reason,
      event,
      cancel: () => void (canceled = true),
      get isCanceled() {
        return canceled
      },
    }
    handle.props.onSnapPointChange?.(next, details)
    if (canceled) return false
    if (handle.props.snapPoint === undefined) uncontrolledSnapPoint = next
    void handle.update()
    return true
  }

  function onOpenChange(open: boolean, details: DialogChangeDetails) {
    handle.props.onOpenChange?.(open, details)
    // A drawer that closes opens at its default snap point next time.
    if (details.isCanceled || open || !handle.props.snapPoints?.length) return
    setSnapPoint(defaultSnapPoint(), { reason: details.reason, event: details.event })
  }

  function nestedDepth() {
    let depth = 0
    for (let child of nested.values()) depth = Math.max(depth, child.depth)
    return depth
  }

  function nestedHeight() {
    for (let child of nested.values()) if (child.depth > 0 && child.height > 0) return child.height
    return 0
  }

  // Tells the drawer around this one how deep the open stack in front of it is.
  function propagate() {
    let depth = own.open ? 1 + nestedDepth() : 0
    let height = own.open ? nestedHeight() || own.height : 0
    if (depth === reported.depth && height === reported.height) return
    reported = { depth, height }
    parent?.reportNested(handle.id, depth, height)
  }

  handle.signal.addEventListener('abort', () => parent?.reportNested(handle.id, 0, 0))

  return () => {
    let {
      open,
      defaultOpen,
      onOpenChangeComplete,
      modal,
      disablePointerDismissal,
      swipeDirection = 'down',
      snapPoints,
      snapToSequentialPoints = false,
      showSwipeHandle = false,
      children,
    } = handle.props

    handle.context.set({
      swipeDirection,
      snapPoints,
      snapPoint: activeSnapPoint(),
      snapToSequentialPoints,
      showSwipeHandle,
      nestedOpen: nestedDepth(),
      frontmostHeight: nestedHeight(),
      parent,
      setSnapPoint,
      getPopup: () => popup,
      report(element, isOpen, height) {
        popup = element
        if (own.open === isOpen && own.height === height) return
        own = { open: isOpen, height }
        propagate()
      },
      reportNested(id, depth, height) {
        let before = { depth: nestedDepth(), height: nestedHeight() }
        if (depth > 0) nested.set(id, { depth, height })
        else nested.delete(id)
        if (before.depth === nestedDepth() && before.height === nestedHeight()) return
        if (!handle.signal.aborted) void handle.update()
        propagate()
      },
    })

    return (
      <Dialog
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        onOpenChangeComplete={onOpenChangeComplete}
        modal={modal}
        disablePointerDismissal={disablePointerDismissal}
      >
        {children}
      </Dialog>
    )
  }
}

/** A native button that opens the drawer. Unstyled; give it a look with `buttonVariants()`. */
export function DrawerTrigger(handle: Handle<DialogTriggerProps>) {
  return () => <DialogTrigger data-slot="drawer-trigger" {...handle.props} />
}

/** A native button that closes the drawer. Unstyled; give it a look with `buttonVariants()`. */
export function DrawerClose(handle: Handle<DialogCloseProps>) {
  return () => <DialogClose data-slot="drawer-close" {...handle.props} />
}

/**
 * shadcn's portal. A modal drawer is a native dialog in the browser's top
 * layer, above every stacking context wherever it sits, so this renders its
 * children where they are. It keeps shadcn compositions working.
 */
export function DrawerPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => handle.props.children
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const border = '1px solid var(--border)'
const radius = 'var(--radius-xl)'
// shadcn's drawer moves for 450ms. Twice the normal duration is close, and reduced motion still turns it off.
const duration = 'calc(var(--duration-normal) * 2)'
const releaseDuration = `calc(${duration} * var(--drawer-swipe-strength, 1))`

/**
 * The overlay, which shadcn renders as DrawerOverlay: a modal drawer's native
 * ::backdrop. It fades as the drawer is swiped toward its edge, down to
 * `--drawer-overlay-min-opacity`, which is 0.5 with snap points. A drawer
 * inside another one draws none. DrawerContent merges it into its own rule.
 */
export const drawerOverlayStyles: Styles = {
  '&::backdrop': mergeStyles(transition('opacity', 'display', 'overlay'), {
    transitionDuration: duration,
    transitionBehavior: 'allow-discrete',
    opacity: 0,
    backgroundColor: 'oklch(0 0 0 / 10%)',
    backdropFilter: 'blur(4px)',
  }),
  '&[open]::backdrop': {
    opacity: 'max(var(--drawer-overlay-min-opacity, 0), calc(1 - var(--drawer-swipe-progress, 0)))',
  },
  '&:not([open])::backdrop': { transitionDuration: releaseDuration },
  '&[data-swiping]::backdrop': { transitionDuration: '0s' },
  '&[data-nested]::backdrop': { backgroundColor: 'transparent', backdropFilter: 'none' },
  '&[data-snap-points]': { '--drawer-overlay-min-opacity': '0.5' },
  '@starting-style': { '&[open]::backdrop': { opacity: 0 } },
}

// A drawer with drawers open in front of it shrinks to the frontmost one's
// height, scales down by 5% per drawer, and peeks out 1rem behind it, as in
// shadcn. It grows back as the frontmost one is swiped away.
const stack: Styles = {
  '--bleed': '3rem',
  '--peek': '1rem',
  '--stack-step': '0.05',
  '--stack-height': 'var(--drawer-frontmost-height, var(--drawer-height, 0px))',
  '--stack-progress': 'clamp(0, var(--drawer-nested-swipe-progress, 0), 1)',
  '--stack-peek-offset': 'max(0px, calc((var(--nested-drawers, 0) - var(--stack-progress)) * var(--peek)))',
  '--stack-scale-base': 'max(0, calc(1 - (var(--nested-drawers, 0) * var(--stack-step))))',
  '--stack-scale': 'clamp(0, calc(var(--stack-scale-base) + (var(--stack-step) * var(--stack-progress))), 1)',
  '--stack-shrink': 'calc(1 - var(--stack-scale))',
}

const popup: Styles = mergeStyles(drawerOverlayStyles, stack, {
  // A nested drawer's dialog sits inside its parent's, so it would inherit the
  // parent's variables. Each drawer starts from its own; the gesture's inline
  // values override these.
  '--nested-drawers': '0',
  '--drawer-nested-swipe-progress': '0',
  '--drawer-snap-point-offset': '0px',
  '--drawer-swipe-strength': '1',
  '--drawer-height': 'initial',
  '--drawer-frontmost-height': 'initial',
  position: 'fixed',
  zIndex: 50,
  boxSizing: 'border-box',
  margin: 'var(--drawer-inset, 0px)',
  padding: 0,
  border: 0,
  maxWidth: 'none',
  overflow: 'visible',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  scale: 'var(--stack-scale)',
  transitionProperty: 'translate, scale, height, filter, inset, display, overlay',
  transitionDuration: duration,
  transitionTimingFunction: 'var(--ease-out)',
  transitionBehavior: 'allow-discrete',
  '&[open]': { display: 'flex' },
  '&:not([open])': { pointerEvents: 'none', transitionDuration: releaseDuration },
  '&:focus-visible': { outline: 'none' },
  '&[data-swiping]': { userSelect: 'none' },
  '&[data-swiping], &[data-nested-drawer-swiping], &[data-resizing]': { transitionDuration: '0s' },
  '&[data-nested-drawer-open]': { overflow: 'hidden', filter: 'brightness(0.95)' },
  // The bleed fills the gap behind the drawer when a drag pulls it past its open position.
  '&::after': {
    content: '""',
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: 'var(--drawer-bleed-background, var(--popover))',
  },
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})

const closedY = '(100% + var(--drawer-inset, 0px) + 2px)'
const closedX = closedY
// A dialog is as wide as its content by default; a vertical drawer spans the screen.
const verticalHeight = {
  width: 'auto',
  height: 'var(--drawer-height, auto)',
  maxHeight: 'calc(100dvh - 6rem - var(--drawer-keyboard-inset, 0px))',
  '&[data-snap-points]': { height: '100dvh' },
  '&[data-nested-drawer-open]': { height: 'var(--stack-height)' },
}
const sideWidth = { width: '75%', '@media (min-width: 40rem)': { width: '24rem' } }

const directionStyles: Record<DrawerSwipeDirection, { styles: Styles; closed: string }> = {
  down: {
    closed: `0 calc${closedY}`,
    styles: mergeStyles(verticalHeight, {
      inset: 'auto 0 var(--drawer-keyboard-inset, 0px) 0',
      flexDirection: 'column',
      touchAction: 'pan-x pinch-zoom',
      borderTop: border,
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      transformOrigin: 'bottom',
      '&[open]': {
        translate:
          '0 calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px) - var(--stack-peek-offset) - (var(--stack-shrink) * var(--stack-height)))',
      },
      '&::after': { insetInline: 0, top: '100%', height: 'var(--bleed)' },
    }),
  },
  up: {
    closed: `0 calc(-1 * ${closedY})`,
    styles: mergeStyles(verticalHeight, {
      inset: '0 0 auto 0',
      flexDirection: 'column',
      touchAction: 'pan-x pinch-zoom',
      borderBottom: border,
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
      transformOrigin: 'top',
      '&[open]': {
        translate:
          '0 calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px) + var(--stack-peek-offset) + (var(--stack-shrink) * var(--stack-height)))',
      },
      '&::after': { insetInline: 0, bottom: '100%', height: 'var(--bleed)' },
    }),
  },
  left: {
    closed: `calc(-1 * ${closedX}) 0`,
    styles: mergeStyles(sideWidth, {
      inset: '0 auto var(--drawer-keyboard-inset, 0px) 0',
      height: 'auto',
      maxHeight: 'none',
      flexDirection: 'row',
      touchAction: 'pan-y pinch-zoom',
      borderRight: border,
      borderTopRightRadius: radius,
      borderBottomRightRadius: radius,
      transformOrigin: 'left',
      '&[open]': {
        translate:
          'calc(var(--drawer-swipe-movement-x, 0px) + var(--stack-peek-offset) + (var(--stack-shrink) * 100%)) 0',
      },
      '&::after': { insetBlock: 0, right: '100%', width: 'var(--bleed)' },
    }),
  },
  right: {
    closed: `calc${closedX} 0`,
    styles: mergeStyles(sideWidth, {
      inset: '0 0 var(--drawer-keyboard-inset, 0px) auto',
      height: 'auto',
      maxHeight: 'none',
      flexDirection: 'row',
      touchAction: 'pan-y pinch-zoom',
      borderLeft: border,
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      transformOrigin: 'right',
      '&[open]': {
        translate:
          'calc(var(--drawer-swipe-movement-x, 0px) - var(--stack-peek-offset) - (var(--stack-shrink) * 100%)) 0',
      },
      '&::after': { insetBlock: 0, left: '100%', width: 'var(--bleed)' },
    }),
  },
}

// One css() rule per direction, so its position, size and slide merge with the popup.
const popupRules = Object.fromEntries(
  (Object.keys(directionStyles) as DrawerSwipeDirection[]).map((direction) => {
    let { styles, closed } = directionStyles[direction]
    return [
      direction,
      css(
        mergeStyles(popup, styles, {
          translate: closed,
          '@starting-style': { '&[open]': { translate: closed } },
        }),
      ),
    ]
  }),
) as Record<DrawerSwipeDirection, ReturnType<typeof css>>

// The content scrolls when it is taller than the drawer. At a snap point,
// padding on the edge that sits off the screen keeps it in the part that
// shows, so every part of it stays reachable, also with the keyboard.
const contentRule = css({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  borderRadius: 'inherit',
  transitionProperty: 'opacity, padding',
  transitionDuration: duration,
  transitionTimingFunction: 'var(--ease-out)',
  ':where([data-swipe-direction="down"][data-snap-points]) > &': {
    paddingBlockEnd: 'var(--drawer-snap-point-offset, 0px)',
    scrollPaddingBlockEnd: 'var(--drawer-snap-point-offset, 0px)',
  },
  ':where([data-swipe-direction="up"][data-snap-points]) > &': {
    paddingBlockStart: 'calc(-1 * var(--drawer-snap-point-offset, 0px))',
    scrollPaddingBlockStart: 'calc(-1 * var(--drawer-snap-point-offset, 0px))',
  },
  ':where([data-nested-drawer-open]) > &': { opacity: 0 },
  ':where([data-nested-drawer-open][data-nested-drawer-swiping]) > &': { opacity: 1 },
  ':where([data-swiping], [data-resizing]) > &': { transitionDuration: '0s' },
})

const handleRule = css({
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  flexShrink: 0,
  cursor: 'grab',
  transitionProperty: 'opacity',
  transitionDuration: 'var(--duration-normal)',
  '&:active': { cursor: 'grabbing' },
  // The pill is a border, so it stays in forced colors.
  '&::after': {
    content: '""',
    display: 'block',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderRadius: '9999px',
    borderStyle: 'solid',
    borderColor: 'var(--muted)',
    borderWidth: 0,
  },
  ':where([data-swipe-axis="y"]) > &': { width: '100%', height: space(3), justifyContent: 'center' },
  ':where([data-swipe-axis="y"]) > &::after': { width: '100px', height: 0, borderTopWidth: space(1.5) },
  ':where([data-swipe-axis="x"]) > &': { height: '100%', width: space(3), alignItems: 'center' },
  ':where([data-swipe-axis="x"]) > &::after': { width: 0, height: '100px', borderLeftWidth: space(1.5) },
  ':where([data-swipe-direction="down"]) > &': { alignItems: 'flex-end' },
  ':where([data-swipe-direction="up"]) > &': { alignItems: 'flex-start', order: '1' },
  ':where([data-swipe-direction="left"]) > &': { justifyContent: 'flex-start', order: '1' },
  ':where([data-swipe-direction="right"]) > &': { justifyContent: 'flex-end' },
  ':where([data-nested-drawer-open]) > &': { opacity: 0 },
  ':where([data-nested-drawer-open][data-nested-drawer-swiping]) > &': { opacity: 1 },
  '@media (forced-colors: active)': { '&::after': { borderColor: 'CanvasText' } },
})

/**
 * The bar at the drawer's inner edge that shows it can be dragged, which
 * DrawerContent renders when the root has `showSwipeHandle`. It's
 * decorative, hidden from assistive technology, as in shadcn: the close
 * buttons, Escape and DrawerSnapPointButton do what a drag does.
 */
export function DrawerSwipeHandle(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="drawer-swipe-handle" aria-hidden="true" {...props} mix={[handleRule, mix]} />
  }
}

// Mouse and pen drags leave controls and text to themselves, as in Base UI.
const pointerIgnore = 'button, a, input, select, textarea, label, [role="button"], [data-slot="drawer-content"]'
// Below these, a press is still a press. A touch waits a little longer, to see which axis it takes.
const DRAG_SLOP = 3
const TOUCH_SLOP = 6
const MAX_SAMPLE_AGE = 80
const MIN_SAMPLE_DURATION = 4
const MIN_VELOCITY_DURATION = 50

type Axis = 'x' | 'y'

const axisOf = (direction: DrawerSwipeDirection): Axis => (direction === 'left' || direction === 'right' ? 'x' : 'y')
// +1 when the drawer's edge lies in the positive direction of its axis.
const signOf = (direction: DrawerSwipeDirection) => (direction === 'down' || direction === 'right' ? 1 : -1)

interface Drag {
  pointerId: number
  pointerType: string
  start: { x: number; y: number }
  origin: number
  active: boolean
  attributed: boolean
  startTime: number
  baseOffset: number
  delta: number
  sample: { delta: number; time: number } | null
  stationary: boolean
  velocity: number
  nestedSwiping: boolean
  /** The scroll container a touch started in, and which ways along the drawer's axis it can still scroll. */
  scroller: { toward: boolean; away: boolean } | null
  /** Whether the touch belongs to the browser: a scroll, or a pan along the other axis. */
  yielded: boolean
  /** The pointer's last position along the drawer's axis. */
  position: number
  /** The drawer's size along its axis as the drag goes on. */
  size: number
}

let propertiesRegistered = false

// The movement changes on every pointer move. Registered without
// inheritance, it restyles only the popup, not everything inside it.
function registerProperties() {
  if (propertiesRegistered || typeof CSS === 'undefined' || !('registerProperty' in CSS)) return
  propertiesRegistered = true
  for (let name of ['--drawer-swipe-movement-x', '--drawer-swipe-movement-y']) {
    try {
      CSS.registerProperty({ name, syntax: '<length>', inherits: false, initialValue: '0px' })
    } catch {
      // Already registered, by another copy of the drawer or the app.
    }
  }
}

function isScrollable(overflow: string) {
  return overflow === 'auto' || overflow === 'scroll'
}

// How far an element can still scroll back (up or left) and forward (down or right).
function scrollRoom(element: Element, axis: Axis) {
  if (axis === 'y') {
    let max = element.scrollHeight - element.clientHeight
    return { back: element.scrollTop, forward: max - element.scrollTop }
  }
  let max = element.scrollWidth - element.clientWidth
  // In right-to-left text, scrollLeft runs from -max to 0.
  let left = getComputedStyle(element).direction === 'rtl' ? element.scrollLeft + max : element.scrollLeft
  return { back: left, forward: max - left }
}

interface GestureOptions {
  open: boolean
  drawer: DrawerContext
  setOpen: DialogContext['setOpen']
  /** Called right after the dialog opened, before the focus scope's first frame. */
  onOpen?: () => void
}

/**
 * Runs the drawer's gestures and measures on its native dialog in the
 * browser: the drag, its release, the snap point offsets, the touch-action
 * of scroll containers inside, the virtual keyboard, and the stack of nested
 * drawers. It writes CSS variables and data attributes on the dialog, which
 * the drawer's styles read.
 */
const drawerGesture: MixinFactory<HTMLDialogElement, [options: GestureOptions]> = createMixin<
  HTMLDialogElement,
  [options: GestureOptions]
>(
  (handle) => {
    let host: HTMLDialogElement | null = null
    let options: GestureOptions
    let controller: AbortController | null = null
    let measures: SnapPointMeasures = { viewportHeight: 0, popupHeight: 0, rootFontSize: 16 }
    let points: ResolvedSnapPoint[] = []
    let activeOffset = 0
    let inset = 0
    let movement = 0
    let progress = 0
    let drag: Drag | null = null
    let wasOpen = false
    let wasNested = false
    let frames = new Set<number>()
    let touchActions = new Map<HTMLElement, string>()
    // A scroll region whose size changes, such as at another snap point, can
    // start or stop overflowing without a scroll or a change to its content.
    let regions: ResizeObserver | null = null
    let directional = false
    let suppressClick = false

    const direction = () => options.drawer.swipeDirection
    const axis = () => axisOf(direction())
    const sign = () => signOf(direction())
    // Snap points move vertical drawers only, as in Base UI.
    const snapping = () => axis() === 'y' && points.length > 0

    function frame(callback: () => void) {
      let view = host?.ownerDocument.defaultView
      if (!view) return
      let id = view.requestAnimationFrame(() => {
        frames.delete(id)
        callback()
      })
      frames.add(id)
    }

    function size() {
      if (!host) return 0
      return axis() === 'y' ? host.offsetHeight : host.offsetWidth
    }

    // The height that shows: at a snap point, less what sits off the screen.
    // A drawer behind this one stacks against it.
    function shownHeight() {
      return snapping() ? measures.popupHeight - activeOffset : measures.popupHeight
    }

    function restingProgress() {
      if (!snapping() || points.length < 2) return 0
      let offsets = points.map((point) => point.offset).sort((a, b) => a - b)
      return clamp((activeOffset - offsets[0]) / (offsets[1] - offsets[0]), 0, 1)
    }

    function measure() {
      if (!host) return
      let document = host.ownerDocument
      let viewport = document.defaultView?.visualViewport
      let layoutHeight = document.documentElement.clientHeight
      inset = viewport
        ? keyboardInset({
            layoutHeight,
            height: viewport.height,
            offsetTop: viewport.offsetTop,
            scale: viewport.scale,
          })
        : 0
      let rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      // A drawer behind a nested one keeps the size it had, so its snap points stay.
      if (options.drawer.nestedOpen === 0) {
        measures = {
          viewportHeight: layoutHeight - inset,
          popupHeight: host.offsetHeight,
          rootFontSize: Number.isFinite(rootFontSize) ? rootFontSize : 16,
        }
      }
      points = axis() === 'y' ? resolveSnapPoints(options.drawer.snapPoints, measures) : []
      activeOffset = findSnapPoint(points, options.drawer.snapPoint, measures)?.offset ?? 0
      // Every measurement tells a drawer behind this one what it shows now. A
      // snap point in rem or a fraction of the viewport can show more or less
      // at the same popup size, such as after a text zoom.
      if (options.open) options.drawer.report(host, true, shownHeight())
    }

    function paint() {
      if (!host) return
      let style = host.style
      let [moved, still] = axis() === 'y' ? ['y', 'x'] : ['x', 'y']
      style.setProperty(`--drawer-swipe-movement-${moved}`, `${sign() * movement}px`)
      style.setProperty(`--drawer-swipe-movement-${still}`, '0px')
      style.setProperty('--drawer-swipe-progress', String(progress))
      style.setProperty('--drawer-keyboard-inset', `${inset}px`)
      // Behind a nested drawer, it takes the frontmost one's height, so its snap offset no longer applies.
      if (snapping() && options.drawer.nestedOpen === 0) {
        style.setProperty('--drawer-snap-point-offset', `${sign() * activeOffset}px`)
      } else style.removeProperty('--drawer-snap-point-offset')

      let { nestedOpen, frontmostHeight } = options.drawer
      if (nestedOpen > 0) {
        style.setProperty('--nested-drawers', String(nestedOpen))
        if (frontmostHeight > 0) style.setProperty('--drawer-frontmost-height', `${frontmostHeight}px`)
        // From here, the height changes from one length to another, which can move.
        if (!wasNested) style.setProperty('--drawer-height', `${measures.popupHeight}px`)
      } else {
        style.removeProperty('--nested-drawers')
        style.removeProperty('--drawer-frontmost-height')
        style.removeProperty('--drawer-height')
      }
      wasNested = nestedOpen > 0
    }

    // Applies a change of size at once, so the drawer stays where it is instead of sliding.
    function paintResized() {
      if (!host) return
      host.toggleAttribute('data-resizing', true)
      paint()
      void getComputedStyle(host).translate
      frame(() => host?.removeAttribute('data-resizing'))
    }

    function updateTouchAction(element: HTMLElement) {
      if (!host || element.closest('dialog') !== host) return
      let style = getComputedStyle(element)
      let along = axis() === 'y' ? style.overflowY : style.overflowX
      let room = isScrollable(along) ? scrollRoom(element, axis()) : { back: 0, forward: 0 }
      let back = room.back > 1
      let forward = room.forward > 1
      let toward = sign() > 0 ? back : forward
      let away = sign() > 0 ? forward : back
      let value = touchActionFor(direction(), { toward, away }, directional)
      if (!touchActions.has(element)) {
        touchActions.set(element, element.style.touchAction)
        regions?.observe(element)
      }
      element.style.touchAction = value || touchActions.get(element) || ''
    }

    // Every scroll container in the drawer, but not in a dialog nested inside it.
    function updateTouchActions() {
      if (!host || !options.open) return
      for (let element of host.querySelectorAll<HTMLElement>('*')) {
        let style = getComputedStyle(element)
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
        if (style.overflowX === 'clip' && style.overflowY === 'clip') continue
        updateTouchAction(element)
      }
    }

    function restoreTouchActions() {
      regions?.disconnect()
      for (let [element, value] of touchActions) element.style.touchAction = value
      touchActions.clear()
    }

    // The closest scroll container around `target` that overflows along the drawer's axis.
    function scrollerAt(target: Element) {
      for (let element: Element | null = target; element && element !== host; element = element.parentElement) {
        let style = getComputedStyle(element)
        if (!isScrollable(axis() === 'y' ? style.overflowY : style.overflowX)) continue
        let { back, forward } = scrollRoom(element, axis())
        if (back <= 1 && forward <= 1) continue
        return sign() > 0 ? { toward: back > 1, away: forward > 1 } : { toward: forward > 1, away: back > 1 }
      }
      return null
    }

    // At a snap point, part of the drawer sits off the screen. Focus that lands
    // there, which scroll padding alone doesn't keep out in WebKit, scrolls its
    // scroll container until the element shows. The browser's own scrolling
    // into view then finds it visible.
    function reveal(element: Element) {
      if (!host || !snapping()) return
      let drawer = host.getBoundingClientRect()
      let top = Math.max(drawer.top, 0)
      let bottom = Math.min(drawer.bottom, measures.viewportHeight)
      let box = element.getBoundingClientRect()
      let shift = box.top < top ? box.top - top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0
      if (shift === 0) return
      for (let parent = element.parentElement; parent && parent !== host; parent = parent.parentElement) {
        let { overflowY } = getComputedStyle(parent)
        if (isScrollable(overflowY) && parent.scrollHeight > parent.clientHeight) {
          parent.scrollTop += shift
          return
        }
      }
    }

    function parentPopup() {
      return options.drawer.parent?.getPopup() ?? null
    }

    function setNestedSwiping(swiping: boolean, nestedProgress = 0) {
      let parent = parentPopup()
      if (!parent) return
      parent.toggleAttribute('data-nested-drawer-swiping', swiping)
      if (swiping) parent.style.setProperty('--drawer-nested-swipe-progress', String(nestedProgress))
      else parent.style.removeProperty('--drawer-nested-swipe-progress')
    }

    function endDrag() {
      let current = drag
      drag = null
      if (!current?.active || !host) return
      host.removeAttribute('data-swiping')
      if (current.nestedSwiping) setNestedSwiping(false)
      if (host.hasPointerCapture?.(current.pointerId)) host.releasePointerCapture(current.pointerId)
    }

    function rest() {
      movement = 0
      progress = restingProgress()
      host?.removeAttribute('data-swipe-dismiss')
      host?.style.removeProperty('--drawer-swipe-strength')
      paint()
    }

    function canStart(event: PointerEvent) {
      let target = event.target
      if (!host || !(target instanceof Element) || target.closest('dialog') !== host) return false
      if (target.closest('input[type="range"]')) return false
      let ignored = target.closest('[data-swipe-ignore]')
      if (ignored && host.contains(ignored)) {
        // Touch drags along the other axis still belong to the drawer.
        let cross = axis() === 'y' ? 'x' : 'y'
        if (event.pointerType !== 'touch' || ignored.getAttribute('data-swipe-ignore') !== cross) return false
      }
      if (event.pointerType === 'touch') {
        let selection = host.ownerDocument.getSelection()
        return !(selection && !selection.isCollapsed && selection.containsNode(host, true))
      }
      let skipped = target.closest(pointerIgnore)
      return !(skipped && host.contains(skipped))
    }

    function onPointerDown(event: PointerEvent) {
      if (!host || !options.open || drag || event.defaultPrevented || !event.isPrimary) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (options.drawer.nestedOpen > 0 || !canStart(event)) return
      drag = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        start: { x: event.clientX, y: event.clientY },
        origin: 0,
        active: false,
        attributed: false,
        startTime: event.timeStamp,
        baseOffset: activeOffset,
        delta: 0,
        sample: null,
        stationary: false,
        velocity: 0,
        nestedSwiping: false,
        scroller: event.pointerType === 'touch' && event.target instanceof Element ? scrollerAt(event.target) : null,
        yielded: false,
        position: 0,
        size: 0,
      }
    }

    function activate(event: PointerEvent, current: Drag) {
      if (!host) return
      current.active = true
      current.origin = axis() === 'y' ? event.clientY : event.clientX
      current.startTime = event.timeStamp
      current.baseOffset = activeOffset
      current.size = size()
      try {
        host.setPointerCapture(current.pointerId)
      } catch {
        // A pointer that is gone or synthetic can't be captured; its moves still bubble here.
      }
      host.toggleAttribute('data-swiping', true)
      if (current.pointerType !== 'touch') {
        let selection = host.ownerDocument.getSelection()
        if (selection && !selection.isCollapsed && selection.containsNode(host, true)) selection.removeAllRanges()
      }
    }

    function onPointerMove(event: PointerEvent) {
      let current = drag
      if (!host || !current || event.pointerId !== current.pointerId) return
      // A mouse or pen let go outside the drawer, where its pointerup didn't reach.
      if (current.pointerType !== 'touch' && (event.buttons & 1) === 0) return cancel(event)
      let dx = event.clientX - current.start.x
      let dy = event.clientY - current.start.y
      let along = axis() === 'y' ? dy : dx
      let across = axis() === 'y' ? dx : dy
      if (!current.active) {
        if (current.yielded) return
        let touch = current.pointerType === 'touch'
        if (Math.max(Math.abs(dx), Math.abs(dy)) < (touch ? TOUCH_SLOP : DRAG_SLOP)) return
        // The browser scrolls content that can still scroll that way, and pans along the other axis.
        let { scroller } = current
        if (touch && (Math.abs(across) > Math.abs(along) || scroller?.toward || (scroller && along * sign() < 0))) {
          current.yielded = true
          return
        }
        activate(event, current)
      }
      // Keeps a mouse drag from selecting text.
      if (current.pointerType !== 'touch') event.preventDefault()

      if (!current.attributed && Math.abs(along) >= Math.abs(across) && along !== 0) {
        current.attributed = along * sign() > 0 || snapping()
      }

      follow(current, axis() === 'y' ? event.clientY : event.clientX)
      record(current, current.delta, event.timeStamp)
      paint()

      if (current.nestedSwiping || Math.abs(current.delta) >= MIN_SWIPE_THRESHOLD) {
        current.nestedSwiping = true
        setNestedSwiping(true, progress)
      }
    }

    // Moves the drawer with the pointer at `position` along its axis.
    function follow(current: Drag, position: number) {
      let delta = sign() * (position - current.origin)
      current.position = position
      current.delta = delta
      movement = snapping() ? snapPointMovement(current.baseOffset, delta) : resist(delta)
      if (snapping() && points.length >= 2) {
        let offsets = points.map((point) => point.offset).sort((a, b) => a - b)
        let offset = clamp(current.baseOffset + delta, 0, measures.popupHeight)
        progress = clamp((offset - offsets[0]) / (offsets[1] - offsets[0]), 0, 1)
      } else {
        progress = current.size > 0 ? Math.max(0, delta) / current.size : 0
      }
    }

    // Keeps the velocity between the last two moving samples. One stationary
    // move right before release, which some Android devices send, doesn't count.
    function record(current: Drag, delta: number, time: number) {
      let last = current.sample
      if (last && time > last.time) {
        let stationary = Math.abs(delta - last.delta) < 1
        let skip = stationary && !current.stationary
        current.stationary = stationary
        if (skip) return
        current.velocity = (delta - last.delta) / Math.max(time - last.time, MIN_SAMPLE_DURATION)
      }
      current.sample = { delta, time }
    }

    function releaseVelocity(current: Drag, time: number) {
      let last = current.sample
      if (!last || time < last.time) return current.velocity
      let age = time - last.time
      if (age > MAX_SAMPLE_AGE) return 0
      let moved = current.delta - last.delta
      return Math.abs(moved) >= 1 ? moved / Math.max(age, MIN_SAMPLE_DURATION) : current.velocity
    }

    function onPointerUp(event: PointerEvent) {
      let current = drag
      if (!host || !current || event.pointerId !== current.pointerId) return
      endDrag()
      if (!current.active) return
      // A drag that ends on a control doesn't press it.
      suppressClick = true
      frame(() => (suppressClick = false))

      let elapsed = event.timeStamp - current.startTime
      let velocity = elapsed > 0 ? current.delta / Math.max(elapsed, MIN_VELOCITY_DURATION) : 0
      let atRelease = releaseVelocity(current, event.timeStamp)
      let decision = decideSwipeRelease({
        delta: current.delta,
        attributed: current.attributed,
        size: size(),
        velocity,
        releaseVelocity: atRelease,
        snap: snapping()
          ? {
              points,
              activeOffset: current.baseOffset,
              popupHeight: measures.popupHeight,
              sequential: options.drawer.snapToSequentialPoints,
            }
          : undefined,
      })

      if (decision.type === 'close') {
        close(event, current, atRelease || velocity)
      } else {
        // It heads for the new snap point at once. The next render confirms it, or
        // moves it back for a controlled owner that keeps the old one.
        let { snapPoint } = decision.type === 'snap' ? decision : {}
        if (snapPoint && options.drawer.setSnapPoint(snapPoint.value, { reason: 'swipe', event })) {
          activeOffset = snapPoint.offset
        }
        rest()
      }
    }

    function close(event: Event, current: Drag, velocity: number) {
      if (!host) return
      let travelled = (snapping() ? current.baseOffset : 0) + current.delta
      let strength = swipeReleaseStrength({ size: size(), travelled, velocity })
      if (strength !== null) host.style.setProperty('--drawer-swipe-strength', String(strength))
      host.toggleAttribute('data-swipe-dismiss', true)
      // The drawer slides on from where the drag left it.
      if (!options.setOpen(false, { reason: 'swipe', event })) return rest()
      // A controlled drawer whose owner keeps it open slides back.
      frame(() => {
        if (options.open) rest()
      })
    }

    function cancel(event: PointerEvent) {
      let current = drag
      if (!current || event.pointerId !== current.pointerId) return
      endDrag()
      if (current.active) rest()
    }

    function onClick(event: MouseEvent) {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }

    function sync() {
      if (!host) return
      let { open } = options
      if (open && !wasOpen) {
        options.onOpen?.()
        directional = CSS.supports('touch-action', 'pan-down')
        measure()
        rest()
        updateTouchActions()
      } else if (open) {
        let before = activeOffset
        measure()
        if (activeOffset !== before && !drag?.active) progress = restingProgress()
        paint()
      } else if (wasOpen) {
        // Escape or a close button in the middle of a drag: it slides closed from where it is.
        endDrag()
        restoreTouchActions()
      }
      wasOpen = open
      options.drawer.report(host, open, open ? shownHeight() : 0)
    }

    function onResize() {
      if (!host || !options.open) return
      let before = activeOffset
      measure()
      let current = drag
      if (current?.active) {
        // Keeps the edge of the dragged drawer under the pointer, wherever its new size and offset put it.
        current.origin -= sign() * (before - activeOffset + size() - current.size)
        current.baseOffset = activeOffset
        current.size = size()
        follow(current, current.position)
      } else {
        progress = restingProgress()
      }
      paintResized()
      updateTouchActions()
    }

    let touchActionsQueued = false
    function queueTouchActions() {
      if (touchActionsQueued) return
      touchActionsQueued = true
      frame(() => {
        touchActionsQueued = false
        updateTouchActions()
      })
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      registerProperties()
      controller = new AbortController()
      let signal = controller.signal
      let view = host.ownerDocument.defaultView!

      host.addEventListener('pointerdown', onPointerDown, { signal })
      host.addEventListener('pointermove', onPointerMove, { signal })
      host.addEventListener('pointerup', onPointerUp, { signal })
      host.addEventListener('pointercancel', cancel, { signal })
      host.addEventListener(
        'lostpointercapture',
        (event) => {
          // A touched element loses its implicit capture when the drawer takes the pointer; that one bubbles here.
          if (event.target === host) cancel(event)
        },
        { signal },
      )
      host.addEventListener('click', onClick, { capture: true, signal })
      host.addEventListener(
        'focusin',
        (event) => {
          if (options.open && event.target instanceof Element && event.target.closest('dialog') === host) {
            reveal(event.target)
          }
        },
        { signal },
      )
      host.addEventListener(
        'scroll',
        (event) => {
          if (event.target instanceof HTMLElement && options.open) updateTouchAction(event.target)
        },
        { capture: true, passive: true, signal },
      )
      view.addEventListener('resize', onResize, { signal })
      view.visualViewport?.addEventListener('resize', onResize, { signal })

      let resizes = new ResizeObserver(() => {
        if (!host || !options.open || drag?.active) return
        let before = { offset: activeOffset, height: measures.popupHeight }
        measure()
        if (before.offset !== activeOffset || before.height !== measures.popupHeight) {
          progress = restingProgress()
          paintResized()
        }
        queueTouchActions()
      })
      resizes.observe(host)
      regions = new ResizeObserver((entries) => {
        if (!options.open) return
        for (let { target } of entries) if (target instanceof HTMLElement) updateTouchAction(target)
      })
      let mutations = new MutationObserver(() => options.open && queueTouchActions())
      mutations.observe(host, { childList: true, subtree: true, characterData: true })
      signal.addEventListener('abort', () => {
        resizes.disconnect()
        regions?.disconnect()
        regions = null
        mutations.disconnect()
      })

      handle.queueTask(sync)
    })

    handle.addEventListener('remove', () => {
      endDrag()
      setNestedSwiping(false)
      controller?.abort()
      controller = null
      for (let id of frames) host?.ownerDocument.defaultView?.cancelAnimationFrame(id)
      frames.clear()
      restoreTouchActions()
      options.drawer.report(null, false, 0)
      host = null
      wasOpen = false
    })

    return (nextOptions) => {
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)

export interface DrawerContentProps extends DialogPopupProps {}

/**
 * The drawer itself: a native <dialog> along the edge its root's
 * `swipeDirection` names, over a dimmed page, which follows the pointer. Its
 * children sit in a content column that scrolls when it is taller than the
 * drawer. Put DrawerHeader with DrawerTitle and DrawerDescription in it, so
 * the drawer has a name and a description. It focuses itself when it opens,
 * as Base UI's drawer does, so no virtual keyboard opens.
 */
export function DrawerContent(handle: Handle<DrawerContentProps>) {
  let element: HTMLDialogElement | null = null
  // Where opening put focus: the drawer, with its autofocus, or its first
  // control in browsers that skip a dialog's own autofocus.
  let focusAtOpen: Element | null = null

  // The drawer itself, unless Tab or a press already moved focus on inside it.
  function focusSelf() {
    let active = element?.ownerDocument.activeElement
    return active && active !== focusAtOpen && element?.contains(active) ? null : element
  }

  return () => {
    let drawer = getDrawerContext(handle, 'DrawerContent')
    let dialog = getDialogContext(handle, 'DrawerContent')
    let { initialFocus, mix, children, ...props } = handle.props
    let { swipeDirection, snapPoints, snapPoint } = drawer
    let snaps = (snapPoints?.length ?? 0) > 0

    return (
      <DialogPopup
        data-slot="drawer-popup"
        data-swipe-direction={swipeDirection}
        data-swipe-axis={axisOf(swipeDirection)}
        data-snap-points={snaps ? '' : undefined}
        data-expanded={snaps && Object.is(snapPoint, 1) ? '' : undefined}
        data-nested-drawer-open={drawer.nestedOpen > 0 ? '' : undefined}
        // The dialog's own autofocus makes showModal() focus it, and not its
        // first control, also before any script runs, where browsers honor it.
        autofocus={initialFocus === undefined ? true : undefined}
        initialFocus={initialFocus ?? focusSelf}
        {...props}
        mix={[
          popupRules[swipeDirection],
          ref((node: HTMLDialogElement) => (element = node)),
          drawerGesture({
            open: dialog.open,
            drawer,
            setOpen: dialog.setOpen,
            onOpen: () => (focusAtOpen = element?.ownerDocument.activeElement ?? null),
          }),
          mix,
        ]}
      >
        {drawer.showSwipeHandle ? <DrawerSwipeHandle /> : null}
        <div data-slot="drawer-content" mix={contentRule}>
          {children}
        </div>
      </DialogPopup>
    )
  }
}

export interface DrawerSnapPointButtonProps extends Omit<Props<'button'>, 'type'> {
  /** The snap point the button moves the drawer to. */
  snapPoint: DrawerSnapPoint
}

/**
 * A native button that moves the drawer to a snap point, so the keyboard
 * reaches every height a drag does. It renders `aria-pressed` for the
 * active snap point. It stays disabled until the drawer runs in the browser,
 * and in a drawer without snap points. Unstyled; give it a look with
 * `buttonVariants()`.
 */
export function DrawerSnapPointButton(handle: Handle<DrawerSnapPointButtonProps>) {
  let running = false
  handle.queueTask(() => {
    running = true
    void handle.update()
  })

  return () => {
    let drawer = getDrawerContext(handle, 'DrawerSnapPointButton')
    let { snapPoint, disabled, mix, ...props } = handle.props
    let usable = running && axisOf(drawer.swipeDirection) === 'y' && (drawer.snapPoints?.length ?? 0) > 0
    let active = Object.is(drawer.snapPoint, snapPoint)

    return (
      <button
        data-slot="drawer-snap-point-button"
        aria-pressed={active ? 'true' : 'false'}
        {...props}
        type="button"
        disabled={Boolean(disabled) || !usable}
        mix={[
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            drawer.setSnapPoint(snapPoint, { reason: 'snap-point-press', event })
          }),
        ]}
      />
    )
  }
}

const headerRule = css({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: space(0.5),
  padding: space(4),
  paddingBlockEnd: 0,
  ':where([data-swipe-axis="y"] > [data-slot="drawer-content"]) > &': { textAlign: 'center' },
  '@media (min-width: 48rem)': {
    gap: space(1.5),
    ':where([data-swipe-axis="y"] > [data-slot="drawer-content"]) > &': { textAlign: 'start' },
  },
})

/** Groups the title and description at the top of the drawer. Centered in a vertical drawer below 48rem. */
export function DrawerHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="drawer-header" {...props} mix={[headerRule, mix]} />
  }
}

const footerRule = css({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: space(2),
  marginBlockStart: 'auto',
  padding: space(4),
  paddingBlockStart: 0,
})

/** Holds the drawer's actions at the bottom of its content. */
export function DrawerFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="drawer-footer" {...props} mix={[footerRule, mix]} />
  }
}

const titleRule = css({ margin: 0, color: 'var(--foreground)', fontSize: 'inherit', fontWeight: 500 })

/** The drawer's name: an <h2> the drawer points to with aria-labelledby. */
export function DrawerTitle(handle: Handle<Omit<Props<'h2'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'DrawerTitle')
    let { mix, ...props } = handle.props
    return <h2 data-slot="drawer-title" {...props} id={dialog.ids.title} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  textWrap: 'balance',
})

/** The drawer's description: a paragraph the drawer points to with aria-describedby. */
export function DrawerDescription(handle: Handle<Omit<Props<'p'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'DrawerDescription')
    let { mix, ...props } = handle.props
    return <p data-slot="drawer-description" {...props} id={dialog.ids.description} mix={[descriptionRule, mix]} />
  }
}
