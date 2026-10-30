// Never finishes on purpose: test/phases.test.e2e.ts stops it and checks its last record.
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it('waits on an evaluation that never settles', async (t) => {
    let page = await open(t)
    await page.locator('#code').click()
    await page.evaluate(() => new Promise(() => {}))
  })
})
