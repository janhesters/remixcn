// Renders the site the way a Remix app does: each page through the render
// middleware, which resolves client entries, and the stylesheets and browser
// modules through Remix's asset server. The local server serves it on demand,
// and the static build fetches every page and asset from it once.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { DocsDocument, NotFoundDocument } from './document.tsx'
import type { SiteAssets } from './document.tsx'
import { pages } from './pages.ts'
import { basePath, href } from './site.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'apps/docs/app/public/docs.css']
const entry = 'apps/docs/app/public/entry.ts'

/** The URL of the page a static host shows for a path the site doesn't have. */
export const notFoundPath = `${basePath}404.html`

function listModules(directory: string, pattern: RegExp) {
  return readdirSync(join(root, directory))
    .filter((file) => pattern.test(file) && !file.includes('.test.'))
    .map((file) => `${directory}${file}`)
}

/**
 * Every module a page may hydrate: the site's own client entries and every
 * component example. Each page carries one import map for all of them, so a
 * page that Remix's runtime opens in place needs no new mappings, also in
 * browsers that support only one import map.
 */
function clientModules() {
  return [...listModules('apps/docs/app/public/', /\.tsx?$/), ...listModules('registry/examples/', /\.tsx$/)]
}

export async function createDocsSite() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: `${basePath}assets`,
    // Bun keeps packages in node_modules/.bun. Mounting it directly keeps the
    // dot directory out of the URLs a static host serves.
    mounts: {
      docs: 'apps/docs/app',
      registry: 'registry',
      npm: existsSync(join(root, 'node_modules/.bun')) ? 'node_modules/.bun' : 'node_modules',
    },
    allowFiles: ['apps/docs/app/**/public/**', 'registry/ui/**', 'registry/lib/**', 'registry/examples/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })

  let script = await assets.getScriptEntry(entry)
  let site: SiteAssets = {
    stylesheets: await Promise.all(stylesheets.map((file) => assets.getHref(file))),
    script: { ...script, importMap: await assets.getImportMap([entry, ...clientModules()]) },
  }

  let router = createRouter({ middleware: [render({ assets })] })
  router.get(
    `${basePath}assets/*`,
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  for (let page of pages) {
    router.get(href(page.path), (context) => context.render(<DocsDocument page={page} assets={site} />))
  }
  router.get('*', (context) => {
    // A static host redirects a directory without its slash; so does this server.
    let withSlash = `${context.url.pathname}/`
    if (pages.some((page) => href(page.path) === withSlash)) {
      return new Response(null, { status: 301, headers: { Location: withSlash } })
    }
    return context.render(<NotFoundDocument assets={site} />, { status: 404 })
  })

  return {
    fetch: (request: Request) => router.fetch(request),
    /** The URL of every page, then the not-found page. */
    urls: [...pages.map((page) => href(page.path)), notFoundPath],
    /** The asset server, so the static build can follow each script's imports. */
    assets,
    close: () => assets.close(),
  }
}
