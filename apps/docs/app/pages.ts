// Every page of the site, and the navigation, breadcrumbs and search the
// layout builds from them.
import { page as accessibility } from './content/accessibility.tsx'
import { page as cli } from './content/cli.tsx'
import { componentPages, page as components } from './content/components.tsx'
import { page as contributing } from './content/contributing.tsx'
import { page as home } from './content/home.tsx'
import { page as introduction } from './content/introduction.tsx'
import { page as licenses } from './content/licenses.tsx'
import { page as mcp } from './content/mcp.tsx'
import { page as registry } from './content/registry.tsx'
import { groups } from './page.ts'
import type { DocsPage } from './page.ts'
import type { NavGroup } from './public/chrome.tsx'
import type { SearchEntry } from './public/search.tsx'
import { href } from './site.ts'
import type { Crumb } from './ui.tsx'

export const pages: DocsPage[] = [
  home,
  introduction,
  components,
  ...componentPages,
  registry,
  cli,
  mcp,
  contributing,
  accessibility,
  licenses,
]

export const navigation: NavGroup[] = groups.map((title) => ({
  title,
  items: pages
    .filter((page) => page.group === title)
    .map((page) => ({ title: page.navTitle ?? page.title, href: href(page.path) })),
}))

export const searchEntries: SearchEntry[] = pages
  .filter((page) => page.group !== undefined)
  .map((page) => ({ title: page.title, href: href(page.path), group: page.group!, keywords: page.keywords ?? [] }))

/** The pages above a page, nearest last, such as Docs and Components above Button. */
export function crumbsFor(path: string): Crumb[] {
  let segments = path.split('/').filter(Boolean)
  return segments
    .slice(0, -1)
    .map((_, index) => `${segments.slice(0, index + 1).join('/')}/`)
    .flatMap((ancestor) => {
      let found = pages.find((page) => page.path === ancestor)
      return found ? [{ title: found.crumbTitle ?? found.title, path: found.path }] : []
    })
}
