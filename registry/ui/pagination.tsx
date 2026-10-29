// RemixCN Pagination: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl, visuallyHidden } from '#remixcn/lib/styles.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import type { ButtonSize } from '#remixcn/ui/button.tsx'

// Pagination is native navigation: links with the caller's URLs. It needs no
// JavaScript, fetches nothing and owns no routing.

export type PaginationLinkProps = Omit<Props<'a'>, 'href' | 'role'> & {
  /** Where the link goes, exactly as you write it, query and hash included. */
  href?: string
  role?: 'link'
  /** Marks the link to the current page with aria-current="page" and the outline look. */
  isActive?: boolean
  /** A Button size. Page numbers are square icon buttons by default. */
  size?: ButtonSize
  /**
   * Turns the link off, such as Previous on the first page. It renders no
   * href, so there is nothing to follow, and role="link" with
   * aria-disabled="true", so assistive technology still finds it.
   */
  disabled?: boolean
}

export type PaginationPreviousProps = Omit<PaginationLinkProps, 'children'> & {
  /** The visible text. Without it, the link shows "Previous" and is named "Go to previous page". */
  text?: string
}

export type PaginationNextProps = Omit<PaginationLinkProps, 'children'> & {
  /** The visible text. Without it, the link shows "Next" and is named "Go to next page". */
  text?: string
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const paginationStyles = css({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  marginInline: 'auto',
})

/** A nav landmark named "Pagination". Give it your own aria-label when a page has several. */
export function Pagination(handle: Handle<Props<'nav'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <nav data-slot="pagination" aria-label="Pagination" {...props} mix={[paginationStyles, mix]} />
  }
}

const contentStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1),
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

/** The list of pages. */
export function PaginationContent(handle: Handle<Props<'ul'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <ul data-slot="pagination-content" {...props} mix={[contentStyles, mix]} />
  }
}

/** One entry in the list. */
export function PaginationItem(handle: Handle<Props<'li'>>) {
  return () => <li data-slot="pagination-item" {...handle.props} />
}

/**
 * A native link that looks like a ghost button, or an outline button for the
 * current page. Your href, query and hash stay as you wrote them.
 */
export function PaginationLink(handle: Handle<PaginationLinkProps>) {
  return () => {
    let { isActive = false, size = 'icon', disabled = false, href, mix, ...props } = handle.props

    return (
      <a
        data-slot="pagination-link"
        {...props}
        href={disabled ? undefined : href}
        role={disabled ? 'link' : props.role}
        aria-disabled={disabled ? 'true' : props['aria-disabled']}
        aria-current={isActive ? 'page' : props['aria-current']}
        data-active={isActive ? '' : undefined}
        mix={[buttonVariants({ variant: isActive ? 'outline' : 'ghost', size }), mix]}
      />
    )
  }
}

// The arrow points the way the pages go, so it mirrors in right-to-left text.
const directionStyles = css({ '& svg': mirrorInRtl })

// shadcn hides the text below 640px. Visually hidden text keeps naming the link there.
const textStyles = css({ '@media (max-width: 39.99rem)': visuallyHidden })

/** The link to the previous page, with a back arrow. */
export function PaginationPrevious(handle: Handle<PaginationPreviousProps>) {
  return () => {
    let { text, mix, ...props } = handle.props

    return (
      <PaginationLink
        aria-label={text === undefined ? 'Go to previous page' : undefined}
        size="default"
        {...props}
        mix={[directionStyles, mix]}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        <span data-slot="pagination-previous-text" mix={textStyles}>
          {text ?? 'Previous'}
        </span>
      </PaginationLink>
    )
  }
}

/** The link to the next page, with an onward arrow. */
export function PaginationNext(handle: Handle<PaginationNextProps>) {
  return () => {
    let { text, mix, ...props } = handle.props

    return (
      <PaginationLink
        aria-label={text === undefined ? 'Go to next page' : undefined}
        size="default"
        {...props}
        mix={[directionStyles, mix]}
      >
        <span data-slot="pagination-next-text" mix={textStyles}>
          {text ?? 'Next'}
        </span>
        <ChevronRightIcon data-icon="inline-end" />
      </PaginationLink>
    )
  }
}

const ellipsisStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: space(9),
  height: space(9),
  '& svg': { width: '1rem', height: '1rem' },
})

const hiddenText = css(visuallyHidden)

/**
 * Stands for pages left out of the list. Screen readers hear "More pages";
 * shadcn hides the whole part from them, text included.
 */
export function PaginationEllipsis(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return (
      <span data-slot="pagination-ellipsis" {...props} mix={[ellipsisStyles, mix]}>
        <EllipsisIcon />
        <span mix={hiddenText}>More pages</span>
      </span>
    )
  }
}
