// RemixCN Skeleton: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

const skeletonRule = css({
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--muted)',
  // Forced colors drop the background, so a border in the text color draws the shape there.
  border: '1px solid transparent',
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
  animation: 'remixcn-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  '@keyframes remixcn-skeleton-pulse': { '50%': { opacity: 0.5 } },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

/**
 * A placeholder shape that pulses while content loads. It is hidden from
 * assistive technology: mark the region that loads with aria-busy="true"
 * and say what loads in text, such as a visually hidden status.
 */
export function Skeleton(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="skeleton" aria-hidden="true" {...props} mix={[skeletonRule, mix]} />
  }
}
