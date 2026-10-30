// How the site's URLs become files on a static host, such as GitHub Pages.
// The build writes them, and the preview serves them back the same way.

const scriptExtension = /\.(tsx?|mts|jsx)$/

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assetUrlPattern(prefix: string) {
  return new RegExp(`${escapeRegExp(prefix)}[^"'\`\\s<>()\\\\#?]+`, 'g')
}

/**
 * Lists the asset URLs under `prefix` that `text` names, in order and once
 * each: in attributes, import maps, client entry ids before their `#export`,
 * and the imports of compiled modules. A directory, such as an import map
 * scope, isn't an asset.
 */
export function findAssetUrls(text: string, prefix: string): string[] {
  let urls = (text.match(assetUrlPattern(prefix)) ?? []).filter((url) => !url.endsWith('/'))
  return [...new Set(urls)]
}

/**
 * The URL an asset gets on a static host. Remix's asset server compiles
 * TypeScript to JavaScript at its own URL, but a static host picks the type
 * by the extension, and browsers load modules only with a JavaScript type.
 */
export function staticAssetUrl(url: string): string {
  return scriptExtension.test(url) ? `${url}.js` : url
}

/** Replaces each asset URL `urls` knows with its new URL, wherever `text` names it. */
export function rewriteAssetUrls(text: string, prefix: string, urls: ReadonlyMap<string, string>): string {
  return text.replace(assetUrlPattern(prefix), (url) => urls.get(url) ?? url)
}

// A static or dynamic import of a relative path, as the asset server writes them: `from "./x.ts"`, `import "./x.ts"` or `import("./x.ts")`.
const relativeImport = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"'\n]+)\2/g

/**
 * Renames the relative imports of the module at `moduleUrl` that point at a
 * renamed asset. The asset server keeps relative imports as they were
 * written, so the browser resolves them against the module's own URL.
 */
export function rewriteRelativeImports(code: string, moduleUrl: string, urls: ReadonlyMap<string, string>): string {
  return code.replace(relativeImport, (match, keyword: string, quote: string, specifier: string) => {
    let target = new URL(specifier, new URL(moduleUrl, 'http://localhost')).pathname
    let renamed = urls.get(target)
    return renamed === undefined ? match : `${keyword}${quote}${specifier}${renamed.slice(target.length)}${quote}`
  })
}

/**
 * The file, relative to the site's folder, that a static host serves for a
 * URL under `basePath`: a path that ends in a slash serves its index.html, and
 * each segment is percent-decoded. A URL that would leave the folder, or reach
 * a hidden directory, which a static host may not serve, is refused.
 */
export function staticFilePath(url: string, basePath: string): string {
  if (!url.startsWith(basePath)) throw new Error(`${url} is outside ${basePath}`)

  let path = url.slice(basePath.length)
  if (path === '' || path.endsWith('/')) path += 'index.html'

  return path
    .split('/')
    .map((segment) => {
      let decoded = decodeURIComponent(segment)
      if (decoded === '' || decoded === '.' || decoded === '..' || /[/\\\0]/.test(decoded)) {
        throw new Error(`${url} has the segment "${decoded}", which no file has`)
      }
      if (decoded.startsWith('.')) {
        throw new Error(`${url} reaches the hidden directory or file "${decoded}", which a static host may not serve`)
      }
      return decoded
    })
    .join('/')
}
