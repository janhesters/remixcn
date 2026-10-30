import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { findAssetUrls, rewriteAssetUrls, rewriteRelativeImports, staticAssetUrl, staticFilePath } from './static.ts'

describe('findAssetUrls', () => {
  it('finds asset URLs in attributes, import maps, client entry ids and compiled imports', () => {
    let text = [
      '<link rel="stylesheet" href="/remixcn/assets/registry/lib/theme.css" />',
      '{"imports":{"/registry/ui/button.tsx":"/remixcn/assets/registry/ui/button.tsx"},"scopes":{"/remixcn/assets/registry/":{}}}',
      '{"moduleUrl":"/remixcn/assets/registry/examples/button-example.tsx#ButtonForm"}',
      'import { on } from "/remixcn/assets/npm/%40remix-run%2Bcomponent%401.1.0/node_modules/%40remix-run/component/dist/index.js";',
      "import '/remixcn/assets/docs/public/theme.ts'",
    ].join('\n')

    assert.deepEqual(findAssetUrls(text, '/remixcn/assets/'), [
      '/remixcn/assets/registry/lib/theme.css',
      '/remixcn/assets/registry/ui/button.tsx',
      '/remixcn/assets/registry/examples/button-example.tsx',
      '/remixcn/assets/npm/%40remix-run%2Bcomponent%401.1.0/node_modules/%40remix-run/component/dist/index.js',
      '/remixcn/assets/docs/public/theme.ts',
    ])
  })
})

describe('staticAssetUrl', () => {
  it('gives compiled TypeScript a .js name, since a static host types files by their extension', () => {
    assert.equal(staticAssetUrl('/remixcn/assets/registry/ui/button.tsx'), '/remixcn/assets/registry/ui/button.tsx.js')
    assert.equal(staticAssetUrl('/remixcn/assets/docs/public/theme.ts'), '/remixcn/assets/docs/public/theme.ts.js')
    assert.equal(
      staticAssetUrl('/remixcn/assets/npm/remix/component/index.js'),
      '/remixcn/assets/npm/remix/component/index.js',
    )
    assert.equal(staticAssetUrl('/remixcn/assets/registry/lib/theme.css'), '/remixcn/assets/registry/lib/theme.css')
  })
})

describe('rewriteAssetUrls', () => {
  it('rewrites every URL it knows and leaves the others, such as an import map scope', () => {
    let urls = new Map([['/remixcn/assets/registry/ui/button.tsx', '/remixcn/assets/registry/ui/button.tsx.js']])
    let text =
      '{"imports":{"#remixcn/ui/button.tsx":"/remixcn/assets/registry/ui/button.tsx"},"scopes":{"/remixcn/assets/registry/":{}}} ' +
      '"/remixcn/assets/registry/ui/button.tsx#Button" "/remixcn/assets/registry/ui/button.tsxx"'

    assert.equal(
      rewriteAssetUrls(text, '/remixcn/assets/', urls),
      '{"imports":{"#remixcn/ui/button.tsx":"/remixcn/assets/registry/ui/button.tsx.js"},"scopes":{"/remixcn/assets/registry/":{}}} ' +
        '"/remixcn/assets/registry/ui/button.tsx.js#Button" "/remixcn/assets/registry/ui/button.tsxx"',
    )
  })
})

describe('rewriteRelativeImports', () => {
  it('renames the relative imports of a module that point at a renamed asset, and keeps the others', () => {
    let urls = new Map([
      ['/remixcn/assets/docs/public/theme.ts', '/remixcn/assets/docs/public/theme.ts.js'],
      ['/remixcn/assets/docs/public/search.tsx', '/remixcn/assets/docs/public/search.tsx.js'],
    ])
    let code = [
      'import { pageTheme } from "./theme.ts";',
      'export { DocsSearch } from "./search.tsx";',
      'import "./theme.ts";',
      'let lazy = import("./search.tsx");',
      'import { Button } from "../../../../registry/ui/button.tsx";',
      'let text = "./theme.ts";',
    ].join('\n')

    assert.equal(
      rewriteRelativeImports(code, '/remixcn/assets/docs/public/chrome.tsx', urls),
      [
        'import { pageTheme } from "./theme.ts.js";',
        'export { DocsSearch } from "./search.tsx.js";',
        'import "./theme.ts.js";',
        'let lazy = import("./search.tsx.js");',
        'import { Button } from "../../../../registry/ui/button.tsx";',
        'let text = "./theme.ts";',
      ].join('\n'),
    )
  })
})

describe('staticFilePath', () => {
  it('maps a URL under the base path to its file, decoded as a static host decodes it', () => {
    assert.equal(staticFilePath('/remixcn/', '/remixcn/'), 'index.html')
    assert.equal(staticFilePath('/remixcn/docs/cli/', '/remixcn/'), 'docs/cli/index.html')
    assert.equal(staticFilePath('/remixcn/404.html', '/remixcn/'), '404.html')
    assert.equal(
      staticFilePath('/remixcn/assets/npm/%40remix-run%2Bcomponent%401.1.0/x.js', '/remixcn/'),
      'assets/npm/@remix-run+component@1.1.0/x.js',
    )
  })

  it('refuses URLs outside the base path, with dot segments, or with a hidden directory a host may not serve', () => {
    assert.throws(() => staticFilePath('/other/index.html', '/remixcn/'), /outside \/remixcn\//)
    assert.throws(() => staticFilePath('/remixcn/assets/../secret', '/remixcn/'), /\.\./)
    assert.throws(() => staticFilePath('/remixcn/assets/%2e%2e/secret', '/remixcn/'), /\.\./)
    assert.throws(() => staticFilePath('/remixcn/assets/npm/.bun/x.js', '/remixcn/'), /\.bun/)
    assert.throws(() => staticFilePath('/remixcn/assets/a%2Fb.js', '/remixcn/'), /a%2Fb/)
  })
})
