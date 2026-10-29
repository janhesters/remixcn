// The Code Block examples on one synthetic page, with both themes side by
// side and right-to-left text. It is a test fixture for browser tests and UI
// reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  CodeBlockDestructive,
  CodeBlockDiff,
  CodeBlockDiffWrap,
  CodeBlockEmpty,
  CodeBlockFloatingActions,
  CodeBlockHeaderEdges,
  CodeBlockHeight,
  CodeBlockHighlighted,
  CodeBlockHighlightedLines,
  CodeBlockInForm,
  CodeBlockLineNumbers,
  CodeBlockPlain,
  CodeBlockRtl,
  CodeBlockShowMore,
  CodeBlockSingleLine,
  CodeBlockSmall,
  CodeBlockSmallCombinations,
  CodeBlockSmallDestructive,
  CodeBlockStartLine,
  CodeBlockStreaming,
  CodeBlockUntrusted,
  CodeBlockWithActions,
  CodeBlockWithHeader,
  CodeBlockWrap,
  CodeBlockWrapLineNumbers,
} from '../../../registry/examples/code-block-example.tsx'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '#remixcn/ui/code-block.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '72rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
// A long path such as registry/examples may break, so large text still reflows.
const headerStyles = css({
  display: 'grid',
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
})
const gridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 26rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
})
const wideStyles = css({ gridColumn: '1 / -1' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0 },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(handle: Handle<{ title: string; description?: string; wide?: boolean; children?: RemixNode }>) {
  return () => {
    let { title, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={title}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(
  handle: Handle<{ title: string; stylesheets: string[]; script?: ScriptEntry; children?: RemixNode }>,
) {
  return () => {
    let { title, stylesheets, script, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          {script ? <ImportMap value={script.importMap} /> : null}
          {script?.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {script ? <script type="module" src={script.href}></script> : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <CodeBlockWithHeader />
        <CodeBlockHighlighted />
        <CodeBlockDiff />
        <CodeBlockDestructive />
        <CodeBlockSmall />
      </div>
    )
  }
}

export function CodeBlockExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Code Block examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Code Block</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated where it handles events.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented code and output, not the public site. The form posts to /echo, which
            shows what the server received.
          </p>
        </header>

        <Section id="content" title="Content" description="Plain output, wrapping, line numbers and a capped height.">
          <div mix={gridStyles}>
            <Example title="Plain">
              <CodeBlockPlain />
            </Example>
            <Example title="Wrap">
              <CodeBlockWrap />
            </Example>
            <Example title="Line numbers">
              <CodeBlockLineNumbers />
            </Example>
            <Example title="Start line" description="Numbers from line 995; the gutter grows to fit.">
              <CodeBlockStartLine />
            </Example>
            <Example title="Wrap and line numbers">
              <CodeBlockWrapLineNumbers />
            </Example>
            <Example title="Height" description="The logs scroll inside the block.">
              <CodeBlockHeight />
            </Example>
            <Example title="Empty">
              <CodeBlockEmpty />
            </Example>
            <Example title="Untrusted output" description="Markup in the code renders as text and never runs.">
              <CodeBlockUntrusted />
            </Example>
          </div>
        </Section>

        <Section id="actions" title="Header and actions" description="Titles, copy buttons and other actions.">
          <div mix={gridStyles}>
            <Example title="Header">
              <CodeBlockWithHeader />
            </Example>
            <Example title="Actions" description="A wrap toggle, a download and a copy.">
              <CodeBlockWithActions />
            </Example>
            <Example title="Floating actions" description="They show on hover, on focus and on touch screens.">
              <CodeBlockFloatingActions />
            </Example>
            <Example title="Header edges">
              <CodeBlockHeaderEdges />
            </Example>
            <Example title="Single line and empty">
              <CodeBlockSingleLine />
            </Example>
            <Example title="In a form" description="Copying doesn't send the form; Send steps does.">
              <CodeBlockInForm action="/echo" />
            </Example>
            <Example title="Show more" wide>
              <CodeBlockShowMore />
            </Example>
            <Example title="Show more with max height" description="Expanded, it scrolls past 18rem." wide>
              <CodeBlockShowMore scroll />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry, so its copy button stays disabled."
            >
              <CodeBlock>
                <CodeBlockHeader>
                  <CodeBlockTitle>Server only</CodeBlockTitle>
                  <CodeBlockActions>
                    <CodeBlockCopyButton value="bun run build" />
                  </CodeBlockActions>
                </CodeBlockHeader>
                <CodeBlockContent>bun run build</CodeBlockContent>
              </CodeBlock>
            </Example>
          </div>
        </Section>

        <Section id="lines" title="Lines" description="Diffs, highlighted lines and tokens from your own highlighter.">
          <div mix={gridStyles}>
            <Example title="Diff" description="Each change has a + or − marker as well as a tint.">
              <CodeBlockDiff />
            </Example>
            <Example title="Highlighted lines">
              <CodeBlockHighlightedLines />
            </Example>
            <Example title="Syntax highlighting" description="Tokens with light and dark colors.">
              <CodeBlockHighlighted />
            </Example>
            <Example title="Diff, wrap and highlighting">
              <CodeBlockDiffWrap />
            </Example>
          </div>
        </Section>

        <Section id="sizes" title="Sizes and tones" description="The small size for tool output, and errors.">
          <div mix={gridStyles}>
            <Example title="Destructive">
              <CodeBlockDestructive />
            </Example>
            <Example title="Small">
              <CodeBlockSmall />
            </Example>
            <Example title="Small destructive">
              <CodeBlockSmallDestructive />
            </Example>
            <Example title="Small combinations">
              <CodeBlockSmallCombinations />
            </Example>
          </div>
        </Section>

        <Section id="streaming" title="Streaming" description="Each new value renders at once.">
          <div mix={gridStyles}>
            <Example title="Streaming" description="Copy waits until the code is complete." wide>
              <CodeBlockStreaming />
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the header and the floating actions mirror. Code reads left to right."
        >
          <div mix={gridStyles}>
            <Example title="من اليمين إلى اليسار" wide>
              <CodeBlockRtl />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}

export function Echo(
  handle: Handle<{ stylesheets: string[]; method: string; path: string; fields: Array<[string, string]> }>,
) {
  return () => {
    let { stylesheets, method, path, fields } = handle.props

    return (
      <Document title="Received" stylesheets={stylesheets}>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Received</h1>
          <p data-echo="request">
            {method} {path}
          </p>
          <dl mix={echoListStyles} data-echo="fields">
            {fields.map(([name, value], index) => (
              <div key={`${name}-${index}`}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <a href="/">Back to the examples</a>
        </main>
      </Document>
    )
  }
}
