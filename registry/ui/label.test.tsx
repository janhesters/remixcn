import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, text } from '../../test/html.ts'
import { Label } from './label.tsx'

describe('Label', () => {
  it('renders a native label that names the control its for attribute points at', async () => {
    let html = await renderToString(<Label for="invoice-number">Invoice number</Label>)
    let label = attributes(html, 'label')

    assert.equal(label.get('for'), 'invoice-number')
    assert.equal(label.get('data-slot'), 'label')
    assert.equal(text(html), 'Invoice number')
  })

  it('takes htmlFor, as shadcn does', async () => {
    let label = attributes(await renderToString(<Label htmlFor="due-date">Due date</Label>), 'label')

    assert.equal(label.get('for'), 'due-date')
  })

  it('wraps its own control, which it then names without an id', async () => {
    let html = await renderToString(
      <Label>
        <input type="checkbox" name="remind" />
        Remind the customer
      </Label>,
    )

    assert.ok(html.includes('<input type="checkbox" name="remind"'), html)
    assert.equal(text(html), 'Remind the customer')
  })

  it('passes ids, data attributes and classes to the label', async () => {
    let label = attributes(
      await renderToString(
        <Label id="terms-label" data-test="terms" class="terms">
          Terms
        </Label>,
      ),
      'label',
    )

    assert.equal(label.get('id'), 'terms-label')
    assert.equal(label.get('data-test'), 'terms')
    assert.ok(label.get('class')?.split(' ').includes('terms'))
  })
})
