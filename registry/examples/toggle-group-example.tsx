// RemixCN Toggle Group examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Toggle Group examples, after shadcn's toggle-group-example.tsx. A group
// needs the browser to change state and to move focus with the arrow keys,
// so each example is a client entry.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl, mergeStyles } from '#remixcn/lib/styles.ts'
import { ToggleGroup, ToggleGroupItem, toggleGroupChangeType } from '#remixcn/ui/toggle-group.tsx'

// Layout for the examples, the way an app would lay out its own forms. The
// controls bring their own look; these rules only place labels and text.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'sm') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  // Long words may break, so large text still fits a narrow screen.
  description: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }),
  status: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)' }),
  list: css({ ...text('sm'), margin: 0, paddingInlineStart: space(5), display: 'grid', gap: space(1) }),
}

/** Three lines of text, the middle one aligned to the start, the center or the end. */
function AlignIcon(handle: Handle<IconProps & { side: 'start' | 'center' | 'end' }>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M4 6h16M4 18h16" />
      <path d={{ start: 'M4 12h10', center: 'M7 12h10', end: 'M10 12h10' }[handle.props.side]} />
    </Icon>
  )
}

function BoldIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </Icon>
  )
}

function ItalicIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M11 5h7M6 19h7M14.5 5l-5 14" />
    </Icon>
  )
}

function UnderlineIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />
    </Icon>
  )
}

export const ToggleGroupBasic = clientEntry(import.meta.url, function ToggleGroupBasic() {
  return () => (
    <ToggleGroup multiple spacing={1} defaultValue={['bold']} aria-label="Text formatting">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <ItalicIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <UnderlineIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
})

export const ToggleGroupOutline = clientEntry(import.meta.url, function ToggleGroupOutline() {
  return () => (
    <ToggleGroup variant="outline" defaultValue={['all']} aria-label="Calls">
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="missed">Missed</ToggleGroupItem>
    </ToggleGroup>
  )
})

export const ToggleGroupSizes = clientEntry(import.meta.url, function ToggleGroupSizes() {
  return () => (
    <div mix={styles.stack}>
      {(['sm', 'default'] as const).map((size) => (
        <ToggleGroup
          key={size}
          size={size}
          variant="outline"
          defaultValue={['top']}
          aria-label={`Position, ${size} size`}
        >
          {['Top', 'Bottom', 'Left', 'Right'].map((side) => (
            <ToggleGroupItem key={side} value={side.toLowerCase()}>
              {side}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ))}
    </div>
  )
})

// Start and end swap sides in right-to-left text, so their icons mirror.
const mirrored = css(mergeStyles({ display: 'inline-flex' }, mirrorInRtl))

/** Spacing 0 joins the items into one bar, with logical corners that also fit right-to-left text. */
export const ToggleGroupJoined = clientEntry(
  import.meta.url,
  function ToggleGroupJoined(handle: Handle<{ label: string }>) {
    return () => (
      <ToggleGroup variant="outline" spacing={0} defaultValue={['start']} aria-label={handle.props.label}>
        <ToggleGroupItem value="start" aria-label="Align to the start">
          <span mix={mirrored}>
            <AlignIcon side="start" />
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align to the center">
          <AlignIcon side="center" />
        </ToggleGroupItem>
        <ToggleGroupItem value="end" aria-label="Align to the end">
          <span mix={mirrored}>
            <AlignIcon side="end" />
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    )
  },
)

export const ToggleGroupVertical = clientEntry(import.meta.url, function ToggleGroupVertical() {
  return () => (
    <ToggleGroup
      multiple
      orientation="vertical"
      spacing={1}
      variant="outline"
      defaultValue={['italic']}
      aria-label="Text style"
    >
      <ToggleGroupItem value="bold">
        <BoldIcon />
        Bold
      </ToggleGroupItem>
      <ToggleGroupItem value="italic">
        <ItalicIcon />
        Italic
      </ToggleGroupItem>
      <ToggleGroupItem value="underline">
        <UnderlineIcon />
        Underline
      </ToggleGroupItem>
    </ToggleGroup>
  )
})

export const ToggleGroupDisabled = clientEntry(import.meta.url, function ToggleGroupDisabled() {
  return () => (
    <div mix={styles.stack}>
      <ToggleGroup
        disabled
        variant="outline"
        defaultValue={['week']}
        aria-label="Date range"
        aria-describedby="date-range-hint"
      >
        <ToggleGroupItem value="today">Today</ToggleGroupItem>
        <ToggleGroupItem value="week">This week</ToggleGroupItem>
        <ToggleGroupItem value="month">This month</ToggleGroupItem>
      </ToggleGroup>
      <p id="date-range-hint" mix={styles.description}>
        Disabled while the report loads.
      </p>
    </div>
  )
})

type Filter = 'all' | 'open' | 'paid' | 'overdue'

const invoices: Array<{ number: string; status: Exclude<Filter, 'all'> }> = [
  { number: 'INV-0041', status: 'paid' },
  { number: 'INV-0042', status: 'open' },
  { number: 'INV-0043', status: 'overdue' },
  { number: 'INV-0044', status: 'open' },
]

/** A filter whose list changes with the pressed item, so the result shows the selection too. */
export const ToggleGroupFilter = clientEntry(import.meta.url, function ToggleGroupFilter(handle: Handle) {
  let filter: Filter = 'all'

  return () => {
    let shown = invoices.filter((invoice) => filter === 'all' || invoice.status === filter)

    return (
      <div mix={styles.stack}>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[filter]}
          aria-label="Invoice status"
          aria-controls="invoice-list"
          mix={on(toggleGroupChangeType, (event) => {
            // A filter always has a value: releasing the pressed item shows all again.
            filter = (event.value[0] as Filter | undefined) ?? 'all'
            void handle.update()
          })}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="paid">Paid</ToggleGroupItem>
          <ToggleGroupItem value="overdue">Overdue</ToggleGroupItem>
        </ToggleGroup>
        <ul id="invoice-list" mix={styles.list}>
          {shown.map((invoice) => (
            <li key={invoice.number}>
              {invoice.number}, {invoice.status}
            </li>
          ))}
        </ul>
        <p role="status" mix={styles.status}>
          Showing {shown.length} of {invoices.length} invoices
        </p>
      </div>
    )
  }
})
