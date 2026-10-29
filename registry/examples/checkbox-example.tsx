// RemixCN Checkbox examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Checkbox examples, after shadcn's checkbox-example.tsx. They need no
// JavaScript except "Select all", whose mixed state only the browser can show.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { Checkbox } from '#remixcn/ui/checkbox.tsx'

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
  // A control beside a label and a description, aligned with the label's first line.
  rowStart: css({ display: 'flex', alignItems: 'flex-start', gap: space(3), minWidth: 0 }),
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
  table: css({
    ...text('sm'),
    width: '100%',
    borderCollapse: 'collapse',
    '& th, & td': {
      paddingBlock: space(2),
      paddingInline: space(2),
      textAlign: 'start',
      borderBlockEnd: '1px solid var(--border)',
    },
    '& th': { fontWeight: 500, color: 'var(--muted-foreground)' },
    '& td:nth-child(3)': { overflowWrap: 'anywhere' },
    '& tr:has(input:checked) td': { backgroundColor: 'var(--muted)' },
  }),
  tableScroll: css({ maxWidth: '100%', overflowX: 'auto' }),
}

export function CheckboxBasic() {
  return () => (
    <div mix={styles.row}>
      <Checkbox id="terms" name="terms" />
      <label for="terms" mix={styles.label}>
        Accept terms and conditions
      </label>
    </div>
  )
}

export function CheckboxWithDescription() {
  return () => (
    <div mix={styles.rowStart}>
      <Checkbox id="terms-2" defaultChecked aria-describedby="terms-2-description" />
      <div mix={styles.fieldText}>
        <label for="terms-2" mix={styles.label}>
          Accept terms and conditions
        </label>
        <p id="terms-2-description" mix={styles.description}>
          By clicking this checkbox, you agree to the terms and conditions.
        </p>
      </div>
    </div>
  )
}

export function CheckboxInvalid() {
  return () => (
    <div mix={styles.fieldText}>
      <div mix={styles.row}>
        <Checkbox id="terms-3" required aria-invalid="true" aria-describedby="terms-3-error" />
        <label for="terms-3" mix={styles.label}>
          Accept terms and conditions
        </label>
      </div>
      <p id="terms-3-error" mix={styles.error}>
        <CircleAlertIcon />
        <span>Accept the terms to continue.</span>
      </p>
    </div>
  )
}

export function CheckboxDisabled() {
  return () => (
    <div mix={styles.row}>
      <Checkbox id="notifications-disabled" disabled />
      <label for="notifications-disabled" mix={styles.label}>
        Enable notifications
      </label>
    </div>
  )
}

export function CheckboxWithTitle() {
  return () => (
    <div mix={styles.stack}>
      <label mix={styles.choiceCard}>
        <Checkbox defaultChecked aria-describedby="notifications-card-description" />
        <span mix={styles.fieldText}>
          <span mix={styles.label}>Enable notifications</span>
          <span id="notifications-card-description" mix={styles.description}>
            You can enable or disable notifications at any time.
          </span>
        </span>
      </label>
      <label mix={styles.choiceCard}>
        <Checkbox disabled aria-describedby="notifications-card-disabled-description" />
        <span mix={styles.fieldText}>
          <span mix={styles.label}>Enable notifications</span>
          <span id="notifications-card-disabled-description" mix={styles.description}>
            Disabled: your workspace manages notifications.
          </span>
        </span>
      </label>
    </div>
  )
}

const desktopItems = ['Hard disks', 'External disks', 'CDs, DVDs, and iPods', 'Connected servers']

export function CheckboxGroup() {
  return () => (
    <fieldset mix={styles.fieldset}>
      <legend>Show these items on the desktop:</legend>
      {desktopItems.map((item, index) => (
        <div key={item} mix={styles.row}>
          <Checkbox id={`desktop-${index}`} name="desktop" value={item} defaultChecked={index < 2} />
          <label for={`desktop-${index}`} mix={styles.plainLabel}>
            {item}
          </label>
        </div>
      ))}
    </fieldset>
  )
}

interface Person {
  id: string
  name: string
  email: string
  role: string
}

/**
 * "Select all" over a table: checked when every row is, mixed when some are.
 * The rows are native checkboxes, so the selection submits without this island.
 */
export const CheckboxSelectAll = clientEntry(
  import.meta.url,
  function CheckboxSelectAll(handle: Handle<{ people: Person[]; selected: string[] }>) {
    let selected = new Set(handle.props.selected)

    function select(ids: string[], checked: boolean) {
      for (let id of ids) {
        if (checked) selected.add(id)
        else selected.delete(id)
      }
      void handle.update()
    }

    return () => {
      let { people } = handle.props
      let all = people.length > 0 && people.every((person) => selected.has(person.id))
      let some = !all && people.some((person) => selected.has(person.id))

      return (
        <div mix={styles.stack}>
          <div mix={styles.tableScroll}>
            <table mix={styles.table}>
              <thead>
                <tr>
                  <th scope="col">
                    <Checkbox
                      aria-label="Select all"
                      checked={all}
                      indeterminate={some}
                      mix={on('change', (event) =>
                        select(
                          people.map((person) => person.id),
                          event.currentTarget.checked,
                        ),
                      )}
                    />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <Checkbox
                        name="people"
                        value={person.id}
                        aria-label={`Select ${person.name}`}
                        checked={selected.has(person.id)}
                        mix={on('change', (event) => select([person.id], event.currentTarget.checked))}
                      />
                    </td>
                    <td>{person.name}</td>
                    <td>{person.email}</td>
                    <td>{person.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p role="status" mix={styles.status}>
            {selected.size} of {people.length} selected
          </p>
        </div>
      )
    }
  },
)
