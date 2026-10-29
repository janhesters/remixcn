// RemixCN Button Group: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { buttonGroupItem, mergeStyles } from '#remixcn/lib/styles.ts'

export type ButtonGroupOrientation = 'horizontal' | 'vertical'

export interface ButtonGroupVariantOptions {
  /** Lays the parts out in a row, the default, or in a column. */
  orientation?: ButtonGroupOrientation
}

export interface ButtonGroupProps extends Props<'div'>, ButtonGroupVariantOptions {}

export interface ButtonGroupSeparatorProps extends Props<'div'> {
  /** Vertical by default, to divide a row of buttons. Use horizontal in a vertical group. */
  orientation?: ButtonGroupOrientation
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

// The group lays its parts out and never styles them: each part joins its
// neighbors with buttonGroupItem from its own css(), so it can't lose to the
// order in which Remix first renders the rules.
const groupBase = {
  display: 'flex',
  alignItems: 'stretch',
  width: 'fit-content',
  maxWidth: '100%',
  // Nested groups sit apart instead of joining.
  '&:has(> [data-slot="button-group"])': { gap: space(2) },
}

const groupRules: Record<ButtonGroupOrientation, ReturnType<typeof css>> = {
  // A row wraps when it can't fit, so a narrow screen or large text never scrolls sideways.
  horizontal: css(mergeStyles(groupBase, { flexWrap: 'wrap' })),
  vertical: css(mergeStyles(groupBase, { flexDirection: 'column' })),
}

/**
 * Returns the mixins that make any element a button group: its layout and the
 * data-slot and data-orientation attributes its parts join on. Add a role or
 * a label yourself where the element needs one.
 */
export function buttonGroupVariants({ orientation = 'horizontal' }: ButtonGroupVariantOptions = {}): MixValue {
  return [groupRules[orientation], attrs({ 'data-slot': 'button-group', 'data-orientation': orientation })]
}

/**
 * Groups related buttons, inputs and text into one joined control. It adds
 * no tab stop and no form, so each part keeps its own focus and form owner.
 * Name it with aria-label or aria-labelledby.
 */
export function ButtonGroup(handle: Handle<ButtonGroupProps>) {
  return () => {
    let { orientation = 'horizontal', mix, ...props } = handle.props

    return (
      <div
        role="group"
        data-slot="button-group"
        data-orientation={orientation}
        {...props}
        mix={[buttonGroupVariants({ orientation }), mix]}
      />
    )
  }
}

const textRule = css(
  mergeStyles(
    {
      display: 'flex',
      alignItems: 'center',
      gap: space(2),
      margin: 0,
      paddingInline: space(2.5),
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--muted)',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      fontWeight: 500,
      '& svg': { flexShrink: 0, pointerEvents: 'none', width: '1rem', height: '1rem' },
    },
    buttonGroupItem,
  ),
)

/**
 * Returns the mixins that give any element the group text look and its
 * data-slot, such as a native label for a grouped input:
 * <label for="amount" mix={buttonGroupTextVariants()}>Amount</label>.
 */
export function buttonGroupTextVariants(): MixValue {
  return [textRule, attrs({ 'data-slot': 'button-group-text' })]
}

/** Shows text, such as a unit or a prefix, as a part of the group. */
export function ButtonGroupText(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="button-group-text" {...props} mix={[buttonGroupTextVariants(), mix]} />
  }
}

// A border, not a background, draws the line, so it stays visible in forced colors.
const separatorRule = css({
  flexShrink: 0,
  alignSelf: 'stretch',
  position: 'relative',
  margin: 0,
  border: 0,
  '&[data-orientation="vertical"]': {
    width: 0,
    marginBlock: '1px',
    borderInlineStart: '1px solid var(--input)',
  },
  '&[data-orientation="horizontal"]': {
    height: 0,
    marginInline: '1px',
    borderBlockStart: '1px solid var(--input)',
  },
})

/** Divides two parts of a group, such as the halves of a split button that have no border of their own. */
export function ButtonGroupSeparator(handle: Handle<ButtonGroupSeparatorProps>) {
  return () => {
    let { orientation = 'vertical', mix, ...props } = handle.props

    return (
      <div
        role="separator"
        aria-orientation={orientation}
        data-slot="button-group-separator"
        data-orientation={orientation}
        {...props}
        mix={[separatorRule, mix]}
      />
    )
  }
}
