// RemixCN Button: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css, on } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { buttonGroupItem, disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export const buttonVariantNames = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const
export const buttonSizes = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const

export type ButtonVariant = (typeof buttonVariantNames)[number]
export type ButtonSize = (typeof buttonSizes)[number]

export interface ButtonVariantOptions {
  /** The look: a filled primary action by default. */
  variant?: ButtonVariant
  /** The height and padding. The icon sizes make a square for an icon without text. */
  size?: ButtonSize
}

export interface ButtonProps extends Props<'button'>, ButtonVariantOptions {
  /**
   * Keeps a disabled button focusable while it runs in the browser, so focus
   * stays put while it waits, such as in a loading state. It then renders
   * aria-disabled="true" instead of disabled and cancels its clicks. A Button
   * runs in the browser inside a client entry. Before that, and on a page
   * that only renders on the server, the button is disabled natively.
   */
  focusableWhenDisabled?: boolean
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm'): Styles => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})
const enabled = ':not(:disabled, [aria-disabled="true"])'
const hover = `&:hover${enabled}`
const expanded = '&[aria-expanded="true"]'
const inGroup = ':where([data-slot="button-group"]) > &'
const iconSize = (size: string): Styles => ({ '& svg': { width: size, height: size } })
// Tightens the padding beside an icon marked data-icon="inline-start" or "inline-end".
const iconPadding = (steps: number): Styles => ({
  '&:has([data-icon="inline-start"])': { paddingInlineStart: space(steps) },
  '&:has([data-icon="inline-end"])': { paddingInlineEnd: space(steps) },
})

const base: Styles = mergeStyles(
  {
    ...text('sm'),
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    margin: 0,
    paddingBlock: space(1),
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    backgroundClip: 'padding-box',
    color: 'inherit',
    fontWeight: 500,
    textAlign: 'center',
    textDecoration: 'none',
    // shadcn keeps labels on one line. A button never grows past its container
    // instead, and its label wraps only then, so a narrow screen or large text
    // never scrolls sideways.
    overflowWrap: 'anywhere',
    userSelect: 'none',
    cursor: 'pointer',
    '& svg': { flexShrink: 0, pointerEvents: 'none', width: '1rem', height: '1rem' },
    [`&:active${enabled}:not([aria-haspopup])`]: { transform: 'translateY(1px)' },
    // An aria-disabled button keeps focus but is dimmed to half opacity, which
    // dims its ring too. The text color keeps that ring at 3:1 or more.
    '&[aria-disabled="true"]:focus-visible': { outlineColor: 'var(--foreground)' },
    // Forced colors grays out a natively disabled button, but not an aria-disabled one.
    '@media (forced-colors: active)': { '&[aria-disabled="true"]': { color: 'GrayText', borderColor: 'GrayText' } },
  },
  transition('color', 'background-color', 'border-color', 'box-shadow', 'opacity', 'transform'),
)

// Colors that differ by scheme use light-dark(), so a data-theme ancestor picks them too.
const variants: Record<ButtonVariant, Styles> = {
  default: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    [hover]: { backgroundColor: 'color-mix(in oklab, var(--primary) 80%, transparent)' },
  },
  outline: {
    borderColor: 'light-dark(var(--border), var(--input))',
    backgroundColor: 'light-dark(var(--background), color-mix(in oklab, var(--input) 30%, transparent))',
    boxShadow: 'var(--shadow-xs)',
    [hover]: {
      backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--input) 50%, transparent))',
      color: 'var(--foreground)',
    },
    [expanded]: { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  },
  secondary: {
    backgroundColor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    [hover]: { backgroundColor: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)' },
    [expanded]: { backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' },
  },
  ghost: {
    [hover]: {
      backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--muted) 50%, transparent))',
      color: 'var(--foreground)',
    },
    [expanded]: { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  },
  destructive: {
    backgroundColor:
      'light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 20%, transparent))',
    // shadcn's red text on its own red tint misses 4.5:1, so a quarter of the
    // foreground mixes in: darker in light mode, lighter in dark mode.
    color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))',
    [hover]: {
      backgroundColor:
        'light-dark(color-mix(in oklab, var(--destructive) 20%, transparent), color-mix(in oklab, var(--destructive) 30%, transparent))',
    },
    '&:focus-visible': {
      borderColor: 'color-mix(in oklab, var(--destructive) 40%, transparent)',
      outlineColor: 'var(--destructive)',
    },
  },
  link: {
    color: 'var(--primary)',
    textUnderlineOffset: '4px',
    [hover]: { textDecoration: 'underline' },
  },
}

const sizes: Record<ButtonSize, Styles> = {
  default: mergeStyles(
    {
      minHeight: space(9),
      gap: space(1.5),
      paddingInline: space(2.5),
      [inGroup]: { borderRadius: 'var(--radius-md)' },
    },
    iconPadding(2),
  ),
  xs: mergeStyles(
    {
      ...text('xs'),
      minHeight: space(6),
      gap: space(1),
      paddingInline: space(2),
      borderRadius: 'min(var(--radius-md), 8px)',
      [inGroup]: { borderRadius: 'var(--radius-md)' },
    },
    iconPadding(1.5),
    iconSize('0.75rem'),
  ),
  sm: mergeStyles(
    {
      minHeight: space(8),
      gap: space(1),
      paddingInline: space(2.5),
      borderRadius: 'min(var(--radius-md), 10px)',
      [inGroup]: { borderRadius: 'var(--radius-md)' },
    },
    iconPadding(1.5),
  ),
  lg: mergeStyles({ minHeight: space(10), gap: space(1.5), paddingInline: space(2.5) }, iconPadding(2)),
  icon: { width: space(9), height: space(9), paddingInline: 0 },
  'icon-xs': mergeStyles(
    {
      width: space(6),
      height: space(6),
      paddingInline: 0,
      borderRadius: 'min(var(--radius-md), 8px)',
      [inGroup]: { borderRadius: 'var(--radius-md)' },
    },
    iconSize('0.75rem'),
  ),
  'icon-sm': {
    width: space(8),
    height: space(8),
    paddingInline: 0,
    borderRadius: 'min(var(--radius-md), 10px)',
    [inGroup]: { borderRadius: 'var(--radius-md)' },
  },
  'icon-lg': { width: space(10), height: space(10), paddingInline: 0 },
}

// One css() rule per variant and size, so states and sizes merge inside it
// and the group's joins outrank the base corners by specificity, not by order.
const rules = new Map<string, ReturnType<typeof css>>()

function buttonRule(variant: ButtonVariant, size: ButtonSize) {
  let key = `${variant} ${size}`
  let rule = rules.get(key)
  if (!rule) {
    rule = css(mergeStyles(base, variants[variant], sizes[size], invalidState, disabledState, buttonGroupItem))
    rules.set(key, rule)
  }
  return rule
}

/**
 * Returns the mixins that give any element a button's look and its data-slot,
 * data-variant and data-size attributes. Use it on a native link, so it keeps
 * its link role and navigation: <a href="/invoices" mix={buttonVariants()}>.
 */
export function buttonVariants({ variant = 'default', size = 'default' }: ButtonVariantOptions = {}): MixValue {
  return [buttonRule(variant, size), attrs({ 'data-slot': 'button', 'data-variant': variant, 'data-size': size })]
}

// An aria-disabled button stays focusable, so the browser still activates it.
// Cancel the click before the button's own handlers run, so it neither submits,
// resets nor calls them.
const cancelDisabledClick = on<HTMLButtonElement, 'click'>(
  'click',
  (event) => {
    if (event.currentTarget.getAttribute('aria-disabled') !== 'true') return
    event.preventDefault()
    event.stopImmediatePropagation()
  },
  true,
)

/**
 * A native button with shadcn's variants and sizes. It defaults to
 * type="button", so it only submits or resets a form when you say so.
 * Your attributes, events, refs and mixins all reach the native button.
 *
 * It isn't a client entry, because your mixins can't cross from the server
 * to the browser. It runs in the browser inside your client entry, where it
 * can keep a disabled button focusable and cancel its clicks. Until then a
 * disabled or aria-disabled button is disabled natively, so it never submits.
 */
export function Button(handle: Handle<ButtonProps>) {
  // Tasks run only in the browser, after the first commit.
  let running = false

  return () => {
    let {
      variant = 'default',
      size = 'default',
      type = 'button',
      disabled,
      focusableWhenDisabled,
      mix,
      ...props
    } = handle.props
    let ariaDisabled = props['aria-disabled'] === true || props['aria-disabled'] === 'true'
    // A disabled button may keep focus with focusableWhenDisabled, or when you mark it aria-disabled yourself.
    let focusable = disabled ? Boolean(focusableWhenDisabled) : ariaDisabled
    let keepsFocus = focusable && running

    if (!running) {
      handle.queueTask(() => {
        running = true
        if (focusable) void handle.update()
      })
    }

    return (
      <button
        data-slot="button"
        data-variant={variant}
        data-size={size}
        {...props}
        type={type}
        disabled={(disabled || ariaDisabled) && !keepsFocus}
        aria-disabled={keepsFocus ? 'true' : props['aria-disabled']}
        mix={[buttonVariants({ variant, size }), cancelDisabledClick, mix]}
      />
    )
  }
}
