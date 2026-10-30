// RemixCN Navigation Menu examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '#remixcn/ui/navigation-menu.tsx'

// Each example is a client entry, so its panels run in the browser. Until
// then, and without JavaScript, a button opens its panel natively, and every
// link works.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const listStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(1),
  width: '24rem',
  maxWidth: '100%',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})
const gridStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
  gap: space(2),
  width: '36rem',
  maxWidth: '100%',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})
const narrowListStyles = css({ width: '12rem' })
const entryStyles = css({
  display: 'grid',
  gap: space(1),
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& strong': { fontWeight: 500, lineHeight: 1 },
  '& span': { color: 'var(--muted-foreground)' },
})

const reports = [
  { title: 'Revenue', href: '#revenue', description: 'Money received each month, by customer and by product.' },
  { title: 'Outstanding', href: '#outstanding', description: 'Invoices that are due or overdue, oldest first.' },
  { title: 'Tax', href: '#tax', description: 'The VAT you charged and paid, for each quarter.' },
  { title: 'Customers', href: '#customers', description: 'Who buys most, and who pays late.' },
]

/** A link with a title and a sentence under it. */
function ListItem(handle: Handle<{ title: string; href: string; active?: boolean; children?: RemixNode }>) {
  return () => {
    let { title, href, active, children } = handle.props
    return (
      <li>
        <NavigationMenuLink href={href} active={active}>
          <div mix={entryStyles}>
            <strong>{title}</strong>
            <span>{children}</span>
          </div>
        </NavigationMenuLink>
      </li>
    )
  }
}

/**
 * Buttons that show panels of links, and a link styled like them. The pointer
 * resting on a button opens its panel; once one is open, the next opens at once.
 */
export const NavigationMenuBasic = clientEntry(import.meta.url, function NavigationMenuBasic() {
  return () => (
    <NavigationMenu aria-label="Billing">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={listStyles}>
              <ListItem href="#introduction" title="Introduction" active>
                How billing works, from the first quote to the paid invoice.
              </ListItem>
              <ListItem href="#setup" title="Setup">
                Add your company, your bank account and your tax numbers.
              </ListItem>
              <ListItem href="#first-invoice" title="Your first invoice">
                Write an invoice and send it in under a minute.
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={gridStyles}>
              {reports.map((report) => (
                <ListItem key={report.title} title={report.title} href={report.href}>
                  {report.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>With icon</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={[listStyles, narrowListStyles]}>
              {['Overdue', 'Due this week', 'Disputed'].map((status) => (
                <li key={status}>
                  <NavigationMenuLink href={`#${status.toLowerCase().replaceAll(' ', '-')}`}>
                    <CircleAlertIcon />
                    {status}
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#documentation" mix={navigationMenuTriggerStyle()}>
            Documentation
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
})

/** An arrow under the open panel's button, and panels that line up with the end of their button. */
export const NavigationMenuWithIndicator = clientEntry(import.meta.url, function NavigationMenuWithIndicator() {
  return () => (
    <NavigationMenu aria-label="Account" align="end">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Account</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={[listStyles, narrowListStyles]}>
              <li>
                <NavigationMenuLink href="#profile">Profile</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#plan">Plan and usage</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Help</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={[listStyles, narrowListStyles]}>
              <li>
                <NavigationMenuLink href="#guides">Guides</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#contact">Contact us</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuIndicator />
      </NavigationMenuList>
    </NavigationMenu>
  )
})

/** A vertical list opens its panels beside it. */
export const NavigationMenuVertical = clientEntry(import.meta.url, function NavigationMenuVertical() {
  return () => (
    <NavigationMenu aria-label="Settings" orientation="vertical">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="#general" active>
            General
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Payments</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul mix={[listStyles, narrowListStyles]}>
              <li>
                <NavigationMenuLink href="#bank-accounts">Bank accounts</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#reminders">Reminders</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
})
