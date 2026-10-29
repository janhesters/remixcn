// RemixCN Label: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const dimmed = { opacity: 0.5, cursor: 'not-allowed' }

const labelRule = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  fontSize: 'var(--text-sm)',
  lineHeight: 1,
  fontWeight: 500,
  // Lets a long word, such as an email address, break on a narrow screen.
  overflowWrap: 'anywhere',
  userSelect: 'none',
  // A label beside a disabled control, around one, or in a disabled field or fieldset dims with it.
  ':where(:disabled) + &': dimmed,
  '&:has(:disabled)': dimmed,
  ':where(fieldset:disabled) &': dimmed,
  ':where([data-slot="field"][data-disabled="true"]) &': { opacity: 0.5, pointerEvents: 'none' },
})

/**
 * A native label. Point for (or htmlFor) at the control's id, or put the
 * control inside it. A click on it focuses or toggles the control, as the
 * browser does for every label.
 */
export function Label(handle: Handle<Props<'label'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <label data-slot="label" {...props} mix={[labelRule, mix]} />
  }
}
