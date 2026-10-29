import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, text } from '../../test/html.ts'
import { Badge, badgeVariantNames, badgeVariants } from './badge.tsx'

describe('Badge', () => {
  it('renders a span with the default variant', async () => {
    let html = await renderToString(<Badge>Paid</Badge>)
    let badge = attributes(html, 'span')

    assert.equal(badge.get('data-slot'), 'badge')
    assert.equal(badge.get('data-variant'), 'default')
    assert.equal(text(html), 'Paid')
  })

  it('renders each variant', async () => {
    for (let variant of badgeVariantNames) {
      let badge = attributes(await renderToString(<Badge variant={variant}>Draft</Badge>), 'span')

      assert.equal(badge.get('data-variant'), variant)
    }
  })

  it('gives a native link the badge look, so it keeps its link role and navigation', async () => {
    let link = attributes(
      await renderToString(
        <a href="/invoices?status=overdue" mix={badgeVariants({ variant: 'destructive' })}>
          3 overdue
        </a>,
      ),
      'a',
    )

    assert.equal(link.get('href'), '/invoices?status=overdue')
    assert.equal(link.get('data-slot'), 'badge')
    assert.equal(link.get('data-variant'), 'destructive')
    assert.ok(link.get('class'))
  })

  it('passes ARIA, data and class attributes to the span', async () => {
    let badge = attributes(
      await renderToString(
        <Badge aria-invalid="true" title="Missing tax ID" class="status" data-test="status">
          Blocked
        </Badge>,
      ),
      'span',
    )

    assert.equal(badge.get('aria-invalid'), 'true')
    assert.equal(badge.get('title'), 'Missing tax ID')
    assert.equal(badge.get('data-test'), 'status')
    assert.ok(badge.get('class')?.split(' ').includes('status'))
  })
})
