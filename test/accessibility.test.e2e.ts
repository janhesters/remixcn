import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'

function servePage(html: string) {
  return createTestServer(() => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
}

describe('findAccessibilityViolations', () => {
  it('names the rule and the element of each violation', async (t) => {
    let page = await t.serve(
      await servePage('<html><body><main><img src="data:,"><button></button></main></body></html>'),
    )
    await page.goto('/')

    let violations = await findAccessibilityViolations(page)

    for (let rule of ['html-has-lang: ', 'document-title: ', 'image-alt: ', 'button-name: ']) {
      assert.ok(
        violations.some((violation) => violation.startsWith(rule)),
        `${rule} missing from ${violations.join('\n')}`,
      )
    }
    assert.ok(violations.some((violation) => violation.startsWith('image-alt: ') && violation.endsWith('(img)')))
  })

  it('finds nothing on an accessible page', async (t) => {
    let html = '<html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1></main></body></html>'
    let page = await t.serve(await servePage(html))
    await page.goto('/')

    assert.deepEqual(await findAccessibilityViolations(page), [])
  })
})
