// RemixCN Command: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { activeDescendant, getNextIndex, isFocusableItem } from '#remixcn/lib/composite.ts'
import { CheckIcon, SearchIcon } from '#remixcn/lib/icons.tsx'
import { focusRing, mergeStyles, visuallyHidden } from '#remixcn/lib/styles.ts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  getDialogContext,
} from '#remixcn/ui/dialog.tsx'
import type { DialogContentProps, DialogProps } from '#remixcn/ui/dialog.tsx'

// A command menu: a search field over a list of commands, as cmdk draws it
// for shadcn/ui, without cmdk. The input is a native text field with the
// combobox role. Focus stays in it, and the arrow keys move a highlight
// through the list with aria-activedescendant (composite.ts). Enter runs the
// highlighted item's onSelect, and nothing else runs a command.
//
// The parts register with the Command root while they render. The root
// scores every item against the search, hides those that don't match, and
// shows the rest best first: it sets the CSS order of each item in its group
// and of each group in the list, so the DOM keeps your order and Remix keeps
// owning it. Equal scores keep your order. The keyboard follows the order
// on screen.
//
// The server renders every item, nothing highlighted, and a disabled input,
// so a page whose script never runs shows the commands without promising a
// search. Once the command runs in the browser, inside your client entry,
// the input turns on and the first item lights up.

/**
 * Scores an item for a search: from 0, which hides it, to 1, the best match.
 * `value` is the item's value, `keywords` its other names.
 */
export type CommandFilter = (value: string, search: string, keywords?: readonly string[]) => number

const markRe = /\p{M}/gu
const spaceRe = /\s+/g
const wordCharRe = /[\p{L}\p{N}]/u

/** Lowercase, without accents or repeated spaces. */
function normalize(text: string) {
  return text.normalize('NFD').replace(markRe, '').toLowerCase().replace(spaceRe, ' ').trim()
}

function startsAWord(text: string, query: string) {
  for (let index = text.indexOf(query, 1); index > 0; index = text.indexOf(query, index + 1)) {
    if (!wordCharRe.test(text[index - 1])) return true
  }
  return false
}

/** Finds the letters of `query` in order, and scores how close together they sit. */
function scatteredScore(text: string, query: string) {
  let letters = [...query.replaceAll(' ', '')]
  let first = -1
  let at = -1
  for (let letter of letters) {
    at = text.indexOf(letter, at + 1)
    if (at === -1) return 0
    if (first === -1) first = at
  }
  return 0.1 + 0.3 * (letters.length / (at - first + 1))
}

function scoreText(text: string, query: string) {
  if (text === query) return 1
  if (text.startsWith(query)) return 0.9
  if (startsAWord(text, query)) return 0.8
  if (text.includes(query)) return 0.6
  let words = query.split(' ')
  if (words.length > 1 && words.every((word) => text.includes(word))) return 0.5
  return scatteredScore(text, query)
}

/**
 * Command's own filter, in place of cmdk's command-score. Case, accents and
 * repeated spaces don't count. An exact match scores 1, then a match at the
 * start, at the start of a word, inside a word, every word of the search in
 * any order, and last the letters of the search in order, higher the closer
 * they sit. A keyword scores a little lower than the value.
 */
export const defaultCommandFilter: CommandFilter = (value, search, keywords = []) => {
  let query = normalize(search)
  if (query === '') return 1
  let best = scoreText(normalize(value), query)
  for (let keyword of keywords) best = Math.max(best, 0.95 * scoreText(normalize(keyword), query))
  return best
}

export interface CommandProps extends Props<'div'> {
  /** Names the input and the list for assistive technology (defaults to `'Command menu'`, or the title of a CommandDialog). */
  label?: string
  /**
   * Whether Command filters and sorts the items (defaults to `true`). With
   * `false`, render only the items that match yourself.
   */
  shouldFilter?: boolean
  /** Scores each item for the search, from 0 to hide it to 1 (defaults to `defaultCommandFilter`). */
  filter?: CommandFilter
  /** The value of the highlighted item, for a command you control. Render the new value from onValueChange. */
  value?: string
  /** The value of the item to highlight first, for a command that keeps its own state. */
  defaultValue?: string
  /** Called when another item lights up, through the keyboard, the pointer or a new search. */
  onValueChange?: (value: string) => void
  /** Whether the arrow keys wrap around at either end (defaults to `false`). */
  loop?: boolean
  /** Keeps the pointer from moving the highlight; a click still selects (defaults to `false`). */
  disablePointerSelection?: boolean
  /** Whether Ctrl+N and Ctrl+J move down and Ctrl+P and Ctrl+K up (defaults to `true`). */
  vimBindings?: boolean
}

/** What the Command root shares with its parts, and with parts you build on it. */
export interface CommandContext {
  /** The search, as the input holds it. */
  readonly search: string
  /** The value of the highlighted item, or `''`. */
  readonly value: string
  /** How many items match the search. Items with `forceMount` don't count. */
  readonly count: number
  /** Whether the command runs in the browser and knows its items, so the count holds. */
  readonly ready: boolean
}

interface GroupRecord {
  readonly id: string
  forceMount: boolean
  element: HTMLElement | null
}

interface ItemRecord {
  readonly id: string
  value: string
  /** Whether `value` comes from your prop, rather than the item's text. */
  explicit: boolean
  keywords: readonly string[]
  disabled: boolean
  forceMount: boolean
  group: GroupRecord | null
  element: HTMLElement | null
  select(event: MouseEvent | KeyboardEvent): void
}

interface ItemState {
  visible: boolean
  score: number
  /** The CSS order among its siblings while a search sorts the list. */
  order?: number
  /** Its place among the visible items of its group while a search sorts them, for aria-posinset and aria-setsize. */
  position?: number
  size?: number
}

interface GroupState {
  visible: boolean
  order?: number
}

interface Computed {
  items: Map<ItemRecord, ItemState>
  groups: Map<GroupRecord, GroupState>
  /** The visible items, in the order they show. */
  navigation: ItemRecord[]
  highlighted: ItemRecord | null
  count: number
}

interface CommandInternals extends CommandContext {
  readonly ids: { readonly input: string; readonly list: string }
  readonly label: string | undefined
  readonly running: boolean
  readonly searching: boolean
  readonly loop: boolean
  readonly vimBindings: boolean
  readonly disablePointerSelection: boolean
  readonly highlightedId: string | undefined
  readonly navigation: readonly ItemRecord[]
  readonly highlightedItem: ItemRecord | null
  item(record: ItemRecord): ItemState
  group(record: GroupRecord): GroupState
  register(record: ItemRecord | GroupRecord): void
  unregister(record: ItemRecord | GroupRecord): void
  /** Marks a change of a record the parts made while they rendered. */
  changed(): void
  /** Renders the root again if a part changed a record. */
  flush(): void
  /** Watches an item for styles that hide or show it. */
  watch(element: HTMLElement, signal: AbortSignal): void
  /** Reads again which items the page hides, before a key acts on them. */
  recheck(): void
  /** Sets the search of an input that holds its own, or reads the one you control. */
  syncSearch(search: string, controlled: boolean): void
  setSearch(search: string): void
  highlight(record: ItemRecord, options?: { scroll?: boolean }): void
  select(record: ItemRecord, event: MouseEvent | KeyboardEvent): void
}

function getCommand(handle: Handle<any, any>, part: string): CommandInternals {
  let context = handle.context.get(Command) as CommandInternals | undefined
  if (!context) throw new Error(`${part} must sit inside Command`)
  return context
}

/** The context of the nearest Command, in place of cmdk's useCommandState(). Throws when `part` sits outside one. */
export function getCommandContext(handle: Handle<any, any>, part: string): CommandContext {
  return getCommand(handle, part)
}

function isItem(record: ItemRecord | GroupRecord): record is ItemRecord {
  return 'select' in record
}

/** Sorts records into document order; those not in the document yet keep their place at the end. */
function byDocumentOrder<T extends { element: HTMLElement | null }>(records: Iterable<T>) {
  return [...records].sort((a, b) => {
    if (!a.element || !b.element) return Number(!a.element) - Number(!b.element)
    let position = a.element.compareDocumentPosition(b.element)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })
}

/** Highest score first; Array.prototype.sort keeps equal scores in their order. */
function byScore<T>(entries: T[], score: (entry: T) => number) {
  return entries.sort((a, b) => score(b) - score(a))
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const rootRule = css({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  padding: space(1),
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  // In a CommandDialog, the command fills the dialog and its list scrolls inside.
  ':where([data-command-dialog]) > &': { flex: '1 1 auto', minHeight: 0 },
})

/**
 * The command menu: holds the search and the highlighted item, and filters
 * and sorts its items. Put a CommandInput and a CommandList in it.
 */
export function Command(handle: Handle<CommandProps, CommandInternals>) {
  let items = new Set<ItemRecord>()
  let groups = new Set<GroupRecord>()
  let ordered: ItemRecord[] = []
  let orderedGroups: GroupRecord[] = []
  // Items the search shows but the page hides, with your styles or a hidden ancestor.
  let unseen = new Set<ItemRecord>()
  let resizeObserver: ResizeObserver | undefined
  let lastFilter: CommandFilter | undefined
  let lastShouldFilter: boolean | undefined
  let uncontrolledSearch: string | undefined
  let controlledSearch: string | undefined
  let uncontrolledValue = handle.props.defaultValue?.trim() ?? ''
  let running = false
  // Counts the changes to the items and the search, so the root knows when a render missed one.
  let version = 0
  let computedVersion = -1
  let computed: Computed = { items: new Map(), groups: new Map(), navigation: [], highlighted: null, count: 0 }
  // The search and items the highlight was last chosen for.
  let pickedSearch = ''
  let pickedVersion = -1
  let pendingScroll = false
  // The text of the empty state while it shows, for the status that announces it.
  let announcement = ''
  let host: HTMLElement | null = null
  let ids = { input: `${handle.id}-input`, list: `${handle.id}-list` }
  handle.signal.addEventListener('abort', () => resizeObserver?.disconnect())

  function getSearch() {
    return controlledSearch ?? uncontrolledSearch ?? ''
  }

  function getValue() {
    return handle.props.value?.trim() ?? uncontrolledValue
  }

  function markChanged() {
    version++
  }

  function compute(): Computed {
    computedVersion = version
    let search = getSearch()
    let filtering = handle.props.shouldFilter !== false && search !== ''
    let filter = handle.props.filter ?? defaultCommandFilter
    let itemStates = new Map<ItemRecord, ItemState>()
    let groupStates = new Map<GroupRecord, GroupState & { best: number }>()
    let count = 0

    for (let group of orderedGroups) groupStates.set(group, { visible: !filtering || group.forceMount, best: 0 })
    for (let record of ordered) {
      let score = !filtering ? 1 : record.value ? filter(record.value, search, record.keywords) : 0
      let visible = !filtering || record.forceMount || score > 0
      if (visible && !record.forceMount) count++
      itemStates.set(record, { visible, score })
      let group = record.group && groupStates.get(record.group)
      if (group && visible) {
        group.visible = true
        group.best = Math.max(group.best, score)
      }
    }

    let inList = ordered.filter((record) => !record.group || !groupStates.has(record.group))
    let navigation: ItemRecord[]

    if (filtering) {
      // As cmdk: items outside a group first, then the groups, each sorted by its best item.
      let visibleIn = (records: ItemRecord[]) =>
        records.filter((record) => itemStates.get(record)!.visible && !unseen.has(record))
      let place = (records: ItemRecord[]) => {
        let sorted = byScore(records, (record) => itemStates.get(record)!.score)
        let shown = visibleIn(sorted)
        sorted.forEach((record, index) => (itemStates.get(record)!.order = index + 1))
        shown.forEach((record, index) =>
          Object.assign(itemStates.get(record)!, { position: index + 1, size: shown.length }),
        )
        return shown
      }
      navigation = place(inList)
      let sortedGroups = byScore([...groupStates.entries()], ([, state]) => state.best)
      sortedGroups.forEach(([group, state], index) => {
        state.order = inList.length + index + 1
        if (state.visible) navigation.push(...place(ordered.filter((record) => record.group === group)))
      })
    } else {
      navigation = ordered.filter(
        (record) =>
          itemStates.get(record)!.visible &&
          !unseen.has(record) &&
          (!record.group || groupStates.get(record.group)?.visible !== false),
      )
    }

    let value = getValue()
    let highlighted = navigation.find((record) => record.value === value && !record.disabled) ?? null
    return { items: itemStates, groups: groupStates, navigation, highlighted, count }
  }

  /** Reads what only the document knows: the order of the items and the text of those without a value. */
  function refresh() {
    let next = byDocumentOrder(items)
    let nextGroups = byDocumentOrder(groups)
    let changed =
      next.some((record, index) => record !== ordered[index]) ||
      nextGroups.some((record, index) => record !== orderedGroups[index])
    ordered = next
    orderedGroups = nextGroups
    for (let record of items) {
      if (record.explicit || !record.element) continue
      let text = textOf(record.element)
      if (text !== record.value) {
        record.value = text
        changed = true
      }
    }
    if (changed) markChanged()
  }

  /**
   * Reads which items the page hides although the search shows them, such as
   * with display: none, visibility: hidden or a hidden or inert ancestor, so
   * they never light up or run. Says whether that changed.
   */
  function readVisibility() {
    let next = new Set<ItemRecord>()
    for (let record of ordered) {
      let element = record.element
      if (!element?.isConnected || computed.items.get(record)?.visible === false) continue
      if (!isFocusableItem(element)) next.add(record)
    }
    let changed = next.size !== unseen.size || [...next].some((record) => !unseen.has(record))
    unseen = next
    return changed
  }

  function firstEnabled() {
    return computed.navigation.find((record) => !record.disabled) ?? null
  }

  function setValue(value: string, scroll: boolean) {
    if (scroll) pendingScroll = true
    if (value !== getValue()) {
      handle.props.onValueChange?.(value)
      // A controlled owner renders the new value, or keeps its own.
      if (handle.props.value !== undefined) return
      uncontrolledValue = value
    }
    void handle.update()
  }

  function scrollHighlightIntoView() {
    let element = computed.highlighted?.element
    if (!element) return
    // The first item of a group brings its heading along.
    let group = element.closest('[data-slot="command-group"]')
    let first = computed.navigation.find((record) => record.group === computed.highlighted?.group)
    let heading = group?.querySelector<HTMLElement>('[data-slot="command-group-heading"]')
    if (heading && first === computed.highlighted) revealInList(heading)
    revealInList(element)
  }

  // Runs in the browser after every render of the root.
  function afterCommit() {
    refresh()
    if (readVisibility()) markChanged()
    let started = !running
    running = true
    // The parts changed what this render counted on, or the input turns on.
    if (version !== computedVersion || started) {
      void handle.update()
      return
    }

    // Says the empty state in the status, outside the listbox, which holds only options.
    let empty = host
      ? [...host.querySelectorAll('[data-slot="command-empty"]')].find(
          (element) => element.closest('[data-slot="command"]') === host,
        )
      : undefined
    let text = empty?.textContent?.trim() ?? ''
    if (text !== announcement) {
      announcement = text
      void handle.update()
      return
    }

    // A new search lights up the first item, as does a list whose highlighted item went away.
    let search = getSearch()
    if (search !== pickedSearch || (computed.highlighted === null && version !== pickedVersion)) {
      pickedSearch = search
      pickedVersion = version
      let first = firstEnabled()
      if (first && first.value !== getValue()) return setValue(first.value, true)
      if (first) pendingScroll = true
    }

    if (pendingScroll) {
      pendingScroll = false
      scrollHighlightIntoView()
    }
  }

  let internals: CommandInternals = {
    get search() {
      return getSearch()
    },
    get value() {
      return computed.highlighted?.value ?? ''
    },
    get count() {
      return computed.count
    },
    get ready() {
      return running
    },
    ids,
    get label() {
      return handle.props.label
    },
    get running() {
      return running
    },
    get searching() {
      return getSearch() !== ''
    },
    get loop() {
      return handle.props.loop ?? false
    },
    get vimBindings() {
      return handle.props.vimBindings ?? true
    },
    get disablePointerSelection() {
      return handle.props.disablePointerSelection ?? false
    },
    get highlightedId() {
      return computed.highlighted?.id
    },
    get navigation() {
      return computed.navigation
    },
    get highlightedItem() {
      let record = computed.highlighted
      // Never one that left the document, is hidden or is disabled, so no stale item can run.
      return record?.element?.isConnected && isFocusableItem(record.element) && !record.disabled ? record : null
    },
    item: (record) => computed.items.get(record) ?? { visible: true, score: 1 },
    group: (record) => computed.groups.get(record) ?? { visible: true },
    register(record) {
      if (isItem(record)) {
        items.add(record)
        ordered.push(record)
      } else {
        groups.add(record)
        orderedGroups.push(record)
      }
      markChanged()
    },
    unregister(record) {
      if (isItem(record)) {
        items.delete(record)
        ordered = ordered.filter((other) => other !== record)
      } else {
        groups.delete(record)
        orderedGroups = orderedGroups.filter((other) => other !== record)
      }
      markChanged()
      // A part that leaves outside a render, such as with its own update, tells the root now.
      if (running && !handle.signal.aborted) queueMicrotask(() => internals.flush())
    },
    changed: markChanged,
    watch(element, signal) {
      // Sees your styles hide or show an item, or a box around it, without a render.
      resizeObserver ??= new ResizeObserver(() => {
        if (!readVisibility()) return
        markChanged()
        internals.flush()
      })
      resizeObserver.observe(element)
      signal.addEventListener('abort', () => resizeObserver?.unobserve(element))
    },
    recheck() {
      // A style that hides an item without changing its size, such as visibility: hidden, shows up only here.
      if (!readVisibility()) return
      markChanged()
      computed = compute()
      void handle.update()
    },
    flush() {
      if (version === computedVersion || handle.signal.aborted) return
      void handle.update()
    },
    syncSearch(search, controlled) {
      if (controlled) {
        if (search !== controlledSearch) markChanged()
        controlledSearch = search
      } else {
        controlledSearch = undefined
        if (uncontrolledSearch === undefined) {
          uncontrolledSearch = search
          if (search !== '') markChanged()
        }
      }
    },
    setSearch(search) {
      if (controlledSearch !== undefined) return
      uncontrolledSearch = search
      markChanged()
      void handle.update()
    },
    highlight(record, { scroll = true } = {}) {
      setValue(record.value, scroll)
    },
    select(record, event) {
      setValue(record.value, false)
      record.select(event)
    },
  }

  return () => {
    let {
      label: _label,
      shouldFilter: _shouldFilter,
      filter: _filter,
      value: _value,
      defaultValue: _defaultValue,
      onValueChange: _onValueChange,
      loop: _loop,
      disablePointerSelection: _disablePointerSelection,
      vimBindings: _vimBindings,
      mix,
      children,
      ...props
    } = handle.props

    // Another filter changes the items' scores, as a new search does.
    if (handle.props.filter !== lastFilter || handle.props.shouldFilter !== lastShouldFilter) {
      lastFilter = handle.props.filter
      lastShouldFilter = handle.props.shouldFilter
      markChanged()
    }
    computed = compute()
    handle.context.set(internals)
    handle.queueTask(afterCommit)

    return (
      <div
        data-slot="command"
        {...props}
        mix={[
          rootRule,
          mix,
          ref((node, signal) => {
            host = node as HTMLElement
            // Your own changes to the items, such as a new order, which no part renders for.
            let observer = new MutationObserver(() => {
              refresh()
              internals.flush()
            })
            observer.observe(host, { childList: true, subtree: true, characterData: true })
            // Attributes that can hide an item without changing its size, such
            // as visibility: hidden from a class or inert, on the items, the
            // boxes in the command, and every box around it.
            let visibility = new MutationObserver(() => {
              if (!readVisibility()) return
              markChanged()
              internals.flush()
            })
            visibility.observe(host, { attributes: true, subtree: true, attributeFilter: visibilityAttributes })
            for (let parent = host.parentElement; parent; parent = parent.parentElement) {
              visibility.observe(parent, { attributes: true, attributeFilter: visibilityAttributes })
            }
            signal.addEventListener('abort', () => {
              observer.disconnect()
              visibility.disconnect()
              host = null
            })
          }),
        ]}
      >
        {children}
        <div data-slot="command-status" role="status" mix={statusRule}>
          {announcement}
        </div>
      </div>
    )
  }
}

const statusRule = css(visuallyHidden)

// The attributes that show or hide an element, or take it out of reach, without a render of Command.
const visibilityAttributes = ['class', 'style', 'hidden', 'inert', 'open']

/**
 * Scrolls the list, and only the list, until `target` shows inside it, as
 * scrollIntoView({ block: 'nearest' }) would without moving the page.
 */
function revealInList(target: HTMLElement) {
  let list = target.closest<HTMLElement>('[data-slot="command-list"]')
  if (!list) return
  let style = getComputedStyle(list)
  let box = list.getBoundingClientRect()
  let top = box.top + list.clientTop + (parseFloat(style.scrollPaddingBlockStart) || 0)
  let bottom = box.top + list.clientTop + list.clientHeight - (parseFloat(style.scrollPaddingBlockEnd) || 0)
  let rect = target.getBoundingClientRect()
  if (rect.top < top) list.scrollTop -= top - rect.top
  else if (rect.bottom > bottom) list.scrollTop += rect.bottom - bottom
}

/** The text of an item, without its shortcut, in place of cmdk's textContent. */
function textOf(element: HTMLElement) {
  let text = ''
  let walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('[data-slot="command-shortcut"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  while (walker.nextNode()) text += walker.currentNode.nodeValue
  return text.trim()
}

/** The text of JSX the server can read: strings, numbers, and the children of elements and fragments, without shortcuts. */
function jsxText(node: RemixNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(jsxText).join('')
  if (typeof node === 'object' && '$rmx' in node) {
    let element = node as { type: unknown; props: { children?: RemixNode } }
    if (element.type === CommandShortcut) return ''
    if (typeof element.type === 'string' || element.type === Fragment) return jsxText(element.props.children)
  }
  return ''
}

const wrapperRule = css({ padding: space(1), paddingBlockEnd: 0 })

const inputFill = 'light-dark(var(--muted), color-mix(in oklab, var(--input) 30%, transparent))'

const inputGroupRule = css(
  mergeStyles(focusRing('&:has([data-slot="command-input"]:focus-visible)'), {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    minHeight: space(8),
    // shadcn's bg-input/30. RemixCN's light --input is darker, for the 3:1 of
    // control borders, so the light fill is --muted, the color shadcn's makes.
    border: `1px solid ${inputFill}`,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: inputFill,
    color: 'var(--foreground)',
  }),
)

const searchIconRule = css({
  display: 'inline-flex',
  flexShrink: 0,
  alignSelf: 'stretch',
  alignItems: 'center',
  paddingInlineStart: space(2),
  color: 'var(--muted-foreground)',
  cursor: 'text',
  '& svg': { width: '1rem', height: '1rem', opacity: 0.5 },
})

const inputRule = css({
  flex: '1 1 auto',
  minWidth: 0,
  width: '100%',
  margin: 0,
  paddingBlock: space(1.5),
  paddingInlineStart: space(1.5),
  paddingInlineEnd: space(2),
  border: 0,
  backgroundColor: 'transparent',
  color: 'inherit',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  // The group around the input draws the focus ring.
  '&:focus-visible': { outline: 'none' },
  '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
})

export interface CommandInputProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'value' | 'defaultValue' | 'id' | 'aria-activedescendant'
> {
  /** The search, for an input you control. Render the new value from onValueChange. */
  value?: string
  /** The first search, for an input that keeps its own. */
  defaultValue?: string
  /** Called when the search changes. */
  onValueChange?: (search: string) => void
}

/**
 * The search field: a native text input with the combobox role. Focus stays
 * here while the arrow keys, Home, End, Ctrl+N, Ctrl+P and their kin move the
 * highlight, and Enter runs the highlighted item. Typing filters the list.
 * It's disabled until the command runs in the browser.
 */
export function CommandInput(handle: Handle<CommandInputProps>) {
  let command = getCommand(handle, 'CommandInput')
  let input: HTMLInputElement | null = null

  function groupJump(event: KeyboardEvent, step: 1 | -1) {
    let navigation = command.navigation
    let current = command.highlightedItem
    let start = current ? navigation.indexOf(current) : -1
    for (let index = start + step; index >= 0 && index < navigation.length; index += step) {
      let record = navigation[index]
      if (record.group === current?.group || record.disabled) continue
      // The first enabled item of that group.
      let target = navigation.find((other) => other.group === record.group && !other.disabled) ?? record
      event.preventDefault()
      return command.highlight(target)
    }
    // No other group: the next item, as cmdk does.
    let next = getNextIndex(
      step > 0 ? 'ArrowDown' : 'ArrowUp',
      start,
      navigation.map((record) => record.disabled),
      { orientation: 'vertical', loop: command.loop },
    )
    event.preventDefault()
    if (next !== undefined && next !== start) command.highlight(navigation[next])
  }

  let keys = on<HTMLInputElement, 'keydown'>('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    command.recheck()
    if (event.key === 'Enter') {
      // As cmdk: Enter never sends a form around the command.
      event.preventDefault()
      let record = command.highlightedItem
      if (record) command.select(record, event)
      return
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      groupJump(event, event.key === 'ArrowDown' ? 1 : -1)
    }
  })

  // A form reset puts the input back to its default value after the reset
  // event, so this reads it a task later. The search follows, and the owner
  // of a controlled search hears it; one that keeps its search keeps it in
  // the input too.
  async function afterReset(signal: AbortSignal) {
    if (!input || signal.aborted || input.value === command.search) return
    let search = input.value
    command.setSearch(search)
    handle.props.onValueChange?.(search)
    await handle.update()
    let { value } = handle.props
    if (input && value !== undefined && input.value !== value) input.value = value
  }

  function keyAliases(event: KeyboardEvent) {
    if (event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === 'ArrowDown') return 'End'
      if (event.key === 'ArrowUp') return 'Home'
    }
    if (command.vimBindings && event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'n' || event.key === 'j') return 'ArrowDown'
      if (event.key === 'p' || event.key === 'k') return 'ArrowUp'
    }
  }

  let items = () => command.navigation.flatMap((record) => (record.element ? [record.element] : []))
  let highlight = (element: HTMLElement) => {
    let record = command.navigation.find((candidate) => candidate.element === element)
    if (record) command.highlight(record)
  }

  return () => {
    command = getCommand(handle, 'CommandInput')
    let { value, defaultValue, onValueChange, disabled, mix, ...props } = handle.props
    let controlled = value !== undefined
    command.syncSearch(value ?? defaultValue ?? '', controlled)
    handle.queueTask(() => command.flush())

    let dialog = handle.context.get(CommandDialogScope) as CommandDialogScopeContext | undefined
    let named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    let label = named
      ? {}
      : command.label !== undefined || !dialog
        ? { 'aria-label': command.label ?? 'Command menu' }
        : { 'aria-labelledby': dialog.titleId }

    return (
      <div data-slot="command-input-wrapper" mix={wrapperRule}>
        <div data-slot="command-input-group" mix={inputGroupRule}>
          <span
            data-slot="command-input-icon"
            aria-hidden="true"
            mix={[
              searchIconRule,
              on('mousedown', (event) => {
                // A press on the icon focuses the input, as shadcn's input group addon does.
                event.preventDefault()
                input?.focus()
              }),
            ]}
          >
            <SearchIcon />
          </span>
          <input
            data-slot="command-input"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            {...label}
            {...props}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={command.ids.list}
            aria-activedescendant={command.highlightedId}
            id={command.ids.input}
            disabled={disabled || !command.running}
            {...(controlled ? { value } : defaultValue === undefined ? {} : { defaultValue })}
            mix={[
              inputRule,
              mix,
              ref((node, signal) => {
                input = node as HTMLInputElement
                input.form?.addEventListener('reset', () => setTimeout(() => afterReset(signal)), { signal })
              }),
              on('input', (event) => {
                let search = event.currentTarget.value
                command.setSearch(search)
                onValueChange?.(search)
              }),
              keys,
              activeDescendant({
                items,
                orientation: 'vertical',
                loop: command.loop,
                homeAndEnd: true,
                keyAliases,
                highlight,
              }),
            ]}
          />
        </div>
      </div>
    )
  }
}

const listRule = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  // Each group and item keeps its height, so the list scrolls. Firefox would
  // otherwise shrink the rows to the list's height, and each group, which
  // clips its overflow, would cut off its own items.
  gridAutoRows: 'max-content',
  alignContent: 'start',
  flex: '1 1 auto',
  minHeight: 0,
  maxHeight: '18rem',
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollPaddingBlock: space(1),
  scrollbarWidth: 'thin',
})

export interface CommandListProps extends Omit<Props<'div'>, 'role' | 'id'> {
  /** Names the list for assistive technology (defaults to `'Suggestions'`, as cmdk). */
  label?: string
}

/** The listbox of results, which scrolls when it gets taller than 18rem. */
export function CommandList(handle: Handle<CommandListProps>) {
  return () => {
    let command = getCommand(handle, 'CommandList')
    let { label = 'Suggestions', mix, ...props } = handle.props

    return (
      <div
        data-slot="command-list"
        aria-label={label}
        {...props}
        role="listbox"
        id={command.ids.list}
        mix={[
          listRule,
          mix,
          // A press in the list keeps focus in the input, so typing still searches.
          on('mousedown', (event) => event.preventDefault()),
        ]}
      />
    )
  }
}

const emptyRule = css({
  paddingBlock: space(6),
  textAlign: 'center',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

/**
 * Shows when no item matches the search. A listbox holds only options, so
 * assistive technology hears the text from Command's status instead, which
 * announces it as it appears.
 */
export function CommandEmpty(handle: Handle<Props<'div'>>) {
  return () => {
    let command = getCommand(handle, 'CommandEmpty')
    if (!command.ready || command.count > 0) return null
    let { mix, ...props } = handle.props
    return <div data-slot="command-empty" {...props} aria-hidden="true" mix={[emptyRule, mix]} />
  }
}

const groupRule = css({
  overflow: 'hidden',
  padding: space(1),
  color: 'var(--foreground)',
  '&[hidden]': { display: 'none' },
})

const groupHeadingRule = css({
  paddingInline: space(2),
  paddingBlock: space(1.5),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  fontWeight: 500,
})

const groupItemsRule = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' })

function orderRule(order: number | undefined) {
  return order === undefined ? undefined : css({ order: String(order) })
}

export interface CommandGroupProps extends Omit<Props<'div'>, 'role'> {
  /** The heading above the group's items, which also names them. */
  heading?: RemixNode
  /** A value for the group, written as `data-value`. */
  value?: string
  /** Keeps the group in view whatever the search. */
  forceMount?: boolean
}

/** Groups items under a heading. The group hides while none of its items match. */
export function CommandGroup(handle: Handle<CommandGroupProps, GroupRecord>) {
  let command = getCommand(handle, 'CommandGroup')
  let record: GroupRecord = { id: handle.id, forceMount: handle.props.forceMount ?? false, element: null }
  command.register(record)
  handle.signal.addEventListener('abort', () => command.unregister(record))

  return () => {
    command = getCommand(handle, 'CommandGroup')
    let { heading, value, forceMount = false, mix, children, ...props } = handle.props
    if (record.forceMount !== forceMount) {
      record.forceMount = forceMount
      command.changed()
    }
    handle.context.set(record)
    handle.queueTask(() => command.flush())
    let state = command.group(record)
    let headingId = `${handle.id}-heading`

    return (
      <div
        data-slot="command-group"
        data-value={value}
        {...props}
        hidden={state.visible ? undefined : true}
        mix={[
          groupRule,
          orderRule(state.order),
          mix,
          ref((node, signal) => {
            record.element = node as HTMLElement
            signal.addEventListener('abort', () => (record.element = null))
          }),
        ]}
      >
        {heading === undefined ? null : (
          <div data-slot="command-group-heading" id={headingId} aria-hidden="true" mix={groupHeadingRule}>
            {heading}
          </div>
        )}
        <div
          data-slot="command-group-items"
          role="group"
          aria-labelledby={heading === undefined ? undefined : headingId}
          mix={groupItemsRule}
        >
          {children}
        </div>
      </div>
    )
  }
}

// shadcn's -mx-1 reaches into the command's padding, which the list clips anyway.
const separatorRule = css({
  height: 0,
  borderBlockStart: '1px solid var(--border)',
  '&[hidden]': { display: 'none' },
})

export interface CommandSeparatorProps extends Props<'div'> {
  /** Keeps the separator while a search filters the list, when it hides otherwise. */
  alwaysRender?: boolean
}

/**
 * A line between groups, hidden while a search filters the list. A listbox
 * holds only options and groups, so it's hidden from assistive technology.
 */
export function CommandSeparator(handle: Handle<CommandSeparatorProps>) {
  return () => {
    let command = getCommand(handle, 'CommandSeparator')
    let { alwaysRender = false, mix, ...props } = handle.props
    let hidden = command.searching && !alwaysRender

    return (
      <div
        data-slot="command-separator"
        {...props}
        aria-hidden="true"
        hidden={hidden ? true : undefined}
        mix={[separatorRule, mix]}
      />
    )
  }
}

const focusedHighlight = ':where([data-slot="command"]:has([data-slot="command-input"]:focus-visible)) &[data-selected]'

const itemRule = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  minWidth: 0,
  paddingInline: space(2),
  paddingBlock: space(1.5),
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'break-word',
  cursor: 'default',
  userSelect: 'none',
  outline: 'none',
  '&[hidden]': { display: 'none' },
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem', pointerEvents: 'none' },
  '&[data-selected]': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  '&[data-selected] svg': { color: 'var(--foreground)' },
  // While the input has focus, the item Enter runs carries the focus ring.
  [focusedHighlight]: { outline: '2px solid var(--ring)', outlineOffset: '-2px' },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  ':where([data-slot="dialog-content"]) &': { borderRadius: 'var(--radius-lg)' },
  // Forced colors drop the background, so a thin outline marks the highlighted
  // item, and a thick one while the input has focus.
  '@media (forced-colors: active)': {
    '&[data-selected]': { outline: '1px solid CanvasText', outlineOffset: '-1px' },
    [focusedHighlight]: { outline: '2px solid Highlight', outlineOffset: '-2px' },
  },
})

// shadcn keeps an invisible check at the end of every item. Here only an item
// that can be checked keeps its place, so a narrow item has room for its text.
const indicatorRule = css({
  display: 'inline-flex',
  marginInlineStart: 'auto',
  opacity: 0,
  ':where([data-slot="command-item"]:not([data-checked])) &': { display: 'none' },
  ':where([data-slot="command-item"][data-checked="true"]) &': { opacity: 1 },
  ':where([data-slot="command-item"]:has([data-slot="command-shortcut"])) &': { display: 'none' },
})

export interface CommandItemProps extends Omit<Props<'div'>, 'role' | 'id'> {
  /**
   * The item's value, which the search matches and onSelect receives
   * (defaults to the item's text, without its shortcut). Give a stable,
   * unique one when the text changes or repeats.
   */
  value?: string
  /** Other names the search matches, such as `['account']` for Profile. */
  keywords?: readonly string[]
  /** Keeps the item from lighting up and running. It still shows. */
  disabled?: boolean
  /**
   * Shows a check at the end of the item when `true`, and keeps its place when
   * `false`. Assistive technology hears it through aria-checked.
   */
  checked?: boolean
  /** Keeps the item in view whatever the search. It doesn't count as a result. */
  forceMount?: boolean
  /** Called when the item is clicked, or highlighted when Enter is pressed. */
  onSelect?: (value: string, event: MouseEvent | KeyboardEvent) => void
}

/** One command: an option of the list that lights up under the pointer and the keys, and runs onSelect. */
export function CommandItem(handle: Handle<CommandItemProps>) {
  let command = getCommand(handle, 'CommandItem')
  let record: ItemRecord = {
    id: handle.id,
    value: '',
    explicit: false,
    keywords: [],
    disabled: false,
    forceMount: false,
    group: null,
    element: null,
    select: (event) => handle.props.onSelect?.(record.value, event),
  }
  command.register(record)
  handle.signal.addEventListener('abort', () => command.unregister(record))

  function sync() {
    let { value, keywords = [], disabled = false, forceMount = false, children } = handle.props
    let group = (handle.context.get(CommandGroup) as GroupRecord | undefined) ?? null
    let explicit = value !== undefined || typeof children === 'string'
    let nextValue =
      value?.trim() ?? (typeof children === 'string' ? children.trim() : record.value || jsxText(children).trim())
    let nextKeywords = keywords.map((keyword) => keyword.trim())
    let changed =
      record.value !== nextValue ||
      record.explicit !== explicit ||
      record.disabled !== disabled ||
      record.forceMount !== (forceMount || group?.forceMount === true) ||
      record.group !== group ||
      record.keywords.join('\n') !== nextKeywords.join('\n')
    Object.assign(record, {
      value: nextValue,
      explicit,
      keywords: nextKeywords,
      disabled,
      forceMount: forceMount || group?.forceMount === true,
      group,
    })
    if (changed) command.changed()
  }

  return () => {
    command = getCommand(handle, 'CommandItem')
    sync()
    handle.queueTask(() => command.flush())
    let {
      value: _value,
      keywords: _keywords,
      disabled = false,
      checked,
      forceMount: _forceMount,
      onSelect: _onSelect,
      mix,
      children,
      ...props
    } = handle.props
    let state = command.item(record)
    let highlighted = command.highlightedId === record.id

    return (
      <div
        data-slot="command-item"
        data-checked={checked === undefined ? undefined : String(checked)}
        {...props}
        role="option"
        id={record.id}
        data-value={record.value}
        aria-selected={highlighted ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : undefined}
        aria-checked={checked === undefined ? undefined : checked ? 'true' : 'false'}
        aria-posinset={state.position}
        aria-setsize={state.size}
        data-selected={highlighted ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        hidden={state.visible ? undefined : true}
        mix={[
          itemRule,
          orderRule(state.order),
          mix,
          ref((node, signal) => {
            record.element = node as HTMLElement
            command.watch(record.element, signal)
            signal.addEventListener('abort', () => (record.element = null))
          }),
          on('pointermove', () => {
            if (record.disabled || command.disablePointerSelection || command.highlightedId === record.id) return
            command.highlight(record, { scroll: false })
          }),
          on('click', (event) => {
            if (event.defaultPrevented || record.disabled) return
            command.select(record, event)
          }),
        ]}
      >
        {children}
        <span data-slot="command-item-indicator" aria-hidden="true" mix={indicatorRule}>
          <CheckIcon />
        </span>
      </div>
    )
  }
}

const shortcutRule = css({
  marginInlineStart: 'auto',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  letterSpacing: '0.1em',
  // On a narrow screen with large text, the keys wrap rather than overflow the item.
  minWidth: 0,
  overflowWrap: 'anywhere',
  textAlign: 'end',
  // Keys read in their own direction, so ⌘P stays ⌘P in right-to-left text.
  unicodeBidi: 'plaintext',
  ':where([data-slot="command-item"][data-selected]) &': { color: 'var(--foreground)' },
})

/**
 * The keys of a command, as text at the end of its item. It explains a
 * shortcut you wire yourself; Command adds no key for it.
 */
export function CommandShortcut(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <span data-slot="command-shortcut" {...props} mix={[shortcutRule, mix]} />
  }
}

interface CommandDialogScopeContext {
  readonly titleId: string
}

/**
 * Hands the dialog's title to a Command inside, and mounts the children
 * afresh each time the dialog opens, as Base UI does when it renders the
 * popup again: the search starts empty and the first item lights up.
 */
function CommandDialogScope(handle: Handle<{ children?: RemixNode }, CommandDialogScopeContext>) {
  let opened = 0
  let wasOpen = false

  return () => {
    let dialog = getDialogContext(handle, 'CommandDialog')
    if (dialog.open && !wasOpen) opened++
    wasOpen = dialog.open
    handle.context.set({ titleId: dialog.ids.title })
    // Remix compares a lone child by its type only. In a list, the new key remounts it.
    return [<Fragment key={String(opened)}>{handle.props.children}</Fragment>]
  }
}

const hiddenHeaderRule = css(visuallyHidden)

// The dialog's top sits a third of the way down, as in shadcn, and moves up
// on a short screen so the whole command fits.
const dialogTop = 'max(1rem, min(33.333%, 100% - 23rem))'

const dialogRule = css({
  insetBlock: `${dialogTop} auto`,
  marginBlock: 0,
  maxHeight: `calc(100% - ${dialogTop} - 1rem)`,
  padding: 0,
  overflow: 'hidden',
  '&[open]': { display: 'flex', flexDirection: 'column', gap: 0 },
})

export interface CommandDialogProps extends Omit<DialogProps, 'role'> {
  /** The dialog's name, hidden on screen (defaults to `'Command Palette'`). It also names the input. */
  title?: string
  /** The dialog's description, hidden on screen (defaults to `'Search for a command to run...'`). */
  description?: string
  /** Shows a close button in the corner (defaults to `false`). */
  showCloseButton?: boolean
  /** Your mixins for the dialog surface. */
  mix?: DialogContentProps['mix']
  /** What to focus when the dialog opens (defaults to the input). */
  initialFocus?: DialogContentProps['initialFocus']
  /** What to focus when it closes (defaults to the trigger that opened it). */
  finalFocus?: DialogContentProps['finalFocus']
}

/**
 * A Command in a modal Dialog, a third of the way down the screen. Put a
 * Command in it. The dialog's title and description are hidden on screen,
 * and the title names the input. Each time it opens, the command starts
 * afresh.
 */
export function CommandDialog(handle: Handle<CommandDialogProps>) {
  return () => {
    let {
      title = 'Command Palette',
      description = 'Search for a command to run...',
      showCloseButton = false,
      mix,
      initialFocus,
      finalFocus,
      children,
      ...props
    } = handle.props

    return (
      <Dialog {...props}>
        <DialogContent
          data-command-dialog=""
          showCloseButton={showCloseButton}
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          mix={[dialogRule, mix]}
        >
          <DialogHeader mix={hiddenHeaderRule}>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <CommandDialogScope>{children}</CommandDialogScope>
        </DialogContent>
      </Dialog>
    )
  }
}
