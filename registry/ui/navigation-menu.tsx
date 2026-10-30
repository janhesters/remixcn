// RemixCN Navigation Menu: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, createMixin, css, on, ref } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, Side } from '#remixcn/lib/anchor-position.ts'
import { getNextIndex } from '#remixcn/lib/composite.ts'
import { getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import { hoverIntent } from '#remixcn/lib/hover-intent.ts'
import { ChevronDownIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A navigation menu is a site's main links: a list of links and of buttons
// that each show a panel of more links. It is no ARIA menu: the links stay
// links, in the tab order, and a panel is a disclosure its button controls.
// Resting the pointer on a button opens its panel, and once one is open the
// pointer opens the others at once. A click or Enter opens or closes a panel;
// Arrow Down (Arrow Right when vertical) moves into it. The arrow keys move
// between the list's buttons and links, and between the links of a panel.
// Escape, a press elsewhere and focus leaving close it.
//
// Each panel is a native popover in the top layer, below its button. Without
// JavaScript, a button opens its panel natively, in the middle of the screen,
// and every link works.

export type NavigationMenuValueChangeReason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'outside-press'
  | 'list-navigation'
  | 'focus-out'
  | 'escape-key'
  | 'link-press'
  | 'trigger-removed'

export const navigationMenuValueChangeType = 'remixcn:navigation-menu-value-change' as const

/**
 * Dispatched on the navigation menu before another panel opens or the open one
 * closes. `value` is the open item's value, or `null` when every panel closes.
 * Cancel it to keep things as they are. It takes the place of Base UI's
 * `onValueChange`.
 */
export class NavigationMenuValueChangeEvent extends Event {
  readonly value: string | null
  readonly reason: NavigationMenuValueChangeReason
  readonly cause: Event | undefined

  constructor(value: string | null, reason: NavigationMenuValueChangeReason, cause?: Event) {
    super(navigationMenuValueChangeType, { cancelable: true })
    this.value = value
    this.reason = reason
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [navigationMenuValueChangeType]: NavigationMenuValueChangeEvent
  }
}

type Orientation = 'horizontal' | 'vertical'

interface Placement {
  side: Side
  sideOffset: number
  align: Align
  alignOffset: number
}

interface RootApi {
  value: string | null
  running: boolean
  orientation: Orientation
  delay: number
  closeDelay: number
  placement: Placement
  /** Which way the open panel's button lies from the one open before it, for an animation that follows. */
  direction: 'left' | 'right' | undefined
  openedBy: 'press' | 'hover' | null
  element: HTMLElement | null
  /** Asks to open the item with `value`, or to close every panel with `null`. Returns whether it changes. */
  setValue(value: string | null, reason: NavigationMenuValueChangeReason, cause?: Event): boolean
  /** Keeps a panel the pointer opened open after the pointer leaves, as a click on its button does. */
  keepOpen(): void
}

interface ItemApi {
  value: string
  triggerId: string
  contentId: string
  trigger: HTMLElement | null
  content: HTMLElement | null
}

function useRoot(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let api = handle.context.get(NavigationMenu) as RootApi | undefined
  if (!api) throw new Error(`${part} must be inside a NavigationMenu`)
  return api
}

function useItem(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let item = handle.context.get(NavigationMenuItem) as ItemApi | undefined
  if (!item) throw new Error(`${part} must be inside a NavigationMenuItem`)
  return item
}

function getDirection(element: Element | null) {
  return element && getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr'
}

export interface NavigationMenuProps extends Omit<Props<'nav'>, 'defaultValue'> {
  /** The open item's value, or `null` with every panel closed, for a menu you control. Update it from `NavigationMenuValueChangeEvent`. */
  value?: string | null
  /** The value of the item whose panel starts open. */
  defaultValue?: string | null
  /** Milliseconds the pointer rests on a button before its panel opens (defaults to `50`). */
  delay?: number
  /** Milliseconds before a panel closes once the pointer has left (defaults to `50`). */
  closeDelay?: number
  /** The direction the list runs: `'horizontal'` (the default) or `'vertical'`. */
  orientation?: Orientation
  /** The side of its button a panel shows on: `'bottom'`, or `'inline-end'` when vertical. */
  side?: Side
  /** The gap between a panel and its button, in pixels (defaults to `8`). */
  sideOffset?: number
  /** How a panel aligns with its button (defaults to `'start'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
}

const rootStyles = css({
  position: 'relative',
  display: 'flex',
  flex: '1 1 auto',
  maxWidth: 'max-content',
  alignItems: 'center',
  justifyContent: 'center',
  '&[data-orientation="vertical"]': { flexDirection: 'column', alignItems: 'stretch' },
})

/**
 * The navigation: a native `<nav>` landmark around a NavigationMenuList. Give
 * it an `aria-label` when the page has more than one.
 */
export function NavigationMenu(handle: Handle<NavigationMenuProps, RootApi>) {
  let uncontrolled = handle.props.defaultValue ?? null

  let api: RootApi = {
    value: null,
    running: false,
    orientation: 'horizontal',
    delay: 50,
    closeDelay: 50,
    placement: { side: 'bottom', sideOffset: 8, align: 'start', alignOffset: 0 },
    direction: undefined,
    openedBy: null,
    element: null,
    setValue(value, reason, cause) {
      if (handle.signal.aborted || !api.running) return false
      let current = handle.props.value === undefined ? uncontrolled : handle.props.value
      if (value === current) return false
      let event = new NavigationMenuValueChangeEvent(value, reason, cause)
      api.element?.dispatchEvent(event)
      if (event.defaultPrevented) return false
      api.direction = value !== null && current !== null ? directionBetween(current, value) : undefined
      if (value !== null) api.openedBy = reason === 'trigger-hover' ? 'hover' : 'press'
      if (handle.props.value === undefined) uncontrolled = value
      void handle.update()
      return true
    },
    keepOpen() {
      if (api.openedBy !== 'hover' || handle.signal.aborted) return
      api.openedBy = 'press'
      void handle.update()
    },
  }
  handle.context.set(api)

  /** The value of this menu's item whose panel the browser opened natively, before the menu ran. */
  function nativelyOpen() {
    let root = api.element
    let panel = [...(root?.querySelectorAll('[data-slot="navigation-menu-content"]:popover-open') ?? [])].find(
      (content) => content.closest('[data-slot="navigation-menu"]') === root,
    )
    if (!panel || !root) return undefined
    let trigger = [...root.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"]')].find(
      (button) => button.getAttribute('aria-controls') === panel.id,
    )
    return trigger?.dataset.value
  }

  /** Which way the button of `next` lies from the button of `previous`, on screen. */
  function directionBetween(previous: string, next: string) {
    let triggers = api.element
      ? [...api.element.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"]')]
      : []
    let index = (value: string) => triggers.findIndex((trigger) => trigger.dataset.value === value)
    let after = index(next) > index(previous)
    if (getDirection(api.element) === 'rtl') after = !after
    return after ? ('right' as const) : ('left' as const)
  }

  return () => {
    let {
      value,
      defaultValue: _defaultValue,
      delay = 50,
      closeDelay = 50,
      orientation = 'horizontal',
      side = orientation === 'vertical' ? 'inline-end' : 'bottom',
      sideOffset = 8,
      align = 'start',
      alignOffset = 0,
      mix,
      ...props
    } = handle.props
    if (!api.running) {
      handle.queueTask(() => {
        // A panel the browser already opened natively stays open, now below its button.
        if (handle.props.value === undefined) uncontrolled = nativelyOpen() ?? uncontrolled
        api.running = true
        void handle.update()
      })
    }
    api.value = api.running ? (value === undefined ? uncontrolled : value) : null
    if (api.value === null) {
      api.openedBy = null
      api.direction = undefined
    }
    api.orientation = orientation
    api.delay = delay
    api.closeDelay = closeDelay
    api.placement = { side, sideOffset, align, alignOffset }

    return (
      <nav
        data-slot="navigation-menu"
        data-orientation={orientation}
        data-open={api.value !== null ? '' : undefined}
        {...props}
        mix={[rootStyles, mix, ref((node) => (api.element = node))]}
      />
    )
  }
}

const listStyles = css({
  display: 'flex',
  flex: '1 1 auto',
  // Wraps rather than scrolling sideways on a narrow screen.
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
  ':where([data-orientation="vertical"]) > &': { flexDirection: 'column', alignItems: 'stretch' },
})

/** The buttons and links of the list itself, not those inside a panel. */
function listControls(list: Element) {
  return [
    ...list.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"], [data-slot="navigation-menu-link"]'),
  ].filter((control) => !control.closest('[data-slot="navigation-menu-content"]'))
}

/** The list of items, a native `<ul>`. The arrow keys move between its buttons and links. */
export function NavigationMenuList(handle: Handle<Props<'ul'>>) {
  return () => {
    let root = useRoot(handle, 'NavigationMenuList')
    let { mix, ...props } = handle.props

    return (
      <ul
        data-slot="navigation-menu-list"
        data-orientation={root.orientation}
        {...props}
        mix={[
          listStyles,
          mix,
          on('keydown', (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            let list = event.currentTarget as HTMLElement
            let controls = listControls(list)
            let current = controls.indexOf(event.target as HTMLElement)
            if (current === -1) return
            let next = getNextIndex(
              event.key,
              current,
              controls.map((control) => control.matches(':disabled')),
              { orientation: root.orientation, dir: getDirection(list) },
            )
            if (next === undefined) return
            event.preventDefault()
            controls[next].focus()
          }),
        ]}
      />
    )
  }
}

const itemStyles = css({ position: 'relative' })

export interface NavigationMenuItemProps extends Props<'li'> {
  /** Names the item for a menu whose open item you control (defaults to a unique id). */
  value?: string
}

/** One entry of the list, a native `<li>`: a link, or a button with its panel. */
export function NavigationMenuItem(handle: Handle<NavigationMenuItemProps, ItemApi>) {
  let item: ItemApi = {
    value: handle.id,
    triggerId: `${handle.id}-trigger`,
    contentId: `${handle.id}-content`,
    trigger: null,
    content: null,
  }
  handle.context.set(item)

  return () => {
    useRoot(handle, 'NavigationMenuItem')
    let { value = handle.id, mix, ...props } = handle.props
    item.value = value

    return <li data-slot="navigation-menu-item" {...props} mix={[itemStyles, mix]} />
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

// Buttons, the links styled like them, and the links in a panel share one
// rule, so a link that takes navigationMenuTriggerStyle() looks like a button
// wherever the two rules first render.
const controlStyles = css(
  mergeStyles(
    {
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      gap: space(1.5),
      border: 'none',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      textDecoration: 'none',
      '& svg': { flexShrink: 0, width: '1rem', height: '1rem' },
      '&:hover, &:focus-visible': { backgroundColor: 'var(--muted)' },
      '&:is([data-slot="navigation-menu-trigger"], [data-trigger-style])': {
        justifyContent: 'center',
        width: 'max-content',
        minHeight: space(9),
        paddingInline: space(4),
        paddingBlock: space(2),
        fontWeight: 500,
      },
      '&[data-popup-open]': { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
      '&[data-popup-open]:hover': { backgroundColor: 'var(--muted)' },
      '&:disabled': { opacity: 0.5, pointerEvents: 'none' },
      '&[data-slot="navigation-menu-link"]:not([data-trigger-style])': { display: 'flex', padding: space(2) },
      ':where([data-slot="navigation-menu-content"]) &': { borderRadius: 'var(--radius-sm)' },
      '&[data-active]': { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
      '&[data-active]:is(:hover, :focus-visible)': { backgroundColor: 'var(--muted)' },
      // Forced colors drop the background, so a line marks the current page and an open panel's button.
      '@media (forced-colors: active)': {
        '&:is([data-active], [data-popup-open])': { textDecoration: 'underline', textUnderlineOffset: '0.25em' },
      },
    },
    transition('background-color'),
  ),
)

/** Makes a link look like the list's buttons, such as a link beside them: `mix={navigationMenuTriggerStyle()}`. */
export function navigationMenuTriggerStyle(): MixValue {
  return [controlStyles, attrs({ 'data-trigger-style': '' })]
}

const chevronStyles = css(
  mergeStyles(
    {
      display: 'inline-flex',
      position: 'relative',
      top: '1px',
      marginInlineStart: space(-0.5),
      '& svg': { width: '0.75rem', height: '0.75rem' },
      ':where([data-popup-open]) > &': { transform: 'rotate(180deg)' },
    },
    transition('transform'),
  ),
)

/**
 * A native button that opens and closes its item's panel, with a chevron that
 * turns while it's open. Until the browser runs it, it opens the panel natively.
 */
export function NavigationMenuTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let root = useRoot(handle, 'NavigationMenuTrigger')
    let item = useItem(handle, 'NavigationMenuTrigger')
    let { type = 'button', disabled, children, mix, ...props } = handle.props
    let open = root.value === item.value

    return (
      <button
        data-slot="navigation-menu-trigger"
        id={item.triggerId}
        {...props}
        type={type}
        disabled={disabled}
        data-value={item.value}
        aria-controls={item.contentId}
        // Until it runs, the browser reports the state of a popovertarget button itself.
        aria-expanded={root.running ? (open ? 'true' : 'false') : undefined}
        data-popup-open={open ? '' : undefined}
        popovertarget={root.running || disabled ? undefined : item.contentId}
        mix={[
          controlStyles,
          mix,
          ref((node, signal) => {
            item.trigger = node
            signal.addEventListener('abort', () => {
              if (item.trigger !== node) return
              item.trigger = null
              queueMicrotask(() => {
                if (!item.trigger && root.value === item.value) root.setValue(null, 'trigger-removed')
              })
            })
          }),
          on('click', (event) => {
            if (event.defaultPrevented) return
            // A click on a panel the pointer opened keeps it open.
            if (open && root.openedBy === 'hover') {
              root.keepOpen()
              return
            }
            root.setValue(open ? null : item.value, 'trigger-press', event)
          }),
          on('keydown', (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            let inward =
              root.orientation === 'vertical'
                ? getDirection(event.currentTarget as Element) === 'rtl'
                  ? 'ArrowLeft'
                  : 'ArrowRight'
                : 'ArrowDown'
            if (event.key !== inward) return
            event.preventDefault()
            if (!open) root.setValue(item.value, 'list-navigation', event)
            // Once the panel shows, its first link takes focus.
            requestAnimationFrame(() => {
              if (item.content?.matches(':popover-open')) getTabbableElements(item.content)[0]?.focus()
            })
          }),
          on('focusout', (event) => closeOnFocusOut(root, item, event)),
          // A panel a press opened stays open wherever the pointer goes.
          disabled || (open && root.openedBy === 'press')
            ? undefined
            : hoverIntent({
                open,
                // Once a panel is open, the pointer opens the next at once.
                delay: () => (root.value !== null ? 0 : root.delay),
                closeDelay: root.closeDelay,
                openOnFocus: false,
                popup: () => item.content,
                onOpenChange: (next, reason, event) => {
                  if (next) root.setValue(item.value, 'trigger-hover', event)
                  else if (root.value === item.value) {
                    root.setValue(null, reason === 'focus-out' ? 'focus-out' : 'trigger-hover', event)
                  }
                },
              }),
        ]}
      >
        {children}
        <span aria-hidden="true" mix={chevronStyles}>
          <ChevronDownIcon />
        </span>
      </button>
    )
  }
}

/** Closes an item's panel once focus leaves both its button and its panel. */
function closeOnFocusOut(root: RootApi, item: ItemApi, event: FocusEvent) {
  // Without a next element, the window lost focus or a press elsewhere moved it: the layer decides.
  let next = event.relatedTarget
  if (root.value !== item.value || !(next instanceof Node)) return
  if (item.content?.contains(next) || item.trigger?.contains(next)) return
  root.setValue(null, 'focus-out', event)
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

const contentStyles = css(
  mergeStyles(
    {
      boxSizing: 'border-box',
      maxWidth: 'var(--available-width, 100%)',
      maxHeight: 'var(--available-height, 100%)',
      overflow: 'auto',
      paddingBlock: space(2),
      paddingInlineStart: space(2),
      paddingInlineEnd: space(2.5),
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      overflowWrap: 'break-word',
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'block' },
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

/**
 * An item's panel: a native popover below its button, with the item's links.
 * It stays in the document while closed, hidden, so its links are in the
 * server HTML for crawlers and the button's aria-controls always resolves.
 * `data-activation-direction` says from which side its button was reached
 * when another panel was open, for an animation that follows.
 */
export function NavigationMenuContent(handle: Handle<Omit<Props<'div'>, 'id'>>) {
  return () => {
    let root = useRoot(handle, 'NavigationMenuContent')
    let item = useItem(handle, 'NavigationMenuContent')
    let { mix, ...props } = handle.props
    let open = root.value === item.value

    return (
      <div
        data-slot="navigation-menu-content"
        {...props}
        id={item.contentId}
        popover={root.running ? 'manual' : 'auto'}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        data-activation-direction={open ? root.direction : undefined}
        mix={[
          contentStyles,
          mix,
          ref((node, signal) => {
            item.content = node
            signal.addEventListener('abort', () => {
              if (item.content === node) item.content = null
            })
          }),
          topLayer(root.running ? open : null),
          anchorPosition({ open, anchor: () => item.trigger, ...root.placement }),
          dismissableLayer({
            open,
            trigger: () => item.trigger,
            onDismiss: ({ reason, event }) => {
              let content = item.content
              let hadFocus = Boolean(content?.contains(content.ownerDocument.activeElement))
              if (!root.setValue(null, reason === 'escape-key' ? 'escape-key' : 'outside-press', event)) return
              if (reason === 'escape-key' && hadFocus) item.trigger?.focus()
            },
          }),
          on('keydown', (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            let content = event.currentTarget as HTMLElement
            let links = getTabbableElements(content)
            let current = links.indexOf(event.target as HTMLElement)
            if (current === -1) return
            let next = getNextIndex(
              event.key,
              current,
              links.map(() => false),
              {
                orientation: 'both',
                loop: false,
                dir: getDirection(content),
              },
            )
            if (next === undefined) return
            event.preventDefault()
            links[next].focus()
          }),
          on('focusout', (event) => closeOnFocusOut(root, item, event)),
        ]}
      />
    )
  }
}

export interface NavigationMenuLinkProps extends Omit<Props<'a'>, 'href' | 'role'> {
  /** Where the link goes. */
  href?: string
  /** Marks the link of the page you're on: `aria-current="page"` and `data-active`. */
  active?: boolean
  /** Whether following the link closes the open panel (defaults to `false`). */
  closeOnClick?: boolean
}

/** A native link, in the list or in a panel. `active` marks the current page for assistive technology too. */
export function NavigationMenuLink(handle: Handle<NavigationMenuLinkProps>) {
  return () => {
    let root = useRoot(handle, 'NavigationMenuLink')
    let { active = false, closeOnClick = false, mix, ...props } = handle.props

    return (
      <a
        data-slot="navigation-menu-link"
        aria-current={active ? 'page' : undefined}
        data-active={active ? '' : undefined}
        {...props}
        mix={[
          controlStyles,
          mix,
          on('click', (event) => {
            if (!event.defaultPrevented && closeOnClick) root.setValue(null, 'link-press', event)
          }),
        ]}
      />
    )
  }
}

const indicatorStyles = css({
  position: 'absolute',
  top: '100%',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  height: space(1.5),
  overflow: 'hidden',
  pointerEvents: 'none',
  insetInlineStart: 'var(--indicator-start, 0)',
  width: 'var(--indicator-width, 100%)',
  '&:not([data-open])': { visibility: 'hidden' },
  '& > span': {
    position: 'relative',
    top: '60%',
    width: space(2),
    height: space(2),
    rotate: '45deg',
    borderStartStartRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--border)',
    boxShadow: 'var(--shadow-md)',
  },
  '@media (forced-colors: active)': { '& > span': { backgroundColor: 'CanvasText' } },
})

/**
 * A small arrow below the open panel's button. Inside an item, it shows while
 * that item's panel is open; in the list or the root, it follows whichever
 * button has its panel open.
 */
export function NavigationMenuIndicator(handle: Handle<Props<'div'>>) {
  let element: HTMLElement | null = null

  // Under the open button, measured against the box the indicator sits in.
  function place() {
    let root = handle.context.get(NavigationMenu) as RootApi | undefined
    if (!element || !root?.element || root.value === null) return
    let trigger = root.element.querySelector<HTMLElement>(
      `[data-slot="navigation-menu-trigger"][data-value="${CSS.escape(root.value)}"]`,
    )
    let parent = element.offsetParent
    if (!trigger || !parent) return
    let box = trigger.getBoundingClientRect()
    let frame = parent.getBoundingClientRect()
    let start = getDirection(element) === 'rtl' ? frame.right - box.right : box.left - frame.left
    element.style.setProperty('--indicator-start', `${start}px`)
    element.style.setProperty('--indicator-width', `${box.width}px`)
  }

  return () => {
    let root = useRoot(handle, 'NavigationMenuIndicator')
    let item = handle.context.get(NavigationMenuItem) as ItemApi | undefined
    let open = item ? root.value === item.value : root.value !== null
    if (!item && open) handle.queueTask(place)
    let { mix, ...props } = handle.props

    return (
      <div
        data-slot="navigation-menu-indicator"
        aria-hidden="true"
        data-open={open ? '' : undefined}
        {...props}
        mix={[indicatorStyles, mix, ref((node) => (element = node))]}
      >
        <span />
      </div>
    )
  }
}
