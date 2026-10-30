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

/** Points down, such as at a panel that opens below. Rotate it to point up. */
export function ChevronDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M5.5 9.5 12 16l6.5-6.5" />
    </Icon>
  )
}

/** Points back. Mirror it with mirrorInRtl from styles.ts in right-to-left text. */
export function ChevronLeftIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
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

/** Two crossed strokes, for buttons that close or dismiss. */
export function XIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
  )
}

/** A short dash, such as the mark of a checkbox in the mixed state. */
export function MinusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M6 12h12" />
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

/** Two overlapping sheets, for a copy action. */
export function CopyIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </Icon>
  )
}

/** Three dots in a row, for content that is left out, such as the collapsed levels of a breadcrumb. */
export function EllipsisIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Icon>
  )
}

/** Points down, to the end of a list. Rotate it to point up. */
export function ArrowDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" />
    </Icon>
  )
}

/** A magnifying glass, for a search field. */
export function SearchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.75-4.75" />
    </Icon>
  )
}

export function CircleCheckIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5 11 15l4.5-5" />
    </Icon>
  )
}

export function InfoIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </Icon>
  )
}

export function TriangleAlertIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Icon>
  )
}

export function OctagonXIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3Z" />
      <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
    </Icon>
  )
}

/** An open ring. Turn it with an animation for a loading state, and stop it for reduced motion. */
export function LoaderIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  )
}

/** A page of a wall calendar, for a control that picks a date. */
export function CalendarIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Icon>
  )
}

/** A clock face, for a control that picks a time. */
export function ClockIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label} data-icon={handle.props['data-icon']}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}
