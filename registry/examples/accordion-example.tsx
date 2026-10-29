// RemixCN Accordion examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  accordionChangeType,
} from '#remixcn/ui/accordion.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const narrowStyles = css({ width: '100%', maxWidth: '32rem', marginInline: 'auto' })
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) })
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

interface Question {
  value: string
  question: string
  answer: string
}

const basics: Question[] = [
  {
    value: 'due',
    question: 'When is an invoice due?',
    answer: 'Thirty days after it goes out, unless you set other terms on the customer.',
  },
  {
    value: 'reminders',
    question: 'Do customers get reminders?',
    answer: 'Yes. A reminder goes out three days before the due date and again on the day.',
  },
  {
    value: 'currency',
    question: 'Can I bill in another currency?',
    answer: 'Yes. Pick the currency on the customer, and every invoice to them uses it.',
  },
]

/** One item open at a time. Opening another closes it, and its own trigger closes it too. */
export const AccordionBasic = clientEntry(import.meta.url, function AccordionBasic() {
  return () => (
    <Accordion mix={narrowStyles}>
      {basics.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
})

/** Several items open at once. */
export const AccordionMultiple = clientEntry(import.meta.url, function AccordionMultiple() {
  let items: Question[] = [
    {
      value: 'late-fees',
      question: 'How do late fees work when a customer pays part of an invoice after its due date?',
      answer:
        'The fee applies to the unpaid part only. It is added once, on the first day after the due date, and the next reminder shows the new total. You can waive it from the invoice at any time, and the customer gets a corrected copy.',
    },
    {
      value: 'credit-notes',
      question: 'What happens to a paid invoice when I issue a credit note against it?',
      answer:
        'The invoice stays paid and keeps its number. The credit note gets its own number and lowers what the customer owes on their next invoice, or you can refund it to the original payment method.',
    },
  ]

  return () => (
    <Accordion multiple mix={narrowStyles}>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
})

const borderedAccordion = css({ gap: space(2) })
const borderedItem = css({
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  '&:not(:last-child)': { borderBlockEnd: '1px solid var(--border)' },
})
const borderedTrigger = css({ paddingInline: space(4) })
const borderedContent = css({ paddingInline: space(4), color: 'var(--muted-foreground)' })

/** Each item in its own box. */
export const AccordionWithBorders = clientEntry(import.meta.url, function AccordionWithBorders() {
  let items = [
    {
      value: 'billing',
      question: 'How does billing work?',
      answer: (
        <p>
          Plans renew monthly or yearly, at the start of each cycle. You can cancel at any time, and there are no setup
          fees.
        </p>
      ),
    },
    {
      value: 'security',
      question: 'Is my data secure?',
      answer: <p>Data is encrypted at rest and in transit, and you can turn on two-factor sign-in for your team.</p>,
    },
    {
      value: 'integrations',
      question: 'Which tools does it connect to?',
      answer: (
        <>
          <p>Accounting tools, payment providers and your own systems through webhooks.</p>
          <p>The API reference has examples for each.</p>
        </>
      ),
    },
  ]

  return () => (
    <Accordion mix={[narrowStyles, borderedAccordion]}>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value} mix={borderedItem}>
          <AccordionTrigger mix={borderedTrigger}>{item.question}</AccordionTrigger>
          <AccordionContent mix={borderedContent}>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
})

/**
 * Rich panels with paragraphs, a link and a button, in a Card, in multiple
 * mode with one item open at first.
 */
export const AccordionRichContent = clientEntry(import.meta.url, function AccordionRichContent() {
  let items = [
    {
      value: 'plans',
      question: 'Which plans are there?',
      answer: (
        <>
          <p>Starter, Team and Business. Each adds invoices per month, users and payment methods.</p>
          <p>
            <a href="#plans">Yearly billing</a> saves two months. Every plan starts with a 14-day trial.
          </p>
          <Button size="sm">Compare plans</Button>
        </>
      ),
    },
    {
      value: 'change',
      question: 'Can I change my plan?',
      answer: (
        <>
          <p>Yes. An upgrade starts at once, and you pay the difference for the rest of the cycle.</p>
          <p>A downgrade starts with the next cycle.</p>
        </>
      ),
    },
    {
      value: 'cancel',
      question: 'How do I cancel?',
      answer: <p>From the billing settings. Your invoices stay available for export for 90 days.</p>,
    },
  ]

  return () => (
    <Card mix={narrowStyles}>
      <CardHeader>
        <CardTitle level={4}>Plans and billing</CardTitle>
        <CardDescription>Questions about your plan and payments.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion multiple defaultValue={['plans']} headingLevel={5}>
          {items.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
})

const disabledAccordion = css({
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
})
const disabledItem = css({
  padding: space(1),
  '&[data-open]': { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
})
const paddedPart = css({ paddingInline: space(4) })

/** A disabled item stays closed and out of the tab order. */
export const AccordionWithDisabled = clientEntry(import.meta.url, function AccordionWithDisabled() {
  let items = [
    {
      value: 'history',
      question: 'Can I see past payments?',
      answer: 'Yes. Every payment, refund and plan change is listed under Payments.',
      disabled: false,
    },
    {
      value: 'audit',
      question: 'Audit log (Business plan)',
      answer: 'The audit log lists every change your team makes.',
      disabled: true,
    },
    {
      value: 'email',
      question: 'How do I change the billing email?',
      answer: 'In the billing settings. We send a confirmation to the new address first.',
      disabled: false,
    },
  ]

  return () => (
    <Accordion mix={[narrowStyles, disabledAccordion]}>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value} disabled={item.disabled} mix={disabledItem}>
          <AccordionTrigger mix={paddedPart}>{item.question}</AccordionTrigger>
          <AccordionContent mix={paddedPart}>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
})

/**
 * A controlled accordion: the owner keeps the open items and renders them.
 * It also keeps the last item open, by cancelling the change that closes it.
 */
export const AccordionControlled = clientEntry(import.meta.url, function AccordionControlled(handle: Handle) {
  let value = ['due']
  let message = 'Open: due.'

  return () => (
    <div mix={[narrowStyles, stackStyles]}>
      <Accordion
        multiple
        value={value}
        mix={on(accordionChangeType, (event) => {
          if (event.value.length === 0) {
            event.preventDefault()
            message = 'One answer stays open.'
          } else {
            value = event.value
            message = `Open: ${value.join(', ')}.`
          }
          void handle.update()
        })}
      >
        {basics.map((item) => (
          <AccordionItem key={item.value} value={item.value}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p role="status" mix={hintStyles}>
        {message}
      </p>
    </div>
  )
})

/** Closed panels stay in the page, hidden until find in page matches their text. */
export const AccordionHiddenUntilFound = clientEntry(import.meta.url, function AccordionHiddenUntilFound() {
  let items: Question[] = [
    { value: 'shipping', question: 'How long does delivery take?', answer: 'Three to five working days.' },
    {
      value: 'returns',
      question: 'What is the return policy?',
      answer: 'Return anything within 30 days. Opened items may carry a restocking fee.',
    },
  ]

  return () => (
    <div mix={[narrowStyles, stackStyles]}>
      <p mix={hintStyles}>Search the page for "restocking" to open the second answer.</p>
      <Accordion hiddenUntilFound>
        {items.map((item) => (
          <AccordionItem key={item.value} value={item.value}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
})
