import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { tags, text } from '../../test/html.ts'
import { Kbd, KbdGroup } from './kbd.tsx'

describe('Kbd', () => {
  it('renders a native kbd element for one key', async () => {
    let html = await renderToString(<Kbd>Esc</Kbd>)
    let [kbd] = tags(html, 'kbd')

    assert.equal(kbd.attributes.get('data-slot'), 'kbd')
    assert.equal(text(html), 'Esc')
  })

  it('nests the keys of a combination in an outer kbd, as HTML marks up key combinations', async () => {
    let html = await renderToString(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>B</Kbd>
      </KbdGroup>,
    )

    assert.deepEqual(
      tags(html, 'kbd').map((tag) => tag.attributes.get('data-slot')),
      ['kbd-group', 'kbd', 'kbd'],
    )
    assert.equal(text(html), 'Ctrl+B')
  })

  it('passes titles, ARIA and data attributes to the element', async () => {
    let [kbd] = tags(
      await renderToString(
        <Kbd title="Command" aria-hidden="true" data-test="cmd">
          ⌘
        </Kbd>,
      ),
      'kbd',
    )

    assert.equal(kbd.attributes.get('title'), 'Command')
    assert.equal(kbd.attributes.get('aria-hidden'), 'true')
    assert.equal(kbd.attributes.get('data-test'), 'cmd')
  })
})
