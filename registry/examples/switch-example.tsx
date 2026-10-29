// RemixCN Switch examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Switch examples, after shadcn's switch-example.tsx. They need no JavaScript
// except "Controlled", which shows its state as it changes.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Switch } from '#remixcn/ui/switch.tsx'

// Layout for the examples, the way an app would lay out its own forms. The
// controls bring their own look; these rules only place labels and text.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'sm') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  // A control beside its label.
  row: css({ display: 'flex', alignItems: 'center', gap: space(2), minWidth: 0 }),
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  label: css({ ...text('sm'), fontWeight: 500, userSelect: 'none', overflowWrap: 'anywhere' }),
  // Long words may break, so large text still fits a narrow screen.
  description: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }),
  // A label and its description in one column that may shrink below the longest word.
  fieldText: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(1), minWidth: 0 }),
  // A label that wraps a whole choice, with a border that follows its control.
  choiceCard: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: space(3),
    padding: space(3),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    '&:has(input:checked)': {
      borderColor: 'var(--primary)',
      backgroundColor: 'color-mix(in oklch, var(--primary) 5%, transparent)',
    },
    '&:has(input:disabled)': { opacity: 0.6 },
  }),
  status: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)' }),
}

export function SwitchBasic() {
  return () => (
    <div mix={styles.row}>
      <Switch id="airplane-mode" name="airplane" />
      <label for="airplane-mode" mix={styles.label}>
        Airplane mode
      </label>
    </div>
  )
}

export function SwitchWithDescription() {
  return () => (
    <label mix={styles.choiceCard}>
      <span mix={styles.fieldText}>
        <span mix={styles.label}>Share across devices</span>
        <span id="focus-mode-description" mix={styles.description}>
          Focus is shared across devices, and turns off when you leave the app.
        </span>
      </span>
      <Switch name="focus" aria-describedby="focus-mode-description" />
    </label>
  )
}

export function SwitchWithLabel() {
  return () => (
    <div mix={styles.row}>
      <Switch id="bluetooth" defaultChecked />
      <label for="bluetooth" mix={styles.label}>
        Bluetooth
      </label>
    </div>
  )
}

export function SwitchDisabled() {
  return () => (
    <div mix={styles.stack}>
      <div mix={styles.row}>
        <Switch id="switch-disabled-unchecked" disabled />
        <label for="switch-disabled-unchecked" mix={styles.label}>
          Disabled (off)
        </label>
      </div>
      <div mix={styles.row}>
        <Switch id="switch-disabled-checked" defaultChecked disabled />
        <label for="switch-disabled-checked" mix={styles.label}>
          Disabled (on)
        </label>
      </div>
    </div>
  )
}

export function SwitchSizes() {
  return () => (
    <div mix={styles.stack}>
      <div mix={styles.row}>
        <Switch id="switch-size-sm" size="sm" />
        <label for="switch-size-sm" mix={styles.label}>
          Small
        </label>
      </div>
      <div mix={styles.row}>
        <Switch id="switch-size-default" />
        <label for="switch-size-default" mix={styles.label}>
          Default
        </label>
      </div>
    </div>
  )
}

/** A switch the island controls: it reads each change and renders the state it keeps. */
export const SwitchControlled = clientEntry(
  import.meta.url,
  function SwitchControlled(handle: Handle<{ initiallyOn: boolean }>) {
    let enabled = handle.props.initiallyOn

    return () => (
      <div mix={styles.stack}>
        <div mix={styles.row}>
          <Switch
            id="autopay-controlled"
            checked={enabled}
            mix={on('change', (event) => {
              enabled = event.currentTarget.checked
              void handle.update()
            })}
          />
          <label for="autopay-controlled" mix={styles.label}>
            Pay invoices automatically
          </label>
        </div>
        <p role="status" mix={styles.status}>
          Automatic payment is {enabled ? 'on' : 'off'}.
        </p>
      </div>
    )
  },
)
