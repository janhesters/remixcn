// RemixCN Tabs: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { rovingFocus } from '#remixcn/lib/composite.ts'
import { disabledState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export type TabsOrientation = 'horizontal' | 'vertical'
export type TabsListVariant = 'default' | 'line'

/**
 * Why the selected tab changes: `'none'` when the user picks a tab, by
 * pointer or keyboard; `'disabled'` or `'missing'` when an uncontrolled
 * Tabs moves off a tab that became disabled or left the document.
 */
export type TabsChangeReason = 'none' | 'disabled' | 'missing'

export const tabsChangeType = 'remixcn:tabs-change' as const

/**
 * Dispatched on the tabs before the selected tab changes, and bubbles.
 * `value` is the next selected tab's value, or null when no enabled tab is
 * left. Cancel a change the user makes with `preventDefault()` to keep the
 * current tab. Changes Tabs makes itself can't be cancelled. It takes the
 * place of shadcn's `onValueChange`.
 */
export class TabsChangeEvent extends Event {
  readonly value: string | null
  readonly reason: TabsChangeReason

  constructor(value: string | null, reason: TabsChangeReason = 'none') {
    super(tabsChangeType, { bubbles: true, cancelable: reason === 'none' })
    this.value = value
    this.reason = reason
  }
}

declare global {
  interface HTMLElementEventMap {
    [tabsChangeType]: TabsChangeEvent
  }
}

export interface TabsProps extends Omit<Props<'div'>, 'defaultValue'> {
  /** The selected tab's value, for tabs the caller controls. null selects none. */
  value?: string | null
  /** The tab selected at first. Without one, the first enabled tab. */
  defaultValue?: string | null
  /** Lays the tabs out in a row above the panels, or in a column beside them. */
  orientation?: TabsOrientation
}

export interface TabsListProps extends Omit<Props<'div'>, 'role'> {
  variant?: TabsListVariant
  /** Selects a tab as soon as the arrow keys move focus to it. Otherwise Enter or Space selects it. */
  activateOnFocus?: boolean
  /** Whether the arrow keys wrap from the last tab to the first. */
  loopFocus?: boolean
}

export interface TabsTriggerProps extends Omit<Props<'button'>, 'type' | 'role' | 'id' | 'value'> {
  /** Identifies the tab and its panel. */
  value: string
}

export interface TabsContentProps extends Omit<Props<'div'>, 'role' | 'id' | 'hidden'> {
  /** The value of the tab that shows this panel. */
  value: string
  /** Keeps the panel in the document, hidden, while another tab is selected. */
  keepMounted?: boolean
}

interface TabsContext {
  /** The selected value, or undefined while the first enabled tab decides it. */
  value: string | null | undefined
  /** The first enabled tab claims the selection when there is no value. */
  claimed: string | undefined
  orientation: TabsOrientation
  tabId(value: string): string
  panelId(value: string): string
  select(value: string): void
  /** Whether a TabsContent for this value is mounted, rendered or not. */
  hasPanel(value: string): boolean
  /** Records which TabsContent values are mounted, and renders the tabs again when that changes. */
  setPanel(value: string, mounted: boolean): void
}

interface TabsListContext {
  variant: TabsListVariant
}

function selectedValue(tabs: TabsContext | undefined) {
  return tabs?.value === undefined ? tabs?.claimed : tabs.value
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const tabsStyles = css({
  display: 'flex',
  gap: space(2),
  minWidth: 0,
  '&[data-orientation="horizontal"]': { flexDirection: 'column' },
  // Without room beside the tabs, such as on a narrow screen, the panel moves below them.
  '&[data-orientation="vertical"]': { flexWrap: 'wrap' },
})

/**
 * Tabs with their panels. The tab list is one tab stop, and the arrow keys
 * move between the tabs. It runs in the browser inside your client entry.
 * Before that, it shows the selected tab and its panel.
 */
export function Tabs(handle: Handle<TabsProps, TabsContext>) {
  let uncontrolledValue = handle.props.defaultValue
  let root: HTMLElement | undefined
  // A tab names its panel in aria-controls only when the panel is there.
  // Panels render after the tabs, so the tabs learn about them in the browser.
  let panels = new Map<string, number>()
  let refreshing = false
  // The value this Tabs gives its parts. context.get(Tabs) would read an outer Tabs.
  let provided: TabsContext | undefined

  function setPanel(value: string, mounted: boolean) {
    let count = (panels.get(value) ?? 0) + (mounted ? 1 : -1)
    if (count > 0) panels.set(value, count)
    else panels.delete(value)
    if (refreshing || !root) return
    refreshing = true
    queueMicrotask(() => {
      refreshing = false
      if (root) void handle.update()
    })
  }

  function currentValue() {
    return handle.props.value === undefined ? uncontrolledValue : handle.props.value
  }

  function select(value: string) {
    if (!root || value === currentValue()) return

    let accepted = root.dispatchEvent(new TabsChangeEvent(value))
    if (accepted && handle.props.value === undefined) {
      uncontrolledValue = value
      void handle.update()
    }
  }

  function ownTabs() {
    let current = root
    if (!current) return []
    return [...current.querySelectorAll<HTMLButtonElement>('[data-slot="tabs-trigger"]')].filter(
      (tab) => tab.closest('[data-slot="tabs"]') === current,
    )
  }

  // Like Base UI, uncontrolled tabs move to the first enabled tab when the
  // selected one is disabled or removed. Controlled tabs keep their value.
  function validate() {
    if (!root || handle.props.value !== undefined) return

    let tabs = ownTabs()
    let enabled = tabs.find((tab) => !tab.disabled)?.value ?? null
    let value = currentValue()

    if (value === undefined) {
      // The first enabled tab claimed the selection while rendering.
      uncontrolledValue = enabled
      if (enabled !== provided?.claimed) void handle.update()
      return
    }

    let selected = tabs.find((tab) => tab.value === value)
    let reason: TabsChangeReason | undefined =
      value === null ? undefined : !selected ? 'missing' : selected.disabled ? 'disabled' : undefined
    if (!reason || enabled === value) return

    uncontrolledValue = enabled
    root.dispatchEvent(new TabsChangeEvent(enabled, reason))
    void handle.update()
  }

  return () => {
    let { value: _value, defaultValue: _defaultValue, orientation = 'horizontal', mix, ...props } = handle.props
    let base = props.id ?? handle.id
    let key = (value: string) => encodeURIComponent(value)

    provided = {
      value: currentValue(),
      claimed: undefined,
      orientation,
      tabId: (value) => `${base}-tab-${key(value)}`,
      panelId: (value) => `${base}-panel-${key(value)}`,
      select,
      hasPanel: (value) => panels.has(value),
      setPanel,
    }
    handle.context.set(provided)

    return (
      <div
        data-slot="tabs"
        {...props}
        data-orientation={orientation}
        mix={[
          tabsStyles,
          ref<HTMLDivElement>((node, signal) => {
            root = node
            // A tab can change without this component rendering, such as when
            // the component around a TabsTrigger renders it disabled.
            let observer = new MutationObserver(validate)
            observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
            validate()
            signal.addEventListener('abort', () => {
              observer.disconnect()
              if (root === node) root = undefined
            })
          }),
          mix,
        ]}
      />
    )
  }
}

const listStyles = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  padding: '3px',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--muted-foreground)',
  '&[data-orientation="horizontal"]': { minHeight: space(9) },
  // A column keeps its labels whole beside the panel, unless it's wider than the tabs.
  '&[data-orientation="vertical"]': {
    flexDirection: 'column',
    flexShrink: 0,
    alignItems: 'stretch',
    height: 'fit-content',
  },
  '&[data-variant="default"]': { backgroundColor: 'var(--muted)' },
  '&[data-variant="line"]': { gap: space(1), backgroundColor: 'transparent', borderRadius: 0 },
})

/**
 * The row or column of tabs, one tab stop. Arrow keys follow the
 * orientation and swap in right-to-left text; Home and End jump to the ends.
 * Name it with aria-label when no heading says what the tabs are for.
 */
export function TabsList(handle: Handle<TabsListProps, TabsListContext>) {
  return () => {
    let tabs = handle.context.get(Tabs) as TabsContext | undefined
    let { variant = 'default', activateOnFocus = false, loopFocus = true, mix, ...props } = handle.props
    let orientation = tabs?.orientation ?? 'horizontal'

    handle.context.set({ variant })

    return (
      <div
        data-slot="tabs-list"
        {...props}
        role="tablist"
        aria-orientation={orientation}
        data-orientation={orientation}
        data-variant={variant}
        mix={[
          listStyles,
          mix,
          // One tab stop that returns to the selected tab, the arrow keys, Home
          // and End, from the shared helper. Before the browser runs it, every
          // tab is in the tab order.
          rovingFocus({
            items: '[role="tab"]',
            orientation,
            loop: loopFocus,
            resetOnLeave: true,
            onActiveChange: activateOnFocus
              ? (tab) => {
                  let current = handle.context.get(Tabs) as TabsContext | undefined
                  if (tab instanceof HTMLButtonElement) current?.select(tab.value)
                }
              : undefined,
          }),
        ]}
      />
    )
  }
}

const selected = '&[aria-selected="true"]'
const selectedOnLine = '&[data-variant="line"][aria-selected="true"]'

const triggerBase: Styles = {
  position: 'relative',
  display: 'inline-flex',
  flex: '1 1 auto',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1.5),
  minWidth: 0,
  minHeight: space(7.25),
  margin: 0,
  paddingBlock: space(1),
  paddingInline: space(2),
  border: '1px solid transparent',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
  // shadcn's text-foreground/60 in light mode and text-muted-foreground in dark mode.
  color: 'light-dark(color-mix(in oklab, var(--foreground) 60%, transparent), var(--muted-foreground))',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  fontWeight: 500,
  textAlign: 'center',
  // shadcn keeps labels on one line. A label wraps only when its tab can't fit, so narrow screens don't scroll sideways.
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  '&:hover:not(:disabled)': { color: 'var(--foreground)' },
  '& svg': { flexShrink: 0, pointerEvents: 'none', width: '1rem', height: '1rem' },
  '&:has([data-icon="inline-start"])': { paddingInlineStart: space(1.5) },
  '&:has([data-icon="inline-end"])': { paddingInlineEnd: space(1.5) },
  '&[data-orientation="vertical"]': { width: '100%', justifyContent: 'flex-start', textAlign: 'start' },
  [selected]: {
    color: 'var(--foreground)',
    backgroundColor: 'light-dark(var(--background), color-mix(in oklab, var(--input) 30%, transparent))',
    borderColor: 'light-dark(transparent, var(--input))',
    boxShadow: 'var(--shadow-sm)',
  },
  [selectedOnLine]: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    boxShadow: 'none',
  },
  // The line under, or beside, the selected tab. A border, so forced colors keep it.
  '&::after': {
    content: '""',
    position: 'absolute',
    opacity: 0,
    borderColor: 'var(--foreground)',
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
  },
  '&[data-orientation="horizontal"]::after': { insetInline: 0, bottom: '-5px', borderBlockEndWidth: '2px' },
  '&[data-orientation="vertical"]::after': { insetBlock: 0, insetInlineEnd: '-4px', borderInlineEndWidth: '2px' },
  [`${selectedOnLine}::after`]: { opacity: 1 },
  // Forced colors drop backgrounds and shadows, so every selected tab shows the line.
  '@media (forced-colors: active)': { [`${selected}::after`]: { opacity: 1 } },
}

const triggerRule = css(
  mergeStyles(triggerBase, transition('color', 'background-color', 'border-color', 'box-shadow'), disabledState),
)

/** One tab, a native button. It selects its panel on click, Enter or Space. */
export function TabsTrigger(handle: Handle<TabsTriggerProps>) {
  return () => {
    let tabs = handle.context.get(Tabs) as TabsContext | undefined
    let list = handle.context.get(TabsList) as TabsListContext | undefined
    let { value, disabled, mix, ...props } = handle.props

    // Without a value, the first enabled tab that renders is selected.
    if (tabs && tabs.value === undefined && tabs.claimed === undefined && !disabled) tabs.claimed = value
    let isSelected = selectedValue(tabs) === value

    return (
      <button
        data-slot="tabs-trigger"
        {...props}
        type="button"
        role="tab"
        value={value}
        id={tabs?.tabId(value)}
        aria-selected={isSelected ? 'true' : 'false'}
        aria-controls={isSelected && tabs?.hasPanel(value) ? tabs.panelId(value) : undefined}
        data-active={isSelected ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-orientation={tabs?.orientation ?? 'horizontal'}
        data-variant={list?.variant ?? 'default'}
        disabled={disabled}
        mix={[
          triggerRule,
          // The caller's handlers run first, so they can cancel the click.
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            let current = handle.context.get(Tabs) as TabsContext | undefined
            current?.select(value)
          }),
        ]}
      />
    )
  }
}

const contentStyles = css({
  flex: '1 1 0%',
  minWidth: 0,
  '&[data-orientation="vertical"]': { flexBasis: '10rem' },
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

/**
 * The panel of one tab. Only the selected tab's panel is in the document,
 * unless keepMounted keeps the others there, hidden. When the selected tab
 * changes while focus is in this panel, focus moves to the new tab.
 */
export function TabsContent(handle: Handle<TabsContentProps>) {
  let panel: HTMLElement | undefined
  let wasSelected = false
  let registered: { tabs: TabsContext; value: string } | undefined

  // Only in the browser, after a commit: the server renders no tasks.
  function register(tabs: TabsContext | undefined, value: string) {
    if (registered?.value === value) return
    handle.queueTask(() => {
      if (registered?.value === value) return
      registered?.tabs.setPanel(registered.value, false)
      registered = tabs ? { tabs, value } : undefined
      tabs?.setPanel(value, true)
    })
  }

  handle.signal.addEventListener('abort', () => registered?.tabs.setPanel(registered.value, false))

  return () => {
    let tabs = handle.context.get(Tabs) as TabsContext | undefined
    let { value, keepMounted = false, mix, ...props } = handle.props
    register(tabs, value)
    let current = selectedValue(tabs)
    let isSelected = current === value

    let document = panel?.ownerDocument
    let focused = document?.activeElement
    if (wasSelected && !isSelected && panel?.contains(focused ?? null) && current && tabs) {
      let next = tabs.tabId(current)
      handle.queueTask(() => document?.getElementById(next)?.focus())
    }
    wasSelected = isSelected

    if (!isSelected && !keepMounted) return null

    return (
      <div
        data-slot="tabs-content"
        tabindex={isSelected ? 0 : -1}
        {...props}
        role="tabpanel"
        id={tabs?.panelId(value)}
        aria-labelledby={tabs?.tabId(value)}
        hidden={!isSelected}
        data-hidden={isSelected ? undefined : ''}
        data-orientation={tabs?.orientation ?? 'horizontal'}
        mix={[
          contentStyles,
          ref<HTMLDivElement>((node, signal) => {
            panel = node
            signal.addEventListener('abort', () => {
              if (panel === node) panel = undefined
            })
          }),
          mix,
        ]}
      />
    )
  }
}
