// RemixCN Spinner: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export interface SpinnerProps extends Props<'svg'> {
  /** Names what is pending, such as "Loading invoices". */
  label?: string
  /**
   * Hides the spinner from assistive technology, for one next to text that
   * already says what is pending, such as a button labelled "Saving…".
   */
  decorative?: boolean
  /** Marks a spinner that starts or ends a label, so a Button or Badge tightens the padding on that side. */
  'data-icon'?: 'inline-start' | 'inline-end'
}

const spinnerRule = css({
  flexShrink: 0,
  width: '1rem',
  height: '1rem',
  animation: 'remixcn-spinner-spin 1s linear infinite',
  '@keyframes remixcn-spinner-spin': { to: { transform: 'rotate(360deg)' } },
  // Reduced motion keeps the ring still; its name or the text next to it still says it's pending.
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

/**
 * A turning ring that shows something is pending. It renders role="status"
 * with a name, as shadcn does, unless it is decorative.
 */
export function Spinner(handle: Handle<SpinnerProps>) {
  return () => {
    let { label = 'Loading', decorative = false, mix, ...props } = handle.props

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={decorative ? undefined : 'status'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? 'true' : undefined}
        data-slot="spinner"
        {...props}
        mix={[spinnerRule, mix]}
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
    )
  }
}
