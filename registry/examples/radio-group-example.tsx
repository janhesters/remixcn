// RemixCN Radio Group examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Radio Group examples, after shadcn's radio-group-example.tsx. They need no
// JavaScript except "Controlled", which shows its value as it changes.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { RadioGroup, RadioGroupItem } from '#remixcn/ui/radio-group.tsx'

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
  plainLabel: css({ ...text('sm'), userSelect: 'none', overflowWrap: 'anywhere' }),
  // Long words may break, so large text still fits a narrow screen.
  description: css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }),
  // A label and its description in one column that may shrink below the longest word.
  fieldText: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(1), minWidth: 0 }),
  error: css({
    ...text('sm'),
    display: 'flex',
    alignItems: 'flex-start',
    gap: space(1.5),
    margin: 0,
    color: 'var(--destructive)',
    '& svg': { flexShrink: 0, width: '1rem', height: '1rem', marginBlockStart: '0.125rem' },
  }),
  fieldset: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: space(3),
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
    '& legend': { ...text('sm'), fontWeight: 500, padding: 0, marginBlockEnd: space(3) },
  }),
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

function Choice(handle: Handle<{ id: string; value: string; label: string; invalid?: boolean; describedBy?: string }>) {
  return () => {
    let { id, value, label, invalid, describedBy } = handle.props
    return (
      <div mix={styles.row}>
        <RadioGroupItem
          id={id}
          value={value}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        <label for={id} mix={styles.plainLabel}>
          {label}
        </label>
      </div>
    )
  }
}

export function RadioGroupBasic() {
  return () => (
    <RadioGroup name="density" defaultValue="comfortable" aria-label="Density">
      <Choice id="density-default" value="default" label="Default" />
      <Choice id="density-comfortable" value="comfortable" label="Comfortable" />
      <Choice id="density-compact" value="compact" label="Compact" />
    </RadioGroup>
  )
}

const plans = [
  { value: 'plus', title: 'Plus', description: 'For individuals and small teams.' },
  { value: 'pro', title: 'Pro', description: 'For growing businesses.' },
  { value: 'enterprise', title: 'Enterprise', description: 'For large teams and enterprises.' },
]

export function RadioGroupWithDescriptions() {
  return () => (
    <RadioGroup name="plan" defaultValue="plus" aria-label="Plan">
      {plans.map((plan) => (
        <label key={plan.value} mix={styles.choiceCard}>
          <RadioGroupItem value={plan.value} aria-describedby={`plan-${plan.value}-description`} />
          <span mix={styles.fieldText}>
            <span mix={styles.label}>{plan.title}</span>
            <span id={`plan-${plan.value}-description`} mix={styles.description}>
              {plan.description}
            </span>
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}

export function RadioGroupWithFieldset() {
  return () => (
    <fieldset mix={styles.fieldset}>
      <legend>Battery level</legend>
      <p id="battery-description" mix={styles.description}>
        Choose your preferred battery level.
      </p>
      <RadioGroup name="battery" defaultValue="medium" aria-describedby="battery-description">
        <Choice id="battery-high" value="high" label="High" />
        <Choice id="battery-medium" value="medium" label="Medium" />
        <Choice id="battery-low" value="low" label="Low" />
      </RadioGroup>
    </fieldset>
  )
}

const gridStyles = css({
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 7rem), 1fr))',
  gap: 'calc(var(--spacing) * 2)',
})

export function RadioGroupGrid() {
  return () => (
    <RadioGroup name="size" defaultValue="medium" aria-label="Size" mix={gridStyles}>
      {['Small', 'Medium', 'Large', 'X-Large'].map((size) => (
        <label key={size} mix={styles.choiceCard}>
          <RadioGroupItem value={size.toLowerCase()} />
          <span mix={styles.label}>{size}</span>
        </label>
      ))}
    </RadioGroup>
  )
}

export function RadioGroupDisabled() {
  return () => (
    <div mix={styles.stack}>
      <RadioGroup
        name="disabled-options"
        defaultValue="option2"
        disabled
        aria-label="Options"
        aria-describedby="disabled-options-hint"
      >
        <Choice id="disabled-1" value="option1" label="Disabled" />
        <Choice id="disabled-2" value="option2" label="Option 2" />
        <Choice id="disabled-3" value="option3" label="Option 3" />
      </RadioGroup>
      <p id="disabled-options-hint" mix={styles.description}>
        Disabled: your workspace sets this option.
      </p>
    </div>
  )
}

export function RadioGroupInvalid() {
  return () => (
    <fieldset mix={styles.fieldset}>
      <legend>Notification preferences</legend>
      <RadioGroup name="notify" required aria-invalid="true" aria-describedby="notify-error">
        <Choice id="notify-email" value="email" label="Email only" invalid describedBy="notify-error" />
        <Choice id="notify-sms" value="sms" label="SMS only" invalid describedBy="notify-error" />
        <Choice id="notify-both" value="both" label="Both email and SMS" invalid describedBy="notify-error" />
      </RadioGroup>
      <p id="notify-error" mix={styles.error}>
        <CircleAlertIcon />
        <span>Choose how you want to receive notifications.</span>
      </p>
    </fieldset>
  )
}

/** A group the island controls: it reads each change and renders the value it keeps. */
export const RadioGroupControlled = clientEntry(
  import.meta.url,
  function RadioGroupControlled(handle: Handle<{ initialValue: string }>) {
    let value = handle.props.initialValue

    return () => (
      <div mix={styles.stack}>
        <RadioGroup
          name="billing"
          value={value}
          aria-label="Billing period"
          mix={on('change', (event) => {
            value = (event.target as HTMLInputElement).value
            void handle.update()
          })}
        >
          <Choice id="billing-monthly" value="monthly" label="Monthly" />
          <Choice id="billing-yearly" value="yearly" label="Yearly, two months free" />
        </RadioGroup>
        <p role="status" mix={styles.status}>
          Billing: {value}
        </p>
      </div>
    )
  },
)
