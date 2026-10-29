// RemixCN Typography: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

// Styles for long-form text, as mixins for native elements. Nothing here
// styles an element you don't give a style to, so copying this file never
// restyles the rest of your app: <h2 mix={typography.h2}>Payment terms</h2>.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: string) => ({ fontSize: `var(--text-${size})`, lineHeight: `var(--text-${size}--line-height)` })
// Headings keep clear of a sticky header when a link scrolls to them.
const heading = { margin: 0, scrollMarginBlockStart: space(20), letterSpacing: '-0.025em', textWrap: 'balance' }
const cell = {
  paddingInline: space(4),
  paddingBlock: space(2),
  border: '1px solid var(--border)',
  textAlign: 'start',
  '&[data-align="center"]': { textAlign: 'center' },
  '&[data-align="end"]': { textAlign: 'end' },
}

export const typography = {
  h1: css({ ...heading, ...text('4xl'), fontWeight: 800 }),
  h2: css({
    ...heading,
    ...text('3xl'),
    fontWeight: 600,
    marginBlockStart: space(10),
    paddingBlockEnd: space(2),
    borderBlockEnd: '1px solid var(--border)',
    '&:first-child': { marginBlockStart: 0 },
  }),
  h3: css({ ...heading, ...text('2xl'), fontWeight: 600, marginBlockStart: space(8) }),
  h4: css({ ...heading, ...text('xl'), fontWeight: 600 }),
  p: css({ margin: 0, lineHeight: space(7), '&:not(:first-child)': { marginBlockStart: space(6) } }),
  lead: css({ margin: 0, ...text('xl'), color: 'var(--muted-foreground)' }),
  large: css({ ...text('lg'), fontWeight: 600 }),
  small: css({ fontSize: 'var(--text-sm)', lineHeight: 1, fontWeight: 500 }),
  muted: css({ margin: 0, ...text('sm'), color: 'var(--muted-foreground)' }),
  link: css({ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '4px' }),
  blockquote: css({
    marginBlock: `${space(6)} 0`,
    marginInline: 0,
    paddingInlineStart: space(6),
    borderInlineStart: '2px solid var(--border)',
    fontStyle: 'italic',
  }),
  list: css({
    marginBlock: space(6),
    marginInline: `${space(6)} 0`,
    padding: 0,
    listStyleType: 'disc',
    '& > li:not(:first-child)': { marginBlockStart: space(2) },
  }),
  inlineCode: css({
    position: 'relative',
    paddingInline: '0.3rem',
    paddingBlock: '0.2rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    ...text('sm'),
    fontWeight: 600,
  }),
  // A wide table scrolls sideways inside this region instead of the page.
  // Give it tabindex="0", role="region" and a name, so a keyboard can scroll it.
  tableRegion: css({ marginBlock: space(6), width: '100%', overflowX: 'auto' }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    '& > caption': { ...text('sm'), paddingBlockEnd: space(2), color: 'var(--muted-foreground)', textAlign: 'start' },
  }),
  tr: css({
    margin: 0,
    padding: 0,
    borderBlockStart: '1px solid var(--border)',
    '&:nth-child(even)': { backgroundColor: 'var(--muted)' },
  }),
  th: css({ ...cell, fontWeight: 700 }),
  td: css(cell),
}

export function TypographyH1() {
  return () => <h1 mix={typography.h1}>Billing that gets out of the way</h1>
}

export function TypographyH2() {
  return () => <h2 mix={typography.h2}>Payment terms</h2>
}

export function TypographyH3() {
  return () => <h3 mix={typography.h3}>Late fees</h3>
}

export function TypographyH4() {
  return () => <h4 mix={typography.h4}>Partial payments</h4>
}

export function TypographyP() {
  return () => (
    <p mix={typography.p}>
      Every invoice starts as a draft. Once you send it, Acme Labs gets an email with a link to pay, and you see the
      moment they open it.
    </p>
  )
}

export function TypographyBlockquote() {
  return () => (
    <blockquote mix={typography.blockquote}>
      “We stopped chasing payments the week we switched. Reminders go out on their own now.”
    </blockquote>
  )
}

export function TypographyList() {
  return () => (
    <ul mix={typography.list}>
      <li>First reminder: 3 days after the due date</li>
      <li>Second reminder: 10 days after the due date</li>
      <li>Final notice: 30 days after the due date</li>
    </ul>
  )
}

export function TypographyInlineCode() {
  return () => (
    <p mix={typography.p}>
      Numbers follow the pattern <code mix={typography.inlineCode}>INV-YYYY-0001</code>.
    </p>
  )
}

export function TypographyLead() {
  return () => <p mix={typography.lead}>Send invoices, collect payments and follow up, without leaving your inbox.</p>
}

export function TypographyLarge() {
  return () => <div mix={typography.large}>Mark this invoice as paid?</div>
}

export function TypographySmall() {
  return () => <small mix={typography.small}>Billing email</small>
}

export function TypographyMuted() {
  return () => <p mix={typography.muted}>We send receipts to this address.</p>
}

const fees = [
  { days: 'Up to 14 days', fee: 'None', share: '62%' },
  { days: '15 to 30 days', fee: '€15.00', share: '27%' },
  { days: 'More than 30 days', fee: '€40.00', share: '11%' },
]

/** A table with a caption, column headers and numbers aligned to the end, in a region that scrolls on a narrow screen. */
export function TypographyTable(handle: Handle) {
  return () => {
    let caption = `${handle.id}-caption`

    return (
      <div role="region" aria-labelledby={caption} tabIndex={0} mix={typography.tableRegion}>
        <table mix={typography.table}>
          <caption id={caption}>Late fees by days overdue</caption>
          <thead>
            <tr mix={typography.tr}>
              <th scope="col" mix={typography.th}>
                Days overdue
              </th>
              <th scope="col" data-align="end" mix={typography.th}>
                Late fee
              </th>
              <th scope="col" data-align="end" mix={typography.th}>
                Share of invoices
              </th>
            </tr>
          </thead>
          <tbody>
            {fees.map((row) => (
              <tr key={row.days} mix={typography.tr}>
                <td mix={typography.td}>{row.days}</td>
                <td data-align="end" mix={typography.td}>
                  {row.fee}
                </td>
                <td data-align="end" mix={typography.td}>
                  {row.share}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

/** A page of long-form text that uses every style. */
export function TypographyDemo() {
  return () => (
    <article>
      <h1 mix={typography.h1}>Getting paid on time</h1>
      <p mix={[typography.lead, typography.p]}>
        A short guide to invoices, reminders and late fees, for teams that would rather do the work than chase it.
      </p>
      <h2 mix={typography.h2}>Sending an invoice</h2>
      <p mix={typography.p}>
        Every invoice starts as a draft. When you send it, the customer gets{' '}
        <a href="#payment-link" mix={typography.link}>
          a link to pay
        </a>{' '}
        and you see the moment they open it. Numbers follow the pattern{' '}
        <code mix={typography.inlineCode}>INV-YYYY-0001</code>.
      </p>
      <blockquote mix={typography.blockquote}>
        “We stopped chasing payments the week we switched. Reminders go out on their own now.”
      </blockquote>
      <h3 mix={typography.h3}>Reminders</h3>
      <p mix={typography.p}>Reminders go out on a schedule you set once:</p>
      <ul mix={typography.list}>
        <li>First reminder: 3 days after the due date</li>
        <li>Second reminder: 10 days after the due date</li>
        <li>Final notice: 30 days after the due date</li>
      </ul>
      <h3 mix={typography.h3}>Late fees</h3>
      <p mix={typography.p}>A late fee joins the invoice when the final notice goes out.</p>
      <TypographyTable />
      <p mix={typography.muted}>Fees are examples. Check what your contracts allow.</p>
    </article>
  )
}
