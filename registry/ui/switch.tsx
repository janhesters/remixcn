// RemixCN Switch: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'

export type SwitchSize = 'sm' | 'default'

export interface SwitchProps extends Omit<Props<'input'>, 'type' | 'role' | 'children' | 'size'> {
  size?: SwitchSize
}

// shadcn's track is 32px by 18.4px with a 16px thumb, or 24px by 14px with a 12px thumb.
const sizes: Record<SwitchSize, { width: string; height: string; thumb: string }> = {
  default: { width: '2rem', height: '1.15rem', thumb: '1rem' },
  sm: { width: '1.5rem', height: '0.875rem', thumb: '0.75rem' },
}

const rootStyles = css({
  display: 'inline-grid',
  alignItems: 'center',
  flexShrink: 0,
  verticalAlign: 'middle',
})

// The input is the track. It stays a native checkbox with the switch role, so
// labels, Space, forms, reset and validation work without JavaScript.
function trackStyles(size: SwitchSize) {
  return css(
    mergeStyles(
      {
        gridArea: '1 / 1',
        appearance: 'none',
        width: sizes[size].width,
        height: sizes[size].height,
        margin: 0,
        border: '1px solid transparent',
        borderRadius: '9999px',
        backgroundColor: 'light-dark(var(--input), color-mix(in oklch, var(--input) 80%, transparent))',
        boxShadow: 'var(--shadow-xs)',
        '&:checked': { backgroundColor: 'var(--primary)' },
      },
      invalidState,
      disabledState,
      transition('background-color'),
      // Forced colors drop the fill, so the track keeps a border, highlighted once
      // checked, and the thumb's position shows the state.
      { '@media (forced-colors: active)': { borderColor: 'CanvasText', '&:checked': { borderColor: 'Highlight' } } },
    ),
  )
}

function thumbStyles(size: SwitchSize) {
  return css(
    mergeStyles(
      {
        gridArea: '1 / 1',
        justifySelf: 'start',
        width: sizes[size].thumb,
        height: sizes[size].thumb,
        marginInlineStart: '1px',
        borderRadius: '9999px',
        pointerEvents: 'none',
        backgroundColor: 'light-dark(var(--background), var(--foreground))',
        ':where(input:checked) ~ &': {
          translate: 'calc(100% - 2px) 0',
          backgroundColor: 'light-dark(var(--background), var(--primary-foreground))',
        },
        ':where(input:checked) ~ &:dir(rtl)': { translate: 'calc(2px - 100%) 0' },
        ':where(input:disabled) ~ &': { opacity: 0.5 },
        '@media (forced-colors: active)': { border: '1px solid CanvasText' },
      },
      transition('translate'),
    ),
  )
}

const tracks = { default: trackStyles('default'), sm: trackStyles('sm') }
const thumbs = { default: thumbStyles('default'), sm: thumbStyles('sm') }

/** A native checkbox with the switch role, drawn as shadcn's track and thumb. */
export function Switch(handle: Handle<SwitchProps>) {
  return () => {
    let { size = 'default', mix, ...props } = handle.props

    return (
      <span data-slot="switch-root" data-size={size} mix={rootStyles}>
        <input {...props} type="checkbox" role="switch" data-slot="switch" data-size={size} mix={[tracks[size], mix]} />
        <span data-slot="switch-thumb" aria-hidden="true" mix={thumbs[size]} />
      </span>
    )
  }
}
