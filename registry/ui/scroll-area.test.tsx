import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { ScrollArea, ScrollBar } from './scroll-area.tsx'

interface Tag {
  name: string
  attributes: Map<string, string>
  index: number
}

function tags(html: string): Tag[] {
  return [...html.matchAll(/<([a-z][a-z0-9-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/g)].map((match) => ({
    name: match[1] ?? '',
    index: match.index,
    attributes: new Map(
      [...(match[2] ?? '').matchAll(/\s+([^\s=>]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key ?? '', value ?? '']),
    ),
  }))
}

function slots(html: string, slot: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === slot)
}

const tagNames = Array.from({ length: 20 }, (_, index) => `v1.2.0-beta.${20 - index}`)

describe('ScrollArea on the server', () => {
  it('renders a native, focusable viewport around the content, with a vertical scrollbar and a corner beside it', async () => {
    let html = await renderToString(
      <ScrollArea>
        <h4>Tags</h4>
        {tagNames.map((name) => (
          <p key={name}>{name}</p>
        ))}
      </ScrollArea>,
    )

    let [root] = slots(html, 'scroll-area')
    let [viewport] = slots(html, 'scroll-area-viewport')
    let [content] = slots(html, 'scroll-area-content')
    let scrollbars = slots(html, 'scroll-area-scrollbar')
    let [corner] = slots(html, 'scroll-area-corner')

    assert.ok(root && viewport && content && corner)
    assert.equal(viewport.attributes.get('tabindex'), '0')
    assert.ok(root.index < viewport.index && viewport.index < content.index)
    assert.ok(html.indexOf('v1.2.0-beta.1<') > content.index)
    assert.deepEqual(
      scrollbars.map((scrollbar) => scrollbar.attributes.get('data-orientation')),
      ['vertical'],
    )
    assert.ok(html.indexOf('v1.2.0-beta.1<') < (scrollbars[0]?.index ?? 0), 'the scrollbar sits after the viewport')
    for (let part of [...scrollbars, corner]) assert.equal(part.attributes.get('aria-hidden'), 'true')
    assert.equal(slots(html, 'scroll-area-thumb')[0]?.attributes.get('data-orientation'), 'vertical')
  })

  it('leaves the scrollbars to the browser until it runs the scroll area', async () => {
    let html = await renderToString(<ScrollArea>Long content</ScrollArea>)

    assert.equal(slots(html, 'scroll-area')[0]?.attributes.has('data-scrollbars'), false)
  })

  it('lifts a horizontal ScrollBar out of the content, beside the default vertical one', async () => {
    let html = await renderToString(
      <ScrollArea>
        <figure>Photo</figure>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>,
    )

    let [content] = slots(html, 'scroll-area-content')
    let scrollbars = slots(html, 'scroll-area-scrollbar')
    assert.deepEqual(
      scrollbars.map((scrollbar) => scrollbar.attributes.get('data-orientation')),
      ['vertical', 'horizontal'],
    )
    assert.ok(scrollbars.every((scrollbar) => scrollbar.index > html.indexOf('</figure>')))
    assert.ok((content?.index ?? 0) < html.indexOf('<figure'))
  })

  it("uses the caller's vertical ScrollBar in place of the default", async () => {
    let html = await renderToString(
      <ScrollArea>
        Content
        <ScrollBar class="slim" />
      </ScrollArea>,
    )

    let scrollbars = slots(html, 'scroll-area-scrollbar')
    assert.equal(scrollbars.length, 1)
    assert.match(scrollbars[0]?.attributes.get('class') ?? '', /slim/)
  })

  it('names the viewport as a region when the caller labels the scroll area', async () => {
    let labelled = await renderToString(<ScrollArea aria-label="Release tags">Content</ScrollArea>)
    let [root] = slots(labelled, 'scroll-area')
    let [viewport] = slots(labelled, 'scroll-area-viewport')

    assert.equal(root?.attributes.has('aria-label'), false)
    assert.equal(viewport?.attributes.get('aria-label'), 'Release tags')
    assert.equal(viewport?.attributes.get('role'), 'region')

    let unlabelled = await renderToString(<ScrollArea>Content</ScrollArea>)
    assert.equal(slots(unlabelled, 'scroll-area-viewport')[0]?.attributes.has('role'), false)
  })

  it("passes the caller's attributes and mixins to the root and the scrollbar", async () => {
    let html = await renderToString(
      <ScrollArea class="tags" data-testid="tags" mix={css({ height: '18rem' })}>
        Content
        <ScrollBar orientation="horizontal" data-testid="bar" />
      </ScrollArea>,
    )

    assert.match(slots(html, 'scroll-area')[0]?.attributes.get('class') ?? '', /tags/)
    assert.equal(slots(html, 'scroll-area')[0]?.attributes.get('data-testid'), 'tags')
    assert.equal(slots(html, 'scroll-area-scrollbar')[1]?.attributes.get('data-testid'), 'bar')
    assert.match(html, /height: 18rem/)
  })

  it('fails the render when a ScrollBar is not a direct child of a ScrollArea', async () => {
    await assert.rejects(renderToString(<ScrollBar />), /ScrollBar must be a direct child of a ScrollArea/)
    await assert.rejects(
      renderToString(
        <ScrollArea>
          <div>
            <ScrollBar orientation="horizontal" />
          </div>
        </ScrollArea>,
      ),
      /ScrollBar must be a direct child of a ScrollArea/,
    )
  })
})
