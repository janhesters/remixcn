// Never finishes its cleanup on purpose: test/phases.test.e2e.ts stops it and checks its last record.
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it('registers a cleanup that never finishes', async (t) => {
    let page = await open(t)
    t.after(() => new Promise(() => {}))
    await page.locator('#code').click()
  })
})
