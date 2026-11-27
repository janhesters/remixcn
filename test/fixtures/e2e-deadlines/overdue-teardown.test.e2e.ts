import { afterAll, afterEach, describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const deadline = Number(process.env.REMIXCN_E2E_CLEANUP_DEADLINE_MS)

/** Holds the event loop past the cleanup deadline, so its timer can only fire late. */
function overrun() {
  let end = performance.now() + deadline + 250
  while (performance.now() < end) {}
}

let overdue = false

// Overruns on purpose, in a cleanup that holds the event loop, and then
// settles before the deadline's timer can fire. The steps queued behind it
// must not start, and the test fails anyway.
describe('overdue cleanup', () => {
  afterEach(() => {
    if (overdue) console.log('late afterEach hook started')
  })

  it('registers a cleanup that overruns its deadline', (t) => {
    reportProcesses([])
    overdue = true
    t.after(overrun)
    t.after(() => console.log('late t.after() callback 2 started'))
  })

  it('runs after the overdue cleanup', () => {
    overdue = false
  })
})

const chains = [1, 2, 3, 4, 5, 6, 7, 8]
let chain = 0
let overran = false

// The first afterEach hook to run returns at once, and overruns a few
// microtasks later, while the runner moves on to the next hook. However many,
// the next hook must not start once the overrun is over.
describe('overdue afterEach', () => {
  afterEach(() => {
    if (overran) console.log(`late afterEach hook started after an overrun ${chain} microtasks on`)
  })

  afterEach(() => {
    let steps: Promise<void> = Promise.resolve()
    for (let step = 1; step < chain; step++) steps = steps.then(() => {})
    void steps.then(() => {
      overrun()
      overran = true
    })
  })

  for (let length of chains) {
    it(`overruns ${length} microtasks after its first afterEach hook returns`, () => {
      chain = length
      overran = false
    })
  }
})

let throwing = false

// Overruns on purpose, in an afterEach hook that then throws. The deadline
// counts, not the hook's error.
describe('overdue afterEach that throws', () => {
  afterEach(() => {
    if (!throwing) return
    overrun()
    throw new Error('late afterEach failure')
  })

  it('overruns in an afterEach hook that throws', () => {
    throwing = true
  })

  it('runs after the throwing afterEach hook', () => {
    throwing = false
  })
})

// The same in a suite's afterAll hooks: the first to run overruns.
describe('overdue afterAll', () => {
  afterAll(() => console.log('late afterAll hook started'))

  afterAll(overrun)

  it('passes', () => {})
})
