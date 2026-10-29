import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  describedBy,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  fieldErrorMessages,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './field.tsx'

describe('fieldErrorMessages', () => {
  it('keeps trimmed, nonempty messages once each, in the order they first appear', () => {
    assert.deepEqual(
      fieldErrorMessages([
        { message: ' Enter an email address. ' },
        undefined,
        { message: '' },
        null,
        { message: '   ' },
        {},
        { message: 'Use your work address.' },
        { message: 'Enter an email address.' },
      ]),
      ['Enter an email address.', 'Use your work address.'],
    )
  })

  it('returns no messages for no errors', () => {
    assert.deepEqual(fieldErrorMessages(), [])
    assert.deepEqual(fieldErrorMessages([]), [])
  })
})

describe('describedBy', () => {
  it('joins the ids of the descriptions and errors that are shown, once each', () => {
    assert.equal(
      describedBy('email-hint', false, undefined, ' email-error ', null, '', 'email-hint'),
      'email-hint email-error',
    )
  })

  it('returns undefined without ids, so the attribute goes away', () => {
    assert.equal(describedBy(), undefined)
    assert.equal(describedBy(false, null, undefined, ' '), undefined)
  })
})

describe('FieldSet and FieldLegend', () => {
  it('render a native fieldset whose legend names the group, in the legend or label look', async () => {
    let html = await renderToString(
      <FieldSet disabled form="checkout">
        <FieldLegend>Billing address</FieldLegend>
        <FieldLegend variant="label">Plan</FieldLegend>
      </FieldSet>,
    )
    let fieldset = attributes(html, 'fieldset')
    let [legend, label] = tags(html, 'legend')

    assert.equal(fieldset.get('data-slot'), 'field-set')
    assert.ok(fieldset.has('disabled'))
    assert.equal(fieldset.get('form'), 'checkout')
    assert.equal(legend.attributes.get('data-slot'), 'field-legend')
    assert.equal(legend.attributes.get('data-variant'), 'legend')
    assert.equal(label.attributes.get('data-variant'), 'label')
  })
})

describe('FieldGroup', () => {
  it('renders a div that stacks fields, and keeps a slot the caller gives it', async () => {
    assert.equal(attributes(await renderToString(<FieldGroup />), 'div').get('data-slot'), 'field-group')
    assert.equal(
      attributes(await renderToString(<FieldGroup data-slot="checkbox-group" />), 'div').get('data-slot'),
      'checkbox-group',
    )
  })
})

describe('Field', () => {
  it('renders a vertical group by default, without a form, an id or a state of its own', async () => {
    let html = await renderToString(
      <Field>
        <FieldLabel for="email">Email</FieldLabel>
        <input id="email" name="email" />
      </Field>,
    )
    let field = attributes(html, 'div')

    assert.equal(field.get('role'), 'group')
    assert.equal(field.get('data-slot'), 'field')
    assert.equal(field.get('data-orientation'), 'vertical')
    assert.equal(field.has('id'), false)
    assert.equal(field.has('data-invalid'), false)
    assert.equal(field.has('data-disabled'), false)
    assert.deepEqual(tags(html, 'form'), [])
    assert.deepEqual(
      tags(html).flatMap((tag) => (tag.attributes.has('id') ? [tag.attributes.get('id')] : [])),
      ['email'],
    )
  })

  it('renders each orientation', async () => {
    for (let orientation of ['vertical', 'horizontal', 'responsive'] as const) {
      let field = attributes(await renderToString(<Field orientation={orientation} />), 'div')
      assert.equal(field.get('data-orientation'), orientation)
    }
  })

  it('marks the invalid and disabled states the caller gives it with literal strings', async () => {
    let field = attributes(await renderToString(<Field invalid disabled />), 'div')

    assert.equal(field.get('data-invalid'), 'true')
    assert.equal(field.get('data-disabled'), 'true')
  })

  it("reads shadcn's data-invalid and data-disabled too, and leaves false states out", async () => {
    let marked = attributes(await renderToString(<Field data-invalid data-disabled={true} />), 'div')
    let cleared = attributes(await renderToString(<Field invalid={false} data-disabled={false} />), 'div')

    assert.equal(marked.get('data-invalid'), 'true')
    assert.equal(marked.get('data-disabled'), 'true')
    assert.equal(cleared.has('data-invalid'), false)
    assert.equal(cleared.has('data-disabled'), false)
  })

  it('takes a name for its group from the caller', async () => {
    let field = attributes(await renderToString(<Field aria-labelledby="plan-title" />), 'div')

    assert.equal(field.get('aria-labelledby'), 'plan-title')
  })
})

describe('FieldContent, FieldLabel, FieldTitle and FieldDescription', () => {
  it('render their elements and slots', async () => {
    let html = await renderToString(
      <Field orientation="horizontal">
        <input type="checkbox" id="remind" />
        <FieldContent>
          <FieldLabel htmlFor="remind">Remind the customer</FieldLabel>
          <FieldTitle>Reminders</FieldTitle>
          <FieldDescription>
            We send it three days before the due date. <a href="/settings">Settings</a>
          </FieldDescription>
        </FieldContent>
      </Field>,
    )
    let slots = tags(html).flatMap((tag) =>
      tag.attributes.has('data-slot') ? [`${tag.name}:${tag.attributes.get('data-slot')}`] : [],
    )

    assert.deepEqual(slots, [
      'div:field',
      'div:field-content',
      'label:field-label',
      'div:field-label',
      'p:field-description',
    ])
    assert.equal(attributes(html, 'label').get('for'), 'remind')
  })
})

describe('FieldSeparator', () => {
  it('draws a separator line and no text by default', async () => {
    let html = await renderToString(<FieldSeparator />)
    let wrapper = attributes(html, 'slot:field-separator')

    assert.equal(wrapper.get('data-content'), 'false')
    assert.equal(attributes(html, 'slot:separator').get('role'), 'separator')
    assert.equal(
      tags(html).some((tag) => tag.attributes.get('data-slot') === 'field-separator-content'),
      false,
    )
  })

  it('shows its text between the lines', async () => {
    let html = await renderToString(<FieldSeparator>Or continue with</FieldSeparator>)

    assert.equal(attributes(html, 'slot:field-separator').get('data-content'), 'true')
    assert.equal(attributes(html, 'slot:field-separator-content').has('aria-hidden'), false)
    assert.equal(text(html), 'Or continue with')
  })

  it('treats empty and blank text as no text', async () => {
    for (let children of ['', '   ', null, false, [undefined, ' '], <span> </span>]) {
      let html = await renderToString(<FieldSeparator>{children}</FieldSeparator>)
      assert.equal(attributes(html, 'slot:field-separator').get('data-content'), 'false')
    }
  })
})

describe('FieldError', () => {
  async function error(node: Parameters<typeof renderToString>[0]) {
    let html = await renderToString(node)
    return { html, alerts: tags(html).filter((tag) => tag.attributes.get('role') === 'alert'), text: text(html) }
  }

  it('renders nothing without a message, never an empty alert', async () => {
    for (let node of [
      <FieldError />,
      <FieldError errors={[]} />,
      <FieldError errors={[undefined, { message: '' }, { message: '  ' }, {}]} />,
      <FieldError>{'  '}</FieldError>,
      <FieldError errors={[]}>{null}</FieldError>,
    ]) {
      let { html } = await error(node)
      assert.equal(html.replaceAll(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace('<head></head>', ''), '')
    }
  })

  it('shows one message as text in an alert with an icon assistive technology skips', async () => {
    let {
      html,
      alerts,
      text: shown,
    } = await error(
      <FieldError
        id="email-error"
        errors={[{ message: 'Enter an email address.' }, { message: 'Enter an email address.' }]}
      />,
    )

    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].attributes.get('id'), 'email-error')
    assert.equal(alerts[0].attributes.get('data-slot'), 'field-error')
    assert.equal(attributes(html, 'svg').get('aria-hidden'), 'true')
    assert.deepEqual(tags(html, 'ul'), [])
    assert.equal(shown, 'Enter an email address.')
  })

  it('lists several messages, trimmed and once each, in the order they first appear', async () => {
    let { html } = await error(
      <FieldError
        errors={[
          { message: 'Enter at least 8 characters.' },
          { message: ' Add a number. ' },
          { message: 'Enter at least 8 characters.' },
        ]}
      />,
    )

    assert.equal(tags(html, 'ul').length, 1)
    assert.equal(tags(html, 'li').length, 2)
    assert.equal(text(html), 'Enter at least 8 characters.Add a number.')
  })

  it('shows its children instead of the messages', async () => {
    let { text: shown } = await error(
      <FieldError errors={[{ message: 'Enter an email address.' }]}>
        <span>Choose another address.</span>
      </FieldError>,
    )

    assert.equal(shown, 'Choose another address.')
  })

  it('keeps the messages when its children hold no text, such as an empty element or fragment', async () => {
    for (let children of [
      <span> </span>,
      <>{''}</>,
      <strong>
        <em>{null}</em>
        {'  '}
      </strong>,
    ]) {
      let { alerts, text: shown } = await error(<FieldError errors={[{ message: 'Required.' }]}>{children}</FieldError>)

      assert.equal(alerts.length, 1)
      assert.equal(shown, 'Required.')
    }
  })

  it('renders nothing for children without text and no messages', async () => {
    let { html } = await error(
      <FieldError>
        <span> </span>
      </FieldError>,
    )

    assert.equal(html.replaceAll(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace('<head></head>', ''), '')
  })

  it('shows text deep in its children, and a component, whose text is unknown until it renders', async () => {
    function Reason() {
      return () => <span>Choose another address.</span>
    }

    for (let [children, expected] of [
      [
        <span>
          <strong>Taken.</strong>
        </span>,
        'Taken.',
      ],
      [<Reason />, 'Choose another address.'],
    ] as const) {
      let { alerts, text: shown } = await error(<FieldError errors={[{ message: 'Required.' }]}>{children}</FieldError>)

      assert.equal(alerts.length, 1)
      assert.equal(shown, expected)
    }
  })

  it('escapes messages as text', async () => {
    let { html, text: shown } = await error(<FieldError errors={[{ message: '<img src=x onerror=alert(1)>' }]} />)

    assert.equal(tags(html, 'img').length, 0)
    assert.equal(shown, '<img src=x onerror=alert(1)>')
  })
})
