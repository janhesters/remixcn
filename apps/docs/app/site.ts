// The site's name, phrase and URLs (C-976, C-981). GitHub Pages serves the
// site under the project path, so every page and asset URL starts with
// basePath, and the local preview serves the same files under it.

export const siteName = 'RemixCN'
export const seoPhrase = 'shadcn components for Remix V3'
export const siteTitle = `${siteName} - ${seoPhrase}`
export const homepage = 'https://janhesters.github.io/remixcn/'
export const basePath = new URL(homepage).pathname
export const repository = 'https://github.com/janhesters/remixcn'

/**
 * The URL of a page on the site, such as `href('docs/cli/')`. A page path
 * ends in a slash, so a static host serves its `index.html` without a
 * redirect; a fragment may follow.
 */
export function href(path = ''): string {
  let [page = '', fragment] = path.split('#', 2)
  if (page !== '' && (!/^[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(page) || page.includes('..'))) {
    throw new Error(`"${path}" is not a page path: use lowercase segments that end in a slash, such as docs/cli/`)
  }
  return `${basePath}${page}${fragment === undefined ? '' : `#${fragment}`}`
}

/** The absolute URL of a page on the approved homepage, for canonical and social tags. */
export function canonicalUrl(path: string): string {
  return new URL(href(path), homepage).href
}

/** The document title: the page's own title first, and the site title on every page. */
export function pageTitle(title?: string): string {
  return title === undefined ? siteTitle : `${title} - ${siteTitle}`
}
