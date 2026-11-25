// RemixCN Combobox examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { ChevronDownIcon, Icon, LoaderIcon } from '#remixcn/lib/icons.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardFooter } from '#remixcn/ui/card.tsx'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from '#remixcn/ui/combobox.tsx'
import type { ComboboxInputValueChangeDetails } from '#remixcn/ui/combobox.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#remixcn/ui/input-group.tsx'
import { Item, ItemContent, ItemDescription, ItemTitle } from '#remixcn/ui/item.tsx'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '#remixcn/ui/select.tsx'

// Each example is a client entry, so its combobox runs in the browser. Until
// then, and without JavaScript, the native select it renders is the control.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  gap: space(4),
  width: '100%',
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const fieldWidth = css({ width: 'min(100%, 16rem)' })
const sideStyles = css({ width: 'min(100%, 8rem)', '& input': { textTransform: 'capitalize' } })
const otherWidth = css({ width: 'min(100%, 13rem)' })
const fakeTriggerStyles = css({
  width: 'min(100%, 13rem)',
  justifyContent: 'space-between',
  fontWeight: 400,
  color: 'var(--muted-foreground)',
})
const triggerStyles = css({ width: 'min(100%, 16rem)', justifyContent: 'space-between', fontWeight: 400 })
const statusStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const asyncStatusStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  paddingInline: space(2),
  paddingBlock: space(1.5),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& svg': { width: '1rem', height: '1rem' },
  '&:empty': { display: 'none' },
})
const customItemStyles = css({ width: '100%', padding: 0 })
const personStyles = css({ display: 'grid', gap: '0.125rem', minWidth: 0 })
const emailStyles = css({ color: 'var(--muted-foreground)', fontSize: 'var(--text-xs)' })

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro']

/** The frameworks, as options of the list. */
function FrameworkList(handle: Handle<{ disabled?: readonly string[] }>) {
  return () => (
    <ComboboxList>
      {(item: string) => (
        <ComboboxItem key={item} value={item} disabled={handle.props.disabled?.includes(item)}>
          {item}
        </ComboboxItem>
      )}
    </ComboboxList>
  )
}

/** A combobox of frameworks: type to filter, then choose. */
export const ComboboxBasic = clientEntry(import.meta.url, function ComboboxBasic() {
  return () => (
    <Combobox name="framework" items={frameworks}>
      <ComboboxInput aria-label="Framework" placeholder="Select a framework" mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <FrameworkList />
      </ComboboxContent>
    </Combobox>
  )
})

/** A disabled input turns the combobox off. */
export const ComboboxDisabled = clientEntry(import.meta.url, function ComboboxDisabled() {
  return () => (
    <Combobox items={frameworks}>
      <ComboboxInput aria-label="Framework, disabled" placeholder="Select a framework" disabled mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <FrameworkList />
      </ComboboxContent>
    </Combobox>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** The list beside the input on every side. Inline start and end follow the text direction. */
export const ComboboxSides = clientEntry(import.meta.url, function ComboboxSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <Combobox key={side} items={frameworks}>
          <ComboboxInput
            aria-label={`Framework, list on ${side.replace('-', ' ')}`}
            placeholder={side.replace('-', ' ')}
            mix={sideStyles}
          />
          <ComboboxContent side={side}>
            <ComboboxEmpty>No items found.</ComboboxEmpty>
            <FrameworkList />
          </ComboboxContent>
        </Combobox>
      ))}
    </div>
  )
})

/** An invalid input, alone and in a Field with its description and error. */
export const ComboboxInvalid = clientEntry(import.meta.url, function ComboboxInvalid(handle: Handle) {
  let id = `${handle.id}-framework`

  return () => (
    <div mix={stackStyles}>
      <Combobox items={frameworks}>
        <ComboboxInput
          aria-label="Framework, invalid"
          placeholder="Select a framework"
          aria-invalid="true"
          mix={fieldWidth}
        />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <FrameworkList />
        </ComboboxContent>
      </Combobox>
      <Field data-invalid="true">
        <FieldLabel for={id}>Framework</FieldLabel>
        <Combobox items={frameworks}>
          <ComboboxInput
            id={id}
            placeholder="Select a framework"
            aria-invalid="true"
            aria-describedby={`${id}-description ${id}-error`}
          />
          <ComboboxContent>
            <ComboboxEmpty>No items found.</ComboboxEmpty>
            <FrameworkList />
          </ComboboxContent>
        </Combobox>
        <FieldDescription id={`${id}-description`}>Please select a valid framework.</FieldDescription>
        <FieldError id={`${id}-error`} errors={[{ message: 'This field is required.' }]} />
      </Field>
    </div>
  )
})

/** A clear button takes the chevron's place while there is a value. */
export const ComboboxWithClear = clientEntry(import.meta.url, function ComboboxWithClear() {
  return () => (
    <Combobox items={frameworks} defaultValue={frameworks[0]}>
      <ComboboxInput aria-label="Framework, clearable" placeholder="Select a framework" showClear mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <FrameworkList />
      </ComboboxContent>
    </Combobox>
  )
})

/** The first match lights up as you type, so Enter chooses it. */
export const ComboboxAutoHighlight = clientEntry(import.meta.url, function ComboboxAutoHighlight() {
  return () => (
    <Combobox items={frameworks} autoHighlight>
      <ComboboxInput
        aria-label="Framework, first match highlighted"
        placeholder="Select a framework"
        mix={fieldWidth}
      />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <FrameworkList />
      </ComboboxContent>
    </Combobox>
  )
})

const timezones = [
  {
    value: 'Americas',
    items: [
      '(GMT-5) New York',
      '(GMT-8) Los Angeles',
      '(GMT-6) Chicago',
      '(GMT-5) Toronto',
      '(GMT-8) Vancouver',
      '(GMT-3) São Paulo',
    ],
  },
  {
    value: 'Europe',
    items: ['(GMT+0) London', '(GMT+1) Paris', '(GMT+1) Berlin', '(GMT+1) Rome', '(GMT+1) Madrid', '(GMT+1) Amsterdam'],
  },
  {
    value: 'Asia/Pacific',
    items: [
      '(GMT+9) Tokyo',
      '(GMT+8) Shanghai',
      '(GMT+8) Singapore',
      '(GMT+4) Dubai',
      '(GMT+11) Sydney',
      '(GMT+9) Seoul',
    ],
  },
]

type Timezone = (typeof timezones)[number]

/** Time zones in labelled groups, each a collection of its matching items. */
function TimezoneGroups(handle: Handle<{ separators?: boolean }>) {
  return () => (
    <ComboboxList>
      {(group: Timezone) => (
        <ComboboxGroup key={group.value} items={group.items}>
          <ComboboxLabel>{group.value}</ComboboxLabel>
          <ComboboxCollection>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          {handle.props.separators ? <ComboboxSeparator /> : null}
        </ComboboxGroup>
      )}
    </ComboboxList>
  )
}

/** Time zones in groups; a group without a match leaves. */
export const ComboboxWithGroups = clientEntry(import.meta.url, function ComboboxWithGroups() {
  return () => (
    <Combobox items={timezones}>
      <ComboboxInput aria-label="Time zone" placeholder="Select a timezone" mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No timezones found.</ComboboxEmpty>
        <TimezoneGroups />
      </ComboboxContent>
    </Combobox>
  )
})

/** Groups with a separator after each. */
export const ComboboxWithGroupsAndSeparator = clientEntry(import.meta.url, function ComboboxWithGroupsAndSeparator() {
  return () => (
    <Combobox items={timezones}>
      <ComboboxInput aria-label="Time zone, separated groups" placeholder="Select a timezone" mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No timezones found.</ComboboxEmpty>
        <TimezoneGroups separators />
      </ComboboxContent>
    </Combobox>
  )
})

const largeList = Array.from({ length: 100 }, (_, index) => `Item ${index + 1}`)

/** A hundred items: the list scrolls, and the highlight stays in view. */
export const ComboboxLargeList = clientEntry(import.meta.url, function ComboboxLargeList() {
  return () => (
    <Combobox items={largeList}>
      <ComboboxInput aria-label="Item" placeholder="Search from 100 items" mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
})

function GlobeIcon() {
  return () => (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </Icon>
  )
}

/** An icon before the text, as an InputGroupAddon in ComboboxInput. */
export const ComboboxInputAddon = clientEntry(import.meta.url, function ComboboxInputAddon() {
  return () => (
    <Combobox items={timezones}>
      <ComboboxInput aria-label="Time zone, with an icon" placeholder="Select a timezone" mix={fieldWidth}>
        <InputGroupAddon>
          <GlobeIcon />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>No timezones found.</ComboboxEmpty>
        <TimezoneGroups />
      </ComboboxContent>
    </Combobox>
  )
})

const countries = [
  { code: 'ar', value: 'argentina', label: 'Argentina', continent: 'South America' },
  { code: 'au', value: 'australia', label: 'Australia', continent: 'Oceania' },
  { code: 'at', value: 'austria', label: 'Austria', continent: 'Europe' },
  { code: 'be', value: 'belgium', label: 'Belgium', continent: 'Europe' },
  { code: 'br', value: 'brazil', label: 'Brazil', continent: 'South America' },
  { code: 'ca', value: 'canada', label: 'Canada', continent: 'North America' },
  { code: 'cl', value: 'chile', label: 'Chile', continent: 'South America' },
  { code: 'cn', value: 'china', label: 'China', continent: 'Asia' },
  { code: 'dk', value: 'denmark', label: 'Denmark', continent: 'Europe' },
  { code: 'eg', value: 'egypt', label: 'Egypt', continent: 'Africa' },
  { code: 'fi', value: 'finland', label: 'Finland', continent: 'Europe' },
  { code: 'fr', value: 'france', label: 'France', continent: 'Europe' },
  { code: 'de', value: 'germany', label: 'Germany', continent: 'Europe' },
  { code: 'gh', value: 'ghana', label: 'Ghana', continent: 'Africa' },
  { code: 'in', value: 'india', label: 'India', continent: 'Asia' },
  { code: 'ie', value: 'ireland', label: 'Ireland', continent: 'Europe' },
  { code: 'it', value: 'italy', label: 'Italy', continent: 'Europe' },
  { code: 'jp', value: 'japan', label: 'Japan', continent: 'Asia' },
  { code: 'ke', value: 'kenya', label: 'Kenya', continent: 'Africa' },
  { code: 'mx', value: 'mexico', label: 'Mexico', continent: 'North America' },
  { code: 'nl', value: 'netherlands', label: 'Netherlands', continent: 'Europe' },
  { code: 'nz', value: 'new-zealand', label: 'New Zealand', continent: 'Oceania' },
  { code: 'no', value: 'norway', label: 'Norway', continent: 'Europe' },
  { code: 'pe', value: 'peru', label: 'Peru', continent: 'South America' },
  { code: 'pt', value: 'portugal', label: 'Portugal', continent: 'Europe' },
  { code: 'sn', value: 'senegal', label: 'Senegal', continent: 'Africa' },
  { code: 'kr', value: 'south-korea', label: 'South Korea', continent: 'Asia' },
  { code: 'es', value: 'spain', label: 'Spain', continent: 'Europe' },
  { code: 'se', value: 'sweden', label: 'Sweden', continent: 'Europe' },
  { code: 'ch', value: 'switzerland', label: 'Switzerland', continent: 'Europe' },
  { code: 'th', value: 'thailand', label: 'Thailand', continent: 'Asia' },
  { code: 'gb', value: 'united-kingdom', label: 'United Kingdom', continent: 'Europe' },
  { code: 'us', value: 'united-states', label: 'United States', continent: 'North America' },
  { code: 'uy', value: 'uruguay', label: 'Uruguay', continent: 'South America' },
]

type Country = (typeof countries)[number]

/**
 * A button that shows the value and opens a popup with the search at its top,
 * as shadcn's "Combobox in Popup". The button is the control, and focus moves
 * to the search while the popup is open.
 */
export const ComboboxInPopup = clientEntry(import.meta.url, function ComboboxInPopup() {
  return () => (
    <Combobox name="country" items={countries} defaultValue={countries[29]}>
      <ComboboxTrigger aria-label="Country" mix={triggerStyles}>
        <ComboboxValue placeholder="Select country" />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput showTrigger={false} aria-label="Search countries" placeholder="Search" />
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(country: Country) => (
            <ComboboxItem key={country.code} value={country}>
              {country.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
})

/** A required combobox in a form that works without JavaScript: submit, reset, and the browser's own check. */
export const ComboboxWithForm = clientEntry(import.meta.url, function ComboboxWithForm(handle: Handle) {
  let id = `${handle.id}-framework`
  let formId = `${handle.id}-form`

  return () => (
    <Card size="sm" mix={css({ width: 'min(100%, 24rem)' })}>
      <CardContent>
        <form id={formId} method="get" action="/echo">
          <FieldGroup>
            <Field>
              <FieldLabel for={id}>Framework</FieldLabel>
              <Combobox name="framework" items={frameworks} required>
                <ComboboxInput id={id} placeholder="Select a framework" aria-describedby={`${id}-hint`} />
                <ComboboxContent>
                  <ComboboxEmpty>No items found.</ComboboxEmpty>
                  <FrameworkList />
                </ComboboxContent>
              </Combobox>
              <FieldDescription id={`${id}-hint`}>
                The form sends the framework you choose, not the text you type.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter mix={rowStyles}>
        <Button type="submit" form={formId}>
          Submit
        </Button>
        <Button type="reset" form={formId} variant="outline">
          Reset
        </Button>
      </CardFooter>
    </Card>
  )
})

/** Chips for the chosen frameworks, and a search after them. The list lines up with the chips. */
function FrameworkChips(
  handle: Handle<{
    label: string
    defaultValue?: string[]
    disabled?: boolean
    invalid?: boolean
    showRemove?: boolean
    id?: string
    describedBy?: string
  }>,
) {
  return () => {
    let { label, defaultValue, disabled, invalid, showRemove, id, describedBy } = handle.props
    return (
      <Combobox
        name="frameworks"
        multiple
        autoHighlight
        items={frameworks}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        <ComboboxChips mix={fieldWidth}>
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((value) => (
                  <ComboboxChip key={value} showRemove={showRemove}>
                    {value}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  aria-label={id ? undefined : label}
                  aria-invalid={invalid ? 'true' : undefined}
                  aria-describedby={describedBy}
                  placeholder={values.length === 0 ? 'Add framework' : undefined}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <FrameworkList />
        </ComboboxContent>
      </Combobox>
    )
  }
}

/** Several frameworks as chips. Backspace removes the last; the arrow keys reach the chips. */
export const ComboboxMultiple = clientEntry(import.meta.url, function ComboboxMultiple() {
  return () => <FrameworkChips label="Frameworks" defaultValue={[frameworks[0]]} />
})

/** A disabled multiple combobox: its chips can't be removed, and it leaves the form. */
export const ComboboxMultipleDisabled = clientEntry(import.meta.url, function ComboboxMultipleDisabled() {
  return () => <FrameworkChips label="Frameworks, disabled" defaultValue={[frameworks[0], frameworks[1]]} disabled />
})

/** Invalid chips, alone and in a Field with its error. */
export const ComboboxMultipleInvalid = clientEntry(import.meta.url, function ComboboxMultipleInvalid(handle: Handle) {
  let id = `${handle.id}-frameworks`

  return () => (
    <div mix={stackStyles}>
      <FrameworkChips label="Frameworks, invalid" defaultValue={[frameworks[0], frameworks[1]]} invalid />
      <Field data-invalid="true">
        <FieldLabel for={id}>Frameworks</FieldLabel>
        <FrameworkChips
          label="Frameworks"
          id={id}
          describedBy={`${id}-description ${id}-error`}
          defaultValue={[frameworks[0], frameworks[1], frameworks[2]]}
          invalid
        />
        <FieldDescription id={`${id}-description`}>Please select at least one framework.</FieldDescription>
        <FieldError id={`${id}-error`} errors={[{ message: 'This field is required.' }]} />
      </Field>
    </div>
  )
})

/** Chips without remove buttons: Backspace and the chips' keys still remove them. */
export const ComboboxMultipleNoRemove = clientEntry(import.meta.url, function ComboboxMultipleNoRemove() {
  return () => (
    <FrameworkChips
      label="Frameworks, chips without buttons"
      defaultValue={[frameworks[0], frameworks[1]]}
      showRemove={false}
    />
  )
})

/** Items with a title and a description, matched by the country's name. */
export const ComboboxWithCustomItems = clientEntry(import.meta.url, function ComboboxWithCustomItems() {
  return () => (
    <Combobox items={countries} itemToStringValue={(country: Country) => country.code}>
      <ComboboxInput aria-label="Country, with details" placeholder="Search countries..." mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No countries found.</ComboboxEmpty>
        <ComboboxList>
          {(country: Country) => (
            <ComboboxItem key={country.code} value={country}>
              <Item size="xs" mix={customItemStyles}>
                <ItemContent>
                  <ItemTitle>{country.label}</ItemTitle>
                  <ItemDescription>
                    {country.continent} ({country.code})
                  </ItemDescription>
                </ItemContent>
              </Item>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
})

/** A combobox in a dialog: its list opens above the dialog, and Escape closes only the list. */
export const ComboboxInDialog = clientEntry(import.meta.url, function ComboboxInDialog(handle: Handle) {
  let id = `${handle.id}-framework`

  return () => (
    <Dialog>
      <DialogTrigger mix={buttonVariants({ variant: 'outline' })}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select framework</DialogTitle>
          <DialogDescription>Choose your preferred framework from the list below.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel for={id}>Framework</FieldLabel>
          <Combobox items={frameworks}>
            <ComboboxInput id={id} placeholder="Select a framework" />
            <ComboboxContent>
              <ComboboxEmpty>No items found.</ComboboxEmpty>
              <FrameworkList />
            </ComboboxContent>
          </Combobox>
        </Field>
        <DialogFooter>
          <DialogClose mix={buttonVariants({ variant: 'outline' })}>Cancel</DialogClose>
          <DialogClose mix={buttonVariants()}>Confirm</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

const otherItems = [
  { label: 'Select a framework', value: null },
  ...frameworks.map((framework) => ({ label: framework, value: framework.toLowerCase() })),
]

/** A combobox beside a Select, a button, an Input and an InputGroup of the same height. */
export const ComboboxWithOtherInputs = clientEntry(import.meta.url, function ComboboxWithOtherInputs() {
  return () => (
    <div mix={rowStyles}>
      <Combobox items={frameworks}>
        <ComboboxInput aria-label="Framework, combobox" placeholder="Select a framework" mix={otherWidth} />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <FrameworkList />
        </ComboboxContent>
      </Combobox>
      <Select>
        <SelectTrigger aria-label="Framework, select" mix={otherWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {otherItems.map((item) => (
              <SelectItem key={item.label} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="outline" mix={fakeTriggerStyles}>
        Select a framework
        <ChevronDownIcon />
      </Button>
      <Input aria-label="Framework, input" placeholder="Select a framework" mix={otherWidth} />
      <InputGroup mix={otherWidth}>
        <InputGroupInput aria-label="Framework, input group" placeholder="Select a framework" />
        <InputGroupAddon align="inline-end">
          <ChevronDownIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
})

/** Nuxt.js and Remix show, but can't be chosen. */
export const ComboboxDisabledItems = clientEntry(import.meta.url, function ComboboxDisabledItems() {
  return () => (
    <Combobox items={frameworks}>
      <ComboboxInput aria-label="Framework, some disabled" placeholder="Select a framework" mix={fieldWidth} />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <FrameworkList disabled={['Nuxt.js', 'Remix']} />
      </ComboboxContent>
    </Combobox>
  )
})

/** A combobox you control: the status follows the value, and a button clears it. */
export const ComboboxControlled = clientEntry(import.meta.url, function ComboboxControlled(handle: Handle) {
  let value: string | null = 'Remix'
  let set = (next: string | null) => {
    value = next
    void handle.update()
  }

  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        <Combobox items={frameworks} value={value} onValueChange={set}>
          <ComboboxInput aria-label="Framework, controlled" placeholder="Select a framework" mix={fieldWidth} />
          <ComboboxContent>
            <ComboboxEmpty>No items found.</ComboboxEmpty>
            <FrameworkList />
          </ComboboxContent>
        </Combobox>
        <Button variant="outline" mix={on('click', () => set(null))}>
          Clear
        </Button>
      </div>
      <p role="status" mix={statusStyles}>
        {value ? `You chose ${value}.` : 'No framework chosen.'}
      </p>
    </div>
  )
})

const people = [
  { id: 'p1', name: 'Ada Brightwater', email: 'ada@example.com' },
  { id: 'p2', name: 'Bram Okafor', email: 'bram@example.com' },
  { id: 'p3', name: 'Chiara Lindqvist', email: 'chiara@example.com' },
  { id: 'p4', name: 'Dmitri Halvorsen', email: 'dmitri@example.com' },
  { id: 'p5', name: 'Elif Marchetti', email: 'elif@example.com' },
  { id: 'p6', name: 'Farah Quist', email: 'farah@example.com' },
  { id: 'p7', name: 'Gideon Ruiz', email: 'gideon@example.com' },
  { id: 'p8', name: 'Hana Sorensen', email: 'hana@example.com' },
]

type Person = (typeof people)[number]

/**
 * A made-up directory that answers later, the longer the shorter the search,
 * so a slow answer for an older search can arrive after a newer one.
 */
function searchPeople(text: string, signal: AbortSignal): Promise<Person[]> {
  let query = text.trim().toLowerCase()
  let delay = Math.max(150, 650 - query.length * 150)
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => resolve(people.filter((person) => person.name.toLowerCase().includes(query))), delay)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

/**
 * Results you load as the search changes. Combobox sends no request: you do,
 * with the signal of each search, which aborts once the text changes again,
 * so an older answer never replaces a newer one. The chosen person stays in
 * the items, so its name stays known.
 */
export const ComboboxAsync = clientEntry(import.meta.url, function ComboboxAsync(handle: Handle) {
  let results: Person[] = []
  let selected: Person | null = null
  let searching = false
  let query = ''
  let id = `${handle.id}-reviewer`

  function search(text: string, details: ComboboxInputValueChangeDetails) {
    query = text.trim()
    if (details.reason !== 'input-change' || query === '') {
      searching = false
      void handle.update()
      return
    }
    searching = true
    void handle.update()
    searchPeople(text, details.signal).then(
      (found) => {
        if (details.signal.aborted) return
        results = found
        searching = false
        void handle.update()
      },
      () => {},
    )
  }

  function status() {
    if (searching) return 'Searching…'
    if (query === '') return selected ? '' : 'Start typing to search people.'
    if (results.length === 0) return `No matches for “${query}”.`
    return ''
  }

  return () => {
    let items = selected && !results.some((person) => person.id === selected!.id) ? [...results, selected] : results
    let text = status()
    return (
      <Field mix={fieldWidth}>
        <FieldLabel for={id}>Assign reviewer</FieldLabel>
        <Combobox
          name="reviewer"
          items={items}
          filter={null}
          value={selected}
          itemToStringLabel={(person: Person) => person.name}
          itemToStringValue={(person: Person) => person.id}
          isItemEqualToValue={(person: Person, value: Person) => person.id === value.id}
          onValueChange={(person: Person | null) => {
            selected = person
            void handle.update()
          }}
          onInputValueChange={search}
        >
          <ComboboxInput id={id} placeholder="e.g. Ada" showClear />
          <ComboboxContent aria-busy={searching ? 'true' : undefined}>
            <div mix={asyncStatusStyles}>
              {searching ? <LoaderIcon /> : null}
              {text}
            </div>
            <ComboboxList>
              {(person: Person) => (
                <ComboboxItem key={person.id} value={person}>
                  <span mix={personStyles}>
                    <span>{person.name}</span>
                    <span mix={emailStyles}>{person.email}</span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
    )
  }
})

/** Right-to-left: the chevron, the checks, the chips and their keys sit on the mirrored side. */
export const ComboboxRtl = clientEntry(import.meta.url, function ComboboxRtl() {
  let fruits = ['تفاح', 'موز', 'توت أزرق', 'عنب', 'أناناس']
  return () => (
    <div dir="rtl" lang="ar" mix={stackStyles}>
      <Combobox items={fruits} defaultValue={fruits[1]}>
        <ComboboxInput aria-label="الفاكهة" placeholder="اختر فاكهة" triggerLabel="عرض الاقتراحات" mix={fieldWidth} />
        <ComboboxContent resultsLabel={(count) => `عدد النتائج: ${count}`}>
          <ComboboxEmpty>لا توجد نتائج.</ComboboxEmpty>
          <ComboboxList>
            {(fruit: string) => (
              <ComboboxItem key={fruit} value={fruit}>
                {fruit}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Combobox multiple items={fruits} defaultValue={[fruits[0], fruits[2]]}>
        <ComboboxChips mix={fieldWidth}>
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((value) => (
                  <ComboboxChip key={value} removeLabel={`إزالة ${value}`}>
                    {value}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput aria-label="الفواكه" />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent resultsLabel={(count) => `عدد النتائج: ${count}`}>
          <ComboboxEmpty>لا توجد نتائج.</ComboboxEmpty>
          <ComboboxList>
            {(fruit: string) => (
              <ComboboxItem key={fruit} value={fruit}>
                {fruit}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
})
