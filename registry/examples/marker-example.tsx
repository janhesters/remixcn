// RemixCN Marker examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, CircleAlertIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { shimmer } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import { Marker, MarkerContent, MarkerIcon, markerVariants } from '#remixcn/ui/marker.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const shimmerStyles = css(shimmer())
const stackedStyles = css({ flexDirection: 'column', textAlign: 'center' })
const listStyles = css({
  margin: 0,
  paddingInlineStart: space(8),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

export function FileTextIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M9 13h6M9 16.5h6" />
    </Icon>
  )
}

export function SearchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </Icon>
  )
}

export function TerminalIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 7.5 9.5 12 5 16.5M12 17h7" />
    </Icon>
  )
}

export function ChevronDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </Icon>
  )
}

/** The three variants: an inline row, a row with a line under it, and a centered label between two lines. */
export function MarkerVariants() {
  return () => (
    <div mix={stackStyles}>
      <Marker>
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
        <MarkerContent>Explored 4 files</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerIcon>
          <FileTextIcon />
        </MarkerIcon>
        <MarkerContent>Opened implementation notes</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>Today</MarkerContent>
      </Marker>
    </div>
  )
}

/**
 * A status that changes while work runs: role="status" announces each step,
 * the spinner turns, and the text shimmers. Reduced motion keeps both still.
 */
export const MarkerStatus = clientEntry(import.meta.url, function MarkerStatus(handle: Handle) {
  let step: 'searching' | 'reading' | 'done' = 'done'
  let run: AbortController | undefined

  handle.signal.addEventListener('abort', () => run?.abort())

  function start() {
    run?.abort()
    let controller = new AbortController()
    run = controller
    step = 'searching'
    void handle.update()
    let reading = setTimeout(() => {
      step = 'reading'
      void handle.update()
    }, 1200)
    let done = setTimeout(() => {
      step = 'done'
      void handle.update()
    }, 2400)
    controller.signal.addEventListener('abort', () => {
      clearTimeout(reading)
      clearTimeout(done)
    })
  }

  return () => (
    <div mix={stackStyles}>
      <Marker role="status">
        <MarkerIcon>{step === 'done' ? <CheckIcon /> : <Spinner decorative />}</MarkerIcon>
        <MarkerContent mix={step === 'done' ? null : shimmerStyles}>
          {step === 'searching'
            ? 'Searching the invoices…'
            : step === 'reading'
              ? 'Reading 4 files…'
              : 'Explored 4 files'}
        </MarkerContent>
      </Marker>
      <div>
        <Button size="sm" variant="outline" disabled={step !== 'done'} focusableWhenDisabled mix={on('click', start)}>
          Run again
        </Button>
      </div>
    </div>
  )
})

/** Shimmering text for a step that is still running. */
export function MarkerShimmer() {
  return () => (
    <div mix={stackStyles}>
      <Marker>
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent mix={shimmerStyles}>Searching the codebase</MarkerContent>
      </Marker>
      <Marker>
        <MarkerIcon>
          <TerminalIcon />
        </MarkerIcon>
        <MarkerContent mix={shimmerStyles}>Running the test suite</MarkerContent>
      </Marker>
    </div>
  )
}

/** Labelled dividers, such as dates. A long label wraps between the lines. */
export function MarkerSeparator() {
  return () => (
    <div mix={stackStyles}>
      <Marker variant="separator">
        <MarkerContent>Yesterday</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>Conversation compacted to save space</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>Thursday, 29 October 2026, after the release candidate reached every workspace</MarkerContent>
      </Marker>
    </div>
  )
}

/** Rows with a line under each, and an error that says what failed in its text. */
export function MarkerBorder() {
  return () => (
    <div mix={stackStyles}>
      <Marker variant="border">
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent>Searched for "archived invoices"</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerIcon>
          <CircleAlertIcon />
        </MarkerIcon>
        <MarkerContent>Failed: the test suite timed out after 10 minutes</MarkerContent>
      </Marker>
    </div>
  )
}

/** An icon beside the text, and above it. */
export function MarkerWithIcon() {
  return () => (
    <div mix={stackStyles}>
      <Marker>
        <MarkerIcon>
          <TerminalIcon />
        </MarkerIcon>
        <MarkerContent>Ran bun run check in registry/examples/a-very-long-folder-name-without-spaces</MarkerContent>
      </Marker>
      <Marker mix={stackedStyles}>
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
        <MarkerContent>All checks passed</MarkerContent>
      </Marker>
      <Marker aria-label="Synced" role="img">
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
      </Marker>
    </div>
  )
}

/**
 * A marker that is a link or a button, with markerVariants() on the native
 * element. Its text names it. The button shows and hides the steps it ran.
 */
export const MarkerLinksAndButtons = clientEntry(import.meta.url, function MarkerLinksAndButtons(handle: Handle) {
  let expanded = false

  return () => {
    let steps = `${handle.id}-steps`

    return (
      <div mix={stackStyles}>
        <a href="#marker" mix={markerVariants()}>
          <MarkerIcon>
            <FileTextIcon />
          </MarkerIcon>
          <MarkerContent>View the pull request</MarkerContent>
        </a>
        <button
          type="button"
          aria-expanded={expanded ? 'true' : 'false'}
          aria-controls={steps}
          mix={[
            markerVariants(),
            on('click', () => {
              expanded = !expanded
              void handle.update()
            }),
          ]}
        >
          <MarkerIcon>
            <ChevronDownIcon />
          </MarkerIcon>
          <MarkerContent>{expanded ? 'Hide the 3 steps' : 'Show the 3 steps'}</MarkerContent>
        </button>
        <ol id={steps} hidden={!expanded} mix={listStyles}>
          <li>Searched the invoices</li>
          <li>Read 4 files</li>
          <li>Ran the tests</li>
        </ol>
      </div>
    )
  }
})

/** In right-to-left text, the icon and the lines mirror. */
export function MarkerRtl() {
  return () => (
    <div dir="rtl" lang="ar" mix={stackStyles}>
      <Marker>
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
        <MarkerContent>تم فحص 4 ملفات</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>اليوم</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerIcon>
          <FileTextIcon />
        </MarkerIcon>
        <MarkerContent>فتح ملاحظات التنفيذ</MarkerContent>
      </Marker>
    </div>
  )
}
