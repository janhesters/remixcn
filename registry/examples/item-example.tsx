// RemixCN Item examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { ChevronRightIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl } from '#remixcn/lib/styles.ts'
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { Badge } from '#remixcn/ui/badge.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  itemSizes,
  itemVariantNames,
  itemVariants,
} from '#remixcn/ui/item.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const onwardStyles = css({ '& svg': mirrorInRtl })

export function FileIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M6 3.5h8l4 4V20.5H6Z" />
      <path d="M13.5 3.5v4.5H18" />
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

const label = (value: string) => value[0].toUpperCase() + value.slice(1)

/** Every variant at every size. */
export function ItemVariantsAndSizes() {
  return () => (
    <div mix={stackStyles}>
      {itemVariantNames.map((variant) =>
        itemSizes.map((size) => (
          <Item key={`${variant}-${size}`} variant={variant} size={size}>
            <ItemContent>
              <ItemTitle>
                {label(variant)}, {size === 'default' ? 'default size' : size}
              </ItemTitle>
              <ItemDescription>Acme Labs has 3 open invoices.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="outline">
                Remind
              </Button>
            </ItemActions>
          </Item>
        )),
      )}
    </div>
  )
}

/** An icon, an avatar or an image as the media. */
export function ItemWithMedia() {
  return () => (
    <div mix={stackStyles}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <BellIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Reminders are on</ItemTitle>
          <ItemDescription>Customers get a reminder 3 days after the due date.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Change
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Grace Hopper</ItemTitle>
          <ItemDescription>grace.hopper@globex.example</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="secondary">Admin</Badge>
        </ItemActions>
      </Item>
      <Item variant="muted">
        <ItemMedia variant="image">
          <img src={thumbnail} alt="" width="40" height="40" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Q3 revenue report</ItemTitle>
          <ItemDescription>PDF, 2 pages</ItemDescription>
        </ItemContent>
      </Item>
    </div>
  )
}

const thumbnail = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d4d4d4"/><path d="M0 32 10 26 20 29 30 16 40 20V40H0Z" fill="#525252"/></svg>',
)}`

const customers = [
  { name: 'Acme Labs', detail: '3 open invoices', href: '#acme' },
  { name: 'Globex', detail: '1 open invoice', href: '#globex' },
  { name: 'Initech', detail: 'Paid up', href: '#initech' },
]

/**
 * A group is a list. Each Item is a list item. A whole row that is a link
 * sits in its own list item, and itemVariants() gives the link the look.
 */
export function ItemGroupOfLinks() {
  return () => (
    <ItemGroup aria-label="Customers">
      {customers.map((customer, index) => [
        index > 0 ? <ItemSeparator key={`${customer.href}-separator`} /> : null,
        <div key={customer.href} role="listitem">
          <a href={customer.href} mix={[itemVariants({ size: 'sm' }), onwardStyles]}>
            <ItemContent>
              <ItemTitle>{customer.name}</ItemTitle>
              <ItemDescription>{customer.detail}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon />
            </ItemActions>
          </a>
        </div>,
      ])}
    </ItemGroup>
  )
}

const uploads = [
  { name: 'invoices-2026.csv', size: '48 KB' },
  { name: 'contract-acme.pdf', size: '1.2 MB' },
]

/** Items in a group, each with actions. */
export function ItemGroupWithActions() {
  return () => (
    <ItemGroup aria-label="Attachments">
      {uploads.map((upload) => (
        <Item key={upload.name} variant="outline" size="sm">
          <ItemMedia variant="icon">
            <FileIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{upload.name}</ItemTitle>
          </ItemContent>
          <ItemContent>
            <ItemDescription>{upload.size}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="xs" variant="ghost" aria-label={`Remove ${upload.name}`}>
              Remove
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

/** A full-width header and footer around the content. */
export function ItemWithHeaderAndFooter() {
  return () => (
    <Item variant="outline">
      <ItemHeader>
        <Badge variant="outline">Overdue</Badge>
        <span>Due 4 November</span>
      </ItemHeader>
      <ItemContent>
        <ItemTitle level={3}>INV-0042, Acme Labs</ItemTitle>
        <ItemDescription>
          Design work and hosting for October. <a href="#inv-0042">Open the invoice</a>.
        </ItemDescription>
      </ItemContent>
      <ItemFooter>
        <span>€1,200.00</span>
        <Button size="sm" variant="outline">
          Remind
        </Button>
      </ItemFooter>
    </Item>
  )
}
