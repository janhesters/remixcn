import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  getSliderRange,
  getThumbBounds,
  moveSliderThumb,
  normalizeSliderValues,
  Slider,
  SliderError,
  SliderRoot,
  snapSliderValue,
} from './slider.tsx'

/** Lists each attribute of every element that matches the tag, in document order. */
function elements(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map((match) => {
    let attributes = new Map<string, string>()
    for (let [, name, , value = ''] of match[1].matchAll(/([\w:-]+)(="([^"]*)")?/g)) attributes.set(name, value)
    return attributes
  })
}

function thumbs(html: string) {
  return elements(html, 'input').filter((input) => input.get('data-slot') === 'slider-thumb')
}

function part(html: string, slot: string) {
  let found = elements(html, 'div').find((element) => element.get('data-slot') === slot)
  assert.ok(found, `no ${slot}`)
  return found
}

describe('getSliderRange', () => {
  it("defaults to Base UI's range, with a large step of a tenth of the range", () => {
    assert.deepEqual(getSliderRange({}), { min: 0, max: 100, step: 1, largeStep: 10, minStepsBetweenValues: 0 })
    assert.equal(getSliderRange({ min: 0, max: 1, step: 0.1 }).largeStep, 0.1)
    assert.equal(getSliderRange({ min: 0, max: 1000, step: 10 }).largeStep, 100)
    assert.equal(getSliderRange({ step: 25 }).largeStep, 25)
    assert.equal(getSliderRange({ largeStep: 5 }).largeStep, 5)
  })

  it('rejects a range a slider cannot use, naming the prop', () => {
    let cases: Array<[Parameters<typeof getSliderRange>[0], RegExp]> = [
      [{ min: Number.NaN }, /min must be a finite number, got NaN/],
      [{ max: Number.POSITIVE_INFINITY }, /max must be a finite number, got Infinity/],
      [{ min: 10, max: 10 }, /min \(10\) must be less than max \(10\)/],
      [{ min: 50, max: 0 }, /min \(50\) must be less than max \(0\)/],
      [{ step: 0 }, /step must be a positive finite number, got 0/],
      [{ step: -1 }, /step must be a positive finite number, got -1/],
      [{ step: Number.NaN }, /step must be a positive finite number, got NaN/],
      [{ largeStep: 0 }, /largeStep must be a positive finite number, got 0/],
      [{ minStepsBetweenValues: -1 }, /minStepsBetweenValues must be a whole number of 0 or more, got -1/],
      [{ minStepsBetweenValues: 1.5 }, /minStepsBetweenValues must be a whole number of 0 or more, got 1.5/],
    ]

    for (let [options, message] of cases) {
      assert.throws(
        () => getSliderRange(options),
        (error: unknown) =>
          error instanceof SliderError && message.test(error.message) && error.message.startsWith('Slider: '),
      )
    }
  })
})

describe('snapSliderValue', () => {
  it('snaps to the nearest step from min, and prefers the larger value on a tie, as a native range input does', () => {
    let range = getSliderRange({ min: 3, max: 100, step: 5 })

    assert.equal(snapSliderValue(7, range), 8)
    assert.equal(snapSliderValue(5.5, range), 8)
    assert.equal(snapSliderValue(5.4, range), 3)
    assert.equal(snapSliderValue(-20, range), 3)
  })

  it('keeps fractional steps exact', () => {
    let range = getSliderRange({ min: 0, max: 1, step: 0.1 })

    assert.equal(snapSliderValue(0.1 + 0.2, range), 0.3)
    assert.equal(snapSliderValue(0.35, range), 0.4)
    assert.equal(snapSliderValue(0.7 + 0.1, range), 0.8)
    assert.equal(snapSliderValue(0.04, range), 0)
    assert.equal(snapSliderValue(0.96, range), 1)
  })

  it('stops at the last step when max is not one', () => {
    let range = getSliderRange({ min: 0, max: 10, step: 3 })

    assert.equal(snapSliderValue(10, range), 9)
    assert.equal(snapSliderValue(500, range), 9)
  })
})

describe('normalizeSliderValues', () => {
  it('turns one number into one thumb and keeps an array as one thumb per value', () => {
    let range = getSliderRange({})

    assert.deepEqual(normalizeSliderValues(40, range), [40])
    assert.deepEqual(normalizeSliderValues([10, 20, 70], range), [10, 20, 70])
  })

  it('clamps, snaps and sorts the values, so the first thumb holds the lowest', () => {
    let range = getSliderRange({ max: 100, step: 5 })

    assert.deepEqual(normalizeSliderValues([120, -4, 53], range), [0, 55, 100])
  })

  it('moves values apart to keep the minimum steps between thumbs, inside the range', () => {
    let range = getSliderRange({ max: 100, step: 10, minStepsBetweenValues: 2 })

    assert.deepEqual(normalizeSliderValues([50, 50], range), [50, 70])
    assert.deepEqual(normalizeSliderValues([100, 100], range), [80, 100])
    assert.deepEqual(normalizeSliderValues([0, 0, 100], range), [0, 20, 100])
  })

  it('rejects values it cannot place, naming the thumb', () => {
    let range = getSliderRange({ max: 10, step: 5, minStepsBetweenValues: 1 })
    let cases: Array<[number | number[], RegExp]> = [
      [[], /needs at least one value/],
      [Number.NaN, /value\[0\] must be a finite number, got NaN/],
      [[1, Number.NEGATIVE_INFINITY], /value\[1\] must be a finite number, got -Infinity/],
      [[0, 5, 10, 10], /4 thumbs need 15 between min and max with minStepsBetweenValues 1, but the range has 10/],
    ]

    for (let [values, message] of cases) {
      assert.throws(
        () => normalizeSliderValues(values, range),
        (error: unknown) => error instanceof SliderError && message.test(error.message),
      )
    }
  })
})

describe('getThumbBounds', () => {
  it('bounds each thumb by its neighbours and the minimum steps, so thumbs never cross', () => {
    let range = getSliderRange({ max: 10, step: 3, minStepsBetweenValues: 1 })
    let values = [0, 3, 9]

    assert.deepEqual(getThumbBounds(values, 0, range), { lower: 0, upper: 0 })
    assert.deepEqual(getThumbBounds(values, 1, range), { lower: 3, upper: 6 })
    assert.deepEqual(getThumbBounds(values, 2, range), { lower: 6, upper: 9 })
  })
})

describe('moveSliderThumb', () => {
  let range = getSliderRange({ max: 100, step: 10, minStepsBetweenValues: 1 })

  it('moves one thumb to the snapped value and keeps the others', () => {
    let values = [20, 60]

    assert.deepEqual(moveSliderThumb(values, 1, 74, range), [20, 70])
    assert.deepEqual(values, [20, 60])
  })

  it('stops a thumb before its neighbour when it tries to cross', () => {
    assert.deepEqual(moveSliderThumb([20, 60], 0, 95, range), [50, 60])
    assert.deepEqual(moveSliderThumb([20, 60], 1, -40, range), [20, 30])
  })

  it('returns the same array when nothing moves, so callers can skip the change', () => {
    let values = [20, 30]

    assert.equal(moveSliderThumb(values, 0, 28, range), values)
    assert.equal(moveSliderThumb(values, 1, 22, range), values)
  })
})

describe('Slider on the server', () => {
  it('renders one native range input per thumb with its value, range and name', async () => {
    let html = await renderToString(<Slider name="volume" aria-label="Volume" defaultValue={40} max={80} step={2} />)
    let [thumb, ...rest] = thumbs(html)

    assert.equal(rest.length, 0)
    assert.equal(thumb.get('type'), 'range')
    assert.equal(thumb.get('value'), '40')
    assert.equal(thumb.get('min'), '0')
    assert.equal(thumb.get('max'), '80')
    assert.equal(thumb.get('step'), '2')
    assert.equal(thumb.get('name'), 'volume')
    assert.equal(thumb.get('aria-label'), 'Volume')
    assert.equal(thumb.get('data-index'), '0')
    assert.equal(part(html, 'slider').get('role'), undefined)
  })

  it('starts one thumb at min without a value', async () => {
    let html = await renderToString(<Slider aria-label="Volume" min={-10} />)

    assert.deepEqual(
      thumbs(html).map((thumb) => thumb.get('value')),
      ['-10'],
    )
  })

  it('names a group of thumbs and each thumb, and repeats the form name in thumb order', async () => {
    let html = await renderToString(
      <Slider
        name="price"
        aria-labelledby="price-label"
        thumbLabels={['Minimum price', 'Maximum price']}
        defaultValue={[800, 200]}
        max={1000}
        step={10}
      />,
    )
    let root = part(html, 'slider')

    assert.equal(root.get('role'), 'group')
    assert.equal(root.get('aria-labelledby'), 'price-label')
    assert.deepEqual(
      thumbs(html).map((thumb) => [
        thumb.get('name'),
        thumb.get('value'),
        thumb.get('aria-label'),
        thumb.get('aria-labelledby'),
      ]),
      [
        ['price', '200', 'Minimum price', undefined],
        ['price', '800', 'Maximum price', undefined],
      ],
    )
  })

  it("narrows each thumb's bounds for assistive technology, and keeps the native range of the shared track", async () => {
    let html = await renderToString(
      <Slider aria-label="Window" defaultValue={[20, 50, 90]} max={95} step={10} minStepsBetweenValues={1} />,
    )

    assert.deepEqual(
      thumbs(html).map((thumb) => [
        thumb.get('min'),
        thumb.get('max'),
        thumb.get('aria-valuemin'),
        thumb.get('aria-valuemax'),
      ]),
      [
        ['0', '95', undefined, '40'],
        ['0', '95', '30', '80'],
        ['0', '95', '60', '90'],
      ],
    )
  })

  it('names a thumb without its own label after the group', async () => {
    let html = await renderToString(<Slider aria-label="Window" defaultValue={[10, 20, 70]} />)

    assert.deepEqual(
      thumbs(html).map((thumb) => thumb.get('aria-label')),
      ['Window', 'Window', 'Window'],
    )
  })

  it('gives the first thumb the id, so a label element names it', async () => {
    let html = await renderToString(<Slider id="temperature" defaultValue={[0.3, 0.7]} max={1} step={0.1} />)

    assert.deepEqual(
      thumbs(html).map((thumb) => thumb.get('id')),
      ['temperature', undefined],
    )
  })

  it('draws the range from the start of the track to a single thumb, and between the outer thumbs of a range', async () => {
    let single = await renderToString(<Slider aria-label="Volume" defaultValue={25} />)
    let range = await renderToString(<Slider aria-label="Window" defaultValue={[10, 20, 70]} />)

    assert.match(part(single, 'slider').get('style') ?? '', /--slider-start: 0; --slider-end: 0\.25/)
    assert.match(part(range, 'slider').get('style') ?? '', /--slider-start: 0\.1; --slider-end: 0\.7/)
    assert.equal(part(single, 'slider-range').get('data-from-start'), '')
    assert.equal(part(range, 'slider-range').get('data-from-start'), undefined)
  })

  it('marks every part with its orientation, and names a vertical thumb as vertical', async () => {
    let html = await renderToString(<Slider aria-label="Bass" orientation="vertical" defaultValue={50} />)

    for (let slot of ['slider', 'slider-control', 'slider-track', 'slider-range']) {
      assert.equal(part(html, slot).get('data-orientation'), 'vertical')
    }
    assert.equal(thumbs(html)[0].get('aria-orientation'), 'vertical')
    assert.equal(thumbs(html)[0].get('data-orientation'), 'vertical')
  })

  it('disables every thumb natively, so a form leaves it out', async () => {
    let html = await renderToString(<Slider name="volume" aria-label="Volume" defaultValue={[20, 40]} disabled />)

    assert.equal(part(html, 'slider').get('data-disabled'), '')
    assert.deepEqual(
      thumbs(html).map((thumb) => thumb.has('disabled')),
      [true, true],
    )
  })

  it('describes each value with the number format, for screen readers', async () => {
    let html = await renderToString(
      <Slider
        aria-label="Budget"
        defaultValue={[200, 800]}
        max={1000}
        format={{ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }}
        locale="en-US"
      />,
    )

    assert.deepEqual(
      thumbs(html).map((thumb) => thumb.get('aria-valuetext')),
      ['€200', '€800'],
    )
  })

  it('renders the controlled value over the default value', async () => {
    let html = await renderToString(<Slider aria-label="Volume" value={[30]} defaultValue={[60]} />)

    assert.equal(thumbs(html)[0].get('value'), '30')
  })

  it("passes the caller's attributes to the root", async () => {
    let html = await renderToString(
      <SliderRoot aria-label="Volume" class="volume" dir="rtl" data-testid="volume" style={{ maxWidth: '20rem' }} />,
    )
    let root = part(html, 'slider')

    assert.match(root.get('class') ?? '', /\bvolume\b/)
    assert.equal(root.get('dir'), 'rtl')
    assert.equal(root.get('data-testid'), 'volume')
    assert.match(root.get('style') ?? '', /max-width: 20rem/)
  })

  it('fails the render with a developer error for an invalid range or value', async () => {
    await assert.rejects(renderToString(<Slider aria-label="Volume" min={5} max={5} />), SliderError)
    await assert.rejects(renderToString(<Slider aria-label="Volume" defaultValue={Number.NaN} />), SliderError)
  })
})
