// RemixCN Toggle examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Toggle examples, after shadcn's toggle-example.tsx. A toggle needs the
// browser to change state, so each example is a client entry. The server
// still renders every toggle with its pressed state.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Toggle, toggleChangeType } from '#remixcn/ui/toggle.tsx'

// Layout for the examples, the way an app would lay out its own forms. The
// controls bring their own look; these rules only place labels and text.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'base' | 'sm') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  wrap: css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) }),
  status: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)' }),
  sample: css({
    ...text('base'),
    margin: 0,
    padding: space(3),
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-md)',
    overflowWrap: 'anywhere',
  }),
}

function BoldIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </Icon>
  )
}

function BookmarkIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" />
    </Icon>
  )
}

function ItalicIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M11 5h7M6 19h7M14.5 5l-5 14" />
    </Icon>
  )
}

function UnderlineIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />
    </Icon>
  )
}

export const ToggleBasic = clientEntry(import.meta.url, function ToggleBasic() {
  return () => (
    <div mix={styles.wrap}>
      <Toggle aria-label="Bold" defaultPressed>
        <BoldIcon />
      </Toggle>
      <Toggle aria-label="Italic">
        <ItalicIcon />
      </Toggle>
      <Toggle aria-label="Underline">
        <UnderlineIcon />
      </Toggle>
    </div>
  )
})

export const ToggleOutline = clientEntry(import.meta.url, function ToggleOutline() {
  return () => (
    <div mix={styles.wrap}>
      <Toggle variant="outline">
        <ItalicIcon />
        Italic
      </Toggle>
      <Toggle variant="outline" defaultPressed>
        <BoldIcon />
        Bold
      </Toggle>
    </div>
  )
})

export const ToggleSizes = clientEntry(import.meta.url, function ToggleSizes() {
  return () => (
    <div mix={styles.wrap}>
      <Toggle variant="outline" size="sm">
        Small
      </Toggle>
      <Toggle variant="outline">Default</Toggle>
      <Toggle variant="outline" size="lg">
        Large
      </Toggle>
    </div>
  )
})

export const ToggleDisabled = clientEntry(import.meta.url, function ToggleDisabled() {
  return () => (
    <div mix={styles.wrap}>
      <Toggle disabled>Disabled</Toggle>
      <Toggle variant="outline" disabled defaultPressed>
        Disabled and pressed
      </Toggle>
    </div>
  )
})

export const ToggleWithIcon = clientEntry(import.meta.url, function ToggleWithIcon() {
  return () => (
    <div mix={styles.wrap}>
      <Toggle defaultPressed>
        <BookmarkIcon />
        Bookmark
      </Toggle>
      <Toggle variant="outline">
        <BookmarkIcon />
        Bookmark
      </Toggle>
    </div>
  )
})

const formattedStyles = {
  bold: css({ fontWeight: 700 }),
  italic: css({ fontStyle: 'italic' }),
  underline: css({ textDecoration: 'underline', textUnderlineOffset: '0.2em' }),
}

type Format = keyof typeof formattedStyles

/** Toggles that format a sample sentence, so the result shows each state too. */
export const ToggleFormatting = clientEntry(import.meta.url, function ToggleFormatting(handle: Handle) {
  let formats = new Set<Format>(['bold'])
  let icons = { bold: BoldIcon, italic: ItalicIcon, underline: UnderlineIcon }
  let labels = { bold: 'Bold', italic: 'Italic', underline: 'Underline' }

  return () => (
    <div mix={styles.stack}>
      <div
        mix={[
          styles.wrap,
          on(toggleChangeType, (event) => {
            let format = (event.target as HTMLButtonElement).value as Format
            if (event.pressed) formats.add(format)
            else formats.delete(format)
            void handle.update()
          }),
        ]}
      >
        {(Object.keys(icons) as Format[]).map((format) => {
          let FormatIcon = icons[format]
          return (
            <Toggle
              key={format}
              value={format}
              variant="outline"
              aria-label={labels[format]}
              pressed={formats.has(format)}
            >
              <FormatIcon />
            </Toggle>
          )
        })}
      </div>
      <p mix={[styles.sample, ...[...formats].map((format) => formattedStyles[format])]}>
        The invoice is due in 14 days.
      </p>
      <p role="status" mix={styles.status}>
        Formatting: {formats.size > 0 ? [...formats].join(', ') : 'none'}
      </p>
    </div>
  )
})
