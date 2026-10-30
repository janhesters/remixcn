// RemixCN Context Menu: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css, on, ref } from 'remix/component'
import type { Handle, MixinDescriptor, Props } from 'remix/component'

import type { AnchorPoint } from '#remixcn/lib/anchor-position.ts'
import { MenuRoot, useMenu } from '#remixcn/ui/dropdown-menu.tsx'
import type { DropdownMenuProps, MenuApi, MenuFocus } from '#remixcn/ui/dropdown-menu.tsx'

// A context menu opens at the pointer on a right click inside its trigger
// area, and at the focused element with the Context Menu key or Shift+F10.
// On touch, a press held for half a second opens it; a press that moves or
// scrolls the page doesn't, and a short tap still follows a link. Everything
// else, from the keys to the submenus, is the Dropdown Menu's engine, so the
// parts below are Dropdown Menu's parts that name themselves context-menu-….
//
// While it's open, the rest of the page waits, as behind a native context
// menu: a press elsewhere only closes it, and a right click elsewhere in the
// area moves it there. Without JavaScript, the browser shows its own menu.

export {
  DropdownMenuCheckboxItem as ContextMenuCheckboxItem,
  DropdownMenuContent as ContextMenuContent,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuLinkItem as ContextMenuLinkItem,
  DropdownMenuPortal as ContextMenuPortal,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuShortcut as ContextMenuShortcut,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
  MenuCheckedChangeEvent,
  MenuOpenChangeEvent,
  MenuValueChangeEvent,
  menuCheckedChangeType,
  menuOpenChangeType,
  menuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'
export type {
  DropdownMenuCheckboxItemProps as ContextMenuCheckboxItemProps,
  DropdownMenuContentProps as ContextMenuContentProps,
  DropdownMenuItemProps as ContextMenuItemProps,
  DropdownMenuLabelProps as ContextMenuLabelProps,
  DropdownMenuLinkItemProps as ContextMenuLinkItemProps,
  DropdownMenuRadioGroupProps as ContextMenuRadioGroupProps,
  DropdownMenuRadioItemProps as ContextMenuRadioItemProps,
  DropdownMenuSubContentProps as ContextMenuSubContentProps,
  DropdownMenuSubProps as ContextMenuSubProps,
  DropdownMenuSubTriggerProps as ContextMenuSubTriggerProps,
  MenuOpenChangeReason,
} from '#remixcn/ui/dropdown-menu.tsx'

export type ContextMenuProps = Omit<DropdownMenuProps, 'modal'>

/** Groups a context menu's trigger area and content and holds whether it's open. It renders no element. */
export function ContextMenu(handle: Handle<ContextMenuProps>) {
  return () => <MenuRoot {...handle.props} family="context-menu" />
}

// How long a touch rests before the menu opens, and how far it may wander.
const longPressDelay = 500
const longPressSlop = 10

/** Whether a contextmenu event came from a pointer, not from the Context Menu key or Shift+F10. */
function fromPointer(event: MouseEvent) {
  let type = (event as PointerEvent).pointerType
  return event.button === 2 || type === 'touch' || type === 'pen'
}

/** A point at the start of the element's bottom edge, where the keys open the menu. */
function keyboardAnchor(element: Element): AnchorPoint {
  let rect = element.getBoundingClientRect()
  let rtl = getComputedStyle(element).direction === 'rtl'
  return { x: rtl ? rect.right : rect.left, y: rect.bottom }
}

const triggerMixin = createMixin<HTMLElement>((handle) => {
  let api: MenuApi
  let area: HTMLElement | null = null
  let press: { x: number; y: number; pointerId: number; timer: number; scroll: AbortController } | null = null
  let suppressClick = false
  let watching: AbortController | null = null

  function openAt(event: Event, anchor: AnchorPoint, focus: MenuFocus) {
    if (api.open) api.reposition(anchor)
    else api.setOpen(true, 'trigger-press', { cause: event, focus, anchor })
  }

  /** Whether the event comes from the menu, which may sit inside the area, as in a table cell. */
  function insideMenu(event: Event) {
    return Boolean(api.content && event.target instanceof Node && api.content.contains(event.target))
  }

  function cancelPress() {
    if (!press) return
    area?.ownerDocument.defaultView?.clearTimeout(press.timer)
    press.scroll.abort()
    press = null
  }

  // While open, the area is inert, so right clicks reach the document: one in
  // the area moves the menu, one elsewhere closes it and lets the browser show its own.
  function onDocumentContextMenu(event: MouseEvent) {
    let target = event.target as Node | null
    if (api.content?.contains(target)) {
      event.preventDefault()
      return
    }
    // The Context Menu key or Shift+F10 that opened it sends one after its keydown.
    if (!fromPointer(event)) {
      event.preventDefault()
      return
    }
    let rect = area?.getBoundingClientRect()
    let inside =
      rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    if (inside) {
      event.preventDefault()
      api.reposition({ x: event.clientX, y: event.clientY })
    } else {
      api.setOpen(false, 'outside-press', { cause: event })
    }
  }

  function watch(open: boolean) {
    if (open && !watching && area) {
      watching = new AbortController()
      area.ownerDocument.addEventListener('contextmenu', onDocumentContextMenu, {
        capture: true,
        signal: watching.signal,
      })
    } else if (!open && watching) {
      watching.abort()
      watching = null
    }
  }

  handle.addEventListener('remove', () => {
    cancelPress()
    watching?.abort()
    watching = null
  })

  return () => {
    api = useMenu(handle, 'contextMenuTrigger()')
    let open = api.open
    handle.queueTask(() => watch(open))

    return (
      <handle.element
        data-popup-open={api.open ? '' : undefined}
        data-pressed={api.open ? '' : undefined}
        mix={[
          ref((node, signal) => {
            area = node
            api.attachTrigger(node, signal)
          }),
          on('contextmenu', (event) => {
            // A disabled menu leaves the browser's own menu, and the menu's own events bubble through a menu inside the area.
            // A listener that canceled the right click already, before this one, keeps the menu closed.
            if (api.disabled || event.defaultPrevented || insideMenu(event)) return
            event.preventDefault()
            cancelPress()
            let pointer = fromPointer(event)
            let target = event.target instanceof Element ? event.target : (event.currentTarget as Element)
            openAt(
              event,
              pointer ? { x: event.clientX, y: event.clientY } : keyboardAnchor(target),
              pointer ? 'menu' : 'first',
            )
          }),
          on('keydown', (event) => {
            let menuKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
            if (!menuKey || event.defaultPrevented || api.disabled || event.ctrlKey || event.metaKey || event.altKey) {
              return
            }
            if (insideMenu(event)) return
            event.preventDefault()
            let target = event.target instanceof Element ? event.target : (event.currentTarget as Element)
            openAt(event, keyboardAnchor(target), 'first')
          }),
          on('pointerdown', (event) => {
            let view = area?.ownerDocument.defaultView
            if (event.pointerType !== 'touch' || !event.isPrimary || api.disabled || !view || insideMenu(event)) return
            if (event.defaultPrevented) return
            cancelPress()
            let scroll = new AbortController()
            let start = { x: event.clientX, y: event.clientY }
            press = {
              ...start,
              pointerId: event.pointerId,
              scroll,
              timer: view.setTimeout(() => {
                cancelPress()
                // The click that ends this press would follow a link under the finger.
                suppressClick = true
                openAt(event, start, 'menu')
              }, longPressDelay),
            }
            // Scrolling the page, or anything in it, is no long press.
            view.addEventListener('scroll', cancelPress, { capture: true, passive: true, signal: scroll.signal })
          }),
          on('pointermove', (event) => {
            if (!press || event.pointerId !== press.pointerId) return
            if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > longPressSlop) cancelPress()
          }),
          on('pointerup', () => cancelPress()),
          on('pointercancel', () => cancelPress()),
          on(
            'click',
            (event) => {
              if (!suppressClick) return
              suppressClick = false
              event.preventDefault()
              event.stopPropagation()
            },
            true,
          ),
          // A touch that ends without a click, as after the menu opened, leaves nothing to suppress.
          on(
            'pointerdown',
            () => {
              suppressClick = false
            },
            true,
          ),
        ]}
      />
    )
  }
})

/** Makes any element the area whose right click opens the menu, such as a table row. */
export function contextMenuTrigger(): MixinDescriptor<HTMLElement, []> {
  return triggerMixin()
}

const triggerStyles = css({
  userSelect: 'none',
  // A held touch opens this menu, not the browser's callout.
  WebkitTouchCallout: 'none',
})

/** The area whose right click, long press, Context Menu key or Shift+F10 opens the menu. */
export function ContextMenuTrigger(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="context-menu-trigger" {...props} mix={[triggerStyles, mix, contextMenuTrigger()]} />
  }
}
