// Its server never closes on purpose, so the runner's own cleanup never finishes:
// test/phases.test.e2e.ts stops it and checks its last records.
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it("waits on the runner's cleanup for ever", async (t) => {
    let page = await open(t, { serverNeverCloses: true })
    await page.locator('#code').click()
  })
})
