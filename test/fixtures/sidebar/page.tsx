// The Sidebar examples as synthetic pages: each example fills a page of its
// own, as a sidebar does in an app, and the gallery shows them side by side
// in frames. A query string picks the page on screen (`page`), the docs
// version (`version`), a sidebar that starts collapsed (`open=false`), the
// theme (`theme=dark`) and right-to-left text (`dir=rtl`). It is a test
// fixture for browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  SidebarControlled,
  SidebarDocs,
  SidebarFloatingRight,
  SidebarIcons,
  SidebarInsetLayout,
  SidebarSettings,
} from '../../../registry/examples/sidebar-example.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

export const examples = {
  docs: { title: 'Documentation', description: "shadcn's example: it slides off the screen, with a rail on its edge." },
  icons: { title: 'Collapses to icons', description: 'Labels show in tooltips; projects come and go.' },
  floating: {
    title: 'Floating on the right',
    description: 'The floating variant on the right edge, collapsing to icons.',
  },
  inset: { title: 'Inset', description: 'The page sits in a rounded panel beside it.' },
  controlled: { title: 'Controlled', description: 'A switch keeps the state; the shortcut is off; 20rem wide.' },
  settings: { title: 'Never collapses', description: 'A settings column in a card, with a group still loading.' },
} as const

export type ExampleName = keyof typeof examples

export function isExampleName(name: string): name is ExampleName {
  return Object.hasOwn(examples, name)
}

function Document(
  handle: Handle<{
    title: string
    stylesheets: string[]
    script?: ScriptEntry
    theme?: string
    dir?: 'ltr' | 'rtl'
    children?: RemixNode
  }>,
) {
  return () => {
    let { title, stylesheets, script, theme, dir, children } = handle.props

    return (
      <html lang="en" dir={dir} data-theme={theme}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          {script ? (
            <>
              <ImportMap value={script.importMap} />
              {script.preloads.map((href) => (
                <link key={href} rel="modulepreload" href={href} />
              ))}
              <script type="module" src={script.href}></script>
            </>
          ) : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function Example(handle: Handle<{ name: ExampleName; search: URLSearchParams }>) {
  return () => {
    let { name, search } = handle.props
    let current = search.get('page') ?? undefined
    let defaultOpen = search.get('open') !== 'false'

    switch (name) {
      case 'docs':
        return <SidebarDocs current={current} version={search.get('version') ?? undefined} defaultOpen={defaultOpen} />
      case 'icons':
        return <SidebarIcons current={current} defaultOpen={defaultOpen} />
      case 'floating':
        return <SidebarFloatingRight current={current} />
      case 'inset':
        return <SidebarInsetLayout current={current} />
      case 'controlled':
        return <SidebarControlled current={current} defaultOpen={defaultOpen} />
      case 'settings':
        return <SidebarSettings current={current} />
    }
  }
}

/** One example on a page of its own. */
export function ExamplePage(
  handle: Handle<{ name: ExampleName; search: URLSearchParams; stylesheets: string[]; script: ScriptEntry }>,
) {
  return () => {
    let { name, search, stylesheets, script } = handle.props
    let theme = search.get('theme') ?? undefined
    let dir = search.get('dir') === 'rtl' ? ('rtl' as const) : undefined

    return (
      <Document
        title={`RemixCN Sidebar: ${examples[name].title}`}
        stylesheets={stylesheets}
        script={script}
        theme={theme}
        dir={dir}
      >
        <Example name={name} search={search} />
      </Document>
    )
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const galleryStyles = css({
  maxWidth: '84rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(8),
  '@media (max-width: 40rem)': { padding: space(4) },
})
const introStyles = css({
  display: 'grid',
  gap: space(2),
  '& h1': { margin: 0, fontSize: 'var(--text-3xl)', lineHeight: 'var(--text-3xl--line-height)', fontWeight: 600 },
  '& p': { margin: 0, maxWidth: '44rem', color: 'var(--muted-foreground)', overflowWrap: 'anywhere' },
})
// One column, so each frame is wider than the 48rem breakpoint on a wide screen.
const gridStyles = css({ display: 'grid', gap: space(8), gridTemplateColumns: 'minmax(0, 1fr)' })
const figureStyles = css({
  display: 'grid',
  gap: space(2),
  margin: 0,
  '& h2': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
  '& figcaption': { display: 'grid', gap: space(1), color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)' },
  '& iframe': {
    width: '100%',
    height: '30rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--background)',
  },
})

/** Every example in a frame of its own, so each lays out against its own window. */
export function Gallery(handle: Handle<{ stylesheets: string[]; search: URLSearchParams }>) {
  return () => {
    let { stylesheets, search } = handle.props
    let theme = search.get('theme') ?? undefined
    let query = theme ? `?theme=${encodeURIComponent(theme)}` : ''

    return (
      <Document title="RemixCN Sidebar examples" stylesheets={stylesheets} theme={theme}>
        <main mix={galleryStyles}>
          <header mix={introStyles}>
            <h1>Sidebar</h1>
            <p>
              Every example from registry/examples/sidebar-example.tsx, each in a frame of its own, as a sidebar fills
              its window. Below 48rem the sidebar turns into a sheet.
            </p>
            <p>A synthetic test fixture with invented data, not the public site.</p>
          </header>
          <div mix={gridStyles}>
            {(Object.keys(examples) as ExampleName[]).map((name) => (
              <figure key={name} mix={figureStyles} data-example={name}>
                <figcaption>
                  <h2>{examples[name].title}</h2>
                  <span>{examples[name].description}</span>
                </figcaption>
                <iframe src={`/${name}${query}`} title={`Sidebar example: ${examples[name].title}`} loading="eager" />
              </figure>
            ))}
          </div>
        </main>
      </Document>
    )
  }
}
