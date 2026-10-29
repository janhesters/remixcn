// The Toast and Sonner examples on one synthetic page, with the page's two
// Toasters at the end of <body>. It is a test fixture for browser tests and
// UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  SonnerBasic,
  SonnerCustom,
  SonnerTypes,
  SonnerWithAction,
  SonnerWithDescription,
} from '../../../registry/examples/sonner-example.tsx'
import {
  ToastBasic,
  ToastCloseAll,
  ToastDeduplicated,
  ToastOwnProvider,
  ToastPersistent,
  ToastPromise,
  ToastRightToLeft,
  ToastTypes,
  ToastWithAction,
} from '../../../registry/examples/toast-example.tsx'
import { Toaster as SonnerToaster } from '#remixcn/ui/sonner.tsx'
import { Toaster } from '#remixcn/ui/toast.tsx'

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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  justifyItems: 'start',
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
// Room below the last example, so the bottom toasts never cover it.
const spacerStyles = css({ height: '12rem' })

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

export function ToastExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>RemixCN Toast examples</title>
          <ImportMap value={script.importMap} />
          {script.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>
          <main mix={pageStyles}>
            <header mix={headerStyles}>
              <h1 mix={titleStyles}>Toast and Sonner</h1>
              <p>Every example from registry/examples, rendered on the server and hydrated.</p>
              <p mix={mutedStyles}>
                A synthetic test fixture with invented data, not the public site. Toasts show at the bottom end,
                Sonner's at the top center. F6 and Alt+T move focus to them.
              </p>
            </header>

            <Section
              id="toast"
              title="Toast"
              description="toast.add(), update(), close() and promise(), shown by <Toaster />."
            >
              <div mix={gridStyles}>
                <Example title="Basic">
                  <ToastBasic />
                </Example>
                <Example title="Types" description="The type sets the icon." wide>
                  <ToastTypes />
                </Example>
                <Example title="With action">
                  <ToastWithAction />
                </Example>
                <Example title="Promise" description="Loading, then success.">
                  <ToastPromise />
                </Example>
                <Example title="Promise that fails">
                  <ToastPromise fail />
                </Example>
                <Example title="Persistent" description="High priority, kept until closed.">
                  <ToastPersistent />
                </Example>
                <Example title="Deduplicated" description="One id, one toast.">
                  <ToastDeduplicated />
                </Example>
                <Example title="Dismiss all">
                  <ToastCloseAll />
                </Example>
                <Example title="Own provider" description="Its toasts show at the bottom start, apart from the page's.">
                  <ToastOwnProvider />
                </Example>
                <Example title="Right to left" description="Its toasts show at the top start, on the right.">
                  <ToastRightToLeft />
                </Example>
              </div>
            </Section>

            <Section id="sonner" title="Sonner" description="Sonner's toast() and Toaster on RemixCN's Toast.">
              <div mix={gridStyles}>
                <Example title="Sonner basic">
                  <SonnerBasic />
                </Example>
                <Example title="Sonner with description">
                  <SonnerWithDescription />
                </Example>
                <Example title="Sonner types" wide>
                  <SonnerTypes />
                </Example>
                <Example title="Sonner with action">
                  <SonnerWithAction />
                </Example>
                <Example title="Sonner custom" description="Your own content, named and announced by its text.">
                  <SonnerCustom />
                </Example>
              </div>
            </Section>
            <div mix={spacerStyles} />
          </main>
          <Toaster />
          <SonnerToaster position="top-center" closeButton />
        </body>
      </html>
    )
  }
}
