import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { computePosition } from '#remixcn/lib/anchor-position.ts'

const viewport = { x: 0, y: 0, width: 800, height: 400 }
const floating = { width: 200, height: 100 }
// A 40×20 anchor in the middle of the viewport.
const anchor = { x: 380, y: 190, width: 40, height: 20 }

function place(anchorRect = anchor, options: Parameters<typeof computePosition>[3] = {}) {
  let { x, y, side, align } = computePosition(anchorRect, floating, viewport, { collisionPadding: 0, ...options })
  return { x, y, side, align }
}

describe('computePosition', () => {
  it('centers below the anchor by default', () => {
    assert.deepEqual(place(), { x: 300, y: 210, side: 'bottom', align: 'center' })
  })

  it('aligns to the start and end edges, mirrored in right-to-left text', () => {
    assert.equal(place(anchor, { align: 'start' }).x, 380)
    assert.equal(place(anchor, { align: 'end' }).x, 220)
    assert.equal(place(anchor, { align: 'start', dir: 'rtl' }).x, 220)
    assert.equal(place(anchor, { align: 'end', dir: 'rtl' }).x, 380)
  })

  it('places on each side and resolves inline sides by direction', () => {
    assert.deepEqual(place(anchor, { side: 'top' }), { x: 300, y: 90, side: 'top', align: 'center' })
    assert.deepEqual(place(anchor, { side: 'right', align: 'start' }), {
      x: 420,
      y: 190,
      side: 'right',
      align: 'start',
    })
    assert.deepEqual(place(anchor, { side: 'left', align: 'end' }), { x: 180, y: 110, side: 'left', align: 'end' })
    assert.equal(place(anchor, { side: 'inline-start' }).side, 'left')
    assert.equal(place(anchor, { side: 'inline-start', dir: 'rtl' }).side, 'right')
    assert.equal(place(anchor, { side: 'inline-end', dir: 'rtl' }).side, 'left')
  })

  it('adds the side and align offsets', () => {
    assert.deepEqual(place(anchor, { sideOffset: 8, alignOffset: 4, align: 'start' }), {
      x: 384,
      y: 218,
      side: 'bottom',
      align: 'start',
    })
    assert.equal(place(anchor, { alignOffset: 4, align: 'end' }).x, 216)
    assert.equal(place(anchor, { alignOffset: 4, align: 'start', dir: 'rtl' }).x, 216)
    assert.equal(place(anchor, { side: 'top', sideOffset: 8 }).y, 82)
  })

  it('flips to the opposite side when the preferred side overflows', () => {
    let nearBottom = { x: 380, y: 340, width: 40, height: 20 }

    assert.deepEqual(place(nearBottom), { x: 300, y: 240, side: 'top', align: 'center' })
    assert.equal(place(nearBottom, { flip: false }).side, 'bottom')
  })

  it('flips the alignment before shifting when the aligned edge overflows', () => {
    assert.deepEqual(place({ x: 700, y: 190, width: 40, height: 20 }, { align: 'start' }), {
      x: 540,
      y: 210,
      side: 'bottom',
      align: 'end',
    })
    assert.deepEqual(place({ x: 750, y: 370, width: 40, height: 20 }, { align: 'start' }), {
      x: 590,
      y: 270,
      side: 'top',
      align: 'end',
    })
    assert.equal(place({ x: 700, y: 190, width: 40, height: 20 }, { align: 'start', flip: false }).x, 600)
  })

  it('keeps the side that overflows less when neither fits', () => {
    let tall = { width: 200, height: 300 }
    let nearTop = { x: 380, y: 120, width: 40, height: 20 }
    let result = computePosition(nearTop, tall, viewport, { side: 'top', collisionPadding: 0 })

    assert.equal(result.side, 'bottom')
    assert.equal(computePosition(nearTop, tall, viewport, { side: 'bottom', collisionPadding: 0 }).side, 'bottom')
  })

  it('shifts along the edge to stay inside the padded boundary', () => {
    let nearRight = { x: 760, y: 190, width: 40, height: 20 }
    let nearLeft = { x: 0, y: 190, width: 40, height: 20 }

    assert.equal(place(nearRight, { align: 'start', collisionPadding: 8 }).x, 592)
    assert.equal(place(nearLeft, { collisionPadding: 8 }).x, 8)
    assert.equal(place(nearLeft, { shift: false }).x, -80)
  })

  it('flips within a boundary smaller than the viewport', () => {
    let boundary = { x: 0, y: 0, width: 800, height: 300 }
    let result = computePosition({ x: 380, y: 200, width: 40, height: 20 }, floating, boundary, {
      collisionPadding: 0,
    })

    assert.equal(result.side, 'top')
  })

  it('reports the room left on the resolved side', () => {
    let result = computePosition(anchor, floating, viewport, { collisionPadding: 10, sideOffset: 5 })

    assert.equal(result.availableHeight, 400 - 10 - 215)
    assert.equal(result.availableWidth, 780)
    let side = computePosition(anchor, floating, viewport, { side: 'right', collisionPadding: 10 })
    assert.equal(side.availableWidth, 800 - 10 - 420)
    assert.equal(side.availableHeight, 380)
  })

  it('anchors to a point', () => {
    assert.deepEqual(place({ x: 100, y: 50, width: 0, height: 0 }, { align: 'start' }), {
      x: 100,
      y: 50,
      side: 'bottom',
      align: 'start',
    })
  })
})
