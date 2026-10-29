import { renderToString } from 'remix/component/server'
import type { Handle } from 'remix/component'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { tags, text } from '../../test/html.ts'
import { DirectionProvider, getDirection } from './direction.tsx'

function Reader(handle: Handle) {
  return () => <span>{getDirection(handle)}</span>
}

describe('DirectionProvider', () => {
  it('sets the native dir attribute on its subtree', async () => {
    let [provider] = tags(await renderToString(<DirectionProvider direction="rtl">مرحبا</DirectionProvider>), 'div')

    assert.equal(provider.attributes.get('dir'), 'rtl')
    assert.equal(provider.attributes.get('data-slot'), 'direction')
  })

  it('defaults to left to right, as Base UI does', async () => {
    let [provider] = tags(await renderToString(<DirectionProvider>Invoices</DirectionProvider>), 'div')

    assert.equal(provider.attributes.get('dir'), 'ltr')
  })

  it('isolates nested subtrees: each provider sets its own dir', async () => {
    let html = await renderToString(
      <DirectionProvider direction="rtl">
        <DirectionProvider direction="ltr">INV-0042</DirectionProvider>
      </DirectionProvider>,
    )

    assert.deepEqual(
      tags(html, 'div').map((tag) => tag.attributes.get('dir')),
      ['rtl', 'ltr'],
    )
  })
})

describe('getDirection', () => {
  it('reads the nearest provider while rendering, also on the server', async () => {
    let html = await renderToString(
      <div>
        <Reader />
        <DirectionProvider direction="rtl">
          <Reader />
          <DirectionProvider direction="ltr">
            <Reader />
          </DirectionProvider>
        </DirectionProvider>
      </div>,
    )

    assert.equal(text(html), 'ltrrtlltr')
  })
})
