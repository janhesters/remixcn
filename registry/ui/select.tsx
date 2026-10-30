// RemixCN Select: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixElement, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, Side } from '#remixcn/lib/anchor-position.ts'
import { ariaStates } from '#remixcn/lib/aria.ts'
import {
  activeDescendant,
  createTypeahead,
  ensureId,
  findTypeaheadMatch,
  isFocusableItem,
} from '#remixcn/lib/composite.ts'
import { getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import { CheckIcon, ChevronDownIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { modal as modalMixin } from '#remixcn/lib/modal.ts'
import { buttonGroupItem, fieldItem, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A select: a button that shows the chosen value and opens a list of items,
// as Base UI draws it for shadcn/ui, without Base UI.
//
// The form value lives in a native <select>, which the server renders with
// every item as an option and the chosen ones selected. Until the browser
// runs the select, and on a page without JavaScript, that native select is the
// control: the trigger waits hidden. Once the select runs, inside your client
// entry, the trigger shows and the native select hides, keeps its name and
// still submits the value, so the form gets one value from one control. The
// browser's own validation, reset and autofill keep working on it.
//
// The trigger is a select-only combobox, as the WAI-ARIA Authoring Practices
// describe it: focus stays on it, and the arrow keys, Home, End and typing
// move a highlight through the open list with aria-activedescendant
// (composite.ts). The list is a native popover in the top layer, placed with
// the chosen item over the trigger, or beside it (anchor-position.ts).
// Escape and a press outside close it (layer.ts), and a modal select keeps
// the rest of the page still while it's open (modal.ts).
//
// The parts register their items with the Select root while they render, so
// the native select, which renders after them, knows every item, also on the
// server and through components of yours.

export type SelectSize = 'sm' | 'default'

/** What changed the value. */
export type SelectValueChangeReason =
  /** A click on an item, or Enter or Space on the highlighted one. */
  | 'item-press'
  /** Typing on the closed trigger. */
  | 'list-navigation'
  /** The native select changed by itself: a choice before the script ran, the browser's form restore or autofill. */
  | 'native-change'
  /** A form reset. */
  | 'reset'

/** What opened or closed the list, as Base UI names it. */
export type SelectOpenChangeReason =
  | 'trigger-press'
  | 'item-press'
  | 'escape-key'
  | 'outside-press'
  | 'focus-out'
  | 'list-navigation'
  | 'parent-dismissed'
  | 'disabled'
  | 'trigger-removed'

interface ChangeDetails<Reason> {
  reason: Reason
  /** The event that asked for the change, if any. */
  event?: Event
  /** Keeps the current state. */
  cancel(): void
  readonly isCanceled: boolean
}

export type SelectValueChangeDetails = ChangeDetails<SelectValueChangeReason>
export type SelectOpenChangeDetails = ChangeDetails<SelectOpenChangeReason>

function createDetails<Reason>(reason: Reason, event?: Event): ChangeDetails<Reason> {
  let canceled = false
  return {
    reason,
    event,
    cancel() {
      canceled = true
    },
    get isCanceled() {
      return canceled
    },
  }
}

export interface SelectItemData {
  readonly value: string | null
  readonly label: RemixNode
}

/**
 * The labels SelectValue shows for values, as Base UI's `items`: a map from
 * value to label, a list of `{ value, label }`, or groups with such a list in
 * `items`. The items you render still make the list.
 */
export type SelectItems =
  | Readonly<Record<string, RemixNode>>
  | ReadonlyArray<SelectItemData | { readonly items: ReadonlyArray<SelectItemData> }>

interface SelectBaseProps {
  /** Names the value in the form, on the native select. */
  name?: string
  /** The id of the form the value belongs to, when the select sits outside it. */
  form?: string
  /** The autofill hint, such as `'country'`. */
  autocomplete?: string
  /** Whether a form needs a choice before it submits. */
  required?: boolean
  /** Whether the select ignores the user and leaves the form. */
  disabled?: boolean
  /** Whether the list opens without letting the user choose another value. */
  readOnly?: boolean
  /** Whether the list is open, for a select you control. Render the new state from onOpenChange. */
  open?: boolean
  /** Whether the list opens once the select runs. */
  defaultOpen?: boolean
  /** Called before the list opens or closes. Call `details.cancel()` to keep the current state. */
  onOpenChange?: (open: boolean, details: SelectOpenChangeDetails) => void
  /** Whether the rest of the page stays still while the list is open: no scrolling and no presses (defaults to `true`). */
  modal?: boolean
  /** Whether the pointer moves the highlight (defaults to `true`). */
  highlightItemOnHover?: boolean
  /** Labels for SelectValue, for values whose item hasn't rendered yet. */
  items?: SelectItems
  children?: RemixNode
}

export interface SelectSingleProps<Value extends string = string> extends SelectBaseProps {
  multiple?: false
  /** The chosen value, for a select you control, or `null` for none. Render the new value from onValueChange. */
  value?: Value | null
  /** The value chosen at first, for a select that keeps its own. A form reset returns to it. */
  defaultValue?: Value | null
  /** Called before the value changes. Call `details.cancel()` to keep the current value. */
  onValueChange?: (value: Value | null, details: SelectValueChangeDetails) => void
}

export interface SelectMultipleProps<Value extends string = string> extends SelectBaseProps {
  /** Lets the user choose several items. The list stays open while they do. */
  multiple: true
  /** The chosen values, for a select you control. */
  value?: readonly Value[]
  /** The values chosen at first. */
  defaultValue?: readonly Value[]
  /** Called before the values change, with every chosen value in the items' order. */
  onValueChange?: (value: Value[], details: SelectValueChangeDetails) => void
}

export type SelectProps<Value extends string = string> = SelectSingleProps<Value> | SelectMultipleProps<Value>

type OpenedBy = 'mouse' | 'touch' | 'keyboard' | 'none'
type FirstHighlight = 'selected' | 'selected-only' | 'first' | 'last'

interface GroupRecord {
  readonly id: string
  labelId: string
  label: string
  hasLabel: boolean
  disabled: boolean
}

interface ItemRecord {
  readonly id: string
  /** `''` for the item without a value. */
  value: string
  label: string
  content: RemixNode
  disabled: boolean
  group: GroupRecord | null
  element: HTMLElement | null
  /** Its place in the latest render, which is the order of the document. */
  position: number
}

type ItemData = Pick<ItemRecord, 'value' | 'label' | 'content' | 'disabled' | 'group'>

interface ContentOptions {
  alignItemWithTrigger: boolean
}

/** The id and ARIA props of the trigger, which the native select carries until the select runs. */
type ControlProps = Partial<
  Pick<
    Props<'button'>,
    | 'id'
    | 'aria-label'
    | 'aria-labelledby'
    | 'aria-describedby'
    | 'aria-invalid'
    | 'aria-errormessage'
    | 'aria-details'
    | 'aria-description'
  >
>

const controlPropNames = [
  'id',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-invalid',
  'aria-errormessage',
  'aria-details',
  'aria-description',
] as const

/** The root's props the native select takes. */
type FormProps = Pick<SelectBaseProps, 'name' | 'form' | 'autocomplete' | 'required' | 'disabled' | 'readOnly'> & {
  multiple?: boolean
}

interface SelectInternals {
  readonly ids: { readonly list: string; readonly trigger: string; readonly native: string }
  readonly formProps: FormProps
  readonly running: boolean
  readonly open: boolean
  readonly multiple: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly modal: boolean
  readonly highlightOnHover: boolean
  readonly values: readonly string[]
  /** The values a form reset returns to: defaultValue, or the value the page loaded with when controlled. */
  readonly defaults: readonly string[]
  /** Counts the root's renders, so a part can tell an update of its own from one with the root. */
  readonly pass: number
  /** Renders the root again, after a part changed through an update of its own. */
  refresh(): void
  /** Renders the root again if a part registered or changed since the root last rendered. */
  flush(): void
  readonly highlightedId: string | null
  readonly placement: 'item' | 'side'
  readonly openedBy: OpenedBy
  /** Whether the native select failed validation and still has no valid value. */
  readonly invalid: boolean
  /** Labels that name the list, found on the trigger when it opened. */
  readonly listLabelledBy: string | undefined
  trigger: HTMLElement | null
  list: HTMLElement | null
  /** What the trigger and value rendered in this pass, for the native select that renders after them. */
  control: ControlProps
  size: SelectSize
  placeholder: RemixNode
  contentOptions: ContentOptions
  register(record: ItemRecord, data: ItemData): void
  unregister(record: ItemRecord): void
  /** Marks a change to a record or group outside a render, such as a label read from the page. */
  changed(): void
  /** The items in document order. */
  records(): ItemRecord[]
  isSelected(value: string): boolean
  /** What SelectValue shows for a value. */
  contentFor(value: string): RemixNode
  /** The text of a value, for the native option. */
  textFor(value: string): string
  /** The null item's content, the placeholder a value-less item gives. */
  nullContent(): RemixNode | undefined
  setOpen(
    open: boolean,
    reason: SelectOpenChangeReason,
    event?: Event,
    how?: { by?: OpenedBy; highlight?: FirstHighlight },
  ): void
  choose(record: ItemRecord, event: Event): void
  /** Chooses the item a typed query matches, on the closed trigger. */
  typeOnTrigger(event: KeyboardEvent): boolean
  highlight(record: ItemRecord | null, options?: { reveal?: boolean }): void
  /** Moves the highlight to an item element, from the keyboard. */
  highlightElement(element: HTMLElement): void
  /** The item elements the keyboard moves through while the list is open. */
  navigable(): HTMLElement[]
  /** The item the list lines up with the trigger. */
  alignItem(): HTMLElement | null
  /** Places the list beside the trigger after lining up the item didn't fit. */
  fallBack(): void
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachNative(element: HTMLSelectElement, signal: AbortSignal): void
  /** Moves focus from the native select to the trigger, and puts the select over it for the browser's message. */
  redirectFocus(): void
  reportInvalid(): void
  readNativeChange(event: Event): void
  /** Scrolls the highlighted item into view once the list shows. */
  revealHighlighted(): void
}

const onServer = typeof document === 'undefined'

function useSelect(handle: Handle<any, any>, part: string): SelectInternals {
  let api = handle.context.get(Select) as SelectInternals | undefined
  if (!api) throw new Error(`${part} must sit inside Select`)
  return api
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/**
 * The text of a node, as far as it shows before rendering: strings, numbers,
 * host elements and fragments. A component's text is unknown, so it adds
 * nothing, and `complete` turns false.
 */
function readText(node: unknown): { text: string; complete: boolean } {
  if (node === null || node === undefined || typeof node === 'boolean') return { text: '', complete: true }
  if (typeof node === 'string' || typeof node === 'number') return { text: String(node), complete: true }
  if (Array.isArray(node)) {
    let parts = node.map(readText)
    return { text: parts.map((part) => part.text).join(''), complete: parts.every((part) => part.complete) }
  }
  if (isElement(node) && (typeof node.type === 'string' || node.type === Fragment)) return readText(node.props.children)
  return { text: '', complete: false }
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Every element of `type` among `node`, through host elements, fragments and the components in `through`. */
function findAll<P>(node: unknown, type: unknown, through: readonly unknown[], found: P[] = []): P[] {
  if (Array.isArray(node)) {
    for (let child of node) findAll(child, type, through, found)
  } else if (isElement(node)) {
    if (node.type === type) found.push(node.props as P)
    else if (typeof node.type === 'string' || node.type === Fragment || through.includes(node.type)) {
      findAll(node.props.children, type, through, found)
    }
  }
  return found
}

function toValues(value: string | null | undefined | readonly string[]): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return value === '' ? [] : [value]
  return [...new Set(value.filter((entry) => entry !== ''))]
}

function sameValues(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function itemLabels(items: SelectItems | undefined): Map<string, RemixNode> {
  let labels = new Map<string, RemixNode>()
  if (!items) return labels
  if (!Array.isArray(items)) {
    for (let [value, label] of Object.entries(items)) labels.set(value, label)
    return labels
  }
  for (let entry of items as ReadonlyArray<SelectItemData | { items: ReadonlyArray<SelectItemData> }>) {
    let list = 'items' in entry ? entry.items : [entry]
    for (let item of list) labels.set(item.value ?? '', item.label)
  }
  return labels
}

/**
 * Groups the parts of a select and holds its value and whether its list is
 * open. It renders no element of its own, only the native select that holds
 * the form value, after your parts.
 */
export function Select<Value extends string = string>(handle: Handle<SelectProps<Value>, SelectInternals>) {
  let records = new Set<ItemRecord>()
  // Counts changes to the items, so the root knows when a render missed one.
  let version = 0
  let renderedVersion = -1
  let position = 0
  let running = false
  let uncontrolledValues = toValues(handle.props.defaultValue)
  // A controlled select's options carry the value the page loaded with as their defaults.
  let initialValues = toValues((handle.props.value ?? handle.props.defaultValue) as string | readonly string[] | null)
  let pass = 0
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let wasOpen = false
  let openedBy: OpenedBy = 'none'
  let firstHighlight: FirstHighlight = 'selected'
  let placement: 'item' | 'side' = 'side'
  let highlightedId: string | null = null
  let listLabelledBy: string | undefined
  let invalid = false
  let pendingReveal = false
  let typeahead = createTypeahead()
  let native: HTMLSelectElement | null = null
  let form: HTMLFormElement | null = null
  let formController: AbortController | null = null
  let dispatching = false
  handle.signal.addEventListener('abort', () => {
    typeahead.reset()
    formController?.abort()
  })

  let ids = { list: `${handle.id}-list`, trigger: `${handle.id}-trigger`, native: `${handle.id}-native` }

  function isControlled() {
    return handle.props.value !== undefined
  }

  function currentValues(): string[] {
    let { value } = handle.props
    return value === undefined ? uncontrolledValues : toValues(value as string | readonly string[] | null)
  }

  function isDisabled() {
    return Boolean(handle.props.disabled)
  }

  function isOpen() {
    return running && !isDisabled() && (handle.props.open ?? uncontrolledOpen)
  }

  function sortedRecords() {
    return [...records].sort((a, b) => a.position - b.position)
  }

  function findRecord(value: string) {
    for (let record of sortedRecords()) if (record.value === value) return record
    return undefined
  }

  function scannedItems() {
    let { children } = handle.props
    return findAll<SelectItemProps>(children, SelectItem, [SelectContent, SelectGroup])
  }

  function contentFor(value: string): RemixNode {
    let record = findRecord(value)
    if (record) return record.content
    let labels = itemLabels(handle.props.items)
    if (labels.has(value)) return labels.get(value)
    let scanned = scannedItems().find((item) => (item.value ?? '') === value)
    if (scanned) return scanned.children
    return value
  }

  function textFor(value: string): string {
    let record = findRecord(value)
    if (record?.label) return record.label
    let labels = itemLabels(handle.props.items)
    let fromItems = labels.has(value) ? collapse(readText(labels.get(value)).text) : ''
    return fromItems || value
  }

  /** The values the native select shows: the selected options, without the placeholder. */
  function readNative(): string[] {
    if (!native) return currentValues()
    return toValues([...native.selectedOptions].map((option) => option.value))
  }

  function writeNative(values: readonly string[]) {
    if (!native) return
    let multiple = native.multiple
    let placeholderTaken = false
    for (let option of native.options) {
      let wanted =
        option.value === '' ? !multiple && values.length === 0 && !placeholderTaken : values.includes(option.value)
      if (option.value === '' && wanted) placeholderTaken = true
      if (option.selected !== wanted) option.selected = wanted
    }
  }

  /** Brings the native select in line with the value, and its defaults with defaultValue, after a render. */
  function syncNative() {
    if (!native) return
    if (!isControlled()) {
      let defaults = toValues(handle.props.defaultValue as string | readonly string[] | null | undefined)
      let multiple = native.multiple
      let placeholderTaken = false
      for (let option of native.options) {
        let wanted =
          option.value === ''
            ? !multiple && defaults.length === 0 && !placeholderTaken
            : defaults.includes(option.value)
        if (option.value === '' && wanted) placeholderTaken = true
        if (option.defaultSelected !== wanted) option.defaultSelected = wanted
      }
    }
    // A new default can move the choice of an option the user never touched, so the choice comes last.
    writeNative(currentValues())
  }

  function syncForm() {
    let next = native?.form ?? null
    if (next === form) return
    formController?.abort()
    form = next
    formController = null
    if (!form) return
    formController = new AbortController()
    form.addEventListener(
      'reset',
      (event) => {
        // The form resets its controls after the reset event.
        setTimeout(() => {
          if (handle.signal.aborted || !native) return
          invalid = false
          commit(readNative(), 'reset', event, false)
          void handle.update()
        })
      },
      { signal: formController.signal },
    )
  }

  function commit(next: string[], reason: SelectValueChangeReason, event: Event | undefined, dispatch: boolean) {
    if (sameValues(next, currentValues())) return false
    let details = createDetails(reason, event)
    let multiple = Boolean(handle.props.multiple)
    let onValueChange = handle.props.onValueChange as
      ((value: unknown, details: SelectValueChangeDetails) => void) | undefined
    onValueChange?.(multiple ? [...next] : (next[0] ?? null), details)
    if (details.isCanceled) {
      void handle.update()
      return false
    }
    if (!isControlled()) uncontrolledValues = next
    if (dispatch && native) {
      // As a native select: the form already holds the new value when input and change fire.
      writeNative(next)
      dispatching = true
      try {
        native.dispatchEvent(new Event('input', { bubbles: true }))
        native.dispatchEvent(new Event('change', { bubbles: true }))
      } finally {
        dispatching = false
      }
    }
    if (invalid && native?.checkValidity()) invalid = false
    void handle.update()
    return true
  }

  function firstEnabled(from: ItemRecord[]) {
    return from.find((record) => !record.disabled) ?? null
  }

  function initialHighlight(mode: FirstHighlight): string | null {
    // The list may not show yet, so only the items' own state counts.
    let list = sortedRecords()
    let values = currentValues()
    let selected = list.find(
      (record) =>
        !record.disabled &&
        (record.value === '' ? values.length === 0 && !handle.props.multiple : values.includes(record.value)),
    )
    if (mode === 'first') return firstEnabled(list)?.id ?? null
    if (mode === 'last') return firstEnabled([...list].reverse())?.id ?? null
    if (mode === 'selected-only') return selected?.id ?? null
    return (selected ?? firstEnabled(list))?.id ?? null
  }

  function start() {
    running = true
    // The native select hides now: focus on it moves on to the trigger.
    let focused = native !== null && native.ownerDocument.activeElement === native
    if (focused) {
      void handle.update().then(() => {
        if (native?.ownerDocument.activeElement === native) api.trigger?.focus({ preventScroll: true })
      })
    }
    // In server HTML, a choice the user made before the script ran, or that the browser restored, wins.
    let served = native?.hasAttribute('data-served')
    native?.removeAttribute('data-served')
    if (served && native && [...native.options].some((option) => option.selected !== option.defaultSelected)) {
      commit(readNative(), 'native-change', undefined, false)
    }
    void handle.update()
  }

  let api: SelectInternals = {
    ids,
    get formProps() {
      let { name, form, autocomplete, required, disabled, readOnly, multiple } = handle.props
      return { name, form, autocomplete, required, disabled, readOnly, multiple }
    },
    get running() {
      return running
    },
    get open() {
      return isOpen()
    },
    get multiple() {
      return Boolean(handle.props.multiple)
    },
    get disabled() {
      return isDisabled()
    },
    get readOnly() {
      return Boolean(handle.props.readOnly)
    },
    get required() {
      return Boolean(handle.props.required)
    },
    get modal() {
      return handle.props.modal ?? true
    },
    get highlightOnHover() {
      return handle.props.highlightItemOnHover ?? true
    },
    get values() {
      return currentValues()
    },
    get defaults() {
      return isControlled()
        ? initialValues
        : toValues(handle.props.defaultValue as string | readonly string[] | null | undefined)
    },
    get pass() {
      return pass
    },
    refresh() {
      if (running && !handle.signal.aborted) void handle.update()
    },
    flush() {
      if (version !== renderedVersion) api.refresh()
    },
    get highlightedId() {
      return highlightedId
    },
    get placement() {
      return placement
    },
    get openedBy() {
      return openedBy
    },
    get invalid() {
      return invalid
    },
    get listLabelledBy() {
      return listLabelledBy
    },
    trigger: null,
    list: null,
    control: {},
    size: 'default',
    placeholder: undefined,
    contentOptions: { alignItemWithTrigger: true },
    register(record, data) {
      let known = records.has(record)
      record.position = position++
      let changed =
        !known ||
        record.value !== data.value ||
        record.label !== data.label ||
        record.disabled !== data.disabled ||
        record.group !== data.group
      Object.assign(record, data)
      if (!known) records.add(record)
      if (changed) version++
    },
    unregister(record) {
      if (!records.delete(record)) return
      version++
      // After the commit that removed it, which may have removed the select too.
      queueMicrotask(() => {
        if (!handle.signal.aborted && running) void handle.update()
      })
    },
    changed() {
      version++
      if (running && !handle.signal.aborted) void handle.update()
    },
    records: sortedRecords,
    isSelected(value) {
      let values = currentValues()
      return value === '' ? !handle.props.multiple && values.length === 0 : values.includes(value)
    },
    contentFor,
    textFor,
    nullContent() {
      let record = findRecord('')
      if (record) return record.content
      let labels = itemLabels(handle.props.items)
      if (labels.has('')) return labels.get('')
      return scannedItems().find((item) => item.value === null || item.value === '')?.children
    },
    setOpen(open, reason, event, how = {}) {
      if (!running || handle.signal.aborted) return
      if (open && isDisabled()) return
      if (open === isOpen()) return
      let details = createDetails(reason, event)
      handle.props.onOpenChange?.(open, details)
      if (details.isCanceled) return
      if (open) {
        openedBy = how.by ?? 'none'
        firstHighlight = how.highlight ?? 'selected'
      }
      if (handle.props.open === undefined) uncontrolledOpen = open
      // A press outside may have left focus nowhere; it belongs on the trigger.
      if (!open && reason === 'outside-press') {
        setTimeout(() => {
          let active = api.trigger?.ownerDocument.activeElement
          if (api.trigger?.isConnected && (!active || active === api.trigger.ownerDocument.body)) {
            api.trigger.focus({ preventScroll: true })
          }
        })
      }
      void handle.update()
    },
    choose(record, event) {
      if (record.disabled || !isOpen()) return
      if (!handle.props.readOnly) {
        let values = currentValues()
        let next: string[]
        if (record.value === '') next = []
        else if (handle.props.multiple) {
          let chosen = values.includes(record.value)
            ? values.filter((value) => value !== record.value)
            : [...values, record.value]
          // In the items' order, as the form submits them; values without an item stay first.
          let order = new Map(sortedRecords().map((entry, index) => [entry.value, index]))
          next = chosen.sort((a, b) => (order.get(a) ?? -1) - (order.get(b) ?? -1))
        } else next = [record.value]
        commit(next, 'item-press', event, true)
      }
      if (!handle.props.multiple || handle.props.readOnly) api.setOpen(false, 'item-press', event)
    },
    typeOnTrigger(event) {
      let query = typeahead.type(event)
      if (query === undefined) return false
      if (handle.props.readOnly) return true
      let list = sortedRecords().filter((record) => record.value !== '')
      let values = currentValues()
      let current = list.findIndex((record) => values.includes(record.value))
      let index = findTypeaheadMatch(
        list.map((record) => record.label),
        query,
        current,
        list.map((record) => record.disabled),
      )
      if (index === -1) return true
      let record = list[index]
      if (!handle.props.multiple) commit([record.value], 'list-navigation', event, true)
      return true
    },
    highlight(record, options = {}) {
      let id = record?.id ?? null
      if (id === highlightedId) return
      highlightedId = id
      if (options.reveal) pendingReveal = true
      void handle.update()
    },
    highlightElement(element) {
      let record = sortedRecords().find((entry) => entry.element === element)
      if (record) api.highlight(record, { reveal: true })
    },
    navigable() {
      if (!isOpen()) return []
      return sortedRecords()
        .map((record) => record.element)
        .filter((element): element is HTMLElement => element !== null && isFocusableItem(element))
    },
    alignItem() {
      let list = sortedRecords().filter((record) => record.element && isFocusableItem(record.element))
      let selected = list.find((record) => api.isSelected(record.value))
      let highlighted = list.find((record) => record.id === highlightedId)
      return (selected ?? highlighted ?? firstEnabled(list) ?? list[0])?.element ?? null
    },
    fallBack() {
      if (placement === 'side') return
      placement = 'side'
      pendingReveal = true
      void handle.update()
    },
    attachTrigger(element, signal) {
      api.trigger = element
      signal.addEventListener('abort', () => {
        if (api.trigger !== element) return
        api.trigger = null
        // A keyed trigger that is replaced comes back before this runs; one that is gone closes the list.
        queueMicrotask(() => {
          if (!api.trigger && isOpen()) api.setOpen(false, 'trigger-removed')
        })
      })
    },
    attachNative(element, signal) {
      native = element
      signal.addEventListener('abort', () => {
        if (native === element) native = null
      })
    },
    redirectFocus() {
      if (running) api.trigger?.focus({ preventScroll: true })
    },
    reportInvalid() {
      if (!running || !native || !api.trigger) return
      // The browser shows its message at the native select, and focuses it, which hands focus to
      // the trigger: so the message points at the trigger, the select goes over it first.
      let wrapper = native.parentElement
      if (wrapper) {
        let from = wrapper.getBoundingClientRect()
        let to = api.trigger.getBoundingClientRect()
        let style = getComputedStyle(wrapper)
        wrapper.style.left = `${(parseFloat(style.left) || 0) + to.left - from.left}px`
        wrapper.style.top = `${(parseFloat(style.top) || 0) + to.top - from.top}px`
        wrapper.style.width = `${to.width}px`
        wrapper.style.height = `${to.height}px`
      }
      if (!invalid) {
        invalid = true
        void handle.update()
      }
    },
    readNativeChange(event) {
      if (dispatching || !running) return
      commit(readNative(), 'native-change', event, false)
    },
    revealHighlighted() {
      if (!pendingReveal) return
      pendingReveal = false
      let list = api.list
      let item = sortedRecords().find((record) => record.id === highlightedId)?.element
      if (list && item) reveal(list, item)
    },
  }
  handle.context.set(api)

  return () => {
    let { children, disabled } = handle.props
    position = 0
    pass++
    renderedVersion = version
    api.control = {}
    api.placeholder = undefined

    // A select that turns off closes, and stays closed once it turns on again.
    if (disabled && handle.props.open === undefined) uncontrolledOpen = false
    let open = isOpen()
    if (open && !wasOpen) {
      placement = api.contentOptions.alignItemWithTrigger && openedBy !== 'touch' ? 'item' : 'side'
      highlightedId = initialHighlight(firstHighlight)
      pendingReveal = placement === 'side'
      let trigger = api.trigger
      let labels = trigger && 'labels' in trigger ? [...((trigger as HTMLButtonElement).labels ?? [])] : []
      listLabelledBy = labels.length > 0 ? labels.map((label) => ensureId(label)).join(' ') : undefined
    }
    if (!open) highlightedId = null
    else if (highlightedId && !sortedRecords().some((record) => record.id === highlightedId && !record.disabled)) {
      // The highlighted item went away or turned off.
      highlightedId = initialHighlight('selected')
    }
    wasOpen = open

    if (!onServer) {
      handle.queueTask(() => {
        if (!running) return start()
        // An item changed after the trigger rendered.
        if (version !== renderedVersion) return void handle.update()
        syncNative()
        syncForm()
      })
    }

    return (
      <>
        {children}
        <SelectNative />
      </>
    )
  }
}

/** Scrolls the list so the item shows, clear of the scroll buttons, without scrolling the page. */
function reveal(list: HTMLElement, item: HTMLElement) {
  let listRect = list.getBoundingClientRect()
  let itemRect = item.getBoundingClientRect()
  let margin = parseFloat(getComputedStyle(list.ownerDocument.documentElement).fontSize) * 1.5
  let top = itemRect.top - listRect.top + list.scrollTop
  let bottom = top + itemRect.height
  let max = list.scrollHeight - list.clientHeight
  if (top - margin < list.scrollTop) list.scrollTop = Math.max(0, top - margin)
  else if (bottom + margin > list.scrollTop + list.clientHeight) {
    list.scrollTop = Math.min(max, bottom + margin - list.clientHeight)
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const textSm = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }

const triggerRule = css(
  mergeStyles(
    {
      ...textSm,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space(1.5),
      boxSizing: 'border-box',
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      minHeight: space(9),
      margin: 0,
      paddingBlock: space(1),
      paddingInlineStart: space(2.5),
      paddingInlineEnd: space(2),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      color: 'inherit',
      fontFamily: 'inherit',
      textAlign: 'start',
      userSelect: 'none',
      '&[data-size="sm"]': { minHeight: space(8) },
      '&[data-placeholder]': { color: 'var(--muted-foreground)' },
      // shadcn's 50% tint drops the dark placeholder below 4.5:1; 40% keeps it.
      '&:hover:not(:disabled)': {
        backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 40%, transparent))',
      },
      '&:focus-visible': { borderColor: 'var(--ring)' },
      '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
      // Until the select runs, the native select is the control.
      '&[data-pending]': { display: 'none !important' },
      '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
    },
    transition('color', 'background-color', 'border-color', 'box-shadow'),
    invalidState,
    fieldItem,
    buttonGroupItem,
  ),
)

const iconRule = css({ display: 'flex', color: 'var(--muted-foreground)', pointerEvents: 'none' })

export interface SelectTriggerProps extends Omit<Props<'button'>, 'type' | 'role' | 'value'> {
  /** The height: 2.25rem by default, or 2rem. */
  size?: SelectSize
}

function pick(props: Record<string, unknown>, names: readonly string[]) {
  let picked: Record<string, unknown> = {}
  for (let name of names) if (props[name] !== undefined) picked[name] = props[name]
  return picked
}

/**
 * The button that shows the chosen value and opens the list: a select-only
 * combobox. Its id and ARIA props, such as aria-describedby, go to the native
 * select until the select runs, so a label's `for` names whichever control shows.
 */
export function SelectTrigger(handle: Handle<SelectTriggerProps>) {
  let api = useSelect(handle, 'SelectTrigger')
  // Whether a mouse press on the trigger already opened or closed the list, so its click doesn't again.
  let pressed = false
  let labelClick = false
  let touch = false

  function onPointerDown(event: PointerEvent) {
    let trigger = event.currentTarget as HTMLButtonElement
    touch = event.pointerType === 'touch'
    if (!api.running || trigger.disabled || event.button !== 0 || touch) return
    pressed = true
    // Safari doesn't focus a button it presses.
    trigger.focus({ preventScroll: true })
    // Keeps the press from selecting text.
    event.preventDefault()
    let wasOpen = api.open
    api.setOpen(!wasOpen, 'trigger-press', event, { by: 'mouse', highlight: 'selected-only' })
    if (wasOpen) return

    // Pressing on the trigger, moving to an item and letting go chooses it.
    let start = { time: performance.now(), x: event.clientX, y: event.clientY }
    let document = trigger.ownerDocument
    document.addEventListener(
      'pointerup',
      (up) => {
        setTimeout(() => (pressed = false))
        let target = up.target instanceof Element ? up.target.closest<HTMLElement>('[data-slot="select-item"]') : null
        let moved = Math.hypot(up.clientX - start.x, up.clientY - start.y) > 4
        if (!target || !api.list?.contains(target) || (!moved && performance.now() - start.time < 300)) return
        let record = api.records().find((entry) => entry.element === target)
        if (record) api.choose(record, up)
      },
      { once: true, capture: true },
    )
  }

  function onClick(event: MouseEvent) {
    let trigger = event.currentTarget as HTMLButtonElement
    if (pressed) {
      pressed = false
      return
    }
    // A click on a label focuses the select without opening it, as on a native select.
    if (labelClick) {
      labelClick = false
      trigger.focus()
      return
    }
    if (event.defaultPrevented || !api.running || trigger.disabled) return
    api.setOpen(!api.open, 'trigger-press', event, { by: touch ? 'touch' : 'none' })
    touch = false
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || !api.running || event.ctrlKey || event.metaKey || event.isComposing) return
    let { key } = event
    let space = key === ' '

    if (!api.open) {
      let highlight: FirstHighlight | undefined =
        key === 'Home' ? 'first' : key === 'End' ? 'last' : key === 'ArrowUp' ? 'selected' : undefined
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === 'Home' || key === 'End' || space) {
        // A space continues a typed query instead.
        if (space && api.typeOnTrigger(event)) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        if (event.altKey && key === 'ArrowUp') return
        api.setOpen(true, 'trigger-press', event, { by: 'keyboard', highlight: highlight ?? 'selected' })
        return
      }
      if (!event.altKey && api.typeOnTrigger(event)) event.preventDefault()
      return
    }

    let highlighted = api.records().find((record) => record.id === api.highlightedId)
    if ((event.altKey && key === 'ArrowUp') || key === 'Enter' || (space && !typing)) {
      event.preventDefault()
      if (highlighted) api.choose(highlighted, event)
      else if (!api.multiple) api.setOpen(false, 'list-navigation', event)
      return
    }
    // Tab closes the list without choosing, and moves on.
    if (key !== 'Tab') return
    if (!api.modal) return api.setOpen(false, 'focus-out', event)
    // The open list keeps the page inert, so the browser has nowhere to move focus: the select
    // moves it to the next stop, or the one before with Shift, once the page is back.
    event.preventDefault()
    let trigger = event.currentTarget as HTMLElement
    api.setOpen(false, 'focus-out', event)
    setTimeout(() => {
      if (api.open || trigger.ownerDocument.activeElement !== trigger) return
      let stops = getTabbableElements(trigger.closest('dialog:modal') ?? trigger.ownerDocument.body)
      let index = stops.indexOf(trigger)
      if (index !== -1) stops[index + (event.shiftKey ? -1 : 1)]?.focus()
    })
  }

  // Whether a typed query is still collecting on the open list, so a space belongs to it.
  let typing = false
  let typingTimer: ReturnType<typeof setTimeout> | undefined
  function onTyped(event: KeyboardEvent) {
    if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) return
    typing = true
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => (typing = false), 500)
  }
  handle.signal.addEventListener('abort', () => clearTimeout(typingTimer))

  function onFocusOut(event: FocusEvent) {
    let next = event.relatedTarget
    if (!api.open || !(next instanceof Node)) return
    if (api.trigger?.contains(next) || api.list?.closest('[data-slot="select-content"]')?.contains(next)) return
    let document = next.ownerDocument
    if (!document) return
    // Once the browser has moved focus.
    document.defaultView?.setTimeout(() => {
      let active = document.activeElement
      if (active && active !== api.trigger && api.open) api.setOpen(false, 'focus-out', event)
    })
  }

  return () => {
    let { size = 'default', disabled: ownDisabled, children, mix, ...props } = handle.props
    let control = pick(props as Record<string, unknown>, controlPropNames) as ControlProps
    let rest = { ...props } as Record<string, unknown>
    for (let name of controlPropNames) delete rest[name]
    api.control = control
    api.size = size
    let disabled = api.disabled || Boolean(ownDisabled)
    let open = api.open
    let running = api.running
    let placeholder = api.values.length === 0
    let invalid = control['aria-invalid'] ?? (api.invalid ? 'true' : undefined)

    return (
      <button
        {...rest}
        type="button"
        role="combobox"
        data-slot="select-trigger"
        data-size={size}
        {...(running ? ariaStates({ ...control, 'aria-invalid': invalid }) : {})}
        id={running ? (control.id ?? api.ids.trigger) : api.ids.trigger}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={api.ids.list}
        aria-activedescendant={open ? (api.highlightedId ?? undefined) : undefined}
        aria-required={api.required ? 'true' : undefined}
        aria-readonly={api.readOnly ? 'true' : undefined}
        disabled={disabled}
        data-pending={running ? undefined : ''}
        data-popup-open={open ? '' : undefined}
        data-placeholder={placeholder ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-required={api.required ? '' : undefined}
        data-readonly={api.readOnly ? '' : undefined}
        mix={[
          triggerRule,
          mix,
          ref((node, signal) => {
            api.attachTrigger(node as HTMLElement, signal)
            // A label of the trigger forwards its click; that click focuses the select without opening it.
            node.ownerDocument.addEventListener(
              'click',
              (event) => {
                let label = event.target instanceof Element ? event.target.closest('label') : null
                if (label && label.control === node && !node.contains(event.target as Node)) labelClick = true
              },
              { capture: true, signal },
            )
          }),
          on<HTMLButtonElement, 'pointerdown'>('pointerdown', onPointerDown),
          on<HTMLButtonElement, 'click'>('click', onClick),
          on<HTMLButtonElement, 'keydown'>('keydown', onTyped),
          on<HTMLButtonElement, 'keydown'>('keydown', onKeyDown),
          activeDescendant({
            items: () => api.navigable(),
            orientation: 'vertical',
            loop: false,
            homeAndEnd: true,
            highlight: (item) => api.highlightElement(item),
          }),
          on<HTMLButtonElement, 'focusout'>('focusout', onFocusOut),
        ]}
      >
        {children}
        <span data-slot="select-icon" aria-hidden="true" mix={iconRule}>
          <ChevronDownIcon />
        </span>
      </button>
    )
  }
}

const valueRule = css({
  display: 'flex',
  flex: '1 1 auto',
  alignItems: 'center',
  gap: space(1.5),
  minWidth: 0,
  // shadcn keeps the value on one line and cuts it off. Here it wraps once the trigger has no more
  // room, so a narrow screen with large text shows all of it.
  overflowWrap: 'break-word',
  textAlign: 'start',
})

export interface SelectValueProps extends Omit<Props<'span'>, 'children'> {
  /** What shows while nothing is chosen. An item without a value gives one too. */
  placeholder?: RemixNode
  /**
   * What shows in place of the chosen item's content: a node, or a function
   * of the value, `string | null`, or `string[]` in a multiple select.
   */
  children?: RemixNode | ((value: any) => RemixNode)
}

/** The chosen item's content, its value's label from `items`, or the placeholder. */
export function SelectValue(handle: Handle<SelectValueProps>) {
  return () => {
    let api = useSelect(handle, 'SelectValue')
    let { placeholder, children, mix, ...props } = handle.props
    api.placeholder = placeholder
    let values = api.values
    let empty = values.length === 0
    let content: RemixNode
    if (typeof children === 'function') content = children(api.multiple ? [...values] : (values[0] ?? null))
    else if (children !== undefined) content = children
    else if (empty) content = placeholder ?? api.nullContent()
    else if (!api.multiple) content = api.contentFor(values[0])
    else
      content = values.flatMap((value, index) =>
        index === 0 ? [api.contentFor(value)] : [', ', api.contentFor(value)],
      )

    return (
      <span data-slot="select-value" data-placeholder={empty ? '' : undefined} {...props} mix={[valueRule, mix]}>
        {content}
      </span>
    )
  }
}

// Shows the host in the top layer while open. The browser hides a closed popover.
const topLayer = createMixin<HTMLElement, [open: boolean]>(
  (handle) => (open) => {
    handle.queueTask((node) => {
      if (!node.isConnected || node.matches(':popover-open') === open) return
      if (open) node.showPopover()
      else node.hidePopover()
    })
    return handle.element
  },
  { ssr: false },
)

// Runs a task after the mixins before it, such as once the popover shows and is placed.
const afterMixins = createMixin<HTMLElement, [task: () => void]>(
  (handle) => (task) => {
    handle.queueTask(task)
    return handle.element
  },
  { ssr: false },
)

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface ItemAlignment {
  viewport: Rect
  padding: number
  trigger: Rect
  /** Where the value's text starts: its left edge, or its right edge in right-to-left text. */
  valueStart: number
  dir: 'ltr' | 'rtl'
  /** The list's size at full height. */
  width: number
  height: number
  /** The space between the list's edges and the scrolling items. */
  chromeTop: number
  chromeBottom: number
  contentHeight: number
  /** The item's place among the items. */
  itemTop: number
  itemHeight: number
  /** How far the item's text starts from the list's starting edge. */
  textOffset: number
  /** The list never gets shorter than this, or its full height. */
  minHeight: number
}

/** Keeps lining up an item clear of the viewport's top and bottom edges. */
const edgeClearance = 20

/**
 * Places the list over the trigger so the item's text sits where the value's
 * text is, as Base UI's alignItemWithTrigger does. The list gets shorter and
 * scrolls to keep the item there near an edge of the viewport. Returns `null`
 * when the trigger is too close to an edge, or the list would get too short.
 */
function computeItemAlignment(input: ItemAlignment) {
  let { viewport, padding, trigger, chromeTop, chromeBottom, contentHeight, itemTop, itemHeight } = input
  if (
    trigger.y < viewport.y + edgeClearance ||
    trigger.y + trigger.height > viewport.y + viewport.height - edgeClearance
  ) {
    return null
  }
  let top = viewport.y + padding
  let bottom = viewport.y + viewport.height - padding
  let center = trigger.y + trigger.height / 2
  let y = center - (chromeTop + itemTop + itemHeight / 2)
  let scrollTop = 0
  if (y < top) {
    scrollTop = top - y
    y = top
  }
  let height = Math.min(input.height - scrollTop, bottom - y)
  if (center + itemHeight / 2 > y + height - chromeBottom) return null
  if (height < Math.min(input.height, input.minHeight)) return null
  scrollTop = Math.min(scrollTop, Math.max(0, contentHeight - (height - chromeTop - chromeBottom)))

  // As wide as needed to cover the trigger, from where the item's text lines up.
  let x: number
  let width: number
  if (input.dir === 'rtl') {
    let right = input.valueStart + input.textOffset
    width = Math.max(input.width, right - trigger.x)
    x = right - width
  } else {
    x = input.valueStart - input.textOffset
    width = Math.max(input.width, trigger.x + trigger.width - x)
  }
  x = Math.max(viewport.x + padding, Math.min(x, viewport.x + viewport.width - padding - width))
  return { x, y, width, height, scrollTop }
}

interface ItemAlignedOptions {
  open: boolean
  trigger: () => HTMLElement | null
  list: () => HTMLElement | null
  item: () => HTMLElement | null
  collisionPadding: number
  onFallback: () => void
}

function getViewport(document: Document): Rect {
  let visual = document.defaultView?.visualViewport
  if (visual) return { x: visual.offsetLeft, y: visual.offsetTop, width: visual.width, height: visual.height }
  let root = document.documentElement
  return { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight }
}

/** Lines the list up with the trigger until the cleanup it returns runs, or returns `null` when it can't. */
function alignWithTrigger(popup: HTMLElement, options: ItemAlignedOptions): (() => void) | null {
  let trigger = options.trigger()
  let list = options.list()
  if (!trigger || !list) return null
  let document = popup.ownerDocument
  let view = document.defaultView!
  let saved = new Map<string, string>()
  let savedSide = popup.getAttribute('data-side')
  let set = (property: string, value: string) => {
    if (!saved.has(property)) saved.set(property, popup.style.getPropertyValue(property))
    popup.style.setProperty(property, value)
  }
  let restore = () => {
    for (let [property, value] of saved) {
      if (value) popup.style.setProperty(property, value)
      else popup.style.removeProperty(property)
    }
    saved.clear()
    if (savedSide === null) popup.removeAttribute('data-side')
    else popup.setAttribute('data-side', savedSide)
  }

  function place() {
    let item = options.item()
    if (!trigger || !list || !item) return false
    let triggerRect = trigger.getBoundingClientRect()
    // Measure at full height in a neutral place.
    for (let [property, value] of [
      ['position', 'fixed'],
      ['inset', 'auto'],
      ['top', '0px'],
      ['left', '0px'],
      ['margin', '0px'],
      ['max-height', 'none'],
      ['--anchor-width', `${triggerRect.width}px`],
    ]) {
      set(property, value)
    }
    list.scrollTop = 0
    let dir: 'ltr' | 'rtl' = getComputedStyle(popup).direction === 'rtl' ? 'rtl' : 'ltr'
    let popupRect = popup.getBoundingClientRect()
    let listRect = list.getBoundingClientRect()
    let itemRect = item.getBoundingClientRect()
    let text = item.querySelector('[data-slot="select-item-text"]') ?? item
    let textRect = text.getBoundingClientRect()
    let value = trigger.querySelector('[data-slot="select-value"]') ?? trigger
    let valueRect = value.getBoundingClientRect()
    let viewport = getViewport(document)
    let minHeight = parseFloat(getComputedStyle(popup).minHeight) || 100

    let result = computeItemAlignment({
      viewport,
      padding: options.collisionPadding,
      trigger: { x: triggerRect.x, y: triggerRect.y, width: triggerRect.width, height: triggerRect.height },
      valueStart: dir === 'rtl' ? valueRect.right : valueRect.left,
      dir,
      width: popupRect.width,
      height: popupRect.height,
      chromeTop: listRect.top - popupRect.top,
      chromeBottom: popupRect.bottom - listRect.bottom,
      contentHeight: list.scrollHeight,
      itemTop: itemRect.top - listRect.top,
      itemHeight: itemRect.height,
      textOffset: dir === 'rtl' ? popupRect.right - textRect.right : textRect.left - popupRect.left,
      minHeight,
    })
    if (!result) return false
    set('top', `${result.y}px`)
    set('left', `${result.x}px`)
    set('max-height', `${result.height}px`)
    set('--anchor-width', `${result.width}px`)
    set('--available-height', `${result.height}px`)
    set('--available-width', `${viewport.width - 2 * options.collisionPadding}px`)
    popup.setAttribute('data-side', 'none')
    list.scrollTop = result.scrollTop
    return true
  }

  if (!place()) {
    restore()
    return null
  }

  let controller = new AbortController()
  let last = trigger.getBoundingClientRect()
  let frame = 0
  // The page scrolled: the list moves with the trigger and keeps its own scroll.
  function follow(event: Event) {
    if (event.target instanceof Node && popup.contains(event.target)) return
    if (frame) return
    frame = view.requestAnimationFrame(() => {
      frame = 0
      if (!trigger) return
      let next = trigger.getBoundingClientRect()
      set('top', `${parseFloat(popup.style.top) + next.top - last.top}px`)
      set('left', `${parseFloat(popup.style.left) + next.left - last.left}px`)
      last = next
    })
  }
  function resize() {
    if (!place()) {
      cleanup()
      options.onFallback()
    } else last = trigger!.getBoundingClientRect()
  }
  function cleanup() {
    if (controller.signal.aborted) return
    controller.abort()
    view.cancelAnimationFrame(frame)
    restore()
  }
  let listen = { passive: true, signal: controller.signal }
  document.addEventListener('scroll', follow, { ...listen, capture: true })
  view.addEventListener('resize', resize, listen)
  view.visualViewport?.addEventListener('resize', resize, listen)
  return cleanup
}

// Lines the list up with the trigger while `open`, or asks for the fallback.
const itemAligned = createMixin<HTMLElement, [options: ItemAlignedOptions]>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: ItemAlignedOptions
    let stop: (() => void) | null = null

    function sync() {
      let active = host !== null && options.open
      if (!active && stop) {
        stop()
        stop = null
      }
      if (active && !stop) {
        stop = alignWithTrigger(host!, options)
        if (!stop) options.onFallback()
      }
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
    })
    handle.addEventListener('remove', () => {
      host = null
      sync()
    })

    return (next) => {
      options = next
      handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)

const contentRule = css(
  mergeStyles(
    {
      ...textSm,
      boxSizing: 'border-box',
      position: 'fixed',
      width: 'max-content',
      minWidth: 'max(var(--anchor-width, 0px), 9rem)',
      maxWidth: 'var(--available-width, calc(100% - 10px))',
      maxHeight: 'var(--available-height, calc(100% - 10px))',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'flex', flexDirection: 'column' },
      // Fades in beside the trigger. Lined up with the trigger, it shows at once, as in shadcn.
      '@starting-style': { opacity: 0 },
      '&[data-align-trigger="true"]': { transitionProperty: 'none' },
    },
    transition('opacity'),
  ),
)

const listRule = css({
  flex: '1 1 auto',
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  outline: 'none',
})

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface SelectContentProps extends Props<'div'> {
  /** The side of the trigger to show on, when the list isn't lined up with it (defaults to `'bottom'`). */
  side?: Side
  /** The gap to the trigger, in pixels (defaults to `4`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'center'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /**
   * Whether the list opens over the trigger with the chosen item's text where
   * the value is (defaults to `true`). It opens beside the trigger instead
   * when a touch opens it, or when the viewport has too little room.
   */
  alignItemWithTrigger?: boolean
  /** Space to keep from the edges of the viewport, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** How to stay in view beside the trigger: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
}

interface ContentApi {
  arrows: { up: HTMLElement | null; down: HTMLElement | null }
  list: HTMLElement | null
  /** Shows each scroll button while the list can scroll its way. */
  updateArrows(): void
}

/**
 * The list: a native popover in the top layer with the items in a listbox
 * that scrolls, between buttons that scroll it on hover. It stays in the
 * document while closed, hidden.
 */
export function SelectContent(handle: Handle<SelectContentProps, ContentApi>) {
  let api = useSelect(handle, 'SelectContent')
  let resizeObserver: ResizeObserver | undefined
  let content: ContentApi = {
    arrows: { up: null, down: null },
    list: null,
    updateArrows() {
      let list = content.list
      if (!list) return
      let up = list.scrollTop > 1
      let down = list.scrollTop + list.clientHeight < list.scrollHeight - 1
      content.arrows.up?.toggleAttribute('data-visible', up)
      content.arrows.down?.toggleAttribute('data-visible', down)
    },
  }
  handle.context.set(content)
  handle.signal.addEventListener('abort', () => resizeObserver?.disconnect())

  return () => {
    let {
      side = 'bottom',
      sideOffset = 4,
      align = 'center',
      alignOffset = 0,
      alignItemWithTrigger = true,
      collisionPadding = 5,
      collisionAvoidance = {},
      children,
      mix,
      ...props
    } = handle.props
    api.contentOptions = { alignItemWithTrigger }
    let open = api.open
    let control = api.control
    let named =
      control['aria-labelledby'] !== undefined
        ? { 'aria-labelledby': control['aria-labelledby'] as string }
        : control['aria-label'] !== undefined
          ? { 'aria-label': control['aria-label'] as string }
          : { 'aria-labelledby': api.listLabelledBy }

    return (
      <div
        data-slot="select-content"
        data-align-trigger={String(alignItemWithTrigger)}
        {...props}
        popover="manual"
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentRule,
          mix,
          topLayer(open),
          itemAligned({
            open: open && api.placement === 'item',
            trigger: () => api.trigger,
            list: () => api.list,
            item: () => api.alignItem(),
            collisionPadding,
            onFallback: () => api.fallBack(),
          }),
          anchorPosition({
            open: open && api.placement === 'side',
            anchor: () => api.trigger,
            side,
            sideOffset,
            align,
            alignOffset,
            collisionPadding,
            flip: collisionAvoidance.side !== 'none',
            shift: collisionAvoidance.align !== 'none',
          }),
          dismissableLayer({
            open,
            modal: api.modal,
            trigger: () => api.trigger,
            onDismiss: ({ reason, event }) =>
              api.setOpen(false, reason === 'close-request' ? 'escape-key' : reason, event),
          }),
          modalMixin({ open: open && api.modal, keep: () => [api.trigger] }),
          // A press in the list keeps focus on the trigger.
          on('mousedown', (event) => event.preventDefault()),
          afterMixins(() => {
            if (!open) return
            api.revealHighlighted()
            content.updateArrows()
          }),
        ]}
      >
        <SelectScrollUpButton />
        <div
          data-slot="select-list"
          role="listbox"
          id={api.ids.list}
          {...named}
          aria-multiselectable={api.multiple ? 'true' : undefined}
          mix={[
            listRule,
            ref((node, signal) => {
              let list = node as HTMLElement
              api.list = list
              content.list = list
              resizeObserver = new ResizeObserver(() => content.updateArrows())
              resizeObserver.observe(list)
              signal.addEventListener('abort', () => {
                resizeObserver?.disconnect()
                if (api.list === list) api.list = null
                if (content.list === list) content.list = null
              })
            }),
            on('scroll', () => content.updateArrows()),
          ]}
        >
          {children}
        </div>
        <SelectScrollDownButton />
      </div>
    )
  }
}

const groupRule = css({ padding: space(1), scrollMarginBlock: space(1) })

export interface SelectGroupProps extends Props<'div'> {
  /** Turns off every item in the group, as a disabled optgroup does. */
  disabled?: boolean
}

interface GroupApi {
  record: GroupRecord
  /** Takes the id a label renders, for one the group's render can't see. */
  adoptLabel(id: string, signal: AbortSignal): void
}

/** A group of items that its SelectLabel names. In the native select, a labelled group is an optgroup. */
export function SelectGroup(handle: Handle<SelectGroupProps, GroupApi>) {
  let api = useSelect(handle, 'SelectGroup')
  let adopted: string | undefined
  let record: GroupRecord = {
    id: handle.id,
    labelId: `${handle.id}-label`,
    label: '',
    hasLabel: false,
    disabled: false,
  }
  let group: GroupApi = {
    record,
    adoptLabel(id, signal) {
      if (adopted === id) return
      adopted = id
      api.changed()
      void handle.update()
      signal.addEventListener('abort', () => {
        if (adopted !== id) return
        adopted = undefined
        queueMicrotask(() => {
          if (!handle.signal.aborted) void handle.update()
        })
      })
    },
  }
  handle.context.set(group)

  let seenPass = -1

  return () => {
    let { disabled = false, children, mix, ...props } = handle.props
    // Rendered again without the root: the native select follows once the root renders again.
    let local = seenPass === api.pass
    seenPass = api.pass
    if (!onServer) handle.queueTask(() => (local ? api.refresh() : api.flush()))
    let [label] = findAll<SelectLabelProps>(children, SelectLabel, [])
    record.disabled = disabled
    record.hasLabel = label !== undefined || adopted !== undefined
    record.labelId = label?.id ?? adopted ?? `${handle.id}-label`
    if (label) record.label = collapse(readText(label.children).text)

    return (
      <div
        role="group"
        data-slot="select-group"
        aria-labelledby={record.hasLabel ? record.labelId : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        data-disabled={disabled ? '' : undefined}
        {...props}
        mix={[groupRule, mix]}
      >
        {children}
      </div>
    )
  }
}

const labelRule = css({
  paddingInline: space(2),
  paddingBlock: space(1.5),
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  color: 'var(--muted-foreground)',
})

export interface SelectLabelProps extends Props<'div'> {}

/** Names the group it sits in, and its optgroup in the native select. Outside a group, assistive technology skips it. */
export function SelectLabel(handle: Handle<SelectLabelProps>) {
  return () => {
    let group = handle.context.get(SelectGroup) as GroupApi | undefined
    let { id, mix, ...props } = handle.props
    let labelId = id ?? group?.record.labelId

    return (
      <div
        data-slot="select-label"
        aria-hidden={group ? undefined : 'true'}
        {...props}
        id={labelId}
        mix={[
          labelRule,
          mix,
          ref((node, signal) => {
            if (!group || !labelId) return
            let record = group.record
            let text = collapse(node.textContent ?? '')
            let renamed = record.label !== text
            record.label = text
            if (!record.hasLabel || record.labelId !== labelId) group.adoptLabel(labelId, signal)
            else if (renamed) useSelect(handle, 'SelectLabel').changed()
          }),
        ]}
      />
    )
  }
}

const itemRule = css({
  ...textSm,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  paddingBlock: space(1.5),
  paddingInlineStart: space(2),
  paddingInlineEnd: space(8),
  borderRadius: 'var(--radius-sm)',
  cursor: 'default',
  userSelect: 'none',
  outline: 'none',
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
  '&[data-highlighted]': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  // Forced colors drop the background, so an outline marks the highlighted item.
  '@media (forced-colors: active)': {
    '&[data-highlighted]': { outline: '2px solid Highlight', outlineOffset: '-2px' },
  },
})

const itemTextRule = css({
  display: 'flex',
  flex: '1 1 auto',
  alignItems: 'center',
  gap: space(2),
  minWidth: 0,
  overflowWrap: 'break-word',
})

const indicatorRule = css({
  position: 'absolute',
  insetInlineEnd: space(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  height: '1rem',
  pointerEvents: 'none',
})

export interface SelectItemProps extends Omit<Props<'div'>, 'role' | 'id' | 'value'> {
  /** The value the item stands for, or `null` for the item that clears the choice and shows as the placeholder. */
  value: string | null
  /**
   * The item's text for typing, the native option and assistive technology,
   * when its children aren't plain text, such as an icon and a component.
   */
  label?: string
  /** Keeps the item from being chosen. It still shows. */
  disabled?: boolean
}

/** An option of the list, with a check while it's chosen. */
export function SelectItem(handle: Handle<SelectItemProps>) {
  let api = useSelect(handle, 'SelectItem')
  let record: ItemRecord = {
    id: `${handle.id}-option`,
    value: '',
    label: '',
    content: null,
    disabled: false,
    group: null,
    element: null,
    position: 0,
  }
  handle.signal.addEventListener('abort', () => api.unregister(record))
  let textElement: HTMLElement | null = null
  let seenPass = -1

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' || !api.highlightOnHover || record.disabled) return
    if (api.highlightedId !== record.id) api.highlight(record)
  }

  return () => {
    let group = handle.context.get(SelectGroup) as GroupApi | undefined
    let { value, label, disabled = false, children, mix, ...props } = handle.props
    let text = readText(children)
    // The page's text, once rendered, for children whose text the render can't read.
    let shown = textElement ? collapse(textElement.textContent ?? '') : ''
    let itemLabel = label ?? (text.complete || !shown ? collapse(text.text) : shown)
    let off = disabled || Boolean(group?.record.disabled)
    // Rendered again without the root, by an update of a component of yours: the trigger and the
    // native select, which rendered before, follow once the root renders again. An item that first
    // mounts that way changes the root's records, so the root renders again when they changed.
    let local = seenPass === api.pass
    seenPass = api.pass
    if (!onServer) handle.queueTask(() => (local ? api.refresh() : api.flush()))
    api.register(record, {
      value: value ?? '',
      label: itemLabel,
      content: children,
      disabled: off,
      group: group?.record ?? null,
    })
    let selected = api.isSelected(record.value)
    let highlighted = api.highlightedId === record.id

    if (!onServer && label === undefined && !text.complete) {
      handle.queueTask(() => {
        let next = textElement ? collapse(textElement.textContent ?? '') : ''
        if (next && next !== record.label) {
          record.label = next
          api.changed()
        }
      })
    }

    return (
      <div
        data-slot="select-item"
        data-label={label}
        {...props}
        role="option"
        id={record.id}
        aria-selected={selected ? 'true' : 'false'}
        aria-disabled={off ? 'true' : undefined}
        data-selected={selected ? '' : undefined}
        data-highlighted={highlighted ? '' : undefined}
        data-disabled={off ? '' : undefined}
        mix={[
          itemRule,
          mix,
          ref((node, signal) => {
            record.element = node as HTMLElement
            signal.addEventListener('abort', () => {
              if (record.element === node) record.element = null
            })
          }),
          on<HTMLElement, 'pointermove'>('pointermove', onPointerMove),
          on('click', (event) => {
            if (!event.defaultPrevented) api.choose(record, event)
          }),
        ]}
      >
        <span data-slot="select-item-text" mix={[itemTextRule, ref((node) => (textElement = node as HTMLElement))]}>
          {children}
        </span>
        <span data-slot="select-item-indicator" aria-hidden="true" mix={indicatorRule}>
          {selected ? <CheckIcon /> : null}
        </span>
      </div>
    )
  }
}

const separatorRule = css({
  height: 0,
  marginBlock: space(1),
  borderBlockStart: '1px solid var(--border)',
  pointerEvents: 'none',
})

/** A line between groups. A listbox holds only options and groups, so assistive technology skips it. */
export function SelectSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="select-separator" {...props} aria-hidden="true" mix={[separatorRule, mix]} />
  }
}

const scrollButtonRule = css({
  position: 'absolute',
  insetInline: 0,
  zIndex: 1,
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  paddingBlock: space(1),
  backgroundColor: 'var(--popover)',
  cursor: 'default',
  '&[data-visible]': { display: 'flex' },
  '&[data-direction="up"]': { insetBlockStart: 0 },
  '&[data-direction="down"]': { insetBlockEnd: 0 },
  '& svg': { width: '1rem', height: '1rem' },
  '&[data-direction="up"] svg': { rotate: '180deg' },
  // Touch screens scroll the list directly.
  '@media (hover: none)': { '&[data-visible]': { display: 'none' } },
})

function ScrollButton(handle: Handle<Props<'div'> & { direction: 'up' | 'down' }>) {
  let timer: ReturnType<typeof setInterval> | undefined
  handle.signal.addEventListener('abort', () => clearInterval(timer))

  function stop() {
    clearInterval(timer)
    timer = undefined
  }

  return () => {
    let content = handle.context.get(SelectContent) as ContentApi | undefined
    let { direction, mix, ...props } = handle.props
    let start = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || timer !== undefined || !content) return
      timer = setInterval(() => {
        let list = content.list
        if (!list) return stop()
        let step = list.querySelector<HTMLElement>('[data-slot="select-item"]')?.offsetHeight || 32
        list.scrollTop += direction === 'up' ? -step : step
        let end = direction === 'up' ? list.scrollTop <= 0 : list.scrollTop + list.clientHeight >= list.scrollHeight - 1
        if (end) stop()
      }, 50)
    }

    return (
      <div
        data-slot={`select-scroll-${direction}-button`}
        data-direction={direction}
        {...props}
        aria-hidden="true"
        mix={[
          scrollButtonRule,
          mix,
          ref((node, signal) => {
            if (!content) return
            content.arrows[direction] = node as HTMLElement
            content.updateArrows()
            signal.addEventListener('abort', () => {
              if (content.arrows[direction] === node) content.arrows[direction] = null
              stop()
            })
          }),
          on<HTMLElement, 'pointerenter'>('pointerenter', start),
          on<HTMLElement, 'pointermove'>('pointermove', start),
          on('pointerleave', stop),
        ]}
      >
        <ChevronDownIcon />
      </div>
    )
  }
}

/** Shows while the list can scroll up, and scrolls it while the pointer rests on it. SelectContent renders one. */
export function SelectScrollUpButton(handle: Handle<Props<'div'>>) {
  return () => <ScrollButton {...handle.props} direction="up" />
}

/** Shows while the list can scroll down, and scrolls it while the pointer rests on it. SelectContent renders one. */
export function SelectScrollDownButton(handle: Handle<Props<'div'>>) {
  return () => <ScrollButton {...handle.props} direction="down" />
}

const nativeRule = css(
  mergeStyles(
    {
      position: 'relative',
      display: 'inline-block',
      verticalAlign: 'middle',
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      '&:has(> select:disabled)': { opacity: 0.5 },
      // Once the select runs, the native select only holds the value, out of sight and reach.
      '&[data-running]': {
        position: 'absolute',
        width: '1px',
        height: '1px',
        margin: 0,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      },
    },
    fieldItem,
  ),
)

const nativeSelectRule = css(
  mergeStyles(
    {
      display: 'block',
      boxSizing: 'border-box',
      width: '100%',
      minWidth: 0,
      minHeight: space(9),
      margin: 0,
      paddingBlock: space(1),
      paddingInlineStart: space(2.5),
      paddingInlineEnd: space(8),
      appearance: 'none',
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      color: 'inherit',
      fontFamily: 'inherit',
      ...textSm,
      '&[data-size="sm"]': { minHeight: space(8) },
      '&[multiple]': { paddingInlineEnd: space(2.5) },
      '&:focus-visible': { borderColor: 'var(--ring)' },
      // The wrapper dims a disabled select; Chromium dims it itself too.
      '&:disabled': { cursor: 'not-allowed', opacity: 1 },
    },
    invalidState,
  ),
)

const nativeIconRule = css({
  position: 'absolute',
  insetBlockStart: '50%',
  insetInlineEnd: space(2.5),
  display: 'flex',
  translate: '0 -50%',
  color: 'var(--muted-foreground)',
  pointerEvents: 'none',
  '& > svg': { width: '1rem', height: '1rem' },
  ':where([data-slot="select-native"]:has(> select[multiple])) > &': { display: 'none' },
})

// Options take the system colors, so the browser's list of them stays readable in either scheme.
const optionRule = css({ backgroundColor: 'Canvas', color: 'CanvasText' })

/**
 * The native select that holds the form value: the control itself until the
 * select runs, then out of sight, without a tab stop and hidden from
 * assistive technology, with focus going on to the trigger.
 */
function SelectNative(handle: Handle<{}>) {
  return () => {
    let api = useSelect(handle, 'SelectNative')
    let { name, form, autocomplete, required, disabled, readOnly, multiple } = api.formProps
    let running = api.running
    let values = api.values
    let records = api.records()
    let known = new Set(records.map((record) => record.value))
    let nullRecord = records.find((record) => record.value === '')
    // Only the server writes which options are selected. In the browser, a selected prop is the
    // option's state, which a render would set over the user's choice, so the select writes it itself.
    let selected = (value: string) => (onServer ? { selected: api.isSelected(value) } : {})

    let option = (record: ItemRecord) => {
      let chosen = api.isSelected(record.value)
      // A disabled item that is chosen still submits, but the native list never offers it.
      let off = record.disabled || (Boolean(readOnly) && !chosen)
      return (
        <option
          key={record.id}
          value={record.value}
          disabled={off && !chosen ? true : undefined}
          hidden={record.disabled && chosen ? true : undefined}
          {...selected(record.value)}
          mix={optionRule}
        >
          {record.label || api.textFor(record.value)}
        </option>
      )
    }

    // A disabled optgroup would keep its chosen option out of the form, so then only its other options turn off.
    let optgroup = (group: GroupRecord, list: ItemRecord[]) => {
      let chosen = list.some((record) => api.isSelected(record.value))
      return (
        <optgroup
          key={group.id}
          label={group.label}
          disabled={group.disabled && !chosen ? true : undefined}
          mix={optionRule}
        >
          {list.map(option)}
        </optgroup>
      )
    }

    let children: RemixNode[] = []
    if (!multiple) {
      children.push(
        nullRecord ? (
          option(nullRecord)
        ) : (
          <option key="placeholder" value="" hidden {...selected('')} mix={optionRule}>
            {collapse(readText(api.placeholder).text)}
          </option>
        ),
      )
    }
    // Items in document order, those of a labelled group gathered where the group starts.
    let entries: Array<ItemRecord | [GroupRecord, ItemRecord[]]> = []
    let groups = new Map<GroupRecord, ItemRecord[]>()
    for (let record of records) {
      if (record.value === '') continue
      let group = record.group
      if (!group?.hasLabel || !group.label) {
        entries.push(record)
        continue
      }
      let list = groups.get(group)
      if (!list) {
        list = []
        groups.set(group, list)
        entries.push([group, list])
      }
      list.push(record)
    }
    for (let entry of entries) children.push(Array.isArray(entry) ? optgroup(...entry) : option(entry))
    // A value without an item still submits, as the trigger shows it, and a default without one is
    // still there for a form reset.
    for (let value of new Set([...values, ...api.defaults])) {
      if (known.has(value)) continue
      children.push(
        <option key={`value:${value}`} value={value} hidden {...selected(value)} mix={optionRule}>
          {api.textFor(value)}
        </option>,
      )
    }

    let control = ariaStates({ ...api.control })
    let attributes = running
      ? { id: api.ids.native, tabindex: -1, 'aria-hidden': 'true' as const }
      : { ...control, id: control.id ?? api.ids.native }

    return (
      <span data-slot="select-native" data-size={api.size} data-running={running ? '' : undefined} mix={nativeRule}>
        <select
          data-slot="select-native-select"
          data-size={api.size}
          data-served={onServer ? '' : undefined}
          {...attributes}
          name={name}
          form={form}
          autocomplete={autocomplete}
          required={required}
          disabled={disabled}
          multiple={multiple}
          mix={[
            nativeSelectRule,
            ref((node, signal) => api.attachNative(node as HTMLSelectElement, signal)),
            on('focus', () => api.redirectFocus()),
            on('invalid', () => api.reportInvalid()),
            on('change', (event) => api.readNativeChange(event)),
          ]}
        >
          {children}
        </select>
        <span data-slot="select-native-icon" aria-hidden="true" mix={nativeIconRule}>
          <ChevronDownIcon />
        </span>
      </span>
    )
  }
}
