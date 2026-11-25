import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots, tags, text } from '../../test/html.ts'
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
  createComboboxFilter,
} from './combobox.tsx'
import type { ComboboxProps } from './combobox.tsx'

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro']

function Framework(handle: { props: ComboboxProps<string> & { inputId?: string; disabledItem?: string } }) {
  return () => {
    let { inputId, disabledItem, ...props } = handle.props
    return (
      <Combobox name="framework" items={frameworks} {...(props as ComboboxProps<string>)}>
        <ComboboxInput id={inputId} aria-describedby="framework-help" placeholder="Select a framework" />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item} disabled={item === disabledItem}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    )
  }
}

function nativeOptions(html: string) {
  let source = html.slice(html.indexOf('<select'), html.indexOf('</select>'))
  return tags(source, 'option').map((tag) => tag.attributes)
}

function optionText(html: string) {
  let source = html.slice(html.indexOf('<select'), html.indexOf('</select>'))
  return [...source.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((match) => match[1])
}

function itemTexts(html: string) {
  let list = html.slice(html.indexOf('role="listbox"'), html.indexOf('<select'))
  return [...list.matchAll(/data-slot="combobox-item"[^>]*>([\s\S]*?)<span data-slot="combobox-item-indicator"/g)].map(
    (match) => text(match[1]).trim(),
  )
}

describe('Combobox on the server', () => {
  it('renders a native select that works without JavaScript and an input that waits for the script', async () => {
    let html = await renderToString(<Framework inputId="framework" required />)
    let group = attributes(html, 'slot:combobox-input')
    let input = attributes(html, 'input')
    let select = attributes(html, 'select')
    let list = attributes(html, 'slot:combobox-list')
    let content = attributes(html, 'slot:combobox-content')

    // Until the browser runs the combobox, the native select is the control.
    assert.ok(group.has('data-pending'))
    assert.equal(input.get('role'), 'combobox')
    assert.equal(input.get('aria-autocomplete'), 'list')
    assert.equal(input.get('aria-expanded'), 'false')
    assert.equal(input.get('aria-controls'), list.get('id'))
    assert.equal(input.get('autocomplete'), 'off')
    assert.equal(list.get('role'), 'listbox')
    assert.equal(content.get('popover'), 'manual')

    // The native select carries the label's id, the description, the name and validation.
    assert.equal(select.get('id'), 'framework')
    assert.notEqual(input.get('id'), 'framework')
    assert.equal(select.get('aria-describedby'), 'framework-help')
    assert.equal(input.has('aria-describedby'), false)
    assert.equal(select.get('name'), 'framework')
    assert.ok(select.has('required'))
    assert.equal(input.has('name'), false, 'only the native select submits a value')
    assert.equal(input.get('aria-required'), 'true')
  })

  it('lists every item as an option after an empty one named by the placeholder', async () => {
    let html = await renderToString(<Framework disabledItem="Remix" />)

    assert.deepEqual(
      nativeOptions(html).map((option) => option.get('value')),
      ['', ...frameworks],
    )
    assert.deepEqual(optionText(html), ['Select a framework', ...frameworks])
    let [placeholder] = nativeOptions(html)
    assert.ok(placeholder.has('selected'))
    assert.ok(placeholder.has('hidden'), 'the placeholder isn’t offered as a choice')
    assert.ok(nativeOptions(html)[4].has('disabled'))
    assert.deepEqual(itemTexts(html), frameworks)
    let disabled = slots(html, 'combobox-item').filter((item) => item.get('aria-disabled') === 'true')
    assert.equal(disabled.length, 1)
    assert.ok(disabled[0].has('data-disabled'))
  })

  it('selects the default value, writes its label into the input and marks its item', async () => {
    let html = await renderToString(<Framework defaultValue="Remix" />)
    let selected = nativeOptions(html).filter((option) => option.has('selected'))

    assert.deepEqual(
      selected.map((option) => option.get('value')),
      ['Remix'],
    )
    assert.equal(attributes(html, 'input').get('value'), 'Remix')
    let items = slots(html, 'combobox-item')
    let chosen = items.filter((item) => item.get('aria-selected') === 'true')
    assert.equal(chosen.length, 1)
    assert.ok(chosen[0].has('data-selected'))
    // The list shows every item: the input's text is the chosen label, not a search.
    assert.deepEqual(itemTexts(html), frameworks)
  })

  it('filters the list by a default input value', async () => {
    let html = await renderToString(<Framework defaultInputValue="ux" />)

    assert.deepEqual(itemTexts(html), ['Nuxt.js'])
    assert.equal(attributes(html, 'input').get('value'), 'ux')
    // The native select still offers every item.
    assert.deepEqual(
      nativeOptions(html).map((option) => option.get('value')),
      ['', ...frameworks],
    )
  })

  it('turns object items into option values and labels', async () => {
    let countries = [
      { code: 'ch', name: 'Switzerland' },
      { code: 'de', name: 'Germany' },
    ]
    let html = await renderToString(
      <Combobox
        name="country"
        items={countries}
        defaultValue={countries[1]}
        itemToStringLabel={(country) => country.name}
        itemToStringValue={(country) => country.code}
      >
        <ComboboxInput aria-label="Country" />
        <ComboboxContent>
          <ComboboxList>
            {(country: (typeof countries)[number]) => (
              <ComboboxItem key={country.code} value={country}>
                {country.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )

    assert.deepEqual(
      nativeOptions(html).map((option) => [option.get('value'), option.has('selected')]),
      [
        ['', false],
        ['ch', false],
        ['de', true],
      ],
    )
    assert.deepEqual(optionText(html), ['', 'Switzerland', 'Germany'])
    assert.equal(attributes(html, 'input').get('value'), 'Germany')
    assert.equal(attributes(html, 'select').get('aria-label'), 'Country')
  })

  it('reads value and label from { value, label } items without functions', async () => {
    let plans = [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
    ]
    let html = await renderToString(
      <Combobox name="plan" items={plans} defaultValue={plans[1]}>
        <ComboboxInput aria-label="Plan" />
        <ComboboxContent>
          <ComboboxList>
            {(plan: (typeof plans)[number]) => (
              <ComboboxItem key={plan.value} value={plan}>
                {plan.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )

    assert.deepEqual(
      nativeOptions(html).map((option) => option.get('value')),
      ['', 'free', 'pro'],
    )
    assert.equal(attributes(html, 'input').get('value'), 'Pro')
  })

  it('keeps a value without an item, so the form still submits it', async () => {
    let html = await renderToString(<Framework defaultValue="Gatsby" />)
    let gatsby = nativeOptions(html).find((option) => option.get('value') === 'Gatsby')

    assert.ok(gatsby)
    assert.ok(gatsby.has('selected'))
    assert.ok(gatsby.has('hidden'))
    assert.equal(attributes(html, 'input').get('value'), 'Gatsby')
  })

  it('renders groups with their labels, and optgroups in the native select', async () => {
    let zones = [
      { value: 'Americas', items: ['New York', 'Chicago'] },
      { value: 'Europe', items: ['London', 'Paris'] },
    ]
    let html = await renderToString(
      <Combobox name="zone" items={zones}>
        <ComboboxInput aria-label="Time zone" />
        <ComboboxContent>
          <ComboboxList>
            {(group: (typeof zones)[number]) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
                <ComboboxSeparator />
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )

    let groups = slots(html, 'combobox-group')
    let labels = slots(html, 'combobox-label')
    assert.equal(groups.length, 2)
    assert.equal(groups[0].get('role'), 'group')
    assert.equal(groups[0].get('aria-labelledby'), labels[0].get('id'))
    assert.deepEqual(
      tags(html, 'optgroup').map((tag) => tag.attributes.get('label')),
      ['Americas', 'Europe'],
    )
    assert.deepEqual(itemTexts(html), ['New York', 'Chicago', 'London', 'Paris'])
    assert.equal(attributes(html, 'slot:combobox-separator').get('aria-hidden'), 'true')
  })

  it('renders a multiple combobox with chips and every chosen option selected', async () => {
    let html = await renderToString(
      <Combobox name="frameworks" multiple items={frameworks} defaultValue={['Remix', 'Astro']}>
        <ComboboxChips>
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((value) => (
                  <ComboboxChip key={value}>{value}</ComboboxChip>
                ))}
                <ComboboxChipsInput aria-label="Frameworks" placeholder="Add framework" />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )

    let select = attributes(html, 'select')
    assert.ok(select.has('multiple'))
    assert.equal(select.get('aria-label'), 'Frameworks')
    assert.equal(attributes(html, 'slot:combobox-list').get('aria-multiselectable'), 'true')
    assert.deepEqual(
      nativeOptions(html)
        .filter((option) => option.has('selected'))
        .map((option) => option.get('value')),
      ['Remix', 'Astro'],
    )
    assert.equal(nativeOptions(html)[0].get('value'), 'Next.js', 'no placeholder option')
    assert.ok(attributes(html, 'slot:combobox-chips').has('data-pending'))
    let chips = slots(html, 'combobox-chip')
    assert.equal(chips.length, 2)
    let removes = slots(html, 'combobox-chip-remove')
    assert.deepEqual(
      removes.map((remove) => remove.get('aria-label')),
      ['Remove Remix', 'Remove Astro'],
    )
    assert.equal(attributes(html, 'slot:combobox-chip-input').get('value'), '')
  })

  it('turns everything off for a disabled combobox, and leaves the form without its value', async () => {
    let html = await renderToString(<Framework defaultValue="Astro" disabled />)

    assert.ok(attributes(html, 'select').has('disabled'))
    assert.ok(attributes(html, 'input').has('disabled'))
    assert.ok(attributes(html, 'slot:combobox-trigger').has('disabled'))
  })

  it('passes a disabled input on to the native select', async () => {
    let html = await renderToString(
      <Combobox name="framework" items={frameworks}>
        <ComboboxInput aria-label="Framework" disabled />
        <ComboboxContent>
          <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )

    assert.ok(attributes(html, 'select').has('disabled'))
    assert.ok(attributes(html, 'input').has('disabled'))
  })

  it('shows the empty state as a status while no item matches', async () => {
    let none = await renderToString(<Framework items={[]} />)
    let some = await renderToString(<Framework />)

    let empty = attributes(none, 'slot:combobox-empty')
    assert.equal(empty.get('role'), 'status')
    assert.equal(empty.get('aria-live'), 'polite')
    assert.ok(text(none).includes('No items found.'))
    assert.ok(attributes(none, 'slot:combobox-content').has('data-empty'))
    assert.equal(text(some).includes('No items found.'), false)
    assert.ok(attributes(some, 'slot:combobox-empty'), 'the live region stays in the document')
  })

  it('shows at most `limit` items, and the items you pass in filteredItems', async () => {
    let limited = await renderToString(<Framework limit={2} />)
    let results = await renderToString(<Framework filteredItems={['Astro']} />)

    assert.deepEqual(itemTexts(limited), ['Next.js', 'SvelteKit'])
    assert.deepEqual(itemTexts(results), ['Astro'])
  })

  it('applies the limit to the items you pass in filteredItems, flat and grouped', async () => {
    let limited = await renderToString(<Framework filteredItems={frameworks} limit={2} />)
    let none = await renderToString(<Framework filteredItems={frameworks} limit={0} />)

    assert.deepEqual(itemTexts(limited), ['Next.js', 'SvelteKit'])
    assert.deepEqual(itemTexts(none), [])
    assert.ok(attributes(none, 'slot:combobox-content').has('data-empty'))
    assert.ok(text(none).includes('No items found.'))

    let zones = [
      { value: 'Americas', items: ['New York', 'Chicago'] },
      { value: 'Europe', items: ['London', 'Paris'] },
    ]
    let grouped = await renderToString(
      <Combobox items={zones} filteredItems={zones} limit={3}>
        <ComboboxInput aria-label="Time zone" />
        <ComboboxContent>
          <ComboboxList>
            {(group: (typeof zones)[number]) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )
    assert.deepEqual(itemTexts(grouped), ['New York', 'Chicago', 'London'])
  })

  it('renders the trigger of a combobox whose input sits in the popup with the chosen label', async () => {
    let html = await renderToString(
      <Combobox name="framework" items={frameworks} defaultValue="Astro">
        <ComboboxTrigger aria-label="Framework">
          <ComboboxValue placeholder="Select a framework" />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput showTrigger={false} placeholder="Search" aria-label="Search frameworks" />
          <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>,
    )
    let trigger = attributes(html, 'slot:combobox-trigger')

    assert.ok(trigger.has('data-pending'))
    assert.equal(trigger.get('role'), 'combobox')
    assert.equal(trigger.get('aria-haspopup'), 'dialog')
    assert.equal(attributes(html, 'select').get('aria-label'), 'Framework')
    assert.ok(text(html).includes('Astro'))
    // The input in the popup isn't the form control, so its label stays with it.
    assert.equal(attributes(html, 'input').get('aria-label'), 'Search frameworks')
  })

  it('gives every combobox its own ids', async () => {
    let html = await renderToString(
      <div>
        <Framework />
        <Framework />
      </div>,
    )
    let ids = tags(html)
      .map((tag) => tag.attributes.get('id'))
      .filter(Boolean)

    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('createComboboxFilter', () => {
  it('matches anywhere, at the start or at the end, ignoring case and accents', () => {
    let filter = createComboboxFilter({ locale: 'en' })

    assert.equal(filter.contains('Zürich', 'zur'), true)
    assert.equal(filter.contains('Zürich', 'rich'), true)
    assert.equal(filter.contains('Zürich', 'bern'), false)
    assert.equal(filter.startsWith('Zürich', 'zu'), true)
    assert.equal(filter.startsWith('Zürich', 'rich'), false)
    assert.equal(filter.endsWith('Zürich', 'RICH'), true)
    assert.equal(filter.contains({ label: 'Genève' }, 'gene'), true)
    assert.equal(
      filter.contains({ name: 'Basel' }, 'bas', (item) => item.name),
      true,
    )
    assert.equal(filter.contains('anything', ''), true)
  })
})
