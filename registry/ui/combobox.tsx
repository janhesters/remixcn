// RemixCN Combobox: https://janhesters.github.io/remixcn/
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
import { CheckIcon, ChevronDownIcon, XIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { modal as modalMixin } from '#remixcn/lib/modal.ts'
import {
  buttonGroupItem,
  fieldItem,
  focusRing,
  invalidState,
  mergeStyles,
  transition,
  visuallyHidden,
} from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '#remixcn/ui/input-group.tsx'

// A combobox: a text input that filters a list of items to choose from, as
// Base UI draws it for shadcn/ui, without Base UI.
//
// The chosen value lives in a native <select>, which the server renders with
// every item as an option and the chosen ones selected. Until the browser
// runs the combobox, and on a page without JavaScript, that native select is
// the control: the input waits hidden. Once the combobox runs, inside your
// client entry, the input shows and the native select hides, keeps its name
// and still submits the chosen value, so the form gets one value from one
// control. The browser's own validation and reset keep working on it.
//
// The input is an editable combobox with list autocomplete, as the WAI-ARIA
// Authoring Practices describe it: focus stays in the real text input, typing
// filters the items, and the arrow keys move a highlight through the list
// with aria-activedescendant (composite.ts). The text is a search, never a
// value: when the list closes, it goes back to the chosen item's label. The
// list is a native popover in the top layer, placed beside the input
// (anchor-position.ts). Escape and a press outside close it (layer.ts).
//
// The items come from the `items` prop, so the server knows every label and
// value. The list renders the items that match the search through a function
// you give it, and the items register with the root while they render, so
// the keyboard and the native select know which are disabled.

/** What changed the value. */
export type ComboboxValueChangeReason =
  /** A click on an item, or Enter or Space on the highlighted one. */
  | 'item-press'
  /** Emptying the input of a single combobox. */
  | 'input-clear'
  /** The clear button. */
  | 'clear-press'
  /** A chip's remove button. */
  | 'chip-remove-press'
  /** Escape on a closed combobox. */
  | 'escape-key'
  /** The native select changed before the script ran, or the browser restored it. */
  | 'native-change'
  /** A form reset. */
  | 'reset'
  /** Backspace or Delete on a chip, or typing on a closed trigger. */
  | 'none'

/** What changed the input's text. */
export type ComboboxInputValueChangeReason =
  'input-change' | 'input-clear' | 'item-press' | 'clear-press' | 'escape-key' | 'reset' | 'none'

/** What opened or closed the list, as Base UI names it. */
export type ComboboxOpenChangeReason =
  | 'trigger-press'
  | 'input-press'
  | 'input-change'
  | 'input-clear'
  | 'item-press'
  | 'clear-press'
  | 'escape-key'
  | 'outside-press'
  | 'focus-out'
  | 'list-navigation'
  | 'disabled'
  | 'trigger-removed'
  | 'none'

interface ChangeDetails<Reason> {
  reason: Reason
  /** The event that asked for the change, if any. */
  event?: Event
  /** Keeps the current state. */
  cancel(): void
  readonly isCanceled: boolean
}

export type ComboboxValueChangeDetails = ChangeDetails<ComboboxValueChangeReason>
export type ComboboxOpenChangeDetails = ChangeDetails<ComboboxOpenChangeReason>

export interface ComboboxInputValueChangeDetails extends ChangeDetails<ComboboxInputValueChangeReason> {
  /**
   * Aborts once the text changes again or the combobox goes away. Pass it to
   * the request you start for this text, and drop answers that arrive after
   * it aborted: they belong to an older search.
   */
  readonly signal: AbortSignal
  /** Whether a press on an item cleared the text, in a multiple combobox. */
  readonly isItemPress?: boolean
}

export interface ComboboxHighlightDetails {
  /** `'keyboard'`, `'pointer'`, or `'none'` for typing, opening and changed items. */
  reason: 'keyboard' | 'pointer' | 'none'
  event?: Event
}

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

/** A group of items, such as `{ value: 'Europe', items: ['London', 'Paris'] }`. Other fields are yours. */
export interface ComboboxItemGroup<Item = any> {
  readonly items: readonly Item[]
}

/** The items: a list, or a list of groups. */
export type ComboboxItems<Item = any> = readonly Item[] | readonly ComboboxItemGroup<Item>[]

/** Decides whether an item matches the search. `itemToString` gives the item's label. */
export type ComboboxFilter<Item = any> = (item: Item, query: string, itemToString: (item: Item) => string) => boolean

export interface ComboboxFilterOptions extends Intl.CollatorOptions {
  /** The locale to compare in (defaults to the browser's, or the server's). */
  locale?: string | readonly string[]
}

export interface ComboboxFilters {
  /** Whether the item's label contains the query anywhere. */
  contains<Item>(item: Item, query: string, itemToString?: (item: Item) => string): boolean
  /** Whether the item's label starts with the query. */
  startsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string): boolean
  /** Whether the item's label ends with the query. */
  endsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string): boolean
}

function defaultLabel(item: unknown): string {
  if (item === null || item === undefined) return ''
  if (typeof item === 'object' && 'label' in item) return String((item as { label: unknown }).label ?? '')
  return String(item)
}

/**
 * Matches labels with Intl.Collator, so case, accents and punctuation don't
 * count, in place of Base UI's useFilter(). Pass `contains`, `startsWith` or
 * `endsWith` as the combobox's `filter`.
 */
export function createComboboxFilter(options: ComboboxFilterOptions = {}): ComboboxFilters {
  let { locale, ...rest } = options
  let collator = new Intl.Collator(locale as string | string[] | undefined, {
    usage: 'search',
    sensitivity: 'base',
    ignorePunctuation: true,
    ...rest,
  })
  let same = (a: string, b: string) => collator.compare(a, b) === 0
  let toString = <Item,>(item: Item, itemToString?: (item: Item) => string) =>
    itemToString ? itemToString(item) : defaultLabel(item)

  return {
    contains(item, query, itemToString) {
      if (!query) return true
      let label = toString(item, itemToString)
      for (let index = 0; index <= label.length - query.length; index++) {
        if (same(label.slice(index, index + query.length), query)) return true
      }
      return false
    },
    startsWith(item, query, itemToString) {
      if (!query) return true
      return same(toString(item, itemToString).slice(0, query.length), query)
    },
    endsWith(item, query, itemToString) {
      if (!query) return true
      let label = toString(item, itemToString)
      return label.length >= query.length && same(label.slice(label.length - query.length), query)
    },
  }
}

interface ComboboxBaseProps<Item> {
  /**
   * The items, or groups of items with an `items` list. The list renders
   * those that match the search, and the native select offers all of them.
   */
  items?: ComboboxItems<Item>
  /**
   * The items to show in place of the ones Combobox filters, such as results
   * you load for the search. Keep the shape of `items`, and keep the chosen
   * items in `items`, so their labels stay known.
   */
  filteredItems?: ComboboxItems<Item>
  /** Decides which items match the search, or `null` to show every item (defaults to `contains` of createComboboxFilter). */
  filter?: ComboboxFilter<Item> | null
  /** Shows at most this many items (defaults to `-1`, every item). */
  limit?: number
  /** The locale of the default filter. */
  locale?: string | readonly string[]
  /** The text of an item, for the input, the chips and the default filter (defaults to its `label`, or the item itself). */
  itemToStringLabel?: (item: Item) => string
  /** The text an item submits with the form (defaults to its `value`, or its label). */
  itemToStringValue?: (item: Item) => string
  /** Whether an item stands for a value, for items that aren't the same object (defaults to `Object.is`). */
  isItemEqualToValue?: (item: Item, value: Item) => boolean
  /** The input's text, for an input you control. Render the new text from onInputValueChange. */
  inputValue?: string
  /** The input's text at first (defaults to the chosen item's label). */
  defaultInputValue?: string
  /** Called before the input's text changes. Its `details.signal` aborts once the text changes again. */
  onInputValueChange?: (inputValue: string, details: ComboboxInputValueChangeDetails) => void
  /** Whether the list is open, for a combobox you control. Render the new state from onOpenChange. */
  open?: boolean
  /** Whether the list opens once the combobox runs. */
  defaultOpen?: boolean
  /** Called before the list opens or closes. Call `details.cancel()` to keep the current state. */
  onOpenChange?: (open: boolean, details: ComboboxOpenChangeDetails) => void
  /** Highlights the first match while you type, or with `'always'` whenever the list shows items (defaults to `false`). */
  autoHighlight?: boolean | 'always'
  /** Whether the pointer moves the highlight (defaults to `true`). */
  highlightItemOnHover?: boolean
  /** Whether a press on the input opens the list (defaults to `true`). */
  openOnInputClick?: boolean
  /** Whether the arrow keys pass through the input between the last and the first item (defaults to `true`). */
  loopFocus?: boolean
  /** Whether the rest of the page stays still while the list is open: no scrolling and no presses (defaults to `false`). */
  modal?: boolean
  /** Called when another item lights up, or none. */
  onItemHighlighted?: (item: Item | undefined, details: ComboboxHighlightDetails) => void
  /** Names the value in the form, on the native select. */
  name?: string
  /** The id of the form the value belongs to, when the combobox sits outside it. */
  form?: string
  /** The autofill hint of the native select. */
  autocomplete?: string
  /** Whether a form needs a choice before it submits. */
  required?: boolean
  /** Whether the combobox ignores the user and leaves the form. */
  disabled?: boolean
  /** Whether the list opens without letting the user choose another value. */
  readOnly?: boolean
  children?: RemixNode
}

export interface ComboboxSingleProps<Item = any> extends ComboboxBaseProps<Item> {
  multiple?: false
  /** The chosen item, for a combobox you control, or `null` for none. Render the new value from onValueChange. */
  value?: Item | null
  /** The item chosen at first. A form reset returns to it. */
  defaultValue?: Item | null
  /** Called before the value changes. Call `details.cancel()` to keep the current value. */
  onValueChange?: (value: Item | null, details: ComboboxValueChangeDetails) => void
}

export interface ComboboxMultipleProps<Item = any> extends ComboboxBaseProps<Item> {
  /** Lets the user choose several items, shown as chips. */
  multiple: true
  /** The chosen items, for a combobox you control, in the order they were chosen. */
  value?: readonly Item[]
  /** The items chosen at first. */
  defaultValue?: readonly Item[]
  /** Called before the values change. */
  onValueChange?: (value: Item[], details: ComboboxValueChangeDetails) => void
}

export type ComboboxProps<Item = any> = ComboboxSingleProps<Item> | ComboboxMultipleProps<Item>

type OpenedBy = 'pointer' | 'keyboard' | 'input' | 'none'
type FirstHighlight = 'none' | 'selected' | 'first' | 'last'

interface GroupRecord {
  readonly id: string
  labelId: string
  label: string
  hasLabel: boolean
}

interface ItemRecord {
  readonly id: string
  item: unknown
  label: string
  disabled: boolean
  group: GroupRecord | null
  element: HTMLElement | null
  /** Its place in the latest render, which is the order of the document. */
  position: number
}

type ItemData = Pick<ItemRecord, 'item' | 'label' | 'disabled' | 'group'>

/** The id and ARIA props of the control, which the native select carries until the combobox runs. */
type ControlProps = Partial<
  Pick<
    Props<'input'>,
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

interface Control {
  props: ControlProps
  disabled: boolean
  required: boolean
  placeholder: string
}

interface Shown {
  /** What the list's function gets: the matching items, or the groups that have any, with only those items. */
  entries: readonly unknown[]
  /** The matching items, across groups. */
  flat: readonly unknown[]
}

interface ComboboxInternals {
  readonly formProps: { readonly name?: string; readonly form?: string; readonly autocomplete?: string }
  readonly ids: { readonly list: string; readonly input: string; readonly native: string; readonly popup: string }
  readonly running: boolean
  readonly open: boolean
  readonly multiple: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly modal: boolean
  readonly highlightOnHover: boolean
  readonly openOnInputClick: boolean
  readonly loopFocus: boolean
  readonly hasItems: boolean
  readonly values: readonly unknown[]
  /** The values a form reset returns to: defaultValue, or the value the page loaded with when controlled. */
  readonly defaults: readonly unknown[]
  readonly inputValue: string
  /** The text the input starts with on the server. */
  readonly initialInput: string
  readonly shown: Shown
  /** How many items the list shows. */
  readonly count: number
  /** Whether the user typed a search since the list opened. */
  readonly searching: boolean
  readonly pass: number
  readonly highlightedId: string | null
  /** Whether an input sits in the popup, so the trigger outside is the control. */
  inputInPopup: boolean
  /** Marks an input in the popup that the JSX didn't show, such as one a component of yours renders. */
  markInputInPopup(): void
  /** Whether an IME composition is running in the input, so nothing writes its text. */
  composing: boolean
  /** Whether a ComboboxEmpty speaks for zero results. */
  hasEmpty: boolean
  /** The control in this pass, for the native select that renders after it. */
  control: Control
  input: HTMLInputElement | null
  trigger: HTMLElement | null
  list: HTMLElement | null
  popup: HTMLElement | null
  /** Your anchor, the chips, the input's group, the trigger or the input. */
  anchor(): Element | null
  /** Elements that count as the combobox: presses there don't close it, and focus there keeps it open. */
  areas: Set<HTMLElement>
  contains(target: Node | null): boolean
  labelOf(item: unknown): string
  valueOf(item: unknown): string
  isEqual(item: unknown, value: unknown): boolean
  isSelected(item: unknown): boolean
  /** Every item of `items`, across groups, or `undefined` without them. */
  readonly allItems: readonly unknown[] | undefined
  register(record: ItemRecord, data: ItemData): void
  unregister(record: ItemRecord): void
  changed(): void
  refresh(): void
  flush(): void
  records(): ItemRecord[]
  setOpen(
    open: boolean,
    reason: ComboboxOpenChangeReason,
    event?: Event,
    how?: { by?: OpenedBy; highlight?: FirstHighlight },
  ): void
  setInputValue(text: string, reason: ComboboxInputValueChangeReason, event?: Event, isItemPress?: boolean): boolean
  setValues(next: unknown[], reason: ComboboxValueChangeReason, event?: Event): boolean
  choose(record: ItemRecord, event: Event): void
  remove(index: number, reason: ComboboxValueChangeReason, event?: Event): boolean
  clear(reason: ComboboxValueChangeReason, event?: Event): void
  /** Resolves once the root has rendered the latest change. */
  settled(): Promise<unknown>
  /** Puts the chosen item's label back into a closed input whose text no longer matches it. */
  settleText(event?: Event): void
  highlight(record: ItemRecord | null, reason: ComboboxHighlightDetails['reason'], event?: Event): void
  highlightElement(element: HTMLElement, event?: Event): void
  highlighted(): ItemRecord | null
  navigable(): HTMLElement[]
  /** Chooses the item a typed query matches, on a closed trigger. */
  typeOnTrigger(event: KeyboardEvent): boolean
  /** Writes the input's text after a render, unless an input method is composing it. */
  syncInput(): void
  attachNative(element: HTMLSelectElement, signal: AbortSignal): void
  redirectFocus(): void
  reportInvalid(): void
  readonly invalid: boolean
  revealHighlighted(): void
  /** The element the combobox focuses: the input outside the popup, or the trigger. */
  focusTarget(): HTMLElement | null
}

const onServer = typeof document === 'undefined'

function useCombobox(handle: Handle<any, any>, part: string): ComboboxInternals {
  let api = handle.context.get(Combobox) as ComboboxInternals | undefined
  if (!api) throw new Error(`${part} must sit inside Combobox`)
  return api
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/** The text of a node, as far as it shows before rendering: strings, numbers, host elements and fragments. */
function readText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(readText).join('')
  if (isElement(node) && (typeof node.type === 'string' || node.type === Fragment)) return readText(node.props.children)
  return ''
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Every element of `type` among `node`, through host elements and fragments. */
function findAll<P>(node: unknown, type: unknown, found: P[] = []): P[] {
  if (Array.isArray(node)) {
    for (let child of node) findAll(child, type, found)
  } else if (isElement(node)) {
    if (node.type === type) found.push(node.props as P)
    else if (typeof node.type === 'string' || node.type === Fragment) findAll(node.props.children, type, found)
  }
  return found
}

/** Whether the JSX puts a ComboboxInput in ComboboxContent, as the search of a popup. */
function hasInputInPopup(children: unknown) {
  return findAll<ComboboxContentProps>(children, ComboboxContent).some(
    (content) => findAll(content.children, ComboboxInput).length > 0,
  )
}

/**
 * The items that match, at most `max` of them, in their order: what the list renders, and the same
 * items across groups. A group keeps only its matching items, and leaves without one.
 */
function take(items: ComboboxItems, matches: (item: unknown) => boolean, max: number): Shown {
  let flat: unknown[] = []
  if (!isGrouped(items)) {
    for (let item of items) {
      if (flat.length >= max) break
      if (matches(item)) flat.push(item)
    }
    return { entries: flat, flat }
  }
  let entries: unknown[] = []
  for (let group of items) {
    if (flat.length >= max) break
    let taken: unknown[] = []
    for (let item of group.items) {
      if (flat.length + taken.length >= max) break
      if (matches(item)) taken.push(item)
    }
    if (taken.length === 0) continue
    entries.push({ ...group, items: taken })
    flat.push(...taken)
  }
  return { entries, flat }
}

function isGroup(entry: unknown): entry is ComboboxItemGroup {
  return typeof entry === 'object' && entry !== null && Array.isArray((entry as { items?: unknown }).items)
}

function isGrouped(items: ComboboxItems | undefined): items is readonly ComboboxItemGroup[] {
  return items !== undefined && items.length > 0 && isGroup(items[0])
}

function flatten(items: ComboboxItems | undefined): unknown[] {
  if (!items) return []
  return isGrouped(items) ? items.flatMap((group) => group.items) : [...items]
}

function pick(props: Record<string, unknown>, names: readonly string[]) {
  let picked: Record<string, unknown> = {}
  for (let name of names) if (props[name] !== undefined) picked[name] = props[name]
  return picked
}

function omit<P extends Record<string, unknown>>(props: P, names: readonly string[]) {
  let rest = { ...props }
  for (let name of names) delete rest[name]
  return rest
}

const defaultFilters = new Map<string, ComboboxFilters>()

function filtersFor(locale: string | readonly string[] | undefined) {
  let key = JSON.stringify(locale ?? null)
  let filters = defaultFilters.get(key)
  if (!filters) {
    filters = createComboboxFilter({ locale })
    defaultFilters.set(key, filters)
  }
  return filters
}

const emptyDetailsSignal = /* @__PURE__ */ (() => {
  let controller = new AbortController()
  controller.abort()
  return controller.signal
})()

/**
 * Groups the parts of a combobox and holds its value, the input's text and
 * whether its list is open. It renders no element of its own, only the native
 * select that holds the form value, after your parts.
 */
export function Combobox<Item = any>(handle: Handle<ComboboxProps<Item>, ComboboxInternals>) {
  let records = new Set<ItemRecord>()
  // Counts changes to the items, so the root knows when a render missed one.
  let version = 0
  let renderedVersion = -1
  let position = 0
  let pass = 0
  let running = false
  let toList = (value: unknown): unknown[] => {
    if (handle.props.multiple) return Array.isArray(value) ? [...value] : []
    return value === null || value === undefined ? [] : [value]
  }
  let uncontrolledValues = toList(handle.props.defaultValue)
  // A controlled combobox resets to the value the page loaded with.
  let initialValues = toList(handle.props.value !== undefined ? handle.props.value : handle.props.defaultValue)
  // A search in the popup starts empty; an input outside it shows the chosen item's label.
  let labelled = !handle.props.multiple && !hasInputInPopup(handle.props.children)
  let initialInput =
    handle.props.inputValue ?? handle.props.defaultInputValue ?? (labelled ? labelOf(initialValues[0]) : '')
  let uncontrolledInput = handle.props.defaultInputValue ?? (labelled ? labelOf(initialValues[0]) : '')
  // The label the input last showed for the value, so a new value from outside fills it.
  let syncedLabel = labelled ? labelOf(initialValues[0]) : ''
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let wasOpen = false
  let searching = false
  let firstHighlight: FirstHighlight = 'none'
  let pendingFirst = false
  let pendingAuto = false
  let pendingReveal = false
  let highlightedId: string | null = null
  // The highlighted item, so a highlight survives its item rendering again under a new id.
  let highlightedItem: { item: unknown } | null = null
  let invalid = false
  let query: AbortController | null = null
  let typeahead = createTypeahead()
  let native: HTMLSelectElement | null = null
  let form: HTMLFormElement | null = null
  let formController: AbortController | null = null
  let shown: Shown = { entries: [], flat: [] }
  let inputSeenInPopup = false
  handle.signal.addEventListener('abort', () => {
    typeahead.reset()
    query?.abort()
    formController?.abort()
  })

  let ids = {
    list: `${handle.id}-list`,
    input: `${handle.id}-input`,
    native: `${handle.id}-native`,
    popup: `${handle.id}-popup`,
  }

  function labelOf(item: unknown): string {
    if (item === null || item === undefined) return ''
    let custom = handle.props.itemToStringLabel as ((item: unknown) => string) | undefined
    return custom ? custom(item) : defaultLabel(item)
  }

  function valueOf(item: unknown): string {
    if (item === null || item === undefined) return ''
    let custom = handle.props.itemToStringValue as ((item: unknown) => string) | undefined
    if (custom) return custom(item)
    if (typeof item === 'object' && 'value' in item) return String((item as { value: unknown }).value ?? '')
    return labelOf(item)
  }

  function equal(item: unknown, value: unknown) {
    let custom = handle.props.isItemEqualToValue as ((item: unknown, value: unknown) => boolean) | undefined
    if (item === null || item === undefined || value === null || value === undefined) return item === value
    return custom ? custom(item, value) : Object.is(item, value)
  }

  function isControlled() {
    return handle.props.value !== undefined
  }

  function currentValues(): unknown[] {
    return isControlled() ? toList(handle.props.value) : uncontrolledValues
  }

  function currentInput() {
    return handle.props.inputValue ?? uncontrolledInput
  }

  function isDisabled() {
    return Boolean(handle.props.disabled) || api.control.disabled
  }

  function isOpen() {
    return running && !isDisabled() && (handle.props.open ?? uncontrolledOpen)
  }

  function sortedRecords() {
    return [...records].sort((a, b) => a.position - b.position)
  }

  /** The search: the input's text, unless it is only the chosen item's label. */
  function currentQuery() {
    let text = currentInput().trim()
    if (handle.props.multiple || searching || text === '' || api.inputInPopup) return text
    let label = labelOf(currentValues()[0]).trim()
    return label.length === text.length && filtersFor(handle.props.locale).contains(label, text) ? '' : text
  }

  function computeShown(): Shown {
    let { items, filteredItems, limit = -1 } = handle.props
    let max = limit > -1 ? limit : Infinity
    // Your results are shown as you pass them, up to the limit.
    if (filteredItems) return take(filteredItems, () => true, max)
    if (!items) return { entries: [], flat: [] }
    let search = currentQuery()
    let filter =
      handle.props.filter === null
        ? () => true
        : ((handle.props.filter as ComboboxFilter | undefined) ??
          ((item: unknown, text: string, toString: (item: unknown) => string) =>
            filtersFor(handle.props.locale).contains(item, text, toString)))
    return take(items, (item) => search === '' || filter(item, search, labelOf), max)
  }

  function findRecord(item: unknown) {
    return sortedRecords().find((record) => equal(record.item, item))
  }

  /**
   * Whether an item shows, so the keys may reach it. While the list opens, its items are in the
   * document, and the popover shows them once the render that opens it commits: keys pressed
   * before that count them already.
   */
  function isShown(element: HTMLElement | null): element is HTMLElement {
    if (!element?.isConnected || element.closest('[inert]')) return false
    return api.popup?.matches(':popover-open') === false ? true : isFocusableItem(element)
  }

  function firstEnabled(list: ItemRecord[]) {
    return list.find((record) => !record.disabled && isShown(record.element)) ?? null
  }

  function navigableRecords() {
    return sortedRecords().filter((record) => isShown(record.element))
  }

  function setHighlight(record: ItemRecord | null, reason: ComboboxHighlightDetails['reason'], event?: Event) {
    let id = record?.id ?? null
    if (id === highlightedId) return false
    highlightedId = id
    highlightedItem = record ? { item: record.item } : null
    let onItemHighlighted = handle.props.onItemHighlighted as
      ((item: unknown, details: ComboboxHighlightDetails) => void) | undefined
    onItemHighlighted?.(record?.item, { reason, event })
    return true
  }

  /** Puts the highlight where it belongs once the items of a render registered. Says whether it moved. */
  function resolveHighlight() {
    if (!isOpen()) return setHighlight(null, 'none')
    let list = navigableRecords()
    let mode: FirstHighlight | 'auto' | 'keep' = 'keep'
    if (pendingFirst) mode = firstHighlight
    else if (pendingAuto) mode = 'auto'
    pendingFirst = false
    pendingAuto = false
    let autoHighlight = handle.props.autoHighlight
    if (mode === 'auto') {
      if (autoHighlight && currentInput().trim() !== '') return reveal(setHighlight(firstEnabled(list), 'none'))
      return setHighlight(null, 'none')
    }
    if (mode !== 'keep') {
      let selected = handle.props.multiple
        ? null
        : (list.find((record) => !record.disabled && api.isSelected(record.item)) ?? null)
      let target =
        mode === 'first'
          ? (selected ?? firstEnabled(list))
          : mode === 'last'
            ? (selected ?? firstEnabled([...list].reverse()))
            : mode === 'selected'
              ? selected
              : null
      if (!target && autoHighlight === 'always') target = firstEnabled(list)
      return reveal(setHighlight(target, 'none'))
    }
    let current = list.find((record) => record.id === highlightedId)
    if (current && !current.disabled) return false
    // The highlighted item went away, rendered again under a new id, or turned off.
    let again = highlightedItem
      ? list.find((record) => !record.disabled && equal(record.item, highlightedItem!.item))
      : undefined
    if (again) return setHighlight(again, 'none')
    if (autoHighlight === 'always' || (autoHighlight && currentInput().trim() !== '')) {
      return reveal(setHighlight(firstEnabled(list), 'none'))
    }
    return setHighlight(null, 'none')
  }

  function reveal(moved: boolean) {
    if (moved) pendingReveal = true
    return moved
  }

  function readNative(): unknown[] {
    if (!native) return currentValues()
    let wanted = [...native.selectedOptions].map((option) => option.value).filter((value) => value !== '')
    let known = [...flatten(handle.props.items), ...currentValues(), ...api.defaults]
    return wanted.map((value) => known.find((item) => valueOf(item) === value) ?? value)
  }

  function writeNative(values: readonly unknown[]) {
    if (!native) return
    let wanted = new Set(values.map(valueOf))
    let placeholderTaken = false
    for (let option of native.options) {
      let selected =
        option.value === '' ? !native.multiple && wanted.size === 0 && !placeholderTaken : wanted.has(option.value)
      if (option.value === '' && selected) placeholderTaken = true
      if (option.selected !== selected) option.selected = selected
    }
  }

  /** Brings the native select in line with the value, and its defaults with the reset value, after a render. */
  function syncNative() {
    if (!native) return
    let defaults = new Set(api.defaults.map(valueOf))
    let placeholderTaken = false
    for (let option of native.options) {
      let wanted =
        option.value === '' ? !native.multiple && defaults.size === 0 && !placeholderTaken : defaults.has(option.value)
      if (option.value === '' && wanted) placeholderTaken = true
      if (option.defaultSelected !== wanted) option.defaultSelected = wanted
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
        // The form resets its controls after the reset event, unless a listener canceled it.
        setTimeout(() => {
          if (handle.signal.aborted || event.defaultPrevented) return
          invalid = false
          let defaults = [...api.defaults]
          api.setValues(defaults, 'reset', event)
          api.setInputValue(handle.props.multiple ? '' : labelOf(currentValues()[0]), 'reset', event)
          void handle.update()
        })
      },
      { signal: formController.signal },
    )
  }

  function start() {
    running = true
    // The native select hides now: focus on it moves on to the control.
    let focused = native !== null && native.ownerDocument.activeElement === native
    if (focused) {
      void handle.update().then(() => {
        if (native?.ownerDocument.activeElement === native) api.focusTarget()?.focus({ preventScroll: true })
      })
    }
    // In server HTML, a choice the user made before the script ran, or that the browser restored, wins.
    let served = native?.hasAttribute('data-served')
    native?.removeAttribute('data-served')
    if (served && native && [...native.options].some((option) => option.selected !== option.defaultSelected)) {
      if (api.setValues(readNative(), 'native-change')) {
        if (!handle.props.multiple) api.setInputValue(labelOf(currentValues()[0]), 'none')
      }
    }
    if (isOpen()) pendingFirst = true
    void handle.update()
  }

  let api: ComboboxInternals = {
    ids,
    get formProps() {
      let { name, form, autocomplete } = handle.props
      return { name, form, autocomplete }
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
      return Boolean(handle.props.required) || api.control.required
    },
    get modal() {
      return handle.props.modal ?? false
    },
    get highlightOnHover() {
      return handle.props.highlightItemOnHover ?? true
    },
    get openOnInputClick() {
      return handle.props.openOnInputClick ?? true
    },
    get loopFocus() {
      return handle.props.loopFocus ?? true
    },
    get hasItems() {
      return handle.props.items !== undefined || handle.props.filteredItems !== undefined
    },
    get values() {
      return currentValues()
    },
    get defaults() {
      return isControlled() ? initialValues : toList(handle.props.defaultValue)
    },
    get inputValue() {
      return currentInput()
    },
    get initialInput() {
      return initialInput
    },
    get shown() {
      return shown
    },
    get count() {
      return api.hasItems ? shown.flat.length : records.size
    },
    get searching() {
      return searching
    },
    get pass() {
      return pass
    },
    get highlightedId() {
      return highlightedId
    },
    get invalid() {
      return invalid
    },
    inputInPopup: false,
    markInputInPopup() {
      if (inputSeenInPopup) return
      inputSeenInPopup = true
      if (api.inputInPopup) return
      api.inputInPopup = true
      // The search a component of yours put in the popup starts empty too.
      if (handle.props.defaultInputValue === undefined && !searching) uncontrolledInput = ''
      api.refresh()
    },
    composing: false,
    hasEmpty: false,
    control: { props: {}, disabled: false, required: false, placeholder: '' },
    input: null,
    trigger: null,
    list: null,
    popup: null,
    areas: new Set(),
    anchor() {
      let input = api.inputInPopup ? null : api.input
      return input?.closest('[data-slot="combobox-chips"], [data-slot="combobox-input"]') ?? api.trigger ?? api.input
    },
    contains(target) {
      if (!target) return false
      if (api.popup?.contains(target)) return true
      for (let area of api.areas) if (area.contains(target)) return true
      return false
    },
    labelOf,
    valueOf,
    isEqual: equal,
    get allItems() {
      return handle.props.items ? flatten(handle.props.items) : undefined
    },
    isSelected(item) {
      return currentValues().some((value) => equal(item, value))
    },
    register(record, data) {
      let known = records.has(record)
      record.position = position++
      let changed =
        !known ||
        record.item !== data.item ||
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
      // After the commit that removed it, which may have removed the combobox too.
      queueMicrotask(() => {
        if (!handle.signal.aborted && running) void handle.update()
      })
    },
    changed() {
      version++
      if (running && !handle.signal.aborted) void handle.update()
    },
    refresh() {
      if (running && !handle.signal.aborted) void handle.update()
    },
    flush() {
      if (version !== renderedVersion) api.refresh()
    },
    records: sortedRecords,
    setOpen(open, reason, event, how = {}) {
      if (!running || handle.signal.aborted) return
      if (open && isDisabled()) return
      if (open === isOpen()) return
      let details = createDetails(reason, event)
      handle.props.onOpenChange?.(open, details)
      if (details.isCanceled) return
      if (open) {
        firstHighlight = how.highlight ?? 'none'
        pendingFirst = true
      }
      if (handle.props.open === undefined) uncontrolledOpen = open
      // The items of the closed list are those the open one shows, unless the text just changed: the
      // first highlight is known now, so a key pressed before the render steps from it.
      if (open && isOpen() && reason !== 'input-change' && version === renderedVersion) resolveHighlight()
      if (!open) {
        let insidePopup = api.popup?.contains(api.popup.ownerDocument.activeElement) ?? false
        searching = false
        setHighlight(null, 'none', event)
        // The text was a search: it goes back to the chosen item's label, or empties. A choice
        // already wrote its label, which a controlled owner may not have rendered yet.
        if (handle.props.multiple || api.inputInPopup) {
          if (currentInput() !== '') api.setInputValue('', 'input-clear', event, reason === 'item-press')
        } else if (reason !== 'item-press') {
          let label = labelOf(currentValues()[0])
          if (currentInput() !== label) api.setInputValue(label, label === '' ? 'input-clear' : 'none', event)
        }
        // Focus in the popup goes back to the trigger; a press outside may have left it nowhere.
        if (insidePopup || reason === 'outside-press') {
          setTimeout(() => {
            let target = api.focusTarget()
            let active = target?.ownerDocument.activeElement
            if (!target?.isConnected) return
            if (
              insidePopup
                ? !active || active === target.ownerDocument.body || api.popup?.contains(active)
                : !active || active === target.ownerDocument.body
            ) {
              target.focus({ preventScroll: true })
            }
          })
        }
      }
      void handle.update()
    },
    setInputValue(text, reason, event, isItemPress) {
      // Work a timer or a listener started may outlive the combobox: it tells its owner nothing.
      if (handle.signal.aborted) return false
      // The text a choice, a clear or Escape writes stands for the value they ask for, also when the
      // text already reads it, and a controlled owner may still decline that value: the closed input
      // then follows the value the owner keeps.
      let requested = reason === 'item-press' || reason === 'clear-press' || reason === 'escape-key'
      if (!handle.props.multiple && requested) syncedLabel = text
      if (text === currentInput() && reason !== 'reset') return true
      query?.abort()
      query = onServer ? null : new AbortController()
      let details = Object.assign(createDetails(reason, event), {
        signal: query?.signal ?? emptyDetailsSignal,
        isItemPress,
      }) as ComboboxInputValueChangeDetails
      handle.props.onInputValueChange?.(text, details)
      if (details.isCanceled) {
        void handle.update()
        return false
      }
      if (handle.props.inputValue === undefined) uncontrolledInput = text
      if (reason === 'input-change') {
        if (text.trim() !== '') searching = true
        pendingAuto = true
      } else if (reason === 'item-press' || reason === 'clear-press' || reason === 'reset') {
        searching = false
      }
      if (!handle.props.multiple && !requested) syncedLabel = labelOf(currentValues()[0])
      void handle.update()
      return true
    },
    setValues(next, reason, event) {
      if (handle.signal.aborted) return false
      let current = currentValues()
      if (next.length === current.length && next.every((value, index) => equal(value, current[index]))) return true
      let details = createDetails(reason, event)
      let multiple = Boolean(handle.props.multiple)
      let onValueChange = handle.props.onValueChange as
        ((value: unknown, details: ComboboxValueChangeDetails) => void) | undefined
      onValueChange?.(multiple ? [...next] : (next[0] ?? null), details)
      if (details.isCanceled) {
        void handle.update()
        return false
      }
      if (!isControlled()) uncontrolledValues = next
      if (native && reason !== 'native-change' && reason !== 'reset') {
        // As a native select: the form already holds the new value when input and change fire.
        void handle.update().then(() => {
          if (!native || handle.signal.aborted) return
          writeNative(currentValues())
          native.dispatchEvent(new Event('input', { bubbles: true }))
          native.dispatchEvent(new Event('change', { bubbles: true }))
          if (invalid && native.checkValidity()) {
            invalid = false
            void handle.update()
          }
        })
      }
      void handle.update()
      return true
    },
    choose(record, event) {
      if (record.disabled || !isOpen()) return
      if (handle.props.readOnly) {
        if (!handle.props.multiple) api.setOpen(false, 'item-press', event)
        return
      }
      let values = currentValues()
      if (!handle.props.multiple) {
        if (!api.setValues([record.item], 'item-press', event)) return
        if (!api.inputInPopup) api.setInputValue(labelOf(record.item), 'item-press', event)
        api.setOpen(false, 'item-press', event)
        return
      }
      let chosen = values.some((value) => equal(record.item, value))
      let next = chosen ? values.filter((value) => !equal(record.item, value)) : [...values, record.item]
      if (!api.setValues(next, 'item-press', event)) return
      // Choosing from a search starts over: the input clears, and outside the popup the list closes.
      let filtering = (api.input?.value ?? currentInput()).trim() !== ''
      if (!filtering) return
      if (api.inputInPopup) api.setInputValue('', 'input-clear', event, true)
      else api.setOpen(false, 'item-press', event)
    },
    remove(index, reason, event) {
      let values = currentValues()
      if (index < 0 || index >= values.length) return false
      let removed = values[index]
      if (highlightedItem && equal(highlightedItem.item, removed)) setHighlight(null, 'none', event)
      return api.setValues(
        values.filter((_, at) => at !== index),
        reason,
        event,
      )
    },
    clear(reason, event) {
      if (!api.setValues([], reason, event)) return
      api.setInputValue('', reason === 'escape-key' ? 'escape-key' : 'clear-press', event)
      setHighlight(null, 'none', event)
    },
    settled() {
      return handle.update()
    },
    settleText(event) {
      if (handle.props.multiple || api.inputInPopup || isOpen()) return
      // Text left after editing, such as an emptied input whose clear a controlled owner declined.
      let label = labelOf(currentValues()[0])
      if (currentInput() !== label) api.setInputValue(label, label === '' ? 'input-clear' : 'none', event)
    },
    highlight(record, reason, event) {
      if (setHighlight(record, reason, event)) void handle.update()
    },
    highlightElement(element, event) {
      let record = sortedRecords().find((entry) => entry.element === element)
      if (record && setHighlight(record, 'keyboard', event)) {
        pendingReveal = true
        void handle.update()
      }
    },
    highlighted() {
      let record = sortedRecords().find((entry) => entry.id === highlightedId)
      // Never one that left the document, is hidden or is disabled, so no stale item is chosen.
      return record && isShown(record.element) && !record.disabled ? record : null
    },
    navigable() {
      if (!isOpen()) return []
      return navigableRecords().map((record) => record.element as HTMLElement)
    },
    typeOnTrigger(event) {
      let typed = typeahead.type(event)
      if (typed === undefined) return false
      if (handle.props.readOnly || handle.props.multiple) return true
      let list = flatten(handle.props.items)
      let labels = list.map(labelOf)
      let current = list.findIndex((item) => api.isSelected(item))
      let disabled = list.map((item) => findRecord(item)?.disabled ?? false)
      let index = findTypeaheadMatch(labels, typed, current, disabled)
      if (index === -1) return true
      api.setValues([list[index]], 'none', event)
      return true
    },
    syncInput() {
      let input = api.input
      if (!input || api.composing) return
      let text = currentInput()
      if (input.value !== text) input.value = text
    },
    attachNative(element, signal) {
      native = element
      signal.addEventListener('abort', () => {
        if (native === element) native = null
      })
    },
    redirectFocus() {
      if (running) api.focusTarget()?.focus({ preventScroll: true })
    },
    reportInvalid() {
      let target =
        api.focusTarget()?.closest<HTMLElement>('[data-slot="combobox-input"], [data-slot="combobox-chips"]') ??
        api.focusTarget()
      if (!running || !native || !target) return
      // The browser shows its message at the native select and focuses it, which hands focus on
      // to the input: so the message points at the input, the select goes over it first.
      let wrapper = native.parentElement
      if (wrapper) {
        let from = wrapper.getBoundingClientRect()
        let to = target.getBoundingClientRect()
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
    revealHighlighted() {
      if (!pendingReveal) return
      pendingReveal = false
      let list = api.list
      let item = sortedRecords().find((record) => record.id === highlightedId)?.element
      if (list && item) revealInList(list, item)
    },
    focusTarget() {
      if (api.inputInPopup) return api.trigger
      return api.input ?? api.trigger
    },
  }
  handle.context.set(api)

  return () => {
    let { children, multiple } = handle.props
    position = 0
    pass++
    renderedVersion = version
    // A trigger renders before the content, so the JSX tells it whether the search sits in the popup.
    api.inputInPopup = inputSeenInPopup || hasInputInPopup(children)

    // A new value from outside fills a single combobox's input while the list is closed.
    if (!multiple && running && !isOpen() && handle.props.inputValue === undefined && !api.inputInPopup) {
      let label = labelOf(currentValues()[0])
      if (label !== syncedLabel) {
        syncedLabel = label
        uncontrolledInput = label
      }
    }
    // A combobox that turns off closes, and stays closed once it turns on again.
    if (isDisabled() && handle.props.open === undefined) uncontrolledOpen = false
    let open = isOpen()
    if (!open && wasOpen) {
      searching = false
      highlightedId = null
      highlightedItem = null
    }
    wasOpen = open
    shown = computeShown()

    if (!onServer) {
      handle.queueTask(() => {
        if (!running) return start()
        // An item changed after the input rendered.
        if (version !== renderedVersion) return void handle.update()
        syncNative()
        syncForm()
        api.syncInput()
        if (resolveHighlight()) void handle.update()
      })
    }

    return (
      <>
        {children}
        <ComboboxNative />
      </>
    )
  }
}

/** Scrolls the list, and only the list, until the item shows inside it. */
function revealInList(list: HTMLElement, item: HTMLElement) {
  let style = getComputedStyle(list)
  let box = list.getBoundingClientRect()
  let top = box.top + list.clientTop + (parseFloat(style.scrollPaddingBlockStart) || 0)
  let bottom = box.top + list.clientTop + list.clientHeight - (parseFloat(style.scrollPaddingBlockEnd) || 0)
  let rect = item.getBoundingClientRect()
  if (rect.top < top) list.scrollTop -= top - rect.top
  else if (rect.bottom > bottom) list.scrollTop += rect.bottom - bottom
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const textSm = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }

// Until the combobox runs, the native select is the control. theme.css hides [hidden] with
// !important, and so does this, so no rule of yours shows the part early.
const pending = { '&[data-pending]': { display: 'none !important' } }

export interface ComboboxAnchor {
  /** The element, once it is in the document. */
  readonly current: HTMLElement | null
  /** Put it in the `mix` of the element to anchor to. */
  readonly mix: ReturnType<typeof ref>
}

/**
 * Makes an anchor for ComboboxContent, in place of shadcn's
 * useComboboxAnchor(): call it once in your component's setup, put `mix` on
 * the element the list should line up with, and pass the anchor to
 * ComboboxContent's `anchor`. ComboboxChips anchors the list by itself.
 */
export function createComboboxAnchor(): ComboboxAnchor {
  let element: HTMLElement | null = null
  return {
    get current() {
      return element
    },
    mix: ref((node, signal) => {
      element = node as HTMLElement
      signal.addEventListener('abort', () => {
        if (element === node) element = null
      })
    }),
  }
}

/** Keeps an element in the combobox's areas while it is in the document. */
function area(api: ComboboxInternals) {
  return ref((node, signal) => {
    let element = node as HTMLElement
    api.areas.add(element)
    signal.addEventListener('abort', () => api.areas.delete(element))
  })
}

// A press that starts on the combobox's own box but outside the input focuses the input, and
// opens the list as a press on the input would.
function pressInput(api: ComboboxInternals, event: MouseEvent) {
  if (event.button !== 0 || api.disabled || !api.running) return
  let target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, button, a[href], [tabindex]:not([data-slot="combobox-chips"])')) return
  event.preventDefault()
  api.input?.focus()
  if (api.openOnInputClick) api.setOpen(true, 'input-press', event, { by: 'pointer', highlight: 'selected' })
}

interface FieldProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'value' | 'defaultValue' | 'list' | 'aria-activedescendant'
> {
  variant: 'group' | 'chips'
}

type GroupInputProps = Parameters<typeof InputGroupInput>[0]['props']

const chipsInputRule = css({
  flex: '1 1 4rem',
  minWidth: '4rem',
  margin: 0,
  padding: 0,
  border: 0,
  backgroundColor: 'transparent',
  color: 'inherit',
  fontFamily: 'inherit',
  ...textSm,
  outline: 'none',
  '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
  '&:disabled': { cursor: 'not-allowed' },
  ...pending,
})

/** The text input of ComboboxInput and ComboboxChipsInput: a native input with the combobox role. */
function ComboboxField(handle: Handle<FieldProps>) {
  let api = useCombobox(handle, 'ComboboxInput')
  let inPopup = handle.context.get(ComboboxContent) !== undefined
  let chips = handle.context.get(ComboboxChips) as ChipsApi | undefined
  let element: HTMLInputElement | null = null
  // Whether the input has focus, also while it leaves the document.
  let focused = false

  function onInput(event: Event) {
    let input = event.currentTarget as HTMLInputElement
    if (!api.running) return
    // An input method is still composing: compositionend commits its text.
    if ((event as InputEvent).isComposing || api.composing) {
      if (input.value.trim() !== '' && !api.readOnly) api.setOpen(true, 'input-change', event, { by: 'input' })
      return
    }
    commit(input, event)
  }

  function commit(input: HTMLInputElement, event: Event) {
    let text = input.value
    if (!api.setInputValue(text, 'input-change', event)) return
    if (text === '' && !inPopup) {
      if (!api.multiple) api.setValues([], 'input-clear', event)
      if (!api.openOnInputClick) api.setOpen(false, 'input-clear', event)
    }
    if (text.trim() !== '' && !api.readOnly) api.setOpen(true, 'input-change', event, { by: 'input' })
  }

  function onKeyDown(event: KeyboardEvent) {
    let input = event.currentTarget as HTMLInputElement
    if (!api.running || event.defaultPrevented || event.isComposing || event.keyCode === 229 || api.composing) return
    if (event.ctrlKey || event.metaKey) return
    let { key } = event
    let open = api.open
    if (api.disabled) return
    if (api.readOnly) {
      // Browsing can highlight an item, and Enter there must not submit the form.
      if (key === 'Enter' && open && api.highlighted()) event.preventDefault()
      if (!open && (key === 'ArrowDown' || key === 'ArrowUp')) {
        event.preventDefault()
        api.setOpen(true, 'list-navigation', event, { by: 'keyboard', highlight: key === 'ArrowUp' ? 'last' : 'first' })
      }
      return
    }

    // Chips: Backspace in an empty input removes the last one, and the arrow toward them focuses it.
    if (chips && !event.altKey && !event.shiftKey) {
      let previous = getComputedStyle(input).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      let caretAtStart = input.selectionStart === 0 && input.selectionEnd === 0
      if (key === 'Backspace' && input.value === '' && api.values.length > 0) {
        event.preventDefault()
        api.remove(api.values.length - 1, 'none', event)
        return
      }
      if (key === previous && caretAtStart && api.values.length > 0) {
        let last = chips.elements().at(-1)
        if (last) {
          event.preventDefault()
          last.focus()
          return
        }
      }
    }

    if (key === 'Escape') {
      // Escape on an open list belongs to the layer, which closes it.
      if (open) return
      let empty = api.values.length === 0 && input.value === ''
      if (empty || inPopup) return
      event.preventDefault()
      event.stopPropagation()
      api.clear('escape-key', event)
      return
    }

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault()
        let highlight: FirstHighlight = event.altKey ? 'none' : key === 'ArrowUp' ? 'last' : 'first'
        api.setOpen(true, 'list-navigation', event, { by: 'keyboard', highlight })
      }
      return
    }

    // A modal list keeps the page inert, so the browser has nowhere to move focus: the combobox
    // closes, and moves focus to the next stop, or the one before with Shift, once the page is back.
    if (key === 'Tab' && api.modal) {
      event.preventDefault()
      api.setOpen(false, 'focus-out', event)
      setTimeout(() => {
        if (api.open || input.ownerDocument.activeElement !== input) return
        let stops = getTabbableElements(input.closest('dialog:modal') ?? input.ownerDocument.body)
        let index = stops.indexOf(input)
        if (index !== -1) stops[index + (event.shiftKey ? -1 : 1)]?.focus()
      })
      return
    }

    let highlighted = api.highlighted()
    if (key === 'Enter') {
      if (!highlighted) {
        // Nothing to choose: the list closes, and the form may submit.
        api.setOpen(false, 'none', event)
        return
      }
      event.preventDefault()
      highlighted.element?.click()
      return
    }
    if (key === ' ' && input.value === '' && highlighted) {
      event.preventDefault()
      highlighted.element?.click()
      return
    }
    // With loopFocus, the input sits between the last and the first item.
    if ((key === 'ArrowDown' || key === 'ArrowUp') && !event.altKey && api.loopFocus && highlighted) {
      let items = api.navigable().filter((item) => item.getAttribute('aria-disabled') !== 'true')
      let end = key === 'ArrowDown' ? items.at(-1) : items[0]
      if (highlighted.element === end) {
        event.preventDefault()
        api.highlight(null, 'keyboard', event)
      }
    }
  }

  function onFocusOut(event: FocusEvent) {
    let next = event.relatedTarget
    if (next instanceof Node && api.contains(next)) return
    let document = (event.currentTarget as HTMLElement).ownerDocument
    // Once the browser has moved focus.
    document.defaultView?.setTimeout(() => {
      let active = document.activeElement
      if (active && api.contains(active)) return
      // Closing ends the search; with the list closed already, editing ends as focus leaves.
      if (api.open) api.setOpen(false, 'focus-out', event)
      else api.settleText(event)
    })
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !api.running || api.disabled || !api.openOnInputClick || inPopup) return
    if (!api.open) api.setOpen(true, 'input-press', event, { by: 'pointer', highlight: 'selected' })
  }

  let typed = activeDescendant({
    items: () => api.navigable(),
    orientation: 'vertical',
    loop: false,
    homeAndEnd: false,
    current: () => api.highlighted()?.element ?? null,
    highlight: (item) => api.highlightElement(item),
  })

  return () => {
    api = useCombobox(handle, 'ComboboxInput')
    let { variant, disabled: ownDisabled, required, placeholder, readOnly, name, mix, ...props } = handle.props
    let control = pick(props as Record<string, unknown>, controlPropNames) as ControlProps
    let rest = omit(props as Record<string, unknown>, controlPropNames)
    if (!inPopup) {
      api.control = {
        props: control,
        disabled: Boolean(ownDisabled),
        required: Boolean(required),
        placeholder: collapse(String(placeholder ?? '')),
      }
    } else api.markInputInPopup()
    let running = api.running
    let open = api.open
    let disabled = api.disabled || Boolean(ownDisabled)
    let invalid = control['aria-invalid'] ?? (api.invalid && !inPopup ? 'true' : undefined)
    // The id and ARIA props of the control go to the native select until the combobox runs.
    let own = inPopup || running ? ariaStates({ ...control, 'aria-invalid': invalid }) : {}
    let id = inPopup ? (control.id ?? api.ids.input) : running ? (control.id ?? api.ids.input) : api.ids.input

    let attributes = {
      autocomplete: 'off',
      spellcheck: 'false',
      autocapitalize: 'none',
      ...rest,
      ...own,
      id,
      type: 'text',
      role: 'combobox',
      'aria-autocomplete': 'list' as const,
      'aria-haspopup': 'listbox' as const,
      'aria-expanded': open ? ('true' as const) : ('false' as const),
      'aria-controls': api.ids.list,
      'aria-activedescendant': open ? (api.highlightedId ?? undefined) : undefined,
      'aria-required': api.required && !inPopup ? ('true' as const) : undefined,
      'aria-readonly': api.readOnly ? ('true' as const) : undefined,
      // A name submits the text, which is the chosen label once the list closes. It waits for the
      // script, so a page without one never sends a text the native select doesn't match.
      name: running ? name : undefined,
      placeholder,
      readOnly: readOnly || api.readOnly,
      disabled,
      defaultValue: inPopup ? '' : api.initialInput,
      'data-slot': variant === 'chips' ? 'combobox-chip-input' : 'combobox-input-control',
      'data-popup-open': open ? '' : undefined,
      'data-pending': running ? undefined : '',
    }
    let behavior = [
      ref((node, signal) => {
        let input = node as HTMLInputElement
        element = input
        api.input = input
        api.syncInput()
        signal.addEventListener('abort', () => {
          let document = input.ownerDocument
          if (api.input === input) api.input = null
          if (element === input) element = null
          // Your JSX may render the input anew, as shadcn's chips do once the last chip goes:
          // focus it held moves on to the new one.
          if (!focused && document.activeElement !== input) return
          queueMicrotask(() => {
            let next = api.input
            let active = document.activeElement
            if (input.isConnected || !next || next === input || !next.isConnected) return
            if (!active || active === document.body) next.focus({ preventScroll: true })
          })
        })
      }),
      on<HTMLInputElement, 'focusin'>('focusin', () => {
        focused = true
      }),
      on<HTMLInputElement, 'focusout'>('focusout', (event) => {
        if (event.relatedTarget) return void (focused = false)
        // Focus went nowhere: the page lost it, or the input is leaving. Chromium fires this while
        // it removes the input, so decide once the removal is done.
        let input = event.currentTarget
        queueMicrotask(() => {
          if (input.isConnected) focused = false
        })
      }),
      on<HTMLInputElement, 'compositionstart'>('compositionstart', () => {
        api.composing = true
      }),
      on<HTMLInputElement, 'compositionend'>('compositionend', (event) => {
        api.composing = false
        if (api.running) commit(event.currentTarget, event)
      }),
      on<HTMLInputElement, 'input'>('input', onInput),
      on<HTMLInputElement, 'keydown'>('keydown', onKeyDown),
      typed,
      on<HTMLInputElement, 'pointerdown'>('pointerdown', onPointerDown),
      on<HTMLInputElement, 'focusout'>('focusout', onFocusOut),
    ]

    if (variant === 'group') {
      return <InputGroupInput {...(attributes as GroupInputProps)} mix={[mix, ...behavior]} />
    }
    return <input {...(attributes as Props<'input'>)} mix={[chipsInputRule, mix, ...behavior]} />
  }
}

const inputGroupRule = css({
  width: 'auto',
  ...pending,
  // In the popup, the search sits in a quieter box at the top. shadcn's bg-input/30 reads as a
  // gray bar over RemixCN's darker light --input, so the light fill is --muted, the color shadcn's makes.
  ':where([data-slot="combobox-content"]) > &': {
    margin: space(1),
    marginBlockEnd: 0,
    minHeight: space(8),
    borderColor: 'light-dark(var(--muted), color-mix(in oklab, var(--input) 30%, transparent))',
    backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--input) 30%, transparent))',
    boxShadow: 'none',
  },
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})

// The chevron gives way to the clear button while there is a value to clear.
const triggerButtonRule = css({
  '&[aria-expanded="true"]': { backgroundColor: 'transparent' },
  ':where([data-slot="combobox-input"]:has([data-slot="combobox-clear"])) &': { display: 'none' },
  '& svg': { color: 'var(--muted-foreground)' },
})

export interface ComboboxInputProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'value' | 'defaultValue' | 'list' | 'aria-activedescendant' | 'children' | 'mix'
> {
  /** Your mixins for the input group around the input. */
  mix?: Props<'div'>['mix']
  /** Shows the chevron that opens the list (defaults to `true`). */
  showTrigger?: boolean
  /** Shows a button that clears the value while there is one (defaults to `false`). */
  showClear?: boolean
  /** The chevron's name for assistive technology (defaults to `'Show suggestions'`). */
  triggerLabel?: string
  /** The clear button's name (defaults to `'Clear'`). */
  clearLabel?: string
  /** Addons, such as an InputGroupAddon with an icon. */
  children?: RemixNode
}

/**
 * The text input in an InputGroup, with a chevron that opens the list and an
 * optional clear button. Your `mix`, `class` and `style` go to the group, as
 * shadcn's `className` does, and every other prop to the input. Its id and
 * ARIA props go to the native select until the combobox runs, so a label's
 * `for` names whichever control shows.
 */
export function ComboboxInput(handle: Handle<ComboboxInputProps>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxInput')
    let {
      showTrigger = true,
      showClear = false,
      triggerLabel = 'Show suggestions',
      clearLabel = 'Clear',
      children,
      mix,
      class: className,
      style,
      ...props
    } = handle.props
    let disabled = api.disabled || Boolean(props.disabled)
    let inPopup = handle.context.get(ComboboxContent) !== undefined

    return (
      <InputGroup
        data-slot="combobox-input"
        data-pending={api.running || inPopup ? undefined : ''}
        data-disabled={disabled ? 'true' : undefined}
        // Only when you pass them, so a render doesn't write the group's style anew for nothing. When
        // yours changes, the positioning writes its anchor name on the group again.
        {...(className === undefined ? {} : { class: className })}
        {...(style === undefined ? {} : { style })}
        mix={[inputGroupRule, mix, ...(inPopup ? [] : [area(api)])]}
      >
        <ComboboxField {...props} variant="group" />
        {showTrigger || showClear ? (
          <InputGroupAddon align="inline-end">
            {showTrigger ? (
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                data-slot="combobox-trigger"
                tabindex={-1}
                aria-label={triggerLabel}
                aria-haspopup="listbox"
                aria-expanded={api.open ? 'true' : 'false'}
                aria-controls={api.ids.list}
                disabled={disabled}
                mix={[triggerButtonRule, triggerPress(api, 'input')]}
              >
                <ChevronDownIcon />
              </InputGroupButton>
            ) : null}
            {showClear ? <ComboboxClear label={clearLabel} disabled={disabled} /> : null}
          </InputGroupAddon>
        ) : null}
        {children}
      </InputGroup>
    )
  }
}

/** Opens and closes the list from a button beside the input, and keeps focus in the input. */
function triggerPress(api: ComboboxInternals, kind: 'input' | 'trigger') {
  return [
    on<HTMLButtonElement, 'mousedown'>('mousedown', (event) => {
      if (event.button !== 0 || kind !== 'input') return
      // The input keeps focus, so typing still searches.
      event.preventDefault()
    }),
    on<HTMLButtonElement, 'click'>('click', (event) => {
      if (event.defaultPrevented || !api.running || event.currentTarget.disabled) return
      if (kind === 'input') api.input?.focus()
      let by: OpenedBy = event.detail === 0 ? 'keyboard' : 'pointer'
      api.setOpen(!api.open, 'trigger-press', event, { by, highlight: 'selected' })
    }),
  ]
}

const clearRule = css({ '& svg': { color: 'var(--muted-foreground)' } })

/** Clears the value and the text while there is either, and keeps focus in the input. */
function ComboboxClear(handle: Handle<{ label: string; disabled: boolean }>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxClear')
    let visible = api.values.length > 0 || (api.running && api.inputValue !== '')
    if (!visible) return null
    let { label, disabled } = handle.props
    return (
      <InputGroupButton
        size="icon-xs"
        variant="ghost"
        data-slot="combobox-clear"
        data-visible=""
        tabindex={-1}
        aria-label={label}
        disabled={disabled}
        mix={[
          clearRule,
          on<HTMLButtonElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
          on<HTMLButtonElement, 'click'>('click', (event) => {
            if (event.defaultPrevented || !api.running || api.readOnly) return
            api.clear('clear-press', event)
            api.input?.focus()
          }),
        ]}
      >
        <XIcon />
      </InputGroupButton>
    )
  }
}

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
      overflowWrap: 'break-word',
      '&[data-placeholder]': { color: 'var(--muted-foreground)' },
      // shadcn's 50% tint drops the dark placeholder below 4.5:1; 40% keeps it.
      '&:hover:not(:disabled)': {
        backgroundColor: 'light-dark(var(--accent), color-mix(in oklab, var(--input) 40%, transparent))',
      },
      '&:focus-visible': { borderColor: 'var(--ring)' },
      '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
      '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
      '& [data-slot="combobox-trigger-icon"]': { display: 'flex', color: 'var(--muted-foreground)' },
      ...pending,
    },
    transition('color', 'background-color', 'border-color', 'box-shadow'),
    invalidState,
    fieldItem,
    buttonGroupItem,
  ),
)

export interface ComboboxTriggerProps extends Omit<Props<'button'>, 'type' | 'value'> {}

/**
 * A button that opens the list, with a chevron after your children. Put the
 * input in ComboboxContent, and this button is the control, as in shadcn's
 * "Combobox in Popup": it shows ComboboxValue, opens the popup and moves
 * focus to the search there. Its id and ARIA props go to the native select
 * until the combobox runs.
 */
export function ComboboxTrigger(handle: Handle<ComboboxTriggerProps>) {
  let api = useCombobox(handle, 'ComboboxTrigger')

  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || !api.running || event.ctrlKey || event.metaKey) return
    let { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      api.setOpen(true, 'list-navigation', event, { by: 'keyboard', highlight: key === 'ArrowUp' ? 'last' : 'first' })
      return
    }
    if (!api.open && !event.altKey && key !== ' ' && api.typeOnTrigger(event)) event.preventDefault()
  }

  return () => {
    api = useCombobox(handle, 'ComboboxTrigger')
    let { disabled: ownDisabled, children, mix, ...props } = handle.props
    let control = pick(props as Record<string, unknown>, controlPropNames) as ControlProps
    let rest = omit(props as Record<string, unknown>, controlPropNames)
    let isControl = api.inputInPopup || !api.input
    if (isControl) {
      api.control = {
        props: control,
        disabled: Boolean(ownDisabled),
        required: false,
        placeholder: api.control.placeholder,
      }
    }
    let running = api.running
    let disabled = api.disabled || Boolean(ownDisabled)
    let placeholder = api.values.length === 0
    let invalid = control['aria-invalid'] ?? (api.invalid ? 'true' : undefined)

    return (
      <button
        {...rest}
        type="button"
        data-slot="combobox-trigger"
        {...(running ? ariaStates({ ...control, 'aria-invalid': invalid }) : {})}
        id={running ? (control.id ?? `${api.ids.input}-trigger`) : `${api.ids.input}-trigger`}
        role={api.inputInPopup ? 'combobox' : undefined}
        tabindex={api.inputInPopup ? undefined : -1}
        aria-haspopup={api.inputInPopup ? 'dialog' : 'listbox'}
        aria-expanded={api.open ? 'true' : 'false'}
        aria-controls={api.inputInPopup ? api.ids.popup : api.ids.list}
        aria-required={api.inputInPopup && api.required ? 'true' : undefined}
        disabled={disabled}
        data-pending={running ? undefined : ''}
        data-popup-open={api.open ? '' : undefined}
        data-placeholder={placeholder ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        mix={[
          triggerRule,
          mix,
          area(api),
          ref((node, signal) => {
            let element = node as HTMLElement
            api.trigger = element
            signal.addEventListener('abort', () => {
              if (api.trigger !== element) return
              api.trigger = null
              queueMicrotask(() => {
                if (!api.trigger && api.open && api.inputInPopup) api.setOpen(false, 'trigger-removed')
              })
            })
          }),
          triggerPress(api, 'trigger'),
          on<HTMLButtonElement, 'keydown'>('keydown', onKeyDown),
        ]}
      >
        {children}
        <span data-slot="combobox-trigger-icon" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
    )
  }
}

export interface ComboboxValueProps {
  /** What shows while nothing is chosen. Its text is also the native select's empty option. */
  placeholder?: RemixNode
  /**
   * What shows in place of the chosen item's label: a node, or a function of
   * the value, the item or `null`, or the list of items in a multiple combobox.
   */
  children?: RemixNode | ((value: any) => RemixNode)
}

/**
 * The chosen value: the item's label, or what your function renders from it,
 * such as a chip for every chosen item. It renders no element of its own.
 */
export function ComboboxValue(handle: Handle<ComboboxValueProps>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxValue')
    let { placeholder, children } = handle.props
    if (placeholder !== undefined) api.control = { ...api.control, placeholder: collapse(readText(placeholder)) }
    let values = api.values
    if (typeof children === 'function') return children(api.multiple ? [...values] : (values[0] ?? null))
    if (children !== undefined) return children
    if (values.length === 0) return placeholder ?? null
    return api.multiple ? values.map(api.labelOf).join(', ') : api.labelOf(values[0])
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

const contentRule = css(
  mergeStyles(
    {
      ...textSm,
      boxSizing: 'border-box',
      position: 'fixed',
      width: 'var(--anchor-width, auto)',
      minWidth: 'min(var(--anchor-width, 9rem), var(--available-width, 100vw))',
      maxWidth: 'var(--available-width, calc(100% - 10px))',
      maxHeight: 'min(18rem, var(--available-height, 18rem))',
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
      // Fades in beside the input. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

const statusRule = css(visuallyHidden)

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface ComboboxContentProps extends Props<'div'> {
  /** The side of the input to show on (defaults to `'bottom'`). */
  side?: Side
  /** The gap to the input, in pixels (defaults to `6`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'start'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /** What to line up with, in place of the chips, the input or the trigger: an element, an anchor from createComboboxAnchor(), or a function. */
  anchor?: Element | ComboboxAnchor | (() => Element | null) | null
  /** Space to keep from the edges of the viewport, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /** What assistive technology hears once a search settles (defaults to `'N results available.'`). */
  resultsLabel?: (count: number) => string
}

interface ContentApi {
  readonly inside: true
}

const defaultResultsLabel = (count: number) =>
  count === 0 ? 'No results.' : count === 1 ? '1 result available.' : `${count} results available.`

// How long a search must stay unchanged before the status says how many items match.
const announceDelay = 600

/**
 * The popup: a native popover in the top layer, placed beside the input. It
 * stays in the document while closed, so the items stay known. Put
 * ComboboxEmpty and ComboboxList in it, and ComboboxInput for a search in the
 * popup.
 */
export function ComboboxContent(handle: Handle<ComboboxContentProps, ContentApi>) {
  let api = useCombobox(handle, 'ComboboxContent')
  handle.context.set({ inside: true })
  let announcement = ''
  let announced = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(timer))

  /** Says how many items match once the search settles, while the list is open and searched. */
  function scheduleAnnouncement(text: string) {
    if (text === announced) return
    clearTimeout(timer)
    announced = text
    if (text === '') {
      if (announcement !== '') {
        announcement = ''
        void handle.update()
      }
      return
    }
    timer = setTimeout(() => {
      if (handle.signal.aborted) return
      announcement = text
      void handle.update()
    }, announceDelay)
  }

  function resolveAnchor(anchor: ComboboxContentProps['anchor']): Element | null {
    if (anchor === undefined || anchor === null) return api.anchor()
    if (typeof anchor === 'function') return anchor()
    if (anchor instanceof Element) return anchor
    return anchor.current
  }

  return () => {
    api = useCombobox(handle, 'ComboboxContent')
    let {
      side = 'bottom',
      sideOffset = 6,
      align = 'start',
      alignOffset = 0,
      anchor,
      collisionPadding = 5,
      collisionAvoidance = {},
      resultsLabel = defaultResultsLabel,
      children,
      mix,
      ...props
    } = handle.props
    let open = api.open
    let count = api.count
    let empty = api.running ? count === 0 : api.hasItems && count === 0
    if (!onServer) {
      let say = open && api.searching && !(count === 0 && api.hasEmpty) ? resultsLabel(count) : ''
      handle.queueTask(() => scheduleAnnouncement(say))
    }

    return (
      <div
        data-slot="combobox-content"
        {...props}
        id={api.ids.popup}
        {...(api.inputInPopup ? { role: 'dialog', ...dialogName(api, props) } : {})}
        popover="manual"
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        data-empty={empty ? '' : undefined}
        mix={[
          contentRule,
          mix,
          topLayer(open),
          anchorPosition({
            open,
            anchor: () => resolveAnchor(anchor),
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
            trigger: () => api.anchor(),
            dismissOnOutsidePress: (target) => !api.contains(target),
            onDismiss: ({ reason, event }) =>
              api.setOpen(
                false,
                reason === 'close-request' ? 'escape-key' : reason === 'parent-dismissed' ? 'none' : reason,
                event,
              ),
          }),
          modalMixin({ open: open && api.modal, keep: () => [...api.areas] }),
          ref((node, signal) => {
            let popup = node as HTMLElement
            api.popup = popup
            signal.addEventListener('abort', () => {
              if (api.popup === popup) api.popup = null
            })
          }),
          // A press in the list keeps focus in the input, so typing still searches.
          on<HTMLElement, 'mousedown'>('mousedown', (event) => {
            let target = event.target instanceof Element ? event.target : null
            if (!target?.closest('input, textarea, select, [contenteditable]')) event.preventDefault()
          }),
          // A focus that leaves the popup for the page closes it.
          on<HTMLElement, 'focusout'>('focusout', (event) => {
            let next = event.relatedTarget
            if (!api.open || !api.inputInPopup || (next instanceof Node && api.contains(next))) return
            let document = (event.currentTarget as HTMLElement).ownerDocument
            document.defaultView?.setTimeout(() => {
              let active = document.activeElement
              if (api.open && active && active !== document.body && !api.contains(active)) {
                api.setOpen(false, 'focus-out', event)
              }
            })
          }),
          afterMixins(() => {
            if (!open) return
            // A search in the popup takes focus once the popup shows.
            if (api.inputInPopup && api.input && api.input.ownerDocument.activeElement !== api.input) {
              api.input.focus({ preventScroll: true })
            }
            api.revealHighlighted()
          }),
        ]}
      >
        {children}
        <div data-slot="combobox-status" role="status" aria-live="polite" aria-atomic="true" mix={statusRule}>
          {announcement}
        </div>
      </div>
    )
  }
}

/** A popup with a search is a dialog named like the trigger that opens it. */
function dialogName(api: ComboboxInternals, props: Props<'div'>) {
  if (props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined) return {}
  let control = api.control.props
  if (control['aria-labelledby'] !== undefined) return { 'aria-labelledby': control['aria-labelledby'] as string }
  if (control['aria-label'] !== undefined) return { 'aria-label': control['aria-label'] as string }
  return { 'aria-labelledby': labelIds(api.trigger) }
}

const listRule = css({
  flex: '1 1 auto',
  minHeight: 0,
  maxHeight: 'min(calc(18rem - 2.25rem), calc(var(--available-height, 18rem) - 2.25rem))',
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  scrollPaddingBlock: space(1),
  padding: space(1),
  outline: 'none',
  ':where([data-slot="combobox-content"][data-empty]) &': { padding: 0 },
})

export interface ComboboxListProps extends Omit<Props<'div'>, 'role' | 'id' | 'children'> {
  /** The items, or a function the list calls with each matching item, or each group, and its index. */
  children?: RemixNode | ((item: any, index: number) => RemixNode)
}

/** The listbox. Give it a function, and it renders the items that match the search. */
export function ComboboxList(handle: Handle<ComboboxListProps>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxList')
    let { children, mix, ...props } = handle.props
    let content =
      typeof children === 'function' ? api.shown.entries.map((entry, index) => children(entry, index)) : children
    let control = api.control.props
    let named =
      props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
        ? {}
        : control['aria-labelledby'] !== undefined
          ? { 'aria-labelledby': control['aria-labelledby'] as string }
          : control['aria-label'] !== undefined
            ? { 'aria-label': control['aria-label'] as string }
            : { 'aria-labelledby': api.input ? labelIds(api.focusTarget()) : undefined }

    return (
      <div
        data-slot="combobox-list"
        {...named}
        {...props}
        role="listbox"
        id={api.ids.list}
        aria-multiselectable={api.multiple ? 'true' : undefined}
        data-empty={api.count === 0 ? '' : undefined}
        mix={[
          listRule,
          mix,
          ref((node, signal) => {
            let list = node as HTMLElement
            api.list = list
            signal.addEventListener('abort', () => {
              if (api.list === list) api.list = null
            })
          }),
        ]}
      >
        {content}
      </div>
    )
  }
}

function labelIds(control: HTMLElement | null) {
  let labels = control && 'labels' in control ? [...((control as HTMLInputElement).labels ?? [])] : []
  return labels.length > 0 ? labels.map((label) => ensureId(label)).join(' ') : undefined
}

export interface ComboboxCollectionProps {
  /** Called with each matching item of the group around it, or of the list, and its index. */
  children: (item: any, index: number) => RemixNode
}

/** Renders the matching items of the ComboboxGroup around it. It renders no element of its own. */
export function ComboboxCollection(handle: Handle<ComboboxCollectionProps>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxCollection')
    let group = handle.context.get(ComboboxGroup) as GroupApi | undefined
    let items = group?.items ?? api.shown.flat
    return items.map((item, index) => handle.props.children(item, index))
  }
}

const groupRule = css({ scrollMarginBlock: space(1) })

export interface ComboboxGroupProps extends Omit<Props<'div'>, 'role'> {
  /** The group's matching items, for the ComboboxCollection inside, as the list's function gets them. */
  items?: readonly unknown[]
}

interface GroupApi {
  record: GroupRecord
  readonly items: readonly unknown[] | undefined
  adoptLabel(id: string, signal: AbortSignal): void
}

/** A group of items that its ComboboxLabel names. In the native select, a labelled group is an optgroup. */
export function ComboboxGroup(handle: Handle<ComboboxGroupProps, GroupApi>) {
  let api = useCombobox(handle, 'ComboboxGroup')
  let adopted: string | undefined
  let record: GroupRecord = { id: handle.id, labelId: `${handle.id}-label`, label: '', hasLabel: false }
  let group: GroupApi = {
    record,
    get items() {
      return handle.props.items
    },
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

  return () => {
    api = useCombobox(handle, 'ComboboxGroup')
    let { items: _items, children, mix, ...props } = handle.props
    let [label] = findAll<ComboboxLabelProps>(children, ComboboxLabel)
    record.hasLabel = label !== undefined || adopted !== undefined
    record.labelId = label?.id ?? adopted ?? `${handle.id}-label`
    if (label) record.label = collapse(readText(label.children))

    return (
      <div
        role="group"
        data-slot="combobox-group"
        aria-labelledby={record.hasLabel ? record.labelId : undefined}
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

export interface ComboboxLabelProps extends Props<'div'> {}

/** Names the group it sits in, and its optgroup in the native select. Outside a group, assistive technology skips it. */
export function ComboboxLabel(handle: Handle<ComboboxLabelProps>) {
  return () => {
    let group = handle.context.get(ComboboxGroup) as GroupApi | undefined
    let { id, mix, ...props } = handle.props
    let labelId = id ?? group?.record.labelId

    return (
      <div
        data-slot="combobox-label"
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
            else if (renamed) useCombobox(handle, 'ComboboxLabel').changed()
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
  overflowWrap: 'break-word',
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

export interface ComboboxItemProps extends Omit<Props<'div'>, 'role' | 'id' | 'value'> {
  /** The item it stands for: one of `items`, or a value of your own. */
  value: unknown
  /** Keeps the item from being chosen. It still shows. */
  disabled?: boolean
}

/** An option of the list, with a check while it's chosen. Enter on the highlighted item clicks it. */
export function ComboboxItem(handle: Handle<ComboboxItemProps>) {
  let api = useCombobox(handle, 'ComboboxItem')
  let record: ItemRecord = {
    id: `${handle.id}-option`,
    item: undefined,
    label: '',
    disabled: false,
    group: null,
    element: null,
    position: 0,
  }
  handle.signal.addEventListener('abort', () => api.unregister(record))
  let seenPass = -1

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' || !api.highlightOnHover || record.disabled) return
    if (api.highlightedId !== record.id) api.highlight(record, 'pointer', event)
  }

  return () => {
    api = useCombobox(handle, 'ComboboxItem')
    let group = handle.context.get(ComboboxGroup) as GroupApi | undefined
    let { value, disabled = false, children, mix, ...props } = handle.props
    // Rendered again without the root, by an update of a component of yours: the input and the
    // native select, which rendered before, follow once the root renders again.
    let local = seenPass === api.pass
    seenPass = api.pass
    if (!onServer) handle.queueTask(() => (local ? api.refresh() : api.flush()))
    api.register(record, {
      item: value,
      label: api.labelOf(value),
      disabled,
      group: group?.record ?? null,
    })
    let selected = api.isSelected(value)
    let highlighted = api.highlightedId === record.id

    return (
      <div
        data-slot="combobox-item"
        {...props}
        role="option"
        id={record.id}
        aria-selected={selected ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : undefined}
        data-selected={selected ? '' : undefined}
        data-highlighted={highlighted ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
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
            if (event.defaultPrevented) return
            // A link in the item handles its own click.
            if (event.target instanceof Element && event.target.closest('a[href]')) return
            api.choose(record, event)
          }),
        ]}
      >
        {children}
        <span data-slot="combobox-item-indicator" aria-hidden="true" mix={indicatorRule}>
          {selected ? <CheckIcon /> : null}
        </span>
      </div>
    )
  }
}

const emptyRule = css({
  ...textSm,
  display: 'none',
  justifyContent: 'center',
  width: '100%',
  boxSizing: 'border-box',
  paddingBlock: space(2),
  textAlign: 'center',
  color: 'var(--muted-foreground)',
  ':where([data-slot="combobox-content"][data-empty]) &': { display: 'flex' },
})

/**
 * Shows its children while no item matches. It's a live region outside the
 * listbox, which holds only options, so assistive technology hears the text
 * as it appears. It stays in the document, empty, while items match.
 */
export function ComboboxEmpty(handle: Handle<Props<'div'>>) {
  let api = useCombobox(handle, 'ComboboxEmpty')
  api.hasEmpty = true
  handle.signal.addEventListener('abort', () => (api.hasEmpty = false))

  return () => {
    api = useCombobox(handle, 'ComboboxEmpty')
    api.hasEmpty = true
    let { children, mix, ...props } = handle.props
    let empty = api.count === 0 && (api.running || api.hasItems)
    return (
      <div
        data-slot="combobox-empty"
        {...props}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        mix={[emptyRule, mix]}
      >
        {empty ? children : null}
      </div>
    )
  }
}

const separatorRule = css({
  height: 0,
  marginBlock: space(1),
  marginInline: `calc(${space(1)} * -1)`,
  borderBlockStart: '1px solid var(--border)',
  pointerEvents: 'none',
})

/** A line between items or groups. A listbox holds only options and groups, so assistive technology skips it. */
export function ComboboxSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="combobox-separator" {...props} aria-hidden="true" mix={[separatorRule, mix]} />
  }
}

interface ChipsApi {
  /** Each chip takes its place in the values in the order it renders. */
  next(): number
  elements(): HTMLElement[]
}

const chipsRule = css(
  mergeStyles(
    {
      ...textSm,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space(1.5),
      boxSizing: 'border-box',
      width: '100%',
      minWidth: 0,
      minHeight: space(9),
      paddingBlock: space(1.5),
      paddingInline: space(2.5),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      // shadcn's dark tint is 30% of --input, which is --muted itself, so the muted chips would vanish on it.
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 15%, transparent))',
      backgroundClip: 'padding-box',
      boxShadow: 'var(--shadow-xs)',
      cursor: 'text',
      '&:has([data-slot="combobox-chip"])': { paddingInline: space(1.5) },
      '&:focus-within': { borderColor: 'var(--ring)' },
      '&:has([aria-invalid="true"])': { borderColor: 'var(--destructive)' },
      '&:has([aria-invalid="true"]:focus-visible)': { outlineColor: 'var(--destructive)' },
      '&:has(:disabled)': { cursor: 'not-allowed', opacity: 0.5 },
      ...pending,
    },
    focusRing('&:has([data-slot="combobox-chip-input"]:focus-visible)'),
    transition('color', 'border-color', 'box-shadow'),
    fieldItem,
  ),
)

/**
 * The box of a multiple combobox: the chips of the chosen items and the
 * ComboboxChipsInput after them. The list lines up with it. A press on its
 * empty space focuses the input.
 */
export function ComboboxChips(handle: Handle<Props<'div'>, ChipsApi>) {
  let api = useCombobox(handle, 'ComboboxChips')
  let index = 0
  let element: HTMLElement | null = null
  handle.context.set({
    next: () => index++,
    elements: () => (element ? [...element.querySelectorAll<HTMLElement>('[data-slot="combobox-chip"]')] : []),
  })

  return () => {
    api = useCombobox(handle, 'ComboboxChips')
    index = 0
    let { mix, ...props } = handle.props

    return (
      <div
        data-slot="combobox-chips"
        // NVDA stays in focus mode for the arrow keys between chips inside a toolbar, as Base UI notes.
        role={api.values.length > 0 ? 'toolbar' : undefined}
        {...props}
        data-pending={api.running ? undefined : ''}
        mix={[
          chipsRule,
          mix,
          area(api),
          ref((node, signal) => {
            element = node as HTMLElement
            signal.addEventListener('abort', () => {
              if (element === node) element = null
            })
          }),
          on<HTMLElement, 'mousedown'>('mousedown', (event) => pressInput(api, event)),
        ]}
      />
    )
  }
}

const chipRule = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1),
  boxSizing: 'border-box',
  width: 'fit-content',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: space(5.5),
  paddingInline: space(1.5),
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--muted)',
  color: 'var(--foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  fontWeight: 500,
  // shadcn keeps a chip on one line; here a long one wraps, so a narrow screen with large text shows it all.
  overflowWrap: 'anywhere',
  '&:has([data-slot="combobox-chip-remove"])': { paddingInlineEnd: 0 },
  '&:focus-visible': { outline: '2px solid var(--ring)', outlineOffset: '1px' },
  '&[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.5 },
  '@media (forced-colors: active)': { border: '1px solid CanvasText' },
})

const chipRemoveRule = css({
  marginInlineStart: `calc(${space(1)} * -1)`,
  opacity: 0.7,
  '&:hover': { opacity: 1 },
  '& svg': { width: '0.75rem', height: '0.75rem' },
})

export interface ComboboxChipProps extends Props<'div'> {
  /** Shows a button that removes the chip's value (defaults to `true`). */
  showRemove?: boolean
  /** The remove button's name (defaults to `'Remove '` and the chip's text). */
  removeLabel?: string
}

/**
 * A chosen item in ComboboxChips, in the order of the values. The arrow keys
 * move between chips and back to the input; Backspace or Delete removes the
 * focused chip; typing goes on in the input.
 */
export function ComboboxChip(handle: Handle<ComboboxChipProps>) {
  let api = useCombobox(handle, 'ComboboxChip')
  let chips = handle.context.get(ComboboxChips) as ChipsApi | undefined
  let index = 0

  async function removeAndRefocus(event: Event, reason: ComboboxValueChangeReason, refocus: 'chip' | 'input') {
    let count = api.values.length
    let at = index
    if (!api.remove(at, reason, event)) return
    let list = chips?.elements() ?? []
    let host = list[at]?.parentElement ?? null
    // In the same task as the render that removes the chip, so focus never rests on the page between.
    await api.settled()
    if (refocus === 'input') return api.input?.focus()
    // The chip that takes its place, or the one before the last, or the input.
    let next = at >= count - 1 ? count - 2 : at
    let remaining =
      chips?.elements() ?? (host ? [...host.querySelectorAll<HTMLElement>('[data-slot="combobox-chip"]')] : [])
    let target = next >= 0 ? remaining[next] : undefined
    if (target) target.focus()
    else api.input?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || api.disabled || api.readOnly) return
    let chip = event.currentTarget as HTMLElement
    if (event.target !== chip) return
    let rtl = getComputedStyle(chip).direction === 'rtl'
    let [previous, next] = rtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight']
    let list = chips?.elements() ?? []
    let at = list.indexOf(chip)
    let { key } = event
    if (key === previous || key === next) {
      event.preventDefault()
      let target = list[at + (key === previous ? -1 : 1)]
      if (target) target.focus()
      else api.input?.focus()
      return
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault()
      void removeAndRefocus(event, 'none', 'chip')
      return
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      api.input?.focus()
      return
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      api.input?.focus()
      api.setOpen(true, 'list-navigation', event, { by: 'keyboard', highlight: key === 'ArrowUp' ? 'last' : 'first' })
      return
    }
    // Typing goes on in the input: focus moves before the key types.
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) api.input?.focus()
  }

  return () => {
    api = useCombobox(handle, 'ComboboxChip')
    index = chips?.next() ?? 0
    let { showRemove = true, removeLabel, children, mix, ...props } = handle.props
    let disabled = api.disabled
    let label = removeLabel ?? `Remove ${collapse(readText(children)) || api.labelOf(api.values[index])}`

    return (
      <div
        data-slot="combobox-chip"
        tabindex={-1}
        {...props}
        aria-disabled={disabled ? 'true' : undefined}
        aria-readonly={api.readOnly ? 'true' : undefined}
        mix={[chipRule, mix, on<HTMLElement, 'keydown'>('keydown', onKeyDown)]}
      >
        {children}
        {showRemove ? (
          <Button
            variant="ghost"
            size="icon-xs"
            data-slot="combobox-chip-remove"
            tabindex={-1}
            aria-label={label}
            disabled={disabled || api.readOnly}
            mix={[
              chipRemoveRule,
              on<HTMLButtonElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
              on<HTMLButtonElement, 'click'>('click', (event) => {
                if (event.defaultPrevented || !api.running) return
                event.stopPropagation()
                void removeAndRefocus(event, 'chip-remove-press', 'input')
              }),
            ]}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    )
  }
}

export interface ComboboxChipsInputProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'value' | 'defaultValue' | 'list' | 'aria-activedescendant'
> {}

/**
 * The text input of a multiple combobox, after the chips. Its id and ARIA
 * props go to the native select until the combobox runs.
 */
export function ComboboxChipsInput(handle: Handle<ComboboxChipsInputProps>) {
  return () => <ComboboxField {...handle.props} variant="chips" />
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
      // Once the combobox runs, the native select only holds the value, out of sight and reach.
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
  ':where([data-slot="combobox-native"]:has(> select[multiple])) > &': { display: 'none' },
})

// Options take the system colors, so the browser's list of them stays readable in either scheme.
const optionRule = css({ backgroundColor: 'Canvas', color: 'CanvasText' })

/**
 * The native select that holds the form value: the control itself until the
 * combobox runs, with an option for every item, then out of sight, without a
 * tab stop and hidden from assistive technology, with focus going on to the
 * input. Once it runs, it keeps only the chosen values and the reset values,
 * in the order they were chosen.
 */
function ComboboxNative(handle: Handle<{}>) {
  return () => {
    let api = useCombobox(handle, 'ComboboxNative')
    let { name, form, autocomplete } = api.formProps
    let disabled = api.disabled
    let running = api.running
    let multiple = api.multiple
    let values = api.values
    let selectedValues = new Set(values.map(api.valueOf))
    // Only the server writes which options are selected. In the browser, a selected prop is the
    // option's state, which a render would set over the user's choice, so the combobox writes it.
    let selected = (value: string) =>
      onServer ? { selected: selectedValues.has(value) || (value === '' && !multiple && values.length === 0) } : {}
    let seen = new Set<string>()
    let children: RemixNode[] = []

    let option = (value: string, text: string, hidden: boolean, off: boolean) => {
      seen.add(value)
      return (
        <option
          key={`value:${value}`}
          value={value}
          hidden={hidden ? true : undefined}
          disabled={off ? true : undefined}
          {...selected(value)}
          mix={optionRule}
        >
          {text}
        </option>
      )
    }

    if (!multiple) {
      children.push(
        <option key="placeholder" value="" hidden {...selected('')} mix={optionRule}>
          {api.control.placeholder}
        </option>,
      )
    }

    if (!running) {
      // Every item, in its order, those of a labelled group in an optgroup. An item the list
      // rendered tells whether it's disabled and which group it sits in.
      let groups = new Map<GroupRecord, RemixNode[]>()
      let records = api.records()
      let byItem = new Map(records.map((record) => [record.item, record]))
      let items = api.allItems ?? records.map((record) => record.item)
      for (let item of items) {
        let value = api.valueOf(item)
        if (seen.has(value)) continue
        let record = byItem.get(item) ?? records.find((entry) => api.isEqual(entry.item, item))
        let chosen = selectedValues.has(value)
        let off = record?.disabled ?? false
        // A disabled item that is chosen still submits, but the native list never offers it.
        let entry = option(value, api.labelOf(item) || value, off && chosen, off && !chosen)
        let group = record?.group
        if (!group?.hasLabel || !group.label) {
          children.push(entry)
          continue
        }
        let list = groups.get(group)
        if (!list) {
          list = []
          groups.set(group, list)
          children.push(
            <optgroup key={group.id} label={group.label} mix={optionRule}>
              {list}
            </optgroup>,
          )
        }
        list.push(entry)
      }
    }
    // The chosen values, and the reset values, that have no option yet: hidden, so the form still
    // submits what the input shows, and a reset still finds its value.
    for (let item of [...values, ...api.defaults]) {
      let value = api.valueOf(item)
      if (seen.has(value) || value === '') continue
      children.push(option(value, api.labelOf(item) || value, !running, false))
    }

    let control = ariaStates({ ...api.control.props })
    let attributes = running
      ? { id: api.ids.native, tabindex: -1, 'aria-hidden': 'true' as const }
      : { ...control, id: control.id ?? api.ids.native }

    return (
      <span data-slot="combobox-native" data-running={running ? '' : undefined} mix={nativeRule}>
        <select
          data-slot="combobox-native-select"
          data-served={onServer ? '' : undefined}
          {...attributes}
          name={name}
          form={form}
          autocomplete={autocomplete}
          required={api.required}
          disabled={disabled}
          multiple={multiple}
          mix={[
            nativeSelectRule,
            ref((node, signal) => api.attachNative(node as HTMLSelectElement, signal)),
            on('focus', () => api.redirectFocus()),
            on('invalid', () => api.reportInvalid()),
          ]}
        >
          {children}
        </select>
        <span data-slot="combobox-native-icon" aria-hidden="true" mix={nativeIconRule}>
          <ChevronDownIcon />
        </span>
      </span>
    )
  }
}
