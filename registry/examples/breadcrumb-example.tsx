// RemixCN Breadcrumb examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  breadcrumbLinkVariants,
} from '#remixcn/ui/breadcrumb.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'

const levels = [
  { label: 'Home', href: '#home' },
  { label: 'Customers', href: '#customers' },
  { label: 'Acme Labs', href: '#acme' },
  { label: 'Invoices', href: '#acme-invoices' },
]

/** Native links, chevrons between them, and the current page last. */
export function BreadcrumbBasic() {
  return () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#invoices">Invoices</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>INV-0042</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** Your own separator, such as a slash. */
export function BreadcrumbCustomSeparator() {
  return () => (
    <Breadcrumb aria-label="Settings location">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#settings">Settings</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href="#billing">Billing</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Tax rates</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

const ellipsisButtonStyles = css({ paddingInline: 0 })

/**
 * Collapses the middle levels behind a button that names what it does. It
 * shows them in place, and moves focus to the first one it revealed.
 */
export const BreadcrumbCollapsed = clientEntry(import.meta.url, function BreadcrumbCollapsed(handle: Handle) {
  let expanded = false
  let firstRevealed: HTMLAnchorElement | undefined

  return () => {
    let hidden = levels.slice(1, -1)

    return (
      <Breadcrumb aria-label="Invoice location">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={levels[0].href}>{levels[0].label}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {expanded ? (
            hidden.map((level, index) => [
              <BreadcrumbItem key={level.href}>
                <BreadcrumbLink
                  href={level.href}
                  mix={index === 0 ? ref((element) => (firstRevealed = element)) : undefined}
                >
                  {level.label}
                </BreadcrumbLink>
              </BreadcrumbItem>,
              <BreadcrumbSeparator key={`${level.href}-separator`} />,
            ])
          ) : (
            <>
              <BreadcrumbItem>
                <button
                  type="button"
                  aria-label={`Show ${hidden.length} hidden levels`}
                  mix={[
                    buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
                    ellipsisButtonStyles,
                    on('click', async () => {
                      expanded = true
                      await handle.update()
                      firstRevealed?.focus()
                    }),
                  ]}
                >
                  <BreadcrumbEllipsis />
                </button>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbLink href={levels[levels.length - 1].href}>{levels[levels.length - 1].label}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>INV-0042</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }
})

/** breadcrumbLinkVariants() gives another element, such as a button that opens a menu, the link look. */
export function BreadcrumbWithLinkVariants() {
  return () => (
    <Breadcrumb aria-label="Report location">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#reports">Reports</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <button type="button" aria-haspopup="menu" mix={breadcrumbLinkVariants()}>
            2026
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Revenue by quarter</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
