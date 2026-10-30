// RemixCN Dropdown Menu examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CopyIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  menuCheckedChangeType,
  menuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'

// Each example is a client entry, so its menus run in the browser. Until
// then, and without JavaScript, a trigger opens its menu natively, and only
// its links work.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const outline = buttonVariants({ variant: 'outline' })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const width = (rem: number) => css({ width: `${rem}rem` })
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

export function UserIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </Icon>
  )
}

export function CreditCardIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </Icon>
  )
}

export function SlidersIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  )
}

export function LogOutIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M9.5 20.5H5.5a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h4" />
      <path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9" />
    </Icon>
  )
}

export function PencilIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M15 5.5 18.5 9M4 20l1-4.5L16.5 4a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19Z" />
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

export function MailIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </Icon>
  )
}

export function BellIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
      <path d="M10 20.5h4" />
    </Icon>
  )
}

export function PanelIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Icon>
  )
}

/** A label, items, a separator and a disabled item. */
export const DropdownMenuBasic = clientEntry(import.meta.url, function DropdownMenuBasic() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem href="#help">Help center</DropdownMenuLinkItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuItem disabled>API</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** Every side. Inline start and end follow the text direction. */
export const DropdownMenuSides = clientEntry(import.meta.url, function DropdownMenuSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <DropdownMenu key={side}>
          <DropdownMenuTrigger mix={outline}>{side.replace('-', ' ')}</DropdownMenuTrigger>
          <DropdownMenuContent side={side}>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  )
})

/** Icons and keyboard shortcuts at the start and end of the items. */
export const DropdownMenuWithIcons = clientEntry(import.meta.url, function DropdownMenuWithIcons() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Account</DropdownMenuTrigger>
      <DropdownMenuContent mix={width(14)}>
        <DropdownMenuItem>
          <UserIcon />
          Profile
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCardIcon />
          Billing
          <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <SlidersIcon />
          Settings
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOutIcon />
          Sign out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/** A submenu opens beside its item on hover, a click, Enter or the arrow that points at it. */
export const DropdownMenuWithSubmenu = clientEntry(import.meta.url, function DropdownMenuWithSubmenu() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Invoice INV-2041</DropdownMenuTrigger>
      <DropdownMenuContent mix={width(12)}>
        <DropdownMenuItem>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MailIcon />
            Send to
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Billing contact</DropdownMenuItem>
              <DropdownMenuItem>Accounts payable</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>More recipients</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Finance team</DropdownMenuItem>
                  <DropdownMenuItem>Auditor</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/**
 * Checkbox items keep the menu open and say their state through aria-checked.
 * This one tracks the state itself, from MenuCheckedChangeEvent.
 */
export const DropdownMenuWithCheckboxes = clientEntry(
  import.meta.url,
  function DropdownMenuWithCheckboxes(handle: Handle) {
    let shown = { statusBar: true, activityBar: false, panel: false }
    let toggle = (key: keyof typeof shown) =>
      on<HTMLElement, typeof menuCheckedChangeType>(menuCheckedChangeType, (event) => {
        shown[key] = event.checked
        void handle.update()
      })

    return () => (
      <DropdownMenu>
        <DropdownMenuTrigger mix={outline}>Checkboxes</DropdownMenuTrigger>
        <DropdownMenuContent mix={width(11)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={shown.statusBar} mix={toggle('statusBar')}>
              <PanelIcon />
              Status bar
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={shown.activityBar} disabled mix={toggle('activityBar')}>
              <BellIcon />
              Activity bar
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={shown.panel} mix={toggle('panel')}>
              <PanelIcon />
              Panel
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
)

/** One radio item of a group is checked. The trigger shows the choice, from MenuValueChangeEvent. */
export const DropdownMenuWithRadio = clientEntry(import.meta.url, function DropdownMenuWithRadio(handle: Handle) {
  let position = 'bottom'

  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Panel: {position}</DropdownMenuTrigger>
      <DropdownMenuContent mix={width(10)}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Panel position</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={position}
            mix={on(menuValueChangeType, (event) => {
              position = event.value
              void handle.update()
            })}
          >
            <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="right" disabled>
              Right
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/** A destructive item, set apart at the end. */
export const DropdownMenuWithDestructive = clientEntry(import.meta.url, function DropdownMenuWithDestructive() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent mix={width(11)}>
        <DropdownMenuItem>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <TrashIcon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

const accountStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  minHeight: space(12),
  textAlign: 'start',
  '& small': { display: 'block', color: 'var(--muted-foreground)', fontSize: 'var(--text-xs)' },
})

/** The account menu of an app, opened from an avatar and a name. */
export const DropdownMenuWithAvatar = clientEntry(import.meta.url, function DropdownMenuWithAvatar() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={[outline, accountStyles]}>
        <Avatar size="sm">
          <AvatarFallback>MB</AvatarFallback>
        </Avatar>
        <span>
          Mara Becker
          <small>mara@example.com</small>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent mix={width(14)}>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <BellIcon />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/** Inset items line their text up with the items that have a check or an icon. */
export const DropdownMenuWithInset = clientEntry(import.meta.url, function DropdownMenuWithInset() {
  return () => (
    <DropdownMenu>
      <DropdownMenuTrigger mix={outline}>Inset</DropdownMenuTrigger>
      <DropdownMenuContent mix={width(11)}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <CopyIcon />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem inset>Paste</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>Appearance</DropdownMenuLabel>
          <DropdownMenuCheckboxItem inset defaultChecked>
            Bookmarks
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem inset>Full addresses</DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup defaultValue="system">
            <DropdownMenuRadioItem inset value="light">
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem inset value="dark">
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem inset value="system">
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/** Groups, shortcuts, checkboxes, radio items, a submenu and a link in one menu. */
export const DropdownMenuComplex = clientEntry(import.meta.url, function DropdownMenuComplex(handle: Handle) {
  let last = 'nothing yet'
  let ran = (name: string) =>
    on<HTMLElement>('click', () => {
      last = name
      void handle.update()
    })

  return () => (
    <div mix={rowStyles}>
      <DropdownMenu>
        <DropdownMenuTrigger mix={outline}>Complex menu</DropdownMenuTrigger>
        <DropdownMenuContent mix={width(15)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuItem mix={ran('Profile')}>
              <UserIcon />
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem mix={ran('Billing')}>
              <CreditCardIcon />
              Billing
              <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuCheckboxItem defaultChecked>Sidebar</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem>Status bar</DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Currency</DropdownMenuLabel>
            <DropdownMenuRadioGroup defaultValue="eur">
              <DropdownMenuRadioItem value="eur">Euro</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="chf">Swiss franc</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem mix={ran('Export as PDF')}>PDF</DropdownMenuItem>
              <DropdownMenuItem mix={ran('Export as CSV')}>CSV</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuLinkItem href="#changelog">What's new</DropdownMenuLinkItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" mix={ran('Sign out')}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p mix={hintStyles} role="status">
        Last chosen: {last}
      </p>
    </div>
  )
})

/** A menu inside a modal dialog. Escape closes the menu first, then the dialog. */
export const DropdownMenuInDialog = clientEntry(import.meta.url, function DropdownMenuInDialog() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invoice INV-2041</DialogTitle>
          <DialogDescription>Choose what to do with this invoice.</DialogDescription>
        </DialogHeader>
        <div mix={rowStyles}>
          <DropdownMenu>
            <DropdownMenuTrigger mix={outline}>Invoice actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Send reminder</DropdownMenuItem>
              <DropdownMenuItem>Mark as paid</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Void invoice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogContent>
    </Dialog>
  )
})
