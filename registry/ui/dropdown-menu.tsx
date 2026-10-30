// RemixCN Dropdown Menu: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, createMixin, css, Fragment, on, ref } from 'remix/component'
import type { Handle, MixinDescriptor, Props, RemixElement, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, AnchorTarget, Side } from '#remixcn/lib/anchor-position.ts'
import { findTypeaheadMatch, isDisabledItem, isFocusableItem, rovingFocus } from '#remixcn/lib/composite.ts'
import { focusScope, getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import type { FocusScopeOptions } from '#remixcn/lib/focus-scope.ts'
import { hoverIntent } from '#remixcn/lib/hover-intent.ts'
import { CheckIcon, ChevronRightIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import type { DismissReason } from '#remixcn/lib/layer.ts'
import { modal as modalMixin } from '#remixcn/lib/modal.ts'
import { mergeStyles, mirrorInRtl, transition } from '#remixcn/lib/styles.ts'

// A dropdown menu is a list of actions that opens from a button. The arrow
// keys, Home, End and typing move between the items, Enter and Space choose
// one, and Escape, a press elsewhere and Tab close the menu. A submenu opens
// on hover and with the arrow key that points at it, and the opposite arrow
// closes it. Checkbox and radio items keep their state and announce it.
//
// This file also holds the menu engine that Context Menu and Menubar build
// on. Each part takes its data-slot from the family of the menu it is in,
// such as context-menu-item inside a ContextMenu, and the styles that differ
// between the families key on it.
//
// The content is a native popover in the top layer, outside any box that
// clips its overflow. Until the browser runs it, and on a page without
// JavaScript, the trigger opens it natively: the browser shows it in the
// middle of the screen, and its links work. The other items need the script.
// The parts run in the browser inside your client entry, like Button, so they
// take your mixins.

/** The menu families that share this engine. Each part's data-slot starts with the family of its menu. */
export type MenuFamily = 'dropdown-menu' | 'context-menu' | 'menubar'

export type MenuOpenChangeReason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'item-press'
  | 'list-navigation'
  | 'escape-key'
  | 'outside-press'
  | 'focus-out'
  | 'sibling-open'
  | 'parent-dismissed'
  | 'trigger-removed'

export const menuOpenChangeType = 'remixcn:menu-open-change' as const

/**
 * Dispatched on a menu's content before the menu opens or closes. It doesn't
 * bubble, so a listener on the content hears only its own menu, not a submenu
 * inside it. `open` is the next state and `reason` says what asked for it.
 * Cancel it with `preventDefault()` to keep the current state. It takes the
 * place of Base UI's `onOpenChange`.
 */
export class MenuOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: MenuOpenChangeReason
  /** The event that asked for the change, if any. */
  readonly cause: Event | undefined

  constructor(open: boolean, reason: MenuOpenChangeReason, cause?: Event) {
    super(menuOpenChangeType, { cancelable: true })
    this.open = open
    this.reason = reason
    this.cause = cause
  }
}

export const menuCheckedChangeType = 'remixcn:menu-checked-change' as const

/**
 * Dispatched on a checkbox item before its checked state changes. It bubbles,
 * so one listener on the content hears every checkbox item in it. Cancel it to
 * keep the item as it is. It takes the place of Base UI's `onCheckedChange`.
 */
export class MenuCheckedChangeEvent extends Event {
  readonly checked: boolean
  readonly cause: Event | undefined

  constructor(checked: boolean, cause?: Event) {
    super(menuCheckedChangeType, { bubbles: true, cancelable: true })
    this.checked = checked
    this.cause = cause
  }
}

export const menuValueChangeType = 'remixcn:menu-value-change' as const

/**
 * Dispatched on a radio group before another of its items gets checked. It
 * bubbles. Cancel it to keep the current value. It takes the place of Base
 * UI's `onValueChange`.
 */
export class MenuValueChangeEvent extends Event {
  readonly value: string
  readonly cause: Event | undefined

  constructor(value: string, cause?: Event) {
    super(menuValueChangeType, { bubbles: true, cancelable: true })
    this.value = value
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [menuOpenChangeType]: MenuOpenChangeEvent
    [menuCheckedChangeType]: MenuCheckedChangeEvent
    [menuValueChangeType]: MenuValueChangeEvent
  }
}

/** Where focus goes when a menu opens: its first or last item, the menu itself, or nowhere. */
export type MenuFocus = 'first' | 'last' | 'menu' | 'none'

export interface MenuOpenOptions {
  /** The event that asked for the change. */
  cause?: Event
  /** Where focus goes when it opens (defaults to `'menu'`). */
  focus?: MenuFocus
  /** What to place the menu against instead of its trigger, such as the pointer of a right click. */
  anchor?: AnchorTarget
}

/** What a menu group, such as a menubar, can ask of one of its menus. */
export interface MenuController {
  readonly open: boolean
  readonly trigger: HTMLElement | null
  /** Asks to open or close the menu, and returns whether it changes. */
  setOpen(open: boolean, reason: MenuOpenChangeReason, options?: MenuOpenOptions): boolean
}

/** Ties sibling menus together, as a menubar does. `MenuRoot` takes it as `group`. */
export interface MenuGroup {
  /** The arrow keys that move along the group. A horizontal group opens its menus with Arrow Down. */
  readonly orientation: 'horizontal' | 'vertical'
  /** Called after one of its menus opened, so the others close. */
  opened(menu: MenuController): void
  /** Called after one of its menus closed. */
  closed(menu: MenuController): void
  /** Whether one of its menus is open, so the pointer opens another at once. */
  hasOpenMenu(): boolean
  /** Asks to open the previous or next menu, as the arrow keys in a menu do. Returns whether it moved. */
  move(menu: MenuController, step: 1 | -1, event: KeyboardEvent): boolean
  /** Elements that stay usable while a modal menu of the group is open, such as the menubar. */
  keep(): Iterable<Element | null>
}

/** The state a menu's parts share. Context Menu and Menubar read it to build their own parts. */
export interface MenuApi extends MenuController {
  family: MenuFamily
  /** The menu this one is a submenu of. */
  parent: MenuApi | null
  group: MenuGroup | null
  open: boolean
  /** Whether the browser runs the menu. Until then it renders closed. */
  running: boolean
  modal: boolean
  disabled: boolean
  orientation: 'horizontal' | 'vertical'
  loop: boolean
  highlightOnHover: boolean
  closeParentOnEsc: boolean
  contentId: string
  defaultTriggerId: string
  /** The id that names the menu, the trigger's. */
  triggerId: string | undefined
  trigger: HTMLElement | null
  content: HTMLElement | null
  /** What the menu is placed against while open, when not its trigger. */
  anchor: AnchorTarget
  focus: MenuFocus
  openedBy: 'press' | 'hover' | null
  /** Closes this menu and every menu it is a submenu of, as choosing an item does. */
  closeAll(reason: MenuOpenChangeReason, cause?: Event): void
  /** Focuses the first or last item that can take focus. */
  focusItem(which: 'first' | 'last'): void
  /** Moves an open menu to another anchor, as a right click elsewhere in a context menu's area does. */
  reposition(anchor: AnchorTarget): void
  /** Keeps a menu the pointer opened open after the pointer leaves, as a click on its trigger does. */
  keepOpen(): void
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachContent(element: HTMLElement, signal: AbortSignal): void
}

const itemSelector = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'

/** The items of `content` itself, not of a submenu, that can take focus now, in document order. */
function focusableItems(content: Element | null): HTMLElement[] {
  if (!content) return []
  return [...content.querySelectorAll<HTMLElement>(itemSelector)].filter(
    (item) => item.closest('[role="menu"]') === content && isFocusableItem(item) && !isDisabledItem(item),
  )
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/**
 * The props of the first `type` element among `node`, through host elements
 * and fragments, but not other components.
 */
function findProps<P>(node: unknown, type: unknown): P | undefined {
  if (Array.isArray(node)) {
    for (let child of node) {
      let found = findProps<P>(child, type)
      if (found) return found
    }
    return undefined
  }
  if (!isElement(node)) return undefined
  if (node.type === type) return node.props as P
  if (typeof node.type === 'string' || node.type === Fragment) return findProps<P>(node.props.children, type)
  return undefined
}

// Each trigger and its menu, so the outer menu's keys can open a submenu and a menubar finds its menus.
const triggerMenus = new WeakMap<Element, MenuApi>()

/** The menu `trigger` opens, such as each menu of a menubar from its button. */
export function menuOfTrigger(trigger: Element): MenuController | undefined {
  return triggerMenus.get(trigger)
}

/** The menu a part is in. */
export function useMenu(handle: { context: { get(type: unknown): unknown } }, part: string): MenuApi {
  let api = handle.context.get(MenuRoot) as MenuApi | undefined
  if (!api) throw new Error(`${part} must be inside a menu, such as a DropdownMenu`)
  return api
}

export interface DropdownMenuProps {
  /** Whether the menu is open, for a menu you control. Update it from `MenuOpenChangeEvent`. */
  open?: boolean
  /** Whether the menu starts open. */
  defaultOpen?: boolean
  /**
   * Whether the rest of the page waits while the menu is open: it can't be
   * scrolled, and a press outside only closes the menu (defaults to `true`).
   * A menu the pointer opened on hover is never modal.
   */
  modal?: boolean
  /** Whether the menu ignores the trigger and stays closed. */
  disabled?: boolean
  /** The arrow keys that move between the items: Up and Down when `'vertical'` (the default), Left and Right when `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical'
  /** Whether the arrow keys wrap from the last item to the first (defaults to `true`). */
  loopFocus?: boolean
  /** Whether the pointer highlights the item under it (defaults to `true`). */
  highlightItemOnHover?: boolean
  children?: RemixNode
}

export interface MenuRootProps extends DropdownMenuProps {
  /** The family the parts' data-slots name (defaults to the outer menu's, or `'dropdown-menu'`). */
  family?: MenuFamily
  /** Whether this is a submenu of the menu it is in. */
  nested?: boolean
  /** In a submenu, whether Escape closes every menu instead of only this one (defaults to `false`). */
  closeParentOnEsc?: boolean
  /** Sibling menus this one belongs to, such as a menubar's. */
  group?: MenuGroup
}

/**
 * The menu engine that Dropdown Menu, Context Menu and Menubar share: it holds
 * whether a menu is open and what its parts need. It renders no element. Use
 * `DropdownMenu`, `ContextMenu` or `MenubarMenu` instead.
 */
export function MenuRoot(handle: Handle<MenuRootProps, MenuApi>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let notified = false

  let api: MenuApi = {
    family: 'dropdown-menu',
    parent: null,
    group: null,
    open: false,
    running: false,
    modal: true,
    disabled: false,
    orientation: 'vertical',
    loop: true,
    highlightOnHover: true,
    closeParentOnEsc: false,
    contentId: `${handle.id}-content`,
    defaultTriggerId: `${handle.id}-trigger`,
    triggerId: undefined,
    trigger: null,
    content: null,
    anchor: null,
    // Only an interaction moves focus: a menu that starts open leaves it where it is.
    focus: 'none',
    openedBy: null,
    setOpen(open, reason, { cause, focus = 'menu', anchor } = {}) {
      if (handle.signal.aborted || !api.running) return false
      if (open && api.disabled) return false
      if (open === (handle.props.open ?? uncontrolledOpen)) return false
      let event = new MenuOpenChangeEvent(open, reason, cause)
      api.content?.dispatchEvent(event)
      if (event.defaultPrevented) return false
      if (open) {
        api.focus = focus
        api.anchor = anchor ?? null
        api.openedBy = reason === 'trigger-hover' ? 'hover' : 'press'
      }
      if (handle.props.open === undefined) uncontrolledOpen = open
      void handle.update()
      return true
    },
    closeAll(reason, cause) {
      let top: MenuApi = api
      while (top.parent) top = top.parent
      // Closing the outer menu releases its layer, which closes the submenus.
      top.setOpen(false, reason, { cause })
    },
    focusItem(which) {
      let items = focusableItems(api.content)
      ;(which === 'first' ? items[0] : items.at(-1))?.focus()
    },
    reposition(anchor) {
      if (!api.open || handle.signal.aborted) return
      api.anchor = anchor
      void handle.update()
    },
    keepOpen() {
      if (api.openedBy !== 'hover' || handle.signal.aborted) return
      api.openedBy = 'press'
      void handle.update()
    },
    attachTrigger(element, signal) {
      api.trigger = element
      triggerMenus.set(element, api)
      signal.addEventListener('abort', () => {
        if (triggerMenus.get(element) === api) triggerMenus.delete(element)
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
  }
  handle.context.set(api)
  // A menu that leaves while open tells its group it closed.
  handle.signal.addEventListener('abort', () => {
    if (notified) api.group?.closed(api)
  })

  return () => {
    let {
      open,
      modal = true,
      disabled = false,
      orientation = 'vertical',
      loopFocus = true,
      highlightItemOnHover = true,
      closeParentOnEsc = false,
      family,
      nested = false,
      group,
      children,
    } = handle.props
    // The nearest menu outside this one, since context.get skips the component's own value.
    let parent = nested ? ((handle.context.get(MenuRoot) as MenuApi | undefined) ?? null) : null
    if (nested && !parent) throw new Error('A submenu must be inside a menu, such as a DropdownMenu')

    // Tasks run only in the browser, after the first commit. Until then the menu renders closed.
    if (!api.running) {
      handle.queueTask(() => {
        // One the browser already opened natively stays open, now next to its trigger.
        if (handle.props.open === undefined && api.content?.matches(':popover-open')) uncontrolledOpen = true
        api.running = true
        void handle.update()
      })
    }

    api.parent = parent
    api.family = parent?.family ?? family ?? 'dropdown-menu'
    api.group = parent ? null : (group ?? null)
    api.disabled = disabled || (parent?.disabled ?? false)
    api.orientation = orientation
    api.loop = loopFocus
    api.highlightOnHover = highlightItemOnHover
    api.closeParentOnEsc = closeParentOnEsc
    api.open = api.running && (open ?? uncontrolledOpen)
    if (!api.open) {
      api.openedBy = null
      api.focus = 'none'
    }
    // A submenu and a menu the pointer opened leave the page alone.
    api.modal = modal && !parent && api.openedBy !== 'hover'

    if (api.open !== notified) {
      notified = api.open
      let now = api.open
      handle.queueTask(() => (now ? api.group?.opened(api) : api.group?.closed(api)))
    }
    return children
  }
}

/** Groups a dropdown menu's trigger and content and holds whether it's open. It renders no element. */
export function DropdownMenu(handle: Handle<DropdownMenuProps>) {
  return () => <MenuRoot {...handle.props} family="dropdown-menu" />
}

/**
 * shadcn's portal part. The content shows in the browser's top layer, which
 * does what the portal did, so this renders its children where they are.
 */
export function DropdownMenuPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => handle.props.children
}

export interface DropdownMenuTriggerOptions {
  /** Whether the menu also opens while the pointer rests on the trigger (defaults to `false`). Keyboard focus doesn't open it. */
  openOnHover?: boolean
  /** Milliseconds the pointer rests on the trigger before the menu opens on hover (defaults to `100`). */
  delay?: number
  /** Milliseconds before a menu the pointer opened closes once the pointer has left (defaults to `0`). */
  closeDelay?: number
}

function getDirection(element: Element | null) {
  return element && getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr'
}

/** The item `which` a key on a trigger opens the menu at, or `undefined` when the key doesn't open it. */
function openingKey(api: MenuApi, event: KeyboardEvent): 'first' | 'last' | undefined {
  if (api.group?.orientation === 'vertical') {
    let inward = getDirection(event.currentTarget as Element) === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    return event.key === inward ? 'first' : undefined
  }
  if (event.key === 'ArrowDown') return 'first'
  if (event.key === 'ArrowUp') return 'last'
  return undefined
}

const triggerMixin = createMixin<HTMLElement, [options: DropdownMenuTriggerOptions]>((handle, type) => {
  // Only a button can open a popover natively.
  let native = type === 'button'

  return (options, hostProps) => {
    let api = useMenu(handle, 'dropdownMenuTrigger()')
    let { openOnHover = false, delay = 100, closeDelay = 0 } = options
    let id = (hostProps.id as string | undefined) ?? api.defaultTriggerId
    // The content renders after the trigger and names the menu with this id.
    api.triggerId = id
    let { disabled } = api

    return (
      <handle.element
        id={id}
        aria-haspopup="menu"
        aria-controls={api.contentId}
        // Until it runs, the browser reports the state of a popovertarget button itself.
        aria-expanded={api.running ? (api.open ? 'true' : 'false') : undefined}
        data-popup-open={api.open ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        popovertarget={native && !api.running && !disabled ? api.contentId : undefined}
        {...(disabled ? (native ? { disabled: true } : { 'aria-disabled': 'true' }) : {})}
        mix={[
          attrs({ 'data-slot': `${api.family}-trigger` }),
          ref((node, signal) => api.attachTrigger(node, signal)),
          on('click', (event) => {
            if (event.defaultPrevented || api.disabled) return
            // A click on a menu the pointer opened keeps it open, now for good.
            if (api.open && api.openedBy === 'hover') {
              api.keepOpen()
              return
            }
            // Enter and Space click with a detail of 0, and open at the first item.
            let focus: MenuFocus = event.detail === 0 ? 'first' : 'menu'
            api.setOpen(!api.open, 'trigger-press', { cause: event, focus })
          }),
          on('keydown', (event) => {
            if (event.defaultPrevented || api.disabled || event.altKey || event.ctrlKey || event.metaKey) return
            let which = openingKey(api, event)
            if (!which) return
            event.preventDefault()
            if (api.open) api.focusItem(which)
            else api.setOpen(true, 'trigger-press', { cause: event, focus: which })
          }),
          // In a menubar with an open menu, the pointer opens the menu it moves onto.
          on('pointerenter', (event) => {
            if (event.pointerType === 'touch' || api.open || api.disabled || !api.group?.hasOpenMenu()) return
            api.setOpen(true, 'trigger-hover', { cause: event, focus: 'menu' })
          }),
          // A menu a press opened stays open wherever the pointer goes.
          openOnHover && !disabled && !(api.open && api.openedBy === 'press')
            ? hoverIntent({
                open: api.open,
                delay,
                closeDelay,
                openOnFocus: false,
                popup: () => api.content,
                onOpenChange: (open, _reason, event) =>
                  api.setOpen(open, open ? 'trigger-hover' : 'focus-out', { cause: event, focus: 'none' }),
              })
            : undefined,
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
export function dropdownMenuTrigger(
  options: DropdownMenuTriggerOptions = {},
): MixinDescriptor<HTMLElement, [options: DropdownMenuTriggerOptions]> {
  return triggerMixin(options)
}

export type DropdownMenuTriggerProps = Props<'button'> & DropdownMenuTriggerOptions

/** A native button that opens and closes the menu. Give it `buttonVariants()` to look like a Button. */
export function DropdownMenuTrigger(handle: Handle<DropdownMenuTriggerProps>) {
  return () => {
    let { type = 'button', openOnHover, delay, closeDelay, mix, ...props } = handle.props

    return (
      <button
        data-slot="dropdown-menu-trigger"
        {...props}
        type={type}
        mix={[mix, dropdownMenuTrigger({ openOnHover, delay, closeDelay })]}
      />
    )
  }
}

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface DropdownMenuContentProps extends Omit<Props<'div'>, 'id' | 'role'> {
  /**
   * The side of the trigger to show on: `'bottom'` for a menu, `'inline-end'`
   * for a submenu, a context menu and the menus of a vertical menubar.
   * `'inline-start'` and `'inline-end'` follow the text direction.
   */
  side?: Side
  /** The gap to the trigger, in pixels (`4` for a menu, `8` in a menubar, `0` for a submenu and a context menu). */
  sideOffset?: number
  /** How to align along that side (defaults to `'start'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (`0` for a menu, `-4` in a menubar, `-3` for a submenu, `4` in a context menu). */
  alignOffset?: number
  /** Space to keep from the edges of the viewport and `collisionBoundary`, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** An element whose box also limits where the menu goes. */
  collisionBoundary?: Element | null
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /**
   * What to focus when the menu closes, or `false` to leave focus alone. By
   * default, the trigger, or for a context menu the element focused before
   * it opened, unless focus already moved elsewhere.
   */
  finalFocus?: FocusScopeOptions['returnFocus']
}

interface Placement {
  side: Side
  sideOffset: number
  align: Align
  alignOffset: number
}

// shadcn's defaults for each family and for submenus.
function defaultPlacement(api: MenuApi): Placement {
  if (api.parent) {
    return { side: 'inline-end', sideOffset: 0, align: 'start', alignOffset: api.family === 'context-menu' ? 4 : -3 }
  }
  if (api.family === 'context-menu') return { side: 'inline-end', sideOffset: 0, align: 'start', alignOffset: 4 }
  if (api.family === 'menubar') {
    let side: Side = api.group?.orientation === 'vertical' ? 'inline-end' : 'bottom'
    return { side, sideOffset: 8, align: 'start', alignOffset: -4 }
  }
  return { side: 'bottom', sideOffset: 4, align: 'start', alignOffset: 0 }
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

// When the focused item leaves the document, focus would fall back to the
// page and the keys would stop reaching the menu. Chromium sends focusout
// then and Firefox nothing, so an observer notices: focus moves to the item
// that took its place, or to the menu.
const keepFocusInside = createMixin<HTMLElement, [open: boolean]>(
  (handle) => {
    let host: HTMLElement | null = null
    let open = false
    let focused: { item: HTMLElement; index: number } | null = null
    let observer: MutationObserver | null = null

    function onFocusIn(event: FocusEvent) {
      let item = event.target instanceof HTMLElement ? event.target : null
      if (!host || !item || item.closest('[role="menu"]') !== host || !item.matches(itemSelector)) return
      focused = { item, index: focusableItems(host).indexOf(item) }
    }

    function restore() {
      if (!host || !open || !focused || focused.item.isConnected) return
      let active = host.ownerDocument.activeElement
      let { index } = focused
      focused = null
      if (active && active !== host.ownerDocument.body && active.isConnected) return
      let items = focusableItems(host)
      ;(items[Math.min(index, items.length - 1)] ?? host).focus()
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      host.addEventListener('focusin', onFocusIn)
      observer = new MutationObserver(restore)
      observer.observe(host, { childList: true, subtree: true })
    })

    handle.addEventListener('remove', () => {
      observer?.disconnect()
      host?.removeEventListener('focusin', onFocusIn)
      host = null
      focused = null
    })

    return (next) => {
      open = next
      return handle.element
    }
  },
  { ssr: false },
)

/** The keys a menu's content handles itself, besides the arrows that move between its items. */
function onContentKeyDown(api: MenuApi, event: KeyboardEvent) {
  let content = api.content
  let target = event.target as Element
  // Each menu handles only the keys of its own items; a submenu's bubble through it.
  if (event.defaultPrevented || !content || target.closest('[role="menu"]') !== content) return
  if (event.altKey || event.ctrlKey || event.metaKey) return

  if (event.key === 'Tab') {
    // Tab closes every menu and moves on from where the menu returns focus, as from a native select.
    // The menu moves focus itself: Firefox skips its own move once focus changed during the key.
    event.preventDefault()
    let top: MenuApi = api
    while (top.parent) top = top.parent
    if (!top.setOpen(false, 'focus-out', { cause: event })) return
    let document = content.ownerDocument
    // After the menu closed, let the page go and returned focus.
    document.defaultView?.setTimeout(() => moveFocusOn(document, event.shiftKey))
    return
  }

  if (target === content) {
    // Nothing is highlighted, as after a pointer opened the menu.
    let which: 'first' | 'last' | undefined =
      event.key === 'ArrowDown' || event.key === 'Home'
        ? 'first'
        : event.key === 'ArrowUp' || event.key === 'End'
          ? 'last'
          : undefined
    if (which) {
      event.preventDefault()
      api.focusItem(which)
      return
    }
    if (event.key.length === 1 && event.key !== ' ') {
      let items = focusableItems(content)
      let index = findTypeaheadMatch(
        items.map((item) => item.dataset.label ?? item.textContent ?? ''),
        event.key,
        -1,
      )
      if (index !== -1) {
        event.preventDefault()
        items[index].focus()
      }
    }
    return
  }

  if (api.orientation !== 'vertical' || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
  let inward = getDirection(content) === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  let submenu = triggerMenus.get(target)

  if (event.key === inward && submenu && !isDisabledItem(target)) {
    event.preventDefault()
    if (submenu.open) submenu.focusItem('first')
    else submenu.setOpen(true, 'list-navigation', { cause: event, focus: 'first' })
    return
  }
  // The other arrow closes a submenu, and a menu of a vertical menubar, which opens beside its button.
  if (event.key !== inward && (api.parent || api.group?.orientation === 'vertical')) {
    event.preventDefault()
    api.setOpen(false, 'list-navigation', { cause: event })
    return
  }

  // In a horizontal menubar, the other arrows move to the menu beside this one.
  let top: MenuApi = api
  while (top.parent) top = top.parent
  if (top.group?.orientation !== 'horizontal') return
  let forward = getDirection(content) === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  if (top.group.move(top, event.key === forward ? 1 : -1, event)) event.preventDefault()
}

/** Moves focus to the next tabbable element after the focused one, or the one before it. */
function moveFocusOn(document: Document, backward: boolean) {
  let from = document.activeElement
  if (!(from instanceof HTMLElement) || from === document.body) return
  let tabbable = getTabbableElements(document.body)
  let index = tabbable.indexOf(from)
  // A focused element outside the tab order, such as a context menu's area, still has a place in it.
  if (index === -1) {
    let after = tabbable.findIndex(
      (element) => from.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
    index = after === -1 ? tabbable.length : after
    if (!backward) index -= 1
  }
  tabbable[backward ? index - 1 : index + 1]?.focus()
}

/** Closes a menu the focus left for somewhere outside it, its submenus and its trigger. */
function onContentFocusOut(api: MenuApi, event: FocusEvent) {
  // Without a next element, the window lost focus, a press elsewhere moved it, or the
  // focused item left the document: the layer and the focus keeper decide.
  let next = event.relatedTarget
  if (api.parent || !api.open || !(next instanceof Node)) return
  let inside = (node: Node | null) => Boolean(node && (api.content?.contains(node) || api.trigger?.contains(node)))
  if (inside(next)) return
  let document = next.ownerDocument!
  // Once the browser has moved focus: closing while it moves leaves no focused element.
  document.defaultView?.setTimeout(() => {
    if (api.open && !inside(document.activeElement)) api.closeAll('focus-out', event)
  })
}

function onDismiss(api: MenuApi, reason: DismissReason, event?: Event) {
  if (reason === 'escape-key' && api.parent && api.closeParentOnEsc) api.closeAll('escape-key', event)
  else api.setOpen(false, reason === 'close-request' ? 'escape-key' : reason, { cause: event })
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const textSm = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const textXs = { fontSize: 'var(--text-xs)', lineHeight: 'var(--text-xs--line-height)' }

const contentStyles = css(
  mergeStyles(
    {
      ...textSm,
      boxSizing: 'border-box',
      // As wide as the trigger, and at least 8rem; give it a width to change it. A popover is
      // fit-content, where auto would stretch it across the window it is still inset in.
      width: 'var(--anchor-width, fit-content)',
      minWidth: '8rem',
      // Never wider or taller than the room beside the trigger; a long menu scrolls.
      maxWidth: 'var(--available-width, 100%)',
      maxHeight: 'var(--available-height, 100%)',
      overflowX: 'hidden',
      overflowY: 'auto',
      padding: space(1),
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      overflowWrap: 'break-word',
      outline: 'none',
      // A context menu and a menubar's menus start a little wider, and neither follows a trigger's width.
      '&[data-slot="context-menu-content"], &[data-slot="menubar-content"]': { width: 'fit-content', minWidth: '9rem' },
      '&[data-slot$="-sub-content"]': { width: 'fit-content', minWidth: '6rem', boxShadow: 'var(--shadow-lg)' },
      '&[data-slot="context-menu-sub-content"], &[data-slot="menubar-sub-content"]': { minWidth: '8rem' },
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'block' },
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

/**
 * The menu: a native popover with role menu, next to its trigger. It stays in
 * the document while closed, hidden, so the trigger's aria-controls always
 * points at it. Inside a submenu, it is the submenu's content.
 */
export function DropdownMenuContent(handle: Handle<DropdownMenuContentProps>) {
  return () => {
    let api = useMenu(handle, 'DropdownMenuContent')
    let defaults = defaultPlacement(api)
    let {
      side = defaults.side,
      sideOffset = defaults.sideOffset,
      align = defaults.align,
      alignOffset = defaults.alignOffset,
      collisionPadding = 5,
      collisionBoundary = null,
      collisionAvoidance = {},
      finalFocus,
      children,
      mix,
      ...props
    } = handle.props
    let { open, family } = api
    let nested = api.parent !== null
    let returnFocus = finalFocus ?? (family === 'context-menu' && !nested ? undefined : () => api.trigger)

    return (
      <div
        role="menu"
        data-slot={`${family}-${nested ? 'sub-content' : 'content'}`}
        aria-labelledby={api.triggerId}
        aria-orientation={api.orientation === 'horizontal' ? 'horizontal' : undefined}
        tabIndex={-1}
        {...props}
        id={api.contentId}
        popover={api.running ? 'manual' : 'auto'}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentStyles,
          mix,
          ref((node, signal) => api.attachContent(node, signal)),
          // Until it runs, the browser may have opened it natively; the root keeps it open once it runs.
          topLayer(api.running ? open : null),
          anchorPosition({
            open,
            anchor: () => api.anchor ?? api.trigger,
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
            onDismiss: ({ reason, event }) => onDismiss(api, reason, event),
          }),
          focusScope({
            open,
            initialFocus:
              api.focus === 'none'
                ? false
                : () =>
                    api.focus === 'first'
                      ? (focusableItems(api.content)[0] ?? api.content)
                      : api.focus === 'last'
                        ? (focusableItems(api.content).at(-1) ?? api.content)
                        : api.content,
            returnFocus,
          }),
          modalMixin({
            open: open && api.modal,
            keep: () => (family === 'context-menu' ? [] : [api.trigger, ...(api.group?.keep() ?? [])]),
          }),
          rovingFocus({ items: itemSelector, orientation: api.orientation, loop: api.loop, typeahead: true }),
          keepFocusInside(open),
          on('keydown', (event) => onContentKeyDown(api, event)),
          on('focusout', (event) => onContentFocusOut(api, event)),
        ]}
      >
        {children}
      </div>
    )
  }
}

/** The content of a submenu. It is `DropdownMenuContent`, which places itself beside the submenu's trigger. */
export const DropdownMenuSubContent = DropdownMenuContent
export type DropdownMenuSubContentProps = DropdownMenuContentProps

interface ItemOptions {
  /** The menu the item belongs to. */
  menu: MenuApi
  disabled: boolean
  closeOnClick: boolean
  /** Runs on a click that nobody canceled, before the menu closes. Cancel the click to keep the menu open. */
  activate?: (event: MouseEvent) => void
  /** Keeps the highlight when the pointer leaves, as on the trigger of an open submenu. */
  keepHighlight?: () => boolean
}

// The behavior every item shares: the pointer highlights it by focusing it,
// Enter and Space click it, and a click that nobody canceled chooses it.
const itemMixin = createMixin<HTMLElement, [options: ItemOptions]>((handle, type) => {
  let link = type === 'a'

  return (options) => {
    let { menu, disabled } = options

    return (
      <handle.element
        mix={[
          on('pointermove', (event) => {
            if (event.pointerType === 'touch' || !menu.highlightOnHover || disabled) return
            let item = event.currentTarget as HTMLElement
            if (item.ownerDocument.activeElement !== item) item.focus({ preventScroll: true })
          }),
          on('pointerleave', (event) => {
            if (event.pointerType === 'touch' || !menu.highlightOnHover) return
            let item = event.currentTarget as HTMLElement
            if (item.ownerDocument.activeElement !== item || options.keepHighlight?.()) return
            // Off the items, nothing is highlighted, but the menu keeps focus for the keys.
            menu.content?.focus({ preventScroll: true })
          }),
          on('keydown', (event) => {
            if (event.defaultPrevented || event.target !== event.currentTarget) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            // A link follows Enter natively.
            if (link && event.key === 'Enter' && !disabled) return
            event.preventDefault()
            if (!disabled && !event.repeat) (event.currentTarget as HTMLElement).click()
          }),
          // Before the caller's listeners, so even a script's click on a disabled item runs nothing.
          on(
            'click',
            (event) => {
              if (!disabled) return
              event.preventDefault()
              event.stopImmediatePropagation()
            },
            true,
          ),
          on('click', (event) => {
            if (event.defaultPrevented) return
            options.activate?.(event)
            if (!event.defaultPrevented && options.closeOnClick) menu.closeAll('item-press', event)
          }),
        ]}
      />
    )
  }
})

const itemStyles = css({
  ...textSm,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  minWidth: 0,
  paddingInline: space(2),
  paddingBlock: space(1.5),
  borderRadius: 'var(--radius-sm)',
  color: 'inherit',
  textDecoration: 'none',
  cursor: 'default',
  userSelect: 'none',
  outline: 'none',
  '&[hidden]': { display: 'none' },
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
  '&[data-inset]': { paddingInlineStart: space(8) },
  // The pointer and the keys highlight an item by focusing it.
  '&:focus, &[data-popup-open]': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
  // The keys add the focus ring, since the highlight alone is too faint to find.
  '&:focus-visible': { outline: '2px solid var(--ring)', outlineOffset: '-2px' },
  '&[data-variant="destructive"]': { color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))' },
  '&[data-variant="destructive"]:focus': {
    backgroundColor:
      'light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 20%, transparent))',
  },
  // Checkbox and radio items keep room for their check at the end; in a menubar, at the start.
  '&:is([role="menuitemcheckbox"], [role="menuitemradio"])': { paddingInlineEnd: space(8) },
  '&:is([data-slot="menubar-checkbox-item"], [data-slot="menubar-radio-item"])': {
    paddingInlineStart: space(8),
    paddingInlineEnd: space(2),
  },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  // Forced colors drop the background, so an outline marks the highlighted item.
  '@media (forced-colors: active)': {
    '&:focus, &[data-popup-open]': { outline: '2px solid Highlight', outlineOffset: '-2px' },
  },
})

export interface DropdownMenuItemProps extends Omit<Props<'div'>, 'role'> {
  /** Keeps the item from being highlighted and chosen. It still shows, dimmed. */
  disabled?: boolean
  /** Lines the text up with items that have a check or an icon at the start. */
  inset?: boolean
  /** `'destructive'` colors an item that deletes or can't be undone. */
  variant?: 'default' | 'destructive'
  /** Whether choosing the item closes the menu (defaults to `true`). Cancel the click to keep it open once. */
  closeOnClick?: boolean
  /** The text typing matches, when it isn't the item's text. */
  label?: string
}

/**
 * A menu item. Listen for `click` to run it: the pointer, Enter and Space all
 * click it. Cancel the click with `preventDefault()` to keep the menu open.
 */
export function DropdownMenuItem(handle: Handle<DropdownMenuItemProps>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuItem')
    let { disabled = false, inset, variant = 'default', closeOnClick = true, label, mix, ...props } = handle.props

    return (
      <div
        role="menuitem"
        tabIndex={-1}
        data-slot={`${menu.family}-item`}
        data-variant={variant}
        data-inset={inset ? '' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-label={label}
        {...props}
        mix={[itemStyles, mix, itemMixin({ menu, disabled, closeOnClick })]}
      />
    )
  }
}

export interface DropdownMenuLinkItemProps extends Omit<Props<'a'>, 'role' | 'href'> {
  /** Where the link goes. */
  href?: string
  /** Lines the text up with items that have a check or an icon at the start. */
  inset?: boolean
  /** Whether following the link closes the menu (defaults to `true`). */
  closeOnClick?: boolean
  /** The text typing matches, when it isn't the item's text. */
  label?: string
}

/**
 * A native link as a menu item, in place of shadcn's `render={<a />}` and
 * Base UI's LinkItem. It navigates as any link does, also before the browser
 * runs the menu.
 */
export function DropdownMenuLinkItem(handle: Handle<DropdownMenuLinkItemProps>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuLinkItem')
    let { inset, closeOnClick = true, label, mix, ...props } = handle.props

    return (
      <a
        role="menuitem"
        data-slot={`${menu.family}-link-item`}
        data-variant="default"
        data-inset={inset ? '' : undefined}
        data-label={label}
        {...props}
        mix={[itemStyles, mix, itemMixin({ menu, disabled: false, closeOnClick })]}
      />
    )
  }
}

const indicatorStyles = css({
  position: 'absolute',
  insetInlineEnd: space(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  ':where([data-slot="menubar-checkbox-item"], [data-slot="menubar-radio-item"]) > &': {
    insetInlineEnd: 'auto',
    insetInlineStart: space(2),
  },
})

export interface DropdownMenuCheckboxItemProps extends Omit<Props<'div'>, 'role'> {
  /** Whether the item is checked, for an item you control. Update it from `MenuCheckedChangeEvent`. */
  checked?: boolean
  /** Whether the item starts checked. */
  defaultChecked?: boolean
  /** Keeps the item from being highlighted and changed. */
  disabled?: boolean
  /** Lines the text up with the other items. */
  inset?: boolean
  /** Whether choosing the item closes the menu (defaults to `false`, so you can check several). */
  closeOnClick?: boolean
  /** The text typing matches, when it isn't the item's text. */
  label?: string
}

/** An item that turns a setting on and off. Assistive technology hears the state through aria-checked. */
export function DropdownMenuCheckboxItem(handle: Handle<DropdownMenuCheckboxItemProps>) {
  let uncontrolled = handle.props.defaultChecked ?? false

  return () => {
    let menu = useMenu(handle, 'DropdownMenuCheckboxItem')
    let {
      checked,
      defaultChecked: _defaultChecked,
      disabled = false,
      inset,
      closeOnClick = false,
      label,
      children,
      mix,
      ...props
    } = handle.props
    let isChecked = checked ?? uncontrolled

    return (
      <div
        role="menuitemcheckbox"
        aria-checked={isChecked ? 'true' : 'false'}
        tabIndex={-1}
        data-slot={`${menu.family}-checkbox-item`}
        data-checked={isChecked ? '' : undefined}
        data-unchecked={isChecked ? undefined : ''}
        data-inset={inset ? '' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-label={label}
        {...props}
        mix={[
          itemStyles,
          mix,
          itemMixin({
            menu,
            disabled,
            closeOnClick,
            activate(event) {
              let change = new MenuCheckedChangeEvent(!isChecked, event)
              ;(event.currentTarget as HTMLElement).dispatchEvent(change)
              if (change.defaultPrevented) {
                // Nothing changed, so nothing closes either.
                event.preventDefault()
                return
              }
              if (handle.props.checked === undefined) uncontrolled = !isChecked
              void handle.update()
            },
          }),
        ]}
      >
        <span data-slot={`${menu.family}-checkbox-item-indicator`} mix={indicatorStyles}>
          {isChecked ? <CheckIcon /> : null}
        </span>
        {children}
      </div>
    )
  }
}

interface RadioGroupApi {
  value: string | undefined
  disabled: boolean
  labelling: LabellingApi
  /** Asks to check the item with `value`, and returns whether it is checked now. */
  select(value: string, cause: Event): boolean
}

export interface DropdownMenuRadioGroupProps extends Omit<Props<'div'>, 'role' | 'defaultValue'> {
  /** The checked item's value, for a group you control. Update it from `MenuValueChangeEvent`. */
  value?: string
  /** The value of the item that starts checked. */
  defaultValue?: string
  /** Keeps every item of the group from being changed. */
  disabled?: boolean
}

/** Groups radio items, of which one is checked. */
export function DropdownMenuRadioGroup(handle: Handle<DropdownMenuRadioGroupProps, RadioGroupApi>) {
  let uncontrolled = handle.props.defaultValue
  let element: HTMLElement | null = null
  let labels = createLabelling(handle)

  let api: RadioGroupApi = {
    value: undefined,
    disabled: false,
    labelling: labels.labelling,
    select(value, cause) {
      if (value === api.value) return true
      let change = new MenuValueChangeEvent(value, cause)
      element?.dispatchEvent(change)
      if (change.defaultPrevented) return false
      if (handle.props.value === undefined) uncontrolled = value
      void handle.update()
      return true
    },
  }
  handle.context.set(api)

  return () => {
    let menu = useMenu(handle, 'DropdownMenuRadioGroup')
    let { value, defaultValue: _defaultValue, disabled = false, children, mix, ...props } = handle.props
    api.value = value ?? uncontrolled
    api.disabled = disabled

    return (
      <div
        role="group"
        data-slot={`${menu.family}-radio-group`}
        aria-labelledby={labels.labelledBy(children)}
        {...props}
        mix={[mix, ref((node) => (element = node))]}
      >
        {children}
      </div>
    )
  }
}

export interface DropdownMenuRadioItemProps extends Omit<Props<'div'>, 'role'> {
  /** The value the group takes when this item is checked. */
  value: string
  /** Keeps the item from being highlighted and checked. */
  disabled?: boolean
  /** Lines the text up with the other items. */
  inset?: boolean
  /** Whether choosing the item closes the menu (defaults to `false`). */
  closeOnClick?: boolean
  /** The text typing matches, when it isn't the item's text. */
  label?: string
}

/** One choice of a radio group. Assistive technology hears whether it's checked through aria-checked. */
export function DropdownMenuRadioItem(handle: Handle<DropdownMenuRadioItemProps>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuRadioItem')
    let group = handle.context.get(DropdownMenuRadioGroup) as RadioGroupApi | undefined
    if (!group) throw new Error('DropdownMenuRadioItem must be inside a DropdownMenuRadioGroup')
    let { value, disabled = false, inset, closeOnClick = false, label, children, mix, ...props } = handle.props
    let isDisabled = disabled || group.disabled
    let checked = group.value === value

    return (
      <div
        role="menuitemradio"
        aria-checked={checked ? 'true' : 'false'}
        tabIndex={-1}
        data-slot={`${menu.family}-radio-item`}
        data-checked={checked ? '' : undefined}
        data-unchecked={checked ? undefined : ''}
        data-inset={inset ? '' : undefined}
        aria-disabled={isDisabled ? 'true' : undefined}
        data-disabled={isDisabled ? '' : undefined}
        data-label={label}
        {...props}
        mix={[
          itemStyles,
          mix,
          itemMixin({
            menu,
            disabled: isDisabled,
            closeOnClick,
            activate(event) {
              if (!group.select(value, event)) event.preventDefault()
            },
          }),
        ]}
      >
        <span data-slot={`${menu.family}-radio-item-indicator`} mix={indicatorStyles}>
          {checked ? <CheckIcon /> : null}
        </span>
        {children}
      </div>
    )
  }
}

interface LabellingApi {
  labelId: string
  /** The id of a label the group's render couldn't see. */
  found: string | undefined
  adopt(id: string): void
}

interface LabelledHandle {
  id: string
  signal: AbortSignal
  update(): Promise<AbortSignal>
}

/**
 * Names a group by the label inside it. The group finds a label among its
 * children through host elements; one inside another component tells it its
 * id from the browser.
 */
function createLabelling(handle: LabelledHandle) {
  let labelling: LabellingApi = {
    labelId: `${handle.id}-label`,
    found: undefined,
    adopt(id) {
      if (labelling.found === id || handle.signal.aborted) return
      labelling.found = id
      void handle.update()
    },
  }
  return {
    labelling,
    labelledBy(children: RemixNode) {
      let label = findProps<{ id?: string }>(children, DropdownMenuLabel)
      return label ? (label.id ?? labelling.labelId) : labelling.found
    },
  }
}

/** Groups related items, such as those under a label. */
export function DropdownMenuGroup(handle: Handle<Omit<Props<'div'>, 'role'>, LabellingApi>) {
  let { labelling, labelledBy } = createLabelling(handle)
  handle.context.set(labelling)

  return () => {
    let menu = useMenu(handle, 'DropdownMenuGroup')
    let { children, mix, ...props } = handle.props

    return (
      <div role="group" data-slot={`${menu.family}-group`} aria-labelledby={labelledBy(children)} {...props} mix={mix}>
        {children}
      </div>
    )
  }
}

const labelStyles = css({
  ...textXs,
  paddingInline: space(2),
  paddingBlock: space(1.5),
  fontWeight: 500,
  color: 'var(--muted-foreground)',
  overflowWrap: 'break-word',
  '&[data-inset]': { paddingInlineStart: space(8) },
  // A menubar's labels are as large as its items.
  '&[data-slot="menubar-label"]': { ...textSm, color: 'inherit' },
})

export interface DropdownMenuLabelProps extends Props<'div'> {
  /** Lines the text up with items that have a check or an icon at the start. */
  inset?: boolean
}

/** A heading for the items of a group, which it names. Put it inside a DropdownMenuGroup or DropdownMenuRadioGroup. */
export function DropdownMenuLabel(handle: Handle<DropdownMenuLabelProps>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuLabel')
    // A label inside a radio group names it, also when the radio group is inside a group.
    let radioGroup = handle.context.get(DropdownMenuRadioGroup) as RadioGroupApi | undefined
    let labelling = radioGroup?.labelling ?? (handle.context.get(DropdownMenuGroup) as LabellingApi | undefined)
    let { inset, id, mix, ...props } = handle.props
    let labelId = id ?? labelling?.labelId
    if (labelling && labelId && labelling.found !== labelId) handle.queueTask(() => labelling.adopt(labelId))

    return (
      <div
        data-slot={`${menu.family}-label`}
        data-inset={inset ? '' : undefined}
        {...props}
        id={labelId}
        mix={[labelStyles, mix]}
      />
    )
  }
}

const separatorStyles = css({
  height: 0,
  marginInline: space(-1),
  marginBlock: space(1),
  border: 'none',
  // A border, so forced colors keep the line.
  borderBlockStart: '1px solid var(--border)',
})

/** A line between groups of items. */
export function DropdownMenuSeparator(handle: Handle<Omit<Props<'div'>, 'role'>>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuSeparator')
    let { mix, ...props } = handle.props
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        data-slot={`${menu.family}-separator`}
        {...props}
        mix={[separatorStyles, mix]}
      />
    )
  }
}

const shortcutStyles = css({
  ...textXs,
  marginInlineStart: 'auto',
  paddingInlineStart: space(2),
  letterSpacing: '0.1em',
  color: 'var(--muted-foreground)',
  ':where([role^="menuitem"]:focus) &': { color: 'var(--accent-foreground)' },
})

/** The keys that run an item, shown at its end. */
export function DropdownMenuShortcut(handle: Handle<Props<'span'>>) {
  return () => {
    let menu = useMenu(handle, 'DropdownMenuShortcut')
    let { mix, ...props } = handle.props
    return <span data-slot={`${menu.family}-shortcut`} {...props} mix={[shortcutStyles, mix]} />
  }
}

export interface DropdownMenuSubProps {
  /** Whether the submenu is open, for one you control. Update it from `MenuOpenChangeEvent` on its content. */
  open?: boolean
  /** Whether the submenu starts open. */
  defaultOpen?: boolean
  /** Keeps the submenu closed and its trigger from being highlighted. */
  disabled?: boolean
  /** Whether Escape closes every menu instead of only this one (defaults to `false`). */
  closeParentOnEsc?: boolean
  /** Whether the arrow keys wrap from the last item to the first (defaults to `true`). */
  loopFocus?: boolean
  /** Whether the pointer highlights the item under it (defaults to `true`). */
  highlightItemOnHover?: boolean
  children?: RemixNode
}

/** Groups a submenu's trigger, an item of the outer menu, and its content. It renders no element. */
export function DropdownMenuSub(handle: Handle<DropdownMenuSubProps>) {
  return () => <MenuRoot {...handle.props} nested />
}

export interface DropdownMenuSubTriggerProps extends Omit<Props<'div'>, 'role'> {
  /** Lines the text up with items that have a check or an icon at the start. */
  inset?: boolean
  /** The text typing matches, when it isn't the item's text. */
  label?: string
  /** Whether resting the pointer on it opens the submenu (defaults to `true`). */
  openOnHover?: boolean
  /** Milliseconds the pointer rests before the submenu opens (defaults to `100`). */
  delay?: number
  /** Milliseconds before the submenu closes once the pointer has left (defaults to `0`). */
  closeDelay?: number
}

// The chevron points at the submenu, so it turns around in right-to-left text.
const chevronStyles = css(mergeStyles({ display: 'inline-flex', marginInlineStart: 'auto' }, mirrorInRtl))

/**
 * The item that opens a submenu: the pointer resting on it, a click, Enter,
 * Space and the arrow key that points at the submenu open it.
 */
export function DropdownMenuSubTrigger(handle: Handle<DropdownMenuSubTriggerProps>) {
  return () => {
    let sub = useMenu(handle, 'DropdownMenuSubTrigger')
    let menu = sub.parent
    if (!menu) throw new Error('DropdownMenuSubTrigger must be inside a DropdownMenuSub')
    let { inset, label, openOnHover = true, delay = 100, closeDelay = 0, id, children, mix, ...props } = handle.props
    let { disabled } = sub
    let triggerId = id ?? sub.defaultTriggerId
    sub.triggerId = triggerId

    return (
      <div
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={sub.open ? 'true' : 'false'}
        aria-controls={sub.contentId}
        tabIndex={-1}
        data-slot={`${menu.family}-sub-trigger`}
        data-popup-open={sub.open ? '' : undefined}
        data-inset={inset ? '' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-label={label}
        {...props}
        id={triggerId}
        mix={[
          itemStyles,
          mix,
          ref((node, signal) => sub.attachTrigger(node, signal)),
          itemMixin({
            menu,
            disabled,
            closeOnClick: false,
            keepHighlight: () => sub.open,
            activate(event) {
              // Enter and Space click with a detail of 0, and move focus into the submenu.
              if (event.detail === 0) {
                if (sub.open) sub.focusItem('first')
                else sub.setOpen(true, 'trigger-press', { cause: event, focus: 'first' })
              } else if (!sub.open) {
                sub.setOpen(true, 'trigger-press', { cause: event, focus: 'none' })
              }
            },
          }),
          openOnHover && !disabled
            ? hoverIntent({
                open: sub.open,
                delay,
                closeDelay,
                openOnFocus: false,
                popup: () => sub.content,
                onOpenChange: (open, reason, event) =>
                  sub.setOpen(open, open || reason !== 'focus-out' ? 'trigger-hover' : 'focus-out', {
                    cause: event,
                    focus: 'none',
                  }),
              })
            : undefined,
        ]}
      >
        {children}
        <span aria-hidden="true" mix={chevronStyles}>
          <ChevronRightIcon />
        </span>
      </div>
    )
  }
}
