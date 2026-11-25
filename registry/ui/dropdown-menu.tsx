// RemixCN Dropdown Menu: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css, on, ref } from 'remix/component'
import type { Handle, MixinFactory, Props, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, Side } from '#remixcn/lib/anchor-position.ts'
import {
  createTypeahead,
  findTypeaheadMatch,
  getNextIndex,
  isFocusableItem,
  rovingFocus,
} from '#remixcn/lib/composite.ts'
import { focusScope, getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import type { FocusScopeOptions } from '#remixcn/lib/focus-scope.ts'
import { CheckIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { modal as modalMixin } from '#remixcn/lib/modal.ts'
import { focusRing, mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A button that opens a menu of choices, of which one is chosen, such as a
// theme picker with Light, Dark and System. A click, Enter, Space or an arrow
// key on the trigger opens it; the arrow keys, Home, End and typed letters
// move between its choices; Enter, Space or a click chooses one. A choice and
// Escape close it and return focus to the trigger, a press elsewhere closes
// it, and Tab closes it and moves on from the trigger.
//
// The menu is a native popover in the top layer, above everything and outside
// any box that clips its overflow. Until the browser runs it, and on a page
// without JavaScript, the trigger opens it natively with popovertarget: the
// browser shows it in the middle of the screen, and its choices are plain
// buttons that submit no form. Once it runs, it sits next to the trigger and
// handles the keyboard. The parts run in the browser inside your client
// entry, like Button, so they take your mixins.

export type DropdownMenuOpenChangeReason =
  'trigger-press' | 'item-press' | 'list-navigation' | 'escape-key' | 'outside-press' | 'focus-out' | 'trigger-removed'

export const dropdownMenuOpenChangeType = 'remixcn:dropdown-menu-open-change' as const

/**
 * Dispatched on the menu's content before it opens or closes. It doesn't
 * bubble. `open` is the next state and `reason` says what asked for it.
 * Cancel it with `preventDefault()` to keep the current state. It takes the
 * place of Base UI's `onOpenChange`.
 */
export class DropdownMenuOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: DropdownMenuOpenChangeReason
  /** The event that asked for the change, if any. */
  readonly cause: Event | undefined

  constructor(open: boolean, reason: DropdownMenuOpenChangeReason, cause?: Event) {
    super(dropdownMenuOpenChangeType, { cancelable: true })
    this.open = open
    this.reason = reason
    this.cause = cause
  }
}

export const dropdownMenuValueChangeType = 'remixcn:dropdown-menu-value-change' as const

/**
 * Dispatched on a radio group before another of its choices is chosen, and
 * bubbles. `value` is the chosen item's value. Cancel it with
 * `preventDefault()` to keep the current choice and the menu open. It takes
 * the place of Base UI's `onValueChange`.
 */
export class DropdownMenuValueChangeEvent extends Event {
  readonly value: string
  /** The click that asked for the change. */
  readonly cause: Event | undefined

  constructor(value: string, cause?: Event) {
    super(dropdownMenuValueChangeType, { bubbles: true, cancelable: true })
    this.value = value
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [dropdownMenuOpenChangeType]: DropdownMenuOpenChangeEvent
    [dropdownMenuValueChangeType]: DropdownMenuValueChangeEvent
  }
}

/** What takes focus when the menu opens: its first or last item, the menu itself, or nothing. */
type OpenFocus = 'first' | 'last' | 'menu' | 'none'

interface MenuApi {
  open: boolean
  running: boolean
  modal: boolean
  contentId: string
  triggerId: string
  trigger: HTMLElement | null
  content: HTMLElement | null
  /** What takes focus when it opens next. */
  focus: OpenFocus
  setOpen(open: boolean, reason: DropdownMenuOpenChangeReason, cause?: Event, focus?: OpenFocus): void
  /** Closes a non-modal menu once focus leaves both the trigger and the menu. */
  focusOut(event: FocusEvent): void
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachContent(element: HTMLElement, signal: AbortSignal): void
  /** Takes an id the trigger or content renders, for one the menu's render couldn't see. */
  adoptId(part: 'trigger' | 'content', id: string): void
}

const itemSelector = '[role="menuitemradio"]'

function getItems(content: HTMLElement) {
  return [...content.querySelectorAll<HTMLElement>(itemSelector)]
}

/** Holds the menu for the parts inside it. It renders no element. */
function MenuScope(handle: Handle<{ api: MenuApi; children?: RemixNode }, MenuApi>) {
  handle.context.set(handle.props.api)
  return () => handle.props.children
}

function useMenu(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let api = handle.context.get(MenuScope) as MenuApi | undefined
  if (!api) throw new Error(`${part} must be inside a DropdownMenu`)
  return api
}

export interface DropdownMenuProps {
  /** Whether the menu is open, for a menu you control. Update it from `DropdownMenuOpenChangeEvent`. */
  open?: boolean
  /** Whether the menu starts open. It takes no focus then. */
  defaultOpen?: boolean
  /**
   * Whether the rest of the page waits while it's open: it can't be scrolled
   * or used, and a press outside only closes the menu. Defaults to `true`.
   */
  modal?: boolean
  children?: RemixNode
}

/** Groups the menu's trigger and content and holds whether it's open. It renders no element. */
export function DropdownMenu(handle: Handle<DropdownMenuProps>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let found: Partial<Record<'trigger' | 'content', string>> = {}
  let update = () => void handle.update()

  let api: MenuApi = {
    open: false,
    running: false,
    modal: true,
    contentId: `${handle.id}-content`,
    triggerId: `${handle.id}-trigger`,
    trigger: null,
    content: null,
    // A menu open from the start takes no focus: several of them on one page would take it from each other.
    focus: 'none',
    setOpen(open, reason, cause, focus = 'menu') {
      if (handle.signal.aborted || !api.running || open === api.open) return
      let event = new DropdownMenuOpenChangeEvent(open, reason, cause)
      api.content?.dispatchEvent(event)
      if (event.defaultPrevented) return
      if (open) api.focus = focus
      if (handle.props.open === undefined) uncontrolledOpen = open
      update()
    },
    focusOut(event) {
      // Without a next element, the window lost focus or a press elsewhere moved it: the layer decides.
      let next = event.relatedTarget
      let document = next instanceof Node ? next.ownerDocument : null
      if (api.modal || !api.open || !document) return
      let inside = (node: Node | null) => Boolean(node && (api.content?.contains(node) || api.trigger?.contains(node)))
      if (inside(next as Node)) return
      // Once the browser has moved focus, so the focus scope doesn't pull it back to the trigger.
      document.defaultView?.setTimeout(() => {
        if (!inside(document.activeElement)) api.setOpen(false, 'focus-out', event)
      })
    },
    attachTrigger(element, signal) {
      api.trigger = element
      signal.addEventListener('abort', () => {
        if (api.trigger !== element) return
        api.trigger = null
        // A keyed trigger that is replaced comes back before this runs; one that is gone closes the menu.
        queueMicrotask(() => {
          if (!api.trigger && api.open) api.setOpen(false, 'trigger-removed')
        })
      })
    },
    attachContent(element, signal) {
      api.content = element
      signal.addEventListener('abort', () => {
        if (api.content === element) api.content = null
      })
    },
    adoptId(part, value) {
      if (found[part] === value || handle.signal.aborted) return
      found[part] = value
      update()
    },
  }

  return () => {
    // Tasks run only in the browser, after the first commit. Until then the menu renders closed.
    if (!api.running) {
      handle.queueTask(() => {
        // Keeps open a menu the browser opened natively before it ran.
        if (handle.props.open === undefined && api.content?.matches(':popover-open')) uncontrolledOpen = true
        api.running = true
        update()
      })
    }
    api.contentId = found.content ?? `${handle.id}-content`
    api.triggerId = found.trigger ?? `${handle.id}-trigger`
    api.open = api.running && (handle.props.open ?? uncontrolledOpen)
    api.modal = handle.props.modal ?? true
    return <MenuScope api={api}>{handle.props.children}</MenuScope>
  }
}

const triggerMixin = createMixin<HTMLElement>((handle, type) => {
  // Only a button can open a popover natively.
  let native = type === 'button'

  return (hostProps: { id?: string }) => {
    let api = useMenu(handle, 'dropdownMenuTrigger()')
    let id = hostProps.id ?? api.triggerId
    if (id !== api.triggerId) handle.queueTask(() => api.adoptId('trigger', id))

    return (
      <handle.element
        id={id}
        aria-haspopup="menu"
        aria-controls={api.contentId}
        // Until it runs, the browser reports the state of a popovertarget button itself.
        aria-expanded={api.running ? String(api.open) : undefined}
        data-popup-open={api.open ? '' : undefined}
        popovertarget={native && !api.running ? api.contentId : undefined}
        mix={[
          ref((node, signal) => api.attachTrigger(node, signal)),
          on('click', (event) => {
            if (event.defaultPrevented) return
            // A click without a pointer comes from Enter or Space, so the first choice takes focus.
            api.setOpen(!api.open, 'trigger-press', event, event.detail === 0 ? 'first' : 'menu')
          }),
          on('keydown', (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            api.setOpen(true, 'list-navigation', event, event.key === 'ArrowDown' ? 'first' : 'last')
          }),
          // Focus that leaves through the trigger leaves the menu too.
          on('focusout', (event) => api.focusOut(event)),
        ]}
      />
    )
  }
})

/**
 * Makes any element the menu's trigger, such as a styled button:
 * `<button type="button" mix={[buttonVariants({ variant: 'outline' }), dropdownMenuTrigger()]}>`.
 * On a native button, it opens the menu before the browser runs it too.
 */
export const dropdownMenuTrigger: MixinFactory<HTMLElement, []> = triggerMixin

/** A native button that opens and closes the menu. Give it `buttonVariants()` to look like a Button. */
export function DropdownMenuTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let { type = 'button', mix, ...props } = handle.props

    return <button data-slot="dropdown-menu-trigger" {...props} type={type} mix={[mix, dropdownMenuTrigger()]} />
  }
}

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface DropdownMenuContentProps extends Props<'div'> {
  /** The side of the trigger to show on (defaults to `'bottom'`). `'inline-start'` and `'inline-end'` follow the text direction. */
  side?: Side
  /** The gap to the trigger, in pixels (defaults to `4`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'start'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /** Space to keep from the edges of the viewport and `collisionBoundary`, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** An element whose box also limits where the menu goes. */
  collisionBoundary?: Element | null
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /**
   * What to focus when it closes, or `false` to leave focus alone. By default,
   * the trigger, unless focus already moved elsewhere, or a neighbor once the
   * trigger is gone.
   */
  finalFocus?: FocusScopeOptions['returnFocus']
}

// Shows the host in the top layer while open, and leaves it alone while
// `open` is null. The browser hides a closed popover.
const topLayer = createMixin<HTMLElement, [open: boolean | null]>(
  (handle) => (open) => {
    handle.queueTask((node) => {
      if (open === null || !node.isConnected || node.matches(':popover-open') === open) return
      if (open) node.showPopover()
      else node.hidePopover()
    })
    return handle.element
  },
  { ssr: false },
)

// The keys the menu takes while it has focus itself, as after a click opened
// it, and the typed letters that pick a choice, as its choices take them.
const menuKeys = createMixin<HTMLElement>((handle) => {
  let typeahead = createTypeahead()
  handle.addEventListener('remove', () => typeahead.reset())

  return () => (
    <handle.element
      mix={on('keydown', (event) => {
        let content = event.currentTarget as HTMLElement
        if (event.defaultPrevented || event.target !== content) return
        if (event.ctrlKey || event.metaKey || event.altKey) return
        let items = getItems(content).filter(isFocusableItem)
        let none = items.map(() => false)
        let next = getNextIndex(event.key, -1, none, { orientation: 'vertical', loop: true })
        if (next === undefined) {
          let query = typeahead.type(event)
          if (query === undefined) return
          next = findTypeaheadMatch(
            items.map((item) => item.textContent ?? ''),
            query,
            -1,
          )
          if (next === -1) return
        }
        event.preventDefault()
        items[next]?.focus()
      })}
    />
  )
})

// A mouse or pen over a choice gives it focus, as Base UI highlights the item
// under the pointer, and leaving it gives focus back to the menu. Touch
// pointers move nothing.
const pointerFocus = createMixin<HTMLElement>((handle) => () => (
  <handle.element
    mix={[
      on('pointermove', (event) => {
        if (event.pointerType === 'touch') return
        let item = (event.target as Element).closest<HTMLElement>(itemSelector)
        if (!item || item.ownerDocument.activeElement === item) return
        item.focus({ preventScroll: true })
      }),
      on('pointerout', (event) => {
        if (event.pointerType === 'touch') return
        let content = event.currentTarget as HTMLElement
        let item = (event.target as Element).closest<HTMLElement>(itemSelector)
        if (!item || item.contains(event.relatedTarget as Node | null)) return
        if (item.ownerDocument.activeElement !== item) return
        content.focus({ preventScroll: true })
      }),
    ]}
  />
))

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const textXs = { fontSize: 'var(--text-xs)', lineHeight: 'var(--text-xs--line-height)' }

const contentStyles = css(
  mergeStyles(
    {
      ...textXs,
      boxSizing: 'border-box',
      // As wide as the trigger, and as its longest choice, but never wider or taller than the room beside it.
      width: 'max-content',
      minWidth: 'min(max(var(--anchor-width, 0px), 8rem), var(--available-width, calc(100% - 10px)))',
      maxWidth: 'var(--available-width, calc(100% - 10px))',
      maxHeight: 'var(--available-height, calc(100% - 10px))',
      overflowX: 'hidden',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      padding: space(1),
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      outline: 'none',
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'flex', flexDirection: 'column' },
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

/**
 * The menu: a `<div role="menu">` next to the trigger, in the top layer. It
 * stays in the document while closed, hidden, so the trigger's aria-controls
 * always points at it.
 */
export function DropdownMenuContent(handle: Handle<DropdownMenuContentProps>) {
  let api = useMenu(handle, 'DropdownMenuContent')

  function initialFocus() {
    let content = api.content
    if (!content) return null
    let items = getItems(content).filter(isFocusableItem)
    if (api.focus === 'first') return items[0] ?? content
    if (api.focus === 'last') return items.at(-1) ?? content
    return content
  }

  // Tab closes the menu and moves on from the trigger, or back with Shift. The menu moves
  // focus itself, since the browser would move on from the menu, or nowhere while the page
  // is inert, and Firefox skips its own Tab once focus moved during the key press.
  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.key !== 'Tab') return
    let trigger = api.trigger
    event.preventDefault()
    api.setOpen(false, 'focus-out', event)
    if (!trigger) return
    setTimeout(() => {
      if (api.open || trigger.ownerDocument.activeElement !== trigger) return
      let stops = getTabbableElements(trigger.closest('dialog:modal') ?? trigger.ownerDocument.body)
      let index = stops.indexOf(trigger)
      if (index !== -1) stops[index + (event.shiftKey ? -1 : 1)]?.focus()
    })
  }

  return () => {
    let {
      side = 'bottom',
      sideOffset = 4,
      align = 'start',
      alignOffset = 0,
      collisionPadding = 5,
      collisionBoundary = null,
      collisionAvoidance = {},
      finalFocus,
      id,
      children,
      mix,
      ...props
    } = handle.props
    let { open, running } = api
    let contentId = id ?? api.contentId
    if (contentId !== api.contentId) handle.queueTask(() => api.adoptId('content', contentId))

    return (
      <div
        role="menu"
        aria-labelledby={api.triggerId}
        aria-orientation="vertical"
        tabIndex={-1}
        data-slot="dropdown-menu-content"
        {...props}
        id={contentId}
        popover={running ? 'manual' : 'auto'}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentStyles,
          mix,
          ref((node, signal) => api.attachContent(node, signal)),
          // Until it runs, the browser may have opened it natively; the menu keeps it open once it runs.
          topLayer(running ? open : null),
          anchorPosition({
            open,
            anchor: () => api.trigger,
            side,
            sideOffset,
            align,
            alignOffset,
            collisionPadding,
            boundary: collisionBoundary,
            flip: collisionAvoidance.side !== 'none',
            shift: collisionAvoidance.align !== 'none',
          }),
          dismissableLayer({
            open,
            modal: api.modal,
            trigger: () => api.trigger,
            onDismiss: ({ reason, event }) =>
              api.setOpen(false, reason === 'outside-press' ? 'outside-press' : 'escape-key', event),
          }),
          focusScope({
            open,
            initialFocus: api.focus === 'none' ? false : initialFocus,
            returnFocus: finalFocus ?? (() => api.trigger),
          }),
          modalMixin({ open: open && api.modal, keep: () => [api.trigger] }),
          rovingFocus({ items: itemSelector, orientation: 'vertical', loop: true, typeahead: true }),
          menuKeys(),
          pointerFocus(),
          on('keydown', (event) => onKeyDown(event)),
          // Tab out of a non-modal menu closes it.
          on('focusout', (event) => api.focusOut(event)),
        ]}
      >
        {children}
      </div>
    )
  }
}

const groupStyles = css({ display: 'flex', flexDirection: 'column' })

interface RadioGroupApi {
  value: string | undefined
  /** Asks to choose `value`, and says whether the menu may close. */
  choose(value: string, event: MouseEvent): boolean
}

export interface DropdownMenuRadioGroupProps extends Props<'div'> {
  /** The chosen value, for a group you control. Update it from `DropdownMenuValueChangeEvent`. */
  value?: string
  /** The value chosen at the start. */
  defaultValue?: string
}

/**
 * Holds the menu's choices, of which one at a time is chosen: a
 * `<div role="group">`. Name it with `aria-label` when the trigger's name
 * doesn't say what the choices are for.
 */
export function DropdownMenuRadioGroup(handle: Handle<DropdownMenuRadioGroupProps, RadioGroupApi>) {
  useMenu(handle, 'DropdownMenuRadioGroup')
  let uncontrolled = handle.props.defaultValue
  let element: HTMLElement | null = null
  let api: RadioGroupApi = {
    value: undefined,
    choose(value, event) {
      // Choosing the current value again changes nothing, and reports nothing.
      if (value === api.value) return true
      let change = new DropdownMenuValueChangeEvent(value, event)
      element?.dispatchEvent(change)
      if (change.defaultPrevented) return false
      if (handle.props.value === undefined) {
        uncontrolled = value
        void handle.update()
      }
      return true
    },
  }
  handle.context.set(api)

  return () => {
    let { value = uncontrolled, defaultValue: _defaultValue, mix, ...props } = handle.props
    api.value = value

    return (
      <div
        role="group"
        data-slot="dropdown-menu-radio-group"
        {...props}
        mix={[
          groupStyles,
          mix,
          ref((node, signal) => {
            element = node
            signal.addEventListener('abort', () => {
              if (element === node) element = null
            })
          }),
        ]}
      />
    )
  }
}

const itemStyles = css(
  mergeStyles(
    {
      ...textXs,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: space(2),
      boxSizing: 'border-box',
      width: '100%',
      minWidth: 0,
      minHeight: space(7),
      margin: 0,
      paddingBlock: space(1.5),
      paddingInlineStart: space(2),
      // Room for the check mark at the end.
      paddingInlineEnd: space(8),
      border: 0,
      borderRadius: 'var(--radius-md)',
      background: 'none',
      color: 'inherit',
      font: 'inherit',
      textAlign: 'start',
      overflowWrap: 'break-word',
      cursor: 'default',
      userSelect: 'none',
      outline: 'none',
      // The background marks the choice under the pointer or focus, as in shadcn.
      '&:focus': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
      '& svg': { flexShrink: 0, width: '0.875rem', height: '0.875rem', pointerEvents: 'none' },
    },
    // The background alone is too faint to find from the keyboard, so the shared ring marks keyboard focus too.
    focusRing(),
    // Forced colors drop the background, so an outline marks the focused choice there.
    { '@media (forced-colors: active)': { '&:focus': { outline: '2px solid Highlight', outlineOffset: '-2px' } } },
  ),
)

const indicatorStyles = css({
  position: 'absolute',
  insetInlineEnd: space(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
})

export interface DropdownMenuRadioItemProps extends Omit<Props<'button'>, 'value'> {
  /** The value the group takes when this choice is chosen. */
  value: string
  /** Whether choosing it closes the menu (defaults to `true`). */
  closeOnClick?: boolean
}

/**
 * One choice: `<button type="button" role="menuitemradio">` with
 * `aria-checked` and a check mark at its end while it's the chosen one. A
 * click, Enter or Space chooses it, closes the menu and returns focus to the
 * trigger, unless a `DropdownMenuValueChangeEvent` listener cancels it.
 */
export function DropdownMenuRadioItem(handle: Handle<DropdownMenuRadioItemProps>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuRadioItem')
    let group = handle.context.get(DropdownMenuRadioGroup) as RadioGroupApi | undefined
    if (!group) throw new Error('DropdownMenuRadioItem must be inside a DropdownMenuRadioGroup')
    let { type = 'button', value, closeOnClick = true, mix, children, ...props } = handle.props
    let checked = group.value === value

    return (
      <button
        data-slot="dropdown-menu-radio-item"
        data-checked={checked ? '' : undefined}
        {...props}
        type={type}
        value={value}
        role="menuitemradio"
        aria-checked={checked ? 'true' : 'false'}
        mix={[
          itemStyles,
          mix,
          on('click', (event) => {
            if (event.defaultPrevented || !menu.running) return
            if (!group.choose(value, event)) {
              event.preventDefault()
              return
            }
            if (closeOnClick) menu.setOpen(false, 'item-press', event)
          }),
        ]}
      >
        <span data-slot="dropdown-menu-radio-item-indicator" aria-hidden="true" mix={indicatorStyles}>
          {checked ? <CheckIcon /> : null}
        </span>
        {children}
      </button>
    )
  }
}
