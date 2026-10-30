import { describe, it } from 'remix/test'

// The runner lists each finished describe block as a row above the next
// file's frame. Sixty rows fill more than a 1280 by 720 window.
for (let group = 1; group <= 60; group++) {
  describe(`finished group ${group}`, () => {
    it('passes', () => {})
  })
}
