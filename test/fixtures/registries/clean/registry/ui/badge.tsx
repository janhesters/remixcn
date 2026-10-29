import { css } from 'remix/component'
import type { Handle } from 'remix/component'

const badgeCss = css({ borderRadius: '4px', paddingInline: '0.5rem' })

// Docs show how a React app would write it: import { Badge } from 'react-badge'
export const comparison = `
import { Badge } from '@base-ui/react/badge'
`

export function Badge(handle: Handle<{ label: string }>) {
  return () => (
    <span mix={badgeCss} title="Don't import from 'react'">
      {handle.props.label} doesn't import 'tailwindcss'
    </span>
  )
}
