// RemixCN Spinner examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Badge } from '#remixcn/ui/badge.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(4) })
const sizes = [
  { name: 'small', style: css({ width: '0.75rem', height: '0.75rem' }) },
  { name: 'default', style: undefined },
  { name: 'large', style: css({ width: '1.5rem', height: '1.5rem' }) },
  { name: 'extra large', style: css({ width: '2rem', height: '2rem' }) },
]
const fieldStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  width: 'min(100%, 20rem)',
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  '&:has(input:focus-visible)': { outline: '2px solid var(--ring)', outlineOffset: '2px' },
  '& input': {
    flex: '1 1 0%',
    width: '100%',
    minWidth: 0,
    minHeight: space(9),
    border: 0,
    background: 'none',
    outline: 'none',
  },
  '& svg': { color: 'var(--muted-foreground)' },
})
const brandStyles = css({ color: 'light-dark(oklch(0.49 0.2 262), oklch(0.75 0.13 255))' })

/** Named spinners at four sizes. Size one with a css() you pass with mix. */
export function SpinnerSizes() {
  return () => (
    <div mix={rowStyles}>
      {sizes.map(({ name, style }) => (
        <Spinner key={name} label={`Loading, ${name}`} mix={style} />
      ))}
      <Spinner label="Loading, brand color" mix={brandStyles} />
    </div>
  )
}

/** In a button, the spinner is decorative: the button's text says what is pending. */
export function SpinnerInButtons() {
  return () => (
    <div mix={rowStyles}>
      <Button disabled>
        <Spinner decorative data-icon="inline-start" />
        Sending…
      </Button>
      <Button variant="outline" disabled>
        <Spinner decorative data-icon="inline-start" />
        Saving draft…
      </Button>
      <Button variant="secondary" size="sm" disabled>
        Exporting…
        <Spinner decorative data-icon="inline-end" />
      </Button>
    </div>
  )
}

/** In a badge, next to the text that says what is pending. */
export function SpinnerInBadges() {
  return () => (
    <div mix={rowStyles}>
      <Badge>
        <Spinner decorative data-icon="inline-start" />
        Syncing
      </Badge>
      <Badge variant="secondary">
        <Spinner decorative data-icon="inline-start" />
        Updating
      </Badge>
      <Badge variant="outline">
        <Spinner decorative data-icon="inline-start" />
        Queued
      </Badge>
    </div>
  )
}

/** In a search field, a named spinner says that results load. */
export function SpinnerInField(handle: Handle) {
  return () => (
    <label mix={fieldStyles}>
      <input id={`${handle.id}-search`} type="search" name="q" aria-label="Search customers" defaultValue="Acme" />
      <Spinner label="Searching customers" />
    </label>
  )
}
