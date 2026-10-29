// RemixCN Progress examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '#remixcn/ui/item.tsx'
import { Progress, ProgressLabel, ProgressValue } from '#remixcn/ui/progress.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const fieldStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(1.5),
  '& label': { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)', fontWeight: 500 },
})
// The bar's column is 8rem wide, and shrinks on a narrow screen.
const barColumn = css({ flex: '0 1 8rem', minWidth: space(16) })
const remainingStyles = css({
  minWidth: space(16),
  justifyContent: 'flex-end',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

export function FileIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M6 3.5h8l4 4V20.5H6Z" />
      <path d="M13.5 3.5v4.5H18" />
    </Icon>
  )
}

/** From empty to complete. Each bar is named by aria-label, since it has no visible label. */
export function ProgressValues() {
  return () => (
    <div mix={stackStyles}>
      {[0, 25, 50, 75, 100].map((value) => (
        <Progress key={value} value={value} aria-label={`Example at ${value}%`} />
      ))}
    </div>
  )
}

/** A visible label names the bar, and the value shows next to it. */
export function ProgressWithLabel() {
  return () => (
    <Progress value={56}>
      <ProgressLabel>Upload progress</ProgressLabel>
      <ProgressValue />
    </Progress>
  )
}

/** Without a value, the bar is indeterminate: a short bar slides along the track, and stays still for reduced motion. */
export function ProgressIndeterminate() {
  return () => (
    <Progress value={null}>
      <ProgressLabel>Preparing the export</ProgressLabel>
    </Progress>
  )
}

/** Any range and any format: 3 of 4 steps, and an amount in euros. */
export function ProgressFormatted() {
  return () => (
    <div mix={stackStyles}>
      <Progress value={3} min={0} max={4} getAriaValueText={(_, value) => `Step ${value} of 4`}>
        <ProgressLabel>Onboarding</ProgressLabel>
        <ProgressValue>{(_, value) => `Step ${value} of 4`}</ProgressValue>
      </Progress>
      <Progress value={1250} max={2000} format={{ style: 'currency', currency: 'EUR' }} locale="en-IE">
        <ProgressLabel>Paid of €2,000.00</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}

/**
 * A label of your own, as a component. It may render ProgressLabel anywhere
 * inside the bar, and still names it.
 */
export function GoalLabel(handle: Handle<{ month: string }>) {
  return () => <ProgressLabel>{handle.props.month} goal</ProgressLabel>
}

/** A range input sets the value. The bar follows it, with the keyboard or a pointer. */
export const ProgressControlled = clientEntry(import.meta.url, function ProgressControlled(handle: Handle) {
  let value = 50

  return () => {
    let input = `${handle.id}-input`

    return (
      <div mix={stackStyles}>
        <Progress value={value}>
          <GoalLabel month="Monthly" />
          <ProgressValue />
        </Progress>
        <div mix={fieldStyles}>
          <label for={input}>Set the progress</label>
          <input
            id={input}
            type="range"
            min="0"
            max="100"
            step="1"
            defaultValue="50"
            mix={on('input', (event) => {
              value = Number(event.currentTarget.value)
              void handle.update()
            })}
          />
        </div>
      </div>
    )
  }
})

const files = [
  { name: 'invoices-2026.csv', progress: 45, remaining: '2m 30s' },
  { name: 'contract-acme.pdf', progress: 78, remaining: '45s' },
  { name: 'receipts.zip', progress: null, remaining: 'Waiting' },
  { name: 'logo.png', progress: 100, remaining: 'Done' },
]

/** Uploads in a list, each with its own bar named by the file. */
export function ProgressFileList() {
  return () => (
    <ItemGroup aria-label="Uploads">
      {files.map((file) => (
        <Item key={file.name} size="xs">
          <ItemMedia variant="icon">
            <FileIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{file.name}</ItemTitle>
          </ItemContent>
          <ItemContent mix={barColumn}>
            <Progress value={file.progress} aria-label={`Upload of ${file.name}`} />
          </ItemContent>
          <ItemActions mix={remainingStyles}>{file.remaining}</ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
