import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { crumbsFor, navigation, pages, searchEntries } from './pages.ts'
import { href } from './site.ts'

describe('the pages', () => {
  it('have a unique path and title each, and the home page at the root', () => {
    assert.equal(new Set(pages.map((page) => page.path)).size, pages.length)
    assert.equal(new Set(pages.map((page) => page.title)).size, pages.length)
    assert.equal(pages[0]?.path, '')
    for (let page of pages) href(page.path)
  })

  it('have a summary each, and sections with unique ids', () => {
    for (let page of pages) {
      assert.ok(page.summary.length > 20, `${page.title} needs a summary`)
      let ids = page.sections.map((section) => section.id)
      assert.equal(new Set(ids).size, ids.length, `${page.title} repeats a section id`)
    }
  })
})

describe('navigation', () => {
  it('groups every page but home: getting started, components, tools, then the project', () => {
    assert.deepEqual(
      navigation.map((group) => group.title),
      ['Getting started', 'Components', 'Tools', 'Project'],
    )
    let linked = navigation.flatMap((group) => group.items.map((item) => item.href)).sort()
    assert.deepEqual(
      linked,
      pages
        .filter((page) => page.path !== '')
        .map((page) => href(page.path))
        .sort(),
    )
  })

  it('lists the components overview first, then the components in alphabetical order', () => {
    let [overview, ...components] = navigation.find((group) => group.title === 'Components')!.items
    assert.equal(overview?.href, href('docs/components/'))
    let titles = components.map((item) => item.title)
    assert.ok(titles.includes('Button'))
    assert.deepEqual(
      titles,
      titles.toSorted((a, b) => a.localeCompare(b, 'en')),
    )
  })

  it('lists the registry, the CLI and MCP as tools, and contributing, accessibility and licenses as the project', () => {
    let titles = (group: string) => navigation.find((entry) => entry.title === group)!.items.map((item) => item.title)
    assert.deepEqual(titles('Tools'), ['Registry', 'CLI', 'MCP server'])
    assert.deepEqual(titles('Project'), ['Contributing', 'Accessibility', 'Licenses and credits'])
  })
})

describe('searchEntries', () => {
  it('lists every page but home with its group and keywords', () => {
    assert.equal(searchEntries.length, pages.length - 1)
    let button = searchEntries.find((entry) => entry.title === 'Button')
    assert.deepEqual(button && { href: button.href, group: button.group }, {
      href: '/remixcn/docs/components/button/',
      group: 'Components',
    })
    assert.ok(button?.keywords.includes('submit'))
  })
})

describe('crumbsFor', () => {
  it('lists the pages above a page, by their short titles', () => {
    assert.deepEqual(crumbsFor('docs/components/button/'), [
      { title: 'Docs', path: 'docs/' },
      { title: 'Components', path: 'docs/components/' },
    ])
    assert.deepEqual(crumbsFor('docs/'), [])
    assert.deepEqual(crumbsFor(''), [])
  })
})
