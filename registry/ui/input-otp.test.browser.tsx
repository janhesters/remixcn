import { css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  onInputOTPChange,
  onInputOTPComplete,
  REGEXP_ONLY_DIGITS,
} from './input-otp.tsx'
import type { InputOTPChangeReason, InputOTPProps } from './input-otp.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// The browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  '--input': 'rgb(120, 120, 120)',
  '--ring': 'rgb(0, 0, 200)',
  '--destructive': 'rgb(200, 0, 0)',
  '--foreground': 'rgb(10, 10, 10)',
  '--muted-foreground': 'rgb(90, 90, 90)',
  '--spacing': '4px',
  '--radius-md': '6px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
}
// theme.css sizes every box by its border.
const reset = css({ '&, & *': { boxSizing: 'border-box' } })

function code(props: Omit<InputOTPProps, 'maxLength'> & { maxLength?: number } = {}) {
  return (
    <InputOTP maxLength={6} aria-label="Verification code" {...props}>
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

function otpInput(container: Element, index = 0) {
  let found = container.querySelectorAll('input[data-slot="input-otp-input"]')[index]
  assert.ok(found instanceof HTMLInputElement, `no code input ${index}`)
  return found
}

function slots(container: Element, index = 0) {
  let box = container.querySelectorAll('[data-slot="input-otp"]')[index]
  assert.ok(box, `no code ${index}`)
  return [...box.querySelectorAll<HTMLElement>('[data-slot="input-otp-slot"]')]
}

/** What each slot shows. */
function shown(container: Element, index = 0) {
  return slots(container, index)
    .map((slot) => (slot.firstChild?.nodeType === Node.TEXT_NODE ? slot.firstChild.textContent : ''))
    .join('|')
}

/** Which slots are active, and which draws the caret. */
function marks(container: Element, index = 0) {
  return slots(container, index)
    .map((slot) =>
      slot.querySelector('[data-slot="input-otp-caret"]') ? 'caret' : slot.dataset.active === 'true' ? 'on' : '-',
    )
    .join(' ')
}

/** Types text as a keyboard does: each character replaces the selection and moves the caret after it. */
function typeText(input: HTMLInputElement, text: string) {
  for (let char of text) {
    let start = input.selectionStart ?? input.value.length
    let end = input.selectionEnd ?? start
    if (start === end && input.value.length >= input.maxLength) continue
    input.setRangeText(char, start, end, 'end')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }))
    document.dispatchEvent(new Event('selectionchange'))
  }
}

/** Presses Backspace: removes the selection, or the character before the caret. */
function backspace(input: HTMLInputElement) {
  let start = input.selectionStart ?? input.value.length
  let end = input.selectionEnd ?? start
  if (start === end) start = Math.max(0, start - 1)
  input.setRangeText('', start, end, 'end')
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
  document.dispatchEvent(new Event('selectionchange'))
}

/** Presses ArrowLeft: a selection collapses to its start, a caret moves back one character. */
function arrowLeft(input: HTMLInputElement) {
  let start = input.selectionStart ?? 0
  let end = input.selectionEnd ?? start
  select(input, start === end ? Math.max(0, start - 1) : start)
}

/** Presses ArrowRight: a selection collapses to its end, a caret moves on one character. */
function arrowRight(input: HTMLInputElement) {
  let start = input.selectionStart ?? 0
  let end = input.selectionEnd ?? start
  select(input, start === end ? Math.min(input.value.length, end + 1) : end)
}

function select(input: HTMLInputElement, start: number, end = start) {
  input.setSelectionRange(start, end)
  document.dispatchEvent(new Event('selectionchange'))
}

function paste(input: HTMLInputElement, text: string) {
  let data = new DataTransfer()
  data.setData('text/plain', text)
  // Firefox leaves the clipboardData of a synthetic event empty, so the test sets it on the event.
  let event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  input.dispatchEvent(event)
  return event
}

interface Recorded {
  changes: Array<[string, InputOTPChangeReason]>
  completes: string[]
  inputs: string[]
}

function recorder(): Recorded & { mix: ReturnType<typeof listen> } {
  let recorded: Recorded = { changes: [], completes: [], inputs: [] }
  return Object.assign(recorded, { mix: listen(recorded) })
}

function listen(recorded: Recorded) {
  return [
    onInputOTPChange((event) => void recorded.changes.push([event.value, event.reason])),
    onInputOTPComplete((event) => void recorded.completes.push(event.value)),
    on<HTMLElement, 'input'>('input', (event) => void recorded.inputs.push((event.target as HTMLInputElement).value)),
  ]
}

// Owns the code, takes each change it is asked for unless told to decline, and can set one itself.
function ControlledCode(handle: Handle<{ decline?: boolean }>) {
  let value = '12'

  return () => (
    <div
      mix={onInputOTPChange((event) => {
        if (handle.props.decline) return
        value = event.value
        void handle.update()
      })}
    >
      <form>
        {code({ value, name: 'code' })}
        <button
          type="button"
          mix={on('click', () => {
            value = '000000'
            void handle.update()
          })}
        >
          Fill
        </button>
      </form>
      <output>{value}</output>
    </div>
  )
}

// Changes the code's length, mask, pattern and disabled state from buttons.
function ChangingCode(handle: Handle) {
  let props: Omit<InputOTPProps, 'maxLength'> & { maxLength: number } = { maxLength: 6 }
  let change = (name: string, next: Partial<InputOTPProps>) => (
    <button
      type="button"
      data-change={name}
      mix={on('click', () => {
        props = { ...props, ...next }
        void handle.update()
      })}
    >
      {name}
    </button>
  )

  return () => (
    <div>
      <InputOTP aria-label="Code" {...props}>
        <InputOTPGroup>
          {Array.from({ length: props.maxLength }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {change('digits', { pattern: REGEXP_ONLY_DIGITS })}
      {change('mask', { mask: true })}
      {change('short', { maxLength: 4 })}
      {change('disabled', { disabled: true })}
    </div>
  )
}

/** How many lines the slots of a code take. */
function lines(container: Element, index = 0) {
  return new Set(slots(container, index).map((slot) => Math.round(slot.getBoundingClientRect().top))).size
}

/** The slots of a code that reach past its input, or whose center a press wouldn't land on it. */
function escaped(container: Element, index = 0) {
  let input = otpInput(container, index)
  let outer = input.getBoundingClientRect()
  return slots(container, index)
    .filter((slot) => {
      let box = slot.getBoundingClientRect()
      let hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return (
        box.left < outer.left - 0.5 ||
        box.right > outer.right + 0.5 ||
        box.top < outer.top - 0.5 ||
        box.bottom > outer.bottom + 0.5 ||
        hit !== input
      )
    })
    .map((slot) => slot.dataset.index)
}

// Renders a run of slots from a component of its own, as an app may write them.
function SlotRun(handle: Handle<{ from: number; count: number }>) {
  return () => (
    <>
      {Array.from({ length: handle.props.count }, (_, offset) => (
        <InputOTPSlot key={offset} index={handle.props.from + offset} />
      ))}
    </>
  )
}

// Two groups whose slots a component renders, three each until More makes them four.
function HelperCode(handle: Handle) {
  let count = 3

  return () => (
    <div>
      <InputOTP maxLength={count * 2} aria-label="Helper code" defaultValue="12345678">
        <InputOTPGroup>
          <SlotRun from={0} count={count} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <SlotRun from={count} count={count} />
        </InputOTPGroup>
      </InputOTP>
      <button
        type="button"
        mix={on('click', () => {
          count = 4
          void handle.update()
        })}
      >
        More
      </button>
    </div>
  )
}

describe('InputOTP in the browser', () => {
  it('lays one clear input over the slots, which draw its value', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens} mix={reset}>
        {code({ defaultValue: '042' })}
      </div>,
    )
    let input = otpInput(container)
    let box = container.querySelector('[data-slot="input-otp"]')!
    let style = getComputedStyle(input)

    assert.equal(container.querySelectorAll('input').length, 1)
    assert.equal(input.value, '042')
    assert.equal(shown(container), '0|4|2|||')
    assert.equal(style.position, 'absolute')
    assert.equal(style.color, 'rgba(0, 0, 0, 0)')
    assert.equal(style.caretColor, 'rgba(0, 0, 0, 0)')
    assert.deepEqual(
      [input.getBoundingClientRect().width, input.getBoundingClientRect().height],
      [box.getBoundingClientRect().width, box.getBoundingClientRect().height],
    )
    assert.equal(box.hasAttribute('data-pending'), false, 'it runs once the browser renders it')
  })

  it('fills the slots as the user types, and marks the slot the caret is in', async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <div mix={events.mix}>{code({ pattern: REGEXP_ONLY_DIGITS })}</div>)
    let input = otpInput(container)

    assert.equal(marks(container), '- - - - - -')
    await act(() => input.focus())
    assert.equal(marks(container), 'caret - - - - -')

    await act(() => typeText(input, '1a2'))
    assert.equal(input.value, '12')
    assert.equal(shown(container), '1|2||||')
    assert.equal(marks(container), '- - caret - - -')
    assert.deepEqual(events.changes, [
      ['1', 'input'],
      ['12', 'input'],
    ])

    await act(() => input.blur())
    assert.equal(marks(container), '- - - - - -')
  })

  it('selects the character beside the caret, so typing replaces it and Backspace deletes it', async (t) => {
    let { container, act } = mount(t, code({ defaultValue: '123456' }))
    let input = otpInput(container)

    await act(() => input.focus())
    assert.deepEqual([input.selectionStart, input.selectionEnd], [5, 6], 'a full code selects its last character')
    assert.equal(marks(container), '- - - - - on')

    for (let step = 0; step < 3; step++) await act(() => arrowLeft(input))
    assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 3])
    assert.equal(marks(container), '- - on - - -')

    await act(() => typeText(input, '9'))
    assert.equal(input.value, '129456')
    assert.deepEqual([input.selectionStart, input.selectionEnd], [3, 4], 'the next character is selected')

    await act(() => arrowRight(input))
    assert.deepEqual([input.selectionStart, input.selectionEnd], [4, 5])

    await act(() => backspace(input))
    assert.equal(input.value, '12946')
    assert.equal(shown(container), '1|2|9|4|6|')
    assert.deepEqual([input.selectionStart, input.selectionEnd], [3, 4], 'the character before it is selected')

    await act(() => select(input, 5))
    assert.equal(marks(container), '- - - - - caret', 'the end of a code that is not full takes a character')
    await act(() => backspace(input))
    assert.equal(input.value, '1294')
    assert.equal(marks(container), '- - - - caret -')

    await act(() => select(input, 0, 4))
    assert.equal(marks(container), 'on on on on - -')
    await act(() => typeText(input, '7'))
    assert.equal(input.value, '7')
  })

  it('pastes a code without the characters its pattern refuses, and a whole code replaces the one there', async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <div mix={events.mix}>{code({ pattern: REGEXP_ONLY_DIGITS })}</div>)
    let input = otpInput(container)

    await act(() => input.focus())
    let event: ClipboardEvent | undefined
    await act(() => (event = paste(input, ' 123-456\n')))
    assert.equal(event?.defaultPrevented, true)
    assert.equal(input.value, '123456')
    assert.equal(shown(container), '1|2|3|4|5|6')

    await act(() => paste(input, 'Your code: 98 76 54 32'))
    assert.equal(input.value, '987654', 'capped at six digits')

    await act(() => select(input, 2, 4))
    await act(() => paste(input, '0-'))
    assert.equal(input.value, '98054', 'a part replaces the selection')

    await act(() => paste(input, 'no digits'))
    assert.equal(input.value, '98054', 'a paste without a valid character changes nothing')

    assert.deepEqual(events.changes, [
      ['123456', 'paste'],
      ['987654', 'paste'],
      ['98054', 'paste'],
    ])
    assert.deepEqual(events.inputs, ['123456', '987654', '98054'], 'native input events follow each paste')
  })

  it("leaves a paste the browser can take as it is to the browser, so it stays the user's own edit", async (t) => {
    let { container, act } = mount(t, code({ pattern: REGEXP_ONLY_DIGITS, defaultValue: '12' }))
    let input = otpInput(container)

    await act(() => input.focus())
    let fits: ClipboardEvent | undefined
    let tooLong: ClipboardEvent | undefined
    await act(() => (fits = paste(input, '345')))
    await act(() => (tooLong = paste(input, '34567')))

    assert.equal(fits?.defaultPrevented, false)
    assert.equal(tooLong?.defaultPrevented, true, "a paste past the length is the component's to cut")
  })

  it('keeps a code shorter than minLength invalid after the component changed it, with a message to translate', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        {code({ name: 'code', pattern: REGEXP_ONLY_DIGITS, minLength: 6, tooShortMessage: 'Enter all six digits.' })}
      </form>,
    )
    let input = otpInput(container)
    let form = container.querySelector('form')!

    await act(() => input.focus())
    await act(() => paste(input, '1-2'))
    assert.equal(input.value, '12')
    assert.equal(form.checkValidity(), false, 'a short code blocks the form')
    // Firefox and Safari check the length of the browser's edit themselves; Chromium gets the message.
    assert.ok(input.validity.tooShort || input.validationMessage === 'Enter all six digits.', input.validationMessage)

    await act(() => paste(input, '3-4-5-6'))
    assert.equal(input.value, '123456')
    assert.equal(input.validity.customError, false, 'the message leaves with the short code')
    assert.equal(form.checkValidity(), true)
  })

  it('fires the native change once the user leaves after a paste, and none after an unchanged paste or a reset', async (t) => {
    let changes: string[] = []
    let { container, act } = mount(
      t,
      <form mix={on('change', (event) => void changes.push((event.target as HTMLInputElement).value))}>
        {code({ name: 'code', pattern: REGEXP_ONLY_DIGITS })}
        <button type="button">Elsewhere</button>
      </form>,
    )
    let input = otpInput(container)
    let elsewhere = container.querySelector('button')!
    let leave = () => elsewhere.focus()

    await act(() => input.focus())
    await act(() => paste(input, '12-34-56'))
    await act(leave)
    assert.deepEqual(changes, ['123456'])

    await act(() => input.focus())
    await act(() => paste(input, '12 34 56'))
    await act(leave)
    assert.deepEqual(changes, ['123456'], 'the same code changes nothing')

    container.querySelector('form')!.reset()
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    await act(() => input.focus())
    await act(leave)
    assert.equal(input.value, '')
    assert.deepEqual(changes, ['123456'], 'a reset fires no change')
  })

  it('transforms pasted text first, and leaves a paste the caller prevents to the caller', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        {code({ pattern: REGEXP_ONLY_DIGITS, pasteTransformer: (text) => text.replace(/^G-/, '') })}
        {code({ mix: [on<HTMLInputElement, 'paste'>('paste', (event) => event.preventDefault())] })}
      </div>,
    )

    await act(() => paste(otpInput(container, 0), 'G-482915'))
    assert.equal(otpInput(container, 0).value, '482915')

    await act(() => paste(otpInput(container, 1), '111111'))
    assert.equal(otpInput(container, 1).value, '')
  })

  it('keeps leading zeroes in its value, its events and the form', async (t) => {
    let events = recorder()
    let { container, act } = mount(
      t,
      <form mix={events.mix}>{code({ name: 'code', pattern: REGEXP_ONLY_DIGITS })}</form>,
    )
    let input = otpInput(container)

    await act(() => input.focus())
    await act(() => typeText(input, '007123'))

    assert.deepEqual([...new FormData(container.querySelector('form')!)], [['code', '007123']])
    assert.deepEqual(events.completes, ['007123'])
    assert.equal(shown(container), '0|0|7|1|2|3')
  })

  it('tells listeners once the code becomes complete, and again only after it was incomplete', async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <div mix={events.mix}>{code()}</div>)
    let input = otpInput(container)

    await act(() => input.focus())
    await act(() => typeText(input, '123456'))
    assert.deepEqual(events.completes, ['123456'])

    for (let step = 0; step < 4; step++) await act(() => arrowLeft(input))
    await act(() => typeText(input, '9'))
    assert.equal(input.value, '193456')
    assert.deepEqual(events.completes, ['123456'], 'replacing a character keeps the code complete')

    await act(() => backspace(input))
    assert.equal(input.value, '19456')
    await act(() => select(input, 5))
    await act(() => typeText(input, '0'))
    assert.equal(input.value, '194560')
    assert.deepEqual(events.completes, ['123456', '194560'])
  })

  it('shows what an input method composes, and filters it when it commits', async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <div mix={events.mix}>{code({ pattern: REGEXP_ONLY_DIGITS })}</div>)
    let input = otpInput(container)

    await act(() => {
      input.focus()
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      input.value = '１２'
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }),
      )
    })
    assert.equal(input.value, '１２', 'nothing changes while it composes')
    assert.equal(shown(container), '１|２||||')
    assert.deepEqual(events.changes, [])

    await act(() => {
      input.value = '１２あ'
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '１２あ' }))
    })
    // The clean-up waits for the next task, so it can't disturb the input method.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    assert.equal(input.value, '12')
    assert.equal(shown(container), '1|2||||')
    assert.deepEqual(events.changes, [['12', 'input']])
  })

  it("filters a commit in the input event Firefox sends after compositionend, in that event's own task", async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <div mix={events.mix}>{code({ pattern: REGEXP_ONLY_DIGITS })}</div>)
    let input = otpInput(container)
    await act(() => {
      input.focus()
      typeText(input, '12')
    })

    // Firefox's order, as Playwright types a character a US keyboard lacks: the
    // composition ends with the text in the input, then one more input event.
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    input.setRangeText('３', 2, 2, 'end')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '３' }))
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: false, inputType: 'insertCompositionText', data: '３' }),
    )
    assert.equal(input.value, '123', 'clean before any other task can read it')

    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    assert.equal(input.value, '123')
    assert.equal(shown(container), '1|2|3|||')
    assert.deepEqual(events.changes.at(-1), ['123', 'input'])
    assert.equal(events.changes.filter(([value]) => value === '123').length, 1, 'and only once')
  })

  it('returns to its starting code when its form resets', async (t) => {
    let events = recorder()
    let { container, act } = mount(t, <form mix={events.mix}>{code({ name: 'code', defaultValue: '0042' })}</form>)
    let input = otpInput(container)

    await act(() => {
      input.focus()
      typeText(input, '99')
    })
    assert.equal(input.value, '004299')

    container.querySelector('form')!.reset()
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))

    assert.equal(input.value, '0042')
    assert.equal(shown(container), '0|0|4|2||')
    assert.deepEqual(events.changes.at(-1), ['0042', 'reset'])
  })

  it('validates natively: required, and the whole code against its pattern', async (t) => {
    let { container, act } = mount(
      t,
      <form>{code({ name: 'code', required: true, pattern: REGEXP_ONLY_DIGITS })}</form>,
    )
    let input = otpInput(container)
    let form = container.querySelector('form')!

    assert.equal(form.checkValidity(), false)
    assert.equal(input.validity.valueMissing, true)

    await act(() => {
      input.value = '12a'
    })
    assert.equal(
      input.validity.patternMismatch,
      true,
      'a value set around the component still meets the native pattern',
    )

    await act(() => {
      input.focus()
      input.select()
      typeText(input, '123456')
    })
    assert.equal(form.checkValidity(), true)
  })

  it('follows a controlled value, and returns to it when the owner declines a change', async (t) => {
    let events = recorder()
    let { container, act } = mount(
      t,
      <div mix={events.mix}>
        <ControlledCode />
      </div>,
    )
    let input = otpInput(container)

    assert.equal(input.value, '12')
    await act(() => {
      input.focus()
      typeText(input, '3')
    })
    assert.equal(container.querySelector('output')!.textContent, '123')
    assert.equal(shown(container), '1|2|3|||')

    await act(() => container.querySelector('button')!.click())
    assert.equal(input.value, '000000', 'a value the owner sets reaches the input')
    assert.equal(shown(container), '0|0|0|0|0|0')
    assert.deepEqual(events.completes, ['000000'])
  })

  it('keeps showing its controlled value when the owner declines', async (t) => {
    let { container, act } = mount(t, <ControlledCode decline />)
    let input = otpInput(container)

    await act(() => {
      input.focus()
      typeText(input, '3')
    })
    assert.equal(input.value, '12')
    assert.equal(shown(container), '1|2||||')

    await act(() => paste(input, '999999'))
    assert.equal(input.value, '12')

    container.querySelector('form')!.reset()
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    assert.equal(input.value, '12', 'a reset returns to the first controlled value')
  })

  it('takes a code typed before it ran as its own', async (t) => {
    let events = recorder()
    let { container } = mount(
      t,
      <div mix={events.mix}>
        {code({
          pattern: REGEXP_ONLY_DIGITS,
          mix: [
            ref((node: HTMLInputElement) => {
              node.value = '12-34'
            }),
          ],
        })}
      </div>,
    )
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.equal(otpInput(container).value, '1234')
    assert.equal(shown(container), '1|2|3|4||')
    assert.deepEqual(events.changes, [['1234', 'input']])
  })

  it('selects the character of a pressed slot, and puts the caret at the end for a press after the code', async (t) => {
    let { container, act } = mount(
      t,
      <div style={tokens} mix={reset}>
        {code({ defaultValue: '1234' })}
      </div>,
    )
    let input = otpInput(container)
    let press = (index: number) => {
      let rect = slots(container)[index].getBoundingClientRect()
      input.focus()
      input.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          detail: 1,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      )
    }

    await act(() => press(1))
    assert.deepEqual([input.selectionStart, input.selectionEnd], [1, 2])
    assert.equal(marks(container), '- on - - - -')

    await act(() => press(5))
    assert.deepEqual([input.selectionStart, input.selectionEnd], [4, 4])
    assert.equal(marks(container), '- - - - caret -')
  })

  it('masks the slots, keeps the value in a password input, and shows placeholders while empty', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        {code({ mask: true, defaultValue: '4821' })}
        {code({ placeholder: '000000' })}
      </div>,
    )

    assert.equal(otpInput(container, 0).type, 'password')
    assert.equal(otpInput(container, 0).value, '4821')
    assert.equal(shown(container, 0), '•|•|•|•||')
    assert.equal(shown(container, 1), '0|0|0|0|0|0')

    await act(() => {
      otpInput(container, 1).focus()
      typeText(otpInput(container, 1), '7')
    })
    assert.equal(shown(container, 1), '7|||||', 'the placeholder leaves with the first character')
  })

  it('dims a disabled code and ignores pastes into it', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        {code({ disabled: true, defaultValue: '123' })}
        <fieldset disabled>{code()}</fieldset>
      </div>,
    )
    let boxes = container.querySelectorAll('[data-slot="input-otp"]')

    assert.equal(getComputedStyle(boxes[0]).opacity, '0.5')
    assert.equal(getComputedStyle(boxes[1]).opacity, '0.5')
    let event: ClipboardEvent | undefined
    await act(() => (event = paste(otpInput(container), '999999')))
    assert.equal(event?.defaultPrevented, false)
    assert.equal(otpInput(container).value, '123')
  })

  it('draws the ring on the active slot, and every slot red when the code is invalid', async (t) => {
    let { container, act } = mount(
      t,
      <div style={tokens} mix={reset}>
        {code({ defaultValue: '12' })}
        {code({ 'aria-invalid': true, 'aria-describedby': 'code-error' })}
        <p id="code-error">That code expired.</p>
      </div>,
    )

    await act(() => otpInput(container, 0).focus())
    let active = slots(container, 0)[2]
    assert.equal(getComputedStyle(active).outlineStyle, 'solid')
    assert.equal(getComputedStyle(active).outlineColor, 'rgb(0, 0, 200)')
    assert.equal(getComputedStyle(slots(container, 0)[1]).outlineStyle, 'none')
    assert.equal(
      getComputedStyle(otpInput(container, 0)).outlineStyle,
      'none',
      'the slot draws the ring, not the input',
    )

    assert.equal(otpInput(container, 1).getAttribute('aria-invalid'), 'true')
    assert.deepEqual(
      slots(container, 1).map((slot) => getComputedStyle(slot).borderTopColor),
      Array(6).fill('rgb(200, 0, 0)'),
    )
  })

  it('keeps two codes apart', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        {code({ name: 'first' })}
        {code({ name: 'second' })}
      </div>,
    )

    await act(() => {
      otpInput(container, 1).focus()
      typeText(otpInput(container, 1), '55')
    })

    assert.equal(shown(container, 0), '|||||')
    assert.equal(shown(container, 1), '5|5||||')
    assert.equal(marks(container, 0), '- - - - - -')
  })

  it('follows props that change: the length, the mask, the pattern and disabled', async (t) => {
    let { container, act } = mount(t, <ChangingCode />)
    let input = otpInput(container)

    await act(() => {
      input.focus()
      typeText(input, '12ab34')
    })
    assert.equal(input.value, '12ab34', 'no pattern at first')

    await act(() => container.querySelector<HTMLButtonElement>('[data-change="digits"]')!.click())
    await act(() => {
      input.focus()
      input.select()
      typeText(input, '9z8')
    })
    assert.equal(input.value, '98', 'the new pattern refuses the letter')
    assert.equal(input.getAttribute('pattern'), REGEXP_ONLY_DIGITS)

    await act(() => container.querySelector<HTMLButtonElement>('[data-change="mask"]')!.click())
    assert.equal(input.type, 'password')
    assert.equal(shown(container), '•|•||||')

    await act(() => {
      input.focus()
      typeText(input, '765')
    })
    await act(() => container.querySelector<HTMLButtonElement>('[data-change="short"]')!.click())
    assert.equal(slots(container).length, 4)
    assert.equal(input.maxLength, 4)
    assert.equal(input.value, '9876', 'the code is cut at the new length')
    assert.equal(shown(container), '•|•|•|•')

    await act(() => container.querySelector<HTMLButtonElement>('[data-change="disabled"]')!.click())
    assert.equal(input.disabled, true)
    assert.equal(getComputedStyle(container.querySelector('[data-slot="input-otp"]')!).opacity, '0.5')
  })

  it('keeps every slot inside the real input on a narrow screen, wrapping groups only when they cannot shrink further', async (t) => {
    let pairs = (name: string) => (
      <InputOTP maxLength={6} aria-label={name} defaultValue="123456">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    )
    let { container } = mount(
      t,
      <div style={tokens} mix={reset}>
        <div style={{ width: '200px' }}>{pairs('Shrinks')}</div>
        <div style={{ width: '90px' }}>{pairs('Wraps')}</div>
      </div>,
    )
    assert.equal(lines(container, 0), 1, 'the slots shrink before a group wraps')
    assert.ok(slots(container, 0)[0].getBoundingClientRect().width < 36, 'they shrank')
    assert.deepEqual(escaped(container, 0), [])
    assert.ok(lines(container, 1) > 1, 'a group that cannot shrink further wraps')
    assert.deepEqual(escaped(container, 1), [])
    assert.ok(container.querySelectorAll('[data-slot="input-otp"]')[1].getBoundingClientRect().width <= 90.5)
  })

  it('sizes each group by the slots it renders, also from a component of their own and as their number changes', async (t) => {
    let { container, act } = mount(
      t,
      <div style={{ ...tokens, width: '90px' }} mix={reset}>
        <HelperCode />
      </div>,
    )

    assert.ok(lines(container, 0) > 1, 'two groups of three slots at their minimum need two lines')
    assert.deepEqual(escaped(container, 0), [])

    await act(() => container.querySelector('button')!.click())
    assert.equal(slots(container, 0).length, 8)
    assert.ok(lines(container, 0) > 1)
    assert.deepEqual(escaped(container, 0), [])
  })

  it('removes its document listeners and timers when it unmounts', async (t) => {
    let signals: AbortSignal[] = []
    let add = document.addEventListener
    document.addEventListener = function (
      this: Document,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (typeof options === 'object' && options.signal) signals.push(options.signal)
      return add.call(this, type, listener, options)
    } as typeof document.addEventListener
    t.after(() => {
      document.addEventListener = add
    })

    let { container, act, cleanup } = mount(t, <form>{code({ defaultValue: '1' })}</form>)
    let input = otpInput(container)
    await act(() => input.focus())
    container.querySelector('form')!.reset()
    assert.ok(signals.length >= 2)

    cleanup()
    assert.ok(signals.every((signal) => signal.aborted))
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
