// RemixCN Menubar: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { getNextIndex, isDisabledItem, isFocusableItem, rovingFocus } from '#remixcn/lib/composite.ts'
import { MenuRoot, dropdownMenuTrigger, menuOfTrigger } from '#remixcn/ui/dropdown-menu.tsx'
import type { DropdownMenuProps, MenuController, MenuGroup } from '#remixcn/ui/dropdown-menu.tsx'

// A menubar is a row of menu buttons, as at the top of a desktop app. The
// arrow keys move between its buttons, and Arrow Down opens a menu at its
// first item. Inside an open menu, Arrow Left and Right move to the menu
// beside it, unless they open or close a submenu. Once a menu is open, the
// pointer opens the others by moving onto their buttons. Everything inside a
// menu is the Dropdown Menu's engine, so the parts below are Dropdown Menu's
// parts that name themselves menubar-….
//
// Without JavaScript, each button opens its menu natively, as a Dropdown
// Menu's does.

export {
  DropdownMenuCheckboxItem as MenubarCheckboxItem,
  DropdownMenuContent as MenubarContent,
  DropdownMenuGroup as MenubarGroup,
  DropdownMenuItem as MenubarItem,
  DropdownMenuLabel as MenubarLabel,
  DropdownMenuLinkItem as MenubarLinkItem,
  DropdownMenuPortal as MenubarPortal,
  DropdownMenuRadioGroup as MenubarRadioGroup,
  DropdownMenuRadioItem as MenubarRadioItem,
  DropdownMenuSeparator as MenubarSeparator,
  DropdownMenuShortcut as MenubarShortcut,
  DropdownMenuSub as MenubarSub,
  DropdownMenuSubContent as MenubarSubContent,
  DropdownMenuSubTrigger as MenubarSubTrigger,
  MenuCheckedChangeEvent,
  MenuOpenChangeEvent,
  MenuValueChangeEvent,
  menuCheckedChangeType,
  menuOpenChangeType,
  menuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'
export type {
  DropdownMenuCheckboxItemProps as MenubarCheckboxItemProps,
  DropdownMenuContentProps as MenubarContentProps,
  DropdownMenuItemProps as MenubarItemProps,
  DropdownMenuLabelProps as MenubarLabelProps,
  DropdownMenuLinkItemProps as MenubarLinkItemProps,
  DropdownMenuRadioGroupProps as MenubarRadioGroupProps,
  DropdownMenuRadioItemProps as MenubarRadioItemProps,
  DropdownMenuSubContentProps as MenubarSubContentProps,
  DropdownMenuSubProps as MenubarSubProps,
  DropdownMenuSubTriggerProps as MenubarSubTriggerProps,
  MenuOpenChangeReason,
} from '#remixcn/ui/dropdown-menu.tsx'

interface MenubarApi extends MenuGroup {
  orientation: 'horizontal' | 'vertical'
  modal: boolean
  disabled: boolean
}

export interface MenubarProps extends Omit<Props<'div'>, 'role'> {
  /** The direction the buttons run: `'horizontal'` (the default) or `'vertical'`. */
  orientation?: 'horizontal' | 'vertical'
  /** Whether the arrow keys wrap from the last button to the first (defaults to `true`). */
  loopFocus?: boolean
  /**
   * Whether the rest of the page waits while a menu is open: it can't be
   * scrolled, and a press outside only closes the menu (defaults to `true`).
   * The menubar itself stays usable.
   */
  modal?: boolean
  /** Whether every menu stays closed. */
  disabled?: boolean
}

const triggerSelector = '[data-slot="menubar-trigger"]'

const menubarStyles = css({
  display: 'flex',
  // Wraps rather than scrolling sideways on a narrow screen.
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'calc(var(--spacing) * 1)',
  minHeight: 'calc(var(--spacing) * 9)',
  boxSizing: 'border-box',
  padding: 'calc(var(--spacing) * 1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--background)',
  boxShadow: 'var(--shadow-xs)',
  '&[aria-orientation="vertical"]': { flexDirection: 'column', alignItems: 'stretch', width: 'fit-content' },
})

/** A row of menus. Each MenubarMenu inside it holds a MenubarTrigger and a MenubarContent. */
export function Menubar(handle: Handle<MenubarProps, MenubarApi>) {
  let openMenu: MenuController | null = null
  let element: HTMLElement | null = null

  function setOpenMenu(menu: MenuController | null) {
    if (openMenu === menu) return
    openMenu = menu
    if (!handle.signal.aborted) void handle.update()
  }

  /** The menus in the order of their buttons, without the ones that can't take focus. */
  function ordered() {
    let triggers = element ? [...element.querySelectorAll<HTMLElement>(triggerSelector)] : []
    return triggers.flatMap((trigger) => {
      let menu = menuOfTrigger(trigger)
      return menu && isFocusableItem(trigger) ? [{ menu, disabled: isDisabledItem(trigger) }] : []
    })
  }

  let api: MenubarApi = {
    orientation: 'horizontal',
    modal: true,
    disabled: false,
    opened(menu) {
      let previous = openMenu
      setOpenMenu(menu)
      if (previous && previous !== menu && previous.open) previous.setOpen(false, 'sibling-open')
    },
    closed(menu) {
      if (openMenu === menu) setOpenMenu(null)
    },
    hasOpenMenu() {
      return openMenu?.open ?? false
    },
    move(menu, step, event) {
      let entries = ordered()
      let index = entries.findIndex((entry) => entry.menu === menu)
      if (index === -1) return false
      let disabled = entries.map((entry) => entry.disabled)
      let next = getNextIndex(step > 0 ? 'ArrowDown' : 'ArrowUp', index, disabled, {
        orientation: 'vertical',
        loop: handle.props.loopFocus ?? true,
      })
      if (next === undefined || next === index) return false
      return entries[next].menu.setOpen(true, 'list-navigation', { cause: event, focus: 'first' })
    },
    keep: () => [element],
  }
  handle.context.set(api)

  return () => {
    let { orientation = 'horizontal', loopFocus = true, modal = true, disabled = false, mix, ...props } = handle.props
    api.orientation = orientation
    api.modal = modal
    api.disabled = disabled

    return (
      <div
        role="menubar"
        aria-orientation={orientation}
        data-slot="menubar"
        data-orientation={orientation}
        data-modal={modal ? '' : undefined}
        data-has-submenu-open={openMenu?.open ? '' : undefined}
        {...props}
        mix={[
          menubarStyles,
          mix,
          ref((node) => (element = node)),
          rovingFocus({ items: triggerSelector, orientation, loop: loopFocus }),
        ]}
      />
    )
  }
}

export type MenubarMenuProps = Omit<DropdownMenuProps, 'modal'>

/** Groups one menu of the menubar: its MenubarTrigger and MenubarContent. It renders no element. */
export function MenubarMenu(handle: Handle<MenubarMenuProps>) {
  return () => {
    let menubar = handle.context.get(Menubar) as MenubarApi | undefined
    if (!menubar) throw new Error('MenubarMenu must be inside a Menubar')
    let { disabled = false, ...props } = handle.props

    return (
      <MenuRoot
        {...props}
        family="menubar"
        group={menubar}
        modal={menubar.modal}
        disabled={disabled || menubar.disabled}
      />
    )
  }
}

const triggerStyles = css({
  display: 'flex',
  alignItems: 'center',
  paddingInline: 'calc(var(--spacing) * 2)',
  paddingBlock: 'calc(var(--spacing) * 1)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  fontWeight: 500,
  cursor: 'default',
  userSelect: 'none',
  '&:hover, &[aria-expanded="true"]': { backgroundColor: 'var(--muted)' },
  '&:disabled, &[aria-disabled="true"]': { opacity: 0.5 },
  // Forced colors drop the background, so an outline marks the open menu's button.
  '@media (forced-colors: active)': {
    '&[aria-expanded="true"]': { outline: '1px solid CanvasText', outlineOffset: '-1px' },
  },
})

/** A menu button of the menubar: a native button with the menuitem role. */
export function MenubarTrigger(handle: Handle<Omit<Props<'button'>, 'role'>>) {
  return () => {
    let { type = 'button', mix, ...props } = handle.props
    return (
      <button
        role="menuitem"
        data-slot="menubar-trigger"
        {...props}
        type={type}
        mix={[triggerStyles, mix, dropdownMenuTrigger()]}
      />
    )
  }
}
