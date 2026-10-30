// RemixCN Input OTP: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and input-otp (MIT, Copyright (c) 2024 Guilherme Rodz).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Dispatched, Handle, Props, RemixNode } from 'remix/component'

import { ariaStates } from '#remixcn/lib/aria.ts'
import { MinusIcon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

// The code lives in one real text input with autocomplete="one-time-code",
// so the browser labels, autofills, pastes, validates, submits and resets it,
// and input methods, phones and screen readers work on it as on any text box.
// The input lies over the slots with clear text. The slots, groups,
// separators and caret only draw that value and its selection.
//
// Until the browser runs the component, the server's slots show the starting
// code under the clear input, which takes a plain focus ring. Without
// scripting, or when the code still doesn't run two seconds later, the input
// shows itself as a plain text box over the slots, so nobody types blind.

/** Accepts digits only. Each pasted or typed character must match a pattern on its own. */
export const REGEXP_ONLY_DIGITS = '^\\d+$'
/** Accepts Latin letters only. */
export const REGEXP_ONLY_CHARS = '^[a-zA-Z]+$'
/** Accepts digits and Latin letters. */
export const REGEXP_ONLY_DIGITS_AND_CHARS = '^[a-zA-Z0-9]+$'

const patterns = new Map<string, RegExp>()

function compile(pattern: string) {
  let compiled = patterns.get(pattern)
  if (!compiled) {
    compiled = new RegExp(pattern)
    patterns.set(pattern, compiled)
  }
  return compiled
}

function lengthOf(maxLength: number) {
  return Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 0
}

/**
 * Turns typed, pasted or composed text into a code: full-width characters
 * from an input method become the ones they show (NFKC), each character the
 * pattern refuses on its own is dropped, and the rest is cut at maxLength.
 * Leading zeroes stay, since a code is text.
 */
export function sanitizeOTP(text: string, { pattern, maxLength }: { pattern?: string; maxLength: number }): string {
  return allowedText(text, pattern).slice(0, lengthOf(maxLength))
}

function allowedText(text: string, pattern: string | undefined) {
  let normalized = text.normalize('NFKC')
  let allowed = pattern === undefined ? undefined : compile(pattern)
  return allowed
    ? Array.from(normalized)
        .filter((char) => allowed.test(char))
        .join('')
    : normalized
}

// Events

const inputOTPChangeType = 'remixcn:input-otp-change' as const
const inputOTPCompleteType = 'remixcn:input-otp-complete' as const

/** What changed the code: typing, deleting, autofill or an input method, a paste, or a form reset. */
export type InputOTPChangeReason = 'input' | 'paste' | 'reset'

/**
 * Bubbles from the input each time the code changes, with the input's value.
 * A controlled code shows the new value only once its value prop does. It
 * takes the place of input-otp's onChange.
 */
export class InputOTPChangeEvent extends Event {
  readonly value: string
  readonly reason: InputOTPChangeReason

  constructor(value: string, reason: InputOTPChangeReason) {
    super(inputOTPChangeType, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/**
 * Bubbles from the input once the code it shows reaches maxLength, with the
 * input's value. It takes the place of input-otp's onComplete.
 */
export class InputOTPCompleteEvent extends Event {
  readonly value: string

  constructor(value: string) {
    super(inputOTPCompleteType, { bubbles: true })
    this.value = value
  }
}

declare global {
  interface HTMLElementEventMap {
    [inputOTPChangeType]: InputOTPChangeEvent
    [inputOTPCompleteType]: InputOTPCompleteEvent
  }
}

type InputOTPEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Listens for InputOTPChangeEvent on the input or any ancestor: mix={onInputOTPChange((event) => …)}. */
export function onInputOTPChange<target extends HTMLElement>(
  handler: InputOTPEventHandler<InputOTPChangeEvent, target>,
  capture?: boolean,
): ReturnType<typeof on<target, typeof inputOTPChangeType>> {
  return on(inputOTPChangeType, handler, capture)
}

/** Listens for InputOTPCompleteEvent on the input or any ancestor: mix={onInputOTPComplete((event) => …)}. */
export function onInputOTPComplete<target extends HTMLElement>(
  handler: InputOTPEventHandler<InputOTPCompleteEvent, target>,
  capture?: boolean,
): ReturnType<typeof on<target, typeof inputOTPCompleteType>> {
  return on(inputOTPCompleteType, handler, capture)
}

// Props and context

export interface InputOTPProps extends Omit<
  Props<'input'>,
  | 'type'
  | 'value'
  | 'defaultValue'
  | 'maxLength'
  | 'pattern'
  | 'list'
  | 'checked'
  | 'defaultChecked'
  | 'indeterminate'
  | 'multiple'
  | 'accept'
  | 'min'
  | 'max'
  | 'step'
  | 'children'
> {
  /** How many characters the code has. Typing, pasting and autofill stop there. */
  maxLength: number
  /** The controlled code. The slots then show only this value, and ask for changes with InputOTPChangeEvent. */
  value?: string
  /** The starting code when the input owns it, and the code a form reset returns to. */
  defaultValue?: string
  /**
   * A regular expression each character must match on its own, such as
   * REGEXP_ONLY_DIGITS. Typed and pasted characters it refuses are dropped.
   * The input also writes it as its native pattern, so the browser checks
   * the whole code before any script runs.
   */
  pattern?: string
  /** Changes pasted text before the pattern filters it, such as removing a prefix. */
  pasteTransformer?: (text: string) => string
  /**
   * The message for a code shorter than minLength where the browser doesn't
   * check it, such as Chromium after a filtered paste. Translate it with your
   * app's language. By default: Enter at least <minLength> characters.
   */
  tooShortMessage?: string
  /** Shows a dot, or this text, in each filled slot, and makes the input a password field. */
  mask?: boolean | string
  /** Classes for the box around the slots. Native attributes, ARIA and mix go to the input. */
  containerClass?: string
  /** Mixins for the box around the slots, such as css(). */
  containerMix?: Props<'div'>['mix']
  /** Groups, slots and separators that draw the code. */
  children?: RemixNode
  [data: `data-${string}`]: string | number | boolean | undefined
}

/** What one slot shows. */
export interface InputOTPSlotState {
  /** The character at this index, or null when the code doesn't reach it. */
  char: string | null
  /** The placeholder's character at this index while the code is empty. */
  placeholderChar: string | null
  /** Whether the input is focused and its selection or caret covers this slot. */
  isActive: boolean
  /** Whether the slot draws the blinking caret: it is active and empty. */
  hasFakeCaret: boolean
}

/**
 * What InputOTP shares with the parts inside it. A custom slot reads it
 * with handle.context.get(InputOTP) and renders data-slot="input-otp-slot"
 * and data-index, so a press on it selects its character.
 */
export interface InputOTPContext {
  slots: InputOTPSlotState[]
  isFocused: boolean
  isHovering: boolean
  /** The text a masked code shows in each filled slot. */
  mask?: string
}

// Styles

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const root = '[data-slot="input-otp"]'
const invalidInput = `:where(${root}:has(> input[aria-invalid="true"]))`

// The narrowest a slot gets, in rem, whatever font size a caller gives the slots.
const slotMinWidth = '0.875rem'

// The groups shrink their slots first. Once the slots reach their minimum,
// a group moves to the next line, which the input still covers, so the slots
// never leave the input and its presses.
const rootRule = css({
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(2),
  width: 'fit-content',
  maxWidth: '100%',
  // Presses go through the slots to the input, which lies over them.
  pointerEvents: 'none',
  userSelect: 'none',
  '&:has(> input:disabled)': { opacity: 0.5 },
})

// The look the input takes as a plain text box, without the component's script.
const fallbackLook: Styles = {
  paddingInline: space(2),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  caretColor: 'var(--foreground)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.25em',
  textAlign: 'center',
}

const autofillHidden: Styles = {
  backgroundColor: 'transparent',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  boxShadow: 'none',
  transition: 'background-color 600000s 0s, color 600000s 0s',
}

const inputRule = css({
  '@keyframes remixcn-input-otp-fallback': { to: fallbackLook },
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  boxShadow: 'none',
  // The characters stay in the input, clear and squeezed to its start, as input-otp draws them.
  color: 'transparent',
  caretColor: 'transparent',
  fontFamily: 'monospace',
  fontVariantNumeric: 'tabular-nums',
  // 16px keeps phones from zooming in on focus.
  fontSize: 'max(1rem, 16px)',
  lineHeight: 1,
  letterSpacing: '-0.5em',
  textAlign: 'start',
  cursor: 'text',
  pointerEvents: 'auto',
  '&::selection': { backgroundColor: 'transparent', color: 'transparent' },
  '&::placeholder': { color: 'transparent' },
  '&:-webkit-autofill': autofillHidden,
  '&:autofill': autofillHidden,
  '&:disabled': { cursor: 'not-allowed' },
  // The active slot draws the ring once the component runs.
  '&:not([data-pending]):focus-visible': { outline: 'none' },
  // Forced colors repaint clear text, its selection and caret in system
  // colors, which would draw the squeezed code over the first slot. Opacity
  // stays, so the running input hides there; the slots still show the code.
  '@media (forced-colors: active)': { '&:not([data-pending])': { opacity: 0 } },
  // Keeps iOS from drawing the squeezed text and its selection handles over the slots.
  '@supports (-webkit-touch-callout: none)': { letterSpacing: '-0.6em', fontWeight: 100 },
  '&[data-pending]': { animation: 'remixcn-input-otp-fallback 0s 2s forwards' },
  '@media (scripting: none)': {
    '&[data-pending]': mergeStyles(fallbackLook, { animation: 'none' }),
    '&[data-pending]::placeholder': { color: 'var(--muted-foreground)' },
  },
})

// A group lays its slots out as grid columns from their narrowest width up
// to their own. So its narrowest and widest sizes come from the slots it
// renders, whatever component renders them and however many there are. It
// starts from the narrowest, which decides when it moves to the next line,
// and grows up to the widest.
const groupRule = css({
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: `minmax(${slotMinWidth}, max-content)`,
  alignItems: 'center',
  flex: '1 1 0%',
  maxWidth: 'max-content',
  borderRadius: 'var(--radius-md)',
  // A light halo marks the group of an invalid code; the slots' borders and your error text say it too.
  [`&:has([aria-invalid="true"]), ${invalidInput} > &`]: {
    boxShadow:
      '0 0 0 3px light-dark(color-mix(in oklab, var(--destructive) 20%, transparent), color-mix(in oklab, var(--destructive) 40%, transparent))',
  },
})

const activeSlot = '&[data-active="true"]'
const invalidSlot = `&[aria-invalid="true"], ${invalidInput} &`

const slotRule = css(
  mergeStyles(
    {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: space(9),
      height: space(9),
      // A narrow screen or large text narrows the group's columns, and the slots with them, before the group wraps.
      maxWidth: '100%',
      minWidth: 0,
      borderBlock: '1px solid var(--input)',
      borderInlineEnd: '1px solid var(--input)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      '&:first-child': {
        borderInlineStart: '1px solid var(--input)',
        borderStartStartRadius: 'var(--radius-md)',
        borderEndStartRadius: 'var(--radius-md)',
      },
      '&:last-child': { borderStartEndRadius: 'var(--radius-md)', borderEndEndRadius: 'var(--radius-md)' },
      '&[data-placeholder]': { color: 'var(--muted-foreground)' },
      [activeSlot]: { zIndex: 10, borderColor: 'var(--ring)', outline: '2px solid var(--ring)', outlineOffset: 0 },
      [invalidSlot]: { borderColor: 'var(--destructive)' },
      [`${activeSlot}:is([aria-invalid="true"]), ${invalidInput} ${activeSlot}`]: {
        borderColor: 'var(--destructive)',
        outlineColor: 'var(--destructive)',
      },
    },
    transition('color', 'border-color', 'box-shadow', 'outline-color'),
  ),
)

const caretRule = css({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
})

// A border, not a background, draws the line, so it stays visible in forced colors.
const caretLineRule = css({
  '@keyframes remixcn-input-otp-caret-blink': {
    '0%, 70%, 100%': { opacity: 1 },
    '20%, 50%': { opacity: 0 },
  },
  width: 0,
  height: '1rem',
  borderInlineStart: '1px solid var(--foreground)',
  animation: 'remixcn-input-otp-caret-blink 1s ease-out infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

const separatorRule = css({
  display: 'flex',
  flex: 'none',
  alignItems: 'center',
  '& svg': { width: '1rem', height: '1rem' },
})

// The component

type Direction = 'forward' | 'backward' | 'none'

/**
 * shadcn's Input OTP, on one native text input. Write its groups, slots
 * and separators as children. Native attributes, ids, ARIA and mix go to the
 * input; containerClass and containerMix to the box around the slots.
 *
 * It isn't a client entry, because its slots are live children. It runs in
 * the browser inside your client entry. On a page that only renders on the
 * server, the input still takes, validates and submits the code, and shows
 * it as a plain text box.
 */
export function InputOTP(handle: Handle<InputOTPProps, InputOTPContext>) {
  let uncontrolled: string | undefined
  // The value a controlled code first rendered, which a reset returns to without a defaultValue.
  let initialControlled: string | undefined
  let current = ''
  // The raw text while an input method composes, shown as typed until it commits.
  let composing: string | undefined
  // Set while a committed composition waits to be cleaned up.
  let commitTimer: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(commitTimer), { once: true })
  let input: HTMLInputElement | undefined
  let box: HTMLElement | undefined
  let running = false
  let focused = false
  let hovering = false
  let selection: [number | null, number | null] = [null, null]
  let previous: [number | null, number | null, Direction] = [null, null, 'none']
  // The code the last completion check saw.
  let checked: string | undefined
  let ownEvents = new WeakSet<Event>()
  // What the component's own edit is for, while the browser fires its input event.
  let editing: InputOTPChangeReason | undefined
  // The custom validity message checkLength set, if any.
  let lengthError: string | undefined

  function maxLength() {
    return lengthOf(handle.props.maxLength)
  }

  function sanitize(text: string) {
    return sanitizeOTP(text, { pattern: handle.props.pattern, maxLength: maxLength() })
  }

  function resetValue() {
    return (handle.props.defaultValue ?? initialControlled ?? '').slice(0, maxLength())
  }

  /**
   * Mirrors the input's selection into the slots, as input-otp does: a caret
   * inside a full or partly filled code selects the character beside it, so
   * typing replaces it and the arrow keys step from slot to slot. A caret at
   * the end of a code that isn't full stays, so typing adds a character.
   */
  function syncSelection() {
    let before = `${selection}`
    if (!input || document.activeElement !== input) {
      selection = [null, null]
      return before !== `${selection}`
    }

    let { selectionStart: s, selectionEnd: e, selectionDirection: direction, value } = input
    let max = maxLength()
    let start = -1
    let end = -1
    let nextDirection: Direction | undefined

    if (value.length !== 0 && s !== null && e !== null && s === e) {
      let inserting = s === value.length && value.length < max
      if (!inserting) {
        if (s === 0) {
          start = 0
          end = 1
          nextDirection = 'forward'
        } else if (s === max) {
          start = s - 1
          end = s
          nextDirection = 'backward'
        } else if (max > 1 && value.length > 1) {
          let offset = 0
          if (previous[0] !== null && previous[1] !== null) {
            nextDirection = s < previous[1] ? 'backward' : 'forward'
            let wasInserting = previous[0] === previous[1] && previous[0] < max
            if (nextDirection === 'backward' && !wasInserting) offset = -1
          }
          start = offset + s
          end = offset + s + 1
        }
      }
      if (start !== -1 && end !== -1 && start !== end) input.setSelectionRange(start, end, nextDirection)
    }

    let mirrored: [number | null, number | null] = start !== -1 ? [start, end] : [s, e]
    selection = mirrored
    previous = [mirrored[0], mirrored[1], nextDirection ?? (direction as Direction) ?? 'none']
    return before !== `${selection}`
  }

  function refresh() {
    if (syncSelection()) void handle.update()
  }

  /** Writes the shown code into the input, which a declined change, a reset or a new value prop may have left behind. */
  function syncInput() {
    if (!input || composing !== undefined || input.value === current) return
    let wasFocused = document.activeElement === input
    input.value = current
    if (wasFocused) {
      input.setSelectionRange(current.length, current.length)
      syncSelection()
    }
  }

  /**
   * Applies a new code: an uncontrolled code keeps it, and listeners see it at
   * once. A controlled code returns to its value prop unless its owner
   * renders the new one.
   */
  function change(next: string, reason: InputOTPChangeReason) {
    composing = undefined
    if (next === current) {
      refresh()
      return
    }
    if (handle.props.value === undefined) uncontrolled = next
    current = next
    syncSelection()
    input?.dispatchEvent(new InputOTPChangeEvent(next, reason))
    void handle.update()
  }

  /**
   * Replaces part of the input's text through the browser's editing, as a
   * keystroke or paste would, instead of writing the value: the browser fires
   * input, and change once the user leaves, adds an undo step, and Firefox and
   * Safari keep checking minLength. The input event it fires applies the code.
   * Returns false when the input isn't focused or the browser can't edit it.
   */
  function edit(from: number, to: number, text: string) {
    if (!input || document.activeElement !== input) return false
    input.setSelectionRange(from, to)
    try {
      return document.execCommand(text === '' ? 'delete' : 'insertText', false, text)
    } catch {
      return false
    }
  }

  /** Replaces the whole text with a clean code, through the browser's editing where it can. */
  function rewrite(next: string, reason: InputOTPChangeReason, caret = next.length) {
    if (!input) return
    let raw = input.value
    editing = reason
    let edited = edit(0, raw.length, next)
    editing = undefined
    if (!edited) input.value = next
    if (document.activeElement === input) input.setSelectionRange(caret, caret)
    change(next, reason)
  }

  // Characters the pattern refuses never reach the input, so what the user
  // types stays the user's own edit, which the browser validates.
  function onBeforeInput(event: InputEvent) {
    if (!input || event.defaultPrevented || event.isComposing || composing !== undefined) return
    if (event.inputType !== 'insertText' && event.inputType !== 'insertReplacementText') return
    let data = event.data ?? event.dataTransfer?.getData('text/plain') ?? null
    if (data === null) return
    let kept = allowedText(data, handle.props.pattern)
    if (kept === data) return
    event.preventDefault()
    if (kept === '') return
    let start = input.selectionStart ?? input.value.length
    let end = input.selectionEnd ?? start
    if (!edit(start, end, kept)) rewrite(sanitize(input.value.slice(0, start) + kept + input.value.slice(end)), 'input')
  }

  function onInput(event: Event) {
    if (!input || ownEvents.has(event)) return
    // Firefox ends a composition with compositionend and then this input
    // event. The input method is done by then, so the commit is cleaned up at
    // once, before anything else can read the text it left.
    if (commitTimer !== undefined && !(event as InputEvent).isComposing) return finishCommit()
    if (composing !== undefined || (event as InputEvent).isComposing) {
      composing = input.value.slice(0, maxLength())
      void handle.update()
      return
    }
    let reason = editing ?? ((event as InputEvent).inputType === 'insertFromPaste' ? 'paste' : 'input')
    let raw = input.value
    let next = sanitize(raw)
    if (next === raw) return change(next, reason)
    // Something got past the pattern, such as dropped text or autofill. The
    // refused characters leave, and the caret stays after the ones before it.
    rewrite(next, reason, sanitize(raw.slice(0, input.selectionEnd ?? raw.length)).length)
  }

  // An edit while the input method ends its composition can disturb it, so
  // the committed text is cleaned up in the next task, or in the input event
  // Firefox sends after compositionend, whichever comes first. Until then the
  // slots keep showing it, and no render writes the old code back over it.
  function onCompositionEnd() {
    if (!input) return
    let raw = input.value
    let next = sanitize(raw)
    if (next === raw) {
      composing = undefined
      return change(next, 'input')
    }
    composing = raw.slice(0, maxLength())
    clearTimeout(commitTimer)
    commitTimer = setTimeout(finishCommit)
  }

  function finishCommit() {
    clearTimeout(commitTimer)
    commitTimer = undefined
    if (handle.signal.aborted || !input) return
    composing = undefined
    let value = input.value
    let clean = sanitize(value)
    if (clean === value) change(clean, 'input')
    else rewrite(clean, 'input')
  }

  function onPaste(event: ClipboardEvent) {
    if (!input || event.defaultPrevented || !event.clipboardData || input.readOnly || input.disabled) return
    let text = event.clipboardData.getData('text/plain')
    let { pasteTransformer } = handle.props
    let pasted = allowedText(pasteTransformer ? pasteTransformer(text) : text, handle.props.pattern)

    let max = maxLength()
    let value = input.value
    let start = input.selectionStart ?? value.length
    let end = input.selectionEnd ?? start
    let room = Math.max(0, max - (value.length - (end - start)))
    // Text the browser can paste as it is stays the user's own edit, which
    // every browser validates, so the browser pastes it.
    if (pasted === text && pasted.length <= room) return
    event.preventDefault()
    if (pasted === '') return

    // A whole code replaces the one there; a part goes where the selection is, cut to the room left.
    let [from, to, insert] =
      pasted.length >= max ? [0, value.length, pasted.slice(0, max)] : [start, end, pasted.slice(0, room)]
    let next = value.slice(0, from) + insert + value.slice(to)
    if (next !== value) {
      editing = 'paste'
      let edited = edit(from, to, insert)
      editing = undefined
      if (!edited) {
        input.value = next
        change(next, 'paste')
        let native = new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: insert })
        ownEvents.add(native)
        input.dispatchEvent(native)
      }
    }
    let caret = Math.min(next.length, max - 1)
    input.setSelectionRange(caret, next.length)
    refresh()
  }

  /**
   * Browsers check minLength only on text the user typed or pasted. Chromium
   * counts the component's own edits, such as a filtered paste or a
   * committed input method's text, as a script's, so a code too short to
   * pass would. There the component reports it as a custom validity error.
   */
  function checkLength() {
    if (!input) return
    let { minLength, tooShortMessage } = handle.props
    let length = input.value.length
    let min = Number(minLength)
    let short = Number.isFinite(min) && length > 0 && length < min && !input.validity.tooShort
    let message = short ? (tooShortMessage ?? `Enter at least ${min} characters.`) : undefined
    if (message === lengthError) return
    input.setCustomValidity(message ?? '')
    lengthError = message
  }

  function onFocus() {
    if (!input) return
    let start = Math.min(input.value.length, Math.max(maxLength() - 1, 0))
    input.setSelectionRange(start, input.value.length)
    focused = true
    syncSelection()
    void handle.update()
  }

  function onBlur() {
    focused = false
    syncSelection()
    void handle.update()
  }

  // A press on a filled slot selects its character; a press after the code puts the caret at its end.
  function onClick(event: MouseEvent) {
    if (!input || !box || event.detail > 1 || event.defaultPrevented) return
    let pressed = [...box.querySelectorAll<HTMLElement>('[data-slot="input-otp-slot"]')].find((slot) => {
      let rect = slot.getBoundingClientRect()
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
    })
    if (!pressed) return
    let index = Number(pressed.dataset.index)
    if (!Number.isInteger(index)) return
    let target = input
    let value = target.value
    let select = () => {
      let length = target.value.length
      let max = maxLength()
      if (index < length) target.setSelectionRange(index, index + 1, 'forward')
      else if (length < max) target.setSelectionRange(length, length)
      else target.setSelectionRange(max - 1, max, 'backward')
      refresh()
    }
    select()
    // WebKit places the caret by the pointer after the click's listeners
    // ran, so the slot's selection comes again once the click is done,
    // unless the user has typed or left since.
    let timer = setTimeout(() => {
      if (document.activeElement === target && target.value === value) select()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  }

  // A form reset returns the input to its default value. The code follows
  // once the reset has finished, and tells a controlled owner. A listener may
  // cancel the reset after this one runs, so the component checks afterwards.
  function onReset(event: Event) {
    let form = input?.form
    if (!form || event.target !== form) return
    let timer = setTimeout(() => {
      if (handle.signal.aborted || event.defaultPrevented || !input) return
      // The browser has put the default value back, which the code returns to.
      let next = resetValue()
      if (input.value !== next) input.value = next
      change(next, 'reset')
      syncInput()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  }

  function onSelectionChange() {
    if (!input) return
    let active = document.activeElement === input
    if (active !== focused) {
      focused = active
      void handle.update()
    }
    refresh()
  }

  function afterRender() {
    syncInput()
    checkLength()
    let max = maxLength()
    if (checked !== undefined && current !== checked && checked.length < max && current.length === max && input) {
      input.dispatchEvent(new InputOTPCompleteEvent(input.value))
    }
    checked = current
  }

  // Runs once in the browser, after the first commit: it takes over the
  // input, and a code typed before then becomes the component's.
  function start() {
    if (running) return
    running = true
    document.addEventListener('selectionchange', onSelectionChange, { capture: true, signal: handle.signal })
    document.addEventListener('reset', onReset, { capture: true, signal: handle.signal })
    checked = current
    focused = document.activeElement === input
    if (input && input.value !== current) {
      let typed = sanitize(input.value)
      if (typed !== input.value) rewrite(typed, 'input')
      else change(typed, 'input')
    }
    syncSelection()
    checkLength()
    void handle.update()
  }

  return () => {
    let {
      maxLength: _maxLength,
      value,
      defaultValue,
      pattern,
      pasteTransformer: _pasteTransformer,
      tooShortMessage: _tooShortMessage,
      mask,
      placeholder,
      inputMode,
      autocomplete = 'one-time-code',
      autocapitalize = 'off',
      spellcheck = 'false',
      containerClass,
      containerMix,
      children,
      dir,
      mix,
      ...props
    } = handle.props
    let max = maxLength()

    if (value !== undefined) {
      current = value.slice(0, max)
      initialControlled ??= current
    } else {
      uncontrolled = (uncontrolled ?? defaultValue ?? '').slice(0, max)
      current = uncontrolled
    }

    let shown = composing ?? current
    let maskText = mask === true ? '•' : mask || undefined
    let active = (index: number) => {
      let [s, e] = selection
      if (!focused || s === null || e === null) return false
      return (s === e && index === s) || (index >= s && index < e)
    }
    let slots = Array.from({ length: max }, (_, index): InputOTPSlotState => {
      let char = shown[index] ?? null
      let isActive = active(index)
      return {
        char,
        placeholderChar: shown.length === 0 ? (placeholder?.[index] ?? null) : null,
        isActive,
        hasFakeCaret: isActive && char === null,
      }
    })
    handle.context.set({ slots, isFocused: focused, isHovering: hovering && !props.disabled, mask: maskText })
    handle.queueTask(running ? afterRender : start)

    let pending = running ? undefined : 'true'
    let reset = value !== undefined ? initialControlled : defaultValue
    let keyboard = pattern === undefined || pattern === REGEXP_ONLY_DIGITS ? 'numeric' : 'text'
    // A browser-owned attribute stays out of the props when unset, since an undefined prop removes it on every render.
    let native = {
      ...ariaStates(props),
      ...(maskText ? { type: 'password' } : {}),
      ...(reset !== undefined ? { defaultValue: reset.slice(0, max) } : {}),
    } as Props<'input'>

    return (
      <div
        data-slot="input-otp"
        data-pending={pending}
        dir={dir}
        class={containerClass}
        mix={[
          rootRule,
          ref((node, signal) => {
            box = node
            signal.addEventListener('abort', () => box === node && (box = undefined))
          }),
          containerMix,
        ]}
      >
        {children}
        <input
          data-slot="input-otp-input"
          {...native}
          data-pending={pending}
          maxLength={max}
          pattern={pattern}
          inputMode={inputMode ?? keyboard}
          autocomplete={autocomplete}
          autocapitalize={autocapitalize}
          spellcheck={spellcheck}
          placeholder={placeholder}
          mix={[
            inputRule,
            ref((node, signal) => {
              input = node
              signal.addEventListener('abort', () => input === node && (input = undefined))
            }),
            on<HTMLInputElement, 'beforeinput'>('beforeinput', onBeforeInput),
            on<HTMLInputElement, 'input'>('input', onInput),
            on('compositionstart', () => {
              if (input) composing = input.value.slice(0, maxLength())
            }),
            on('compositionend', onCompositionEnd),
            mix,
            on<HTMLInputElement, 'paste'>('paste', onPaste),
            on('focus', onFocus),
            on('blur', onBlur),
            on<HTMLInputElement, 'click'>('click', onClick),
            on('keyup', refresh),
            on('select', refresh),
            on('pointerenter', () => {
              hovering = true
              void handle.update()
            }),
            on('pointerleave', () => {
              hovering = false
              void handle.update()
            }),
          ]}
        />
      </div>
    )
  }
}

/** Groups slots into one joined row, such as the halves of a six-digit code. */
export function InputOTPGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="input-otp-group" {...ariaStates(props)} aria-hidden="true" mix={[groupRule, mix]} />
  }
}

export interface InputOTPSlotProps extends Props<'div'> {
  /** The index of the character this slot shows. */
  index: number
}

/**
 * Shows one character of the code, its selection and the blinking caret.
 * aria-invalid draws it red, as on shadcn's slot; aria-invalid on InputOTP
 * draws every slot red and tells assistive technology too.
 */
export function InputOTPSlot(handle: Handle<InputOTPSlotProps>) {
  return () => {
    let { index, mix, ...props } = handle.props
    let otp = handle.context.get(InputOTP)
    let slot = otp?.slots[index]
    let char = slot?.char ?? null
    let placeholder = char === null ? (slot?.placeholderChar ?? null) : null

    return (
      <div
        data-slot="input-otp-slot"
        data-index={index}
        data-active={slot?.isActive ? 'true' : 'false'}
        data-placeholder={placeholder === null ? undefined : 'true'}
        {...ariaStates(props)}
        aria-hidden="true"
        mix={[slotRule, mix]}
      >
        {char !== null ? (otp?.mask ?? char) : placeholder}
        {slot?.hasFakeCaret ? (
          <div data-slot="input-otp-caret" mix={caretRule}>
            <div mix={caretLineRule} />
          </div>
        ) : null}
      </div>
    )
  }
}

/** Draws a dash between groups. */
export function InputOTPSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return (
      <div data-slot="input-otp-separator" {...ariaStates(props)} aria-hidden="true" mix={[separatorRule, mix]}>
        <MinusIcon />
      </div>
    )
  }
}
