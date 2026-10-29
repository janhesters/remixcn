import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes } from '../../test/html.ts'
import { Skeleton } from './skeleton.tsx'

describe('Skeleton', () => {
  it('renders a placeholder shape that assistive technology skips', async () => {
    let skeleton = attributes(await renderToString(<Skeleton />), 'div')

    assert.equal(skeleton.get('data-slot'), 'skeleton')
    assert.equal(skeleton.get('aria-hidden'), 'true')
  })

  it('keeps the size and attributes the caller passes', async () => {
    let skeleton = attributes(
      await renderToString(<Skeleton style={{ width: '12rem' }} class="line" data-test="line" />),
      'div',
    )

    assert.equal(skeleton.get('style'), 'width: 12rem;')
    assert.equal(skeleton.get('data-test'), 'line')
    assert.ok(skeleton.get('class')?.split(' ').includes('line'))
  })
})
