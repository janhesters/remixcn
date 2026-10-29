// RemixCN Card examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const fieldStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(1.5),
  '& label': { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)', fontWeight: 500 },
})
const inputStyles = css({
  minHeight: space(9),
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
})
const fullWidth = css({ width: '100%' })
const totalStyles = css({
  margin: 0,
  fontSize: 'var(--text-2xl)',
  lineHeight: 'var(--text-2xl--line-height)',
  fontWeight: 600,
  overflowWrap: 'anywhere',
})
const linesStyles = css({ display: 'grid', gap: space(2), margin: 0, padding: 0, listStyle: 'none' })
const lineStyles = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: space(4) })

/**
 * A form in a card. The title is a heading and names the card, which is a
 * region, and the native form submits to the action you pass.
 */
export function CardWithForm(handle: Handle<{ action: string }>) {
  return () => {
    let title = `${handle.id}-title`
    let email = `${handle.id}-email`

    return (
      <Card role="region" aria-labelledby={title}>
        <CardHeader>
          <CardTitle level={3} id={title}>
            Send a reminder
          </CardTitle>
          <CardDescription>Acme Labs gets an email with a link to pay INV-0042.</CardDescription>
          <CardAction>
            <Button variant="link" size="sm">
              Preview
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form id={`${handle.id}-form`} action={handle.props.action} method="post" mix={stackStyles}>
            <div mix={fieldStyles}>
              <label for={email}>Billing email</label>
              <input
                id={email}
                name="email"
                type="email"
                required
                defaultValue="billing@acme.example"
                mix={inputStyles}
              />
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form={`${handle.id}-form`} name="intent" value="remind" mix={fullWidth}>
            Send reminder
          </Button>
        </CardFooter>
      </Card>
    )
  }
}

const lines = [
  { label: 'Design work', amount: '€900.00' },
  { label: 'Hosting', amount: '€300.00' },
]

/** The default and the small size, with the header and footer drawing a border. */
export function CardSizes() {
  return () => (
    <div mix={stackStyles}>
      {(['default', 'sm'] as const).map((size) => (
        <Card key={size} size={size}>
          <CardHeader border>
            <CardTitle level={3}>INV-0042</CardTitle>
            <CardDescription>{size === 'sm' ? 'Small size' : 'Default size'}, due 4 November</CardDescription>
          </CardHeader>
          <CardContent>
            <ul mix={linesStyles}>
              {lines.map((line) => (
                <li key={line.label} mix={lineStyles}>
                  <span>{line.label}</span>
                  <span>{line.amount}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter border>
            <p mix={totalStyles}>€1,200.00</p>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

const chart = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><rect width="320" height="160" fill="#d4d4d4"/><path d="M0 130 60 105 120 115 180 70 240 82 320 30V160H0Z" fill="#737373"/></svg>',
)}`

/** An image that starts the card reaches its edges. */
export function CardWithImage() {
  return () => (
    <Card>
      <img src={chart} alt="Revenue rising from January to June" width="320" height="160" />
      <CardHeader>
        <CardTitle level={3}>Revenue report</CardTitle>
        <CardDescription>January to June</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm">
          Download
        </Button>
      </CardFooter>
    </Card>
  )
}

const tableStyles = css({
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': {
    paddingBlock: space(2),
    paddingInline: 'var(--card-spacing)',
    borderBlockStart: '1px solid var(--border)',
    textAlign: 'start',
  },
  '& th:last-child, & td:last-child': { textAlign: 'end' },
})
const edgeStyles = css({ paddingInline: 0, overflowX: 'auto' })

/**
 * Content that reaches the card's edges, such as a table, with the card's
 * spacing inside its cells. A table too wide for a narrow screen scrolls
 * inside the content, which a keyboard can reach and the title names.
 */
export function CardEdgeToEdge(handle: Handle) {
  return () => (
    <Card>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Open invoices
        </CardTitle>
      </CardHeader>
      <CardContent role="region" aria-labelledby={`${handle.id}-title`} tabIndex={0} mix={edgeStyles}>
        <table mix={tableStyles}>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Acme Labs</td>
              <td>€1,200.00</td>
            </tr>
            <tr>
              <td>Globex</td>
              <td>€640.00</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

const roomyStyles = css({ '--card-spacing': space(10) })

/** --card-spacing sets the padding and gaps of every part. */
export function CardCustomSpacing() {
  return () => (
    <Card mix={roomyStyles}>
      <CardHeader>
        <CardTitle level={3}>Annual plan</CardTitle>
        <CardDescription>2.5rem around and between the parts.</CardDescription>
      </CardHeader>
      <CardContent>Billed once a year, with two months free.</CardContent>
    </Card>
  )
}
