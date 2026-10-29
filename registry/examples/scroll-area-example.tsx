// RemixCN Scroll Area examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Scroll Area examples, after shadcn's scroll-area-example.tsx and the demos
// on its Scroll Area page, with invented data. The scrollbars need the
// browser, so each example is a client entry. Without it, the content still
// scrolls with the system's scrollbars.
import { clientEntry, css, Fragment } from 'remix/component'

import { ScrollArea, ScrollBar } from '#remixcn/ui/scroll-area.tsx'

// Layout for the examples, the way an app would size and fill its own panels
// and scroll areas. The components bring their own look.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm' | 'base') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  /** shadcn's h-72 w-48 rounded-md border for the tag list. */
  tagsArea: css({
    height: '18rem',
    width: 'min(100%, 12rem)',
    marginInline: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  }),
  tags: css({ ...text('sm'), padding: space(4) }),
  tagsTitle: css({ ...text('sm'), margin: 0, marginBlockEnd: space(4), fontWeight: 500, lineHeight: 1 }),
  divider: css({
    height: 0,
    margin: `${space(2)} 0`,
    border: 0,
    borderBlockStart: '1px solid var(--border)',
  }),
  /** shadcn's w-full max-w-96 rounded-md border p-4 for the photo strip. */
  photosArea: css({
    width: '100%',
    maxWidth: '24rem',
    marginInline: 'auto',
    padding: space(4),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  }),
  photoStrip: css({ display: 'flex', gap: space(4) }),
  figure: css({ flexShrink: 0, margin: 0 }),
  // Invented photos: gray gradients in place of upstream's Unsplash pictures.
  photo: css({
    width: '9rem',
    aspectRatio: '3 / 4',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--muted)',
    backgroundImage: 'linear-gradient(160deg, var(--muted) 0%, var(--chart-1) 55%, var(--chart-3) 100%)',
  }),
  caption: css({
    ...text('xs'),
    paddingBlockStart: space(2),
    color: 'var(--muted-foreground)',
    '& b': { color: 'var(--foreground)', fontWeight: 600 },
  }),
  tableArea: css({
    height: '16rem',
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  }),
  table: css({
    ...text('sm'),
    borderCollapse: 'collapse',
    whiteSpace: 'nowrap',
    '& th, & td': { padding: `${space(2)} ${space(3)}`, textAlign: 'start', borderBlockEnd: '1px solid var(--border)' },
    '& th': { fontWeight: 500, color: 'var(--muted-foreground)' },
    '& a': { color: 'inherit', textUnderlineOffset: '0.2em' },
  }),
}

const tags = Array.from({ length: 50 }, (_, index) => `v1.2.0-beta.${50 - index}`)

export const ScrollAreaVertical = clientEntry(import.meta.url, function ScrollAreaVertical() {
  return () => (
    <ScrollArea aria-label="Tags" mix={styles.tagsArea}>
      <div mix={styles.tags}>
        <h4 mix={styles.tagsTitle}>Tags</h4>
        {tags.map((tag) => (
          <Fragment key={tag}>
            <div>{tag}</div>
            <hr mix={styles.divider} />
          </Fragment>
        ))}
      </div>
    </ScrollArea>
  )
})

const works = ['Mira Okafor', 'Jonas Lindqvist', 'Amara Reyes', 'Tomás Ferreira']

export const ScrollAreaHorizontal = clientEntry(import.meta.url, function ScrollAreaHorizontal() {
  return () => (
    <ScrollArea aria-label="Photos" mix={styles.photosArea}>
      <div mix={styles.photoStrip}>
        {works.map((artist) => (
          <figure key={artist} mix={styles.figure}>
            <div role="img" aria-label={`Photo by ${artist}`} mix={styles.photo} />
            <figcaption mix={styles.caption}>
              Photo by <b>{artist}</b>
            </figcaption>
          </figure>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
})

const customers = ['Northwind Studio', 'Lumen Labs', 'Harbor & Pine', 'Atlas Freight', 'Quill Analytics']
const invoices = Array.from({ length: 18 }, (_, index) => ({
  number: `INV-2026-${String(index + 1).padStart(3, '0')}`,
  customer: customers[index % customers.length] ?? '',
  issued: `2026-${String((index % 9) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
  status: index % 3 === 0 ? 'Paid' : index % 3 === 1 ? 'Open' : 'Overdue',
  amount: `${((index + 3) * 412.5).toFixed(2)} CHF`,
}))

/** A table wider and taller than its area, with both scrollbars and the corner between them. */
export const ScrollAreaBothAxes = clientEntry(import.meta.url, function ScrollAreaBothAxes() {
  return () => (
    <ScrollArea aria-label="Invoices" mix={styles.tableArea}>
      <table mix={styles.table}>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Customer</th>
            <th scope="col">Issued</th>
            <th scope="col">Status</th>
            <th scope="col">Amount</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.number}>
              <td>
                <a href={`#${invoice.number}`}>{invoice.number}</a>
              </td>
              <td>{invoice.customer}</td>
              <td>{invoice.issued}</td>
              <td>{invoice.status}</td>
              <td>{invoice.amount}</td>
              <td>Project retainer, {invoice.customer}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
})

const arabicTags = Array.from({ length: 30 }, (_, index) => `الإصدار ${30 - index}`)

/** Arabic tags: the vertical scrollbar sits on the left, the horizontal thumb starts on the right. */
export const ScrollAreaRightToLeft = clientEntry(import.meta.url, function ScrollAreaRightToLeft() {
  return () => (
    <ScrollArea aria-label="الوسوم" mix={styles.tagsArea}>
      <div mix={styles.tags}>
        <h4 mix={styles.tagsTitle}>الوسوم</h4>
        {arabicTags.map((tag) => (
          <Fragment key={tag}>
            <div>{tag}</div>
            <hr mix={styles.divider} />
          </Fragment>
        ))}
      </div>
    </ScrollArea>
  )
})
