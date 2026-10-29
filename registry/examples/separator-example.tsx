// RemixCN Separator examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'

import { Separator } from '#remixcn/ui/separator.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4), ...text })
const headingStyles = css({ margin: 0, fontSize: 'inherit', fontWeight: 500 })
const mutedStyles = css({ margin: 0, color: 'var(--muted-foreground)' })
const rowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(4),
  minHeight: space(5),
  ...text,
})
const menuStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: space(4), ...text })
const entryStyles = css({ display: 'grid', gap: space(1) })
const listStyles = css({ display: 'grid', gap: space(2), ...text })
const pairStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: `0 ${space(4)}`,
  margin: 0,
  '& dd': { margin: 0 },
})

/** A meaningful separator between two sections. Assistive technology announces it. */
export function SeparatorHorizontal() {
  return () => (
    <div mix={stackStyles}>
      <div mix={entryStyles}>
        <h3 mix={headingStyles}>Acme Labs</h3>
        <p mix={mutedStyles}>Customer since March 2024</p>
      </div>
      <Separator />
      <p mix={mutedStyles}>Pays by bank transfer within 14 days. Prefers invoices in English.</p>
    </div>
  )
}

/** Decorative lines between links in a row. */
export function SeparatorVertical() {
  return () => (
    <nav aria-label="Account" mix={rowStyles}>
      <a href="#profile">Profile</a>
      <Separator orientation="vertical" decorative />
      <a href="#billing">Billing</a>
      <Separator orientation="vertical" decorative />
      <a href="#security">Security</a>
    </nav>
  )
}

/** Vertical separators between the entries of a menu row. */
export function SeparatorVerticalMenu() {
  let entries = [
    { title: 'Settings', detail: 'Manage preferences' },
    { title: 'Account', detail: 'Profile and security' },
    { title: 'Help', detail: 'Support and docs' },
  ]

  return () => (
    <div mix={menuStyles}>
      {entries.map((entry, index) => [
        index > 0 ? <Separator key={`${entry.title}-separator`} orientation="vertical" decorative /> : null,
        <div key={entry.title} mix={entryStyles}>
          <span style={{ fontWeight: 500 }}>{entry.title}</span>
          <span mix={mutedStyles}>{entry.detail}</span>
        </div>,
      ])}
    </div>
  )
}

/**
 * Decorative lines between terms and values. A description list holds only
 * its terms and values, so each pair is its own list with a line between.
 */
export function SeparatorInList() {
  let pairs = [
    ['Subtotal', '€1,000.00'],
    ['VAT (20%)', '€200.00'],
    ['Total', '€1,200.00'],
  ]

  return () => (
    <div mix={listStyles}>
      {pairs.map(([term, value], index) => [
        index > 0 ? <Separator key={`${term}-separator`} decorative /> : null,
        <dl key={term} mix={pairStyles}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </dl>,
      ])}
    </div>
  )
}
