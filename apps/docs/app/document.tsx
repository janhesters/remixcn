// The document every page renders: the head with its title, description,
// canonical and social tags, the stylesheets and the browser entry, then the
// skip links, the chrome, the page with its table of contents, and the credits.
import { unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import type { DocsPage } from './page.ts'
import { crumbsFor, navigation, searchEntries } from './pages.ts'
import { DocsChrome } from './public/chrome.tsx'
import { themeScript } from './public/theme.ts'
import { canonicalUrl, href, pageTitle, repository, seoPhrase, siteName } from './site.ts'
import { A, PageHeader } from './ui.tsx'
import type { SectionInfo } from './ui.tsx'

export interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

export interface SiteAssets {
  /** theme.css first, so its @layer statement orders the layers, then the site's own. */
  stylesheets: string[]
  script: ScriptEntry
}

/** The description meta tag: the page's summary, and the approved phrase on every page. */
export function describePage(page: Pick<DocsPage, 'summary'>): string {
  return page.summary.includes(seoPhrase) ? page.summary : `${page.summary} ${siteName}: ${seoPhrase}.`
}

interface DocumentProps {
  title: string
  description: string
  /** The page's path for its canonical URL, or undefined for a page no one should index. */
  path?: string
  assets: SiteAssets
  children?: RemixNode
}

function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, description, path, assets, children } = handle.props
    let canonical = path === undefined ? undefined : canonicalUrl(path)

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <title>{title}</title>
          <meta name="description" content={description} />
          {canonical ? <link rel="canonical" href={canonical} /> : <meta name="robots" content="noindex" />}
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          {canonical ? <meta property="og:url" content={canonical} /> : null}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <script innerHTML={unsafeHTML(themeScript)} />
          {assets.stylesheets.map((stylesheet) => (
            <link key={stylesheet} rel="stylesheet" href={stylesheet} />
          ))}
          <ImportMap value={assets.script.importMap} />
          {assets.script.preloads.map((preload) => (
            <link key={preload} rel="modulepreload" href={preload} />
          ))}
          <script type="module" src={assets.script.href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function TableOfContents(handle: Handle<{ sections: SectionInfo[] }>) {
  return () =>
    handle.props.sections.length === 0 ? null : (
      <nav aria-labelledby="docs-toc-title" data-docs-toc="">
        <p id="docs-toc-title">On this page</p>
        <ul>
          {handle.props.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>
    )
}

function Credits() {
  return () => (
    <footer data-docs-footer="">
      <p>
        {siteName} is MIT licensed. It adapts <A href="https://github.com/shadcn-ui/ui">shadcn/ui</A> (MIT, Copyright
        (c) 2023 shadcn) and the accessible behavior of <A href="https://github.com/mui/base-ui">Base UI</A> (MIT,
        Copyright (c) 2019 Material-UI SAS), and builds on <A href="https://github.com/remix-run/remix">Remix</A> (MIT,
        Copyright (c) 2025 Shopify Inc.). <A to="docs/licenses/">Licenses</A>
      </p>
    </footer>
  )
}

/** The header's links on every page: the docs and the component reference (C-979), then GitHub. */
const headerLinks = [
  { title: 'Docs', href: href('docs/') },
  { title: 'Components', href: href('docs/components/') },
]

interface LayoutProps {
  /** The URL the navigation marks as the current page, if any. */
  current?: string
  title: string
  summary: string
  crumbs: ReturnType<typeof crumbsFor>
  sections: SectionInfo[]
  children?: RemixNode
}

function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { current = '', title, summary, crumbs, sections, children } = handle.props

    return (
      <>
        <div data-docs-skip-links="">
          <a href="#main-content">Skip to content</a>
          <a href="#docs-navigation">Skip to navigation</a>
        </div>
        <div data-docs-layout="">
          <DocsChrome
            current={current}
            navigation={navigation}
            links={headerLinks}
            search={searchEntries}
            home={href()}
            repository={repository}
          />
          <div data-docs-body="">
            <main id="main-content" tabIndex={-1} data-docs-main="">
              <div data-docs-page="">
                <PageHeader crumbs={crumbs} title={title} summary={summary} />
                <TableOfContents sections={sections} />
                <div data-docs-content="">{children}</div>
              </div>
            </main>
            <Credits />
          </div>
        </div>
      </>
    )
  }
}

/** A page of the site, from its content module. */
export function DocsDocument(handle: Handle<{ page: DocsPage; assets: SiteAssets }>) {
  return () => {
    let { page, assets } = handle.props
    let { Content } = page

    return (
      <Document
        title={pageTitle(page.path === '' ? undefined : page.title)}
        description={describePage(page)}
        path={page.path}
        assets={assets}
      >
        <Layout
          current={href(page.path)}
          title={page.title}
          summary={page.summary}
          crumbs={crumbsFor(page.path)}
          sections={page.sections}
        >
          <Content />
        </Layout>
      </Document>
    )
  }
}

/** The page a static host shows for a URL the site doesn't have. */
export function NotFoundDocument(handle: Handle<{ assets: SiteAssets }>) {
  return () => {
    let summary = 'There is no page at this address. Search the docs, or start from the components.'

    return (
      <Document
        title={pageTitle('Page not found')}
        description={describePage({ summary })}
        assets={handle.props.assets}
      >
        <Layout title="Page not found" summary={summary} crumbs={[]} sections={[]}>
          <p>
            <A to="docs/components/">Browse the components</A> or <A to="">go to the home page</A>.
          </p>
        </Layout>
      </Document>
    )
  }
}
