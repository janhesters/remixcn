import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes } from '../../test/html.ts'
import { Spinner } from './spinner.tsx'

describe('Spinner', () => {
  it('renders a status named Loading, as shadcn does', async () => {
    let svg = attributes(await renderToString(<Spinner />), 'svg')

    assert.equal(svg.get('role'), 'status')
    assert.equal(svg.get('aria-label'), 'Loading')
    assert.equal(svg.get('data-slot'), 'spinner')
    assert.equal(svg.has('aria-hidden'), false)
  })

  it('names what is pending with label', async () => {
    let svg = attributes(await renderToString(<Spinner label="Loading invoices" />), 'svg')

    assert.equal(svg.get('aria-label'), 'Loading invoices')
  })

  it('hides a decorative spinner next to text that already says what is pending', async () => {
    let svg = attributes(await renderToString(<Spinner decorative data-icon="inline-start" />), 'svg')

    assert.equal(svg.get('aria-hidden'), 'true')
    assert.equal(svg.has('role'), false)
    assert.equal(svg.has('aria-label'), false)
    assert.equal(svg.get('data-icon'), 'inline-start')
  })

  it('draws a ring on the 24 by 24 grid that scales with the font size and takes the text color', async () => {
    let svg = attributes(await renderToString(<Spinner />), 'svg')

    assert.equal(svg.get('viewBox'), '0 0 24 24')
    assert.equal(svg.get('stroke'), 'currentColor')
    assert.equal(svg.get('fill'), 'none')
  })
})
