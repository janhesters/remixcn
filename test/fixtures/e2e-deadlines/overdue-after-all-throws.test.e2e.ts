import { afterAll, describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const deadline = Number(process.env.REMIXCN_E2E_CLEANUP_DEADLINE_MS)

// Overruns on purpose, in an afterAll hook that holds the event loop and then
// throws. That's a missed deadline, as for a hook that stays pending, so the
// worker retires and the next suite doesn't run.
describe('overdue afterAll that throws', () => {
  afterAll(() => {
    let end = performance.now() + deadline + 250
    while (performance.now() < end) {}
    throw new Error('late afterAll failure')
  })

  it('passes', () => {
    reportProcesses([])
  })
})

describe('after the overdue afterAll', () => {
  it('never runs once its worker retires', () => {})
})
