import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// A deliberate test failure: the test lane must fail on it.
describe('total', () => {
  it('adds the invoice lines', () => {
    assert.equal(120 + 80, 210)
  })
})
