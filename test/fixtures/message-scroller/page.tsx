// The Message Scroller showcase: a synthetic page with every example and a
// right-to-left section. It is a local fixture for tests and screenshots, not
// the public site.
import type { ScriptEntry } from 'remix/assets'
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import * as examples from '../../../registry/examples/message-scroller-example.tsx'

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
const headerStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(2),
  '& p': { margin: 0, maxWidth: '44rem' },
})
const titleStyles = css({
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  margin: 0,
  fontWeight: 600,
  letterSpacing: '-0.025em',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(4) })
const sectionTitleStyles = css({
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  margin: 0,
  fontWeight: 600,
})
const descriptionStyles = css({
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  margin: 0,
  color: 'var(--muted-foreground)',
})
const gridStyles = css({
  display: 'grid',
  gap: space(4),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 26rem), 1fr))',
  alignItems: 'start',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(4),
  minWidth: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    margin: 0,
    fontWeight: 500,
    color: 'var(--muted-foreground)',
  },
  '@media (max-width: 40rem)': { padding: space(3) },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props
    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={descriptionStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(handle: Handle<{ name: string; title: string; children?: RemixNode }>) {
  return () => (
    <article data-example={handle.props.name} mix={exampleStyles}>
      <h3>{handle.props.title}</h3>
      {handle.props.children}
    </article>
  )
}

export function MessageScrollerPage(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>RemixCN Message Scroller</title>
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <ImportMap value={script.importMap} />
          {script.preloads.map((preload) => (
            <link key={preload} rel="modulepreload" href={preload} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>
          <main mix={pageStyles}>
            <header mix={headerStyles}>
              <h1 mix={titleStyles}>Message Scroller</h1>
              <p>
                Synthetic examples of RemixCN's chat transcript scroller, after shadcn/ui's examples, with an invented
                billing assistant whose replies are scripted. The server renders every message. The browser opens each
                transcript at its place, follows the reply while you stay at the end, and keeps your place while content
                changes.
              </p>
            </header>

            <Section
              id="chat"
              title="Chat"
              description="Send the scripted questions. Each starts near the top, and the reply streams in below it. Scroll up while it streams, and the view stays where you are."
            >
              <div mix={gridStyles}>
                <Example name="message-scroller-demo" title="Streaming chat">
                  <examples.MessageScrollerDemo />
                </Example>
                <Example name="message-scroller-history" title="Loading earlier messages">
                  <examples.MessageScrollerLoadHistory />
                </Example>
              </div>
            </Section>

            <Section
              id="navigation"
              title="Opening and jumping"
              description="A saved thread opens at its last question. Controls outside the frame jump to any message and mark the one you're reading."
            >
              <div mix={gridStyles}>
                <Example name="message-scroller-opening" title="Opening at the last question">
                  <examples.MessageScrollerOpeningPosition />
                </Example>
                <Example name="message-scroller-commands" title="Commands and outline">
                  <examples.MessageScrollerCommands />
                </Example>
              </div>
            </Section>

            <Section
              id="right-to-left"
              title="Right to left"
              description="Messages, authors and the jump button follow the text direction."
            >
              <div dir="rtl" lang="ar" mix={gridStyles}>
                <Example name="message-scroller-rtl" title="محادثة الفواتير">
                  <examples.MessageScrollerRightToLeft />
                </Example>
              </div>
            </Section>
          </main>
        </body>
      </html>
    )
  }
}
