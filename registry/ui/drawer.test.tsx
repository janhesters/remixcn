import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  decideSwipeRelease,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPortal,
  DrawerSnapPointButton,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
  findSnapPoint,
  keyboardInset,
  resolveSnapPoints,
  snapPointMovement,
  swipeReleaseStrength,
  touchActionFor,
} from './drawer.tsx'
import type { SwipeRelease } from './drawer.tsx'

function tags(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map(
    ([, source = '']) =>
      new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])),
  )
}

const screen = { viewportHeight: 800, popupHeight: 704, rootFontSize: 16 }

describe('resolveSnapPoints', () => {
  it('reads fractions of the viewport, pixels and rem, as heights and offsets from the open position', () => {
    assert.deepEqual(resolveSnapPoints([0.25, 300, '250px', '10rem'], screen), [
      { value: 0.25, height: 200, offset: 504 },
      { value: 300, height: 300, offset: 404 },
      { value: '250px', height: 250, offset: 454 },
      { value: '10rem', height: 160, offset: 544 },
    ])
  })

  it('clamps each height to the popup and the viewport, so the full point is the open position', () => {
    assert.deepEqual(resolveSnapPoints([1, -0.5], screen), [
      { value: 1, height: 704, offset: 0 },
      { value: -0.5, height: 0, offset: 704 },
    ])
    assert.deepEqual(resolveSnapPoints([2000], screen), [{ value: 2000, height: 704, offset: 0 }])
  })

  it('drops values it cannot read, and keeps the later of two points within a pixel of each other', () => {
    assert.deepEqual(resolveSnapPoints(['50%', 'tall', Number.NaN, 0.5, '400.5px'], screen), [
      { value: '400.5px', height: 400.5, offset: 303.5 },
    ])
  })

  it('resolves nothing before the drawer has a size', () => {
    assert.deepEqual(resolveSnapPoints([0.5, 1], { ...screen, popupHeight: 0 }), [])
    assert.deepEqual(resolveSnapPoints([0.5, 1], { ...screen, viewportHeight: 0 }), [])
  })
})

describe('findSnapPoint', () => {
  let points = resolveSnapPoints(['200px', 1], screen)

  it('finds the active value itself, or the closest point for a value that is not in the list', () => {
    assert.equal(findSnapPoint(points, '200px', screen), points[0])
    assert.equal(findSnapPoint(points, 1, screen), points[1])
    assert.equal(findSnapPoint(points, 0.9, screen), points[1])
    assert.equal(findSnapPoint(points, '10rem', screen), points[0])
    assert.equal(findSnapPoint(points, null, screen), undefined)
  })
})

describe('snapPointMovement', () => {
  it('follows the pointer between the snap points and resists past the open position', () => {
    assert.equal(snapPointMovement(300, 120), 120)
    assert.equal(snapPointMovement(300, -300), -300)
    assert.equal(snapPointMovement(300, -400), -310)
  })
})

const slow = { velocity: 0.1, releaseVelocity: 0.1 }

function release(overrides: Partial<SwipeRelease>): SwipeRelease {
  return { delta: 0, attributed: true, size: 400, ...slow, ...overrides }
}

describe('decideSwipeRelease without snap points', () => {
  it('rests when the drag never moved toward dismissal', () => {
    assert.deepEqual(decideSwipeRelease(release({ delta: 300, attributed: false })), { type: 'rest' })
    assert.deepEqual(decideSwipeRelease(release({ delta: -40 })), { type: 'rest' })
    assert.deepEqual(decideSwipeRelease(release({ delta: 0 })), { type: 'rest' })
  })

  it('closes past half its size, or on a fast swipe toward dismissal', () => {
    assert.deepEqual(decideSwipeRelease(release({ delta: 199 })), { type: 'rest' })
    assert.deepEqual(decideSwipeRelease(release({ delta: 201 })), { type: 'close' })
    assert.deepEqual(decideSwipeRelease(release({ delta: 30, velocity: 0.5 })), { type: 'close' })
  })

  it('needs at least 10px on a tiny drawer', () => {
    assert.deepEqual(decideSwipeRelease(release({ size: 12, delta: 9 })), { type: 'rest' })
    assert.deepEqual(decideSwipeRelease(release({ size: 12, delta: 11 })), { type: 'close' })
  })
})

describe('decideSwipeRelease with snap points', () => {
  // A 600px popup with a 300px peek (offset 300) and the full height (offset 0).
  let points = resolveSnapPoints(['300px', 1], { viewportHeight: 600, popupHeight: 600, rootFontSize: 16 })
  let [peek, full] = points

  function snap(activeOffset: number, overrides: Partial<SwipeRelease>, sequential = false) {
    return decideSwipeRelease(
      release({ size: 600, ...overrides, snap: { points, activeOffset, popupHeight: 600, sequential } }),
    )
  }

  it('settles on the snap point closest to where the drag ends', () => {
    assert.deepEqual(snap(300, { delta: -200 }), { type: 'snap', snapPoint: full })
    assert.deepEqual(snap(300, { delta: -100 }), { type: 'snap', snapPoint: peek })
    assert.deepEqual(snap(0, { delta: 200 }), { type: 'snap', snapPoint: peek })
    assert.deepEqual(snap(0, { delta: 100 }), { type: 'snap', snapPoint: full })
  })

  it('closes when the drag ends closer to closed than to any snap point', () => {
    assert.deepEqual(snap(300, { delta: 200 }), { type: 'close' })
    assert.deepEqual(snap(300, { delta: 100 }), { type: 'snap', snapPoint: peek })
  })

  it('lets a fast swipe skip ahead, and a fast swipe toward dismissal close', () => {
    assert.deepEqual(snap(300, { delta: -20, velocity: -1, releaseVelocity: -1 }), { type: 'snap', snapPoint: full })
    assert.deepEqual(snap(0, { delta: 20, velocity: 0.6, releaseVelocity: 0.6 }), { type: 'close' })
  })

  it('ignores a release velocity that reverses the drag, and uses the whole drag instead', () => {
    assert.deepEqual(snap(300, { delta: -200, velocity: -0.2, releaseVelocity: 2 }), { type: 'snap', snapPoint: full })
  })

  it('settles instead of closing when the drag never moved along the drawer axis', () => {
    assert.deepEqual(snap(300, { delta: 250, attributed: false }), { type: 'snap', snapPoint: peek })
  })

  it('moves one snap point at a time with snapToSequentialPoints', () => {
    assert.deepEqual(snap(0, { delta: 30, velocity: 0.6, releaseVelocity: 0.6 }, true), {
      type: 'snap',
      snapPoint: peek,
    })
    assert.deepEqual(snap(300, { delta: 30, velocity: 0.6, releaseVelocity: 0.6 }, true), { type: 'close' })
    assert.deepEqual(snap(300, { delta: -250 }, true), { type: 'snap', snapPoint: full })
  })
})

describe('swipeReleaseStrength', () => {
  it('scales the release by the distance left and the release velocity', () => {
    let strength = swipeReleaseStrength({ size: 400, travelled: 100, velocity: 1 })
    assert.ok(strength !== null && Math.abs(strength - (0.1 + (220 / 280) * 0.9)) < 1e-9, String(strength))
    assert.equal(swipeReleaseStrength({ size: 400, travelled: 100, velocity: 50 }), 0.1)
    assert.equal(swipeReleaseStrength({ size: 400, travelled: 100, velocity: 0.2 }), null)
    assert.equal(swipeReleaseStrength({ size: 400, travelled: 400, velocity: 1 }), null)
  })
})

describe('touchActionFor', () => {
  it('leaves scrolling to the browser while the content can scroll the way the swipe goes', () => {
    assert.equal(touchActionFor('down', { toward: true, away: true }, true), '')
    assert.equal(touchActionFor('right', { toward: true, away: false }, true), '')
  })

  it('hands the swipe to the drawer at the edge, and the other way to the browser where it can tell them apart', () => {
    assert.equal(touchActionFor('down', { toward: false, away: true }, true), 'pan-x pan-down pinch-zoom')
    assert.equal(touchActionFor('up', { toward: false, away: true }, true), 'pan-x pan-up pinch-zoom')
    assert.equal(touchActionFor('right', { toward: false, away: true }, true), 'pan-y pan-right pinch-zoom')
    assert.equal(touchActionFor('left', { toward: false, away: true }, true), 'pan-y pan-left pinch-zoom')
    assert.equal(touchActionFor('down', { toward: false, away: true }, false), '')
  })

  it('blocks the drawer axis where nothing scrolls along it', () => {
    assert.equal(touchActionFor('down', { toward: false, away: false }, true), 'pan-x pinch-zoom')
    assert.equal(touchActionFor('left', { toward: false, away: false }, false), 'pan-y pinch-zoom')
  })
})

describe('keyboardInset', () => {
  it('measures the part of the layout viewport a virtual keyboard covers', () => {
    assert.equal(keyboardInset({ layoutHeight: 800, height: 500, offsetTop: 0, scale: 1 }), 300)
    assert.equal(keyboardInset({ layoutHeight: 800, height: 500, offsetTop: 100, scale: 1 }), 200)
    assert.equal(keyboardInset({ layoutHeight: 800, height: 800, offsetTop: 0, scale: 1 }), 0)
  })

  it('ignores a pinch zoom, which shrinks the visual viewport without a keyboard', () => {
    assert.equal(keyboardInset({ layoutHeight: 800, height: 400, offsetTop: 200, scale: 2 }), 0)
  })
})

describe('Drawer on the server', () => {
  it('renders a closed native dialog at the bottom, named and described by its header', async () => {
    let html = await renderToString(
      <Drawer>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerPortal>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Move goal</DrawerTitle>
              <DrawerDescription>Set your daily invoice goal.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose>Cancel</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>,
    )
    let [dialog] = tags(html, 'dialog')
    let [title] = tags(html, 'h2')
    let [description] = tags(html, 'p')
    let buttons = tags(html, 'button')

    assert.equal(dialog.has('open'), false)
    assert.equal(dialog.has('autofocus'), true, 'it opens focused itself, also without a script')
    assert.equal(dialog.get('data-slot'), 'drawer-popup')
    assert.equal(dialog.get('data-swipe-direction'), 'down')
    assert.equal(dialog.get('data-swipe-axis'), 'y')
    assert.equal(dialog.has('data-snap-points'), false)
    assert.equal(dialog.get('aria-labelledby'), title.get('id'))
    assert.equal(dialog.get('aria-describedby'), description.get('id'))
    assert.equal(title.get('data-slot'), 'drawer-title')
    assert.equal(description.get('data-slot'), 'drawer-description')
    assert.match(html, /<div[^>]*data-slot="drawer-content"[^>]*><div[^>]*data-slot="drawer-header"/)
    assert.ok(html.includes('data-slot="drawer-footer"'))
    assert.equal(html.includes('drawer-swipe-handle'), false)
    assert.deepEqual(
      buttons.map((button) => [button.get('data-slot'), button.get('command'), button.get('commandfor')]),
      [
        ['drawer-trigger', 'show-modal', dialog.get('id')],
        ['drawer-close', 'close', dialog.get('id')],
      ],
    )
  })

  it('renders each swipe direction on its axis, with a decorative swipe handle on request', async () => {
    for (let [direction, axis] of [
      ['up', 'y'],
      ['right', 'x'],
      ['down', 'y'],
      ['left', 'x'],
    ] as const) {
      let html = await renderToString(
        <Drawer swipeDirection={direction} showSwipeHandle>
          <DrawerContent>
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerContent>
        </Drawer>,
      )
      let [dialog] = tags(html, 'dialog')
      let [handle] = tags(html, 'div').filter((div) => div.get('data-slot') === 'drawer-swipe-handle')

      assert.equal(dialog.get('data-swipe-direction'), direction)
      assert.equal(dialog.get('data-swipe-axis'), axis)
      assert.equal(handle.get('aria-hidden'), 'true')
    }
  })

  it('marks snap points and the full one, and renders its snap buttons disabled until the drawer runs', async () => {
    let html = await renderToString(
      <Drawer snapPoints={['20rem', 1]} defaultSnapPoint={1} defaultOpen>
        <DrawerContent>
          <DrawerTitle>Invoices</DrawerTitle>
          <DrawerSnapPointButton snapPoint="20rem">Peek</DrawerSnapPointButton>
          <DrawerSnapPointButton snapPoint={1}>Expand</DrawerSnapPointButton>
        </DrawerContent>
      </Drawer>,
    )
    let [dialog] = tags(html, 'dialog')
    let [peek, expand] = tags(html, 'button')

    assert.equal(dialog.has('open'), true)
    assert.equal(dialog.has('data-snap-points'), true)
    assert.equal(dialog.has('data-expanded'), true)
    assert.deepEqual(
      [peek, expand].map((button) => [button.get('data-slot'), button.get('aria-pressed'), button.has('disabled')]),
      [
        ['drawer-snap-point-button', 'false', true],
        ['drawer-snap-point-button', 'true', true],
      ],
    )
  })

  it('leaves autofocus to the content when it names its own initial focus', async () => {
    let html = await renderToString(
      <Drawer>
        <DrawerContent initialFocus={false}>
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    )
    assert.equal(tags(html, 'dialog')[0].has('autofocus'), false)
  })

  it('renders a standalone swipe handle', async () => {
    let html = await renderToString(
      <Drawer>
        <DrawerSwipeHandle />
      </Drawer>,
    )
    assert.match(html, /<div[^>]*data-slot="drawer-swipe-handle"[^>]*aria-hidden="true"/)
  })

  it('gives each instance its own ids', async () => {
    let html = await renderToString(
      <div>
        <Drawer>
          <DrawerContent>
            <DrawerTitle>One</DrawerTitle>
          </DrawerContent>
        </Drawer>
        <Drawer>
          <DrawerContent>
            <DrawerTitle>Two</DrawerTitle>
          </DrawerContent>
        </Drawer>
      </div>,
    )
    let ids = tags(html, 'dialog').map((dialog) => dialog.get('id'))
    assert.equal(new Set(ids).size, 2)
  })
})
