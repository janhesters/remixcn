import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags } from '../../test/html.ts'
import { Input } from './input.tsx'
import type { InputType } from './input.tsx'

describe('Input', () => {
  it('renders a native input, a text box when it has no type', async () => {
    let input = attributes(await renderToString(<Input name="customer" />), 'input')

    assert.equal(input.get('data-slot'), 'input')
    assert.equal(input.get('name'), 'customer')
    assert.equal(input.has('type'), false)
  })

  it('passes every text-like native type through', async () => {
    let types: InputType[] = [
      'text',
      'email',
      'password',
      'number',
      'search',
      'tel',
      'url',
      'date',
      'datetime-local',
      'month',
      'time',
      'week',
      'file',
      'color',
    ]
    let html = await renderToString(
      <div>
        {types.map((type) => (
          <Input key={type} type={type} />
        ))}
      </div>,
    )

    assert.deepEqual(
      tags(html, 'input').map((input) => input.attributes.get('type')),
      types,
    )
  })

  it('writes the starting value, so a form reset returns to it', async () => {
    let input = attributes(await renderToString(<Input name="amount" type="number" defaultValue={120} />), 'input')

    assert.equal(input.get('value'), '120')
  })

  it('keeps the native constraints, autofill hints, suggestions and form owner', async () => {
    let input = attributes(
      await renderToString(
        <Input
          type="email"
          name="email"
          form="invoice-form"
          required
          readOnly
          autocomplete="email"
          inputMode="email"
          placeholder="name@example.com"
          pattern=".+@.+"
          minLength={3}
          maxLength={80}
          list="email-suggestions"
        />,
      ),
      'input',
    )

    assert.equal(input.get('form'), 'invoice-form')
    assert.ok(input.has('required'))
    assert.ok(input.has('readonly'))
    assert.equal(input.get('autocomplete'), 'email')
    assert.equal(input.get('inputmode'), 'email')
    assert.equal(input.get('placeholder'), 'name@example.com')
    assert.equal(input.get('pattern'), '.+@.+')
    assert.equal(input.get('minlength'), '3')
    assert.equal(input.get('maxlength'), '80')
    assert.equal(input.get('list'), 'email-suggestions')
  })

  it('writes boolean ARIA states as "true" or "false", so an invalid input reads as invalid before any script runs', async () => {
    let invalid = attributes(await renderToString(<Input aria-invalid={true} aria-required={false} />), 'input')
    let valid = attributes(await renderToString(<Input aria-invalid="false" />), 'input')

    assert.equal(invalid.get('aria-invalid'), 'true')
    assert.equal(invalid.get('aria-required'), 'false')
    assert.equal(valid.get('aria-invalid'), 'false')
  })

  it('passes ids, descriptions, data attributes and classes to the input', async () => {
    let input = attributes(
      await renderToString(
        <Input id="email" aria-describedby="email-hint email-error" data-test="email" class="wide" disabled />,
      ),
      'input',
    )

    assert.equal(input.get('id'), 'email')
    assert.equal(input.get('aria-describedby'), 'email-hint email-error')
    assert.equal(input.get('data-test'), 'email')
    assert.ok(input.get('class')?.split(' ').includes('wide'))
    assert.ok(input.has('disabled'))
  })
})
