// RemixCN Field: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { fieldRowBasis, focusRing, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import { Label } from '#remixcn/ui/label.tsx'
import { Separator } from '#remixcn/ui/separator.tsx'

// Native elements carry the semantics: fieldset and legend group controls,
// label for names them, and the controls validate, submit and reset
// themselves. Field never adds a form, an id, a validation state or a submit
// of its own. The caller owns those, and wires labels, descriptions and
// errors with ids it keeps stable between the server and the browser.

export type FieldOrientation = 'vertical' | 'horizontal' | 'responsive'
export type FieldLegendVariant = 'legend' | 'label'

/** One validation issue, such as one of a Standard Schema result's issues. */
export type FieldErrorEntry = { message?: string | null } | null | undefined

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const smallText = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }

/** The trimmed, nonempty messages of the errors, once each, in the order they first appear. */
export function fieldErrorMessages(errors?: ReadonlyArray<FieldErrorEntry>): string[] {
  let messages = (errors ?? []).map((error) => error?.message?.trim())
  return [...new Set(messages.filter((message): message is string => Boolean(message)))]
}

/**
 * Joins the ids of the descriptions and errors that are shown, once each,
 * for aria-describedby. Pass false for one that isn't shown. Without ids it
 * returns undefined, so the attribute goes away and never points at a
 * message that is gone.
 */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  let present = ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
  return [...new Set(present)].join(' ') || undefined
}

// Children count as content when they hold text. Empty elements and
// fragments don't, however deep, so <span> </span> renders no empty alert. A
// component counts, since its text is unknown until it renders.
function hasContent(node: RemixNode): boolean {
  if (Array.isArray(node)) return node.some(hasContent)
  if (typeof node === 'string') return node.trim() !== ''
  if (node == null || typeof node === 'boolean') return false
  if (typeof node === 'object' && (typeof node.type === 'string' || node.type === Fragment)) {
    return hasContent(node.props.children as RemixNode)
  }
  return true
}

// shadcn writes data-invalid and data-disabled as bare attributes, which
// React writes as "true" but Remix's server leaves empty.
function isOn(value: unknown) {
  return value === true || value === '' || value === 'true'
}

const fieldSetRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(6),
  // A fieldset is as wide as its content by default, which breaks reflow on a narrow screen.
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
  '&:has(> [data-slot="checkbox-group"], > [data-slot="radio-group"])': { gap: space(3) },
})

/** A native fieldset that groups related fields. disabled disables every control inside it. */
export function FieldSet(handle: Handle<Props<'fieldset'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <fieldset data-slot="field-set" {...props} mix={[fieldSetRule, mix]} />
  }
}

const legendRule = css({
  marginBlockEnd: space(3),
  padding: 0,
  fontWeight: 500,
  overflowWrap: 'anywhere',
  '&[data-variant="legend"]': { fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)' },
  '&[data-variant="label"]': smallText,
})

export interface FieldLegendProps extends Props<'legend'> {
  /** A heading for a section, or the look of a field label for a group of choices. */
  variant?: FieldLegendVariant
}

/** The native legend that names its FieldSet. Make it the fieldset's first child. */
export function FieldLegend(handle: Handle<FieldLegendProps>) {
  return () => {
    let { variant = 'legend', mix, ...props } = handle.props

    return <legend data-slot="field-legend" data-variant={variant} {...props} mix={[legendRule, mix]} />
  }
}

const groupRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(7),
  width: '100%',
  minWidth: 0,
  // Responsive fields inside put their parts in a row once the group is 28rem wide.
  containerType: 'inline-size',
  containerName: 'field-group',
  '&[data-slot="checkbox-group"]': { gap: space(3) },
  ':where([data-slot="field-group"]) > &': { gap: space(4) },
})

/** Stacks fields, and lets responsive fields inside react to its width. */
export function FieldGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="field-group" {...props} mix={[groupRule, mix]} />
  }
}

// A row wraps when its parts can't fit, so a narrow screen never scrolls sideways.
const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' } as const
const startWithContent = { alignItems: 'flex-start' } as const
// A native checkbox or radio, or the wrapper Checkbox, Switch and RadioGroupItem draw around theirs.
const choice =
  ':is(input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="switch"], [data-slot="checkbox-root"], [data-slot="switch-root"], [data-slot="radio-group-item-root"])'

const fieldRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(3),
  width: '100%',
  minWidth: 0,
  '&[data-invalid="true"]': { color: 'var(--destructive)' },
  '&[data-orientation="horizontal"]': row,
  '&[data-orientation="horizontal"]:has(> [data-slot="field-content"])': startWithContent,
  '@container field-group (min-width: 28rem)': {
    '&[data-orientation="responsive"]': row,
    '&[data-orientation="responsive"]:has(> [data-slot="field-content"])': startWithContent,
  },
  // A native checkbox or radio loses the browser's margins and lines up with
  // the first line of the content beside it. Its own styles still win.
  '& > input:is([type="checkbox"], [type="radio"])': { flexShrink: 0, margin: 0 },
  [`&:has(> [data-slot="field-content"]) > ${choice}`]: { marginBlockStart: '1px' },
  // A field inside a choice card's label takes the card's padding.
  ':where(label[data-slot="field-label"]) > &': { padding: space(3) },
})

export interface FieldProps extends Props<'div'> {
  /**
   * vertical stacks the label, control and messages. horizontal puts them in
   * a row, such as a checkbox before its label. responsive stacks them until
   * its FieldGroup is 28rem wide, then puts them in a row.
   */
  orientation?: FieldOrientation
  /**
   * Shows the field in its invalid colors. Set it together with
   * aria-invalid="true" on the control and a FieldError the control's
   * aria-describedby names: Field doesn't validate.
   */
  invalid?: boolean
  /** Dims the field. Disable the control itself too, or put the field in a disabled FieldSet. */
  disabled?: boolean
}

/**
 * Lays out one control with its label, description and error, as
 * role="group". It wires nothing itself: the caller links the parts by id.
 */
export function Field(handle: Handle<FieldProps>) {
  return () => {
    let {
      orientation = 'vertical',
      invalid,
      disabled,
      'data-invalid': dataInvalid,
      'data-disabled': dataDisabled,
      mix,
      ...props
    } = handle.props as FieldProps & { 'data-invalid'?: unknown; 'data-disabled'?: unknown }

    return (
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        data-invalid={(invalid ?? isOn(dataInvalid)) ? 'true' : undefined}
        data-disabled={(disabled ?? isOn(dataDisabled)) ? 'true' : undefined}
        {...props}
        mix={[fieldRule, mix]}
      />
    )
  }
}

const inHorizontalField = ':where([data-slot="field"][data-orientation="horizontal"]) > &'
const inResponsiveField = ':where([data-slot="field"][data-orientation="responsive"]) > &'
const inDisabledField = ':where([data-slot="field"][data-disabled="true"]) &'
const inStackedField =
  ':where([data-slot="field"]:is([data-orientation="vertical"], [data-orientation="responsive"])) > &'
// Rows with a text-like control, not a checkbox or radio.
const besideHorizontalControl =
  `:where([data-slot="field"][data-orientation="horizontal"]:not(:has(> ${choice}))) > &` as const
const besideResponsiveControl =
  `:where([data-slot="field"][data-orientation="responsive"]:not(:has(> ${choice}))) > &` as const

// In a row, the text shares the room with the control. Beside an input or
// select, it keeps at least 8rem, so the control moves to the next line
// first. Beside a checkbox or radio, it stays on the checkbox's line.
const textInRow = mergeStyles(
  { [inHorizontalField]: { flex: `1 1 ${fieldRowBasis}` }, [besideHorizontalControl]: { minWidth: 'min(100%, 8rem)' } },
  {
    '@container field-group (min-width: 28rem)': {
      [inResponsiveField]: { flex: `1 1 ${fieldRowBasis}` },
      [besideResponsiveControl]: { minWidth: 'min(100%, 8rem)' },
    },
  },
)

const contentRule = css(
  mergeStyles(
    { display: 'flex', flex: '1 1 0%', flexDirection: 'column', gap: space(1), minWidth: 0, lineHeight: 1.375 },
    textInRow,
  ),
)

/** Stacks a label and its description beside a control in a horizontal field. */
export function FieldContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="field-content" {...props} mix={[contentRule, mix]} />
  }
}

// A label or title is as wide as its text and fills a stacked field.
const labelLayout = mergeStyles(
  {
    width: 'fit-content',
    gap: space(2),
    lineHeight: 1.375,
    [inStackedField]: { width: '100%' },
    [inDisabledField]: { opacity: 0.5 },
  },
  textInRow,
)

const cardSelector = '&:has(> [data-slot="field"])'
const fieldLabelRule = css(
  mergeStyles(
    labelLayout,
    {
      // A label around a whole field is a choice card: the field inside is
      // one large target, with a border, a hover tint and a checked tint.
      [cardSelector]: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'stretch',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      },
      [`${cardSelector}:not(:has(:disabled)):hover`]: {
        backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
      },
      [`${cardSelector}:has(:focus-visible)`]: { borderColor: 'var(--ring)' },
      '&:has(input:checked)': {
        backgroundColor:
          'light-dark(color-mix(in oklab, var(--primary) 5%, transparent), color-mix(in oklab, var(--primary) 10%, transparent))',
        borderColor:
          'light-dark(color-mix(in oklab, var(--primary) 30%, transparent), color-mix(in oklab, var(--primary) 20%, transparent))',
      },
    },
    focusRing(`${cardSelector}:has(:focus-visible)`),
    transition('background-color', 'border-color'),
  ),
)

/**
 * A native label for a field's control: point for at its id. Around a
 * whole Field with a checkbox or radio, it is a choice card.
 */
export function FieldLabel(handle: Handle<Props<'label'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <Label data-slot="field-label" {...props} mix={[fieldLabelRule, mix]} />
  }
}

const titleRule = css(
  mergeStyles(labelLayout, {
    display: 'flex',
    alignItems: 'center',
    ...smallText,
    lineHeight: 1.375,
    fontWeight: 500,
    overflowWrap: 'anywhere',
  }),
)

/**
 * A title that looks like a label but names nothing, such as the heading
 * of a choice card. It keeps shadcn's data-slot="field-label".
 */
export function FieldTitle(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="field-label" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  ...smallText,
  lineHeight: 1.5,
  fontWeight: 400,
  textAlign: 'start',
  overflowWrap: 'anywhere',
  // Close to the label above it, and closer still under a legend.
  '&:nth-last-child(2)': { marginBlockStart: space(-1) },
  '&:last-child': { marginBlockStart: 0 },
  ':where([data-variant="legend"]) + &': { marginBlockStart: space(-1.5) },
  ':where([data-slot="field"][data-orientation="horizontal"]) &': { textWrap: 'balance' },
  '& > a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '4px' },
  '& > a:hover': { color: 'var(--primary)' },
})

/** Help text for a field. Give it an id and name it in the control's aria-describedby. */
export function FieldDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <p data-slot="field-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const line = { flex: '1 1 0%', width: 'auto', minWidth: space(4) }

// The text sits between two lines, so it needs no background and fits any surface.
const separatorRule = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  minHeight: space(5),
  marginBlock: space(-2),
  color: 'var(--muted-foreground)',
  ...smallText,
  '&[data-content="true"]::after': { ...line, content: '""', borderBlockStart: '1px solid var(--border)' },
})
const separatorLineRule = css(line)
const separatorContentRule = css({ display: 'block', maxWidth: '100%', textAlign: 'center', overflowWrap: 'anywhere' })

/** A line between fields, with optional text such as "Or continue with". */
export function FieldSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { children, mix, ...props } = handle.props
    let content = hasContent(children)

    return (
      <div data-slot="field-separator" data-content={content ? 'true' : 'false'} {...props} mix={[separatorRule, mix]}>
        <Separator mix={separatorLineRule} />
        {content ? (
          <span data-slot="field-separator-content" mix={separatorContentRule}>
            {children}
          </span>
        ) : null}
      </div>
    )
  }
}

const errorRule = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: space(1.5),
  color: 'var(--destructive)',
  ...smallText,
  fontWeight: 400,
  overflowWrap: 'anywhere',
  '& > svg': { flexShrink: 0, width: '1rem', height: '1rem', marginBlockStart: '0.125rem' },
  '& > ul': {
    display: 'flex',
    flexDirection: 'column',
    gap: space(1),
    margin: 0,
    paddingInlineStart: space(4),
    listStyleType: 'disc',
  },
})

export interface FieldErrorProps extends Omit<Props<'div'>, 'role'> {
  /**
   * Validation issues, such as [{ message }]. It shows their messages,
   * trimmed and once each: one as text, several as a list. Children that
   * hold text show instead.
   */
  errors?: ReadonlyArray<FieldErrorEntry>
}

/**
 * An error message with role="alert", or nothing when there is no message,
 * so an empty alert never renders. Give it an id and name it in the
 * control's aria-describedby with describedBy(), which drops the id once the
 * error is gone.
 */
export function FieldError(handle: Handle<FieldErrorProps>) {
  return () => {
    let { children, errors, mix, ...props } = handle.props
    let custom = hasContent(children)
    let messages = custom ? [] : fieldErrorMessages(errors)
    if (!custom && messages.length === 0) return null

    return (
      <div role="alert" data-slot="field-error" {...props} mix={[errorRule, mix]}>
        <CircleAlertIcon />
        {custom ? (
          <div>{children}</div>
        ) : messages.length === 1 ? (
          <span>{messages[0]}</span>
        ) : (
          <ul>
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }
}
