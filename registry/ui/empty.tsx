// RemixCN Empty: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type EmptyMediaVariant = 'default' | 'icon'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface EmptyMediaProps extends Props<'div'> {
  /** default holds an image or avatars as they are; icon puts an icon on a muted tile. */
  variant?: EmptyMediaVariant
}

export interface EmptyTitleProps extends Props<'div'> {
  /** Renders the title as a native heading, such as an h2, so it joins the document outline. */
  level?: HeadingLevel
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const emptyRule = css({
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(4),
  width: '100%',
  minWidth: 0,
  // shadcn pads 3rem. The padding shrinks with the container, so a narrow screen keeps room for the text.
  padding: `clamp(${space(4)}, 8%, ${space(12)})`,
  // Dashed and ready to show: give it a border width to draw it.
  borderWidth: 0,
  borderStyle: 'dashed',
  borderColor: 'var(--border)',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'center',
  textWrap: 'balance',
})

/** Shows that there is nothing here yet, and what to do about it. */
export function Empty(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="empty" {...props} mix={[emptyRule, mix]} />
  }
}

const headerRule = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: space(2),
  maxWidth: 'min(100%, 24rem)',
})

/** Holds the media, the title and the description. */
export function EmptyHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="empty-header" {...props} mix={[headerRule, mix]} />
  }
}

const mediaRule = css({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  marginBlockEnd: space(2),
  '& svg': { flexShrink: 0, pointerEvents: 'none' },
  '&[data-variant="icon"]': {
    width: space(10),
    height: space(10),
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    '& svg': { width: '1.5rem', height: '1.5rem' },
    // Forced colors drop the tile's background, so a border keeps its shape.
    '@media (forced-colors: active)': { border: '1px solid' },
  },
})

/** An icon, an image or avatars above the title. It keeps shadcn's data-slot="empty-icon". */
export function EmptyMedia(handle: Handle<EmptyMediaProps>) {
  return () => {
    let { variant = 'default', mix, ...props } = handle.props

    return <div data-slot="empty-icon" data-variant={variant} {...props} mix={[mediaRule, mix]} />
  }
}

const titleRule = css({
  margin: 0,
  fontSize: 'var(--text-lg)',
  lineHeight: 'var(--text-lg--line-height)',
  fontWeight: 500,
  letterSpacing: '-0.025em',
  overflowWrap: 'anywhere',
})

/** Says what is empty. It is a div, as in shadcn, unless you give it a heading level. */
export function EmptyTitle(handle: Handle<EmptyTitleProps>) {
  return () => {
    let { level, mix, ...props } = handle.props
    let Tag = (level ? `h${level}` : 'div') as 'div'

    return <Tag data-slot="empty-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.625,
  overflowWrap: 'anywhere',
  '& > a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '4px' },
  '& > a:hover': { color: 'var(--primary)' },
})

/** Says why it is empty or what comes next. It may hold links. */
export function EmptyDescription(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="empty-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const contentRule = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: space(4),
  width: '100%',
  maxWidth: 'min(100%, 24rem)',
  minWidth: 0,
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  textWrap: 'balance',
})

/** Holds the actions, such as a button or a search field. */
export function EmptyContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="empty-content" {...props} mix={[contentRule, mix]} />
  }
}
