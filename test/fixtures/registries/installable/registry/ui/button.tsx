// RemixCN Button: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { cx } from '#remixcn/lib/cx.ts'

const buttonCss = css({
  borderRadius: 'var(--radius)',
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  paddingInline: '1rem',
})

export function Button(handle: Handle<{ label: string; variant?: 'default' | 'outline' }>) {
  return () => (
    <button type="button" mix={buttonCss} class={cx('button', handle.props.variant === 'outline' && 'button-outline')}>
      {handle.props.label}
    </button>
  )
}
