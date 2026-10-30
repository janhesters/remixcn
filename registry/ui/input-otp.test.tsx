import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  sanitizeOTP,
} from './input-otp.tsx'
import type { InputOTPProps } from './input-otp.tsx'

/** Six slots in two groups, as shadcn's examples write them. */
function sixSlots(props: Omit<InputOTPProps, 'maxLength'> & { maxLength?: number } = {}) {
  return (
    <InputOTP maxLength={6} {...props}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  )
}

function slots(html: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === 'input-otp-slot')
}

/** The text of each slot, in order. */
function slotTexts(html: string) {
  return html
    .split(/<div[^>]*data-slot="input-otp-slot"[^>]*>/)
    .slice(1)
    .map((part) => text(part.split('</div>')[0]))
}

describe('InputOTP', () => {
  it('renders one native text input for a one-time code, with the autofill hint and length', async () => {
    let html = await renderToString(sixSlots({ id: 'code', name: 'code', 'aria-label': 'Verification code' }))
    let inputs = tags(html, 'input')

    assert.equal(inputs.length, 1)
    let input = inputs[0].attributes
    assert.equal(input.get('data-slot'), 'input-otp-input')
    assert.equal(input.has('type'), false, 'a text box')
    assert.equal(input.get('autocomplete'), 'one-time-code')
    assert.equal(input.get('maxlength'), '6')
    assert.equal(input.get('inputmode'), 'numeric')
    assert.equal(input.get('spellcheck'), 'false')
    assert.equal(input.get('autocapitalize'), 'off')
    assert.equal(input.get('id'), 'code')
    assert.equal(input.get('name'), 'code')
    assert.equal(input.get('aria-label'), 'Verification code')
  })

  it('lets the caller change the keyboard hints', async () => {
    let input = attributes(
      await renderToString(sixSlots({ autocapitalize: 'characters', spellcheck: 'true' })),
      'input',
    )

    assert.equal(input.get('autocapitalize'), 'characters')
    assert.equal(input.get('spellcheck'), 'true')
  })

  it('passes native constraints, form owner, states and descriptions to the input', async () => {
    let input = attributes(
      await renderToString(
        sixSlots({
          name: 'code',
          form: 'sign-in',
          required: true,
          minLength: 6,
          disabled: true,
          autocomplete: 'off',
          inputMode: 'text',
          'aria-invalid': true,
          'aria-describedby': 'code-hint code-error',
          'data-test': 'code',
        }),
      ),
      'input',
    )

    assert.equal(input.get('form'), 'sign-in')
    assert.ok(input.has('required'))
    assert.equal(input.get('minlength'), '6')
    assert.ok(input.has('disabled'))
    assert.equal(input.get('autocomplete'), 'off')
    assert.equal(input.get('inputmode'), 'text')
    assert.equal(input.get('aria-invalid'), 'true')
    assert.equal(input.get('aria-describedby'), 'code-hint code-error')
    assert.equal(input.get('data-test'), 'code')
  })

  it('shows the starting code in the slots, leading zeroes and all, and writes it as the reset value', async () => {
    let html = await renderToString(sixSlots({ defaultValue: '007123' }))

    assert.equal(attributes(html, 'input').get('value'), '007123')
    assert.deepEqual(slotTexts(html), ['0', '0', '7', '1', '2', '3'])
  })

  it('shows a controlled value, capped at the length', async () => {
    let html = await renderToString(sixSlots({ value: '0123456789' }))

    assert.equal(attributes(html, 'input').get('value'), '012345')
    assert.deepEqual(slotTexts(html), ['0', '1', '2', '3', '4', '5'])
  })

  it('leaves the slots after the code empty, and shows a placeholder only while the code is empty', async () => {
    let partial = await renderToString(sixSlots({ defaultValue: '12', placeholder: '○○○○○○' }))
    let empty = await renderToString(sixSlots({ placeholder: '○○○○○○' }))

    assert.deepEqual(slotTexts(partial), ['1', '2', '', '', '', ''])
    assert.deepEqual(slotTexts(empty), ['○', '○', '○', '○', '○', '○'])
    assert.equal(attributes(empty, 'input').get('placeholder'), '○○○○○○')
  })

  it('masks the slots and the input', async () => {
    let html = await renderToString(sixSlots({ defaultValue: '4821', mask: true }))
    let custom = await renderToString(sixSlots({ defaultValue: '4821', mask: '*' }))

    assert.equal(attributes(html, 'input').get('type'), 'password')
    assert.deepEqual(slotTexts(html), ['•', '•', '•', '•', '', ''])
    assert.deepEqual(slotTexts(custom), ['*', '*', '*', '*', '', ''])
    assert.equal(html.includes('4821"'), true, 'the input keeps the real value')
    assert.equal(text(html).includes('4821'), false, 'no slot shows it')
  })

  it('hides the slots, groups and separators from assistive technology, since the input holds the code', async () => {
    let html = await renderToString(sixSlots({ defaultValue: '123' }))
    let parts = tags(html).filter((tag) =>
      ['input-otp-group', 'input-otp-slot', 'input-otp-separator'].includes(tag.attributes.get('data-slot') ?? ''),
    )

    assert.equal(parts.length, 9)
    assert.deepEqual(
      parts.filter((part) => part.attributes.get('aria-hidden') !== 'true'),
      [],
    )
    assert.deepEqual(
      slots(html).map((slot) => [slot.attributes.get('data-index'), slot.attributes.get('data-active')]),
      [
        ['0', 'false'],
        ['1', 'false'],
        ['2', 'false'],
        ['3', 'false'],
        ['4', 'false'],
        ['5', 'false'],
      ],
    )
  })

  it('writes the pattern for native validation, and picks a keyboard for it', async () => {
    let digits = attributes(await renderToString(sixSlots({ pattern: REGEXP_ONLY_DIGITS })), 'input')
    let letters = attributes(await renderToString(sixSlots({ pattern: REGEXP_ONLY_CHARS })), 'input')
    let both = attributes(await renderToString(sixSlots({ pattern: REGEXP_ONLY_DIGITS_AND_CHARS })), 'input')

    assert.equal(digits.get('pattern'), '^\\d+$')
    assert.equal(digits.get('inputmode'), 'numeric')
    assert.equal(letters.get('inputmode'), 'text')
    assert.equal(both.get('inputmode'), 'text')
  })

  it('marks the input and its box as waiting for the browser, so they can fall back to a plain text box', async () => {
    let html = await renderToString(sixSlots())

    assert.ok(attributes(html, 'slot:input-otp').has('data-pending'))
    assert.ok(attributes(html, 'input').has('data-pending'))
    assert.match(html, /@media \(scripting: none\)/)
  })

  it('passes a class and mixins to its box', async () => {
    let root = attributes(await renderToString(sixSlots({ containerClass: 'centered' })), 'slot:input-otp')

    assert.ok(root.get('class')?.split(' ').includes('centered'), root.get('class'))
  })
})

describe('InputOTPGroup', () => {
  it("renders its slots in a group hidden from assistive technology, with the caller's attributes", async () => {
    let html = await renderToString(
      <InputOTPGroup style="margin: 0" class="wide" data-test="group">
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
      </InputOTPGroup>,
    )
    let group = attributes(html, 'slot:input-otp-group')

    assert.equal(group.get('aria-hidden'), 'true')
    assert.equal(group.get('style'), 'margin: 0')
    assert.ok(group.get('class')?.split(' ').includes('wide'), group.get('class'))
    assert.equal(group.get('data-test'), 'group')
    assert.equal(slots(html).length, 2)
  })
})

describe('sanitizeOTP', () => {
  it('drops the characters the pattern refuses, one by one, and caps the length', () => {
    assert.equal(sanitizeOTP('123-456', { pattern: REGEXP_ONLY_DIGITS, maxLength: 6 }), '123456')
    assert.equal(sanitizeOTP(' 12 34 56 78 ', { pattern: REGEXP_ONLY_DIGITS, maxLength: 6 }), '123456')
    assert.equal(sanitizeOTP('ab-12-CD', { pattern: REGEXP_ONLY_DIGITS_AND_CHARS, maxLength: 8 }), 'ab12CD')
    assert.equal(sanitizeOTP('a1b2', { pattern: REGEXP_ONLY_CHARS, maxLength: 4 }), 'ab')
  })

  it('keeps leading zeroes and every character without a pattern', () => {
    assert.equal(sanitizeOTP('007', { maxLength: 6 }), '007')
    assert.equal(sanitizeOTP('a-b c', { maxLength: 6 }), 'a-b c')
  })

  it('reads full-width digits from an input method as the digits they show', () => {
    assert.equal(sanitizeOTP('１２３４５６', { pattern: REGEXP_ONLY_DIGITS, maxLength: 6 }), '123456')
  })
})

describe('InputOTPSlot', () => {
  it('renders an empty slot outside an InputOTP', async () => {
    let slot = attributes(await renderToString(<InputOTPSlot index={2} aria-invalid={true} />), 'slot:input-otp-slot')

    assert.equal(slot.get('data-index'), '2')
    assert.equal(slot.get('data-active'), 'false')
    assert.equal(slot.get('aria-invalid'), 'true')
  })
})
