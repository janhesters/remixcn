import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes } from '../../test/html.ts'
import { ariaStates } from './aria.ts'

describe('ariaStates', () => {
  it('writes boolean ARIA states as the literal strings ARIA needs', () => {
    assert.deepEqual(ariaStates({ 'aria-invalid': true, 'aria-required': false }), {
      'aria-invalid': 'true',
      'aria-required': 'false',
    })
  })

  it('keeps string states, token values, missing states and every other prop as they are', () => {
    let onInput = () => {}
    let props = {
      'aria-invalid': 'spelling',
      'aria-describedby': 'email-hint email-error',
      'aria-busy': undefined,
      disabled: true,
      'data-invalid': true,
      onInput,
    }

    assert.deepEqual(ariaStates(props), props)
  })

  it('leaves its input unchanged', () => {
    let props = { 'aria-invalid': true }
    ariaStates(props)

    assert.deepEqual(props, { 'aria-invalid': true })
  })

  it('makes the server write aria-invalid="true", where a bare attribute would read as false', async () => {
    let bare = attributes(await renderToString(<input aria-invalid={true} />), 'input')
    let literal = attributes(await renderToString(<input {...ariaStates({ 'aria-invalid': true })} />), 'input')

    assert.equal(bare.get('aria-invalid'), '')
    assert.equal(literal.get('aria-invalid'), 'true')
  })
})
