// Writes the static site GitHub Pages serves under /remixcn/: each page as
// <path>/index.html, so a direct load of a nested page works without server
// rewrites, 404.html, the stylesheets and every browser module the pages
// load, and .nojekyll. It fetches them all from the same router `bun run docs`
// serves, and fails on any page or asset that doesn't answer.
// Usage: node --import remix/node-tsx apps/docs/build.ts [--out dist/site]
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { createDocsSite, notFoundPath } from './app/router.tsx'
import { basePath } from './app/site.ts'
import { findAssetUrls, rewriteAssetUrls, rewriteRelativeImports, staticAssetUrl, staticFilePath } from './static.ts'

/** Marks a site build. GitHub Pages then serves the files as they are, without Jekyll. */
const marker = '.nojekyll'
const assetPrefix = `${basePath}assets/`

export interface SiteBuild {
  pages: number
  assets: number
}

/** Builds the site into `out`. It replaces only an earlier site build, never a folder with other files. */
export async function buildSite(out: string): Promise<SiteBuild> {
  if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, marker))) {
    throw new Error(`${out} holds files that aren't a site build, so the build won't replace it`)
  }

  let site = await createDocsSite()
  try {
    let get = (url: string) => site.fetch(new Request(new URL(url, 'http://localhost')))

    let pages = new Map<string, string>()
    for (let url of site.urls) {
      let response = await get(url)
      let expected = url === notFoundPath ? 404 : 200
      if (response.status !== expected) throw new Error(`${url} answered ${response.status}, not ${expected}`)
      pages.set(url, await response.text())
    }

    // Follows every asset the pages name, and every asset those name in turn.
    let assets = new Map<string, string | Uint8Array>()
    let queue = [...pages.values()].flatMap((html) => findAssetUrls(html, assetPrefix))
    let seen = new Set(queue)
    let follow = (url: string) => {
      if (seen.has(url)) return
      seen.add(url)
      queue.push(url)
    }

    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      let response = await get(url)
      if (response.status !== 200) throw new Error(`${url} answered ${response.status}`)
      let type = response.headers.get('content-type') ?? ''

      if (!/javascript|css/.test(type)) {
        assets.set(url, new Uint8Array(await response.arrayBuffer()))
        continue
      }

      let text = await response.text()
      assets.set(url, text)
      findAssetUrls(text, assetPrefix).forEach(follow)
      if (type.includes('javascript')) {
        let { filePath } = await site.assets.getAssetDetails(url)
        if (filePath) (await site.assets.getPreloads(filePath)).forEach(follow)
      }
    }

    let renamed = new Map([...assets.keys()].map((url) => [url, staticAssetUrl(url)]))
    let files = new Map<string, string | Uint8Array>()
    for (let [url, html] of pages)
      files.set(staticFilePath(url, basePath), rewriteAssetUrls(html, assetPrefix, renamed))
    for (let [url, body] of assets) {
      files.set(
        staticFilePath(renamed.get(url)!, basePath),
        typeof body === 'string'
          ? rewriteRelativeImports(rewriteAssetUrls(body, assetPrefix, renamed), url, renamed)
          : body,
      )
    }

    rmSync(out, { recursive: true, force: true })
    for (let [path, body] of files) {
      mkdirSync(dirname(join(out, path)), { recursive: true })
      writeFileSync(join(out, path), body)
    }
    writeFileSync(join(out, marker), '')

    return { pages: pages.size, assets: assets.size }
  } finally {
    await site.close()
  }
}

if (import.meta.main) {
  let { values } = parseArgs({ options: { out: { type: 'string' } } })
  let out = resolve(values.out ?? fileURLToPath(new URL('../../dist/site', import.meta.url)))

  try {
    let { pages, assets } = await buildSite(out)
    let shown = relative(process.cwd(), out)
    process.stdout.write(`✓ Built ${pages} pages and ${assets} assets into ${shown.startsWith('..') ? out : shown}\n`)
    process.stdout.write(`  Run \`bun run preview:site\` to serve them under ${basePath}\n`)
  } catch (error) {
    process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
