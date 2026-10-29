import{createElement}from'react'
import /* the render hook */ { useRender } /* from Base UI */ from '@base-ui/react/use-render'

import { cx } from '../lib/cx.ts'

export function Badge(props: { label: string }) {
  return useRender({ render: createElement('span', { className: cx('badge') }, props.label) })
}
