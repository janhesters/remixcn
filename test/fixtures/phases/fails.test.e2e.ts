// Fails on purpose: test/phases.test.e2e.ts checks what its records keep.
import * as assert from 'remix/assert'
import { describe } from 'remix/test'

import { probe } from '../../phases.ts'
import { open, openSecond } from './page.ts'

const it = probe('fixture')

describe('phases fixture', () => {
  it('fails an assertion after typing in a second context', async (t) => {
    let page = await open(t)
    let second = await openSecond(t, page, 'second')
    await second.locator('#code').click()
    await second.keyboard.type('12')
    // A deep comparison's message names no values, so the records keep them.
    assert.deepEqual({ code: await second.locator('#code').inputValue() }, { code: '123' })
  })
})
