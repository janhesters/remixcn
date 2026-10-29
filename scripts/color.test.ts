import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { contrastRatio, parseColor } from './color.ts'

function assertClose(actual: number, expected: number, message?: string) {
  assert.ok(Math.abs(actual - expected) < 0.005, `${message ?? ''} expected ${expected}, got ${actual}`)
}

describe('parseColor', () => {
  it('converts oklch() to sRGB', () => {
    let white = parseColor('oklch(1 0 0)')
    let red = parseColor('oklch(0.62796 0.25768 29.2339)')

    for (let channel of [white.r, white.g, white.b, red.r]) assertClose(channel, 1)
    assertClose(red.g, 0)
    assertClose(red.b, 0)
    assert.equal(white.alpha, 1)
  })

  it('reads percentages and alpha', () => {
    let color = parseColor('oklch(100% 0 0 / 10%)')

    assertClose(color.r, 1)
    assert.equal(color.alpha, 0.1)
    assert.equal(parseColor('oklch(1 0 0 / 0.15)').alpha, 0.15)
  })

  it('rejects colors it cannot measure', () => {
    assert.throws(() => parseColor('rebeccapurple'), /oklch/)
  })
})

describe('contrastRatio', () => {
  let white = parseColor('oklch(1 0 0)')
  let black = parseColor('oklch(0 0 0)')

  it('measures WCAG contrast between two colors', () => {
    assertClose(contrastRatio(black, white), 21)
    assertClose(contrastRatio(white, black), 21)
    assertClose(contrastRatio(white, white), 1)
    // A gray's oklch lightness is the cube root of its luminance: 0.5³ = 0.125.
    assertClose(contrastRatio(parseColor('oklch(0.5 0 0)'), white), 1.05 / 0.175)
  })

  it('blends a translucent foreground over the background first', () => {
    assertClose(contrastRatio(parseColor('oklch(1 0 0 / 0%)'), black), 1)
    assertClose(contrastRatio(parseColor('oklch(1 0 0 / 100%)'), black), 21)
  })
})
