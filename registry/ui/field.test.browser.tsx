import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

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
import type { FieldErrorEntry } from './field.tsx'
import { Checkbox } from './checkbox.tsx'
import { Input } from './input.tsx'
import { NativeSelect, NativeSelectOption } from './native-select.tsx'
import { RadioGroup, RadioGroupItem } from './radio-group.tsx'
import { Switch } from './switch.tsx'
import { Textarea } from './textarea.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// The browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  '--spacing': '4px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
  '--text-base': '16px',
  '--text-base--line-height': '24px',
  '--destructive': 'rgb(200, 0, 0)',
  '--muted-foreground': 'rgb(100, 100, 100)',
  '--border': 'rgb(220, 220, 220)',
  '--input': 'rgb(120, 120, 120)',
  '--ring': 'rgb(0, 0, 200)',
  '--primary': 'rgb(20, 20, 20)',
  '--muted': 'rgb(240, 240, 240)',
  '--radius-md': '6px',
  fontSize: '16px',
  colorScheme: 'light',
}

// theme.css sizes every box with its border, as the components expect.
const borderBox = css({ '&, & *, & *::before, & *::after': { boxSizing: 'border-box' } })

function Frame(handle: Handle<{ width: string; dir?: 'ltr' | 'rtl'; children?: RemixNode }>) {
  return () => (
    <div dir={handle.props.dir} style={{ ...tokens, width: handle.props.width }} mix={borderBox}>
      {handle.props.children}
    </div>
  )
}

function box(element: Element) {
  return element.getBoundingClientRect()
}

function find<T extends Element = HTMLElement>(container: Element, selector: string) {
  let found = container.querySelector<T>(selector)
  assert.ok(found, `nothing matches ${selector}`)
  return found
}

// A field whose owner adds and clears validation errors with buttons, as a
// form owner does after each submission.
function EmailField(handle: Handle<{ name: string }>) {
  let errors: FieldErrorEntry[] = []
  let set = (next: FieldErrorEntry[]) =>
    on<HTMLButtonElement, 'click'>('click', () => {
      errors = next
      void handle.update()
    })

  return () => {
    let { name } = handle.props
    let messages = fieldErrorMessages(errors)
    let invalid = messages.length > 0

    return (
      <div data-owner={name}>
        <Field invalid={invalid}>
          <FieldLabel for={`${name}-input`}>Email</FieldLabel>
          <Input
            id={`${name}-input`}
            name={name}
            type="email"
            aria-invalid={invalid}
            aria-describedby={describedBy(`${name}-hint`, invalid && `${name}-error`)}
          />
          <FieldDescription id={`${name}-hint`}>We send invoices here.</FieldDescription>
          <FieldError id={`${name}-error`} errors={errors} />
        </Field>
        <button type="button" data-action="one" mix={set([{ message: 'Enter an email address.' }])}>
          One
        </button>
        <button
          type="button"
          data-action="two"
          mix={set([{ message: 'Enter an email address.' }, { message: ' Use your work address. ' }, undefined])}
        >
          Two
        </button>
        <button type="button" data-action="blank" mix={set([{ message: '  ' }, undefined])}>
          Blank
        </button>
        <button type="button" data-action="clear" mix={set([])}>
          Clear
        </button>
      </div>
    )
  }
}

function press(container: Element, owner: string, action: string) {
  find<HTMLButtonElement>(container, `[data-owner="${owner}"] [data-action="${action}"]`).click()
}

/** Checks that ids are unique and that every label, description and error reference names an element that exists. */
function checkReferences(container: Element) {
  let ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
  assert.deepEqual(ids, [...new Set(ids)], 'ids are unique')
  for (let element of container.querySelectorAll('[aria-describedby], [aria-labelledby], label[for]')) {
    let references = [
      ...(element.getAttribute('aria-describedby') ?? '').split(' '),
      ...(element.getAttribute('aria-labelledby') ?? '').split(' '),
      element.getAttribute('for') ?? '',
    ].filter(Boolean)
    for (let id of references) assert.ok(document.getElementById(id), `${id} is referenced but missing`)
  }
  for (let alert of container.querySelectorAll('[role="alert"]')) {
    assert.ok(alert.textContent?.trim(), 'no alert is empty')
  }
}

// Shows the server's reason in a styled child, and clears its text, as an owner might.
function ReasonError(handle: Handle<{ errors?: FieldErrorEntry[] }>) {
  let reason = 'This address is taken.'

  return () => (
    <div>
      <FieldError id="field-test-reason" errors={handle.props.errors}>
        <span data-reason>{reason}</span>
      </FieldError>
      <button
        type="button"
        mix={on('click', () => {
          reason = ' '
          void handle.update()
        })}
      >
        Clear
      </button>
    </div>
  )
}

describe('Field in the browser', () => {
  it('stacks a vertical field and lets its controls fill it', async (t) => {
    let { container } = mount(
      t,
      <Frame width="400px">
        <Field>
          <FieldLabel for="field-test-name">Name</FieldLabel>
          <Input id="field-test-name" />
          <NativeSelect id="field-test-country">
            <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>As it appears on invoices.</FieldDescription>
        </Field>
      </Frame>,
    )
    let label = box(find(container, 'label'))
    let input = box(find(container, 'input'))
    let select = box(find(container, '[data-slot="native-select-wrapper"]'))
    let description = box(find(container, 'p'))

    assert.ok(label.bottom <= input.top && input.bottom <= select.top && select.bottom <= description.top)
    assert.equal(label.width, 400, 'the label fills the field, so its whole row focuses the control')
    assert.equal(input.width, 400)
    assert.equal(select.width, 400)
  })

  it('puts a horizontal field in a row, and starts a choice before its content', async (t) => {
    for (let dir of ['ltr', 'rtl'] as const) {
      let { container, act } = mount(
        t,
        <Frame width="400px" dir={dir}>
          <Field orientation="horizontal">
            <input type="checkbox" id={`field-test-remind-${dir}`} />
            <FieldContent>
              <FieldLabel for={`field-test-remind-${dir}`}>Remind the customer</FieldLabel>
              <FieldDescription>Three days before the due date.</FieldDescription>
            </FieldContent>
          </Field>
        </Frame>,
      )
      let checkbox = find<HTMLInputElement>(container, 'input')
      let content = box(find(container, '[data-slot="field-content"]'))

      if (dir === 'ltr') assert.ok(box(checkbox).right <= content.left)
      else assert.ok(box(checkbox).left >= content.right)
      assert.ok(Math.abs(box(checkbox).top - content.top) <= 2, 'the checkbox lines up with the first line')
      assert.ok(content.width > 300, `the content takes the rest of the row, not ${content.width}px`)

      await act(() => find<HTMLLabelElement>(container, 'label').click())
      assert.equal(checkbox.checked, true)
    }
  })

  it('stacks a responsive field in a narrow group and puts it in a row from 28rem', async (t) => {
    let layout = (width: string) => {
      let { container } = mount(
        t,
        <Frame width={width}>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldLabel for={`field-test-plan-${width}`}>Plan</FieldLabel>
              <NativeSelect id={`field-test-plan-${width}`}>
                <NativeSelectOption value="pro">Pro</NativeSelectOption>
              </NativeSelect>
              <Input id={`field-test-seats-${width}`} aria-label="Seats" mix={css({ width: '6rem' })} />
            </Field>
          </FieldGroup>
        </Frame>,
      )
      return {
        label: box(find(container, 'label')),
        select: box(find(container, '[data-slot="native-select-wrapper"]')),
      }
    }

    let narrow = layout('400px')
    assert.ok(narrow.label.bottom <= narrow.select.top, 'stacked below 28rem')
    assert.equal(narrow.select.width, 400)

    let wide = layout('600px')
    assert.ok(Math.abs(wide.label.top - wide.select.top) < wide.select.height, 'in a row from 28rem')
    assert.ok(wide.label.width >= 128 && wide.select.width >= 128, 'the label and the select share the row')
    assert.ok(wide.label.right <= wide.select.left)
  })

  it('wraps a row before a control or its text gets narrower than 8rem, but keeps a checkbox, switch or radio beside its label', async (t) => {
    let row = (width: string) => {
      let { container } = mount(
        t,
        <Frame width={width}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for={`field-test-username-${width}`}>Username</FieldLabel>
              <FieldDescription>Shown on shared invoices.</FieldDescription>
            </FieldContent>
            <Input id={`field-test-username-${width}`} />
          </Field>
          <Field orientation="horizontal">
            <input type="checkbox" id={`field-test-copy-${width}`} />
            <FieldLabel for={`field-test-copy-${width}`}>Send me a copy of every reminder</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id={`field-test-remind-${width}`} />
            <FieldLabel for={`field-test-remind-${width}`}>Remind the customer before the due date</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id={`field-test-autopay-${width}`} />
            <FieldLabel for={`field-test-autopay-${width}`}>Charge the card on file automatically</FieldLabel>
          </Field>
          <RadioGroup name={`field-test-cycle-${width}`} defaultValue="monthly">
            <Field orientation="horizontal">
              <RadioGroupItem id={`field-test-monthly-${width}`} value="monthly" />
              <FieldLabel for={`field-test-monthly-${width}`}>Bill the customer every month</FieldLabel>
            </Field>
          </RadioGroup>
        </Frame>,
      )
      let [field, ...choices] = container.querySelectorAll('[data-slot="field"]')
      return {
        content: box(find(field, '[data-slot="field-content"]')),
        input: box(find(field, 'input')),
        choices: choices.map((choice) => ({ control: box(find(choice, 'input')), label: box(find(choice, 'label')) })),
      }
    }

    let wide = row('480px')
    assert.ok(wide.input.top < wide.content.bottom, 'side by side when both fit')
    assert.ok(wide.content.width >= 128 && wide.input.width >= 128)

    // Narrower than 8rem of text, the gap and a checkbox.
    let narrow = row('150px')
    assert.ok(narrow.input.top >= narrow.content.bottom, 'the input moves under its text')
    assert.equal(narrow.input.width, 150)
    for (let [index, { control, label }] of narrow.choices.entries()) {
      assert.ok(control.top < label.bottom && control.right <= label.left, `choice ${index + 1} stays beside its label`)
    }
  })

  it('lines up the controls of several rows, whatever their own width', async (t) => {
    let { container } = mount(
      t,
      <Frame width="600px">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel for="field-test-row-name">Username</FieldLabel>
            <Input id="field-test-row-name" />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel for="field-test-row-bio">A longer label for the bio</FieldLabel>
            <Textarea id="field-test-row-bio" />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel for="field-test-row-country">Country</FieldLabel>
            <NativeSelect id="field-test-row-country">
              <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldGroup>
      </Frame>,
    )
    let starts = ['#field-test-row-name', '#field-test-row-bio', '[data-slot="native-select-wrapper"]'].map(
      (selector) => Math.round(box(find(container, selector)).left),
    )

    assert.deepEqual(starts, [starts[0], starts[0], starts[0]])
  })

  it('colors an invalid field and dims a disabled one, but keeps descriptions muted', async (t) => {
    let { container } = mount(
      t,
      <Frame width="400px">
        <Field invalid>
          <FieldLabel for="field-test-email">Email</FieldLabel>
          <Input id="field-test-email" aria-invalid={true} />
          <FieldDescription>We send invoices here.</FieldDescription>
        </Field>
        <Field disabled>
          <FieldLabel for="field-test-company">Company</FieldLabel>
          <Input id="field-test-company" disabled />
          <FieldTitle>Set by your workspace</FieldTitle>
        </Field>
      </Frame>,
    )
    let [invalid, disabled] = container.querySelectorAll('[data-slot="field"]')

    assert.equal(getComputedStyle(find(invalid, 'label')).color, 'rgb(200, 0, 0)')
    assert.equal(getComputedStyle(find(invalid, 'input')).borderTopColor, 'rgb(200, 0, 0)')
    assert.equal(getComputedStyle(find(invalid, 'p')).color, 'rgb(100, 100, 100)')
    assert.equal(getComputedStyle(find(disabled, 'label')).opacity, '0.5')
    assert.equal(getComputedStyle(find(disabled, 'div[data-slot="field-label"]')).opacity, '0.5')
  })

  it('turns a label around a whole field into a choice card that toggles on any click and tints when checked', async (t) => {
    let { container, act } = mount(
      t,
      <Frame width="320px">
        <FieldLabel for="field-test-touch">
          <Field orientation="horizontal">
            <input type="checkbox" id="field-test-touch" aria-labelledby="field-test-touch-title" />
            <FieldContent>
              <FieldTitle id="field-test-touch-title">Touch ID</FieldTitle>
              <FieldDescription>Unlock the app with your fingerprint.</FieldDescription>
            </FieldContent>
          </Field>
        </FieldLabel>
      </Frame>,
    )
    let card = find(container, 'label')
    let field = find(container, '[data-slot="field"]')
    let checkbox = find<HTMLInputElement>(container, 'input')
    let before = getComputedStyle(card).backgroundColor

    assert.equal(box(card).width, 320)
    assert.equal(getComputedStyle(card).borderTopColor, 'rgb(220, 220, 220)')
    assert.equal(getComputedStyle(field).paddingTop, '12px')

    await act(() => find(container, 'p').click())
    assert.equal(checkbox.checked, true)
    assert.notEqual(getComputedStyle(card).backgroundColor, before)
  })

  it('draws a separator line, and lines on both sides of its text, without a background', async (t) => {
    for (let dir of ['ltr', 'rtl'] as const) {
      let { container } = mount(
        t,
        <Frame width="300px" dir={dir}>
          <FieldSeparator />
          <FieldSeparator>Or continue with</FieldSeparator>
        </Frame>,
      )
      let [plain, labelled] = container.querySelectorAll('[data-slot="field-separator"]')
      let line = box(find(plain, '[role="separator"]'))
      let text = find(labelled, '[data-slot="field-separator-content"]')
      let lead = box(find(labelled, '[role="separator"]'))

      assert.equal(line.width, 300)
      assert.equal(getComputedStyle(text).backgroundColor, 'rgba(0, 0, 0, 0)')
      assert.ok(lead.width > 40, `the leading line is ${lead.width}px`)
      let middle = box(text).left + box(text).width / 2
      assert.ok(Math.abs(middle - (box(labelled).left + 150)) <= 1, `${dir}: the text is centered`)
      if (dir === 'ltr') assert.ok(lead.right <= box(text).left)
      else assert.ok(lead.left >= box(text).right)
    }
  })

  it('shows, lists and clears errors without empty alerts or references to a missing message', async (t) => {
    let { container, act } = mount(t, <EmailField name="field-test-email" />)
    let input = find<HTMLInputElement>(container, 'input')
    let alert = () => container.querySelector('[role="alert"]')

    assert.equal(alert(), null)
    assert.equal(input.getAttribute('aria-describedby'), 'field-test-email-hint')
    assert.equal(input.getAttribute('aria-invalid'), 'false')
    assert.equal(find(container, '[data-slot="field"]').hasAttribute('data-invalid'), false)

    await act(() => press(container, 'field-test-email', 'one'))
    assert.equal(alert()?.textContent, 'Enter an email address.')
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.equal(input.getAttribute('aria-describedby'), 'field-test-email-hint field-test-email-error')
    assert.equal(find(container, '[data-slot="field"]').getAttribute('data-invalid'), 'true')
    checkReferences(container)

    await act(() => press(container, 'field-test-email', 'two'))
    assert.deepEqual(
      [...alert()!.querySelectorAll('li')].map((item) => item.textContent),
      ['Enter an email address.', 'Use your work address.'],
    )
    checkReferences(container)

    await act(() => press(container, 'field-test-email', 'blank'))
    assert.equal(alert(), null, 'blank messages leave no empty alert')
    assert.equal(input.getAttribute('aria-invalid'), 'false', 'and no false invalid flag')
    assert.equal(input.getAttribute('aria-describedby'), 'field-test-email-hint')
    checkReferences(container)

    await act(() => press(container, 'field-test-email', 'one'))
    await act(() => press(container, 'field-test-email', 'clear'))
    assert.equal(alert(), null)
    assert.equal(find(container, '[data-slot="field"]').hasAttribute('data-invalid'), false)
    checkReferences(container)
  })

  it('drops a styled reason whose text clears, for the messages or for nothing, never an empty alert', async (t) => {
    for (let [errors, after] of [
      [[{ message: 'Enter an email address.' }], 'Enter an email address.'],
      [undefined, null],
    ] as const) {
      let { container, act } = mount(t, <ReasonError errors={errors ? [...errors] : undefined} />)
      let alert = () => container.querySelector('[role="alert"]')

      assert.equal(alert()?.textContent, 'This address is taken.')
      await act(() => find<HTMLButtonElement>(container, 'button').click())
      assert.equal(alert()?.textContent ?? null, after)
    }
  })

  it('keeps several changing fields apart: each error and flag stays with its own field', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <EmailField name="field-test-billing" />
        <EmailField name="field-test-shipping" />
        <EmailField name="field-test-notify" />
      </div>,
    )
    let invalidFields = () =>
      [...container.querySelectorAll('[data-owner]')]
        .filter((owner) => owner.querySelector('[data-invalid="true"]'))
        .map((owner) => owner.getAttribute('data-owner'))

    await act(() => press(container, 'field-test-billing', 'one'))
    await act(() => press(container, 'field-test-notify', 'two'))
    assert.deepEqual(invalidFields(), ['field-test-billing', 'field-test-notify'])
    assert.equal(container.querySelectorAll('[role="alert"]').length, 2)
    checkReferences(container)

    await act(() => press(container, 'field-test-billing', 'clear'))
    await act(() => press(container, 'field-test-shipping', 'one'))
    assert.deepEqual(invalidFields(), ['field-test-shipping', 'field-test-notify'])
    assert.equal(container.querySelectorAll('form').length, 0, 'no field adds a form')
    checkReferences(container)
  })

  it('disables every control of a disabled field set, which its legend names', async (t) => {
    let { container } = mount(
      t,
      <form>
        <FieldSet disabled>
          <FieldLegend>Billing address</FieldLegend>
          <FieldDescription>Printed on every invoice.</FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel for="field-test-street">Street</FieldLabel>
              <Input id="field-test-street" name="street" defaultValue="Bahnhofstrasse 1" />
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>,
    )
    let fieldset = find<HTMLFieldSetElement>(container, 'fieldset')

    assert.equal(fieldset.firstElementChild?.tagName, 'LEGEND')
    assert.equal(find<HTMLInputElement>(container, 'input').matches(':disabled'), true)
    assert.deepEqual([...new FormData(find<HTMLFormElement>(container, 'form'))], [])
  })

  it('fits a 320px screen with long words, also inside a field set', async (t) => {
    let { container } = mount(
      t,
      <Frame width="288px">
        <FieldSet>
          <FieldLegend>Notificationpreferencesforeveryworkspace</FieldLegend>
          <FieldGroup>
            <Field orientation="horizontal">
              <input type="checkbox" id="field-test-long" />
              <FieldContent>
                <FieldLabel for="field-test-long">accounts-receivable-notifications@example.com</FieldLabel>
                <FieldDescription>Remindersforoverdueinvoicesgotothisaddress.</FieldDescription>
              </FieldContent>
            </Field>
            <FieldError errors={[{ message: 'Thisaddresscannotreceiveemailfromoutsideyourorganization.' }]} />
          </FieldGroup>
        </FieldSet>
      </Frame>,
    )
    let frame = find(container, 'div')

    assert.ok(frame.scrollWidth <= 288, `the content is ${frame.scrollWidth}px wide`)
    for (let element of container.querySelectorAll('legend, label, p, [role="alert"]')) {
      assert.ok(box(element).right <= box(frame).right + 0.5, `${element.tagName} overflows`)
    }
  })
})
