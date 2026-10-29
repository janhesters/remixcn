// RemixCN Direction examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Badge } from '#remixcn/ui/badge.tsx'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#remixcn/ui/breadcrumb.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import { DirectionProvider, getDirection } from '#remixcn/ui/direction.tsx'
import type { Direction } from '#remixcn/ui/direction.tsx'
import { Progress, ProgressLabel, ProgressValue } from '#remixcn/ui/progress.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

const copy = {
  ltr: { title: 'Invoice INV-0042', due: 'Due 4 November', home: 'Home', invoices: 'Invoices', sent: 'Sent' },
  rtl: { title: 'الفاتورة INV-0042', due: 'تستحق في 4 نوفمبر', home: 'الرئيسية', invoices: 'الفواتير', sent: 'مرسلة' },
}

/** Reads the nearest provider's direction while it renders, to pick its words. */
function InvoiceSummary(handle: Handle) {
  return () => {
    let direction = getDirection(handle)
    let words = copy[direction]

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle level={3}>{words.title}</CardTitle>
          <CardDescription>{words.due}</CardDescription>
        </CardHeader>
        <CardContent mix={stackStyles}>
          <Breadcrumb aria-label={direction === 'rtl' ? 'المسار' : 'Location'}>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#home">{words.home}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#invoices">{words.invoices}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>INV-0042</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Progress value={60}>
            <ProgressLabel>{words.sent}</ProgressLabel>
            <ProgressValue />
          </Progress>
          <div mix={rowStyles}>
            <Badge variant="secondary">{words.sent}</Badge>
          </div>
        </CardContent>
      </Card>
    )
  }
}

/** A right-to-left subtree with a left-to-right one inside it. Each keeps its own direction. */
export function DirectionNested() {
  return () => (
    <DirectionProvider direction="rtl" lang="ar">
      <div mix={stackStyles}>
        <InvoiceSummary />
        <DirectionProvider direction="ltr" lang="en">
          <InvoiceSummary />
        </DirectionProvider>
      </div>
    </DirectionProvider>
  )
}

/** Switches the direction of a subtree. Logical properties, :dir() and getDirection() follow. */
export const DirectionSwitch = clientEntry(import.meta.url, function DirectionSwitch(handle: Handle) {
  let direction: Direction = 'ltr'

  return () => (
    <div mix={stackStyles}>
      <div>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={direction === 'rtl' ? 'true' : 'false'}
          mix={on('click', () => {
            direction = direction === 'ltr' ? 'rtl' : 'ltr'
            void handle.update()
          })}
        >
          Right to left
        </Button>
      </div>
      <DirectionProvider direction={direction} lang={direction === 'rtl' ? 'ar' : 'en'}>
        <InvoiceSummary />
      </DirectionProvider>
    </div>
  )
})
