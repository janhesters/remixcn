import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slotTag, slots, tags } from './html.ts'

const html =
  '<div data-slot="tabs" data-orientation="horizontal"><button type="button" data-slot="tabs-trigger" data-active disabled>A</button>' +
  '<button type="button" data-slot="tabs-trigger" aria-label="B, the second">B</button></div><!-- rmx:h:1 -->'

describe('server HTML helpers', () => {
  it('list opening tags in document order, with empty values for bare attributes', () => {
    assert.deepEqual(
      tags(html).map((tag) => tag.name),
      ['div', 'button', 'button'],
    )
    assert.equal(tags(html)[1].attributes.get('data-active'), '')
    assert.ok(tags(html)[1].attributes.has('disabled'))
  })

  it('find every part with a data-slot, keeping attribute values with spaces and commas', () => {
    assert.equal(slots(html, 'tabs-trigger').length, 2)
    assert.equal(slots(html, 'tabs-trigger')[1].get('aria-label'), 'B, the second')
    assert.deepEqual(slots(html, 'tabs-content'), [])
    assert.equal(attributes(html, 'slot:tabs').get('data-orientation'), 'horizontal')
    assert.equal(slotTag(html, 'tabs-trigger'), 'button')
    assert.equal(slotTag(html, 'tabs-content'), undefined)
  })
})
