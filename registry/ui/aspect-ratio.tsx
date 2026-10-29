// RemixCN Aspect Ratio: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export interface AspectRatioProps extends Props<'div'> {
  /** Width divided by height, such as 16 / 9. A ratio that isn't a positive number lets the content size the box. */
  ratio: number
}

const aspectRatioRule = css({ position: 'relative', aspectRatio: 'var(--ratio)' })

function withRatio(ratio: number, style: AspectRatioProps['style']) {
  return typeof style === 'string' ? `--ratio: ${ratio}; ${style}` : { '--ratio': ratio, ...style }
}

/**
 * Keeps its content at a width-to-height ratio, with the native CSS
 * aspect-ratio property, so the box takes its shape before an image loads
 * and without JavaScript. Position the content inside it yourself, such as
 * an image with width and height at 100% and object-fit: cover.
 */
export function AspectRatio(handle: Handle<AspectRatioProps>) {
  return () => {
    let { ratio, style, mix, ...props } = handle.props
    let valid = Number.isFinite(ratio) && ratio > 0

    return (
      <div
        data-slot="aspect-ratio"
        {...props}
        style={valid ? withRatio(ratio, style) : style}
        mix={[aspectRatioRule, mix]}
      />
    )
  }
}
