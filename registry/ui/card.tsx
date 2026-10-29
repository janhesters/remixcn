// RemixCN Card: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type CardSize = 'default' | 'sm'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface CardProps extends Props<'div'> {
  /** The spacing: 1.5rem around and between the parts, or 1rem when small. */
  size?: CardSize
}

export interface CardTitleProps extends Props<'div'> {
  /** Renders the title as a native heading, such as an h3, so it joins the document outline. */
  level?: HeadingLevel
}

export interface CardEdgeProps extends Props<'div'> {
  /** Draws a line between this part and the content, with the card's spacing on both sides. */
  border?: boolean
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const cardSpacing = 'var(--card-spacing)'

// --card-spacing sets the padding and gaps. The parts read it, so a caller
// can change it on the card, and each part reacts in its own rule.
const cardRule = css({
  '--card-spacing': space(6),
  display: 'flex',
  flexDirection: 'column',
  gap: cardSpacing,
  minWidth: 0,
  paddingBlock: cardSpacing,
  overflow: 'hidden',
  // A border instead of shadcn's ring, so the edge stays visible in forced colors.
  border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--card)',
  color: 'var(--card-foreground)',
  boxShadow: 'var(--shadow-xs)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '&[data-size="sm"]': { '--card-spacing': space(4) },
  // An image that starts the card reaches its top edge.
  '&:has(> img:first-child)': { paddingBlockStart: 0 },
  '& > img': { display: 'block', width: '100%' },
})

/** A surface that groups a title, content and actions about one subject. */
export function Card(handle: Handle<CardProps>) {
  return () => {
    let { size = 'default', mix, ...props } = handle.props

    return <div data-slot="card" data-size={size} {...props} mix={[cardRule, mix]} />
  }
}

const headerRule = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridAutoRows: 'min-content',
  alignItems: 'start',
  gap: space(1),
  paddingInline: cardSpacing,
  containerType: 'inline-size',
  containerName: 'card-header',
  '&:has([data-slot="card-action"])': { gridTemplateColumns: 'minmax(0, 1fr) auto' },
  '&:has([data-slot="card-description"])': { gridTemplateRows: 'auto auto' },
  '&[data-border]': { paddingBlockEnd: cardSpacing, borderBlockEnd: '1px solid var(--border)' },
})

/** Holds the title, the description and an action. */
export function CardHeader(handle: Handle<CardEdgeProps>) {
  return () => {
    let { border, mix, ...props } = handle.props

    return <div data-slot="card-header" data-border={border ? '' : undefined} {...props} mix={[headerRule, mix]} />
  }
}

const titleRule = css({
  margin: 0,
  fontSize: 'var(--text-base)',
  lineHeight: 1.5,
  fontWeight: 500,
  overflowWrap: 'anywhere',
  ':where([data-slot="card"][data-size="sm"]) &': {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
  },
})

/** The card's title. It is a div, as in shadcn, unless you give it a heading level. */
export function CardTitle(handle: Handle<CardTitleProps>) {
  return () => {
    let { level, mix, ...props } = handle.props
    let Tag = (level ? `h${level}` : 'div') as 'div'

    return <Tag data-slot="card-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'anywhere',
})

/** A line of text under the title. */
export function CardDescription(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="card-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const actionRule = css({ gridColumn: '2', gridRow: '1 / span 2', alignSelf: 'start', justifySelf: 'end' })

/** Holds a button or link in the header's end corner, beside the title and description. */
export function CardAction(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="card-action" {...props} mix={[actionRule, mix]} />
  }
}

const contentRule = css({ paddingInline: cardSpacing })

/** The card's main content. */
export function CardContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="card-content" {...props} mix={[contentRule, mix]} />
  }
}

const footerRule = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(2),
  paddingInline: cardSpacing,
  '&[data-border]': { paddingBlockStart: cardSpacing, borderBlockStart: '1px solid var(--border)' },
})

/** Holds the card's actions or a summary, after the content. */
export function CardFooter(handle: Handle<CardEdgeProps>) {
  return () => {
    let { border, mix, ...props } = handle.props

    return <div data-slot="card-footer" data-border={border ? '' : undefined} {...props} mix={[footerRule, mix]} />
  }
}
