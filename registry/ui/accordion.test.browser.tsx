import { on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Accordion,
  AccordionChangeEvent,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  accordionChangeType,
} from './accordion.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible.tsx'
import type { AccordionProps } from './accordion.tsx'

// Without theme.css the panels move in 0s, as with reduced motion.
function mount(t: TestContext, node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let result = render(node, { container })
  t.after(result.cleanup)
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function settle(act: (fn: () => unknown) => Promise<void>) {
  for (let i = 0; i < 3; i++) await act(() => nextFrame())
}

const questions = [
  { value: 'billing', question: 'How does billing work?', answer: 'Invoices go out on the first.' },
  { value: 'refunds', question: 'Can I get a refund?', answer: 'Within 30 days.' },
  { value: 'export', question: 'Can I export invoices?', answer: 'As CSV.' },
]

function Faq(handle: Handle<AccordionProps & { items?: typeof questions; disabledItem?: string }>) {
  return () => {
    let { items = questions, disabledItem, ...props } = handle.props
    return (
      <Accordion {...props}>
        {items.map((item) => (
          <AccordionItem key={item.value} value={item.value} disabled={item.value === disabledItem}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }
}

function trigger(container: HTMLElement, name: string) {
  let button = [...container.querySelectorAll<HTMLButtonElement>('[data-slot="accordion-trigger"]')].find((node) =>
    node.textContent?.includes(name),
  )
  if (!button) throw new Error(`No trigger named ${name}`)
  return button
}

function expanded(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="accordion-trigger"]')]
    .filter((node) => node.getAttribute('aria-expanded') === 'true')
    .map((node) => node.textContent)
}

function panels(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="accordion-content"]')].map((node) => node.textContent)
}

describe('Accordion in the browser', () => {
  it('opens one item at a time, and closes the open item from its trigger', async (t) => {
    let { container, act } = mount(t, <Faq />)

    await act(() => trigger(container, 'billing').click())
    assert.deepEqual(expanded(container), ['How does billing work?'])

    await act(() => trigger(container, 'refund').click())
    await settle(act)
    assert.deepEqual(expanded(container), ['Can I get a refund?'])
    assert.deepEqual(panels(container), ['Within 30 days.'])

    await act(() => trigger(container, 'refund').click())
    await settle(act)
    assert.deepEqual(expanded(container), [])
    assert.deepEqual(panels(container), [])
  })

  it('opens several items when it allows multiple', async (t) => {
    let { container, act } = mount(t, <Faq multiple defaultValue={['export']} />)

    await act(() => trigger(container, 'billing').click())
    await act(() => trigger(container, 'refund').click())

    assert.deepEqual(expanded(container), ['How does billing work?', 'Can I get a refund?', 'Can I export invoices?'])
  })

  it('announces each change on its item, with the next value, and keeps the value when cancelled', async (t) => {
    let seen: Array<{ value: string[]; item: string; open: boolean; on: string | undefined }> = []
    let cancel = false
    let { container, act } = mount(
      t,
      <div
        mix={on(accordionChangeType, (event) => {
          assert.ok(event instanceof AccordionChangeEvent)
          seen.push({
            value: event.value,
            item: event.item,
            open: event.open,
            on: (event.target as HTMLElement).dataset.slot,
          })
          if (cancel) event.preventDefault()
        })}
      >
        <Faq multiple defaultValue={['billing']} />
      </div>,
    )

    await act(() => trigger(container, 'refund').click())
    cancel = true
    await act(() => trigger(container, 'billing').click())

    assert.deepEqual(seen, [
      { value: ['billing', 'refunds'], item: 'refunds', open: true, on: 'accordion-item' },
      { value: ['refunds'], item: 'billing', open: false, on: 'accordion-item' },
    ])
    assert.deepEqual(expanded(container), ['How does billing work?', 'Can I get a refund?'])
  })

  it('changes a controlled accordion only when its owner renders the new value', async (t) => {
    function Controlled(handle: Handle) {
      let value: string[] = ['billing']
      let accept = false
      return () => (
        <div>
          <button
            type="button"
            data-action="accept"
            mix={on('click', () => {
              accept = true
            })}
          >
            Accept
          </button>
          <Faq
            value={value}
            mix={on(accordionChangeType, (event) => {
              if (!accept) return
              value = event.value
              void handle.update()
            })}
          />
        </div>
      )
    }
    let { container, $, act } = mount(t, <Controlled />)

    await act(() => trigger(container, 'refund').click())
    assert.deepEqual(expanded(container), ['How does billing work?'])

    await act(() => ($('[data-action="accept"]') as HTMLButtonElement).click())
    await act(() => trigger(container, 'refund').click())
    await settle(act)
    assert.deepEqual(expanded(container), ['Can I get a refund?'])
  })

  it('keeps a disabled item closed, and a disabled accordion as it is', async (t) => {
    let { container, act } = mount(t, <Faq disabledItem="export" />)

    assert.equal(trigger(container, 'export').disabled, true)
    await act(() => trigger(container, 'export').click())
    assert.deepEqual(expanded(container), [])

    let all = mount(t, <Faq disabled defaultValue={['billing']} />)
    assert.ok(
      [...all.container.querySelectorAll<HTMLButtonElement>('[data-slot="accordion-trigger"]')].every(
        (button) => button.disabled,
      ),
    )
    assert.deepEqual(expanded(all.container), ['How does billing work?'])
  })

  it('keeps open state, ids and focus with each item when items are reordered, removed and added', async (t) => {
    function Changing(handle: Handle) {
      let items = questions
      let change = (next: typeof questions) =>
        on<HTMLButtonElement, 'click'>('click', () => {
          items = next
          void handle.update()
        })
      return () => (
        <div>
          <Faq multiple defaultValue={['refunds']} items={items} />
          <button type="button" data-action="reverse" mix={change([...questions].reverse())}>
            Reverse
          </button>
          <button type="button" data-action="remove" mix={change(questions.filter((item) => item.value !== 'billing'))}>
            Remove
          </button>
          <button
            type="button"
            data-action="add"
            mix={change([...questions, { value: 'tax', question: 'Do you add tax?', answer: 'Where required.' }])}
          >
            Add
          </button>
        </div>
      )
    }
    let { container, $, act } = mount(t, <Changing />)
    let refunds = trigger(container, 'refund')
    let ids = { trigger: refunds.id, panel: refunds.getAttribute('aria-controls') }
    refunds.focus()

    // A script click keeps focus where it is.
    await act(() => ($('[data-action="reverse"]') as HTMLButtonElement).click())
    assert.deepEqual(expanded(container), ['Can I get a refund?'])
    assert.equal(trigger(container, 'refund'), refunds)
    assert.equal(document.activeElement, refunds)
    assert.deepEqual(
      [...container.querySelectorAll('[data-slot="accordion-trigger"]')].map((node) => node.textContent),
      ['Can I export invoices?', 'Can I get a refund?', 'How does billing work?'],
    )

    await act(() => ($('[data-action="remove"]') as HTMLButtonElement).click())
    await act(() => ($('[data-action="add"]') as HTMLButtonElement).click())
    await act(() => trigger(container, 'tax').click())

    assert.deepEqual(expanded(container), ['Can I get a refund?', 'Do you add tax?'])
    assert.deepEqual({ trigger: refunds.id, panel: refunds.getAttribute('aria-controls') }, ids)
    let allIds = [...container.querySelectorAll('[id]')].map((node) => node.id)
    assert.equal(new Set(allIds).size, allIds.length)
    for (let button of container.querySelectorAll('[data-slot="accordion-trigger"][aria-controls]')) {
      let panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
      assert.equal(panel?.getAttribute('aria-labelledby'), button.id)
    }
  })

  it('leaves a collapsible nested in a panel to itself', async (t) => {
    let { container, act } = mount(
      t,
      <Accordion defaultValue={['billing']}>
        <AccordionItem value="billing">
          <AccordionTrigger>How does billing work?</AccordionTrigger>
          <AccordionContent>
            <Collapsible>
              <CollapsibleTrigger>Show fees</CollapsibleTrigger>
              <CollapsibleContent>No fees.</CollapsibleContent>
            </Collapsible>
          </AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    let inner = container.querySelector('[data-slot="collapsible-trigger"]') as HTMLButtonElement

    await act(() => inner.click())

    assert.equal(inner.getAttribute('aria-expanded'), 'true')
    assert.deepEqual(expanded(container), ['How does billing work?'])
  })

  it('keeps separate state per accordion', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <div data-instance="one">
          <Faq />
        </div>
        <div data-instance="two">
          <Faq />
        </div>
      </div>,
    )
    let one = container.querySelector('[data-instance="one"]') as HTMLElement
    let two = container.querySelector('[data-instance="two"]') as HTMLElement

    await act(() => trigger(one, 'billing').click())
    await act(() => trigger(two, 'export').click())

    assert.deepEqual(expanded(one), ['How does billing work?'])
    assert.deepEqual(expanded(two), ['Can I export invoices?'])
    assert.notEqual(trigger(one, 'billing').id, trigger(two, 'billing').id)
  })

  it('opens the item whose hidden panel find in page matches, and closes the open one', async (t) => {
    let { container, act } = mount(t, <Faq hiddenUntilFound defaultValue={['billing']} />)
    let panel = [...container.querySelectorAll<HTMLElement>('[data-slot="accordion-content"]')].find((node) =>
      node.textContent?.includes('CSV'),
    ) as HTMLElement

    assert.equal(panel.getAttribute('hidden'), 'until-found')
    await act(() => {
      panel.removeAttribute('hidden')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
    })
    await settle(act)

    assert.deepEqual(expanded(container), ['Can I export invoices?'])
    assert.equal(panel.hasAttribute('hidden'), false)
  })

  it("runs the caller's refs and events on the item, trigger and panel", async (t) => {
    let slots: string[] = []
    let clicks = 0
    let record = ref((node: HTMLElement) => void slots.push(node.dataset.slot ?? ''))
    let { container, act } = mount(
      t,
      <Accordion mix={record}>
        <AccordionItem value="billing" mix={record}>
          <AccordionTrigger mix={[record, on('click', () => void clicks++)]}>How does billing work?</AccordionTrigger>
          <AccordionContent mix={record}>Monthly.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    await act(() => trigger(container, 'billing').click())

    assert.equal(clicks, 1)
    assert.deepEqual(slots.sort(), ['accordion', 'accordion-content', 'accordion-item', 'accordion-trigger'])
  })
})
