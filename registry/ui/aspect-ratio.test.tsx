import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes } from '../../test/html.ts'
import { AspectRatio } from './aspect-ratio.tsx'

describe('AspectRatio', () => {
  it('sets the ratio as the --ratio property its rule reads, so the box keeps its shape before any script runs', async () => {
    let box = attributes(await renderToString(<AspectRatio ratio={16 / 9} />), 'div')

    assert.equal(box.get('data-slot'), 'aspect-ratio')
    assert.equal(box.get('style'), `--ratio: ${16 / 9};`)
  })

  it('keeps the style the caller passes next to the ratio', async () => {
    let box = attributes(await renderToString(<AspectRatio ratio={1} style={{ maxWidth: '12rem' }} />), 'div')

    assert.equal(box.get('style'), '--ratio: 1; max-width: 12rem;')
  })

  it('drops a ratio that is not a positive finite number, so the box sizes by its content instead', async () => {
    for (let ratio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      let box = attributes(await renderToString(<AspectRatio ratio={ratio} />), 'div')

      assert.equal(box.has('style'), false, `ratio ${ratio}`)
    }
  })
})
