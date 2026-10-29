// RemixCN Pagination examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import { Label } from '#remixcn/ui/label.tsx'
import { NativeSelect, NativeSelectOption } from '#remixcn/ui/native-select.tsx'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#remixcn/ui/pagination.tsx'

// Pagination needs no client entry: its links work as plain HTML. The
// examples link to ?page=N on the current URL. Your app builds its own URLs,
// and its routes decide what each page shows.

export interface PageProps {
  /** The current page, from 1. */
  page?: number
  /** The number of pages. */
  pages?: number
  /** Builds the URL of a page. */
  href?: (page: number) => string
}

const pageHref = (page: number) => `?page=${page}`

/** Previous, three pages around the current one, an ellipsis and Next. Previous and Next turn off at the ends. */
export function PaginationBasic(handle: Handle<PageProps>) {
  return () => {
    let { page = 2, pages = 10, href = pageHref } = handle.props
    let first = Math.max(1, Math.min(page - 1, pages - 2))
    let shown = [first, first + 1, first + 2].filter((number) => number <= pages)

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href={href(page - 1)} disabled={page <= 1} />
          </PaginationItem>
          {shown.map((number) => (
            <PaginationItem key={number}>
              <PaginationLink href={href(number)} isActive={number === page}>
                {number}
              </PaginationLink>
            </PaginationItem>
          ))}
          {shown.at(-1)! < pages ? (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          ) : null}
          <PaginationItem>
            <PaginationNext href={href(page + 1)} disabled={page >= pages} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }
}

/** Page numbers only. */
export function PaginationSimple(handle: Handle<PageProps>) {
  return () => {
    let { page = 2, pages = 5, href = pageHref } = handle.props
    let numbers = Array.from({ length: pages }, (_, index) => index + 1)

    return (
      <Pagination aria-label="Report pages">
        <PaginationContent>
          {numbers.map((number) => (
            <PaginationItem key={number}>
              <PaginationLink href={href(number)} isActive={number === page}>
                {number}
              </PaginationLink>
            </PaginationItem>
          ))}
        </PaginationContent>
      </Pagination>
    )
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const barStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space(4),
})
const formStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const selectWidth = css({ width: '5rem' })
const fitStyles = css({ width: 'auto', marginInline: 0 })

/**
 * Rows per page beside Previous and Next. Label and Native Select in a GET
 * form take the place of shadcn's Field and Select, so it works without
 * JavaScript too.
 */
export function PaginationWithRows(handle: Handle<PageProps & { rows?: number }>) {
  return () => {
    let { page = 1, pages = 4, href = pageHref, rows = 25 } = handle.props
    let selectId = `${handle.id}-rows`

    return (
      <div mix={barStyles}>
        <form method="get" mix={formStyles}>
          <Label for={selectId}>Rows per page</Label>
          <NativeSelect id={selectId} name="rows" size="sm" defaultValue={String(rows)} mix={selectWidth}>
            {[10, 25, 50, 100].map((count) => (
              <NativeSelectOption key={count} value={String(count)}>
                {count}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="sm">
            Show
          </Button>
        </form>
        <Pagination aria-label="Rows" mix={fitStyles}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={href(page - 1)} disabled={page <= 1} />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href={href(page + 1)} disabled={page >= pages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    )
  }
}
