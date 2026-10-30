// RemixCN Questionnaire: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { CheckIcon, CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { focusRing, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonSize, ButtonVariant } from '#remixcn/ui/button.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import type { InputProps } from '#remixcn/ui/input.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

// One question at a time, in one native form. Each question is a fieldset
// named by its legend, its fixed answers are native radios or checkboxes,
// and a freeform answer is a native text input, so the form submits and
// resets its answers itself. The questionnaire keeps the answers, the
// current question and the validation in the browser, inside your client
// entry. Without a script, every question shows at once and the browser
// validates and submits the form on its own.

/** Whether a question has an answer, was skipped on purpose, or neither. */
export type QuestionnaireItemStatus = 'unanswered' | 'answered' | 'skipped'

/** Answer keys: A to Z, or 1 to 9. */
export type QuestionnaireShortcutMode = 'letters' | 'numbers'

/**
 * One question's answer: the value of its choice or the text of its
 * freeform answer, the values of a multiple question, or null for a
 * question skipped on purpose. An empty string or list is no answer.
 */
export type QuestionnaireAnswer = string | readonly string[] | null

/** The answers by question name. A missing name has no answer. */
export type QuestionnaireAnswers = Readonly<Record<string, QuestionnaireAnswer | undefined>>

export interface QuestionnaireChoiceDefinition {
  value: string
  disabled?: boolean
}

/**
 * A question, as the server needs to know it before the parts render: its
 * place, whether it's required, skippable or left out, and the order of its
 * choices for the answer keys.
 */
export interface QuestionnaireItemDefinition {
  name: string
  required?: boolean
  disabled?: boolean
  multiple?: boolean
  choices?: readonly QuestionnaireChoiceDefinition[]
}

/** Every answer at the moment of a submit. */
export interface QuestionnaireSnapshot {
  /**
   * Each question that takes part, in order: the value or text, the values
   * of a multiple question, or null when it was skipped.
   */
  answers: Record<string, string | string[] | null>
  /** What the form would send: the same answers as native form fields, and the submit button's own. */
  formData: FormData
}

export interface QuestionnaireValidateDetails {
  /** The name of the question to check. */
  item: string
  answers: QuestionnaireAnswers
  /** Aborts when the answer changes, the form resets, or the questionnaire goes away. */
  signal: AbortSignal
}

export interface QuestionnaireSubmitDetails {
  form: HTMLFormElement
  /** The button that submitted, or null for a submit from the keyboard. */
  submitter: HTMLElement | null
  /** Aborts when the form resets or the questionnaire goes away. */
  signal: AbortSignal
}

export interface QuestionnaireItemChangeDetails {
  /** next and previous move one question, skip moves on from a skipped one, and invalid goes back to one that needs an answer. */
  reason: 'next' | 'previous' | 'skip' | 'invalid' | 'reset' | 'unavailable'
}

/**
 * Throw it from onSubmit to send the person back to one question, such as
 * a server that refuses one answer. Any other error shows in the
 * questionnaire's own QuestionnaireError.
 */
export class QuestionnaireSubmitError extends Error {
  /** The question whose answer was refused. */
  readonly item: string | undefined

  constructor(message: string, options: { item?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'QuestionnaireSubmitError'
    this.item = options.item
  }
}

export interface QuestionnaireProps extends Omit<Props<'form'>, 'onSubmit' | 'onReset' | 'noValidate' | 'novalidate'> {
  /** The current question's name, for a questionnaire whose caller keeps it. Pair it with onItemChange. */
  item?: string
  /** The question to start at. Without one, the first that takes part. */
  defaultItem?: string
  /** Called when navigation asks for another question. */
  onItemChange?: (item: string, details: QuestionnaireItemChangeDetails) => void
  /**
   * The questions in order. Pass the same list you render, so the server
   * renders the progress, the actions and the answer keys right away.
   */
  items?: readonly QuestionnaireItemDefinition[]
  /** The answers, for a questionnaire whose caller keeps them. Pair it with onAnswersChange. */
  answers?: QuestionnaireAnswers
  /** The answers at first, and again after a form reset, such as a saved draft. */
  defaultAnswers?: QuestionnaireAnswers
  /** Called with every answer after a person changes or skips one. */
  onAnswersChange?: (answers: QuestionnaireAnswers, details: { item: string }) => void
  /** Gives each enabled choice of the current question a key. */
  shortcuts?: QuestionnaireShortcutMode
  /**
   * The questionnaire checks that each question has an answer or was
   * skipped. false adds the browser's own checks of each answer, such as
   * an email input's format, and reports them where the answer is.
   */
  noValidate?: boolean
  /**
   * Your own check of one question's answer, after it has one. Return an
   * error message, or nothing when it's fine. It may be async: the
   * questionnaire waits, and a rejection's message shows as the error.
   */
  validate?: (
    details: QuestionnaireValidateDetails,
  ) => string | null | undefined | void | PromiseLike<string | null | undefined | void>
  /**
   * Receives every answer once all of them pass. The questionnaire then
   * cancels the native submission, so you send it, and waits while your
   * promise runs. A rejection keeps the answers and shows its message.
   * Without onSubmit, the form submits natively to its action.
   */
  onSubmit?: (snapshot: QuestionnaireSnapshot, details: QuestionnaireSubmitDetails) => void | PromiseLike<void>
}

/** The position of the current question among those that take part. */
export interface QuestionnaireProgressState {
  current: number
  total: number
  first: boolean
  last: boolean
}

type Answers = Record<string, QuestionnaireAnswer | undefined>
type FocusTarget = 'item' | 'invalid'
// A check for Next, or a submit: its checks, then your onSubmit with the
// answers they passed. checked holds the answers the checks see.
type Pending = {
  kind: 'next' | 'submit'
  item: string | null
  controller: AbortController
  checking: boolean
  checked: Answers
}

interface ChoiceInfo {
  value: string
  disabled: boolean
}

interface ItemInfo {
  name: string
  required: boolean
  disabled: boolean
  multiple: boolean
  choices: ChoiceInfo[]
  /** Whether choices lists every choice: from items or the form, not only those rendered so far. */
  choicesKnown: boolean
  /** Whether the question has a freeform answer, or null while that's unknown. */
  hasInput: boolean | null
}

// What the browser found in the form after a commit.
interface LayoutItem extends ItemInfo {
  hasInput: boolean
  descriptionIds: string[]
  errorIds: string[]
}

// What the parts that rendered so far told the root, in this render.
interface Pass {
  items: ItemInfo[]
  claimed: string | null
  // The current question turned out disabled by its own prop: the next enabled one takes its place.
  handoff: boolean
}

const defaultMessages = {
  required: 'Choose an answer to continue.',
  optional: 'Choose an answer or skip this question.',
  rejected: 'Your answers weren’t sent. Try again.',
  check: 'This answer couldn’t be checked. Try again.',
}

/** A question's status from its answer: null was skipped, and an empty string or list is no answer yet. */
export function questionnaireAnswerStatus(answer: QuestionnaireAnswer | undefined): QuestionnaireItemStatus {
  if (answer === null) return 'skipped'
  return filledValues(answer).length > 0 ? 'answered' : 'unanswered'
}

function filledValues(answer: QuestionnaireAnswer | undefined): string[] {
  if (answer === null || answer === undefined) return []
  let values = typeof answer === 'string' ? [answer] : [...answer]
  return values.filter((value) => value.trim() !== '')
}

function shortcutKeys(mode: QuestionnaireShortcutMode | null): string[] {
  if (mode === 'letters') return Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
  if (mode === 'numbers') return Array.from({ length: 9 }, (_, index) => String(index + 1))
  return []
}

function shortcutOfKey(key: string, mode: QuestionnaireShortcutMode): string | null {
  let normalized = mode === 'letters' ? key.toUpperCase() : key
  return shortcutKeys(mode).includes(normalized) ? normalized : null
}

// The answer as the form can send it: without values of disabled choices,
// and, once every choice is known, without values of choices that are gone,
// unless the question has a freeform answer that may hold them as text.
function effectiveAnswer(answer: QuestionnaireAnswer | undefined, item: ItemInfo | undefined) {
  if (answer === null || answer === undefined || !item) return answer
  let disabled = new Set(item.choices.filter((choice) => choice.disabled).map((choice) => choice.value))
  let values = item.choices.map((choice) => choice.value)
  let keeps = (value: string, index: number, all: readonly string[]) => {
    if (disabled.has(value)) return false
    if (!item.choicesKnown || values.includes(value)) return true
    // One freeform answer, the first value that isn't a choice.
    return item.hasInput !== false && all.findIndex((other) => !values.includes(other)) === index
  }
  if (typeof answer === 'string') return keeps(answer, 0, [answer]) ? answer : ''
  return answer.filter(keeps)
}

// A freeform answer is the value that isn't one of the question's choices,
// as typed, also while it's only spaces.
function textOf(answer: QuestionnaireAnswer | undefined, choiceValues: readonly string[]) {
  if (answer === null || answer === undefined) return ''
  let values = typeof answer === 'string' ? [answer] : answer
  return values.find((value) => !choiceValues.includes(value)) ?? ''
}

function filled(text: string) {
  return text.trim() !== ''
}

function sameJson(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second)
}

// The same answers, whatever the order of their names. A skip (null)
// differs from no answer (a missing name), which needs an answer or a skip.
function sameAnswers(first: QuestionnaireAnswers, second: QuestionnaireAnswers, names?: readonly string[]) {
  let keys = names ?? [...new Set([...Object.keys(first), ...Object.keys(second)])]
  return keys.every((name) => sameJson(first[name], second[name]))
}

function isTextEntry(element: Element) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'reset', 'submit'].includes(element.type)
  }
  return element instanceof HTMLElement && element.isContentEditable
}

function isRadio(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'radio'
}

// Arrow keys leave an empty text box, but not one with text to move through.
function isEmptyTextBox(element: Element) {
  return (
    element instanceof HTMLInputElement &&
    ['email', 'password', 'search', 'tel', 'text', 'url'].includes(element.type) &&
    element.value.trim() === ''
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback
}

function isRightToLeft(element: Element) {
  return getComputedStyle(element).direction === 'rtl'
}

function ownedBy(element: Element, form: HTMLFormElement) {
  return element.closest('form') === form
}

function itemElements(form: HTMLFormElement) {
  return [...form.querySelectorAll<HTMLFieldSetElement>('fieldset[data-slot="questionnaire-item"]')].filter((item) =>
    ownedBy(item, form),
  )
}

function ownParts<E extends Element>(item: HTMLFieldSetElement, selector: string) {
  return [...item.querySelectorAll<E>(selector)].filter(
    (part) => part.closest('fieldset[data-slot="questionnaire-item"]') === item,
  )
}

function choiceInputs(item: HTMLFieldSetElement) {
  return ownParts<HTMLInputElement>(item, 'input[data-slot="questionnaire-choice-input"]')
}

function textInputs(item: HTMLFieldSetElement) {
  return ownParts<HTMLInputElement>(item, 'input[data-slot="questionnaire-input"]')
}

function readLayout(form: HTMLFormElement): LayoutItem[] {
  return itemElements(form).map((item) => ({
    name: item.dataset.name ?? '',
    required: item.hasAttribute('data-required'),
    disabled: item.hasAttribute('data-disabled'),
    multiple: item.hasAttribute('data-multiple'),
    choices: choiceInputs(item).map((input) => ({ value: input.value, disabled: input.hasAttribute('data-disabled') })),
    choicesKnown: true,
    hasInput: textInputs(item).length > 0,
    descriptionIds: ownParts(item, '[data-slot="questionnaire-description"]')
      .map((part) => part.id)
      .filter(Boolean),
    errorIds: ownParts(item, '[data-slot="questionnaire-error"]')
      .map((part) => part.id)
      .filter(Boolean),
  }))
}

// The answer a question's controls show: the checked choices, or the text.
function readAnswer(item: HTMLFieldSetElement): QuestionnaireAnswer {
  let checked = choiceInputs(item)
    .filter((input) => input.checked)
    .map((input) => input.value)
  let text = textInputs(item)
    .map((input) => input.value)
    .find((value) => value.trim() !== '')
  if (item.hasAttribute('data-multiple')) return text === undefined ? checked : [...checked, text]
  return checked[0] ?? text ?? ''
}

// Finds parts among the children an item was given, also inside the
// children it passes to elements and components, such as a card's header.
// What a component renders on its own shows only once the browser runs.
function findParts(node: RemixNode, type: unknown, found: Array<Record<string, unknown>> = []) {
  if (Array.isArray(node)) {
    for (let child of node) findParts(child, type, found)
  } else if (node && typeof node === 'object' && 'type' in node && 'props' in node) {
    let props = (node.props ?? {}) as Record<string, unknown>
    if (node.type === type) found.push(props)
    else findParts(props.children as RemixNode, type, found)
  }
  return found
}

// Whether the children hold a QuestionnaireInput: true when one shows,
// false when none can, and null when a component of yours might render one.
function findsInput(node: RemixNode): boolean | null {
  let parts: unknown[] = [
    QuestionnaireTitle,
    QuestionnaireDescription,
    QuestionnaireChoices,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireError,
    QuestionnaireProgress,
    QuestionnaireActions,
    QuestionnairePrevious,
    QuestionnaireSkip,
    QuestionnaireNext,
    QuestionnaireSubmit,
  ]
  let unknown = false
  let visit = (child: RemixNode): boolean => {
    if (Array.isArray(child)) return child.some(visit)
    if (!child || typeof child !== 'object' || !('type' in child) || !('props' in child)) return false
    if (child.type === QuestionnaireInput) return true
    if (typeof child.type === 'function' && !parts.includes(child.type)) unknown = true
    return visit((child.props as Record<string, unknown> | null)?.children as RemixNode)
  }
  return visit(node) ? true : unknown ? null : false
}

interface RootContext {
  id: string
  running: boolean
  /** Whether the form's text runs right to left, which swaps Left and Right. */
  rtl: boolean
  shortcuts: QuestionnaireShortcutMode | null
  pending: Pending['kind'] | null
  formError: string | null
  formErrorAttempt: number
  register(info: Omit<ItemInfo, 'choices' | 'choicesKnown'>): ItemInfo
  definition(name: string): QuestionnaireItemDefinition | undefined
  layoutItem(name: string): LayoutItem | undefined
  isActive(name: string, disabled: boolean): boolean
  progress(): QuestionnaireProgressState
  activeItem(): ItemInfo | null
  answer(name: string): QuestionnaireAnswer | undefined
  initialAnswer(name: string): QuestionnaireAnswer | undefined
  message(name: string): string | null
  attempted(name: string): boolean
  attempt(name: string): number
  choose(name: string, value: string, checked: boolean): void
  write(name: string, text: string): void
  goPrevious(): void
  goNext(): void
  skip(): void
}

interface ItemContext {
  name: string
  base: string
  active: boolean
  required: boolean
  multiple: boolean
  disabled: boolean
  invalid: boolean
  status: QuestionnaireItemStatus
  hasInput: boolean | null
  message: string | null
  attempt: number
  shortcuts: QuestionnaireShortcutMode | null
  registerChoice(value: string, disabled: boolean): string | null
  choiceValues(): string[]
  hasChoices(): boolean
  descriptionId(own: string | undefined): string
  errorId(own: string | undefined): string
}

function getRoot(handle: Handle<any, any>, part: string): RootContext {
  let root = handle.context.get(Questionnaire) as RootContext | undefined
  if (!root) throw new Error(`${part} must be used within a Questionnaire.`)
  return root
}

function getItem(handle: Handle<any, any>, part: string): ItemContext {
  let item = handle.context.get(QuestionnaireItem) as ItemContext | undefined
  if (!item) throw new Error(`${part} must be used within a QuestionnaireItem.`)
  return item
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const smallText = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const scripted = '@media (scripting: enabled)'
const unscripted = '@media (scripting: none)'

const rootRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(6),
  width: '100%',
  minWidth: 0,
})

/**
 * A native form that asks one question at a time. Put a QuestionnaireItem
 * for each question inside, and QuestionnaireActions with the navigation.
 * It isn't a client entry: your mixins and callbacks can't cross from the
 * server to the browser. It runs in the browser inside your client entry.
 */
export function Questionnaire(handle: Handle<QuestionnaireProps, RootContext>) {
  let form: HTMLFormElement | undefined
  let running = false
  let layout: LayoutItem[] | null = null
  let previousFlow: string[] = []
  let initialized = false
  let initialAnswers: Answers = {}
  let uncontrolledAnswers: Answers = {}
  let uncontrolledItem: string | null = null
  let attempted = new Set<string>()
  let attempts = new Map<string, number>()
  let messages = new Map<string, string>()
  let formError: string | null = null
  let formErrorAttempt = 0
  let pending: Pending | null = null
  let pendingFocus: { name: string; target: FocusTarget } | null = null
  let renderedActive: string | null = null
  let lastActive: string | null = null
  let resubmitting = false
  let corrected: string | null | undefined
  let rtl = false
  // Whether the first browser commits are done: a correction before then moves no focus.
  let settled = false
  let pass: Pass = { items: [], claimed: null, handoff: false }

  handle.signal.addEventListener('abort', () => pending?.controller.abort())

  function definitions() {
    return handle.props.items
  }

  function definition(name: string) {
    return definitions()?.find((item) => item.name === name)
  }

  function layoutItem(name: string) {
    return layout?.find((item) => item.name === name)
  }

  function passItem(name: string) {
    return pass.items.find((item) => item.name === name)
  }

  // What's known about a question. Its flags come from the item itself,
  // which may override items: as it rendered in this render, or as the
  // browser found it, or else from items. Its choices come from the form,
  // which holds every rendered choice, or else from items, or else from
  // the choices rendered so far.
  function info(name: string): ItemInfo | undefined {
    let rendered = passItem(name)
    let found = layoutItem(name)
    let defined = definition(name)
    let own = rendered ?? found
    if (!own && !defined) return undefined
    let definedChoices = defined?.choices?.map((choice) => ({
      value: choice.value,
      disabled: Boolean(choice.disabled),
    }))
    return {
      name,
      required: own ? own.required : Boolean(defined?.required),
      disabled: own ? own.disabled : Boolean(defined?.disabled),
      multiple: own ? own.multiple : Boolean(defined?.multiple),
      choices: found?.choices ?? definedChoices ?? rendered?.choices ?? [],
      choicesKnown: Boolean(found) || Boolean(definedChoices),
      hasInput: found?.hasInput ?? rendered?.hasInput ?? null,
    }
  }

  // Every question in order, also those that don't take part.
  function order(): string[] {
    let items = definitions()
    return items ? items.map((item) => item.name) : (layout ?? pass.items).map((item) => item.name)
  }

  // The questions that take part, in order. The server knows them from
  // items, or from the questions that rendered so far.
  function flow(): ItemInfo[] {
    return order()
      .map((name) => info(name))
      .filter((item): item is ItemInfo => Boolean(item) && !item!.disabled)
  }

  function knownFlow(): ItemInfo[] | null {
    return definitions() || layout ? flow() : null
  }

  function requestedItem() {
    return handle.props.item ?? uncontrolledItem
  }

  // The current question, or another when it doesn't take part anymore:
  // the next one after a disabled question, the one now in the place of a
  // removed question, or the first.
  function resolveActive(): string | null {
    let requested = requestedItem()
    let known = knownFlow()
    if (!known) return requested
    let names = known.map((item) => item.name)
    if (requested !== null && names.includes(requested)) return requested
    if (names.length === 0) return null
    let all = order()
    let at = requested === null ? -1 : all.indexOf(requested)
    if (at >= 0) {
      let after = all.slice(at + 1).find((name) => names.includes(name))
      let before = all
        .slice(0, at)
        .reverse()
        .find((name) => names.includes(name))
      if (after ?? before) return (after ?? before)!
    }
    let index = requested === null ? -1 : previousFlow.indexOf(requested)
    return names[Math.min(Math.max(index, 0), names.length - 1)]
  }

  function activeName() {
    return pass.claimed ?? renderedActive
  }

  function currentAnswers(): Answers {
    return { ...(handle.props.answers ?? uncontrolledAnswers) }
  }

  function answer(name: string) {
    return effectiveAnswer(currentAnswers()[name], info(name))
  }

  function statusOf(name: string) {
    return questionnaireAnswerStatus(answer(name))
  }

  function choiceValues(name: string) {
    return info(name)?.choices.map((choice) => choice.value) ?? []
  }

  // Valid once it has an answer that no check of yours refused, or for an
  // optional question once it's skipped.
  function isValid(item: ItemInfo) {
    let status = statusOf(item.name)
    if (status === 'skipped') return !item.required
    return status === 'answered' && !externallyInvalid(item.name)
  }

  function nativelyValid(name: string, report: boolean) {
    if (handle.props.noValidate !== false || !form) return true
    let element = itemElements(form).find((item) => item.dataset.name === name)
    if (!element) return true
    let invalid = [...choiceInputs(element), ...textInputs(element)].find(
      (control) => control.hasAttribute('name') && control.willValidate && !control.validity.valid,
    )
    if (!invalid) return true
    if (report) {
      invalid.focus()
      invalid.reportValidity()
    }
    return false
  }

  async function check(item: ItemInfo, signal: AbortSignal): Promise<string | null> {
    let { validate } = handle.props
    if (!validate || statusOf(item.name) !== 'answered') return null
    try {
      let result = await validate({ item: item.name, answers: currentAnswers(), signal })
      return typeof result === 'string' && result.trim() !== '' ? result : null
    } catch (error) {
      return errorMessage(error, defaultMessages.check)
    }
  }

  function markInvalid(name: string, message?: string | null) {
    attempted.add(name)
    attempts.set(name, (attempts.get(name) ?? 0) + 1)
    if (message) messages.set(name, message)
  }

  function setAnswers(next: Answers, name: string) {
    messages.delete(name)
    // A check of answers that changed means nothing anymore: drop it, and
    // with it a submit that waits for it, so the person sends again.
    if (pending?.checking && (pending.kind === 'submit' || pending.item === name)) {
      pending.controller.abort()
      pending = null
    }
    if (handle.props.answers === undefined) uncontrolledAnswers = next
    handle.props.onAnswersChange?.(next, { item: name })
    void handle.update()
  }

  function setItem(name: string, reason: QuestionnaireItemChangeDetails['reason'], target: FocusTarget = 'item') {
    if (name !== activeName()) {
      if (handle.props.item === undefined) uncontrolledItem = name
      handle.props.onItemChange?.(name, { reason })
    }
    pendingFocus = { name, target }
    void handle.update()
  }

  function position(): { items: ItemInfo[]; index: number } {
    let items = flow()
    return { items, index: items.findIndex((item) => item.name === activeName()) }
  }

  function goPrevious() {
    if (pending) return
    let { items, index } = position()
    if (index > 0) setItem(items[index - 1].name, 'previous')
  }

  async function goNext() {
    if (pending || !form) return
    let { items, index } = position()
    let active = items[index]
    if (!active || index >= items.length - 1) return
    if (!(await passes(active, 'next'))) return
    // The question may have changed while a check ran.
    if (activeName() !== active.name) return
    setItem(items[index + 1].name, 'next')
  }

  // Checks the current question before moving on, and opens its error when it fails.
  async function passes(item: ItemInfo, kind: Pending['kind']) {
    if (!isValid(item)) {
      markInvalid(item.name)
      pendingFocus = { name: item.name, target: 'invalid' }
      void handle.update()
      return false
    }
    if (!nativelyValid(item.name, true)) return false
    if (!handle.props.validate || statusOf(item.name) !== 'answered') return true

    let controller = new AbortController()
    let checking: Pending = { kind, item: item.name, controller, checking: true, checked: currentAnswers() }
    pending = checking
    void handle.update()
    let message = await check(item, controller.signal)
    if (controller.signal.aborted || dropStale(checking)) return false
    pending = null
    if (message) {
      markInvalid(item.name, message)
      pendingFocus = { name: item.name, target: 'invalid' }
      void handle.update()
      return false
    }
    return true
  }

  // Answers that changed while their checks ran, by a person or by your
  // answers prop, make the checks mean nothing: abort them, and drop the
  // Next or the submit that waits for them.
  function dropStale(checking: Pending) {
    if (pending !== checking || !checking.checking) return false
    let names = checking.kind === 'next' && checking.item !== null ? [checking.item] : undefined
    if (sameAnswers(checking.checked, currentAnswers(), names)) return false
    checking.controller.abort()
    pending = null
    void handle.update()
    return true
  }

  // An Item that its caller marks invalid, such as after a server's check.
  function externallyInvalid(name: string) {
    let element = form && itemElements(form).find((item) => item.dataset.name === name)
    return element?.hasAttribute('data-external-invalid') ?? false
  }

  function skip() {
    if (pending || !form) return
    let { items, index } = position()
    let active = items[index]
    if (!active || active.required) return
    setAnswers({ ...currentAnswers(), [active.name]: null }, active.name)
    attempted.delete(active.name)
    if (index < items.length - 1) {
      setItem(items[index + 1].name, 'skip')
      return
    }
    // The last question: submit, once the skipped answer left the form.
    let target = form
    void handle.update().then(() => target.requestSubmit())
  }

  function choose(name: string, value: string, checked: boolean) {
    let item = info(name)
    if (!item) return
    let current = currentAnswers()[name]
    let next: QuestionnaireAnswer
    if (item.multiple) {
      let values = current === null || current === undefined ? [] : typeof current === 'string' ? [current] : current
      let choices = choiceValues(name)
      let selected = new Set(values.filter((other) => choices.includes(other)))
      if (checked) selected.add(value)
      else selected.delete(value)
      let text = textOf(current, choices)
      next = [...choices.filter((choice) => selected.has(choice)), ...(text !== '' ? [text] : [])]
    } else {
      next = checked ? value : current === value ? '' : (current ?? '')
    }
    setAnswers({ ...currentAnswers(), [name]: next }, name)
  }

  // Keeps the text as typed. Text replaces a single answer's choice, but
  // emptying the box beside a picked choice keeps the choice.
  function write(name: string, text: string) {
    let item = info(name)
    if (!item) return
    let current = currentAnswers()[name]
    let choices = choiceValues(name)
    let next: QuestionnaireAnswer
    if (item.multiple) {
      let values = current === null || current === undefined ? [] : typeof current === 'string' ? [current] : current
      next = [...values.filter((value) => choices.includes(value)), ...(text !== '' ? [text] : [])]
    } else {
      next = !filled(text) && typeof current === 'string' && choices.includes(current) ? current : text
    }
    setAnswers({ ...currentAnswers(), [name]: next }, name)
  }

  function snapshot(form: HTMLFormElement, submitter: HTMLElement | null): QuestionnaireSnapshot {
    let answers: QuestionnaireSnapshot['answers'] = {}
    for (let item of flow()) {
      let value = answer(item.name)
      answers[item.name] = value === null ? null : item.multiple ? filledValues(value) : (filledValues(value)[0] ?? '')
    }
    let formData = submitter ? new FormData(form, submitter) : new FormData(form)
    return { answers, formData }
  }

  async function submit(event: SubmitEvent) {
    let target = event.currentTarget as HTMLFormElement
    if (!running) return
    if (resubmitting) {
      resubmitting = false
      return
    }
    if (pending) {
      event.preventDefault()
      return
    }

    let items = flow()
    let invalid = items.find((item) => !isValid(item))
    if (invalid) {
      event.preventDefault()
      markInvalid(invalid.name)
      goTo(invalid.name)
      return
    }
    let natively = items.find((item) => !nativelyValid(item.name, false))
    if (natively) {
      event.preventDefault()
      goTo(natively.name)
      let name = natively.name
      void handle.update().then(() => nativelyValid(name, true))
      return
    }

    let { validate, onSubmit } = handle.props
    if (!validate && !onSubmit) return
    event.preventDefault()

    let submitter = event.submitter
    let controller = new AbortController()
    let submitting: Pending = { kind: 'submit', item: null, controller, checking: true, checked: currentAnswers() }
    pending = submitting
    formError = null
    void handle.update()

    let messages = await Promise.all(items.map((item) => check(item, controller.signal)))
    if (controller.signal.aborted || dropStale(submitting)) return
    // From here the answers that passed are sent, also if the person edits them meanwhile.
    submitting.checking = false
    let failed = messages.findIndex(Boolean)
    if (failed >= 0) {
      pending = null
      markInvalid(items[failed].name, messages[failed])
      goTo(items[failed].name)
      return
    }

    if (!onSubmit) {
      pending = null
      void handle.update()
      resubmitting = true
      target.requestSubmit(
        submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : null,
      )
      return
    }

    try {
      await onSubmit(snapshot(target, submitter), { form: target, submitter, signal: controller.signal })
      if (controller.signal.aborted) return
      pending = null
      void handle.update()
    } catch (error) {
      if (controller.signal.aborted) return
      pending = null
      let item = error instanceof QuestionnaireSubmitError ? error.item : undefined
      if (item !== undefined && items.some((other) => other.name === item)) {
        markInvalid(item, errorMessage(error, defaultMessages.rejected))
        goTo(item)
        return
      }
      showFormError(errorMessage(error, defaultMessages.rejected), submitter)
    }
  }

  // Shows a refused submit where the questionnaire's own error is, or in
  // the current question's when there's none, and keeps focus on the form.
  function showFormError(message: string, submitter: HTMLElement | null) {
    let hasOwnError = form?.querySelector('[data-slot="questionnaire-error"][data-scope="questionnaire"]')
    let current = activeName()
    if (!hasOwnError && current) {
      markInvalid(current, message)
    } else {
      formError = message
      formErrorAttempt += 1
    }
    void handle.update().then(() => {
      if (!form || form.contains(document.activeElement)) return
      let fallback = actionButton(form, 'submit')
      ;(submitter && submitter.isConnected ? submitter : fallback)?.focus()
    })
  }

  function goTo(name: string) {
    if (name === activeName()) {
      pendingFocus = { name, target: 'invalid' }
      void handle.update()
    } else {
      setItem(name, 'invalid', 'invalid')
    }
  }

  function reset(event: Event) {
    if (event.defaultPrevented || !running) return
    pending?.controller.abort()
    pending = null
    attempted.clear()
    messages.clear()
    formError = null
    let defaults = { ...handle.props.defaultAnswers }
    if (handle.props.answers === undefined) uncontrolledAnswers = defaults
    else handle.props.onAnswersChange?.(defaults, { item: activeName() ?? '' })
    let names = flow().map((item) => item.name)
    let start = handle.props.defaultItem
    let first = start !== undefined && names.includes(start) ? start : (names[0] ?? null)
    if (first !== null) setItem(first, 'reset')
    // The browser resets the controls after this event: put the answers back afterwards.
    let timer = setTimeout(() => {
      handle.signal.removeEventListener('abort', cancel)
      void handle.update()
    })
    let cancel = () => clearTimeout(timer)
    handle.signal.addEventListener('abort', cancel, { once: true })
  }

  function keydown(event: KeyboardEvent) {
    let target = event.target
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || !running || !form) return
    if (!(target instanceof Element)) return
    let element = itemElements(form).find((item) => item.dataset.name === activeName())
    let active = activeName() === null ? undefined : info(activeName()!)
    if (!element || !active) return

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault()
      if (!event.repeat) confirm()
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return

    let answers = [...choiceInputs(element), ...textInputs(element)].filter((control) => !control.disabled)

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (moveAnswerFocus(answers, element, target, event.key === 'ArrowDown' ? 1 : -1)) event.preventDefault()
      return
    }

    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !isTextEntry(target) && !isRadio(target)) {
      event.preventDefault()
      if (event.repeat) return
      let backward = isRightToLeft(form) ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === backward) goPrevious()
      else if (statusOf(active.name) !== 'unanswered' && !actionButton(form, 'next')?.disabled) void goNext()
      return
    }

    if (event.key === 'Enter') {
      if (!(target instanceof HTMLInputElement) || !answers.includes(target)) return
      event.preventDefault()
      let filled = target.type === 'radio' || target.type === 'checkbox' ? target.checked : target.value.trim() !== ''
      if (!event.repeat && filled && target.hasAttribute('name')) confirm()
      return
    }

    let mode = handle.props.shortcuts
    if (!mode || isTextEntry(target)) return
    let shortcut = shortcutOfKey(event.key, mode)
    let choice = shortcut
      ? choiceInputs(element).find((input) => input.dataset.shortcut === shortcut && !input.disabled)
      : undefined
    if (!choice) return
    event.preventDefault()
    if (event.repeat) return
    choice.focus()
    choice.click()
  }

  // The action that shows: outside the questions, or in the current one, as in a card per question.
  function actionButton(form: HTMLFormElement, kind: 'next' | 'submit') {
    return [
      ...form.querySelectorAll<HTMLButtonElement>(`button[data-slot="questionnaire-${kind}"]:not([hidden])`),
    ].find((button) => {
      let owner = button.closest<HTMLElement>('fieldset[data-slot="questionnaire-item"]')
      return ownedBy(button, form) && (!owner || owner.dataset.name === activeName())
    })
  }

  function moveAnswerFocus(answers: HTMLInputElement[], item: HTMLElement, target: Element, step: 1 | -1) {
    let index = answers.indexOf(target as HTMLInputElement)
    if (answers.length === 0) return false
    if (isTextEntry(target) && !isEmptyTextBox(target)) return false
    if (index < 0 && target !== item) return false
    let next =
      index < 0
        ? (answers.find((control) =>
            control.type === 'radio' || control.type === 'checkbox' ? control.checked : false,
          ) ?? (step === 1 ? answers[0] : answers[answers.length - 1]))
        : answers[(index + step + answers.length) % answers.length]
    if (!next || next === target) return false
    // The browser moves between radios of one group, and selects them, itself.
    if (index >= 0 && isRadio(target) && isRadio(next)) return false
    next.focus()
    if (isRadio(next)) next.click()
    return true
  }

  // Ctrl or Cmd and Enter, or Enter on an answer: the next question, or a
  // submit on the last. A Next or Submit you disabled keeps the keys from it too.
  function confirm() {
    let { items, index } = position()
    if (!form || index < 0) return
    let last = index === items.length - 1
    let button = actionButton(form, last ? 'submit' : 'next')
    if (button?.disabled) return
    if (!last) void goNext()
    else form.requestSubmit(button ?? null)
  }

  // After each commit in the browser: learn what rendered, settle the
  // current question, write the answers into the controls, and move focus.
  function afterCommit() {
    if (!form) return
    let next = readLayout(form)

    if (!running) {
      running = true
      rtl = isRightToLeft(form)
      layout = next
      lastActive = resolveActive() ?? pass.claimed
      adopt(form)
      void handle.update()
      return
    }
    if (pending && dropStale(pending)) return
    if (!sameJson(next, layout) || isRightToLeft(form) !== rtl) {
      layout = next
      rtl = isRightToLeft(form)
      void handle.update()
      return
    }

    let names = flow().map((item) => item.name)
    let requested = requestedItem()
    let resolved = resolveActive()
    previousFlow = names
    // The current question left the flow: go on with the one in its place.
    // A caller that keeps the question hears it once, and decides.
    if (resolved !== null && resolved !== requested && corrected !== requested) {
      corrected = requested
      let focusWasHere = form.contains(document.activeElement) || document.activeElement === document.body
      if (handle.props.item === undefined) uncontrolledItem = resolved
      if (requested !== null) {
        handle.props.onItemChange?.(resolved, { reason: 'unavailable' })
        if (settled && focusWasHere) pendingFocus = { name: resolved, target: 'item' }
      }
      void handle.update()
      return
    }

    writeControls(form)
    applyFocus(form)
    settled = true
  }

  // Answers a person gave before the script ran become the questionnaire's:
  // only those of questions whose controls they changed, never what the
  // server rendered.
  function adopt(form: HTMLFormElement) {
    let current = currentAnswers()
    let next = { ...current }
    let changed: string | null = null
    for (let element of itemElements(form)) {
      let name = element.dataset.name ?? ''
      let touched = [...choiceInputs(element), ...textInputs(element)].some((control) =>
        control.type === 'radio' || control.type === 'checkbox'
          ? control.checked !== control.defaultChecked
          : control.value !== control.defaultValue,
      )
      if (!touched) continue
      let found = readAnswer(element)
      if (sameJson(filledValues(found), filledValues(current[name]))) continue
      next[name] = found
      changed ??= name
    }
    if (changed === null) return
    if (handle.props.answers === undefined) uncontrolledAnswers = next
    handle.props.onAnswersChange?.(next, { item: changed })
  }

  function writeControls(form: HTMLFormElement) {
    for (let element of itemElements(form)) {
      let name = element.dataset.name ?? ''
      let value = answer(name)
      let values = value === null || value === undefined ? [] : typeof value === 'string' ? [value] : value
      for (let input of choiceInputs(element)) {
        let checked = values.includes(input.value)
        if (input.checked !== checked) input.checked = checked
      }
      // The box shows the freeform answer, also an empty one. Beside a
      // picked choice or a skip, it keeps what was typed, for later.
      let choices = choiceValues(name)
      let keepsText = value === null || (typeof value === 'string' && choices.includes(value))
      let text = textOf(value, choices)
      for (let input of textInputs(element)) {
        if (!keepsText && input.value !== text) input.value = text
      }
    }
  }

  function applyFocus(form: HTMLFormElement) {
    let current = activeName()
    let moved = current !== lastActive
    lastActive = current
    let target = pendingFocus?.name === current ? pendingFocus : null
    // A caller that keeps the current question moved it: focus follows.
    if (!target && moved && current !== null && handle.props.item !== undefined)
      target = { name: current, target: 'item' }
    // A request for a question the caller didn't choose is stale once another one shows.
    if (moved || target) pendingFocus = null
    if (!target) return
    let element = itemElements(form).find((item) => item.dataset.name === target.name)
    if (!element) return
    if (target.target === 'item') {
      element.focus()
      return
    }
    let answers = [...choiceInputs(element), ...textInputs(element)].filter((control) => !control.disabled)
    let selected = answers.find((control) =>
      control.type === 'radio' || control.type === 'checkbox'
        ? control.checked
        : control.hasAttribute('name') && control.value.trim() !== '',
    )
    ;(selected ?? answers[0] ?? element).focus()
  }

  let context: RootContext = {
    get id() {
      return handle.id
    },
    get running() {
      return running
    },
    get rtl() {
      return rtl
    },
    get shortcuts() {
      return handle.props.shortcuts ?? null
    },
    get pending() {
      return pending?.kind ?? null
    },
    get formError() {
      return formError
    },
    get formErrorAttempt() {
      return formErrorAttempt
    },
    // Each question tells the root about itself as it renders, and its
    // choices follow, so parts after it know them, also on the server.
    register(item) {
      let entry = passItem(item.name)
      if (entry) Object.assign(entry, item, { choices: [] })
      else pass.items.push((entry = { ...item, choices: [], choicesKnown: false }))
      return entry
    },
    definition,
    layoutItem,
    isActive(name, disabled) {
      if (renderedActive === null || (pass.handoff && pass.claimed === null)) {
        if (disabled) return false
        pass.claimed ??= name
        return pass.claimed === name
      }
      if (name !== renderedActive || pass.claimed !== null) return name === pass.claimed
      if (!disabled) return true
      pass.handoff = true
      return false
    },
    progress() {
      let { items, index } = position()
      let total = items.length
      return { current: index + 1, total, first: total > 0 && index === 0, last: total > 0 && index === total - 1 }
    },
    activeItem() {
      let name = activeName()
      return name === null ? null : (info(name) ?? null)
    },
    answer,
    initialAnswer: (name) => effectiveAnswer(initialAnswers[name], info(name)),
    message: (name) => messages.get(name) ?? null,
    attempted: (name) => attempted.has(name),
    attempt: (name) => attempts.get(name) ?? 0,
    choose,
    write,
    goPrevious,
    goNext: () => void goNext(),
    skip,
  }

  return () => {
    let {
      item: _item,
      defaultItem,
      onItemChange: _onItemChange,
      items,
      answers,
      defaultAnswers,
      onAnswersChange: _onAnswersChange,
      shortcuts,
      noValidate,
      validate: _validate,
      onSubmit: _onSubmit,
      mix,
      children,
      ...props
    } = handle.props

    if (!initialized) {
      initialized = true
      initialAnswers = { ...(answers ?? defaultAnswers) }
      uncontrolledAnswers = { ...defaultAnswers }
      let enabled = items?.filter((item) => !item.disabled).map((item) => item.name)
      uncontrolledItem =
        enabled && defaultItem !== undefined && !enabled.includes(defaultItem)
          ? (enabled[0] ?? null)
          : (defaultItem ?? enabled?.[0] ?? null)
    }

    pass = { items: [], claimed: null, handoff: false }
    renderedActive = resolveActive()
    handle.context.set(context)
    handle.queueTask(afterCommit)

    let { current, total, first, last } = context.progress()

    return (
      <form
        data-slot="questionnaire"
        data-running={running ? '' : undefined}
        data-pending={pending ? pending.kind : undefined}
        data-current={total > 0 && current > 0 ? String(current) : undefined}
        data-total={total > 0 ? String(total) : undefined}
        data-first={first ? '' : undefined}
        data-last={last ? '' : undefined}
        data-shortcuts={shortcuts}
        aria-busy={pending ? 'true' : undefined}
        {...props}
        // Once it runs, the questionnaire validates, so a hidden question never blocks a submit.
        noValidate={running || noValidate === true}
        mix={[
          rootRule,
          mix,
          ref<HTMLFormElement>((node, signal) => {
            form = node
            // A component inside can change the questions without rendering the root.
            let scheduled = false
            let observer = new MutationObserver(() => {
              if (scheduled) return
              scheduled = true
              queueMicrotask(() => {
                scheduled = false
                if (running && form && !sameJson(readLayout(form), layout)) void handle.update()
              })
            })
            observer.observe(node, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['data-name', 'data-required', 'data-disabled', 'data-multiple', 'value', 'id'],
            })
            signal.addEventListener('abort', () => {
              observer.disconnect()
              if (form === node) form = undefined
            })
          }),
          on<HTMLFormElement, 'keydown'>('keydown', keydown),
          on<HTMLFormElement, 'submit'>('submit', (event) => void submit(event)),
          on<HTMLFormElement, 'reset'>('reset', reset),
        ]}
      >
        {/*
          A disabled default button: Enter in a field submits through the
          form's first submit button, and a disabled one makes Enter do
          nothing, also before the script runs. In the browser, Enter
          continues to the next question instead.
        */}
        <button
          type="submit"
          disabled
          hidden
          tabIndex={-1}
          aria-hidden="true"
          data-slot="questionnaire-default-button"
        />
        {children}
      </form>
    )
  }
}

const progressRule = css({
  ...smallText,
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  minHeight: '1lh',
  width: 'fit-content',
  minWidth: '14ch',
  maxWidth: '100%',
  fontWeight: 500,
  color: 'var(--muted-foreground)',
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
  // Without a script, every question shows at once.
  [unscripted]: { display: 'none' },
})

export interface QuestionnaireProgressProps extends Omit<Props<'div'>, 'children' | 'role'> {
  /** Replaces "Question 1 of 3". A function gets the position. */
  children?: RemixNode | ((state: QuestionnaireProgressState) => RemixNode)
}

/** The position of the current question, as a named progress bar with text. */
export function QuestionnaireProgress(handle: Handle<QuestionnaireProgressProps>) {
  return () => {
    let root = getRoot(handle, 'QuestionnaireProgress')
    let { children, mix, ...props } = handle.props
    let state = root.progress()
    let known = state.total > 0 && state.current > 0
    let label = known ? `Question ${state.current} of ${state.total}` : undefined

    return (
      <div
        role="progressbar"
        aria-label="Questionnaire progress"
        aria-live="polite"
        aria-valuemin={known ? 1 : undefined}
        aria-valuemax={known ? state.total : undefined}
        aria-valuenow={known ? state.current : undefined}
        aria-valuetext={label}
        data-slot="questionnaire-progress"
        data-current={known ? String(state.current) : undefined}
        data-total={known ? String(state.total) : undefined}
        data-first={state.first ? '' : undefined}
        data-last={state.last ? '' : undefined}
        {...props}
        mix={[progressRule, mix]}
      >
        {typeof children === 'function' ? children(state) : (children ?? label)}
      </div>
    )
  }
}

const itemRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(5),
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
  // Until the script runs, the other questions hide by style. Without a
  // script they all show, and the browser submits them together. Like
  // theme.css's [hidden], these win over any display, also your own.
  [scripted]: { '&[data-inactive]': { display: 'none !important' } },
  '&[data-disabled]': { display: 'none !important' },
})

export interface QuestionnaireItemProps extends Omit<Props<'fieldset'>, 'name' | 'form'> {
  /** The question's id: unique in the questionnaire, and the form field name of its answers. */
  name: string
  /** Asks for an answer: Skip doesn't apply. Without it, from items. */
  required?: boolean
  /** Turns the choices into checkboxes. Without it, from items. */
  multiple?: boolean
  /** Leaves the question out of the flow, the progress and the submit. Without it, from items. */
  disabled?: boolean
  /** Marks the question invalid, such as after your own check. Show why in a QuestionnaireError. */
  invalid?: boolean
  /** Called when the status changes: answered, skipped, or unanswered. */
  onStatusChange?: (status: QuestionnaireItemStatus) => void
}

/**
 * One question: a fieldset named by its QuestionnaireTitle. Only the
 * current one shows, and the others are hidden and inert.
 */
export function QuestionnaireItem(handle: Handle<QuestionnaireItemProps, ItemContext>) {
  let lastStatus: QuestionnaireItemStatus | undefined
  let descriptions = 0
  let errors = 0

  return () => {
    let root = getRoot(handle, 'QuestionnaireItem')
    let {
      name,
      required: ownRequired,
      multiple: ownMultiple,
      disabled: ownDisabled,
      invalid: externallyInvalid = false,
      onStatusChange,
      children,
      'aria-describedby': ariaDescribedBy,
      'aria-keyshortcuts': ariaKeyShortcuts,
      mix,
      ...props
    } = handle.props
    let defined = root.definition(name)
    let required = ownRequired ?? defined?.required ?? false
    let multiple = ownMultiple ?? defined?.multiple ?? false
    let disabled = ownDisabled ?? defined?.disabled ?? false
    let layout = root.layoutItem(name)
    let hasInput = layout?.hasInput ?? findsInput(children)
    let entry = root.register({ name, required, disabled, multiple, hasInput })
    let choices = entry.choices

    // Ids come from the item's own handle: a name may hold any character, also a space.
    let base = `${handle.id}-question`
    let active = root.isActive(name, disabled)
    let status = questionnaireAnswerStatus(root.answer(name))
    let skipped = status === 'skipped' && !required
    let message = root.message(name)
    let invalid =
      !disabled &&
      !skipped &&
      (externallyInvalid || message !== null || (root.attempted(name) && status !== 'answered'))
    let { first, last } = root.progress()
    let descriptionIds =
      layout?.descriptionIds ??
      findParts(children, QuestionnaireDescription).map((part, index) =>
        typeof part.id === 'string'
          ? part.id
          : index === 0
            ? `${base}-description`
            : `${base}-description-${index + 1}`,
      )
    let errorIds =
      layout?.errorIds ??
      findParts(children, QuestionnaireError).map((part, index) =>
        typeof part.id === 'string' ? part.id : index === 0 ? `${base}-error` : `${base}-error-${index + 1}`,
      )

    if (lastStatus !== undefined && lastStatus !== status && onStatusChange) {
      let changed = status
      handle.queueTask(() => onStatusChange(changed))
    }
    lastStatus = status
    descriptions = 0
    errors = 0

    let shortcutMode = root.shortcuts
    let keys = shortcutKeys(shortcutMode)
    let definedChoices = defined?.choices

    handle.context.set({
      name,
      base,
      active,
      required,
      multiple,
      disabled,
      invalid,
      status,
      hasInput,
      message,
      attempt: root.attempt(name),
      shortcuts: shortcutMode,
      registerChoice(value, choiceDisabled) {
        if (!choices.some((other) => other.value === value)) choices.push({ value, disabled: choiceDisabled })
        if (choiceDisabled || keys.length === 0) return null
        let order = definedChoices
          ? definedChoices.filter((other) => !other.disabled).map((other) => other.value)
          : choices.filter((other) => !other.disabled).map((other) => other.value)
        let index = order.indexOf(value)
        return index >= 0 && index < keys.length ? keys[index] : null
      },
      choiceValues: () => (layout?.choices ?? definedChoices ?? choices).map((choice) => choice.value),
      hasChoices: () => (layout?.choices ?? definedChoices ?? choices).length > 0,
      descriptionId(own) {
        descriptions += 1
        return own ?? (descriptions === 1 ? `${base}-description` : `${base}-description-${descriptions}`)
      },
      errorId(own) {
        errors += 1
        return own ?? (errors === 1 ? `${base}-error` : `${base}-error-${errors}`)
      },
    })

    let running = root.running
    let describedBy =
      [...descriptionIds, ...(invalid ? errorIds : []), ariaDescribedBy].filter(Boolean).join(' ') || undefined
    let keyShortcuts =
      [
        ariaKeyShortcuts,
        running && active ? 'Meta+Enter Control+Enter' : undefined,
        running && active ? 'ArrowUp ArrowDown' : undefined,
        running && active && !first ? (root.rtl ? 'ArrowRight' : 'ArrowLeft') : undefined,
        running && active && !last && status !== 'unanswered' ? (root.rtl ? 'ArrowLeft' : 'ArrowRight') : undefined,
      ]
        .filter(Boolean)
        .join(' ') || undefined

    return (
      <fieldset
        data-slot="questionnaire-item"
        data-name={name}
        data-active={active ? '' : undefined}
        data-inactive={active ? undefined : ''}
        data-status={status}
        data-required={required ? '' : undefined}
        data-multiple={multiple ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        data-external-invalid={externallyInvalid && !disabled ? '' : undefined}
        tabIndex={-1}
        {...props}
        aria-describedby={describedBy}
        aria-invalid={invalid ? 'true' : undefined}
        aria-keyshortcuts={keyShortcuts}
        disabled={disabled}
        hidden={running && !active ? true : undefined}
        inert={running && !active ? true : undefined}
        mix={[itemRule, mix]}
      >
        {children}
      </fieldset>
    )
  }
}

const titleRule = css({
  padding: 0,
  fontSize: 'var(--text-base)',
  lineHeight: 'var(--text-base--line-height)',
  fontWeight: 600,
  textWrap: 'pretty',
  overflowWrap: 'anywhere',
  // A legend sits outside the fieldset's gaps, so it keeps its own space.
  marginBlockEnd: space(5),
  '&:has(~ [data-slot="questionnaire-description"])': { marginBlockEnd: space(1.5) },
})

/**
 * The question as the fieldset's legend, which names it. Make it the
 * item's first child. To put the question in a card's header instead, use
 * your own heading with an id, and name it in the item's aria-labelledby.
 */
export function QuestionnaireTitle(handle: Handle<Props<'legend'>>) {
  return () => {
    getItem(handle, 'QuestionnaireTitle')
    let { mix, ...props } = handle.props

    return <legend data-slot="questionnaire-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  ...smallText,
  margin: 0,
  color: 'var(--muted-foreground)',
  textWrap: 'pretty',
  overflowWrap: 'anywhere',
})

/** Help for the question. The item names it in its aria-describedby. */
export function QuestionnaireDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let item = getItem(handle, 'QuestionnaireDescription')
    let { id, mix, ...props } = handle.props

    return (
      <p data-slot="questionnaire-description" {...props} id={item.descriptionId(id)} mix={[descriptionRule, mix]} />
    )
  }
}

const choicesRule = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(3),
  minWidth: 0,
})

/** The answers of a question: its choices, and a freeform QuestionnaireInput after them. */
export function QuestionnaireChoices(handle: Handle<Props<'div'>>) {
  return () => {
    let item = getItem(handle, 'QuestionnaireChoices')
    let { mix, ...props } = handle.props

    return (
      <div
        data-slot="questionnaire-choices"
        data-shortcuts={item.shortcuts ?? undefined}
        {...props}
        mix={[choicesRule, mix]}
      />
    )
  }
}

const enabledChoice = ':not([data-disabled])'

const choiceRule = css(
  mergeStyles(
    {
      ...smallText,
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      gap: space(3),
      minWidth: 0,
      minHeight: space(11),
      paddingBlock: space(3.5),
      paddingInline: space(4),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 20%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      textAlign: 'start',
      cursor: 'pointer',
      userSelect: 'none',
      [`&:hover${enabledChoice}`]: { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
      // The checked input, not data-checked, so a choice made before the script runs shows too.
      '&:has(> span > input:checked)': {
        borderColor: 'color-mix(in oklab, var(--primary) 40%, transparent)',
        backgroundColor: 'var(--muted)',
      },
      '&[data-invalid]': { borderColor: 'var(--destructive)' },
      '&:has(> span > input:focus-visible)': { borderColor: 'var(--ring)' },
      '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
      '@media (forced-colors: active)': {
        borderColor: 'CanvasText',
        '&:has(> span > input:checked)': { borderColor: 'Highlight', borderWidth: '2px' },
      },
    },
    focusRing('&:has(> span > input:focus-visible)'),
    transition('background-color', 'border-color'),
  ),
)

const controlRule = css({
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  flexShrink: 0,
  // Lines up with the first line of the label.
  marginBlockStart: 'calc((var(--text-sm--line-height) * 1em - 1rem) / 2)',
})

const choiceInputRule = css(
  mergeStyles(
    {
      gridArea: '1 / 1',
      appearance: 'none',
      width: '1rem',
      height: '1rem',
      margin: 0,
      border: '1px solid var(--input)',
      borderRadius: '4px',
      backgroundColor: 'light-dark(var(--background), color-mix(in oklab, var(--input) 30%, transparent))',
      cursor: 'inherit',
      '&[type="radio"]': { borderRadius: '9999px' },
      '&:checked': { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' },
      '&[aria-invalid="true"]': { borderColor: 'var(--destructive)' },
      // The row draws the ring.
      '&:focus-visible': { outline: 'none' },
      // Forced colors draw the system's own radio and checkbox.
      '@media (forced-colors: active)': { appearance: 'auto' },
    },
    transition('background-color', 'border-color'),
  ),
)

const indicatorRule = css({
  gridArea: '1 / 1',
  display: 'none',
  pointerEvents: 'none',
  color: 'var(--primary-foreground)',
  ':where(input:checked) ~ &': { display: 'flex' },
  ':where(input[type="radio"]) ~ &': {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--primary-foreground)',
  },
  '& svg': { width: '0.875rem', height: '0.875rem' },
  '@media (forced-colors: active)': { ':where(input) ~ &': { display: 'none' } },
})

const choiceLabelRule = css({
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  gap: space(1),
  minWidth: 0,
  lineHeight: 1.375,
  overflowWrap: 'anywhere',
})

const shortcutRule = css({
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  width: space(5),
  height: space(5),
  marginInlineStart: 'auto',
  marginBlockStart: 'calc((var(--text-sm--line-height) * 1em - 1.25rem) / 2)',
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--background)',
  color: 'var(--muted-foreground)',
  boxShadow: 'var(--shadow-xs)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.625rem',
  fontWeight: 500,
  lineHeight: 1,
  // A key does nothing until the script runs, and nothing without one.
  ':where([data-slot="questionnaire"]:not([data-running])) &': { visibility: 'hidden' },
  [unscripted]: { display: 'none' },
})

export interface QuestionnaireChoiceProps extends Omit<Props<'label'>, 'for' | 'htmlFor'> {
  /** The answer this choice submits. */
  value: string
  /** Keeps the choice from being picked. */
  disabled?: boolean
}

/**
 * One fixed answer: a label around a native radio, or a checkbox in a
 * multiple question, with its key when shortcuts are on. Put the answer's
 * text inside, and a QuestionnaireChoiceDescription for more.
 */
export function QuestionnaireChoice(handle: Handle<QuestionnaireChoiceProps>) {
  return () => {
    let root = getRoot(handle, 'QuestionnaireChoice')
    let item = getItem(handle, 'QuestionnaireChoice')
    let { value, disabled: ownDisabled = false, children, mix, ...props } = handle.props
    let disabled = item.disabled || ownDisabled
    let shortcut = item.registerChoice(value, ownDisabled)
    let answer = root.answer(item.name)
    let values = answer === null || answer === undefined ? [] : typeof answer === 'string' ? [answer] : answer
    let checked = values.includes(value)
    let initial = root.initialAnswer(item.name)
    let initialValues =
      initial === null || initial === undefined ? [] : typeof initial === 'string' ? [initial] : initial
    let type: 'checkbox' | 'radio' = item.multiple ? 'checkbox' : 'radio'
    let running = root.running

    return (
      <label
        data-slot="questionnaire-choice"
        data-type={type}
        data-checked={checked ? '' : undefined}
        data-unchecked={checked ? undefined : ''}
        data-disabled={disabled ? '' : undefined}
        data-invalid={item.invalid ? '' : undefined}
        data-shortcut={shortcut ?? undefined}
        {...props}
        mix={[choiceRule, mix]}
      >
        <span data-slot="questionnaire-choice-control" mix={controlRule}>
          <input
            type={type}
            data-slot="questionnaire-choice-input"
            data-shortcut={shortcut ?? undefined}
            data-disabled={ownDisabled ? '' : undefined}
            // A skipped question sends nothing.
            name={running && answer === null ? undefined : item.name}
            value={value}
            defaultChecked={initialValues.includes(value)}
            disabled={disabled}
            required={item.required && !item.multiple && item.hasInput === false ? true : undefined}
            aria-invalid={item.invalid ? 'true' : undefined}
            aria-keyshortcuts={
              running
                ? [shortcut, checked && !disabled ? 'Enter' : null].filter(Boolean).join(' ') || undefined
                : undefined
            }
            mix={[
              choiceInputRule,
              on('change', (event) => {
                let input = event.currentTarget as HTMLInputElement
                if (root.running) root.choose(item.name, value, input.checked)
              }),
            ]}
          />
          <span data-slot="questionnaire-choice-indicator" aria-hidden="true" mix={indicatorRule}>
            {item.multiple ? <CheckIcon /> : null}
          </span>
        </span>
        <span data-slot="questionnaire-choice-label" mix={choiceLabelRule}>
          {children}
        </span>
        {shortcut ? (
          <span data-slot="questionnaire-choice-shortcut" aria-hidden="true" mix={shortcutRule}>
            {shortcut}
          </span>
        ) : null}
      </label>
    )
  }
}

const choiceDescriptionRule = css({ color: 'var(--muted-foreground)' })

/** More about a choice, below its text. */
export function QuestionnaireChoiceDescription(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="questionnaire-choice-description" {...props} mix={[choiceDescriptionRule, mix]} />
  }
}

const inputWrapperRule = css({ position: 'relative', width: '100%', minWidth: 0 })

export type QuestionnaireInputType =
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'month'
  | 'number'
  | 'password'
  | 'search'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'

export interface QuestionnaireInputProps extends Omit<
  InputProps,
  'type' | 'name' | 'form' | 'value' | 'defaultValue' | 'list'
> {
  /** A text-entry type. Without one, text. */
  type?: QuestionnaireInputType
}

/**
 * A freeform answer: a native input that submits under the question's name
 * while it holds the answer. In a single-answer question, typing replaces
 * the chosen choice. Name it with a label, aria-label or aria-labelledby: a
 * placeholder isn't a name.
 */
export function QuestionnaireInput(handle: Handle<QuestionnaireInputProps>) {
  return () => {
    let root = getRoot(handle, 'QuestionnaireInput')
    let item = getItem(handle, 'QuestionnaireInput')
    let { type = 'text', disabled: ownDisabled = false, mix, ...props } = handle.props
    let disabled = item.disabled || ownDisabled
    let choices = item.choiceValues()
    let answered = filled(textOf(root.answer(item.name), choices))
    let initialText = textOf(root.initialAnswer(item.name), choices)
    let running = root.running

    return (
      <div data-slot="questionnaire-input-wrapper" mix={inputWrapperRule}>
        <Input
          {...props}
          type={type}
          data-slot="questionnaire-input"
          data-filled={answered ? '' : undefined}
          data-empty={answered ? undefined : ''}
          data-disabled={disabled ? '' : undefined}
          data-invalid={item.invalid ? '' : undefined}
          // Only the text that is the answer submits.
          name={running && !answered ? undefined : item.name}
          defaultValue={initialText}
          disabled={disabled}
          required={item.required && !item.hasChoices() ? true : undefined}
          aria-invalid={item.invalid ? 'true' : undefined}
          aria-keyshortcuts={running && answered && !disabled ? 'Enter' : undefined}
          mix={[
            mix,
            on('input', (event) => {
              let input = event.currentTarget as HTMLInputElement
              if (root.running) root.write(item.name, input.value)
            }),
          ]}
        />
      </div>
    )
  }
}

const errorRule = css({
  ...smallText,
  display: 'flex',
  alignItems: 'flex-start',
  gap: space(1.5),
  margin: 0,
  color: 'var(--destructive)',
  overflowWrap: 'anywhere',
})

/**
 * Why the question can't go on yet, with role="alert" once it shows. It
 * stays hidden until the question fails a check. Children replace the
 * message. Outside a QuestionnaireItem, it shows a submit that failed.
 */
export function QuestionnaireError(handle: Handle<Omit<Props<'p'>, 'role'>>) {
  return () => {
    let root = getRoot(handle, 'QuestionnaireError')
    let item = handle.context.get(QuestionnaireItem) as ItemContext | undefined
    let { id, children, mix, ...props } = handle.props
    let message = item
      ? (item.message ?? (item.required ? defaultMessages.required : defaultMessages.optional))
      : root.formError
    let invalid = item ? item.invalid : root.formError !== null
    let attempt = item ? item.attempt : root.formErrorAttempt

    return (
      <p
        data-slot="questionnaire-error"
        data-scope={item ? 'item' : 'questionnaire'}
        data-invalid={invalid ? '' : undefined}
        {...props}
        id={item ? item.errorId(typeof id === 'string' ? id : undefined) : (id ?? `${root.id}-error`)}
        role={invalid ? 'alert' : undefined}
        hidden={!invalid}
        mix={[errorRule, mix]}
      >
        {invalid ? (
          // A new key each time, so a repeated message is announced again.
          <span key={attempt} data-slot="questionnaire-error-message" mix={errorMessageRule}>
            <CircleAlertIcon />
            <span>{children ?? message}</span>
          </span>
        ) : null}
      </p>
    )
  }
}

const errorMessageRule = css({
  display: 'contents',
  '& > svg': { flexShrink: 0, width: '1rem', height: '1rem', marginBlockStart: '0.125rem' },
})

const actionsRule = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space(2),
  width: '100%',
  minWidth: 0,
  minHeight: space(9),
})

/** Lays out the navigation: Previous at the start, then Skip, and Next or Submit at the end. */
export function QuestionnaireActions(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="questionnaire-actions" {...props} mix={[actionsRule, mix]} />
  }
}

export interface QuestionnaireActionProps extends Omit<Props<'button'>, 'type' | 'value'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows instead of the label while its check or submit runs, such as "Saving…". */
  pendingLabel?: RemixNode
}

type ActionKind = 'previous' | 'skip' | 'next' | 'submit'

const actionRule = css({
  // Easy to tap on a narrow screen.
  '@media (max-width: 40rem)': { minHeight: space(11) },
  '&[data-kind="previous"]': { marginInlineEnd: 'auto' },
  // Button's own display comes from another rule, so these must win over it.
  [scripted]: { '&[data-hidden]': { display: 'none !important' } },
  // Without a script, the browser submits every question at once.
  [unscripted]: { '&:not([data-kind="submit"])': { display: 'none !important' } },
})

function NavigationAction(kind: ActionKind, label: string, defaultVariant: ButtonVariant) {
  return function Action(handle: Handle<QuestionnaireActionProps>) {
    return () => {
      let root = getRoot(handle, `Questionnaire${label}`)
      let { variant = defaultVariant, size, pendingLabel, disabled = false, children, mix, ...props } = handle.props
      let { total, first, last } = root.progress()
      let active = root.activeItem()
      let status = active ? questionnaireAnswerStatus(root.answer(active.name)) : null
      let visible =
        kind === 'previous'
          ? total > 1 && !first
          : kind === 'next'
            ? total > 1 && !last
            : kind === 'skip'
              ? active !== null && !active.required
              : total > 0 && last
      let running = root.running
      // Navigation needs the script. Submit works without it.
      let needsScript = kind !== 'submit' && !running
      let pending = root.pending
      let ownPending = (kind === 'next' && pending === 'next') || (kind === 'submit' && pending === 'submit')
      let shortcut = (kind === 'next' || kind === 'submit') && visible && !disabled && running ? 'Enter' : undefined

      return (
        <Button
          variant={variant}
          size={size}
          data-slot={`questionnaire-${kind}`}
          data-kind={kind}
          data-visible={visible ? '' : undefined}
          data-hidden={visible ? undefined : ''}
          data-status={status ?? undefined}
          data-pending={ownPending ? '' : undefined}
          data-shortcut={shortcut}
          {...props}
          type={kind === 'submit' ? 'submit' : 'button'}
          disabled={disabled || needsScript}
          aria-disabled={pending && running ? 'true' : props['aria-disabled']}
          aria-keyshortcuts={shortcut}
          hidden={running && !visible ? true : undefined}
          inert={running && !visible ? true : undefined}
          mix={[
            actionRule,
            mix,
            on('click', (event) => {
              if (event.defaultPrevented || !root.running) return
              if (root.pending) {
                event.preventDefault()
                return
              }
              if (kind === 'previous') root.goPrevious()
              else if (kind === 'next') root.goNext()
              else if (kind === 'skip') root.skip()
            }),
          ]}
        >
          {ownPending ? <Spinner decorative data-icon="inline-start" /> : null}
          {ownPending && pendingLabel !== undefined ? pendingLabel : (children ?? label)}
        </Button>
      )
    }
  }
}

/** Goes back one question, keeping every answer. It shows from the second question on. */
export const QuestionnairePrevious = NavigationAction('previous', 'Previous', 'outline')
/** Records an optional question as skipped and moves on, or submits on the last. It shows only for optional questions. */
export const QuestionnaireSkip = NavigationAction('skip', 'Skip', 'outline')
/** Checks the current question and moves on. It shows until the last question. */
export const QuestionnaireNext = NavigationAction('next', 'Next', 'default')
/** A native submit button. It shows on the last question, and checks every question first. */
export const QuestionnaireSubmit = NavigationAction('submit', 'Submit', 'default')
