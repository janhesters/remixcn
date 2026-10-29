// RemixCN Collapsible: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export const collapsibleChangeType = 'remixcn:collapsible-change' as const

/**
 * Dispatched on the collapsible before it opens or closes, and bubbles.
 * `open` is the next state. Cancel it with `preventDefault()` to keep the
 * current one. It takes the place of shadcn's `onOpenChange`.
 */
export class CollapsibleChangeEvent extends Event {
  readonly open: boolean

  constructor(open: boolean) {
    super(collapsibleChangeType, { bubbles: true, cancelable: true })
    this.open = open
  }
}

declare global {
  interface HTMLElementEventMap {
    [collapsibleChangeType]: CollapsibleChangeEvent
  }
}

export interface CollapsibleProps extends Props<'div'> {
  /** Whether the panel is open, for a collapsible the caller controls. */
  open?: boolean
  /** Whether the panel starts open. */
  defaultOpen?: boolean
  /** Disables the trigger, so the panel keeps its state. */
  disabled?: boolean
}

export interface CollapsibleTriggerProps extends Omit<
  Props<'button'>,
  'type' | 'id' | 'aria-expanded' | 'aria-controls'
> {}

export interface CollapsibleContentProps extends Omit<Props<'div'>, 'id' | 'hidden'> {
  /** Keeps a closed panel in the document, hidden, instead of removing it. */
  keepMounted?: boolean
  /**
   * Keeps a closed panel in the document with hidden="until-found", so the
   * browser's find in page can search it and open it on a match. It wins
   * over keepMounted.
   */
  hiddenUntilFound?: boolean
}

export interface CollapsibleContext {
  open: boolean
  disabled: boolean
  triggerId: string
  panelId: string
  /** Asks to open or close. Returns false when a listener cancels the change or the collapsible ignores it. */
  setOpen(open: boolean): boolean
}

/**
 * Shows and hides a panel with a native button. The trigger and the panel
 * may sit anywhere inside it. Their ids come from the collapsible's id, or a
 * generated one, so the trigger always points at its panel.
 */
export function Collapsible(handle: Handle<CollapsibleProps, CollapsibleContext>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let root: HTMLElement | undefined

  function setOpen(open: boolean) {
    if (!root || handle.props.disabled) return false

    let accepted = root.dispatchEvent(new CollapsibleChangeEvent(open))
    if (accepted && handle.props.open === undefined) {
      uncontrolledOpen = open
      void handle.update()
    }
    return accepted
  }

  return () => {
    let { open: controlledOpen, defaultOpen: _defaultOpen, disabled = false, mix, ...props } = handle.props
    let open = controlledOpen ?? uncontrolledOpen
    let base = props.id ?? handle.id

    handle.context.set({ open, disabled, triggerId: `${base}-trigger`, panelId: `${base}-panel`, setOpen })

    return (
      <div
        data-slot="collapsible"
        {...props}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        data-disabled={disabled ? '' : undefined}
        mix={[
          ref<HTMLDivElement>((node, signal) => {
            root = node
            signal.addEventListener('abort', () => {
              if (root === node) root = undefined
            })
          }),
          mix,
        ]}
      />
    )
  }
}

/**
 * The native button that opens and closes the panel. It is always
 * type="button", so it never submits a form. Give it a button's look with
 * `mix={buttonVariants(...)}` from button.tsx.
 */
export function CollapsibleTrigger(handle: Handle<CollapsibleTriggerProps>) {
  return () => {
    let collapsible = handle.context.get(Collapsible) as CollapsibleContext | undefined
    let { disabled, mix, ...props } = handle.props
    let open = collapsible?.open ?? false

    return (
      <button
        data-slot="collapsible-trigger"
        {...props}
        type="button"
        id={collapsible?.triggerId}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? collapsible?.panelId : undefined}
        data-panel-open={open ? '' : undefined}
        disabled={collapsible?.disabled || disabled}
        mix={[
          // The caller's handlers run first, so they can cancel the click.
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            let current = handle.context.get(Collapsible) as CollapsibleContext | undefined
            current?.setOpen(!current.open)
          }),
        ]}
      />
    )
  }
}

/** The custom property that holds the panel's height while it opens and closes. */
export const collapsiblePanelHeight = '--collapsible-panel-height'

// Before the browser measures it, and once a transition ends, the panel takes
// its natural height, so it works without JavaScript and follows its content.
const contentStyles = css({
  height: `var(${collapsiblePanelHeight}, auto)`,
  transitionProperty: 'height',
  transitionDuration: 'var(--duration-normal)',
  transitionTimingFunction: 'var(--ease-out)',
  '&[data-starting-style], &[data-ending-style]': { height: 0 },
  // Only while it moves, so focus rings inside an open panel aren't clipped.
  '&[data-animating]': { overflow: 'hidden' },
})

/** Resolves once the element's transitions and animations end, or the signal aborts. */
export function animationsFinished(element: Element, signal: AbortSignal): Promise<void> {
  // getAnimations() applies pending style changes first, so it sees the transitions they start.
  let animations = element.getAnimations?.() ?? []
  if (animations.length === 0 || signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => resolve())
  })
}

/** Grows the panel from its current height, or from 0, to its content's height. */
async function expand(panel: HTMLElement, signal: AbortSignal, animate: boolean) {
  let closing = panel.hasAttribute('data-ending-style')
  panel.removeAttribute('data-ending-style')

  if (animate) {
    if (!closing) panel.setAttribute('data-starting-style', '')
    panel.setAttribute('data-animating', '')
    // Reading the height lays out the start state, so dropping it starts the transition.
    panel.style.setProperty(collapsiblePanelHeight, `${panel.scrollHeight}px`)
    panel.removeAttribute('data-starting-style')
    await animationsFinished(panel, signal)
    if (signal.aborted) return
  }

  panel.removeAttribute('data-starting-style')
  panel.removeAttribute('data-animating')
  panel.style.removeProperty(collapsiblePanelHeight)
}

/** Shrinks the panel from its height to 0, moving focus out of it first. */
async function collapse(panel: HTMLElement, signal: AbortSignal, triggerId: string | undefined) {
  let focused = panel.ownerDocument.activeElement
  if (focused && panel.contains(focused) && triggerId) {
    panel.ownerDocument.getElementById(triggerId)?.focus()
  }

  panel.removeAttribute('data-starting-style')
  panel.setAttribute('data-animating', '')
  panel.style.setProperty(collapsiblePanelHeight, `${panel.scrollHeight}px`)
  // Lay out the full height first, so the transition starts from it.
  panel.getBoundingClientRect()
  panel.setAttribute('data-ending-style', '')
  await animationsFinished(panel, signal)
}

type Presence = 'open' | 'closing' | 'closed'

/**
 * The panel. A closed panel leaves the document, unless keepMounted or
 * hiddenUntilFound keep it there, hidden. It grows and shrinks with the
 * motion tokens, which reduced motion sets to 0s, and leaves or hides only
 * once its transition ends. While it closes, it is inert, so nothing in it
 * takes focus.
 */
export function CollapsibleContent(handle: Handle<CollapsibleContentProps>) {
  let presence: Presence | undefined
  let panel: HTMLElement | undefined
  let motion: AbortController | undefined
  // The browser opens a panel it finds right away, so that one doesn't animate.
  let found = false

  handle.signal.addEventListener('abort', () => motion?.abort())

  function startMotion() {
    motion?.abort()
    motion = new AbortController()
    return motion.signal
  }

  return () => {
    let collapsible = handle.context.get(Collapsible) as CollapsibleContext | undefined
    let open = collapsible?.open ?? false
    let { keepMounted = false, hiddenUntilFound = false, mix, ...props } = handle.props

    if (presence === undefined) {
      // The first render, on the server or in the browser, shows the state as it is.
      presence = open ? 'open' : 'closed'
    } else if (open && presence !== 'open') {
      presence = 'open'
      let signal = startMotion()
      let animate = !found
      found = false
      handle.queueTask(() => {
        if (panel) void expand(panel, signal, animate)
      })
    } else if (!open && presence === 'open') {
      presence = panel ? 'closing' : 'closed'
      let signal = startMotion()
      let triggerId = collapsible?.triggerId
      handle.queueTask(async () => {
        if (panel) await collapse(panel, signal, triggerId)
        if (signal.aborted || presence !== 'closing') return
        presence = 'closed'
        void handle.update()
      })
    }

    if (presence === 'closed' && !keepMounted && !hiddenUntilFound) return null

    return (
      <div
        data-slot="collapsible-content"
        {...props}
        id={collapsible?.panelId}
        hidden={presence === 'closed' ? (hiddenUntilFound ? 'until-found' : true) : undefined}
        // A closing panel is still visible, but nothing in it may take focus.
        // Otherwise the caller's inert applies.
        inert={presence === 'closing' ? true : props.inert}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentStyles,
          ref<HTMLDivElement>((node, signal) => {
            panel = node
            // The browser shows a hidden="until-found" panel when find in page
            // matches it. If the collapsible stays closed, because a listener
            // cancelled the change or its owner didn't render it open, hide it again.
            let timer: ReturnType<typeof setTimeout> | undefined
            let onFound = () => {
              let current = handle.context.get(Collapsible) as CollapsibleContext | undefined
              found = true
              current?.setOpen(true)
              clearTimeout(timer)
              timer = setTimeout(() => {
                if (presence !== 'closed') return
                found = false
                node.setAttribute('hidden', 'until-found')
              })
            }
            node.addEventListener('beforematch', onFound)
            signal.addEventListener('abort', () => {
              clearTimeout(timer)
              node.removeEventListener('beforematch', onFound)
              if (panel === node) panel = undefined
            })
          }),
          mix,
        ]}
      />
    )
  }
}
