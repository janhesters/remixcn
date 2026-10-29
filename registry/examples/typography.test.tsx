import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { tags } from '../../test/html.ts'
import {
  TypographyBlockquote,
  TypographyDemo,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyLarge,
  TypographyLead,
  TypographyList,
  TypographyMuted,
  TypographyP,
  TypographySmall,
  TypographyTable,
  typography,
} from './typography.tsx'

describe('Typography', () => {
  it('styles native elements: headings, paragraphs, a quote, a list, inline code, a link and a table', async () => {
    let html = await renderToString(<TypographyDemo />)
    let names = new Set(tags(html).map((tag) => tag.name))

    for (let name of ['h1', 'h2', 'h3', 'p', 'blockquote', 'ul', 'li', 'code', 'a', 'table', 'caption', 'th', 'td']) {
      assert.ok(names.has(name), `no <${name}>`)
    }
    for (let tag of tags(html).filter((tag) => ['h1', 'h2', 'h3', 'p', 'blockquote', 'ul', 'a'].includes(tag.name))) {
      assert.ok(tag.attributes.get('class'), `<${tag.name}> has no style`)
    }
  })

  it('keeps headings in order, so the outline has no gaps', async () => {
    let html = await renderToString(<TypographyDemo />)
    let levels = tags(html)
      .filter((tag) => /^h[1-6]$/.test(tag.name))
      .map((tag) => Number(tag.name[1]))

    assert.equal(levels[0], 1)
    for (let [index, level] of levels.entries()) {
      if (index > 0) assert.ok(level <= levels[index - 1] + 1, `h${levels[index - 1]} is followed by h${level}`)
    }
  })

  it('heads the table columns with th scope="col" and names the table with a caption', async () => {
    let html = await renderToString(<TypographyTable />)

    assert.ok(tags(html, 'th').every((th) => th.attributes.get('scope') === 'col'))
    assert.equal(tags(html, 'caption').length, 1)
  })

  it('lets a wide table scroll inside a region that keyboard users can reach and screen readers name', async () => {
    let html = await renderToString(<TypographyTable />)
    let [region] = tags(html, 'div')

    assert.equal(region.attributes.get('role'), 'region')
    assert.equal(region.attributes.get('tabindex'), '0')
    assert.ok(region.attributes.get('aria-labelledby'))
    assert.equal(tags(html, 'caption')[0].attributes.get('id'), region.attributes.get('aria-labelledby'))
  })

  it('styles only the elements you give a style to: no rule reaches the rest of the app', async () => {
    let html = await renderToString(
      <div>
        <TypographyH1 />
        <TypographyH2 />
        <TypographyH3 />
        <TypographyH4 />
        <TypographyP />
        <TypographyBlockquote />
        <TypographyList />
        <TypographyInlineCode />
        <TypographyLead />
        <TypographyLarge />
        <TypographySmall />
        <TypographyMuted />
        <TypographyTable />
      </div>,
    )
    let rules = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n')
    let selectors = [...rules.matchAll(/^\s*(?:@layer [^{]+\{\s*)?([^@{}\n][^{}\n]*)\{/gm)].map(([, selector]) =>
      selector.trim(),
    )

    assert.ok(selectors.length > 0)
    for (let selector of selectors) {
      assert.match(selector, /\.rmxc-|^&|^\d+%|^from|^to/, `${selector} styles elements without a class`)
    }
  })

  it('exports a style for every element the recipe covers', () => {
    assert.deepEqual(Object.keys(typography).sort(), [
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'inlineCode',
      'large',
      'lead',
      'link',
      'list',
      'muted',
      'p',
      'small',
      'table',
      'tableRegion',
      'td',
      'th',
      'tr',
    ])
  })
})
