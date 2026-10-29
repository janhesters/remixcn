import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  breadcrumbLinkVariants,
} from './breadcrumb.tsx'

function Trail() {
  return () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/invoices">Invoices</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>INV-0042</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

describe('Breadcrumb', () => {
  it('renders a named navigation landmark around an ordered list', async () => {
    let html = await renderToString(<Trail />)
    let nav = attributes(html, 'nav')

    assert.equal(nav.get('aria-label'), 'breadcrumb')
    assert.equal(nav.get('data-slot'), 'breadcrumb')
    assert.equal(attributes(html, 'ol').get('data-slot'), 'breadcrumb-list')
    assert.deepEqual(
      tags(html, 'li').map((tag) => tag.attributes.get('data-slot')),
      ['breadcrumb-item', 'breadcrumb-separator', 'breadcrumb-item', 'breadcrumb-separator', 'breadcrumb-item'],
    )
  })

  it('renders native links with their href, and marks the current page', async () => {
    let html = await renderToString(<Trail />)

    assert.deepEqual(
      tags(html, 'a').map((tag) => [tag.attributes.get('href'), tag.attributes.get('data-slot')]),
      [
        ['/', 'breadcrumb-link'],
        ['/invoices', 'breadcrumb-link'],
      ],
    )
    let page = attributes(html, 'slot:breadcrumb-page')
    assert.equal(page.get('aria-current'), 'page')
    assert.equal(page.get('role'), 'link')
    assert.equal(page.get('aria-disabled'), 'true')
    assert.equal(text(html), 'HomeInvoicesINV-0042')
  })

  it('hides separators from assistive technology, with a chevron by default or your own content', async () => {
    let html = await renderToString(
      <ol>
        <BreadcrumbSeparator />
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
      </ol>,
    )
    let [chevron, slash] = tags(html, 'li')

    for (let separator of [chevron, slash]) {
      assert.equal(separator.attributes.get('role'), 'presentation')
      assert.equal(separator.attributes.get('aria-hidden'), 'true')
    }
    assert.equal(tags(html, 'svg').length, 1)
    assert.equal(text(html), '/')
  })

  it('hides the ellipsis, which the control around it names', async () => {
    let html = await renderToString(<BreadcrumbEllipsis />)
    let ellipsis = attributes(html, 'span')

    assert.equal(ellipsis.get('data-slot'), 'breadcrumb-ellipsis')
    assert.equal(ellipsis.get('aria-hidden'), 'true')
    assert.equal(attributes(html, 'svg').get('aria-hidden'), 'true')
  })

  it('gives any element the link look with breadcrumbLinkVariants()', async () => {
    let button = attributes(
      await renderToString(
        <button type="button" mix={breadcrumbLinkVariants()}>
          Projects
        </button>,
      ),
      'button',
    )

    assert.equal(button.get('data-slot'), 'breadcrumb-link')
    assert.ok(button.get('class'))
  })

  it('lets you rename the landmark', async () => {
    let nav = attributes(await renderToString(<Breadcrumb aria-label="Invoice location" />), 'nav')

    assert.equal(nav.get('aria-label'), 'Invoice location')
  })
})
