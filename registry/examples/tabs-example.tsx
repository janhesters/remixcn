// RemixCN Tabs examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#remixcn/ui/tabs.tsx'
import type { TabsListVariant } from '#remixcn/ui/tabs.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(4) })
// Beside vertical tabs, the box takes the room left and moves below them when there is too little.
const besideTabs = css({ flex: '1 1 10rem', minWidth: 0 })
const panelBox = css({
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--muted-foreground)',
})

export function WindowIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 5.5h17v13h-17ZM3.5 9h17" />
    </Icon>
  )
}

export function CodeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" />
    </Icon>
  )
}

export function HomeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4Z" />
    </Icon>
  )
}

export function SearchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </Icon>
  )
}

export function SettingsIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  )
}

/** Two tabs, the first selected. */
export const TabsBasic = clientEntry(import.meta.url, function TabsBasic() {
  return () => (
    <Tabs defaultValue="invoices">
      <TabsList aria-label="Documents">
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="quotes">Quotes</TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

/** The line variant underlines the selected tab. */
export const TabsLine = clientEntry(import.meta.url, function TabsLine() {
  return () => (
    <Tabs defaultValue="overview">
      <TabsList variant="line" aria-label="Report">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="aging">Aging</TabsTrigger>
        <TabsTrigger value="exports">Exports</TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

/** Both variants side by side, so their tabs line up. */
export const TabsVariantsAlignment = clientEntry(import.meta.url, function TabsVariantsAlignment() {
  let variants: TabsListVariant[] = ['default', 'line']
  return () => (
    <div mix={rowStyles}>
      {variants.map((variant) => (
        <Tabs key={variant} defaultValue="overview">
          <TabsList variant={variant} aria-label={`Report, ${variant} variant`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="aging">Aging</TabsTrigger>
          </TabsList>
        </Tabs>
      ))}
    </div>
  )
})

/** A disabled tab can't be selected, and the arrow keys skip it. */
export const TabsDisabled = clientEntry(import.meta.url, function TabsDisabled() {
  return () => (
    <div mix={rowStyles}>
      <Tabs defaultValue="invoices">
        <TabsList aria-label="Documents">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="archive" disabled>
            Archive
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs defaultValue="overview">
        <TabsList variant="line" aria-label="Report sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="exports" disabled>
            Exports
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
})

/** Icons before the labels. */
export const TabsWithIcons = clientEntry(import.meta.url, function TabsWithIcons() {
  return () => (
    <Tabs defaultValue="preview">
      <TabsList aria-label="Invoice view">
        <TabsTrigger value="preview">
          <WindowIcon data-icon="inline-start" />
          Preview
        </TabsTrigger>
        <TabsTrigger value="code">
          <CodeIcon data-icon="inline-start" />
          Code
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

/** Icon-only tabs, each named with aria-label. shadcn's example leaves them unnamed. */
export const TabsIconOnly = clientEntry(import.meta.url, function TabsIconOnly() {
  return () => (
    <Tabs defaultValue="home">
      <TabsList aria-label="Navigation">
        <TabsTrigger value="home" aria-label="Home">
          <HomeIcon />
        </TabsTrigger>
        <TabsTrigger value="search" aria-label="Search">
          <SearchIcon />
        </TabsTrigger>
        <TabsTrigger value="settings" aria-label="Settings">
          <SettingsIcon />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

/** Four tabs in a row. */
export const TabsMultiple = clientEntry(import.meta.url, function TabsMultiple() {
  return () => (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Customer">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

const settings = [
  { value: 'account', label: 'Account', text: 'Change your company name, address and tax number.' },
  { value: 'password', label: 'Password', text: 'Update your password to keep your account secure.' },
  { value: 'alerts', label: 'Alerts', text: 'Choose which payment alerts you get, and where.' },
]

function SettingsTabs(
  handle: Handle<{ variant?: TabsListVariant; orientation?: 'horizontal' | 'vertical'; disabled?: string }>,
) {
  return () => {
    let { variant, orientation, disabled } = handle.props
    return (
      <Tabs defaultValue="account" orientation={orientation}>
        <TabsList variant={variant} aria-label="Settings">
          {settings.map((item) => (
            <TabsTrigger key={item.value} value={item.value} disabled={item.value === disabled}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div mix={[panelBox, orientation === 'vertical' ? besideTabs : null]}>
          {settings.map((item) => (
            <TabsContent key={item.value} value={item.value}>
              {item.text}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    )
  }
}

/** Each tab shows its own panel. */
export const TabsWithContent = clientEntry(import.meta.url, function TabsWithContent() {
  return () => <SettingsTabs />
})

/** The line variant with panels. */
export const TabsLineWithContent = clientEntry(import.meta.url, function TabsLineWithContent() {
  return () => <SettingsTabs variant="line" />
})

/** Tabs in a column beside their panels. Up and down move between them. */
export const TabsVertical = clientEntry(import.meta.url, function TabsVertical() {
  return () => <SettingsTabs orientation="vertical" />
})

/**
 * Selects a tab as soon as the arrow keys reach it. The default waits for
 * Enter or Space, which suits panels that take a while to show.
 */
export const TabsAutomatic = clientEntry(import.meta.url, function TabsAutomatic() {
  return () => (
    <Tabs defaultValue="open">
      <TabsList aria-label="Invoice status" activateOnFocus>
        <TabsTrigger value="open">Open</TabsTrigger>
        <TabsTrigger value="paid">Paid</TabsTrigger>
        <TabsTrigger value="overdue">Overdue</TabsTrigger>
      </TabsList>
      <div mix={panelBox}>
        <TabsContent value="open">12 open invoices, 4,830.00 EUR in total.</TabsContent>
        <TabsContent value="paid">38 invoices paid this month.</TabsContent>
        <TabsContent value="overdue">3 invoices are overdue.</TabsContent>
      </div>
    </Tabs>
  )
})

const toolbarStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(4) })
const actionsStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(2),
  marginInlineStart: 'auto',
  maxWidth: '100%',
})
const searchStyles = css({
  flex: '1 1 11rem',
  width: '11rem',
  minWidth: 0,
  minHeight: space(9),
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
})

/** Tabs beside a search field and a button. The tabs stay one tab stop. */
export const TabsWithInputAndButton = clientEntry(import.meta.url, function TabsWithInputAndButton() {
  return () => (
    <Tabs defaultValue="overview">
      <div mix={toolbarStyles}>
        <TabsList aria-label="Customers">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <div mix={actionsStyles}>
          <input type="search" aria-label="Search customers" placeholder="Search…" mix={searchStyles} />
          <Button>New customer</Button>
        </div>
      </div>
      <div mix={panelBox}>
        <TabsContent value="overview">48 customers, 6 added this month.</TabsContent>
        <TabsContent value="activity">Acme Ltd paid INV-0042 today.</TabsContent>
      </div>
    </Tabs>
  )
})
