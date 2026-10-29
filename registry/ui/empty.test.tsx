import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty.tsx'

describe('Empty', () => {
  it("renders every part with shadcn's data-slot, in order", async () => {
    let html = await renderToString(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No invoices yet</EmptyTitle>
          <EmptyDescription>Create your first invoice to get paid.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <a href="#new">New invoice</a>
        </EmptyContent>
      </Empty>,
    )

    assert.deepEqual(
      tags(html, 'div').map((tag) => tag.attributes.get('data-slot')),
      ['empty', 'empty-header', 'empty-icon', 'empty-title', 'empty-description', 'empty-content'],
    )
    assert.equal(attributes(html, 'slot:empty-icon').get('data-variant'), 'icon')
    assert.equal(text(html), 'No invoices yetCreate your first invoice to get paid.New invoice')
  })

  it('renders the default media variant', async () => {
    assert.equal(attributes(await renderToString(<EmptyMedia />), 'div').get('data-variant'), 'default')
  })

  it('renders the title as a native heading when you give it a level', async () => {
    let html = await renderToString(<EmptyTitle level={2}>No invoices yet</EmptyTitle>)

    assert.equal(attributes(html, 'h2').get('data-slot'), 'empty-title')
  })
})
