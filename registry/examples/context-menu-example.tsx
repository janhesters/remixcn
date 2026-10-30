// RemixCN Context Menu examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CopyIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  contextMenuTrigger,
  menuValueChangeType,
} from '#remixcn/ui/context-menu.tsx'

// Each example is a client entry, so its menu runs in the browser. Without
// JavaScript, a right click shows the browser's own menu.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const areaStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: space(32),
  padding: space(4),
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  textAlign: 'center',
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})
const smallAreaStyles = css({ minHeight: space(16) })
const rowStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9rem), 1fr))',
  gap: space(2),
})
const width = (rem: number) => css({ width: `${rem}rem` })
const hint = 'Right-click here, press Shift+F10, or touch and hold'

export function PencilIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M15 5.5 18.5 9M4 20l1-4.5L16.5 4a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19Z" />
    </Icon>
  )
}

export function ScissorsIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5 20 17M8 16.5 20 7" />
    </Icon>
  )
}

export function ClipboardIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
    </Icon>
  )
}

export function TrashIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6" />
    </Icon>
  )
}

/** A right click, Shift+F10 or a held touch inside the area opens the menu at that spot. */
export const ContextMenuBasic = clientEntry(import.meta.url, function ContextMenuBasic() {
  return () => (
    <ContextMenu>
      <ContextMenuTrigger tabIndex={0} mix={areaStyles}>
        {hint}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Back</ContextMenuItem>
        <ContextMenuItem disabled>Forward</ContextMenuItem>
        <ContextMenuItem>Reload</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

/** Icons, shortcuts and a destructive item. */
export const ContextMenuWithIcons = clientEntry(import.meta.url, function ContextMenuWithIcons() {
  return () => (
    <ContextMenu>
      <ContextMenuTrigger tabIndex={0} mix={areaStyles}>
        {hint}
      </ContextMenuTrigger>
      <ContextMenuContent mix={width(12)}>
        <ContextMenuItem>
          <ScissorsIcon />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <CopyIcon />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <ClipboardIcon />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          <TrashIcon />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

/** Groups with labels, a submenu, checkbox items and radio items. */
export const ContextMenuWithGroups = clientEntry(import.meta.url, function ContextMenuWithGroups(handle: Handle) {
  let sort = 'date'

  return () => (
    <ContextMenu>
      <ContextMenuTrigger tabIndex={0} mix={areaStyles}>
        {hint}
      </ContextMenuTrigger>
      <ContextMenuContent mix={width(13)}>
        <ContextMenuGroup>
          <ContextMenuLabel>Invoice</ContextMenuLabel>
          <ContextMenuItem>
            <PencilIcon />
            Edit
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger inset>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Drafts</ContextMenuItem>
              <ContextMenuItem>Sent</ContextMenuItem>
              <ContextMenuItem>Archive</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel inset>Show</ContextMenuLabel>
          <ContextMenuCheckboxItem inset defaultChecked>
            Paid invoices
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem inset>Void invoices</ContextMenuCheckboxItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel inset>Sort by</ContextMenuLabel>
          <ContextMenuRadioGroup
            value={sort}
            mix={on(menuValueChangeType, (event) => {
              sort = event.value
              void handle.update()
            })}
          >
            <ContextMenuRadioItem inset value="date">
              Date
            </ContextMenuRadioItem>
            <ContextMenuRadioItem inset value="amount">
              Amount
            </ContextMenuRadioItem>
            <ContextMenuRadioItem inset value="customer">
              Customer
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** The side of the pointer the menu opens on, when it fits. */
export const ContextMenuSides = clientEntry(import.meta.url, function ContextMenuSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <ContextMenu key={side}>
          <ContextMenuTrigger tabIndex={0} mix={[areaStyles, smallAreaStyles]}>
            {side.replace('-', ' ')}
          </ContextMenuTrigger>
          <ContextMenuContent side={side}>
            <ContextMenuItem>Back</ContextMenuItem>
            <ContextMenuItem>Forward</ContextMenuItem>
            <ContextMenuItem>Reload</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  )
})

const tableStyles = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& th, & td': { paddingBlock: space(2), paddingInline: space(3), textAlign: 'start' },
  '& th': { color: 'var(--muted-foreground)', fontWeight: 500 },
  '& tbody tr': { borderBlockStart: '1px solid var(--border)' },
  '& tbody tr[data-popup-open]': { backgroundColor: 'var(--muted)' },
  '& tbody tr:focus-visible': { outlineOffset: '-2px' },
})

const scrollStyles = css({ maxWidth: '100%', overflowX: 'auto' })

const invoices = [
  { number: 'INV-2041', customer: 'Lindqvist & Partner', amount: '€1,240.00' },
  { number: 'INV-2042', customer: 'Nordhafen Logistik', amount: '€380.50' },
]

/** contextMenuTrigger() makes any element the area, such as each row of a table. */
export const ContextMenuOnRows = clientEntry(import.meta.url, function ContextMenuOnRows(handle: Handle) {
  let last = 'nothing yet'

  return () => (
    <div>
      {/* A table needs its columns side by side, so on a narrow screen it scrolls in its own box. */}
      <div mix={scrollStyles}>
        <table mix={tableStyles}>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Customer</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <ContextMenu key={invoice.number}>
                <tr tabIndex={0} mix={contextMenuTrigger()}>
                  <td>{invoice.number}</td>
                  <td>{invoice.customer}</td>
                  <td>
                    {invoice.amount}
                    {/* A table row holds only cells, so the menu sits in one. */}
                    <ContextMenuContent>
                      {['Open', 'Send reminder', 'Mark as paid'].map((action) => (
                        <ContextMenuItem
                          key={action}
                          mix={on('click', () => {
                            last = `${action}: ${invoice.number}`
                            void handle.update()
                          })}
                        >
                          {action}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuContent>
                  </td>
                </tr>
              </ContextMenu>
            ))}
          </tbody>
        </table>
      </div>
      <p role="status">Last chosen: {last}</p>
    </div>
  )
})
