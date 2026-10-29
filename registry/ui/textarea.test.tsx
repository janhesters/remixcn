import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, text } from '../../test/html.ts'
import { Textarea } from './textarea.tsx'

describe('Textarea', () => {
  it('renders a native textarea', async () => {
    let textarea = attributes(await renderToString(<Textarea name="note" rows={4} />), 'textarea')

    assert.equal(textarea.get('data-slot'), 'textarea')
    assert.equal(textarea.get('name'), 'note')
    assert.equal(textarea.get('rows'), '4')
  })

  it('writes the starting text as escaped content, so a form reset returns to it', async () => {
    let html = await renderToString(<Textarea name="note" defaultValue={'Pay by Friday.\n<script>alert(1)</script>'} />)

    assert.ok(html.includes('&lt;script&gt;'), html)
    assert.equal(text(html), 'Pay by Friday.\n<script>alert(1)</script>')
  })

  it('keeps the native constraints, autofill hints and form owner', async () => {
    let textarea = attributes(
      await renderToString(
        <Textarea
          name="address"
          form="invoice-form"
          required
          readOnly
          autocomplete="street-address"
          placeholder="Street and number"
          minLength={5}
          maxLength={200}
        />,
      ),
      'textarea',
    )

    assert.equal(textarea.get('form'), 'invoice-form')
    assert.ok(textarea.has('required'))
    assert.ok(textarea.has('readonly'))
    assert.equal(textarea.get('autocomplete'), 'street-address')
    assert.equal(textarea.get('placeholder'), 'Street and number')
    assert.equal(textarea.get('minlength'), '5')
    assert.equal(textarea.get('maxlength'), '200')
  })

  it('writes boolean ARIA states as "true" or "false"', async () => {
    let textarea = attributes(await renderToString(<Textarea aria-invalid={true} aria-required={false} />), 'textarea')

    assert.equal(textarea.get('aria-invalid'), 'true')
    assert.equal(textarea.get('aria-required'), 'false')
  })

  it('passes ids, descriptions, data attributes and classes to the textarea', async () => {
    let textarea = attributes(
      await renderToString(<Textarea id="note" aria-describedby="note-hint" data-test="note" class="tall" disabled />),
      'textarea',
    )

    assert.equal(textarea.get('id'), 'note')
    assert.equal(textarea.get('aria-describedby'), 'note-hint')
    assert.equal(textarea.get('data-test'), 'note')
    assert.ok(textarea.get('class')?.split(' ').includes('tall'))
    assert.ok(textarea.has('disabled'))
  })
})
