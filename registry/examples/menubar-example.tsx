// RemixCN Menubar examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  menuValueChangeType,
} from '#remixcn/ui/menubar.tsx'

// Each example is a client entry, so its menus run in the browser. Until
// then, and without JavaScript, a button opens its menu natively.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const width = (rem: number) => css({ width: `${rem}rem` })
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

/** File, Edit and View menus, with shortcuts, a submenu, checkbox and radio items. */
export const MenubarBasic = clientEntry(import.meta.url, function MenubarBasic(handle: Handle) {
  let currency = 'eur'
  let last = 'nothing yet'
  let ran = (name: string) =>
    on<HTMLElement>('click', () => {
      last = name
      void handle.update()
    })

  return () => (
    <div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent mix={width(14)}>
            <MenubarItem mix={ran('New invoice')}>
              New invoice <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem mix={ran('New customer')}>
              New customer <MenubarShortcut>⇧⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled>New credit note</MenubarItem>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem mix={ran('Export as PDF')}>PDF</MenubarItem>
                <MenubarItem mix={ran('Export as CSV')}>CSV</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem mix={ran('Print')}>
              Print… <MenubarShortcut>⌘P</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem mix={ran('Undo')}>
              Undo <MenubarShortcut>⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem mix={ran('Redo')}>
              Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem mix={ran('Cut')}>Cut</MenubarItem>
            <MenubarItem mix={ran('Copy')}>Copy</MenubarItem>
            <MenubarItem mix={ran('Paste')}>Paste</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent mix={width(13)}>
            <MenubarGroup>
              <MenubarLabel>Columns</MenubarLabel>
              <MenubarCheckboxItem defaultChecked>Due date</MenubarCheckboxItem>
              <MenubarCheckboxItem>Tax</MenubarCheckboxItem>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarGroup>
              <MenubarLabel>Currency</MenubarLabel>
              <MenubarRadioGroup
                value={currency}
                mix={on(menuValueChangeType, (event) => {
                  currency = event.value
                  void handle.update()
                })}
              >
                <MenubarRadioItem value="eur">Euro</MenubarRadioItem>
                <MenubarRadioItem value="chf">Swiss franc</MenubarRadioItem>
                <MenubarRadioItem value="usd">US dollar</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarGroup>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu disabled>
          <MenubarTrigger>Share</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Email</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p mix={hintStyles} role="status">
        Last chosen: {last}. Currency: {currency.toUpperCase()}.
      </p>
    </div>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** Every side of the button a menu can open on. */
export const MenubarSides = clientEntry(import.meta.url, function MenubarSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <Menubar key={side}>
          <MenubarMenu>
            <MenubarTrigger>{side.replace('-', ' ')}</MenubarTrigger>
            <MenubarContent side={side}>
              <MenubarItem>New invoice</MenubarItem>
              <MenubarItem>New customer</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      ))}
    </div>
  )
})

/** A vertical menubar opens its menus beside it, with Arrow Right, or Arrow Left in right-to-left text. */
export const MenubarVertical = clientEntry(import.meta.url, function MenubarVertical() {
  return () => (
    <Menubar orientation="vertical" aria-label="Workspace">
      <MenubarMenu>
        <MenubarTrigger>Invoices</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Drafts</MenubarItem>
          <MenubarItem>Sent</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Customers</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>All customers</MenubarItem>
          <MenubarItem>New customer</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
})
