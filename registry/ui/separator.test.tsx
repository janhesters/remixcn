import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes } from '../../test/html.ts'
import { Separator } from './separator.tsx'

describe('Separator', () => {
  it('renders a horizontal separator that assistive technology announces', async () => {
    let separator = attributes(await renderToString(<Separator />), 'div')

    assert.equal(separator.get('role'), 'separator')
    assert.equal(separator.get('aria-orientation'), 'horizontal')
    assert.equal(separator.get('data-slot'), 'separator')
    assert.equal(separator.get('data-orientation'), 'horizontal')
  })

  it('renders a vertical separator', async () => {
    let separator = attributes(await renderToString(<Separator orientation="vertical" />), 'div')

    assert.equal(separator.get('aria-orientation'), 'vertical')
    assert.equal(separator.get('data-orientation'), 'vertical')
  })

  it('hides a decorative separator from assistive technology, in either orientation', async () => {
    for (let orientation of ['horizontal', 'vertical'] as const) {
      let separator = attributes(await renderToString(<Separator decorative orientation={orientation} />), 'div')

      assert.equal(separator.get('role'), 'none')
      assert.equal(separator.has('aria-orientation'), false)
      assert.equal(separator.get('data-orientation'), orientation)
    }
  })

  it('passes ids, ARIA and data attributes to the element', async () => {
    let separator = attributes(
      await renderToString(<Separator id="totals" aria-label="Totals" data-test="totals" class="rule" />),
      'div',
    )

    assert.equal(separator.get('id'), 'totals')
    assert.equal(separator.get('aria-label'), 'Totals')
    assert.equal(separator.get('data-test'), 'totals')
    assert.ok(separator.get('class')?.split(' ').includes('rule'))
  })
})
