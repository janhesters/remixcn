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

  it('leaves out only the elements an exception names, for the rule it names', async (t) => {
    let tiny = 'width:4px;height:4px;padding:0;border:0'
    // Stacked range inputs that leave the pointer to their track, as Slider's thumbs do.
    let stacked = 'position:absolute;inset:0;margin:0;pointer-events:none'
    let html = `<html lang="en"><head><title>Fixture</title></head><body><main>
      <div style="position:relative;width:200px;height:16px">
        <input type="range" aria-label="Low" data-slot="slider-thumb" style="${stacked}">
        <input type="range" aria-label="High" data-slot="slider-thumb" style="${stacked}">
      </div>
      <button aria-label="Zoom in" style="${tiny}"></button><button aria-label="Zoom out" style="${tiny}"></button>
    </main></body></html>`
    let page = await t.serve(await servePage(html))
    await page.goto('/')
    let thumbs = { rule: 'target-size', selector: 'input[data-slot="slider-thumb"]' }

    let all = await findAccessibilityViolations(page)
    let excepted = await findAccessibilityViolations(page, { except: [thumbs] })
    let otherRule = await findAccessibilityViolations(page, { except: [{ ...thumbs, rule: 'button-name' }] })

    let targetSize = (list: string[]) => list.find((violation) => violation.startsWith('target-size: ')) ?? ''
    assert.match(targetSize(all), /input/)
    assert.match(targetSize(excepted), /button/)
    assert.doesNotMatch(targetSize(excepted), /input/)
    assert.deepEqual(otherRule, all)
  })

  it('finds nothing on an accessible page', async (t) => {
    let html = '<html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1></main></body></html>'
    let page = await t.serve(await servePage(html))
    await page.goto('/')

    assert.deepEqual(await findAccessibilityViolations(page), [])
  })
})
