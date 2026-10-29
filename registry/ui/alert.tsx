// RemixCN Alert: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type AlertVariant = 'default' | 'destructive'
export type AlertLive = 'assertive' | 'polite' | 'off'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface AlertProps extends Props<'div'> {
  /** The look: neutral by default, or red for an error. */
  variant?: AlertVariant
  /**
   * How urgently assistive technology announces the alert when it appears or
   * changes. assertive renders role="alert", which interrupts; polite renders
   * role="status", which waits; off renders no live role, for a static
   * callout. A destructive alert is assertive by default, and a default one
   * is off. Keep a live alert rendered and change its text, since a region
   * that appears together with its text may not be announced.
   */
  live?: AlertLive
}

export interface AlertTitleProps extends Props<'div'> {
  /** Renders the title as a native heading, such as an h2, so it joins the document outline. */
  level?: HeadingLevel
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const roles: Record<AlertLive, 'alert' | 'status' | undefined> = {
  assertive: 'alert',
  polite: 'status',
  off: undefined,
}
const links = {
  '& a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& a:hover': { color: 'var(--foreground)' },
}

// The alert is a grid: an icon column when it starts with an icon, the text,
// and an action column when it has an action. The parts place themselves
// and move the action under the text when the alert is narrow, through a
// container query on the alert.
const alertRule = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  rowGap: space(0.5),
  width: '100%',
  paddingInline: space(4),
  paddingBlock: space(3),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  backgroundColor: 'var(--card)',
  color: 'var(--card-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  textAlign: 'start',
  containerType: 'inline-size',
  '&:has(> svg)': { gridTemplateColumns: 'auto minmax(0, 1fr)' },
  '&:has(> [data-slot="alert-action"])': { gridTemplateColumns: 'minmax(0, 1fr) auto' },
  '&:has(> svg):has(> [data-slot="alert-action"])': { gridTemplateColumns: 'auto minmax(0, 1fr) auto' },
  '& > svg': {
    gridRow: 'span 2',
    width: '1rem',
    height: '1rem',
    marginInlineEnd: space(2.5),
    color: 'currentColor',
    translate: '0 0.125rem',
  },
  '&[data-variant="destructive"]': { color: 'var(--destructive)' },
})

/**
 * A callout for a message, with an optional icon, title, description and
 * action. Its live role follows the message's urgency.
 */
export function Alert(handle: Handle<AlertProps>) {
  return () => {
    let { variant = 'default', live = variant === 'destructive' ? 'assertive' : 'off', mix, ...props } = handle.props

    return <div data-slot="alert" data-variant={variant} role={roles[live]} {...props} mix={[alertRule, mix]} />
  }
}

const besideIcon = ':where([data-slot="alert"]:has(> svg)) > &'

const titleRule = css({
  margin: 0,
  fontSize: 'inherit',
  lineHeight: 'inherit',
  fontWeight: 500,
  overflowWrap: 'anywhere',
  [besideIcon]: { gridColumnStart: '2' },
  ...links,
})

/** The alert's title. It is a div, as in shadcn, unless you give it a heading level. */
export function AlertTitle(handle: Handle<AlertTitleProps>) {
  return () => {
    let { level, mix, ...props } = handle.props
    let Tag = (level ? `h${level}` : 'div') as 'div'

    return <Tag data-slot="alert-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  textWrap: 'pretty',
  overflowWrap: 'anywhere',
  [besideIcon]: { gridColumnStart: '2' },
  // A destructive alert keeps its description red, mixed with the foreground so it stays at 4.5:1 or more.
  ':where([data-slot="alert"][data-variant="destructive"]) > &': {
    color: 'color-mix(in oklab, var(--destructive) 85%, var(--foreground))',
  },
  '& p': { margin: 0 },
  '& p:not(:last-child)': { marginBlockEnd: space(4) },
  ...links,
})

/** The alert's message. It may hold paragraphs and links. */
export function AlertDescription(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="alert-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const actionRule = css({
  gridColumn: '-2 / -1',
  gridRow: '1 / span 2',
  alignSelf: 'start',
  marginInlineStart: space(2),
  // A narrow alert keeps its width for the text and puts the action under it.
  '@container (max-width: 18rem)': {
    gridColumn: '1 / -1',
    gridRow: 'auto',
    justifySelf: 'start',
    marginInlineStart: 0,
    marginBlockStart: space(2),
    [besideIcon]: { gridColumnStart: '2' },
  },
})

/**
 * Holds a button or link that acts on the alert. It sits in the end corner,
 * in a column of its own, and moves under the text when the alert is narrow.
 */
export function AlertAction(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="alert-action" {...props} mix={[actionRule, mix]} />
  }
}
