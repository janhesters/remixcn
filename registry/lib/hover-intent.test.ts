import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { isInSafeArea } from '#remixcn/lib/hover-intent.ts'

// A 100×40 trigger and a 200×80 card 4px below it, aligned to its start.
const trigger = { x: 100, y: 100, width: 100, height: 40 }
const below = { x: 100, y: 144, width: 200, height: 80 }

function at(x: number, y: number) {
  return { x, y }
}

describe('isInSafeArea', () => {
  it('counts the trigger and the popup themselves, edges included', () => {
    assert.equal(isInSafeArea(at(150, 120), trigger, below), true)
    assert.equal(isInSafeArea(at(250, 200), trigger, below), true)
    assert.equal(isInSafeArea(at(200, 140), trigger, below), true)
    assert.equal(isInSafeArea(at(90, 120), trigger, below), false)
  })

  it('bridges the gap between them across both their widths', () => {
    // Below the trigger, on the way to the card.
    assert.equal(isInSafeArea(at(150, 142), trigger, below), true)
    // Beside the trigger, but above the wider card: still the gap's row.
    assert.equal(isInSafeArea(at(280, 142), trigger, below), true)
    // Left of both, in the gap's row.
    assert.equal(isInSafeArea(at(95, 142), trigger, below), false)
    // Beside the trigger, above the gap.
    assert.equal(isInSafeArea(at(250, 120), trigger, below), false)
  })

  it('bridges a popup on any side', () => {
    let above = { x: 50, y: 16, width: 200, height: 80 }
    let right = { x: 204, y: 90, width: 120, height: 60 }
    let left = { x: 0, y: 110, width: 96, height: 20 }

    assert.equal(isInSafeArea(at(60, 98), trigger, above), true)
    assert.equal(isInSafeArea(at(60, 120), trigger, above), false)
    assert.equal(isInSafeArea(at(202, 95), trigger, right), true)
    assert.equal(isInSafeArea(at(202, 160), trigger, right), false)
    assert.equal(isInSafeArea(at(98, 135), trigger, left), true)
    assert.equal(isInSafeArea(at(98, 150), trigger, left), false)
  })

  it('has no bridge when the boxes touch or overlap', () => {
    let overlapping = { x: 150, y: 130, width: 200, height: 80 }

    assert.equal(isInSafeArea(at(160, 135), trigger, overlapping), true)
    assert.equal(isInSafeArea(at(320, 120), trigger, overlapping), false)
  })
})
