// Fails on purpose: test/phases.test.e2e.ts checks what its records keep.
import * as assert from 'remix/assert'
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it('fails an assertion after typing', async (t) => {
    let page = await open(t)
    await page.locator('#code').click()
    await page.keyboard.type('12')
    assert.equal(await page.locator('#code').inputValue(), '123')
  })
})
