// RemixCN Code Block examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { transition } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
  splitCodeLines,
  splitTokenLines,
} from '#remixcn/ui/code-block.tsx'
import type { CodeBlockLineVariant, CodeBlockToken } from '#remixcn/ui/code-block.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const fieldStyles = css({ display: 'grid', gap: space(1.5), fontSize: 'var(--text-sm)' })
const inputStyles = css({
  minWidth: 0,
  minHeight: space(9),
  paddingInline: space(3),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
})

export function TerminalIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 7.5 9.5 12 5 16.5M12 17h7" />
    </Icon>
  )
}

export function FileCodeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M10 12.5l-2 2 2 2M14 12.5l2 2-2 2" />
    </Icon>
  )
}

export function WrapTextIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M4 18h5M15 15.5 12.5 18l2.5 2.5" />
    </Icon>
  )
}

export function DownloadIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </Icon>
  )
}

export function ChevronDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </Icon>
  )
}

export function ReplayIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
    </Icon>
  )
}

const install = `$ bun add remix@3.0.0
bun add v1.4.2

installed remix@3.0.0

1 package installed [812.00ms]`

const build = `$ bun run build
$ remix build
✓ Compiled 48 modules in 1.9s

Route             Size
/                 4.2 kB
/invoices         7.8 kB
/invoices/:id     3.1 kB`

const error = `TypeError: Cannot read properties of undefined (reading 'amount')
    at openTotal (app/invoices/total.ts:4:38)
    at Array.reduce (<anonymous>)
    at loader (app/routes/invoices.tsx:12:18)`

const source = `import { createRouter } from 'remix/router'

import { listInvoices } from './invoices.ts'

let router = createRouter()

router.get('/invoices', async ({ url }) => {
  let status = url.searchParams.get('status') ?? 'open'
  let invoices = await listInvoices({ status })

  return Response.json(invoices)
})

export { router }`

const middle = `  let overdue = invoices.filter((invoice) => invoice.dueDate < today)
  let reminders = overdue.map((invoice) => ({
    to: invoice.customer.email,
    subject: \`Invoice \${invoice.number} is overdue\`,
  }))

  return reminders
}`

const log = Array.from(
  { length: 40 },
  (_, index) => `[${String(index + 1).padStart(2, '0')}] GET /invoices 200 in ${12 + ((index * 7) % 40)}ms`,
).join('\n')

const diff: Array<{ variant: CodeBlockLineVariant; text: string }> = [
  { variant: 'default', text: 'export function formatTotal(cents: number) {' },
  { variant: 'removed', text: '  return `$${cents / 100}`' },
  { variant: 'added', text: "  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })" },
  { variant: 'added', text: '    .format(cents / 100)' },
  { variant: 'default', text: '}' },
]

// Output from a tool you don't control. It renders as text, and copying it never runs it.
const untrusted = `<script>alert("owned")</script>
<img src=x onerror="alert('owned')">
</code></pre><b>Not bold</b> &amp; not an entity`

// Colors from your own highlighter, such as GitHub's light and dark themes.
// light-dark() picks one by the color scheme, so data-theme reaches them too.
// The light keyword red is darker than GitHub's, so it keeps 4.5:1 on a
// removed line's red tint.
const tone = {
  keyword: 'light-dark(#a40e26, #ff7b72)',
  name: 'light-dark(#8250df, #d2a8ff)',
  string: 'light-dark(#0a3069, #a5d6ff)',
  number: 'light-dark(#0550ae, #79c0ff)',
  comment: 'light-dark(#57606a, #8b949e)',
}

const token = (color?: keyof typeof tone) => (text: string) => ({ text, color: color && tone[color] })
const [keyword, name, string, number, comment, plain] = [
  token('keyword'),
  token('name'),
  token('string'),
  token('number'),
  token('comment'),
  token(),
]

/** What a highlighter you run, such as on the server, might return for a small function. */
export const highlighted: CodeBlockToken[] = [
  comment('// Totals the open invoices of one customer, in cents.\n'),
  keyword('export function '),
  name('openTotal'),
  plain('(invoices: Invoice[], customer: '),
  keyword('string'),
  plain(') {\n  '),
  keyword('let '),
  plain('open = invoices.'),
  name('filter'),
  plain('((invoice) =>\n    invoice.customer === customer && invoice.status === '),
  string("'open'"),
  plain(',\n  )\n\n  '),
  keyword('return '),
  plain('open.'),
  name('reduce'),
  plain('((sum, invoice) => sum + invoice.amount, '),
  number('0'),
  plain(')\n}'),
]

function lines(code: string) {
  return splitCodeLines(code).map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)
}

export function CodeBlockPlain() {
  return () => (
    <CodeBlock>
      <CodeBlockContent>{build}</CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockWrap() {
  return () => (
    <CodeBlock>
      <CodeBlockContent wrap>{error}</CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockLineNumbers() {
  return () => (
    <CodeBlock>
      <CodeBlockContent lineNumbers>{source}</CodeBlockContent>
    </CodeBlock>
  )
}

/** A header with a title and a copy button. */
export const CodeBlockWithHeader = clientEntry(import.meta.url, function CodeBlockWithHeader() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <TerminalIcon />
          Terminal
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={install} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>{install}</CodeBlockContent>
    </CodeBlock>
  )
})

const pressedStyles = css({ '&[aria-pressed="true"]': { color: 'var(--foreground)' } })

function download(code: string, filename: string) {
  let url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
  let link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Several actions: a wrap toggle that keeps its own state and says it with
 * aria-pressed, a download, and a copy.
 */
export const CodeBlockWithActions = clientEntry(import.meta.url, function CodeBlockWithActions(handle: Handle) {
  let wrap = false

  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/routes/invoices.ts</CodeBlockTitle>
        <CodeBlockActions>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Wrap lines"
            aria-pressed={wrap ? 'true' : 'false'}
            mix={[
              pressedStyles,
              on('click', () => {
                wrap = !wrap
                void handle.update()
              }),
            ]}
          >
            <WrapTextIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Download"
            mix={on('click', () => download(source, 'invoices.ts'))}
          >
            <DownloadIcon />
          </Button>
          <CodeBlockCopyButton value={source} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap={wrap} lineNumbers>
        {source}
      </CodeBlockContent>
    </CodeBlock>
  )
})

/** Without a header, the actions float at the top end and show on hover and focus. */
export const CodeBlockFloatingActions = clientEntry(import.meta.url, function CodeBlockFloatingActions() {
  return () => (
    <CodeBlock>
      <CodeBlockActions>
        <CodeBlockCopyButton value="bun add remix@3.0.0" aria-label="Copy install command" />
      </CodeBlockActions>
      <CodeBlockContent>bun add remix@3.0.0</CodeBlockContent>
    </CodeBlock>
  )
})

export const CodeBlockDestructive = clientEntry(import.meta.url, function CodeBlockDestructive() {
  return () => (
    <CodeBlock variant="destructive">
      <CodeBlockHeader>
        <CodeBlockTitle>Error</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={error} aria-label="Copy error" />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap>{error}</CodeBlockContent>
    </CodeBlock>
  )
})

export function CodeBlockDiff() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/invoices/format.ts</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers>
        {diff.map((line, index) => (
          <CodeBlockLine key={index} variant={line.variant}>
            {line.text}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockHighlightedLines() {
  return () => (
    <CodeBlock>
      <CodeBlockContent lineNumbers>
        {splitCodeLines(source).map((line, index) => (
          <CodeBlockLine key={index} variant={index >= 6 && index <= 11 ? 'highlighted' : 'default'}>
            {line}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

const heightStyles = css({ maxHeight: '12rem' })

/** A capped height: the content scrolls inside the block. */
export const CodeBlockHeight = clientEntry(import.meta.url, function CodeBlockHeight() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>Logs</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={log} aria-label="Copy logs" />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent mix={heightStyles}>{log}</CodeBlockContent>
    </CodeBlock>
  )
})

const collapsedStyles = css({ maxHeight: '10rem', overflowY: 'hidden' })
const expandedStyles = css({ maxHeight: '18rem' })
const centerStyles = css({ justifyContent: 'center' })
// The chevron turns while the content is expanded; reduced motion skips the turn's animation.
const chevronStyles = css({
  '& svg': transition('transform'),
  '&[aria-expanded="true"] svg': { transform: 'rotate(180deg)' },
})

/**
 * Show more: the footer's button caps the content while it is collapsed and
 * points aria-controls at it. With scroll, the expanded content keeps a
 * larger cap and scrolls, so a long file doesn't take over the page.
 */
export const CodeBlockShowMore = clientEntry(
  import.meta.url,
  function CodeBlockShowMore(handle: Handle<{ scroll?: boolean }>) {
    let expanded = false

    return () => {
      let content = `${handle.id}-content`
      let code = `${source}\n\n${middle}`

      return (
        <CodeBlock>
          <CodeBlockHeader>
            <CodeBlockTitle>app/routes/invoices.ts</CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton value={code} />
            </CodeBlockActions>
          </CodeBlockHeader>
          <CodeBlockContent
            id={content}
            lineNumbers
            mix={expanded ? (handle.props.scroll ? expandedStyles : null) : collapsedStyles}
          >
            {code}
          </CodeBlockContent>
          <CodeBlockFooter mix={centerStyles}>
            <Button
              variant="ghost"
              size="xs"
              aria-expanded={expanded ? 'true' : 'false'}
              aria-controls={content}
              mix={[
                chevronStyles,
                on('click', () => {
                  expanded = !expanded
                  void handle.update()
                }),
              ]}
            >
              <ChevronDownIcon data-icon="inline-start" />
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          </CodeBlockFooter>
        </CodeBlock>
      )
    }
  },
)

/** Tokens from your own highlighter, split into lines with splitTokenLines(). */
export function CodeBlockHighlighted() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/invoices/total.ts</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers>
        {splitTokenLines(highlighted).map((line, index) => (
          <CodeBlockLine key={index} tokens={line} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockEmpty() {
  return () => (
    <CodeBlock>
      <CodeBlockContent>{''}</CodeBlockContent>
    </CodeBlock>
  )
}

export const CodeBlockSmall = clientEntry(import.meta.url, function CodeBlockSmall() {
  return () => (
    <CodeBlock size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle>
          <TerminalIcon />
          bun add remix@3.0.0
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={install} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap>{install}</CodeBlockContent>
    </CodeBlock>
  )
})

export function CodeBlockSmallDestructive() {
  return () => (
    <CodeBlock size="sm" variant="destructive">
      <CodeBlockContent wrap>{error}</CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockWrapLineNumbers() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/invoices/reminders.ts</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent wrap lineNumbers>
        {middle}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export function CodeBlockStartLine() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/invoices/reminders.ts</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers startLine={995}>
        {middle}
      </CodeBlockContent>
    </CodeBlock>
  )
}

const diffTokens: Array<{ variant: CodeBlockLineVariant; tokens: CodeBlockToken[] }> = [
  { variant: 'default', tokens: [keyword('export function '), name('formatTotal'), plain('(cents: number) {')] },
  { variant: 'removed', tokens: [plain('  '), keyword('return '), string('`$${cents / 100}`')] },
  {
    variant: 'added',
    tokens: [
      plain('  '),
      keyword('return new '),
      plain('Intl.'),
      name('NumberFormat'),
      plain('('),
      string("'en-US'"),
      plain(', { style: '),
      string("'currency'"),
      plain(', currency: '),
      string("'USD'"),
      plain(' }).'),
      name('format'),
      plain('(cents / '),
      number('100'),
      plain(')'),
    ],
  },
  { variant: 'default', tokens: [plain('}')] },
]

export function CodeBlockDiffWrap() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>app/invoices/format.ts</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent wrap lineNumbers startLine={12}>
        {diffTokens.map((line, index) => (
          <CodeBlockLine key={index} variant={line.variant} tokens={line.tokens} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

/** A title without actions, actions without a header, and a very long title that wraps. */
export const CodeBlockHeaderEdges = clientEntry(import.meta.url, function CodeBlockHeaderEdges() {
  return () => (
    <div mix={stackStyles}>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>Title only</CodeBlockTitle>
        </CodeBlockHeader>
        <CodeBlockContent>{"console.log('title, no actions')"}</CodeBlockContent>
      </CodeBlock>
      <CodeBlock>
        <CodeBlockActions>
          <CodeBlockCopyButton value={install} />
        </CodeBlockActions>
        <CodeBlockContent>{install}</CodeBlockContent>
      </CodeBlock>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <FileCodeIcon />
            app/routes/(billing)/customers/[customerId]/invoices/[invoiceId]/reminders/schedule.tsx
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value="export default function Schedule() {}" />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent>{'export default function Schedule() {}'}</CodeBlockContent>
      </CodeBlock>
    </div>
  )
})

export const CodeBlockSingleLine = clientEntry(import.meta.url, function CodeBlockSingleLine() {
  return () => (
    <div mix={stackStyles}>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>Install</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value="npx remixcn add code-block" />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent>npx remixcn add code-block</CodeBlockContent>
      </CodeBlock>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>output.log</CodeBlockTitle>
        </CodeBlockHeader>
        <CodeBlockContent>{''}</CodeBlockContent>
      </CodeBlock>
      <CodeBlock>
        <CodeBlockContent>bun run dev</CodeBlockContent>
      </CodeBlock>
    </div>
  )
})

export const CodeBlockSmallCombinations = clientEntry(import.meta.url, function CodeBlockSmallCombinations() {
  return () => (
    <div mix={stackStyles}>
      <CodeBlock size="sm">
        <CodeBlockHeader>
          <CodeBlockTitle>app/invoices/format.ts</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={diff.map((line) => line.text).join('\n')} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent lineNumbers>
          {diff.map((line, index) => (
            <CodeBlockLine key={index} variant={line.variant}>
              {line.text}
            </CodeBlockLine>
          ))}
        </CodeBlockContent>
      </CodeBlock>
      <CodeBlock size="sm">
        <CodeBlockContent lineNumbers startLine={995}>
          {middle}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  )
})

const streamed = source
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

/**
 * Code that arrives a few characters at a time, as from a model. Each new
 * value renders at once, and the copy button waits until the code is
 * complete. It starts complete; Replay streams it again.
 */
export const CodeBlockStreaming = clientEntry(
  import.meta.url,
  function CodeBlockStreaming(handle: Handle<{ step?: number; interval?: number }>) {
    let position = streamed.length
    let timer: ReturnType<typeof setInterval> | undefined

    function stop() {
      clearInterval(timer)
      timer = undefined
    }

    handle.signal.addEventListener('abort', stop)

    function replay() {
      stop()
      position = 0
      void handle.update()
      timer = setInterval(() => {
        position = Math.min(streamed.length, position + (handle.props.step ?? 3))
        if (position === streamed.length) stop()
        void handle.update()
      }, handle.props.interval ?? 16)
    }

    return () => {
      let code = streamed.slice(0, position)
      let done = position === streamed.length

      return (
        <div mix={stackStyles}>
          <CodeBlock>
            <CodeBlockHeader>
              <CodeBlockTitle>app/routes/invoices.ts</CodeBlockTitle>
              <CodeBlockActions>
                <CodeBlockCopyButton value={code} disabled={!done} />
              </CodeBlockActions>
            </CodeBlockHeader>
            <CodeBlockContent lineNumbers aria-busy={done ? undefined : 'true'}>
              {lines(code)}
            </CodeBlockContent>
          </CodeBlock>
          <div mix={rowStyles}>
            <Button variant="outline" size="sm" disabled={!done} mix={on('click', replay)}>
              <ReplayIcon data-icon="inline-start" />
              Replay
            </Button>
          </div>
        </div>
      )
    }
  },
)

/** Untrusted output renders as text, and the copy button copies it exactly. */
export const CodeBlockUntrusted = clientEntry(import.meta.url, function CodeBlockUntrusted() {
  return () => (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>tool-output.html</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={untrusted} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap lineNumbers>
        {untrusted}
      </CodeBlockContent>
    </CodeBlock>
  )
})

/** A copy button in a form copies without sending it; only the submit button does. */
export const CodeBlockInForm = clientEntry(
  import.meta.url,
  function CodeBlockInForm(handle: Handle<{ action: string }>) {
    return () => {
      let email = `${handle.id}-email`
      let command = 'npx remixcn add code-block'

      return (
        <form action={handle.props.action} method="post" mix={stackStyles}>
          <div mix={fieldStyles}>
            <label for={email}>Send the setup steps to</label>
            <input id={email} name="email" type="email" required defaultValue="dev@acme.example" mix={inputStyles} />
          </div>
          <CodeBlock>
            <CodeBlockActions>
              <CodeBlockCopyButton value={command} aria-label="Copy setup command" />
            </CodeBlockActions>
            <CodeBlockContent>{command}</CodeBlockContent>
          </CodeBlock>
          <div mix={rowStyles}>
            <Button type="submit" name="intent" value="send-steps">
              Send steps
            </Button>
          </div>
        </form>
      )
    }
  },
)

/** In right-to-left text the header and its actions mirror, and the code still reads left to right. */
export const CodeBlockRtl = clientEntry(import.meta.url, function CodeBlockRtl() {
  return () => (
    <div dir="rtl" lang="ar" mix={stackStyles}>
      <p>أنشئ ملف المسار وأعد قائمة الفواتير.</p>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>app/routes/invoices.ts</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={source} aria-label="نسخ" copiedLabel="تم النسخ" failedLabel="تعذّر النسخ" />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent lineNumbers>{source}</CodeBlockContent>
      </CodeBlock>
      <CodeBlock size="sm">
        <CodeBlockActions>
          <CodeBlockCopyButton value={install} aria-label="نسخ" copiedLabel="تم النسخ" failedLabel="تعذّر النسخ" />
        </CodeBlockActions>
        <CodeBlockContent>{install}</CodeBlockContent>
      </CodeBlock>
    </div>
  )
})
