// RemixCN Breadcrumb: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { ChevronRightIcon, EllipsisIcon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, mirrorInRtl, transition } from '#remixcn/lib/styles.ts'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

/**
 * A navigation landmark for the trail to the current page. It is named
 * "breadcrumb", as in shadcn; pass aria-label to name it otherwise.
 */
export function Breadcrumb(handle: Handle<Props<'nav'>>) {
  return () => <nav aria-label="breadcrumb" data-slot="breadcrumb" {...handle.props} />
}

const listRule = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(1.5),
  margin: 0,
  padding: 0,
  listStyle: 'none',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'break-word',
  '@media (min-width: 40rem)': { gap: space(2.5) },
})

/** The ordered list of levels, which wraps on a narrow screen. */
export function BreadcrumbList(handle: Handle<Props<'ol'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <ol data-slot="breadcrumb-list" {...props} mix={[listRule, mix]} />
  }
}

const itemRule = css({ display: 'inline-flex', alignItems: 'center', gap: space(1.5), minWidth: 0 })

/** One level of the trail. */
export function BreadcrumbItem(handle: Handle<Props<'li'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <li data-slot="breadcrumb-item" {...props} mix={[itemRule, mix]} />
  }
}

const linkRule = css(
  mergeStyles(
    {
      margin: 0,
      padding: 0,
      border: 0,
      background: 'none',
      color: 'inherit',
      font: 'inherit',
      textDecoration: 'none',
      cursor: 'pointer',
      '&:hover': { color: 'var(--foreground)', textDecoration: 'underline', textUnderlineOffset: '3px' },
    },
    transition('color'),
  ),
)

/**
 * Returns the mixins that give any element a breadcrumb link's look and
 * data-slot, such as a button that opens a menu of the collapsed levels.
 */
export function breadcrumbLinkVariants(): MixValue {
  return [linkRule, attrs({ 'data-slot': 'breadcrumb-link' })]
}

/** A native link to a level above the current page. */
export function BreadcrumbLink(handle: Handle<Props<'a'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <a data-slot="breadcrumb-link" {...props} mix={[breadcrumbLinkVariants(), mix]} />
  }
}

const pageRule = css({ color: 'var(--foreground)', fontWeight: 400 })

/**
 * The current page, the last level. As in shadcn, it is a disabled link with
 * aria-current="page", so a screen reader announces it as the current page.
 */
export function BreadcrumbPage(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return (
      <span
        data-slot="breadcrumb-page"
        role="link"
        aria-disabled="true"
        aria-current="page"
        {...props}
        mix={[pageRule, mix]}
      />
    )
  }
}

const separatorRule = css({
  display: 'inline-flex',
  alignItems: 'center',
  '& svg': { width: '0.875rem', height: '0.875rem' },
})
// The default chevron points onward, so it mirrors in right-to-left text.
const chevronRule = css(mergeStyles({ display: 'inline-flex' }, mirrorInRtl))

/** Draws the line between two levels, a chevron by default. Assistive technology skips it. */
export function BreadcrumbSeparator(handle: Handle<Props<'li'>>) {
  return () => {
    let { children, mix, ...props } = handle.props

    return (
      <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" {...props} mix={[separatorRule, mix]}>
        {children ?? (
          <span mix={chevronRule}>
            <ChevronRightIcon />
          </span>
        )}
      </li>
    )
  }
}

const ellipsisRule = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: space(5),
  height: space(5),
  '& > svg': { width: '1rem', height: '1rem' },
})

/**
 * Three dots for collapsed levels. Assistive technology skips it, so put it
 * in a control that names what it does, such as a button labelled "Show the
 * hidden levels".
 */
export function BreadcrumbEllipsis(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return (
      <span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" {...props} mix={[ellipsisRule, mix]}>
        <EllipsisIcon />
      </span>
    )
  }
}
