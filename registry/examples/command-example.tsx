// RemixCN Command examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, Fragment, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent } from '#remixcn/ui/card.tsx'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '#remixcn/ui/command.tsx'
import { Kbd, KbdGroup } from '#remixcn/ui/kbd.tsx'

// Every example runs in its own client entry, so its command runs in the
// browser. The server renders each list with a disabled input, and each
// button that opens a palette stays disabled until its script runs.
// Selecting an item only reports it here: Command runs nothing itself.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  gap: space(4),
})
const inlineStyles = css({ width: '100%', maxWidth: '24rem' })
const cardStyles = css({ width: '100%', maxWidth: '24rem', padding: 0 })
const flushStyles = css({ padding: 0 })
const borderedStyles = css({ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' })
const fitStyles = css({ width: 'fit-content' })
const customerStyles = css({ display: 'grid', minWidth: 0 })
const emailStyles = css({
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  overflowWrap: 'anywhere',
})
const statusStyles = css({
  margin: 0,
  minHeight: 'var(--text-sm--line-height)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'anywhere',
})

// RemixCN draws its own icons; these are the example's.
function CalendarIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </Icon>
  )
}

function SmileIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </Icon>
  )
}

function CalculatorIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </Icon>
  )
}

function UserIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  )
}

function CreditCardIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </Icon>
  )
}

function SlidersIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  )
}

/** Says which item ran last, in a status, since Command runs nothing itself. */
function Selected(handle: Handle<{ value: string }>) {
  return () => (
    <p role="status" data-selected-command mix={statusStyles}>
      {handle.props.value ? `Selected: ${handle.props.value}` : ''}
    </p>
  )
}

/** A button that opens a palette, disabled until its script runs. */
function OpenButton(handle: Handle<{ onOpen: () => void; children?: RemixNode }>) {
  let running = false

  return () => {
    if (!running) {
      handle.queueTask(() => {
        running = true
        void handle.update()
      })
    }

    return (
      <Button variant="outline" disabled={!running} mix={[fitStyles, on('click', () => handle.props.onOpen())]}>
        {handle.props.children}
      </Button>
    )
  }
}

function SuggestionItems(handle: Handle<{ onSelect: (value: string) => void; icons?: boolean }>) {
  return () => {
    let { onSelect, icons = true } = handle.props
    return (
      <CommandGroup heading="Suggestions">
        <CommandItem onSelect={onSelect}>
          {icons ? <CalendarIcon /> : null}
          <span>Calendar</span>
        </CommandItem>
        <CommandItem onSelect={onSelect} keywords={['emoji', 'smiley']}>
          {icons ? <SmileIcon /> : null}
          <span>Search Emoji</span>
        </CommandItem>
        <CommandItem onSelect={onSelect}>
          {icons ? <CalculatorIcon /> : null}
          <span>Calculator</span>
        </CommandItem>
      </CommandGroup>
    )
  }
}

function SettingsItems(handle: Handle<{ onSelect: (value: string) => void }>) {
  return () => {
    let { onSelect } = handle.props
    return (
      <CommandGroup heading="Settings">
        <CommandItem onSelect={onSelect} keywords={['account']}>
          <UserIcon />
          <span>Profile</span>
          <CommandShortcut>⌘P</CommandShortcut>
        </CommandItem>
        <CommandItem onSelect={onSelect} keywords={['invoices', 'payment']}>
          <CreditCardIcon />
          <span>Billing</span>
          <CommandShortcut>⌘B</CommandShortcut>
        </CommandItem>
        <CommandItem onSelect={onSelect} keywords={['preferences']}>
          <SlidersIcon />
          <span>Settings</span>
          <CommandShortcut>⌘S</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    )
  }
}

/** The command menu in a card, without a dialog. */
export const CommandInline = clientEntry(import.meta.url, function CommandInline(handle: Handle) {
  let selected = ''
  let select = (value: string) => {
    selected = value
    void handle.update()
  }

  return () => (
    <div mix={[stackStyles, inlineStyles]}>
      <Card mix={cardStyles}>
        <CardContent mix={flushStyles}>
          <Command label="Search commands">
            <CommandInput placeholder="Type a command or search…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <SuggestionItems onSelect={select} />
              <CommandSeparator />
              <SettingsItems onSelect={select} />
            </CommandList>
          </Command>
        </CardContent>
      </Card>
      <Selected value={selected} />
    </div>
  )
})

/** A few commands in a dialog, closed again by the command you pick. */
export const CommandBasic = clientEntry(import.meta.url, function CommandBasic(handle: Handle) {
  let open = false
  let selected = ''
  let select = (value: string) => {
    selected = value
    open = false
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <OpenButton onOpen={() => ((open = true), void handle.update())}>Open Menu</OpenButton>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          open = next
          void handle.update()
        }}
      >
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <SuggestionItems onSelect={select} icons={false} />
          </CommandList>
        </Command>
      </CommandDialog>
      <Selected value={selected} />
    </div>
  )
})

/** Shortcuts at the end of each command, as text: nothing here listens for them. */
export const CommandWithShortcuts = clientEntry(import.meta.url, function CommandWithShortcuts(handle: Handle) {
  let open = false
  let selected = ''
  let select = (value: string) => {
    selected = value
    open = false
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <OpenButton onOpen={() => ((open = true), void handle.update())}>Open Menu</OpenButton>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          open = next
          void handle.update()
        }}
      >
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <SettingsItems onSelect={select} />
          </CommandList>
        </Command>
      </CommandDialog>
      <Selected value={selected} />
    </div>
  )
})

/** Groups with icons and a separator in a dialog. */
export const CommandWithGroups = clientEntry(import.meta.url, function CommandWithGroups(handle: Handle) {
  let open = false
  let selected = ''
  let select = (value: string) => {
    selected = value
    open = false
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <OpenButton onOpen={() => ((open = true), void handle.update())}>Open Menu</OpenButton>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          open = next
          void handle.update()
        }}
      >
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <SuggestionItems onSelect={select} />
            <CommandSeparator />
            <SettingsItems onSelect={select} />
          </CommandList>
        </Command>
      </CommandDialog>
      <Selected value={selected} />
    </div>
  )
})

const manyGroups: Array<{ heading: string; items: Array<[label: string, shortcut?: string]> }> = [
  {
    heading: 'Navigation',
    items: [
      ['Home', '⌘H'],
      ['Inbox', '⌘I'],
      ['Documents', '⌘D'],
      ['Folders', '⌘F'],
    ],
  },
  {
    heading: 'Actions',
    items: [
      ['New File', '⌘N'],
      ['New Folder', '⇧⌘N'],
      ['Copy', '⌘C'],
      ['Cut', '⌘X'],
      ['Paste', '⌘V'],
      ['Delete', '⌫'],
    ],
  },
  { heading: 'View', items: [['Grid View'], ['List View'], ['Zoom In', '⌘+'], ['Zoom Out', '⌘-']] },
  {
    heading: 'Account',
    items: [['Profile', '⌘P'], ['Billing', '⌘B'], ['Settings', '⌘S'], ['Notifications'], ['Help & Support']],
  },
  { heading: 'Tools', items: [['Calculator'], ['Calendar'], ['Image Editor'], ['Code Editor']] },
]

/** Many groups in a dialog: the list scrolls, and the highlighted command scrolls into view. */
export const CommandManyItems = clientEntry(import.meta.url, function CommandManyItems(handle: Handle) {
  let open = false
  let selected = ''
  let select = (value: string) => {
    selected = value
    open = false
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <OpenButton onOpen={() => ((open = true), void handle.update())}>Open Menu</OpenButton>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          open = next
          void handle.update()
        }}
      >
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {manyGroups.map((group, index) => (
              <Fragment key={group.heading}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group.heading}>
                  {group.items.map(([label, shortcut]) => (
                    <CommandItem key={label} value={`${group.heading} ${label}`} onSelect={() => select(label)}>
                      <span>{label}</span>
                      {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
      <Selected value={selected} />
    </div>
  )
})

/**
 * Ctrl+J, or ⌘J on a Mac, opens the palette. Command adds no shortcut of
 * its own: this example listens for the key on the document, and stops
 * listening when it leaves the page.
 */
export const CommandWithKeyboardShortcut = clientEntry(
  import.meta.url,
  function CommandWithKeyboardShortcut(handle: Handle) {
    let open = false
    let selected = ''
    let select = (value: string) => {
      selected = value
      open = false
      void handle.update()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'keydown',
        (event) => {
          // A key the palette used, such as Ctrl+J to move down, stays with it.
          if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) return
          if (event.key.toLowerCase() !== 'j') return
          event.preventDefault()
          open = !open
          void handle.update()
        },
        { signal: handle.signal },
      )
    }

    return () => (
      <div mix={stackStyles}>
        <p mix={statusStyles}>
          Press{' '}
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <span>+</span>
            <Kbd>J</Kbd>
          </KbdGroup>{' '}
          or{' '}
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>J</Kbd>
          </KbdGroup>
        </p>
        <CommandDialog
          open={open}
          onOpenChange={(next) => {
            open = next
            void handle.update()
          }}
        >
          <Command>
            <CommandInput placeholder="Type a command or search…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <SuggestionItems onSelect={select} />
              <CommandSeparator />
              <SettingsItems onSelect={select} />
            </CommandList>
          </Command>
        </CommandDialog>
        <Selected value={selected} />
      </div>
    )
  },
)

const customers = [
  { id: 'cus_1042', name: 'Acme Labs', email: 'billing@acme.example' },
  { id: 'cus_1043', name: 'Globex Corporation', email: 'accounts@globex.example' },
  { id: 'cus_1044', name: 'Initech', email: 'ap@initech.example' },
  { id: 'cus_1045', name: 'Umbrella Health', email: 'finance@umbrella.example' },
  { id: 'cus_1046', name: 'Stark Industries', email: 'invoices@stark.example' },
  { id: 'cus_1047', name: 'Wayne Enterprises', email: 'payables@wayne.example' },
]

/**
 * Your own filtering with shouldFilter={false}: the example renders only the
 * customers whose name or email contains the search, in its own order, from
 * invented data in the page. It sends no request.
 */
export const CommandYourFilter = clientEntry(import.meta.url, function CommandYourFilter(handle: Handle) {
  let search = ''
  let selected = ''

  return () => {
    let query = search.trim().toLowerCase()
    let matches = customers.filter(
      (customer) => customer.name.toLowerCase().includes(query) || customer.email.includes(query),
    )

    return (
      <div mix={[stackStyles, inlineStyles]}>
        <Command label="Search customers" shouldFilter={false} mix={borderedStyles}>
          <CommandInput
            placeholder="Search customers…"
            value={search}
            onValueChange={(next) => {
              search = next
              void handle.update()
            }}
          />
          <CommandList label="Customers">
            <CommandEmpty>No customer matches “{search}”.</CommandEmpty>
            {matches.map((customer) => (
              <CommandItem
                key={customer.id}
                value={customer.id}
                onSelect={() => {
                  selected = customer.name
                  void handle.update()
                }}
              >
                <span mix={customerStyles}>
                  <span>{customer.name}</span>
                  <span mix={emailStyles}>{customer.email}</span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <Selected value={selected} />
      </div>
    )
  }
})

const statuses = ['Draft', 'Sent', 'Paid', 'Overdue', 'Void'] as const

/** Checked items, a disabled one, and a status the selection changes. */
export const CommandChecked = clientEntry(import.meta.url, function CommandChecked(handle: Handle) {
  let status: (typeof statuses)[number] = 'Sent'

  return () => (
    <div mix={[stackStyles, inlineStyles]}>
      <Command label="Invoice status" mix={borderedStyles}>
        <CommandInput placeholder="Change the status…" />
        <CommandList label="Statuses">
          <CommandEmpty>No status found.</CommandEmpty>
          <CommandGroup heading="Status of INV-0042">
            {statuses.map((option) => (
              <CommandItem
                key={option}
                checked={option === status}
                disabled={option === 'Void'}
                onSelect={() => {
                  status = option
                  void handle.update()
                }}
              >
                {option}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      <p role="status" mix={statusStyles}>
        INV-0042 is {status.toLowerCase()}. A void invoice can't change.
      </p>
    </div>
  )
})

/** Right-to-left: the icon, shortcuts and checks sit on the mirrored side. */
export const CommandRtl = clientEntry(import.meta.url, function CommandRtl(handle: Handle) {
  let selected = ''
  let select = (value: string) => {
    selected = value
    void handle.update()
  }

  return () => (
    <div dir="rtl" lang="ar" mix={[stackStyles, inlineStyles]}>
      <Command label="البحث في الأوامر" mix={borderedStyles}>
        <CommandInput placeholder="اكتب أمرًا أو ابحث..." />
        <CommandList label="اقتراحات">
          <CommandEmpty>لم يتم العثور على نتائج.</CommandEmpty>
          <CommandGroup heading="اقتراحات">
            <CommandItem onSelect={select}>
              <CalendarIcon />
              <span>التقويم</span>
            </CommandItem>
            <CommandItem onSelect={select}>
              <SmileIcon />
              <span>البحث عن الرموز التعبيرية</span>
            </CommandItem>
            <CommandItem onSelect={select} checked>
              <CalculatorIcon />
              <span>الآلة الحاسبة</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="الإعدادات">
            <CommandItem onSelect={select}>
              <UserIcon />
              <span>الملف الشخصي</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={select}>
              <CreditCardIcon />
              <span>الفوترة</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <Selected value={selected} />
    </div>
  )
})
