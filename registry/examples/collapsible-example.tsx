// RemixCN Collapsible examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { ChevronRightIcon, Icon, MinusIcon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl, visuallyHidden } from '#remixcn/lib/styles.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger, collapsibleChangeType } from '#remixcn/ui/collapsible.tsx'
import { Field, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#remixcn/ui/tabs.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const boxStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(3),
  width: '100%',
  marginInline: 'auto',
  padding: space(4),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--card)',
  color: 'var(--card-foreground)',
})

const treeWidth = css({ width: '100%', maxWidth: '18rem', marginInline: 'auto' })
const cardWidth = css({ width: '100%', maxWidth: '20rem', marginInline: 'auto' })
const fullWidth = css({ width: '100%' })

export function FolderIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </Icon>
  )
}

export function FileIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M6 3.5h8l4.5 4.5v12.5H6Z" />
      <path d="M14 3.5V8h4.5" />
    </Icon>
  )
}

export function PlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Icon>
  )
}

type Entry = { name: string } | { name: string; items: Entry[] }

const files: Entry[] = [
  {
    name: 'invoices',
    items: [
      {
        name: 'templates',
        items: [{ name: 'standard.tsx' }, { name: 'reminder.tsx' }, { name: 'credit-note.tsx' }],
      },
      { name: 'numbering.ts' },
      { name: 'totals.ts' },
    ],
  },
  { name: 'customers', items: [{ name: 'import.ts' }, { name: 'export.ts' }] },
  { name: 'payments', items: [{ name: 'refunds.ts' }, { name: 'webhooks.ts' }] },
  { name: 'app.tsx' },
  { name: 'routes.ts' },
  { name: 'README.md' },
]

const treeStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(1),
  margin: 0,
  padding: 0,
  listStyle: 'none',
})
const nestedStyles = css({ marginInlineStart: space(5), marginBlockStart: space(1) })
const rowStyles = css({
  width: '100%',
  justifyContent: 'flex-start',
  '&:hover': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
  '& > svg:first-child': mirrorInRtl,
  '&[aria-expanded="true"] > svg:first-child': { transform: 'rotate(90deg)' },
})
const fileStyles = css({ width: '100%', justifyContent: 'flex-start', color: 'var(--foreground)' })

function FileTree(handle: Handle<{ entries: Entry[] }>) {
  return () => (
    <ul role="list" mix={treeStyles}>
      {handle.props.entries.map((entry) => (
        <li key={entry.name}>
          {'items' in entry ? (
            <Collapsible>
              <CollapsibleTrigger mix={[buttonVariants({ variant: 'ghost', size: 'sm' }), rowStyles]}>
                <ChevronRightIcon />
                <FolderIcon />
                {entry.name}
              </CollapsibleTrigger>
              <CollapsibleContent mix={nestedStyles}>
                <FileTree entries={entry.items} />
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <a href={`#${entry.name}`} mix={[buttonVariants({ variant: 'link', size: 'sm' }), fileStyles]}>
              <FileIcon />
              <span>{entry.name}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Folders that open and close inside each other, under tabs that switch the view. */
export const CollapsibleFileTree = clientEntry(import.meta.url, function CollapsibleFileTree() {
  return () => (
    <Card size="sm" mix={treeWidth}>
      <CardContent>
        <Tabs defaultValue="explorer">
          <TabsList aria-label="Sidebar" mix={fullWidth}>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
          </TabsList>
          <TabsContent value="explorer" tabindex={-1}>
            <FileTree entries={files} />
          </TabsContent>
          <TabsContent value="outline">
            <p mix={hintStyles}>Open a file to see its outline.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

const fieldsStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space(2),
  flex: '1 1 0%',
  minWidth: 0,
})
const subgridStyles = css({ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid', gap: space(2) })
const settingsRow = css({ display: 'flex', alignItems: 'flex-start', gap: space(2) })
const hiddenLabel = css(visuallyHidden)

function RadiusField(handle: Handle<{ label: string; name: string }>) {
  return () => {
    let id = `${handle.id}-input`
    return (
      <Field>
        <FieldLabel for={id} mix={hiddenLabel}>
          {handle.props.label}
        </FieldLabel>
        <Input id={id} name={handle.props.name} inputMode="numeric" defaultValue="0" />
      </Field>
    )
  }
}

/**
 * A controlled collapsible that shows two more fields. Its trigger is a
 * square outline button whose icon and name follow the state.
 */
export const CollapsibleSettings = clientEntry(import.meta.url, function CollapsibleSettings(handle: Handle) {
  let open = false

  return () => (
    <Card size="sm" mix={cardWidth}>
      <CardHeader>
        <CardTitle level={4}>Corner radius</CardTitle>
        <CardDescription>Round the corners of the invoice header.</CardDescription>
      </CardHeader>
      <CardContent>
        <Collapsible
          open={open}
          mix={[
            settingsRow,
            on(collapsibleChangeType, (event) => {
              open = event.open
              void handle.update()
            }),
          ]}
        >
          <div mix={fieldsStyles}>
            <RadiusField label="Top left radius" name="top-left" />
            <RadiusField label="Top right radius" name="top-right" />
            <CollapsibleContent mix={subgridStyles}>
              <RadiusField label="Bottom left radius" name="bottom-left" />
              <RadiusField label="Bottom right radius" name="bottom-right" />
            </CollapsibleContent>
          </div>
          <CollapsibleTrigger
            aria-label={open ? 'Hide the bottom corners' : 'Show the bottom corners'}
            mix={buttonVariants({ variant: 'outline', size: 'icon' })}
          >
            {open ? <MinusIcon /> : <PlusIcon />}
          </CollapsibleTrigger>
        </Collapsible>
      </CardContent>
    </Card>
  )
})

const recoveryStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(2),
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
})

function Codes(handle: Handle<{ children?: RemixNode }>) {
  return () => <ul mix={recoveryStyles}>{handle.props.children}</ul>
}

/**
 * Base UI's recovery keys: a trigger that names what it shows, and a panel
 * kept in the page while it's closed.
 */
export const CollapsibleRecoveryKeys = clientEntry(import.meta.url, function CollapsibleRecoveryKeys() {
  return () => (
    <Collapsible mix={[boxStyles, cardWidth]}>
      <CollapsibleTrigger mix={[buttonVariants({ variant: 'ghost', size: 'sm' }), rowStyles]}>
        <ChevronRightIcon />
        Recovery keys
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>
        <Codes>
          <li>alien-bean-pasta</li>
          <li>wild-irish-burrito</li>
          <li>horse-battery-staple</li>
        </Codes>
      </CollapsibleContent>
    </Collapsible>
  )
})
