// RemixCN Skeleton examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardHeader } from '#remixcn/ui/card.tsx'
import { Skeleton } from '#remixcn/ui/skeleton.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const rowStyles = css({ display: 'flex', alignItems: 'center', gap: space(4) })
const linesStyles = css({ display: 'grid', flex: '1 1 0%', gap: space(2) })
const hiddenStyles = css(visuallyHidden)
const line = (width: string, height = space(4)) => css({ width, height })
const circle = (size: number) => css({ width: space(size), height: space(size), flexShrink: 0, borderRadius: '9999px' })
const nameStyles = css({ margin: 0, fontWeight: 500 })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

/**
 * Marks a region that loads: aria-busy while it loads, and a visually
 * hidden status that says what loads, and optionally that it's done. The
 * status sits outside the busy region, since assistive technology may hold
 * back changes inside a busy one. The skeleton shapes are hidden from
 * assistive technology.
 */
export function Loading(handle: Handle<{ label: string; done?: string; busy?: boolean; children?: RemixNode }>) {
  return () => {
    let { label, done = '', busy = true, children } = handle.props

    return (
      <div>
        <p role="status" mix={hiddenStyles}>
          {busy ? label : done}
        </p>
        <div aria-busy={busy ? 'true' : 'false'}>{children}</div>
      </div>
    )
  }
}

/** A person's avatar and name while they load. */
export function SkeletonAvatar() {
  return () => (
    <Loading label="Loading the account owner">
      <div mix={rowStyles}>
        <Skeleton mix={circle(10)} />
        <div mix={linesStyles}>
          <Skeleton mix={line('min(100%, 9rem)')} />
          <Skeleton mix={line('min(100%, 6rem)')} />
        </div>
      </div>
    </Loading>
  )
}

/** A card while it loads. */
export function SkeletonCard() {
  return () => (
    <Loading label="Loading the invoice">
      <Card>
        <CardHeader>
          <Skeleton mix={line('66%')} />
          <Skeleton mix={line('33%')} />
        </CardHeader>
        <CardContent>
          <Skeleton mix={line('100%', space(24))} />
        </CardContent>
      </Card>
    </Loading>
  )
}

/** Lines of text, a form and a table while they load. */
export function SkeletonText() {
  return () => (
    <Loading label="Loading the notes">
      <div mix={linesStyles}>
        <Skeleton mix={line('100%')} />
        <Skeleton mix={line('100%')} />
        <Skeleton mix={line('75%')} />
      </div>
    </Loading>
  )
}

export function SkeletonForm() {
  return () => (
    <Loading label="Loading the billing details">
      <div mix={stackStyles}>
        {[0, 1].map((field) => (
          <div key={field} mix={linesStyles}>
            <Skeleton mix={line('5rem')} />
            <Skeleton mix={line('100%', space(9))} />
          </div>
        ))}
        <Skeleton mix={line('6rem', space(9))} />
      </div>
    </Loading>
  )
}

export function SkeletonTable() {
  return () => (
    <Loading label="Loading the invoices">
      <div mix={linesStyles}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} mix={rowStyles}>
            <Skeleton mix={line('25%')} />
            <Skeleton mix={line('40%')} />
            <Skeleton mix={line('20%')} />
          </div>
        ))}
      </div>
    </Loading>
  )
}

/**
 * Loads on demand: the skeleton holds the place, the status says what loads
 * and when it's done, and the content replaces the skeleton. The duration is
 * invented.
 */
export const SkeletonReload = clientEntry(
  import.meta.url,
  function SkeletonReload(handle: Handle<{ duration?: number }>) {
    let loading = false
    let reloaded = false

    return () => (
      <div mix={stackStyles}>
        <Loading label="Loading the account owner" done={reloaded ? 'Account owner loaded' : ''} busy={loading}>
          {loading ? (
            <div mix={rowStyles}>
              <Skeleton mix={circle(10)} />
              <div mix={linesStyles}>
                <Skeleton mix={line('min(100%, 9rem)')} />
                <Skeleton mix={line('min(100%, 6rem)')} />
              </div>
            </div>
          ) : (
            <div mix={rowStyles}>
              <Avatar size="lg">
                <AvatarFallback>GH</AvatarFallback>
              </Avatar>
              <div>
                <p mix={nameStyles}>Grace Hopper</p>
                <p mix={mutedStyles}>Account owner</p>
              </div>
            </div>
          )}
        </Loading>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            focusableWhenDisabled
            mix={on('click', async (_event, signal) => {
              loading = true
              await handle.update()
              await new Promise((resolve) => setTimeout(resolve, handle.props.duration ?? 1500))
              if (signal.aborted) return
              loading = false
              reloaded = true
              void handle.update()
            })}
          >
            Reload
          </Button>
        </div>
      </div>
    )
  },
)
