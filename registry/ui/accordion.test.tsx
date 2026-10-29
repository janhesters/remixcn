import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots, slotTag, tags } from '../../test/html.ts'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion.tsx'

function Faq(handle: Handle<{ defaultValue?: string[]; value?: string[]; multiple?: boolean; disabled?: boolean }>) {
  return () => (
    <Accordion {...handle.props}>
      <AccordionItem value="billing">
        <AccordionTrigger>How does billing work?</AccordionTrigger>
        <AccordionContent>Invoices go out on the first of the month.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="refunds">
        <AccordionTrigger>Can I get a refund?</AccordionTrigger>
        <AccordionContent>Within 30 days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="export" disabled>
        <AccordionTrigger>Can I export invoices?</AccordionTrigger>
        <AccordionContent>As CSV.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe('Accordion', () => {
  it('renders each trigger as a native button inside a heading', async () => {
    let html = await renderToString(<Faq />)
    let headers = slots(html, 'accordion-header')
    let triggers = slots(html, 'accordion-trigger')

    assert.equal(slotTag(html, 'accordion'), 'div')
    assert.equal(slotTag(html, 'accordion-header'), 'h3')
    assert.equal(headers.length, 3)
    assert.deepEqual(
      triggers.map((trigger) => [trigger.get('type'), trigger.get('aria-expanded')]),
      [
        ['button', 'false'],
        ['button', 'false'],
        ['button', 'false'],
      ],
    )
    let names = tags(html)
    let headerIndex = names.findIndex((tag) => tag.attributes.get('data-slot') === 'accordion-header')
    assert.equal(names[headerIndex + 1].attributes.get('data-slot'), 'accordion-trigger')
  })

  it('renders the open items with their panels, labelled by their triggers', async () => {
    let html = await renderToString(<Faq defaultValue={['refunds']} />)
    let items = slots(html, 'accordion-item')
    let [billing, refunds] = slots(html, 'accordion-trigger')
    let [panel] = slots(html, 'accordion-content')

    assert.equal(slots(html, 'accordion-content').length, 1)
    assert.ok(items[1].has('data-open'))
    assert.ok(items[0].has('data-closed'))
    assert.equal(billing.get('aria-expanded'), 'false')
    assert.equal(refunds.get('aria-expanded'), 'true')
    assert.ok(refunds.has('data-panel-open'))
    assert.equal(refunds.get('aria-controls'), panel.get('id'))
    assert.equal(panel.get('role'), 'region')
    assert.equal(panel.get('aria-labelledby'), refunds.get('id'))
    assert.ok(html.includes('Within 30 days.'))
    assert.ok(!html.includes('Invoices go out'))
  })

  it('opens one item at a time unless it allows multiple', async () => {
    let single = await renderToString(<Faq value={['billing', 'refunds']} />)
    let multiple = await renderToString(<Faq value={['billing', 'refunds']} multiple />)

    assert.equal(slots(single, 'accordion-content').length, 1)
    assert.equal(attributes(single, 'slot:accordion-trigger').get('aria-expanded'), 'true')
    assert.equal(slots(multiple, 'accordion-content').length, 2)
  })

  it('disables an item, or every item, natively', async () => {
    let html = await renderToString(<Faq />)
    let all = await renderToString(<Faq disabled />)

    assert.deepEqual(
      slots(html, 'accordion-trigger').map((trigger) => trigger.has('disabled')),
      [false, false, true],
    )
    assert.ok(slots(html, 'accordion-item')[2].has('data-disabled'))
    assert.ok(slots(all, 'accordion-trigger').every((trigger) => trigger.has('disabled')))
  })

  it('derives stable ids from the accordion id and item values', async () => {
    let html = await renderToString(
      <Accordion id="faq" defaultValue={['late fees']}>
        <AccordionItem value="late fees">
          <AccordionTrigger>Are there late fees?</AccordionTrigger>
          <AccordionContent>No.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    let trigger = attributes(html, 'slot:accordion-trigger')
    let panel = attributes(html, 'slot:accordion-content')

    assert.equal(attributes(html, 'slot:accordion').get('id'), 'faq')
    assert.ok(!trigger.get('id')?.includes(' '), 'ids never hold spaces')
    assert.ok(trigger.get('id')?.startsWith('faq-'))
    assert.equal(trigger.get('aria-controls'), panel.get('id'))
    assert.equal(panel.get('aria-labelledby'), trigger.get('id'))
  })

  it('sets the heading level on the accordion or one trigger', async () => {
    let html = await renderToString(
      <Accordion headingLevel={2}>
        <AccordionItem value="a">
          <AccordionTrigger>Two</AccordionTrigger>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger headingLevel={4}>Four</AccordionTrigger>
        </AccordionItem>
      </Accordion>,
    )

    assert.deepEqual(
      tags(html)
        .filter((tag) => tag.attributes.get('data-slot') === 'accordion-header')
        .map((tag) => tag.name),
      ['h2', 'h4'],
    )
  })

  it('keeps closed panels, hidden, when the accordion or a panel asks for it', async () => {
    let kept = await renderToString(
      <Accordion keepMounted>
        <AccordionItem value="a">
          <AccordionTrigger>A</AccordionTrigger>
          <AccordionContent>Kept</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>B</AccordionTrigger>
          <AccordionContent hiddenUntilFound>Found</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    let found = await renderToString(
      <Accordion hiddenUntilFound>
        <AccordionItem value="a">
          <AccordionTrigger>A</AccordionTrigger>
          <AccordionContent>Searchable</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    assert.deepEqual(
      slots(kept, 'accordion-content').map((panel) => panel.get('hidden')),
      ['', 'until-found'],
    )
    assert.equal(attributes(found, 'slot:accordion-content').get('hidden'), 'until-found')
    assert.ok(found.includes('Searchable'))
  })

  it("passes the caller's attributes to each part", async () => {
    let html = await renderToString(
      <Accordion class="faq" defaultValue={['a']}>
        <AccordionItem value="a" class="item" data-test="item">
          <AccordionTrigger class="trigger" data-test="trigger">
            A
          </AccordionTrigger>
          <AccordionContent class="content" data-test="content">
            Text
          </AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    assert.ok(attributes(html, 'slot:accordion').get('class')?.split(' ').includes('faq'))
    for (let [part, name] of [
      ['accordion-item', 'item'],
      ['accordion-trigger', 'trigger'],
      ['accordion-content', 'content'],
    ]) {
      let found = attributes(html, `slot:${part}`)
      assert.ok(found.get('class')?.split(' ').includes(name), part)
      assert.equal(found.get('data-test'), name)
    }
  })

  it("keeps the caller's inert on an open panel", async () => {
    let html = await renderToString(
      <Accordion defaultValue={['a']}>
        <AccordionItem value="a">
          <AccordionTrigger>A</AccordionTrigger>
          <AccordionContent inert>
            <a href="#plans">Plans</a>
          </AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    assert.ok(attributes(html, 'slot:accordion-content').has('inert'))
  })

  it('hides the chevron from assistive technology', async () => {
    let html = await renderToString(<Faq />)
    let svg = tags(html).find((tag) => tag.name === 'svg')

    assert.equal(svg?.attributes.get('aria-hidden'), 'true')
  })
})
