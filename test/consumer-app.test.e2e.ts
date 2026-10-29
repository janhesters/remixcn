import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { router } from './fixtures/consumer-app/app/router.tsx'

async function openInvoices(t: TestContext) {
  let page = await t.serve(await createTestServer(router.fetch))
  await page.goto('/')
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  return page
}

describe('consumer app', () => {
  it('renders invented invoices on the server and hydrates its client entry', async (t) => {
    let page = await openInvoices(t)
    let toggle = page.getByRole('button', { name: 'Payment terms' })

    assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Invoices')
    assert.deepEqual(await page.getByRole('cell').allTextContents(), [
      'INV-0001',
      'Fixture Co.',
      'CHF 200.00',
      'INV-0002',
      'Example GmbH',
      'CHF 75.50',
    ])
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')

    await toggle.click()

    await page.getByText('Due within 30 days.').waitFor()
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  })

  it('passes the axe-core WCAG checks', async (t) => {
    let page = await openInvoices(t)

    assert.deepEqual(await findAccessibilityViolations(page), [])
  })
})
