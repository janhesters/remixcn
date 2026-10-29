import { describe, it } from 'remix/test'

// A suite that passes nothing: the test lane must not count it as passing.
describe('invoices', () => {
  it.skip('lists the open invoices', () => {})
})
