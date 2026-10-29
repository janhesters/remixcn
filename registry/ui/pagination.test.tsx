import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots, slotTag, tags } from '../../test/html.ts'

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination.tsx'

const href = (page: number) => `/invoices?status=open&page=${page}#results`

describe('Pagination', () => {
  it('renders a named nav with a list of links', async () => {
    let html = await renderToString(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href={href(1)}>1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    )

    assert.equal(slotTag(html, 'pagination'), 'nav')
    assert.equal(attributes(html, 'slot:pagination').get('aria-label'), 'Pagination')
    assert.equal(slotTag(html, 'pagination-content'), 'ul')
    assert.equal(slotTag(html, 'pagination-item'), 'li')
    assert.equal(slotTag(html, 'pagination-link'), 'a')
  })

  it("keeps the caller's URLs exactly, and marks the current page", async () => {
    let html = await renderToString(
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href={href(1)}>1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href={href(2)} isActive>
            2
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>,
    )
    let [first, current] = slots(html, 'pagination-link')

    // The server escapes & in attributes. The browser reads the same URL back.
    assert.equal(first.get('href'), '/invoices?status=open&amp;page=1#results')
    assert.ok(!first.has('aria-current'))
    assert.equal(first.get('data-variant'), 'ghost')
    assert.equal(current.get('aria-current'), 'page')
    assert.ok(current.has('data-active'))
    assert.equal(current.get('data-variant'), 'outline')
    assert.equal(current.get('data-size'), 'icon')
  })

  it('names the previous and next links, with the visible text in the name', async () => {
    let html = await renderToString(
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href={href(1)} />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href={href(3)} />
        </PaginationItem>
      </PaginationContent>,
    )
    let [previous, next] = slots(html, 'pagination-link')

    assert.equal(previous.get('aria-label'), 'Go to previous page')
    assert.equal(next.get('aria-label'), 'Go to next page')
    assert.equal(previous.get('data-size'), 'default')
    assert.ok(html.includes('>Previous<') && html.includes('>Next<'))
    assert.equal(
      tags(html).filter((tag) => tag.name === 'svg' && tag.attributes.get('aria-hidden') === 'true').length,
      2,
    )
  })

  it('names the links by their own text when the caller changes it', async () => {
    let html = await renderToString(
      <div>
        <PaginationPrevious href={href(1)} text="Zurück" />
        <PaginationNext href={href(3)} text="Weiter" aria-label="Nächste Seite" />
      </div>,
    )
    let [previous, next] = slots(html, 'pagination-link')

    assert.ok(!previous.has('aria-label'))
    assert.ok(html.includes('>Zurück<'))
    assert.equal(next.get('aria-label'), 'Nächste Seite')
  })

  it('disables a boundary link: no href, so nothing to follow, and announced as disabled', async () => {
    let html = await renderToString(<PaginationPrevious href={href(0)} disabled />)
    let previous = attributes(html, 'slot:pagination-link')

    assert.ok(!previous.has('href'))
    assert.equal(previous.get('role'), 'link')
    assert.equal(previous.get('aria-disabled'), 'true')
  })

  it('tells assistive technology that pages are left out', async () => {
    let html = await renderToString(<PaginationEllipsis />)
    let ellipsis = attributes(html, 'slot:pagination-ellipsis')

    assert.ok(!ellipsis.has('aria-hidden'))
    assert.ok(html.includes('More pages'))
    assert.equal(
      tags(html)
        .find((tag) => tag.name === 'svg')
        ?.attributes.get('aria-hidden'),
      'true',
    )
  })

  it("passes the caller's label and attributes to each part", async () => {
    let html = await renderToString(
      <Pagination aria-label="Invoice pages" class="pages">
        <PaginationContent class="list">
          <PaginationItem class="item">
            <PaginationLink href={href(1)} class="link" rel="prev" size="sm">
              1
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    )
    let link = attributes(html, 'slot:pagination-link')

    assert.equal(attributes(html, 'slot:pagination').get('aria-label'), 'Invoice pages')
    assert.ok(attributes(html, 'slot:pagination').get('class')?.split(' ').includes('pages'))
    assert.ok(attributes(html, 'slot:pagination-content').get('class')?.split(' ').includes('list'))
    assert.ok(attributes(html, 'slot:pagination-item').get('class')?.split(' ').includes('item'))
    assert.ok(link.get('class')?.split(' ').includes('link'))
    assert.equal(link.get('rel'), 'prev')
    assert.equal(link.get('data-size'), 'sm')
  })
})
