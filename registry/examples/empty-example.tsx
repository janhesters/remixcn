// RemixCN Empty examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Avatar, AvatarFallback, AvatarGroup } from '#remixcn/ui/avatar.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import { Card } from '#remixcn/ui/card.tsx'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#remixcn/ui/empty.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: space(2) })
const mutedStyles = css({ backgroundColor: 'var(--muted)' })
const borderStyles = css({ borderWidth: '1px' })
const searchStyles = css({
  width: '100%',
  minHeight: space(9),
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--background)',
})
const hiddenStyles = css(visuallyHidden)

export function InboxIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" />
      <path d="M6 5h12l2.5 8.5V19h-17v-5.5L6 5Z" />
    </Icon>
  )
}

export function FolderIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 6.5v12h17V8.5h-8l-2-2h-7Z" />
    </Icon>
  )
}

/** An icon on a muted tile, a title, a description, and the actions. */
export function EmptyBasic() {
  return () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle level={3}>No invoices yet</EmptyTitle>
        <EmptyDescription>
          Create your first invoice, or <a href="#import">import them from a spreadsheet</a>.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div mix={rowStyles}>
          <Button>New invoice</Button>
          <a href="#import" mix={buttonVariants({ variant: 'outline' })}>
            Import
          </a>
        </div>
      </EmptyContent>
    </Empty>
  )
}

/** A muted background and a dashed border, each from a css() you pass with mix. */
export function EmptyOutlineAndBackground() {
  return () => (
    <div style={{ display: 'grid', gap: space(4) }}>
      <Empty mix={borderStyles}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderIcon />
          </EmptyMedia>
          <EmptyTitle level={3}>No files</EmptyTitle>
          <EmptyDescription>Attach a contract or a purchase order to this customer.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm">
            Upload a file
          </Button>
        </EmptyContent>
      </Empty>
      <Empty mix={mutedStyles}>
        <EmptyHeader>
          <EmptyTitle level={3}>No reminders scheduled</EmptyTitle>
          <EmptyDescription>Reminders appear here once an invoice is overdue.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

/** An avatar or a group of avatars as the media, such as for a team without members. */
export function EmptyWithAvatars() {
  return () => (
    <Empty mix={borderStyles}>
      <EmptyHeader>
        <EmptyMedia>
          <AvatarGroup>
            {['AL', 'GH', 'KJ'].map((initials) => (
              <Avatar key={initials} size="lg">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        </EmptyMedia>
        <EmptyTitle level={3}>No one is on the billing team</EmptyTitle>
        <EmptyDescription>Invite people to send invoices and see payments.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Invite people</Button>
      </EmptyContent>
    </Empty>
  )
}

/** A search field as the action, for a search without results. */
export function EmptyWithSearch(handle: Handle) {
  return () => {
    let search = `${handle.id}-search`

    return (
      <Empty mix={borderStyles}>
        <EmptyHeader>
          <EmptyTitle level={3}>No customers match “Initech”</EmptyTitle>
          <EmptyDescription>Check the spelling, or search by email instead.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <form role="search" action="#customers" style={{ width: '100%' }}>
            <label for={search} mix={hiddenStyles}>
              Search customers
            </label>
            <input id={search} name="q" type="search" defaultValue="Initech" mix={searchStyles} />
          </form>
        </EmptyContent>
      </Empty>
    )
  }
}

/** A pending state: a named spinner says what loads. */
export function EmptyLoading() {
  return () => (
    <Card>
      <Empty aria-busy="true">
        <EmptyHeader>
          <EmptyMedia>
            <Spinner label="Loading payments" />
          </EmptyMedia>
          <EmptyTitle level={3}>Loading payments</EmptyTitle>
          <EmptyDescription>This takes a few seconds for a year of payments.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Card>
  )
}
