import type { Handle, RemixNode } from 'remix/component'

import type { SectionInfo } from './ui.tsx'

export const groups = ['Getting started', 'Components', 'Tools', 'Project'] as const
export type Group = (typeof groups)[number]

/** A page of the site, as its content module describes it. */
export interface DocsPage {
  /** The path under the site's base path, such as `docs/cli/`, or `''` for the home page. */
  path: string
  /** The page's own title: its heading, its name in the navigation and the search, and the start of its document title. */
  title: string
  /** A shorter name in the navigation, where the group already says the rest, such as "All components". */
  navTitle?: string
  /** A shorter name in the breadcrumbs of the pages below it, such as "Docs". */
  crumbTitle?: string
  /** One or two sentences under the heading, in the description meta tag and the social tags. */
  summary: string
  /** The navigation group. The home page has none. */
  group?: Group
  /** Other words the search finds the page by. */
  keywords?: string[]
  /** The page's sections in order. Each renders its heading with `<Section>`, and the table of contents links to them. */
  sections: SectionInfo[]
  /**
   * A landing page, such as the home page: its content renders its own
   * heading and summary, and it shows no breadcrumbs or table of contents.
   */
  landing?: boolean
  Content: (handle: Handle) => () => RemixNode
}
