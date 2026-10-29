// RemixCN Item: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Separator } from '#remixcn/ui/separator.tsx'
import type { SeparatorProps } from '#remixcn/ui/separator.tsx'

export const itemVariantNames = ['default', 'outline', 'muted'] as const
export const itemSizes = ['default', 'sm', 'xs'] as const

export type ItemVariant = (typeof itemVariantNames)[number]
export type ItemSize = (typeof itemSizes)[number]
export type ItemMediaVariant = 'default' | 'icon' | 'image'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface ItemVariantOptions {
  /** default has no border, outline draws one, and muted fills the row. */
  variant?: ItemVariant
  /** The padding and gaps. */
  size?: ItemSize
}

export interface ItemProps extends Props<'div'>, ItemVariantOptions {}

export interface ItemMediaProps extends Props<'div'> {
  /** default holds content as it is, icon sizes an icon, and image crops an image to a square. */
  variant?: ItemMediaVariant
}

export interface ItemTitleProps extends Props<'div'> {
  /** Renders the title as a native heading, such as an h3, so it joins the document outline. */
  level?: HeadingLevel
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const groupRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(4),
  width: '100%',
  '&:has([data-size="sm"])': { gap: space(2.5) },
  '&:has([data-size="xs"])': { gap: space(2) },
})

/**
 * Lists items: it renders role="list", and each Item inside renders
 * role="listitem". Wrap a link item in an element with role="listitem".
 */
export function ItemGroup(handle: Handle<Props<'div'>, { list: true }>) {
  return () => {
    let { mix, ...props } = handle.props
    handle.context.set({ list: true })

    return <div role="list" data-slot="item-group" {...props} mix={[groupRule, mix]} />
  }
}

/**
 * Draws a line between items. It is decorative, since a list holds only list
 * items; pass decorative={false} outside a group for a separator that
 * assistive technology announces.
 */
export function ItemSeparator(handle: Handle<SeparatorProps>) {
  return () => {
    let { decorative = true, mix, ...props } = handle.props

    return (
      <Separator
        data-slot="item-separator"
        orientation="horizontal"
        decorative={decorative}
        {...props}
        mix={[separatorRule, mix]}
      />
    )
  }
}

const separatorRule = css({ marginBlock: space(2) })

const base: Styles = mergeStyles(
  {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    width: '100%',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    color: 'inherit',
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    textDecoration: 'none',
    '&:where(a):hover': { backgroundColor: 'var(--muted)' },
  },
  transition('color', 'background-color', 'border-color'),
)

const variants: Record<ItemVariant, Styles> = {
  default: {},
  outline: { borderColor: 'var(--border)' },
  muted: { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
}

const sizes: Record<ItemSize, Styles> = {
  default: { gap: space(3.5), paddingInline: space(4), paddingBlock: space(3.5) },
  sm: { gap: space(2.5), paddingInline: space(3), paddingBlock: space(2.5) },
  xs: {
    gap: space(2),
    paddingInline: space(2.5),
    paddingBlock: space(2),
    ':where([data-slot="dropdown-menu-content"]) &': { padding: 0 },
  },
}

const rules = new Map<string, ReturnType<typeof css>>()

function itemRule(variant: ItemVariant, size: ItemSize) {
  let key = `${variant} ${size}`
  let rule = rules.get(key)
  if (!rule) {
    rule = css(mergeStyles(base, variants[variant], sizes[size]))
    rules.set(key, rule)
  }
  return rule
}

/**
 * Returns the mixins that give any element an item's look and its data-slot,
 * data-variant and data-size attributes. Use it on a native link, so the
 * whole row is one link: <a href="/customers/acme" mix={itemVariants()}>.
 */
export function itemVariants({ variant = 'default', size = 'default' }: ItemVariantOptions = {}): MixValue {
  return [itemRule(variant, size), attrs({ 'data-slot': 'item', 'data-variant': variant, 'data-size': size })]
}

/** A row that shows media, a title, a description and actions about one thing. */
export function Item(handle: Handle<ItemProps>) {
  return () => {
    let { variant = 'default', size = 'default', mix, ...props } = handle.props
    let inList = handle.context.get(ItemGroup)?.list === true

    return (
      <div
        role={inList ? 'listitem' : undefined}
        data-slot="item"
        data-variant={variant}
        data-size={size}
        {...props}
        mix={[itemVariants({ variant, size }), mix]}
      />
    )
  }
}

const withDescription = ':where([data-slot="item"]:has([data-slot="item-description"])) > &'
const inSize = <Size extends ItemSize>(size: Size) => `:where([data-slot="item"][data-size="${size}"]) > &` as const

const mediaRule = css({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(2),
  '& svg': { pointerEvents: 'none' },
  [withDescription]: { alignSelf: 'flex-start', translate: '0 0.125rem' },
  '&[data-variant="icon"] svg': { width: '1rem', height: '1rem' },
  '&[data-variant="image"]': {
    width: space(10),
    height: space(10),
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
    '& img': { width: '100%', height: '100%', objectFit: 'cover' },
    [inSize('sm')]: { width: space(8), height: space(8) },
    [inSize('xs')]: { width: space(6), height: space(6) },
  },
})

/** An icon, an image or an avatar at the start of the row. */
export function ItemMedia(handle: Handle<ItemMediaProps>) {
  return () => {
    let { variant = 'default', mix, ...props } = handle.props

    return <div data-slot="item-media" data-variant={variant} {...props} mix={[mediaRule, mix]} />
  }
}

const contentRule = css({
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  gap: space(1),
  // Too narrow a row wraps the content onto a line of its own instead of squeezing it.
  minWidth: 'min(100%, 8rem)',
  [inSize('xs')]: { gap: 0 },
  // A second content part, such as a progress bar, keeps its own width.
  '[data-slot="item-content"] + &': { flex: 'none', minWidth: 0 },
})

/** Holds the title and the description, and takes the room the row has. */
export function ItemContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="item-content" {...props} mix={[contentRule, mix]} />
  }
}

const titleRule = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  width: 'fit-content',
  maxWidth: '100%',
  margin: 0,
  fontSize: 'var(--text-sm)',
  lineHeight: 1.375,
  fontWeight: 500,
  textUnderlineOffset: '4px',
  overflowWrap: 'anywhere',
})

/** The item's title. It is a div, as in shadcn, unless you give it a heading level. */
export function ItemTitle(handle: Handle<ItemTitleProps>) {
  return () => {
    let { level, mix, ...props } = handle.props
    let Tag = (level ? `h${level}` : 'div') as 'div'

    return <Tag data-slot="item-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.5,
  fontWeight: 400,
  textAlign: 'start',
  overflowWrap: 'anywhere',
  [`:where([data-slot="item"][data-size="xs"]) &`]: {
    fontSize: 'var(--text-xs)',
    lineHeight: 'var(--text-xs--line-height)',
  },
  '& > a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '4px' },
  '& > a:hover': { color: 'var(--primary)' },
})

/** A paragraph of detail under the title. */
export function ItemDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <p data-slot="item-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const actionsRule = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

/** Holds buttons or links at the end of the row. */
export function ItemActions(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="item-actions" {...props} mix={[actionsRule, mix]} />
  }
}

const edgeRule = css({
  display: 'flex',
  flexBasis: '100%',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space(2),
})

/** A full-width line above the row's content, such as an image or a label. */
export function ItemHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="item-header" {...props} mix={[edgeRule, mix]} />
  }
}

/** A full-width line below the row's content. */
export function ItemFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="item-footer" {...props} mix={[edgeRule, mix]} />
  }
}
