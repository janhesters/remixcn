// RemixCN Accordion: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { ChevronDownIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, mergeStyles } from '#remixcn/lib/styles.ts'
import { Collapsible, CollapsibleContent, CollapsibleTrigger, collapsibleChangeType } from '#remixcn/ui/collapsible.tsx'
import type {
  CollapsibleContentProps,
  CollapsibleContext,
  CollapsibleProps,
  CollapsibleTriggerProps,
} from '#remixcn/ui/collapsible.tsx'

export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export const accordionChangeType = 'remixcn:accordion-change' as const

/**
 * Dispatched on an item before it opens or closes, and bubbles to the
 * accordion. `value` lists the open items after the change, `item` is the
 * item that changes and `open` its next state. Cancel it with
 * `preventDefault()` to keep the current items open. It takes the place of
 * shadcn's `onValueChange` on the accordion and `onOpenChange` on an item.
 */
export class AccordionChangeEvent extends Event {
  readonly value: string[]
  readonly item: string
  readonly open: boolean

  constructor(value: string[], item: string, open: boolean) {
    super(accordionChangeType, { bubbles: true, cancelable: true })
    this.value = value
    this.item = item
    this.open = open
  }
}

declare global {
  interface HTMLElementEventMap {
    [accordionChangeType]: AccordionChangeEvent
  }
}

export interface AccordionProps extends Omit<Props<'div'>, 'defaultValue'> {
  /** The values of the open items, for an accordion the caller controls. */
  value?: string[]
  /** The values of the items open at first. */
  defaultValue?: string[]
  /** Lets several items be open at once. Otherwise opening one closes the others. */
  multiple?: boolean
  /** Disables every item. */
  disabled?: boolean
  /** The level of the headings around the triggers. */
  headingLevel?: AccordionHeadingLevel
  /** Keeps closed panels in the document, hidden. */
  keepMounted?: boolean
  /** Keeps closed panels in the document with hidden="until-found", so find in page opens them. */
  hiddenUntilFound?: boolean
}

export interface AccordionItemProps extends Omit<CollapsibleProps, 'open' | 'defaultOpen' | 'value'> {
  /** Identifies the item in the accordion's value. Without one, the item gets a generated value. */
  value?: string
}

export interface AccordionTriggerProps extends CollapsibleTriggerProps {
  /** The level of this trigger's heading, instead of the accordion's. */
  headingLevel?: AccordionHeadingLevel
}

export interface AccordionContentProps extends CollapsibleContentProps {}

interface AccordionContext {
  value: string[]
  disabled: boolean
  headingLevel: AccordionHeadingLevel
  keepMounted: boolean
  hiddenUntilFound: boolean
  baseId: string
  toggle(item: string, open: boolean, target: HTMLElement): void
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const accordionStyles = css({ display: 'flex', flexDirection: 'column', width: '100%' })

/**
 * A stack of items, each a heading with a native button that opens a panel.
 * One item opens at a time unless `multiple` allows more. It runs in the
 * browser inside your client entry. Before that, it shows the items that
 * start open.
 */
export function Accordion(handle: Handle<AccordionProps, AccordionContext>) {
  let uncontrolledValue = handle.props.defaultValue ?? []

  // Without multiple, only the first value counts, so one item at most is open.
  function currentValue() {
    let value = handle.props.value ?? uncontrolledValue
    return handle.props.multiple ? value : value.slice(0, 1)
  }

  function toggle(item: string, open: boolean, target: HTMLElement) {
    if (handle.props.disabled) return

    let others = currentValue().filter((value) => value !== item)
    let next = handle.props.multiple ? (open ? [...others, item] : others) : open ? [item] : []

    let accepted = target.dispatchEvent(new AccordionChangeEvent(next, item, open))
    if (accepted && handle.props.value === undefined) {
      uncontrolledValue = next
      void handle.update()
    }
  }

  return () => {
    let {
      value: _value,
      defaultValue: _defaultValue,
      multiple: _multiple,
      disabled = false,
      headingLevel = 3,
      keepMounted = false,
      hiddenUntilFound = false,
      mix,
      ...props
    } = handle.props

    handle.context.set({
      value: currentValue(),
      disabled,
      headingLevel,
      keepMounted,
      hiddenUntilFound,
      baseId: props.id ?? handle.id,
      toggle,
    })

    return (
      <div data-slot="accordion" {...props} data-disabled={disabled ? '' : undefined} mix={[accordionStyles, mix]} />
    )
  }
}

const itemStyles = css({
  '&:not(:last-child)': { borderBlockEnd: '1px solid var(--border)' },
})

/**
 * One item: a Collapsible whose open state belongs to the accordion. Its id,
 * and so its trigger's and panel's, comes from the accordion's id and the
 * item's value, unless you give it one.
 */
export function AccordionItem(handle: Handle<AccordionItemProps>) {
  return () => {
    let accordion = handle.context.get(Accordion) as AccordionContext | undefined
    let { value = handle.id, disabled = false, mix, ...props } = handle.props
    let id = props.id ?? `${accordion?.baseId ?? handle.id}-${encodeURIComponent(value)}`

    return (
      <Collapsible
        data-slot="accordion-item"
        {...props}
        id={id}
        open={accordion?.value.includes(value) ?? false}
        disabled={accordion?.disabled || disabled}
        mix={[
          itemStyles,
          mix,
          // The trigger asks this item's Collapsible to change. The accordion decides instead.
          on(collapsibleChangeType, (event) => {
            if (event.target !== event.currentTarget) return
            event.preventDefault()
            event.stopPropagation()
            let current = handle.context.get(Accordion) as AccordionContext | undefined
            current?.toggle(value, event.open, event.currentTarget)
          }),
        ]}
      />
    )
  }
}

const headerStyles = css({ display: 'flex', margin: 0 })

const triggerStyles = css(
  mergeStyles(
    {
      position: 'relative',
      display: 'flex',
      flex: '1 1 0%',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space(4),
      minWidth: 0,
      margin: 0,
      paddingBlock: space(4),
      paddingInline: 0,
      border: '1px solid transparent',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'inherit',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      fontWeight: 500,
      textAlign: 'start',
      overflowWrap: 'anywhere',
      cursor: 'pointer',
      '&:hover:not(:disabled)': { textDecoration: 'underline' },
      '& > svg': {
        flexShrink: 0,
        width: '1rem',
        height: '1rem',
        marginInlineStart: 'auto',
        color: 'var(--muted-foreground)',
        pointerEvents: 'none',
        transitionProperty: 'transform',
        transitionDuration: 'var(--duration-normal)',
        transitionTimingFunction: 'var(--ease-out)',
      },
      '&[aria-expanded="true"] > svg': { transform: 'rotate(180deg)' },
    },
    disabledState,
  ),
)

/**
 * The heading and its native button. Your props, events and mixins reach
 * the button. The chevron turns to point up while the panel is open.
 */
export function AccordionTrigger(handle: Handle<AccordionTriggerProps>) {
  return () => {
    let accordion = handle.context.get(Accordion) as AccordionContext | undefined
    let { headingLevel, children, mix, ...props } = handle.props
    let Heading = `h${headingLevel ?? accordion?.headingLevel ?? 3}` as 'h3'

    return (
      <Heading data-slot="accordion-header" mix={headerStyles}>
        <CollapsibleTrigger data-slot="accordion-trigger" {...props} mix={[triggerStyles, mix]}>
          {children}
          <ChevronDownIcon />
        </CollapsibleTrigger>
      </Heading>
    )
  }
}

const contentStyles = css({
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

const innerStyles = css({
  paddingBlockEnd: space(4),
  '& a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& a:hover': { color: 'var(--foreground)' },
  '& p': { margin: 0 },
  '& p:not(:last-child)': { marginBlockEnd: space(4) },
})

/**
 * The panel, a region named by its trigger. It closes and opens like
 * CollapsibleContent, and takes keepMounted and hiddenUntilFound from the
 * accordion unless you set them here.
 */
export function AccordionContent(handle: Handle<AccordionContentProps>) {
  return () => {
    let accordion = handle.context.get(Accordion) as AccordionContext | undefined
    let collapsible = handle.context.get(Collapsible) as CollapsibleContext | undefined
    let { keepMounted, hiddenUntilFound, children, mix, ...props } = handle.props

    return (
      <CollapsibleContent
        data-slot="accordion-content"
        role="region"
        aria-labelledby={collapsible?.triggerId}
        {...props}
        keepMounted={keepMounted ?? accordion?.keepMounted}
        hiddenUntilFound={hiddenUntilFound ?? accordion?.hiddenUntilFound}
        mix={[contentStyles, mix]}
      >
        <div mix={innerStyles}>{children}</div>
      </CollapsibleContent>
    )
  }
}
