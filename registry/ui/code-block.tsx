// RemixCN Code Block: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { CheckIcon, CircleAlertIcon, CopyIcon } from '#remixcn/lib/icons.tsx'
import { focusRing, mergeStyles, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'

export const codeBlockVariantNames = ['default', 'destructive'] as const
export const codeBlockSizes = ['default', 'sm'] as const
export const codeBlockLineVariantNames = ['default', 'added', 'removed', 'highlighted'] as const

export type CodeBlockVariant = (typeof codeBlockVariantNames)[number]
export type CodeBlockSize = (typeof codeBlockSizes)[number]
export type CodeBlockLineVariant = (typeof codeBlockLineVariantNames)[number]

/**
 * A piece of highlighted code: its text, and the color your highlighter gave
 * it. The text always renders as text. The color may be a hex color, a CSS
 * color function such as rgb() or oklch(), a named color, var(--token), or
 * light-dark() of two of those, so it follows data-theme. Any other value is
 * dropped, so a token can't add other styles or load a URL.
 */
export interface CodeBlockToken {
  text: string
  color?: string
}

export interface CodeBlockProps extends Props<'div'> {
  /** The tone: destructive for errors and failed output. */
  variant?: CodeBlockVariant
  /** sm has tighter padding and smaller text, for tool output. */
  size?: CodeBlockSize
}

// innerHTML is left out, so the code can't arrive as raw HTML.
export interface CodeBlockContentProps extends Omit<Props<'pre'>, 'innerHTML' | 'children'> {
  /** The code as a string, or CodeBlockLine parts for line variants and tokens. */
  children?: RemixNode
  /** Wraps long lines instead of scrolling. */
  wrap?: boolean
  /** Numbers each line. A string child is split into lines. */
  lineNumbers?: boolean
  /** The number of the first line, when lineNumbers is set. */
  startLine?: number
}

export interface CodeBlockLineProps extends Omit<Props<'span'>, 'innerHTML'> {
  /** The state of the line. Added and removed lines show a + or − marker as well as a tint. */
  variant?: CodeBlockLineVariant
  /** The line's highlighted tokens, rendered as text spans. Takes the place of children. */
  tokens?: CodeBlockToken[]
}

export interface CodeBlockCopyButtonProps extends Omit<
  ButtonProps,
  'type' | 'value' | 'children' | 'focusableWhenDisabled'
> {
  /** The exact text to copy, with its line endings and blank lines. */
  value: string
  /** The button's name and the status after a copy. Defaults to "Copied". */
  copiedLabel?: string
  /** The button's name and the status when the browser refuses the copy. Defaults to "Couldn't copy". */
  failedLabel?: string
}

/** How long the button shows that it copied, in milliseconds. */
export const codeBlockCopiedDuration = 2000

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm'): Styles => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

// Parts react to their block's data attributes from their own rule, so no
// rule depends on the order in which Remix first renders them.
const block = '[data-slot="code-block"]'
const small = `:where(${block}[data-size="sm"])`
const destructive = `:where(${block}[data-variant="destructive"])`
const floating = `:where(${block}) > &`
const numbered = ':where([data-slot="code-block-content"][data-numbered])'
const wrapped = ':where([data-slot="code-block-content"][data-wrap])'
const contentFocused = '&:has(> [data-slot="code-block-content"]:focus-visible)'
// shadcn's red on its own red tint misses 4.5:1, so a quarter of the foreground mixes in.
const destructiveText = 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))'

const rootBase = mergeStyles(
  {
    ...text('sm'),
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    '&[data-size="sm"]': text('xs'),
  },
  focusRing(contentFocused),
)

const rootVariants: Record<CodeBlockVariant, Styles> = {
  default: {
    border: '1px solid var(--input)',
    // shadcn tints dark blocks with 30% of its --input. RemixCN's --input is
    // lighter, to reach 3:1 as a border, so 30% would match --muted and hide
    // highlighted and added lines. 15% keeps shadcn's step between them.
    backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 15%, transparent))',
    color: 'var(--foreground)',
    [contentFocused]: { borderColor: 'var(--ring)' },
  },
  destructive: {
    border:
      '1px solid light-dark(color-mix(in oklab, var(--destructive) 30%, transparent), color-mix(in oklab, var(--destructive) 40%, transparent))',
    color: 'var(--destructive)',
  },
}

const rootRules: Record<CodeBlockVariant, ReturnType<typeof css>> = {
  default: css(mergeStyles(rootBase, rootVariants.default)),
  destructive: css(mergeStyles(rootBase, rootVariants.destructive)),
}

const headerRule = css({
  display: 'flex',
  minWidth: 0,
  flexShrink: 0,
  alignItems: 'center',
  gap: space(2),
  paddingInline: space(4),
  paddingBlockStart: space(4),
  color: 'var(--muted-foreground)',
  [`${destructive} &`]: { color: 'var(--destructive)' },
  [`${small} &`]: { paddingInline: space(3), paddingBlockStart: space(3) },
  // A link around the title may shrink too.
  '& > :has(> [data-slot="code-block-title"])': { minWidth: 0 },
})

const footerRule = css({
  display: 'flex',
  minWidth: 0,
  flexShrink: 0,
  alignItems: 'center',
  gap: space(2),
  paddingInline: space(4),
  paddingBlockEnd: space(4),
  color: 'var(--muted-foreground)',
  [`${small} &`]: { paddingInline: space(3), paddingBlockEnd: space(3) },
})

// shadcn truncates a long title. It wraps instead, so a narrow screen or large
// text still shows the whole file name.
const titleRule = css({
  ...text('sm'),
  minWidth: 0,
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  color: 'var(--foreground)',
  overflowWrap: 'anywhere',
  [`${destructive} &`]: { color: 'var(--destructive)' },
  [`${small} &`]: text('xs'),
  '& svg': { display: 'inline-block', verticalAlign: 'middle', pointerEvents: 'none', width: '1rem', height: '1rem' },
  '& > svg': { marginInlineEnd: space(1.5) },
  [`${small} & svg`]: { width: '0.875rem', height: '0.875rem' },
})

// Directly inside a block, without a header, the actions float at its top
// end. They show on hover and whenever focus is inside the block, and always
// on touch screens, so keyboard and touch users reach them too.
const actionsRule = css(
  mergeStyles(
    {
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      gap: space(1),
      marginBlock: space(-1),
      marginInlineStart: 'auto',
      marginInlineEnd: space(-1.5),
      [floating]: {
        position: 'absolute',
        zIndex: 10,
        insetBlockStart: space(3),
        insetInlineEnd: space(3),
        margin: 0,
        opacity: 0,
        // The buttons sit over the code, so the actions bring their own surface.
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--background)',
        boxShadow: '0 0 0 1px color-mix(in oklab, var(--foreground) 10%, transparent)',
      },
      [`${small} > &`]: { insetBlockStart: space(2), insetInlineEnd: space(2) },
      [`:where(${block}:hover, ${block}:focus-within) > &, ${floating}:has([data-copy-failed])`]: { opacity: 1 },
      '@media (hover: none), (pointer: coarse)': { [floating]: { opacity: 1 } },
    },
    transition('opacity'),
  ),
)

const contentRule = css({
  minWidth: 0,
  minHeight: 0,
  margin: 0,
  padding: space(4),
  overflow: 'auto',
  scrollbarWidth: 'thin',
  fontFamily: 'var(--font-mono)',
  fontSize: 'inherit',
  lineHeight: 1.625,
  textAlign: 'start',
  whiteSpace: 'pre',
  [`${small} > &`]: { padding: space(3) },
  [`:where(${block}:has(> [data-slot="code-block-header"])) > &`]: { paddingBlockStart: space(2) },
  [`:where(${block}:has(> [data-slot="code-block-footer"])) > &`]: { paddingBlockEnd: space(2) },
  [`:where(${block}[data-size="sm"]:has(> [data-slot="code-block-header"])) > &`]: {
    paddingBlockStart: space(1.5),
  },
  '&[data-wrap]': { whiteSpace: 'pre-wrap', overflowWrap: 'break-word' },
  // The block draws the focus ring around the content.
  [`:where(${block}) > &:focus-visible`]: { outline: 'none' },
})

const codeRule = css({
  display: 'grid',
  minWidth: 'max-content',
  minHeight: '1lh',
  alignContent: 'start',
  font: 'inherit',
  [`${numbered} > &`]: { gridTemplateColumns: 'auto minmax(0, 1fr)' },
  [`${wrapped} > &`]: { minWidth: 0 },
})

const lineRule = css({
  position: 'relative',
  display: 'block',
  minHeight: '1lh',
  marginInline: space(-4),
  paddingInline: space(4),
  [`${small} &`]: { marginInline: space(-3), paddingInline: space(3) },
  '&::after': {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: space(1),
    color: 'var(--muted-foreground)',
    userSelect: 'none',
  },
  [`${numbered} &`]: {
    gridColumn: 'span 2',
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    columnGap: space(3),
    counterIncrement: 'line',
  },
  // The numbers are generated content, so a selection leaves them out, and
  // the empty alternative text hides them from screen readers.
  [`${numbered} &::before`]: {
    content: 'counter(line)',
    minWidth: space(6),
    textAlign: 'end',
    color: 'var(--muted-foreground)',
    userSelect: 'none',
  },
  '@supports (content: counter(line) / "")': { [`${numbered} &::before`]: { content: 'counter(line) / ""' } },
  '&[data-variant="highlighted"], &[data-variant="added"]': { backgroundColor: 'var(--muted)' },
  '&[data-variant="added"]::after': { content: '"+"' },
  '&[data-variant="removed"]': { backgroundColor: 'color-mix(in oklab, var(--destructive) 10%, transparent)' },
  '&[data-variant="removed"]::after': { content: '"\\2212"', color: destructiveText },
  // Muted numbers on the red tint miss 4.5:1, so a fifth of the foreground mixes in.
  [`${numbered} &[data-variant="removed"]::before`]: {
    color: 'color-mix(in oklab, var(--muted-foreground) 80%, var(--foreground))',
  },
  // Forced colors drop the tints, so a marked line keeps a bar at its start.
  '@media (forced-colors: active)': {
    '&:not([data-variant="default"])': {
      borderInlineStart: '0.25rem solid Highlight',
      paddingInlineStart: `calc(${space(4)} - 0.25rem)`,
    },
    [`${small} &:not([data-variant="default"])`]: { paddingInlineStart: `calc(${space(3)} - 0.25rem)` },
  },
})

const lineContentRule = css({ minWidth: 0 })

const copyRule = css({
  '&[data-copy-failed]': { color: destructiveText },
})

const statusRule = css(visuallyHidden)

const singleColor = [
  /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i,
  /^var\(--[\w-]+\)$/,
  // A color function holds no parentheses, quotes, semicolons or braces, so it can't end the declaration.
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([\w\s.,%/+-]*\)$/i,
  /^[a-z]+$/i,
]

function isSingleColor(value: string) {
  return singleColor.some((pattern) => pattern.test(value))
}

/** Returns the token color when it's a plain color, or undefined. */
function safeTokenColor(color: string | undefined) {
  let value = color?.trim()
  if (!value) return undefined
  if (isSingleColor(value)) return value

  let pair = /^light-dark\((.*)\)$/i.exec(value)?.[1]
  if (pair === undefined) return undefined

  // Splits at the comma outside the color functions.
  let depth = 0
  let split = -1
  for (let index = 0; index < pair.length; index++) {
    let character = pair[index]
    if (character === '(') depth++
    else if (character === ')') depth--
    else if (character === ',' && depth === 0) {
      if (split !== -1) return undefined
      split = index
    }
  }
  if (split === -1) return undefined

  let [light, dark] = [pair.slice(0, split).trim(), pair.slice(split + 1).trim()]
  return isSingleColor(light) && isSingleColor(dark) ? value : undefined
}

const lineEnding = /\r\n?/g

/**
 * Splits code into lines for CodeBlockLine. It reads Windows and old Mac line
 * endings too, and drops one trailing newline, which would render as an
 * extra empty line.
 */
export function splitCodeLines(code: string): string[] {
  return code.replace(lineEnding, '\n').replace(/\n$/, '').split('\n')
}

/**
 * Splits highlighted tokens into lines for CodeBlockLine's tokens prop. A
 * token that spans a newline becomes a piece on each line, in its color. It
 * reads the same line endings as splitCodeLines, also when a Windows line
 * ending is split across two tokens, and drops one trailing newline.
 */
export function splitTokenLines(tokens: CodeBlockToken[]): CodeBlockToken[][] {
  let lines: CodeBlockToken[][] = [[]]
  // A token that ends with a carriage return has already broken the line, so
  // a line feed that starts the next token completes that same break.
  let afterCarriageReturn = false

  for (let token of tokens) {
    if (token.text === '') continue
    let text = afterCarriageReturn && token.text.startsWith('\n') ? token.text.slice(1) : token.text
    afterCarriageReturn = token.text.endsWith('\r')

    let pieces = text.replace(lineEnding, '\n').split('\n')
    pieces.forEach((piece, index) => {
      if (index > 0) lines.push([])
      if (piece !== '') lines[lines.length - 1].push({ ...token, text: piece })
    })
  }

  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines
}

/** Drops innerHTML, which a caller could still pass without types, so code never arrives as raw HTML. */
function withoutRawHtml<T extends object>(props: T): T {
  let { innerHTML, ...rest } = props as T & { innerHTML?: unknown }
  void innerHTML
  return rest as T
}

function isEmpty(children: unknown) {
  return (
    children === undefined ||
    children === null ||
    children === false ||
    children === '' ||
    (Array.isArray(children) && children.length === 0)
  )
}

/** The surface that holds the header, the content and the footer. */
export function CodeBlock(handle: Handle<CodeBlockProps>) {
  return () => {
    let { variant = 'default', size = 'default', mix, ...props } = handle.props

    return (
      <div data-slot="code-block" data-variant={variant} data-size={size} {...props} mix={[rootRules[variant], mix]} />
    )
  }
}

/** A row above the content for a title and actions. */
export function CodeBlockHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="code-block-header" {...props} mix={[headerRule, mix]} />
  }
}

/** A file name or a label, with an optional icon. A long title wraps. */
export function CodeBlockTitle(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="code-block-title" {...props} mix={[titleRule, mix]} />
  }
}

/** Holds buttons at the end of the header. Directly inside CodeBlock, it floats at the top end. */
export function CodeBlockActions(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="code-block-actions" {...props} mix={[actionsRule, mix]} />
  }
}

/** A row below the content, such as for a Show more button. */
export function CodeBlockFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="code-block-footer" {...props} mix={[footerRule, mix]} />
  }
}

/**
 * The pre and code that show the code. A string child renders as one text
 * node, so it stays cheap while output streams; with lineNumbers, it's split
 * into lines. Remix escapes every string, so code renders as text and never
 * runs. It's focusable, so keyboard users can scroll it; pass tabIndex={-1}
 * to remove the tab stop. It always reads left to right.
 */
export function CodeBlockContent(handle: Handle<CodeBlockContentProps>) {
  return () => {
    let { children, wrap, lineNumbers, startLine = 1, style, mix, ...props } = withoutRawHtml(handle.props)
    let firstLine = Number.isFinite(startLine) ? Math.trunc(startLine) : 1
    let counter = lineNumbers ? `line ${firstLine - 1}` : undefined
    let merged =
      counter === undefined
        ? style
        : typeof style === 'string'
          ? `counter-reset: ${counter}; ${style}`
          : { counterReset: counter, ...style }

    let code =
      typeof children !== 'string'
        ? children
        : lineNumbers
          ? splitCodeLines(children).map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)
          : children.replace(lineEnding, '\n')

    return (
      <pre
        data-slot="code-block-content"
        data-wrap={wrap ? '' : undefined}
        data-numbered={lineNumbers ? '' : undefined}
        dir="ltr"
        tabIndex={0}
        {...props}
        style={merged}
        mix={[contentRule, mix]}
      >
        <code data-slot="code-block-code" mix={codeRule}>
          {code}
        </code>
      </pre>
    )
  }
}

/**
 * One line of code. Pass the line's highlighted tokens as tokens, or your own
 * nodes as children. Every line ends with a newline, which renders nothing, so
 * a copied selection keeps its line breaks and blank lines in every engine:
 * Firefox puts no break between the lines' boxes.
 */
export function CodeBlockLine(handle: Handle<CodeBlockLineProps>) {
  return () => {
    let { variant = 'default', tokens, children, mix, ...props } = withoutRawHtml(handle.props)
    let content = tokens
      ? tokens
          .filter((token) => token.text !== '')
          .map((token, index) => {
            let color = safeTokenColor(token.color)
            return (
              <span key={index} data-slot="code-block-token" style={color ? { color } : undefined}>
                {token.text}
              </span>
            )
          })
      : children

    return (
      <span data-slot="code-block-line" data-variant={variant} {...props} mix={[lineRule, mix]}>
        <span data-slot="code-block-line-content" mix={lineContentRule}>
          {isEmpty(content) ? null : content}
          {'\n'}
        </span>
      </span>
    )
  }
}

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * A ghost icon Button that copies value to the clipboard. It shows that it
 * copied only once the browser confirms the write, for two seconds, and says
 * so in a status for screen readers; when the browser refuses, it shows an
 * alert icon and says so too. It's always type="button", so it never sends
 * a surrounding form. Your mixins run first: call preventDefault() in a click
 * handler to cancel the copy.
 *
 * It copies once it runs in the browser, inside a client entry. Until then,
 * and on a page that only renders on the server, it's disabled.
 */
export function CodeBlockCopyButton(handle: Handle<CodeBlockCopyButtonProps>) {
  // Tasks run only in the browser, after the first commit.
  let running = false
  let state: CopyState = 'idle'
  // Each copy and each new value gets a number, so a late answer from the
  // clipboard for an earlier one changes nothing.
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let shownValue: string | undefined

  function reset() {
    attempt++
    clearTimeout(timer)
    timer = undefined
    state = 'idle'
  }

  handle.signal.addEventListener('abort', reset)

  let copy = on<HTMLButtonElement, 'click'>('click', (event) => {
    if (event.defaultPrevented) return

    reset()
    let current = attempt
    // Clears the last status first, so the next one is announced again.
    let cleared = handle.update()

    let write: Promise<void>
    try {
      write = navigator.clipboard.writeText(handle.props.value)
    } catch (error) {
      write = Promise.reject(error)
    }

    let settle = async (next: CopyState) => {
      await cleared
      if (current !== attempt || handle.signal.aborted) return
      state = next
      if (next === 'copied') {
        timer = setTimeout(() => {
          state = 'idle'
          timer = undefined
          void handle.update()
        }, codeBlockCopiedDuration)
      }
      void handle.update()
    }

    write.then(
      () => settle('copied'),
      () => settle('failed'),
    )
  })

  return () => {
    let {
      value,
      copiedLabel = 'Copied',
      failedLabel = "Couldn't copy",
      'aria-label': label = 'Copy',
      variant = 'ghost',
      size = 'icon-xs',
      disabled,
      mix,
      ...props
    } = handle.props

    // A copied or failed state belongs to the text it copied.
    if (value !== shownValue) {
      if (shownValue !== undefined) reset()
      shownValue = value
    }

    if (!running) {
      handle.queueTask(() => {
        running = true
        void handle.update()
      })
    }

    let status = state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : ''

    return (
      <>
        <Button
          data-slot="code-block-copy-button"
          data-copied={state === 'copied' ? '' : undefined}
          data-copy-failed={state === 'failed' ? '' : undefined}
          {...props}
          variant={variant}
          size={size}
          type="button"
          disabled={disabled || !running}
          aria-label={status || label}
          mix={[copyRule, mix, copy]}
        >
          {state === 'copied' ? <CheckIcon /> : state === 'failed' ? <CircleAlertIcon /> : <CopyIcon />}
        </Button>
        <span role="status" data-slot="code-block-copy-status" mix={statusRule}>
          {status}
        </span>
      </>
    )
  }
}
