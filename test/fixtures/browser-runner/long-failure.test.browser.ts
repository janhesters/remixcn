import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// Fails on purpose. The runner shows the failed suite open, with its whole
// error above the next file's frame.
describe('long failure', () => {
  it('fails with a 300-line report', () => {
    let lines = Array.from({ length: 300 }, (_, index) => `invented report line ${index + 1}`)
    assert.fail(lines.join('\n'))
  })
})
