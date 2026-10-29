import { Fragment } from 'remix/component'
import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  Carousel,
  CarouselAutoplayToggle,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  autoplayRuns,
  carouselKeyStep,
  carouselSnaps,
  defaultCarouselMessages,
  nearestSnap,
  stepSnap,
} from './carousel.tsx'

type Attributes = Map<string, string>

/** Reads every opening tag's attributes, in document order, without the style tags css() adds. */
function tags(html: string) {
  let body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  return [...body.matchAll(/<([a-z][\w-]*)(\s[^>]*)?>/g)].map(([, name, source = '']) => {
    let attributes: Attributes = new Map(
      [...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']),
    )
    return { name, attributes }
  })
}

function slots(html: string, slot: string) {
  return tags(html)
    .filter((tag) => tag.attributes.get('data-slot') === slot)
    .map((tag) => tag.attributes)
}

function only(html: string, slot: string) {
  let found = slots(html, slot)
  assert.equal(found.length, 1, `expected one ${slot}`)
  return found[0] as Attributes
}

/** The visible and hidden text of the element that starts with this data-slot, up to its closing tag. */
function textOf(html: string, slot: string, tag = 'button') {
  let start = html.indexOf(`data-slot="${slot}"`)
  assert.ok(start >= 0, `no ${slot}`)
  let end = html.indexOf(`</${tag}>`, start)
  return html
    .slice(start, end)
    .replace(/^[^>]*>/, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

const slide = (start: number, size: number) => ({ start, size })

describe('carouselSnaps', () => {
  it('snaps each full-width slide to its own start', () => {
    let snaps = carouselSnaps([slide(0, 300), slide(316, 300), slide(632, 300)], 300, 632, 'start')

    assert.deepEqual(snaps, [
      { position: 0, slides: [0] },
      { position: 316, slides: [1] },
      { position: 632, slides: [2] },
    ])
  })

  it('merges the slides that the end of the scroll range reaches together, with several slides in view', () => {
    let slides = [0, 110, 220, 330, 440].map((start) => slide(start, 100))

    assert.deepEqual(carouselSnaps(slides, 320, 220, 'start'), [
      { position: 0, slides: [0] },
      { position: 110, slides: [1] },
      { position: 220, slides: [2, 3, 4] },
    ])
    assert.deepEqual(carouselSnaps(slides, 320, 220, 'center'), [
      { position: 0, slides: [0, 1] },
      { position: 110, slides: [2] },
      { position: 220, slides: [3, 4] },
    ])
    assert.deepEqual(carouselSnaps(slides, 320, 220, 'end'), [
      { position: 0, slides: [0, 1, 2] },
      { position: 110, slides: [3] },
      { position: 220, slides: [4] },
    ])
  })

  it('gives slides that all fit one snap, and none without slides', () => {
    assert.deepEqual(carouselSnaps([slide(0, 100), slide(110, 100)], 320, 0, 'center'), [
      { position: 0, slides: [0, 1] },
    ])
    assert.deepEqual(carouselSnaps([], 320, 0, 'start'), [])
  })

  it('treats positions less than a pixel apart as one snap', () => {
    let snaps = carouselSnaps([slide(0, 100), slide(219.6, 100), slide(329.6, 100)], 320, 220, 'start')

    assert.deepEqual(snaps, [
      { position: 0, slides: [0] },
      { position: 219.6, slides: [1, 2] },
    ])
  })
})

describe('nearestSnap', () => {
  let snaps = [0, 110, 220].map((position, index) => ({ position, slides: [index] }))

  it('picks the snap closest to a scroll position, the earlier one on a tie', () => {
    assert.equal(nearestSnap(snaps, 0), 0)
    assert.equal(nearestSnap(snaps, 54), 0)
    assert.equal(nearestSnap(snaps, 55), 0)
    assert.equal(nearestSnap(snaps, 56), 1)
    assert.equal(nearestSnap(snaps, 400), 2)
  })

  it('answers 0 without snaps', () => {
    assert.equal(nearestSnap([], 120), 0)
  })
})

describe('stepSnap', () => {
  it('stops at the ends of a bounded carousel', () => {
    assert.equal(stepSnap(0, -1, 3, false), 0)
    assert.equal(stepSnap(1, 1, 3, false), 2)
    assert.equal(stepSnap(2, 1, 3, false), 2)
  })

  it('wraps around the ends of a looping carousel', () => {
    assert.equal(stepSnap(0, -1, 3, true), 2)
    assert.equal(stepSnap(2, 1, 3, true), 0)
    assert.equal(stepSnap(0, 1, 1, true), 0)
  })

  it('keeps index 0 without snaps', () => {
    assert.equal(stepSnap(0, 1, 0, true), 0)
  })
})

describe('carouselKeyStep', () => {
  it('follows the arrows of a horizontal carousel, swapped in right-to-left text', () => {
    assert.equal(carouselKeyStep('ArrowLeft', 'horizontal', 'ltr'), -1)
    assert.equal(carouselKeyStep('ArrowRight', 'horizontal', 'ltr'), 1)
    assert.equal(carouselKeyStep('ArrowLeft', 'horizontal', 'rtl'), 1)
    assert.equal(carouselKeyStep('ArrowRight', 'horizontal', 'rtl'), -1)
    assert.equal(carouselKeyStep('ArrowDown', 'horizontal', 'ltr'), undefined)
  })

  it('follows Up and Down in a vertical carousel', () => {
    assert.equal(carouselKeyStep('ArrowUp', 'vertical', 'rtl'), -1)
    assert.equal(carouselKeyStep('ArrowDown', 'vertical', 'ltr'), 1)
    assert.equal(carouselKeyStep('ArrowRight', 'vertical', 'ltr'), undefined)
    assert.equal(carouselKeyStep('Enter', 'vertical', 'ltr'), undefined)
  })
})

describe('autoplayRuns', () => {
  let ready = {
    enabled: true,
    playing: true,
    ready: true,
    snapCount: 3,
    hovered: false,
    focused: false,
    hidden: false,
    reducedMotion: false,
  }

  it('runs only while it is on, playing and nothing pauses it', () => {
    assert.equal(autoplayRuns(ready), true)
    for (let key of ['enabled', 'playing', 'ready'] as const)
      assert.equal(autoplayRuns({ ...ready, [key]: false }), false)
    for (let key of ['hovered', 'focused', 'hidden', 'reducedMotion'] as const) {
      assert.equal(autoplayRuns({ ...ready, [key]: true }), false, key)
    }
  })

  it('never runs with a single snap', () => {
    assert.equal(autoplayRuns({ ...ready, snapCount: 1 }), false)
  })
})

describe('defaultCarouselMessages', () => {
  it('names a slide by its position and announces what a change shows', () => {
    assert.equal(defaultCarouselMessages.slide(2, 5), '2 of 5')
    assert.equal(defaultCarouselMessages.selected(2, 2, 5), 'Slide 2 of 5')
    assert.equal(defaultCarouselMessages.selected(2, 4, 5), 'Slides 2 to 4 of 5')
  })
})

function Invoice(handle: Handle<{ number: number }>) {
  return () => <CarouselItem>Invoice {handle.props.number}</CarouselItem>
}

describe('Carousel on the server', () => {
  it('renders a named region of slides with their positions, and controls that wait for the browser', async () => {
    let html = await renderToString(
      <Carousel aria-label="Invoices">
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
          <CarouselItem>Three</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    let root = only(html, 'carousel')
    assert.equal(root.get('role'), 'region')
    assert.equal(root.get('aria-roledescription'), 'carousel')
    assert.equal(root.get('aria-label'), 'Invoices')
    assert.equal(root.get('data-orientation'), 'horizontal')
    assert.equal(root.has('data-ready'), false)

    // The viewport scrolls natively and takes keyboard focus, so it works before the script runs.
    let viewport = only(html, 'carousel-content')
    assert.equal(viewport.get('tabindex'), '0')
    assert.equal(viewport.get('data-orientation'), 'horizontal')

    let items = slots(html, 'carousel-item')
    assert.deepEqual(
      items.map((item) => [item.get('role'), item.get('aria-roledescription'), item.get('aria-label')]),
      [
        ['group', 'slide', '1 of 3'],
        ['group', 'slide', '2 of 3'],
        ['group', 'slide', '3 of 3'],
      ],
    )

    let previous = only(html, 'carousel-previous')
    let next = only(html, 'carousel-next')
    assert.ok(previous.has('disabled'))
    assert.ok(next.has('disabled'))
    assert.equal(previous.get('type'), 'button')
    assert.equal(textOf(html, 'carousel-previous'), 'Previous slide')
    assert.equal(textOf(html, 'carousel-next'), 'Next slide')

    // A hidden probe as wide as the gap lets the browser report a new gap.
    assert.equal(only(html, 'carousel-gap').get('aria-hidden'), 'true')

    let status = only(html, 'carousel-status')
    assert.equal(status.get('aria-live'), 'polite')
    assert.equal(status.get('aria-atomic'), 'true')
    assert.equal(textOf(html, 'carousel-status', 'div'), '')
  })

  it('counts slides from arrays, fragments and components that render an item', async () => {
    let html = await renderToString(
      <Carousel aria-labelledby="heading">
        <CarouselContent>
          {[1, 2].map((number) => (
            <CarouselItem key={number}>Invoice {number}</CarouselItem>
          ))}
          <Fragment>
            <Invoice number={3} />
          </Fragment>
          <CarouselItem aria-label="Summary">All invoices</CarouselItem>
        </CarouselContent>
      </Carousel>,
    )

    assert.equal(only(html, 'carousel').get('aria-labelledby'), 'heading')
    assert.deepEqual(
      slots(html, 'carousel-item').map((item) => item.get('aria-label')),
      ['1 of 4', '2 of 4', '3 of 4', 'Summary'],
    )
  })

  it('takes the messages for slide names and button labels', async () => {
    let html = await renderToString(
      <Carousel
        aria-label="Rechnungen"
        messages={{ slide: (position, count) => `${position} von ${count}` }}
        dir="ltr"
        lang="de"
      >
        <CarouselContent>
          <CarouselItem>Eins</CarouselItem>
          <CarouselItem>Zwei</CarouselItem>
        </CarouselContent>
        <CarouselPrevious label="Vorherige Folie" />
        <CarouselNext label="Nächste Folie" />
      </Carousel>,
    )

    assert.deepEqual(
      slots(html, 'carousel-item').map((item) => item.get('aria-label')),
      ['1 von 2', '2 von 2'],
    )
    assert.equal(textOf(html, 'carousel-previous'), 'Vorherige Folie')
    assert.equal(textOf(html, 'carousel-next'), 'Nächste Folie')
  })

  it('marks every part with the orientation and each slide with its alignment', async () => {
    let html = await renderToString(
      <Carousel aria-label="Reminders" orientation="vertical" align="start">
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    for (let slot of ['carousel', 'carousel-content', 'carousel-item', 'carousel-previous', 'carousel-next']) {
      assert.equal(only(html, slot).get('data-orientation'), 'vertical', slot)
    }
    assert.equal(only(html, 'carousel-item').get('data-align'), 'start')
  })

  it('aligns slides in the center by default, as Embla does', async () => {
    let html = await renderToString(
      <Carousel aria-label="Reminders">
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
        </CarouselContent>
      </Carousel>,
    )

    assert.equal(only(html, 'carousel-item').get('data-align'), 'center')
  })

  it("passes the caller's attributes to the root, the track and the slides", async () => {
    let html = await renderToString(
      <Carousel aria-label="Invoices" id="invoices" class="wide" data-test="root">
        <CarouselContent class="track" data-test="track">
          <CarouselItem id="first" data-test="item">
            One
          </CarouselItem>
        </CarouselContent>
      </Carousel>,
    )

    let root = only(html, 'carousel')
    assert.equal(root.get('id'), 'invoices')
    assert.equal(root.get('data-test'), 'root')
    assert.ok(root.get('class')?.split(' ').includes('wide'))

    let track = tags(html).find((tag) => tag.attributes.get('data-test') === 'track')?.attributes
    assert.ok(track, 'no track')
    assert.equal(track.get('data-slot'), 'carousel-track')
    assert.ok(track.get('class')?.split(' ').includes('track'))

    let item = only(html, 'carousel-item')
    assert.equal(item.get('id'), 'first')
    assert.equal(item.get('data-test'), 'item')
  })

  it('renders the autoplay toggle disabled until the browser runs it', async () => {
    let html = await renderToString(
      <Carousel aria-label="Offers" autoplay>
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
        </CarouselContent>
        <CarouselAutoplayToggle />
      </Carousel>,
    )

    let toggle = only(html, 'carousel-autoplay-toggle')
    assert.ok(toggle.has('disabled'))
    assert.equal(textOf(html, 'carousel-autoplay-toggle'), 'Stop slide rotation')
    assert.equal(only(html, 'carousel').has('data-autoplay'), false)
  })

  it('renders no slides or snaps for empty content', async () => {
    let html = await renderToString(
      <Carousel aria-label="Nothing yet">
        <CarouselContent>{null}</CarouselContent>
      </Carousel>,
    )

    assert.equal(slots(html, 'carousel-item').length, 0)
    assert.equal(only(html, 'carousel-content').get('tabindex'), '0')
  })
})
