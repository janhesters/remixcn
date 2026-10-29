import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, text } from '../../test/html.ts'
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from './progress.tsx'
import type { ProgressProps } from './progress.tsx'

async function bar(props: ProgressProps) {
  let html = await renderToString(<Progress {...props} />)
  return {
    html,
    root: attributes(html, 'slot:progress'),
    track: attributes(html, 'slot:progress-track'),
    indicator: attributes(html, 'slot:progress-indicator'),
  }
}

describe('Progress', () => {
  it('renders a progress bar with its range, value and text alternative', async () => {
    let { root, indicator } = await bar({ value: 56 })

    assert.equal(root.get('role'), 'progressbar')
    assert.equal(root.get('aria-valuemin'), '0')
    assert.equal(root.get('aria-valuemax'), '100')
    assert.equal(root.get('aria-valuenow'), '56')
    assert.equal(root.get('aria-valuetext'), '56%')
    assert.equal(root.has('data-progressing'), true)
    assert.equal(indicator.get('style'), 'width: 56%;')
  })

  it('marks every part with the status, as Base UI does', async () => {
    let { track, indicator } = await bar({ value: 56 })

    assert.equal(track.has('data-progressing'), true)
    assert.equal(indicator.has('data-progressing'), true)
  })

  it('starts empty at the minimum and completes at the maximum', async () => {
    let empty = await bar({ value: 0 })
    let full = await bar({ value: 100 })

    assert.equal(empty.root.get('aria-valuenow'), '0')
    assert.equal(empty.root.has('data-progressing'), true)
    assert.equal(empty.indicator.get('style'), 'width: 0%;')
    assert.equal(full.root.get('aria-valuenow'), '100')
    assert.equal(full.root.has('data-complete'), true)
    assert.equal(full.root.has('data-progressing'), false)
    assert.equal(full.indicator.get('style'), 'width: 100%;')
  })

  it('clamps a value outside the range, so the bar, the number and the text agree', async () => {
    let over = await bar({ value: 140 })
    let under = await bar({ value: -20 })

    assert.deepEqual(
      [over.root.get('aria-valuenow'), over.root.get('aria-valuetext'), over.indicator.get('style')],
      ['100', '100%', 'width: 100%;'],
    )
    assert.equal(over.root.has('data-complete'), true)
    assert.deepEqual(
      [under.root.get('aria-valuenow'), under.root.get('aria-valuetext'), under.indicator.get('style')],
      ['0', '0%', 'width: 0%;'],
    )
  })

  it('works in any range', async () => {
    let { root, indicator } = await bar({ value: 15, min: 10, max: 20 })

    assert.equal(root.get('aria-valuemin'), '10')
    assert.equal(root.get('aria-valuemax'), '20')
    assert.equal(root.get('aria-valuenow'), '15')
    assert.equal(root.get('aria-valuetext'), '50%')
    assert.equal(indicator.get('style'), 'width: 50%;')
  })

  it('is indeterminate without a finite value: no current value, and a text that says so', async () => {
    for (let value of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      let { root, indicator } = await bar({ value })

      assert.equal(root.has('aria-valuenow'), false, String(value))
      assert.equal(root.get('aria-valuetext'), 'indeterminate progress')
      assert.equal(root.has('data-indeterminate'), true)
      assert.equal(indicator.has('style'), false)
      assert.equal(indicator.has('data-indeterminate'), true)
    }
  })

  it('formats the value with Intl.NumberFormat options and a locale', async () => {
    let { root } = await bar({
      value: 1250,
      max: 2000,
      format: { style: 'currency', currency: 'EUR' },
      locale: 'de-DE',
    })

    // German puts a no-break space before the euro sign.
    assert.equal(root.get('aria-valuetext'), '1.250,00\u00a0€')
  })

  it('takes a text alternative from getAriaValueText, with the formatted and the raw value', async () => {
    let calls: Array<[string, number | null]> = []
    let { root } = await bar({
      value: 3,
      max: 4,
      getAriaValueText: (formatted, value) => {
        calls.push([formatted, value])
        return `Step ${value} of 4`
      },
    })

    assert.equal(root.get('aria-valuetext'), 'Step 3 of 4')
    assert.deepEqual(calls, [['75%', 3]])
  })

  it('is named by its label, which it finds among its children', async () => {
    let html = await renderToString(
      <Progress value={56}>
        <ProgressLabel>Upload progress</ProgressLabel>
        <ProgressValue />
      </Progress>,
    )
    let root = attributes(html, 'slot:progress')
    let label = attributes(html, 'slot:progress-label')

    assert.ok(label.get('id'))
    assert.equal(root.get('aria-labelledby'), label.get('id'))
    assert.equal(label.get('role'), 'presentation')
    assert.equal(text(html), 'Upload progress56%')
  })

  it('keeps an id you give the label, and names no label when there is none', async () => {
    let html = await renderToString(
      <Progress value={10}>
        <div>
          <ProgressLabel id="export-label">Export</ProgressLabel>
        </div>
      </Progress>,
    )

    assert.equal(attributes(html, 'slot:progress').get('aria-labelledby'), 'export-label')
    assert.equal(attributes(html, 'slot:progress-label').get('id'), 'export-label')
    assert.equal(
      attributes(await renderToString(<Progress value={10} aria-label="Export" />), 'div').has('aria-labelledby'),
      false,
    )
  })

  it('is named by a label that another component renders, such as a reusable label', async () => {
    function UploadLabel() {
      return () => <ProgressLabel>Upload progress</ProgressLabel>
    }
    let html = await renderToString(
      <Progress value={50}>
        <UploadLabel />
      </Progress>,
    )
    let label = attributes(html, 'slot:progress-label')

    assert.ok(label.get('id'))
    assert.equal(attributes(html, 'slot:progress').get('aria-labelledby'), label.get('id'))
  })

  it('keeps a value-driven width next to a style string you give the indicator', async () => {
    let html = await renderToString(
      <Progress value={50}>
        <ProgressTrack>
          <ProgressIndicator style="opacity: 0.5" />
        </ProgressTrack>
      </Progress>,
    )

    assert.equal(attributes(html, 'slot:progress-indicator').get('style'), 'width: 50%; opacity: 0.5')
  })

  it('shows the formatted value, hidden from assistive technology, which reads aria-valuetext instead', async () => {
    let html = await renderToString(
      <Progress value={2} max={8}>
        <ProgressValue />
        <ProgressValue>{(formatted, value) => `${value} of 8 files (${formatted})`}</ProgressValue>
      </Progress>,
    )
    let value = attributes(html, 'slot:progress-value')

    assert.equal(value.get('aria-hidden'), 'true')
    assert.equal(text(html), '25%2 of 8 files (25%)')
  })

  it('shows no value while indeterminate, and passes "indeterminate" to a function child', async () => {
    let html = await renderToString(
      <Progress value={null}>
        <ProgressValue />
        <ProgressValue>{(formatted) => `(${formatted})`}</ProgressValue>
      </Progress>,
    )

    assert.equal(text(html), '(indeterminate)')
  })
})
