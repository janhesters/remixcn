// RemixCN Icons: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import type { Handle, RemixNode } from 'remix/component'

// Icons are inline SVG drawn for RemixCN, so no icon package or font loads.
// Size and color come from SVG attributes, which any CSS rule overrides: a
// component sizes its icons with its own css(), such as '& svg': { width: '1rem' }.

export interface IconProps {
  /**
   * Names an icon that carries meaning on its own, such as a status without
   * text. Leave it out when visible text says the same: the icon is then
   * hidden from assistive technology.
   */
  label?: string
  /**
   * Marks an icon that starts or ends a label, such as inside a Button, which
   * then tightens the padding on that side.
   */
  'data-icon'?: 'inline-start' | 'inline-end'
}

/** Wraps stroke paths on a 24 by 24 grid in an SVG that scales with the font size and takes the text color. */
export function Icon(handle: Handle<IconProps & { children?: RemixNode }>) {
  return () => {
    let { label, children, 'data-icon': position } = handle.props

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
        data-icon={position}
      >
        {children}
      </svg>
    )
  }
}

export function CheckIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
  )
}

/** Points onward. Mirror it with mirrorInRtl from styles.ts in right-to-left text. */
export function ChevronRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Icon>
  )
}

export function CircleAlertIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </Icon>
  )
}
