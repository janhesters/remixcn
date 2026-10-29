// RemixCN Resizable examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Resizable examples, after shadcn's resizable-example.tsx and the demos on
// its Resizable page. The handles need the browser, so each example is a
// client entry. The server still renders every layout from its percentages.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  resizableLayoutChangeType,
} from '#remixcn/ui/resizable.tsx'
import type { ResizableLayout } from '#remixcn/ui/resizable.tsx'

// Layout for the examples, the way an app would size and fill its own panels
// and scroll areas. The components bring their own look.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm' | 'base') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  /** The border and height shadcn's examples give a panel group: rounded-lg border min-h-[200px]. */
  group: css({ minHeight: '12.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }),
  /** A nested group's outer frame takes its height from the content. */
  nestedGroup: css({ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }),
  /** Centers a panel's label, as shadcn's flex h-full items-center justify-center p-6. */
  panelContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: space(2),
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
    textAlign: 'center',
    overflowWrap: 'anywhere',
    '@media (max-width: 40rem)': { padding: space(3) },
  }),
  tallPanelContent: css({ height: '12.5rem' }),
  panelLabel: css({ fontWeight: 600 }),
  muted: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)' }),
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  button: css({
    ...text('sm'),
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'start',
    minHeight: space(9),
    paddingInline: space(4),
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    fontWeight: 500,
    cursor: 'pointer',
  }),
  folderList: css({
    ...text('sm'),
    display: 'grid',
    gap: space(1),
    margin: 0,
    padding: space(3),
    listStyle: 'none',
    '& a': { display: 'block', padding: `${space(1)} ${space(2)}`, borderRadius: 'var(--radius-sm)', color: 'inherit' },
  }),
  messages: css({ ...text('sm'), display: 'grid', gap: space(2), padding: space(4) }),
}

function Label(handle: Handle<{ children?: string }>) {
  return () => (
    <div mix={styles.panelContent}>
      <span mix={styles.panelLabel}>{handle.props.children}</span>
    </div>
  )
}

export const ResizableHorizontal = clientEntry(import.meta.url, function ResizableHorizontal() {
  return () => (
    <ResizablePanelGroup orientation="horizontal" mix={styles.group}>
      <ResizablePanel id="horizontal-sidebar" defaultSize="25%">
        <Label>Sidebar</Label>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize the sidebar" />
      <ResizablePanel id="horizontal-content" defaultSize="75%">
        <Label>Content</Label>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

export const ResizableVertical = clientEntry(import.meta.url, function ResizableVertical() {
  return () => (
    <ResizablePanelGroup orientation="vertical" mix={styles.group}>
      <ResizablePanel id="vertical-header" defaultSize="25%">
        <Label>Header</Label>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize the header" />
      <ResizablePanel id="vertical-content" defaultSize="75%">
        <Label>Content</Label>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

export const ResizableWithHandle = clientEntry(import.meta.url, function ResizableWithHandle() {
  return () => (
    <ResizablePanelGroup orientation="horizontal" mix={styles.group}>
      <ResizablePanel id="handle-sidebar" defaultSize="25%">
        <Label>Sidebar</Label>
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Resize the sidebar" />
      <ResizablePanel id="handle-content" defaultSize="75%">
        <Label>Content</Label>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

export const ResizableNested = clientEntry(import.meta.url, function ResizableNested() {
  return () => (
    <ResizablePanelGroup orientation="horizontal" mix={styles.nestedGroup}>
      <ResizablePanel id="nested-one" defaultSize="50%">
        <div mix={[styles.panelContent, styles.tallPanelContent]}>
          <span mix={styles.panelLabel}>One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize one" />
      <ResizablePanel id="nested-right" defaultSize="50%">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel id="nested-two" defaultSize="25%">
            <Label>Two</Label>
          </ResizablePanel>
          <ResizableHandle aria-label="Resize two" />
          <ResizablePanel id="nested-three" defaultSize="75%">
            <Label>Three</Label>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

/** Shows each panel's share as the layout changes, from the group's change events. */
export const ResizableControlled = clientEntry(import.meta.url, function ResizableControlled(handle: Handle) {
  let layout: ResizableLayout = {}

  return () => (
    <ResizablePanelGroup
      orientation="horizontal"
      mix={[
        styles.group,
        on(resizableLayoutChangeType, (event) => {
          layout = event.layout
          void handle.update()
        }),
      ]}
    >
      <ResizablePanel id="controlled-left" defaultSize="30%" minSize="20%">
        <div mix={styles.panelContent}>
          <span mix={styles.panelLabel}>{Math.round(layout['controlled-left'] ?? 30)}%</span>
        </div>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize the left panel" />
      <ResizablePanel id="controlled-right" defaultSize="70%" minSize="30%">
        <div mix={styles.panelContent}>
          <span mix={styles.panelLabel}>{Math.round(layout['controlled-right'] ?? 70)}%</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

const folders = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Invoices']

/**
 * A collapsible folder list with a button that hides and shows it. The
 * button sets the layout the group renders, the native way to collapse and
 * expand a panel from code. Enter on the handle, or a drag, collapses it too.
 */
export const ResizableCollapsible = clientEntry(import.meta.url, function ResizableCollapsible(handle: Handle) {
  let layout: ResizableLayout = { 'mail-folders': 30, 'mail-messages': 70 }
  // The last layout with the folders open, to restore.
  let open = layout
  let collapsed = () => (layout['mail-folders'] ?? 0) < 1

  return () => (
    <div mix={styles.stack}>
      <button
        type="button"
        aria-controls="mail-folders"
        aria-expanded={collapsed() ? 'false' : 'true'}
        mix={[
          styles.button,
          on('click', () => {
            if (collapsed()) {
              layout = open
            } else {
              open = layout
              layout = { 'mail-folders': 0, 'mail-messages': 100 }
            }
            void handle.update()
          }),
        ]}
      >
        {collapsed() ? 'Show folders' : 'Hide folders'}
      </button>
      <ResizablePanelGroup
        layout={layout}
        mix={[
          styles.group,
          on(resizableLayoutChangeType, (event) => {
            layout = event.layout
            if (!collapsed()) open = layout
            void handle.update()
          }),
        ]}
      >
        <ResizablePanel id="mail-folders" collapsible minSize="20%" maxSize="20rem">
          <nav aria-label="Folders">
            <ul mix={styles.folderList}>
              {folders.map((folder) => (
                <li key={folder}>
                  <a href={`#${folder.toLowerCase()}`}>{folder}</a>
                </li>
              ))}
            </ul>
          </nav>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize the folders" />
        <ResizablePanel id="mail-messages" minSize="30%">
          <div mix={styles.messages}>
            <span mix={styles.panelLabel}>Inbox</span>
            <p mix={styles.muted}>Invoice INV-2026-014 was paid by Northwind Studio.</p>
            <p mix={styles.muted}>Quote Q-2026-031 for Lumen Labs expires on Friday.</p>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
})

/** The same group in Arabic text: the sidebar starts on the right. */
export const ResizableRightToLeft = clientEntry(import.meta.url, function ResizableRightToLeft() {
  return () => (
    <ResizablePanelGroup orientation="horizontal" mix={styles.group}>
      <ResizablePanel id="rtl-sidebar" defaultSize="30%">
        <Label>الشريط الجانبي</Label>
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="تغيير حجم الشريط الجانبي" />
      <ResizablePanel id="rtl-content" defaultSize="70%">
        <Label>المحتوى</Label>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})
