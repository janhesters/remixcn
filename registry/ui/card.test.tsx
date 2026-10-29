import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card.tsx'

describe('Card', () => {
  it('renders every part with its data-slot, in order', async () => {
    let html = await renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Invoice INV-0042</CardTitle>
          <CardDescription>Due 4 November</CardDescription>
          <CardAction>
            <a href="#edit">Edit</a>
          </CardAction>
        </CardHeader>
        <CardContent>€1,200.00</CardContent>
        <CardFooter>Sent by email</CardFooter>
      </Card>,
    )

    assert.deepEqual(
      tags(html, 'div').map((tag) => tag.attributes.get('data-slot')),
      ['card', 'card-header', 'card-title', 'card-description', 'card-action', 'card-content', 'card-footer'],
    )
    assert.equal(text(html), 'Invoice INV-0042Due 4 NovemberEdit€1,200.00Sent by email')
  })

  it('renders the default and small sizes', async () => {
    assert.equal(attributes(await renderToString(<Card />), 'div').get('data-size'), 'default')
    assert.equal(attributes(await renderToString(<Card size="sm" />), 'div').get('data-size'), 'sm')
  })

  it('renders the title as a native heading when you give it a level', async () => {
    let html = await renderToString(<CardTitle level={3}>Invoice INV-0042</CardTitle>)

    assert.equal(attributes(html, 'h3').get('data-slot'), 'card-title')
  })

  it('marks a header or footer that draws a border', async () => {
    let html = await renderToString(
      <Card>
        <CardHeader border>Header</CardHeader>
        <CardFooter border>Footer</CardFooter>
      </Card>,
    )

    assert.equal(attributes(html, 'slot:card-header').get('data-border'), '')
    assert.equal(attributes(html, 'slot:card-footer').get('data-border'), '')
    assert.equal(attributes(await renderToString(<CardHeader />), 'div').has('data-border'), false)
  })

  it('passes ARIA, ids and data attributes to each part', async () => {
    let html = await renderToString(
      <Card aria-labelledby="invoice-title" data-test="card">
        <CardTitle id="invoice-title">INV-0042</CardTitle>
      </Card>,
    )

    assert.equal(attributes(html, 'slot:card').get('aria-labelledby'), 'invoice-title')
    assert.equal(attributes(html, 'slot:card').get('data-test'), 'card')
    assert.equal(attributes(html, 'slot:card-title').get('id'), 'invoice-title')
  })
})
