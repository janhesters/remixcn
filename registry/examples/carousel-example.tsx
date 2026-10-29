// RemixCN Carousel examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Carousel examples, after shadcn's carousel-example.tsx and the demos on
// its Carousel page, with invented data. The buttons, keys and autoplay need
// the browser, so each example is a client entry. Without it, the slides
// still scroll natively.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Carousel,
  CarouselAutoplayToggle,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  carouselSelectType,
} from '#remixcn/ui/carousel.tsx'
import type { CarouselApi, CarouselMessages } from '#remixcn/ui/carousel.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'sm' | '2xl' | '3xl' | '4xl') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})
const small = '(min-width: 40rem)'
const large = '(min-width: 64rem)'
// Too narrow for the buttons beside the slides, such as on a phone with large text.
const narrow = '@container (max-width: 18rem)'

// shadcn hides the buttons on small screens. Here they move below the slides instead.
const below = (side: 'insetInlineStart' | 'insetInlineEnd') =>
  css({
    [narrow]: {
      '&[data-orientation="horizontal"]': {
        insetBlockStart: `calc(100% + ${space(2)})`,
        [side]: `calc(50% - ${space(9)})`,
        translate: 'none',
      },
    },
  })

const styles = {
  frame: css({ containerType: 'inline-size' }),
  column: css({ paddingBlock: space(12), paddingInline: space(4) }),
  // shadcn's mx-auto max-w-xs sm:max-w-sm, with room beside the slides for the buttons.
  carousel: css({
    width: `calc(100% - ${space(24)})`,
    maxWidth: '20rem',
    marginInline: 'auto',
    [`@media ${small}`]: { maxWidth: '24rem' },
    [narrow]: { width: '100%', marginBlockEnd: space(12) },
  }),
  columnCarousel: css({ width: '100%', maxWidth: '20rem', marginInline: 'auto' }),
  previous: below('insetInlineStart'),
  next: below('insetInlineEnd'),
  // A card with a number, in place of shadcn's Card and CardContent.
  slide: css({ padding: space(1) }),
  card: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    padding: space(6),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--card)',
    color: 'var(--card-foreground)',
    boxShadow: 'var(--shadow-sm)',
  }),
  square: css({ aspectRatio: '1' }),
  // In a column, the card fills its slide.
  fill: css({ height: '100%' }),
  number: css({ ...text('4xl'), fontWeight: 600 }),
  numberSmall: css({ ...text('3xl'), fontWeight: 600 }),
  // shadcn's sm:basis-1/2 lg:basis-1/3: the custom property says how many slides fit the view.
  sizes: css({
    [`@media ${small}`]: { '--carousel-slides': '2' },
    [`@media ${large}`]: { '--carousel-slides': '3' },
  }),
  // shadcn's -ml-1 and pl-1, with md:basis-1/2.
  spacing: css({
    '--carousel-gap': space(1),
    '@media (min-width: 48rem)': { '--carousel-slides': '2' },
  }),
  // shadcn's -mt-1 h-[270px] and basis-1/2 pt-1 for a column.
  vertical: css({ height: '17rem', '--carousel-slides': '2', '--carousel-gap': space(1) }),
  muted: css({
    ...text('sm'),
    margin: 0,
    paddingBlock: space(2),
    color: 'var(--muted-foreground)',
    textAlign: 'center',
  }),
  picker: css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: space(2) }),
  dot: css({
    width: space(6),
    height: space(6),
    padding: 0,
    border: '1px solid var(--input)',
    borderRadius: '999px',
    backgroundColor: 'transparent',
    backgroundClip: 'content-box',
    cursor: 'pointer',
    '&[aria-current="true"]': { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' },
    '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
  }),
  toolbar: css({ display: 'flex', justifyContent: 'center', gap: space(2), paddingBlockStart: space(3) }),
  invoice: css({
    display: 'grid',
    gap: space(3),
    padding: space(5),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--card)',
    color: 'var(--card-foreground)',
    '& h3': { ...text('sm'), margin: 0, fontWeight: 600 },
    '& p': { ...text('sm'), margin: 0, color: 'var(--muted-foreground)' },
    '& a': { ...text('sm'), color: 'var(--primary)', textUnderlineOffset: '0.2em', justifySelf: 'start' },
    '& label': { ...text('sm'), display: 'grid', gap: space(1.5), fontWeight: 500 },
    '& input': {
      ...text('sm'),
      minWidth: 0,
      height: space(9),
      paddingInline: space(2.5),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'inherit',
      font: 'inherit',
    },
  }),
}

function NumberCard(handle: Handle<{ label: string; size?: 'large' | 'small'; square?: boolean }>) {
  return () => {
    let { label, size = 'large', square = true } = handle.props

    return (
      <div mix={[styles.slide, square ? null : styles.fill]}>
        <div mix={[styles.card, square ? styles.square : styles.fill]}>
          <span mix={size === 'large' ? styles.number : styles.numberSmall}>{label}</span>
        </div>
      </div>
    )
  }
}

const five = [1, 2, 3, 4, 5]

/** One slide at a time, with buttons outside it. shadcn's Basic example. */
export const CarouselBasic = clientEntry(import.meta.url, function CarouselBasic() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Numbers" mix={styles.carousel}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
    </div>
  )
})

/** Two slides in view on small screens and three on large ones, lined up at their start. */
export const CarouselSizes = clientEntry(import.meta.url, function CarouselSizes() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Numbers, several at a time" align="start" mix={[styles.carousel, styles.sizes]}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} size="small" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
    </div>
  )
})

/** A smaller gap between slides: --carousel-gap replaces shadcn's negative margin and padding. */
export const CarouselSpacing = clientEntry(import.meta.url, function CarouselSpacing() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Numbers, close together" mix={[styles.carousel, styles.spacing]}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} size="small" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
    </div>
  )
})

/** A column that scrolls up and down: Up and Down take the place of Left and Right. */
export const CarouselVertical = clientEntry(import.meta.url, function CarouselVertical() {
  return () => (
    <div mix={styles.column}>
      <Carousel aria-label="Numbers in a column" orientation="vertical" align="start" mix={styles.columnCarousel}>
        <CarouselContent mix={styles.vertical}>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} size="small" square={false} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
})

/**
 * The API and the select event: the count below follows the carousel, and
 * the slide picker scrolls to a slide with api.scrollTo(). shadcn's API demo.
 */
export const CarouselWithApi = clientEntry(import.meta.url, function CarouselWithApi(handle: Handle) {
  let api: CarouselApi | undefined
  let current = 0
  let count = five.length

  return () => (
    <div mix={styles.frame}>
      <Carousel
        aria-label="Numbers with a slide picker"
        mix={[
          styles.carousel,
          on(carouselSelectType, (event) => {
            if (event.target !== event.currentTarget) return
            current = event.index
            count = event.snapCount
            void handle.update()
          }),
        ]}
        setApi={(value) => (api = value)}
      >
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
      <p mix={styles.muted} data-carousel-count>
        Slide {current + 1} of {count}
      </p>
      <div mix={styles.picker}>
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === current ? 'true' : undefined}
            disabled={api === undefined}
            mix={[styles.dot, on('click', () => api?.scrollTo(index))]}
          />
        ))}
      </div>
    </div>
  )
})

/**
 * Rotates every two seconds, as shadcn's Autoplay plugin demo. It pauses
 * while the mouse is over it, while focus is inside, on a hidden page and
 * with reduced motion. The toggle stops and starts it.
 */
export const CarouselAutoplay = clientEntry(import.meta.url, function CarouselAutoplay() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Numbers that rotate" autoplay={{ delay: 2000 }} mix={styles.carousel}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
        <div mix={styles.toolbar}>
          <CarouselAutoplayToggle />
        </div>
      </Carousel>
    </div>
  )
})

/** From the last slide, Next goes back to the first, and Previous the other way. */
export const CarouselLoop = clientEntry(import.meta.url, function CarouselLoop() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Numbers in a loop" loop mix={styles.carousel}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={String(number)} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
    </div>
  )
})

const invoices = [
  { number: 'INV-2041', customer: 'Acme Labs', amount: '€1,250.00', due: 'Due 12 November' },
  { number: 'INV-2042', customer: 'Northwind Studio', amount: '€480.00', due: 'Due 19 November' },
  { number: 'INV-2043', customer: 'Blue Fern Cafe', amount: '€92.50', due: 'Overdue since 2 November' },
]

/**
 * Slides with links and fields. The arrow keys stay with a field, a drag
 * never starts on one, and a link works as usual. Tab reaches every slide,
 * and the carousel scrolls the focused one into view.
 */
export const CarouselInvoices = clientEntry(import.meta.url, function CarouselInvoices() {
  return () => (
    <div mix={styles.frame}>
      <Carousel aria-label="Open invoices" align="start" mix={styles.carousel}>
        <CarouselContent>
          {invoices.map((invoice) => (
            <CarouselItem key={invoice.number}>
              <div mix={styles.slide}>
                <article mix={styles.invoice}>
                  <h3>
                    {invoice.number} · {invoice.customer}
                  </h3>
                  <p>
                    {invoice.amount} · {invoice.due}
                  </p>
                  <label>
                    Reminder note
                    <input name={`note-${invoice.number}`} defaultValue="Friendly reminder" />
                  </label>
                  <a href={`#${invoice.number}`}>Open {invoice.number}</a>
                </article>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious mix={styles.previous} />
        <CarouselNext mix={styles.next} />
      </Carousel>
    </div>
  )
})

const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const arabic = (value: number) =>
  String(value)
    .split('')
    .map((digit) => arabicDigits[Number(digit)])
    .join('')

const arabicMessages: CarouselMessages = {
  slide: (position, count) => `${arabic(position)} من ${arabic(count)}`,
  selected: (first, last, count) =>
    first === last
      ? `الشريحة ${arabic(first)} من ${arabic(count)}`
      : `الشرائح ${arabic(first)} إلى ${arabic(last)} من ${arabic(count)}`,
}

/**
 * Right-to-left text: the carousel reads the direction from the page, so
 * slides start on the right, the buttons and the arrow keys swap, and the
 * chevrons mirror. shadcn's RTL demo, with Arabic labels.
 */
export const CarouselRightToLeft = clientEntry(import.meta.url, function CarouselRightToLeft() {
  return () => (
    <div dir="rtl" lang="ar" mix={styles.frame}>
      <Carousel aria-label="أرقام" messages={arabicMessages} mix={styles.carousel}>
        <CarouselContent>
          {five.map((number) => (
            <CarouselItem key={number}>
              <NumberCard label={arabic(number)} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious label="الشريحة السابقة" mix={styles.previous} />
        <CarouselNext label="الشريحة التالية" mix={styles.next} />
      </Carousel>
    </div>
  )
})
