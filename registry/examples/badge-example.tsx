// RemixCN Badge examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, CircleAlertIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl } from '#remixcn/lib/styles.ts'
import { Badge, badgeVariantNames, badgeVariants } from '#remixcn/ui/badge.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

export function ArrowUpRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </Icon>
  )
}

const label = (variant: string) => variant[0].toUpperCase() + variant.slice(1)

/** Every variant. */
export function BadgeVariants() {
  return () => (
    <div mix={rowStyles}>
      {badgeVariantNames.map((variant) => (
        <Badge key={variant} variant={variant}>
          {label(variant)}
        </Badge>
      ))}
    </div>
  )
}

/** Icons before or after the text. data-icon tightens the padding on that side. */
export function BadgeWithIcons() {
  return () => (
    <div mix={rowStyles}>
      <Badge variant="secondary">
        <CheckIcon data-icon="inline-start" />
        Paid
      </Badge>
      <Badge variant="destructive">
        <CircleAlertIcon data-icon="inline-start" />
        Overdue
      </Badge>
      <Badge variant="outline">
        Exported
        <CheckIcon data-icon="inline-end" />
      </Badge>
    </div>
  )
}

/** A decorative spinner next to text that says what is pending. */
export function BadgeWithSpinner() {
  return () => (
    <div mix={rowStyles}>
      <Badge variant="secondary">
        <Spinner decorative data-icon="inline-start" />
        Syncing
      </Badge>
      <Badge variant="outline">
        Sending
        <Spinner decorative data-icon="inline-end" />
      </Badge>
    </div>
  )
}

const onwardStyles = css({ '& svg': mirrorInRtl })

/** Native links with badgeVariants(). Only links react to the pointer. */
export function BadgeAsLink() {
  return () => (
    <div mix={rowStyles}>
      <a href="#overdue" mix={[badgeVariants({ variant: 'destructive' }), onwardStyles]}>
        3 overdue
        <ArrowUpRightIcon data-icon="inline-end" />
      </a>
      <a href="#drafts" mix={badgeVariants({ variant: 'outline' })}>
        Drafts
      </a>
      <a href="#terms" mix={badgeVariants({ variant: 'link' })}>
        Payment terms
      </a>
    </div>
  )
}

/** A badge never grows past its container: long text wraps instead of being cut off. */
export function BadgeLongText() {
  return () => (
    <div mix={rowStyles}>
      <Badge variant="secondary">Waiting for the customer to confirm the new billing address</Badge>
    </div>
  )
}

/** aria-invalid marks a badge in red, such as a field summary with an error. */
export function BadgeInvalid() {
  return () => (
    <div mix={rowStyles}>
      <Badge variant="outline" aria-invalid="true">
        Missing tax ID
      </Badge>
    </div>
  )
}

const colors = [
  { name: 'Blue', background: 'oklch(0.49 0.2 262)' },
  { name: 'Green', background: 'oklch(0.45 0.12 150)' },
  { name: 'Purple', background: 'oklch(0.5 0.22 300)' },
]

/** Your own colors with a css() you pass with mix. */
export function BadgeCustomColors() {
  return () => (
    <div mix={rowStyles}>
      {colors.map(({ name, background }) => (
        <Badge key={name} mix={css({ backgroundColor: background, color: 'oklch(0.985 0 0)' })}>
          {name}
        </Badge>
      ))}
    </div>
  )
}
