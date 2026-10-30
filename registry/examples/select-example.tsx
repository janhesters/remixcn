// RemixCN Select examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import { Field, FieldDescription, FieldError, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { Item, ItemContent, ItemDescription, ItemTitle } from '#remixcn/ui/item.tsx'
import { NativeSelect, NativeSelectOption } from '#remixcn/ui/native-select.tsx'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '#remixcn/ui/select.tsx'
import type { SelectContentProps } from '#remixcn/ui/select.tsx'

// Each example is a client entry, so its select runs in the browser. Until
// then, and without JavaScript, the native select it renders is the control.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  gap: space(4),
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const growStyles = css({ flex: '1 1 10rem', minWidth: 0 })
const sideStyles = css({ width: 'min(100%, 7rem)', textTransform: 'capitalize' })
const narrowStyles = css({ width: 'min(100%, 9rem)' })
const planStyles = css({ width: 'min(100%, 18rem)' })
const multipleStyles = css({ width: 'min(100%, 18rem)' })
const statusStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const planItemStyles = css({ width: '100%', padding: 0, whiteSpace: 'normal' })

const fruits = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Blueberry', value: 'blueberry' },
  { label: 'Grapes', value: 'grapes' },
  { label: 'Pineapple', value: 'pineapple' },
]

/** The fruits, after an item without a value that shows as the placeholder and clears the choice. */
function FruitItems(handle: Handle<{ disabled?: string }>) {
  return () => (
    <SelectGroup>
      <SelectItem value={null}>Select a fruit</SelectItem>
      {fruits.map((fruit) => (
        <SelectItem key={fruit.value} value={fruit.value} disabled={fruit.value === handle.props.disabled}>
          {fruit.label}
        </SelectItem>
      ))}
    </SelectGroup>
  )
}

/** A select whose first item, without a value, is the placeholder. */
export const SelectBasic = clientEntry(import.meta.url, function SelectBasic() {
  return () => (
    <Select name="fruit">
      <SelectTrigger aria-label="Fruit">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <FruitItems />
      </SelectContent>
    </Select>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** The list beside the trigger on every side. Inline start and end follow the text direction. */
export const SelectSides = clientEntry(import.meta.url, function SelectSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <Select key={side}>
          <SelectTrigger aria-label={`Fruit, list on ${side.replace('-', ' ')}`} mix={sideStyles}>
            <SelectValue placeholder={side.replace('-', ' ')} />
          </SelectTrigger>
          <SelectContent side={side} alignItemWithTrigger={false}>
            <SelectGroup>
              {fruits.slice(0, 3).map((fruit) => (
                <SelectItem key={fruit.value} value={fruit.value}>
                  {fruit.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  )
})

function LineChartIcon() {
  return () => (
    <Icon>
      <path d="M4 4v16h16" />
      <path d="m7 15 4-5 3 3 5-6" />
    </Icon>
  )
}

function BarChartIcon() {
  return () => (
    <Icon>
      <path d="M4 4v16h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </Icon>
  )
}

function PieChartIcon() {
  return () => (
    <Icon>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </Icon>
  )
}

const charts = [
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'bar', label: 'Bar', icon: BarChartIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
]

function ChartSelect(handle: Handle<{ size: 'sm' | 'default' }>) {
  return () => (
    <Select defaultValue="line">
      <SelectTrigger aria-label={`Chart type, ${handle.props.size} size`} size={handle.props.size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {charts.map((chart) => (
            <SelectItem key={chart.value} value={chart.value} label={chart.label}>
              <chart.icon />
              {chart.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/** Items with an icon before their text. The trigger shows the chosen item's icon too. */
export const SelectWithIcons = clientEntry(import.meta.url, function SelectWithIcons() {
  return () => (
    <div mix={stackStyles}>
      <ChartSelect size="sm" />
      <ChartSelect size="default" />
    </div>
  )
})

/** Labelled groups with a separator between them. */
export const SelectWithGroups = clientEntry(import.meta.url, function SelectWithGroups() {
  return () => (
    <Select>
      <SelectTrigger aria-label="Produce">
        <SelectValue placeholder="Select produce" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="broccoli">Broccoli</SelectItem>
          <SelectItem value="spinach">Spinach</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
})

const manyItems = Array.from({ length: 100 }, (_, index) => `Item ${index}`)

/** A hundred items: the list scrolls, with buttons that scroll it on hover. */
export const SelectLargeList = clientEntry(import.meta.url, function SelectLargeList() {
  return () => (
    <Select>
      <SelectTrigger aria-label="Item">
        <SelectValue placeholder="Select an item" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {manyItems.map((name) => (
            <SelectItem key={name} value={name.toLowerCase().replace(' ', '-')}>
              {name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
})

/** Several choices. The list stays open while you choose, and the trigger counts them. */
export const SelectMultiple = clientEntry(import.meta.url, function SelectMultiple() {
  let labels = new Map(fruits.map((fruit) => [fruit.value, fruit.label]))

  return () => (
    <Select name="fruits" multiple defaultValue={[]}>
      <SelectTrigger aria-label="Fruits" mix={multipleStyles}>
        <SelectValue>
          {(value: string[]) =>
            value.length === 0
              ? 'Select fruits'
              : value.length === 1
                ? labels.get(value[0])
                : `${value.length} fruits selected`
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {fruits.map((fruit) => (
            <SelectItem key={fruit.value} value={fruit.value}>
              {fruit.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
})

function SizedFruit(handle: Handle<{ size: 'sm' | 'default' }>) {
  return () => (
    <Select>
      <SelectTrigger aria-label={`Fruit, ${handle.props.size} size`} size={handle.props.size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <FruitItems />
      </SelectContent>
    </Select>
  )
}

/** The small and the default trigger. */
export const SelectSizes = clientEntry(import.meta.url, function SelectSizes() {
  return () => (
    <div mix={stackStyles}>
      <SizedFruit size="sm" />
      <SizedFruit size="default" />
    </div>
  )
})

const plans = [
  { value: 'starter', name: 'Starter', description: 'For one person sending a few invoices.' },
  { value: 'team', name: 'Team', description: 'Shared clients and invoices for a small team.' },
  { value: 'enterprise', name: 'Enterprise', description: 'Approvals and audit logs for larger firms.' },
]

function PlanItem(handle: Handle<{ value: string | null }>) {
  return () => {
    let plan = plans.find((entry) => entry.value === handle.props.value) ?? plans[0]
    return (
      <Item size="xs" mix={planItemStyles}>
        <ItemContent>
          <ItemTitle>{plan.name}</ItemTitle>
          <ItemDescription>{plan.description}</ItemDescription>
        </ItemContent>
      </Item>
    )
  }
}

/**
 * Items with a title and a description, in the list and in the trigger.
 * Base UI takes objects as values; here the value is the plan's key, and
 * SelectValue looks the plan up.
 */
export const SelectPlan = clientEntry(import.meta.url, function SelectPlan() {
  return () => (
    <Select name="plan" defaultValue="starter">
      <SelectTrigger aria-label="Subscription plan" mix={planStyles}>
        <SelectValue>{(value: string | null) => <PlanItem value={value} />}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {plans.map((plan) => (
            <SelectItem key={plan.value} value={plan.value} label={plan.name}>
              <PlanItem value={plan.value} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
})

/** A select beside a button of the same height, in both sizes. */
export const SelectWithButton = clientEntry(import.meta.url, function SelectWithButton() {
  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        <SizedFruit size="sm" />
        <Button variant="outline" size="sm">
          Submit
        </Button>
      </div>
      <div mix={rowStyles}>
        <SizedFruit size="default" />
        <Button variant="outline">Submit</Button>
      </div>
    </div>
  )
})

/** The list opens over the trigger, with the chosen item where the value is. Grapes is off. */
export const SelectItemAligned = clientEntry(import.meta.url, function SelectItemAligned() {
  let content: SelectContentProps = { alignItemWithTrigger: true }
  return () => (
    <Select defaultValue="blueberry">
      <SelectTrigger aria-label="Fruit, lined up with the trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent {...content}>
        <FruitItems disabled="grapes" />
      </SelectContent>
    </Select>
  )
})

/** A label and a description in a Field. The label's `for` names the trigger. */
export const SelectWithField = clientEntry(import.meta.url, function SelectWithField(handle: Handle) {
  let id = `${handle.id}-fruit`

  return () => (
    <Field>
      <FieldLabel for={id}>Favorite fruit</FieldLabel>
      <Select name="favorite">
        <SelectTrigger id={id} aria-describedby={`${id}-description`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <FruitItems />
        </SelectContent>
      </Select>
      <FieldDescription id={`${id}-description`}>Choose your favorite fruit from the list.</FieldDescription>
    </Field>
  )
})

/** An invalid trigger, alone and in a Field with its error. */
export const SelectInvalid = clientEntry(import.meta.url, function SelectInvalid(handle: Handle) {
  let id = `${handle.id}-fruit`

  return () => (
    <div mix={stackStyles}>
      <Select>
        <SelectTrigger aria-label="Fruit, invalid" aria-invalid="true">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <FruitItems />
        </SelectContent>
      </Select>
      <Field data-invalid="true">
        <FieldLabel for={id}>Favorite fruit</FieldLabel>
        <Select>
          <SelectTrigger id={id} aria-invalid="true" aria-describedby={`${id}-error`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <FruitItems />
          </SelectContent>
        </Select>
        <FieldError id={`${id}-error`} errors={[{ message: 'Please select a valid fruit.' }]} />
      </Field>
    </div>
  )
})

const filters = [
  { label: 'Filter', value: null },
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

/** A search field, a Select and a NativeSelect in one row. */
export const SelectInline = clientEntry(import.meta.url, function SelectInline() {
  return () => (
    <div mix={rowStyles}>
      <Input aria-label="Search" placeholder="Search..." mix={growStyles} />
      <Select>
        <SelectTrigger aria-label="Filter" mix={narrowStyles}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {filters.map((filter) => (
              <SelectItem key={filter.label} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <NativeSelect aria-label="Sort by" mix={narrowStyles}>
        <NativeSelectOption value="">Sort by</NativeSelectOption>
        <NativeSelectOption value="name">Name</NativeSelectOption>
        <NativeSelectOption value="date">Date</NativeSelectOption>
        <NativeSelectOption value="status">Status</NativeSelectOption>
      </NativeSelect>
    </div>
  )
})

/** A disabled select, which leaves the form. */
export const SelectDisabled = clientEntry(import.meta.url, function SelectDisabled() {
  return () => (
    <Select name="disabled-fruit" disabled>
      <SelectTrigger aria-label="Fruit, disabled">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <FruitItems disabled="grapes" />
      </SelectContent>
    </Select>
  )
})

/** A select in a dialog: its list opens above the dialog, and Escape closes only the list. */
export const SelectInDialog = clientEntry(import.meta.url, function SelectInDialog() {
  return () => (
    <Dialog>
      <DialogTrigger mix={buttonVariants({ variant: 'outline' })}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select example</DialogTitle>
          <DialogDescription>Use the select below to choose a fruit.</DialogDescription>
        </DialogHeader>
        <Select>
          <SelectTrigger aria-label="Fruit in the dialog">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <FruitItems />
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  )
})

const sortings = [
  { value: 'due', label: 'Due date' },
  { value: 'amount', label: 'Amount' },
  { value: 'client', label: 'Client' },
]

/** A select you control: the status follows the value, and a button clears it. */
export const SelectControlled = clientEntry(import.meta.url, function SelectControlled(handle: Handle) {
  let value: string | null = 'due'
  let set = (next: string | null) => {
    value = next
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        <Select value={value} onValueChange={set} items={sortings}>
          <SelectTrigger aria-label="Sort invoices by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {sortings.map((sorting) => (
                <SelectItem key={sorting.value} value={sorting.value}>
                  {sorting.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button variant="outline" mix={on('click', () => set(null))}>
          Clear
        </Button>
      </div>
      <p role="status" mix={statusStyles}>
        {value
          ? `Invoices sorted by ${sortings.find((sorting) => sorting.value === value)?.label.toLowerCase()}.`
          : 'Invoices unsorted.'}
      </p>
    </div>
  )
})

/** A required select in a form that works without JavaScript: submit, reset, and the browser's own check. */
export const SelectForm = clientEntry(import.meta.url, function SelectForm(handle: Handle) {
  let id = `${handle.id}-country`

  return () => (
    <form method="get" action="/echo" mix={stackStyles}>
      <Field>
        <FieldLabel for={id}>Billing country</FieldLabel>
        <Select name="country" required defaultValue={null} autocomplete="country">
          <SelectTrigger id={id} aria-describedby={`${id}-hint`}>
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Europe</SelectLabel>
              <SelectItem value="AT">Austria</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="CH">Switzerland</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Elsewhere</SelectLabel>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="JP">Japan</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription id={`${id}-hint`}>Invoices show the tax rules of this country.</FieldDescription>
      </Field>
      <div mix={rowStyles}>
        <Button type="submit">Save</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  )
})

/** Right-to-left: the chevron, the checks and the lined-up list sit on the mirrored side. */
export const SelectRtl = clientEntry(import.meta.url, function SelectRtl() {
  return () => (
    <div dir="rtl" lang="ar">
      <Select defaultValue="banana">
        <SelectTrigger aria-label="الفاكهة">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>الفواكه</SelectLabel>
            <SelectItem value="apple">تفاح</SelectItem>
            <SelectItem value="banana">موز</SelectItem>
            <SelectItem value="blueberry">توت أزرق</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
})
