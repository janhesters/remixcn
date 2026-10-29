// RemixCN Kbd examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import { Kbd, KbdGroup } from '#remixcn/ui/kbd.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const textStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const searchStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  width: 'min(100%, 20rem)',
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  '&:has(input:focus-visible)': { outline: '2px solid var(--ring)', outlineOffset: '2px' },
  '& input': {
    flex: '1 1 0%',
    width: '100%',
    minWidth: 0,
    minHeight: space(9),
    border: 0,
    background: 'none',
    outline: 'none',
  },
})

const hiddenStyles = css(visuallyHidden)

/**
 * Shows a key's symbol and gives screen readers its name, since a kbd
 * element takes no aria-label: <Key symbol="⌘" name="Command" />.
 */
export function Key(handle: Handle<{ symbol: string; name: string }>) {
  return () => (
    <Kbd title={handle.props.name}>
      <span aria-hidden="true">{handle.props.symbol}</span>
      <span mix={hiddenStyles}>{handle.props.name}</span>
    </Kbd>
  )
}

export function ArrowUpIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  )
}

export function ArrowDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
  )
}

/** Single keys and modifier keys. A symbol shows its key's name on hover and to screen readers. */
export function KbdBasic() {
  return () => (
    <div mix={rowStyles}>
      <Kbd>Esc</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>Enter</Kbd>
      <Key symbol="⌘" name="Command" />
      <Key symbol="⇧" name="Shift" />
      <Key symbol="⌥" name="Option" />
      <Kbd>Ctrl</Kbd>
    </div>
  )
}

/** A key combination is a kbd of kbd elements. */
export function KbdCombinations() {
  return () => (
    <div mix={rowStyles}>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>B</Kbd>
      </KbdGroup>
      <KbdGroup>
        <Key symbol="⌘" name="Command" />
        <Kbd>K</Kbd>
      </KbdGroup>
      <p mix={textStyles}>
        Use{' '}
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <span>+</span>
          <Kbd>Enter</Kbd>
        </KbdGroup>{' '}
        to send the invoice.
      </p>
    </div>
  )
}

/** Icons in keys, alone or with text. An icon-only key names itself in visually hidden text. */
export function KbdWithIcons() {
  return () => (
    <div mix={rowStyles}>
      <KbdGroup>
        <Kbd>
          <ArrowUpIcon />
          <span mix={hiddenStyles}>Up arrow</span>
        </Kbd>
        <Kbd>
          <ArrowDownIcon />
          <span mix={hiddenStyles}>Down arrow</span>
        </Kbd>
      </KbdGroup>
      <Kbd>
        <ArrowUpIcon />
        Shift
      </Kbd>
    </div>
  )
}

/** A key in a button and in a search field. The key passes presses through to the control around it. */
export function KbdInControls(handle: Handle) {
  return () => (
    <div mix={rowStyles}>
      <Button variant="outline" size="sm">
        Save draft
        <Kbd>S</Kbd>
      </Button>
      <label mix={searchStyles}>
        <input
          type="search"
          name="q"
          aria-label="Search invoices"
          placeholder="Search invoices"
          id={`${handle.id}-search`}
        />
        <KbdGroup aria-hidden="true">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </label>
    </div>
  )
}

/** What the screen shows after a key press goes in samp, inside kbd. */
export function KbdWithSamp() {
  return () => (
    <p mix={textStyles}>
      Choose{' '}
      <Kbd>
        <samp>File</samp>
      </Kbd>{' '}
      then{' '}
      <Kbd>
        <samp>Export as CSV</samp>
      </Kbd>
      .
    </p>
  )
}
