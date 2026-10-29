// RemixCN Button Group examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import {
  buttonGroupItem,
  disabledState,
  invalidState,
  mergeStyles,
  mirrorInRtl,
  transition,
} from '#remixcn/lib/styles.ts'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import type { ButtonSize } from '#remixcn/ui/button.tsx'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupTextVariants,
  buttonGroupVariants,
} from '#remixcn/ui/button-group.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  gap: space(4),
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(6) })
const labelStyles = css({ fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)', fontWeight: 500 })

// A native input that joins the group: it merges buttonGroupItem into its own css().
const inputStyles = css(
  mergeStyles(
    {
      height: space(9),
      minWidth: 0,
      paddingInline: space(2.5),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-sm)',
      '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
    },
    transition('border-color'),
    invalidState,
    disabledState,
    buttonGroupItem,
  ),
)
const onwardStyles = css({ '& svg': mirrorInRtl })

function ArrowLeftIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5" />
    </Icon>
  )
}

function ArrowRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </Icon>
  )
}

function PlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Icon>
  )
}

function MinusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12h15" />
    </Icon>
  )
}

function CopyIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M8.5 8.5h11v11h-11z" />
      <path d="M15.5 8.5v-4h-11v11h4" />
    </Icon>
  )
}

function ShareIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V20h14v-7.5" />
    </Icon>
  )
}

function TrashIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />
    </Icon>
  )
}

function SearchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </Icon>
  )
}

function ChevronDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

function HeartIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10Z" />
    </Icon>
  )
}

/** Outline buttons joined into one control. Name the group with aria-label. */
export function ButtonGroupBasic() {
  return () => (
    <ButtonGroup aria-label="Invoice actions">
      <Button variant="outline">Archive</Button>
      <Button variant="outline">Report</Button>
      <Button variant="outline">Snooze</Button>
    </ButtonGroup>
  )
}

/**
 * An input and a submit button in one search form. The group adds no form of
 * its own, so the input and the button submit the form around them.
 */
export function ButtonGroupWithInput(handle: Handle<{ action: string }>) {
  return () => (
    <form role="search" action={handle.props.action} method="get" mix={stackStyles}>
      <ButtonGroup>
        <input
          data-slot="input"
          type="search"
          name="q"
          aria-label="Search invoices"
          placeholder="Invoice or customer"
          mix={inputStyles}
        />
        <Button type="submit" variant="outline" aria-label="Search">
          <SearchIcon />
        </Button>
      </ButtonGroup>
    </form>
  )
}

/** Text as a part of the group, and a native label styled as group text, so it keeps naming its field. */
export function ButtonGroupWithText(handle: Handle) {
  return () => {
    let amount = `${handle.id}-amount`

    return (
      <div mix={stackStyles}>
        <ButtonGroup aria-label="Due date">
          <ButtonGroupText>Due in</ButtonGroupText>
          <Button variant="outline">14 days</Button>
          <Button variant="outline">30 days</Button>
        </ButtonGroup>
        <ButtonGroup>
          <label for={amount} mix={buttonGroupTextVariants()}>
            CHF
          </label>
          <input id={amount} data-slot="input" name="amount" inputMode="decimal" placeholder="0.00" mix={inputStyles} />
        </ButtonGroup>
      </div>
    )
  }
}

/** Icon-only parts, each named with aria-label. */
export function ButtonGroupWithIcons() {
  return () => (
    <ButtonGroup aria-label="Share invoice">
      <Button variant="outline" size="icon" aria-label="Copy link">
        <CopyIcon />
      </Button>
      <Button variant="outline" size="icon" aria-label="Share">
        <ShareIcon />
      </Button>
      <Button variant="outline" size="icon" aria-label="Delete">
        <TrashIcon />
      </Button>
    </ButtonGroup>
  )
}

/**
 * A split button. Secondary buttons have no border, so a separator divides
 * the halves. The menu itself comes with Dropdown Menu.
 */
export function ButtonGroupSplit() {
  return () => (
    <ButtonGroup aria-label="Send invoice">
      <Button variant="secondary">Send invoice</Button>
      <ButtonGroupSeparator />
      <Button variant="secondary" size="icon" aria-label="More ways to send">
        <ChevronDownIcon />
      </Button>
    </ButtonGroup>
  )
}

/** A count shown as group text, so it reads as text and not as another button. */
export function ButtonGroupWithCount() {
  return () => (
    <ButtonGroup aria-label="Likes">
      <Button variant="outline">
        <HeartIcon data-icon="inline-start" />
        Like
      </Button>
      <ButtonGroupText>1.2K</ButtonGroupText>
    </ButtonGroup>
  )
}

/** Groups inside a group sit apart. */
export function ButtonGroupNested() {
  return () => (
    <ButtonGroup aria-label="Message">
      <ButtonGroup>
        <Button variant="outline" size="icon" aria-label="Attach a file">
          <PlusIcon />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <input data-slot="input" aria-label="Message" placeholder="Write a note…" size={14} mix={inputStyles} />
        <Button variant="outline" mix={onwardStyles}>
          Send
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  )
}

/**
 * Page links joined into a group. buttonGroupVariants() turns the nav itself
 * into the group, and buttonVariants() keeps each link a native link.
 */
export function ButtonGroupPagination() {
  let pages = [1, 2, 3, 4, 5]

  return () => (
    <nav aria-label="Invoice pages" mix={buttonGroupVariants()}>
      <a href="#page-1" mix={[buttonVariants({ variant: 'outline', size: 'sm' }), onwardStyles]}>
        <ArrowLeftIcon data-icon="inline-start" />
        Previous
      </a>
      {pages.map((page) => (
        <a
          key={page}
          href={`#page-${page}`}
          aria-current={page === 2 ? 'page' : undefined}
          mix={buttonVariants({ variant: page === 2 ? 'secondary' : 'outline', size: 'sm' })}
        >
          {page}
        </a>
      ))}
      <a href="#page-3" mix={[buttonVariants({ variant: 'outline', size: 'sm' }), onwardStyles]}>
        Next
        <ArrowRightIcon data-icon="inline-end" />
      </a>
    </nav>
  )
}

/** A field label names the group through aria-labelledby. */
export function ButtonGroupLabelled(handle: Handle) {
  return () => {
    let label = `${handle.id}-label`

    return (
      <div mix={stackStyles}>
        <span id={label} mix={labelStyles}>
          Export as
        </span>
        <ButtonGroup aria-labelledby={label}>
          <Button variant="outline" size="sm">
            CSV
          </Button>
          <Button variant="outline" size="sm">
            PDF
          </Button>
          <Button variant="outline" size="sm">
            XLSX
          </Button>
        </ButtonGroup>
      </div>
    )
  }
}

/** Vertical groups join from top to bottom, also when nested. */
export function ButtonGroupVertical() {
  return () => (
    <div mix={rowStyles}>
      <ButtonGroup orientation="vertical" aria-label="Zoom">
        <Button variant="outline" size="icon" aria-label="Zoom in">
          <PlusIcon />
        </Button>
        <Button variant="outline" size="icon" aria-label="Zoom out">
          <MinusIcon />
        </Button>
      </ButtonGroup>
      <ButtonGroup orientation="vertical" aria-label="Invoice tools">
        <ButtonGroup orientation="vertical">
          <Button variant="outline" size="icon" aria-label="Search">
            <SearchIcon />
          </Button>
          <Button variant="outline" size="icon" aria-label="Copy">
            <CopyIcon />
          </Button>
        </ButtonGroup>
        <ButtonGroup orientation="vertical">
          <Button variant="outline" size="icon" aria-label="Share">
            <ShareIcon />
          </Button>
        </ButtonGroup>
      </ButtonGroup>
      <ButtonGroup orientation="vertical" aria-label="Reminder actions">
        <Button variant="secondary">Send now</Button>
        <ButtonGroupSeparator orientation="horizontal" />
        <Button variant="secondary">Send tomorrow</Button>
      </ButtonGroup>
    </div>
  )
}

/** Size each button; the group follows. */
export function ButtonGroupSizes() {
  let sizes: Array<[ButtonSize, ButtonSize]> = [
    ['xs', 'icon-xs'],
    ['sm', 'icon-sm'],
    ['default', 'icon'],
    ['lg', 'icon-lg'],
  ]

  return () => (
    <div mix={stackStyles}>
      {sizes.map(([size, iconSize]) => (
        <ButtonGroup key={size} aria-label={`Size ${size}`}>
          <Button variant="outline" size={size}>
            Small print
          </Button>
          <Button variant="outline" size={size}>
            Reminder
          </Button>
          <Button variant="outline" size={iconSize} aria-label="Add">
            <PlusIcon />
          </Button>
        </ButtonGroup>
      ))}
    </div>
  )
}

/**
 * A quantity stepper with its own state. A button that reaches the limit
 * keeps focus with focusableWhenDisabled, the output announces the new value,
 * and a hidden input, which has no data-slot, submits it without joining.
 */
export const ButtonGroupStepper = clientEntry(
  import.meta.url,
  function ButtonGroupStepper(handle: Handle<{ label: string; name: string; initial?: number; max?: number }>) {
    let count = handle.props.initial ?? 1

    return () => {
      let { label, name, max = 9 } = handle.props
      let change = (by: number) =>
        on<HTMLButtonElement, 'click'>('click', () => {
          count = Math.min(max, Math.max(1, count + by))
          void handle.update()
        })

      return (
        <ButtonGroup aria-label={label}>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Fewer ${label}`}
            disabled={count <= 1}
            focusableWhenDisabled
            mix={change(-1)}
          >
            <MinusIcon />
          </Button>
          <output mix={buttonGroupTextVariants()}>{count}</output>
          <Button
            variant="outline"
            size="icon"
            aria-label={`More ${label}`}
            disabled={count >= max}
            focusableWhenDisabled
            mix={change(1)}
          >
            <PlusIcon />
          </Button>
          <input type="hidden" name={name} value={String(count)} />
        </ButtonGroup>
      )
    }
  },
)
