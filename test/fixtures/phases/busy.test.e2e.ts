// Fails on purpose while its page's main thread is stuck: test/phases.test.e2e.ts checks what its records keep.
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it('fails while its page is stuck in an evaluation', async (t) => {
    let page = await open(t)
    let stuck = page.evaluate(() => {
      while (true) {
        // Keeps the page's main thread busy for ever.
      }
    })
    // It settles once the page closes.
    stuck.catch(() => {})
    let timer: ReturnType<typeof setTimeout> | undefined
    // Long enough for the watchdog, which checks every 2 s, to find the page silent.
    let late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('the evaluation still runs after 7 s')), 7_000)
    })
    t.after(() => clearTimeout(timer))
    await Promise.race([stuck, late])
  })
})
