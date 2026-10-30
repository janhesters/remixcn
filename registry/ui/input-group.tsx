// RemixCN Input Group: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { buttonGroupItem, fieldItem, focusRing, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps, ButtonSize, ButtonVariant } from '#remixcn/ui/button.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import type { InputProps } from '#remixcn/ui/input.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

// The group draws one box around a native input or textarea and the addons
// beside it. The control keeps its own element, events, refs and form value:
// the group adds no form, no tab stop and no second control. The control
// drops its border and ring, and the group draws them while the control is
// focused or invalid. Each part lays itself out from its own rule, reacting
// to the group around it, so no rule order decides the look.

export type InputGroupAddonAlign = 'inline-start' | 'inline-end' | 'block-start' | 'block-end'
export type InputGroupButtonSize = 'xs' | 'sm' | 'icon-xs' | 'icon-sm'

export interface InputGroupAddonProps extends Props<'div'> {
  /**
   * Where the addon sits: at the start of the line by default, at its end,
   * or above or below the control. Only the look moves: keyboard focus and
   * screen readers follow the order you write the parts in.
   */
  align?: InputGroupAddonAlign
}

export interface InputGroupButtonProps extends Omit<ButtonProps, 'size' | 'type'> {
  /** Extra small by default. The icon sizes make a square for an icon without text. */
  size?: InputGroupButtonSize
  /** A button by default, so it only submits or resets a form when you say so. */
  type?: 'button' | 'submit' | 'reset'
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const control = '[data-slot="input-group-control"]'
const group = '[data-slot="input-group"]'
const hasAddon = <A extends InputGroupAddonAlign>(align: A) =>
  `:where([data-slot="input-group"]:has(> [data-align="${align}"])) > &` as const

const groupRule = css(
  mergeStyles(
    {
      position: 'relative',
      display: 'flex',
      // A line too narrow for the addons and a usable control wraps inside
      // the box, so a narrow screen or large text never scrolls sideways.
      flexWrap: 'wrap',
      alignItems: 'center',
      width: '100%',
      minWidth: 0,
      minHeight: space(9),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      // An addon above or below the control stacks the parts.
      '&:has(> [data-align="block-start"], > [data-align="block-end"])': {
        flexDirection: 'column',
        flexWrap: 'nowrap',
        alignItems: 'stretch',
      },
      [`&:has(${control}:focus-visible)`]: { borderColor: 'var(--ring)' },
      // A caller marks any part invalid, usually the control.
      '&:has([data-slot][aria-invalid="true"])': { borderColor: 'var(--destructive)' },
      [`&:has([data-slot][aria-invalid="true"]):has(${control}:focus-visible)`]: { outlineColor: 'var(--destructive)' },
      // In a ButtonGroup, the group grows into the room the row gives it, from 8rem so the row
      // wraps only on a narrow screen, and draws its ring above its neighbors.
      ':where([data-slot="button-group"]) > &': { flex: '1 1 8rem', width: 'auto' },
      [`:where([data-slot="button-group"]) > &:has(${control}:focus-visible)`]: { zIndex: 1 },
    },
    focusRing(`&:has(${control}:focus-visible)`),
    transition('color', 'border-color', 'box-shadow'),
    buttonGroupItem,
    fieldItem,
  ),
)

// shadcn pads every addon by 0.375rem above and below inside a group of a
// fixed height. The group here grows with its text instead, so an addon on
// the line takes no padding of its own and the group stays as tall as an
// Input with an extra-small button inside.
const addonBase: Styles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(2),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  fontWeight: 500,
  // A press on the addon focuses the control, as a press on the control's own box would.
  cursor: 'text',
  userSelect: 'none',
  '& > svg': { flexShrink: 0, width: '1rem', height: '1rem' },
  // A disabled control, or data-disabled on the group, dims the addons with it.
  [`:where(${group}[data-disabled="true"], ${group}:has(${control}:disabled)) > &`]: { opacity: 0.5 },
}

// order moves an addon to its side of the line; the CSS order values are shadcn's order-first and order-last.
const addonAligns: Record<InputGroupAddonAlign, Styles> = {
  // shadcn pulls an addon with a button or key toward the edge with a
  // negative margin, which lets its box reach past the group's border when it
  // ends a wrapped line. A smaller padding puts the button in the same place.
  'inline-start': {
    order: '-9999',
    paddingInlineStart: space(2),
    '&:has(> button)': { paddingInlineStart: space(1) },
    '&:has(> kbd)': { paddingInlineStart: `calc(${space(2)} - 0.15rem)` },
  },
  'inline-end': {
    order: '9999',
    paddingInlineEnd: space(2),
    '&:has(> button)': { paddingInlineEnd: space(1) },
    '&:has(> kbd)': { paddingInlineEnd: `calc(${space(2)} - 0.15rem)` },
  },
  'block-start': {
    order: '-9999',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
    paddingInline: space(2.5),
    paddingBlockStart: space(2),
    paddingBlockEnd: space(1.5),
  },
  'block-end': {
    order: '9999',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
    paddingInline: space(2.5),
    paddingBlockStart: space(1.5),
    paddingBlockEnd: space(2),
  },
}

const addonRules = Object.fromEntries(
  Object.entries(addonAligns).map(([align, styles]) => [align, css(mergeStyles(addonBase, styles))]),
) as Record<InputGroupAddonAlign, ReturnType<typeof css>>

// Elements that take a press themselves, so a press on them keeps its own meaning.
const interactive = 'a[href], button, input, select, textarea, label, summary, [contenteditable], [tabindex]'

const focusControl = on<HTMLDivElement, 'click'>('click', (event) => {
  if (event.defaultPrevented) return
  let addon = event.currentTarget
  let target = event.target instanceof Element ? event.target.closest(interactive) : null
  if (target && addon.contains(target)) return
  addon.parentElement?.querySelector<HTMLElement>(control)?.focus()
})

/**
 * Draws one box around a control and its addons, and the focus ring and
 * invalid border while the control is focused or invalid. A disabled
 * control, or data-disabled="true", dims the addons. Name the group with
 * aria-label or aria-labelledby when the control's label doesn't cover it.
 */
export function InputGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="input-group" role="group" {...props} mix={[groupRule, mix]} />
  }
}

/**
 * Shows icons, text, keys or buttons beside the control. A press on the
 * addon, but not on a button, link or other control inside it, focuses the
 * group's control once the group runs in the browser inside your client
 * entry. Call preventDefault() in your own click listener to keep focus where it is.
 */
export function InputGroupAddon(handle: Handle<InputGroupAddonProps>) {
  return () => {
    let { align = 'inline-start', mix, ...props } = handle.props

    return (
      <div
        role="group"
        data-slot="input-group-addon"
        data-align={align}
        {...props}
        mix={[addonRules[align], mix, focusControl]}
      />
    )
  }
}

const buttonSizes: Record<InputGroupButtonSize, Styles> = {
  xs: {
    gap: space(1),
    paddingInline: space(1.5),
    borderRadius: 'var(--radius-sm)',
    '& > svg': { width: '0.875rem', height: '0.875rem' },
  },
  sm: {},
  'icon-xs': { borderRadius: 'var(--radius-sm)', padding: 0 },
  'icon-sm': { padding: 0 },
}

const buttonBase: Styles = {
  gap: space(2),
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  boxShadow: 'none',
}

// Button makes the rule of a variant and size the first time it renders them,
// and a later rule wins. One override rule for every InputGroupButton could
// render before a new variant's and lose to it, so each variant and size gets
// its own, keyed by the button's attributes, which renders right after
// Button's rule for them.
const buttonRules = new Map<string, ReturnType<typeof css>>()

function buttonRule(variant: ButtonVariant, size: InputGroupButtonSize) {
  let key = `${variant} ${size}`
  let rule = buttonRules.get(key)
  if (!rule) {
    let styles: Styles = {}
    styles[`&[data-variant="${variant}"][data-size="${size}"]`] = mergeStyles(
      buttonBase,
      // An outline button would take the addon's muted text, which misses
      // 4.5:1 on its own tint over the group's in dark mode.
      variant === 'outline' ? { color: 'var(--foreground)' } : {},
      buttonSizes[size],
    )
    rule = css(styles)
    buttonRules.set(key, rule)
  }
  return rule
}

/**
 * A Button for an addon: ghost and extra small by default, with
 * type="button". Its attributes, events, refs and mixins reach the native button.
 */
export function InputGroupButton(handle: Handle<InputGroupButtonProps>) {
  return () => {
    let { size = 'xs', variant = 'ghost', type = 'button', mix, ...props } = handle.props
    let buttonSize: ButtonSize = size

    return <Button {...props} type={type} variant={variant} size={buttonSize} mix={[buttonRule(variant, size), mix]} />
  }
}

const textRule = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
})

/** Shows text in an addon, such as a prefix, a unit or a count. */
export function InputGroupText(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="input-group-text" {...props} mix={[textRule, mix]} />
  }
}

// The control drops its own box: the group draws the border, the background and the ring.
const controlBase: Styles = {
  flex: '1 1 0%',
  borderWidth: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  boxShadow: 'none',
  '&:focus-visible': { outline: 'none' },
}

const inputRule = css(
  mergeStyles(controlBase, {
    // The group's border adds 2px, so a group is as tall as a plain Input.
    minHeight: `calc(${space(9)} - 2px)`,
    // The input keeps room to type in, and moves to its own line before it gets narrower.
    minWidth: 'min(100%, 4rem)',
    [hasAddon('inline-start')]: { paddingInlineStart: space(1.5) },
    [hasAddon('inline-end')]: { paddingInlineEnd: space(1.5) },
    [hasAddon('block-start')]: { paddingBlockEnd: space(3) },
    [hasAddon('block-end')]: { paddingBlockStart: space(3) },
  }),
)

const textareaRule = css(mergeStyles(controlBase, { paddingBlock: space(2), resize: 'none' }))

/**
 * An Input for the group, marked data-slot="input-group-control". Every
 * native attribute, event, ref and mixin reaches the native input, as on Input.
 */
export function InputGroupInput(handle: Handle<InputProps>) {
  return () => {
    let { mix, ...props } = handle.props

    return <Input {...props} data-slot="input-group-control" mix={[inputRule, mix]} />
  }
}

/**
 * A Textarea for the group, marked data-slot="input-group-control". Every
 * native attribute, event, ref and mixin reaches the native textarea, as on Textarea.
 */
export function InputGroupTextarea(handle: Handle<Props<'textarea'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <Textarea {...props} data-slot="input-group-control" mix={[textareaRule, mix]} />
  }
}
