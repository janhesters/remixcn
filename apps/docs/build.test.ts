import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { afterAll, beforeAll, describe, it } from 'remix/test'

import { pages } from './app/pages.ts'
import { basePath, canonicalUrl, homepage, href, seoPhrase, siteTitle } from './app/site.ts'
import { buildSite } from './build.ts'
import { findAssetUrls, staticFilePath } from './static.ts'

let out = ''
let files: string[] = []

beforeAll(
  async () => {
    out = mkdtempSync(join(tmpdir(), 'remixcn-site-'))
    await buildSite(out)
    files = readdirSync(out, { recursive: true, encoding: 'utf8' }).filter((file) => file.includes('.'))
  },
  { timeout: 60_000 },
)

afterAll(() => rmSync(out, { recursive: true, force: true }))

function read(file: string) {
  return readFileSync(join(out, file), 'utf8')
}

function attribute(html: string, selector: RegExp) {
  return selector.exec(html)?.[1]
}

function exists(url: string) {
  try {
    return existsSync(join(out, staticFilePath(url, basePath)))
  } catch {
    return false
  }
}

describe('the site build', () => {
  it('writes each page as its index.html, the not-found page, and the marker that keeps Jekyll out', () => {
    for (let page of pages) assert.ok(exists(href(page.path)), `${href(page.path)} has no index.html`)
    assert.ok(files.includes('404.html'))
    assert.ok(files.includes('.nojekyll'))
  })

  it('titles and describes every page with the approved phrase, and links it on the approved homepage', () => {
    for (let page of pages) {
      let html = read(staticFilePath(href(page.path), basePath))
      let title = attribute(html, /<title>([^<]*)<\/title>/)
      let canonical = canonicalUrl(page.path)

      assert.equal(title, page.path === '' ? siteTitle : `${page.title} - ${siteTitle}`)
      assert.ok(canonical.startsWith(homepage))
      assert.equal(attribute(html, /<link rel="canonical" href="([^"]*)"/), canonical)
      assert.equal(attribute(html, /<meta property="og:url" content="([^"]*)"/), canonical)
      assert.equal(attribute(html, /<meta property="og:title" content="([^"]*)"/), title)
      assert.equal(attribute(html, /<meta name="twitter:title" content="([^"]*)"/), title)
      for (let tag of [
        /<meta name="description" content="([^"]*)"/,
        /<meta property="og:description" content="([^"]*)"/,
      ]) {
        assert.ok(attribute(html, tag)?.includes(seoPhrase), `${href(page.path)}: ${tag} lacks the phrase`)
      }
    }

    let notFound = read('404.html')
    assert.match(notFound, /<meta name="robots" content="noindex"/)
    assert.doesNotMatch(notFound, /rel="canonical"/)
  })

  it('links only to pages and files the build holds', () => {
    for (let file of files.filter((name) => name.endsWith('.html'))) {
      // Tags only: source shown as text has its < escaped, so it never opens one.
      let links = [...read(file).matchAll(/<(?:a|link)\s[^>]*?\bhref="(\/[^"#]*)/g)].map((match) => match[1]!)
      assert.ok(links.length > 0)
      for (let link of links) assert.ok(exists(link), `${file} links to ${link}, which the build doesn't hold`)
    }
  })

  it('holds every asset a page, a module or a stylesheet names, under names a static host serves as code', () => {
    for (let file of files.filter((name) => /\.(html|js|css)$/.test(name))) {
      for (let url of findAssetUrls(read(file), `${basePath}assets/`)) {
        assert.ok(exists(url), `${file} names ${url}, which the build doesn't hold`)
      }
    }

    for (let file of files.filter((name) => name.endsWith('.js'))) {
      let module = `${basePath}${file}`
      for (let [, specifier] of read(file).matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)"(\.{1,2}\/[^"]+)"/g)) {
        let target = new URL(specifier!, new URL(module, 'http://localhost')).pathname
        // Paths above the site resolve through the import map, which the previous loop checked.
        if (target.startsWith(basePath)) assert.ok(exists(target), `${file} imports ${specifier}, which is missing`)
      }
    }

    assert.deepEqual(
      files.filter((file) => /\.(tsx?|mts|jsx)$/.test(file)),
      [],
    )
    assert.deepEqual(
      files.filter((file) => file !== '.nojekyll' && file.split('/').some((segment) => segment.startsWith('.'))),
      [],
    )
  })

  it("shows the examples' source as text", () => {
    let html = read('docs/components/button/index.html')
    assert.match(html, /&lt;form action=\{action\} method="post" mix=\{stackStyles\}&gt;/)
    assert.equal(html.match(/<form\b/g)?.length, 1, 'only the example renders a form')
  })

  it('renders every example inert, so it does nothing until its guard runs in the browser', () => {
    let html = read('docs/components/button/index.html')
    let canvases = [...html.matchAll(/<div data-docs-canvas=""[^>]*>/g)].map(([tag]) => tag)
    let previews = [...html.matchAll(/<div data-docs-preview=""[^>]*>/g)].map(([tag]) => tag)

    assert.equal(canvases.length, 4)
    for (let canvas of canvases) assert.match(canvas, /\sinert(?:=""|\s|>)/)
    for (let preview of previews) assert.match(preview, /\sdata-pending=""/)
    assert.equal(html.match(/This example runs with JavaScript\./g)?.length, 4)
  })

  it('replaces an earlier build, but no folder with other files', { timeout: 60_000 }, async () => {
    let other = mkdtempSync(join(tmpdir(), 'remixcn-other-'))
    try {
      mkdirSync(join(other, 'notes'))
      writeFileSync(join(other, 'notes', 'todo.txt'), 'Keep me\n')

      await assert.rejects(buildSite(other), /holds files that aren't a site build/)
      assert.equal(readFileSync(join(other, 'notes', 'todo.txt'), 'utf8'), 'Keep me\n')

      writeFileSync(join(out, 'stale.html'), '<p>Old</p>\n')
      await buildSite(out)
      assert.equal(existsSync(join(out, 'stale.html')), false)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})
