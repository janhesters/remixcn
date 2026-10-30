import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select.tsx'
import type { SelectProps } from './select.tsx'

const fruits = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Blueberry', value: 'blueberry' },
]

function Fruit(handle: { props: SelectProps & { triggerId?: string } }) {
  return () => {
    let { triggerId, ...props } = handle.props
    return (
      <Select name="fruit" {...props}>
        <SelectTrigger id={triggerId} aria-describedby="fruit-help">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            {fruits.map((fruit) => (
              <SelectItem key={fruit.value} value={fruit.value}>
                {fruit.label}
              </SelectItem>
            ))}
            <SelectItem value="grapes" disabled>
              Grapes
            </SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectItem value="carrot">Carrot</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }
}

function options(html: string) {
  let source = html.slice(html.indexOf('<select'), html.indexOf('</select>'))
  return tags(source, 'option').map((tag) => tag.attributes)
}

function optionText(html: string) {
  let source = html.slice(html.indexOf('<select'), html.indexOf('</select>'))
  return [...source.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((match) => match[1])
}

describe('Select on the server', () => {
  it('renders a native select that works without JavaScript and a trigger that waits for the script', async () => {
    let html = await renderToString(<Fruit triggerId="fruit" required />)
    let trigger = attributes(html, 'slot:select-trigger')
    let select = attributes(html, 'select')
    let list = attributes(html, 'slot:select-list')
    let content = attributes(html, 'slot:select-content')

    // The trigger shows once the browser runs the select; until then the native select is the control.
    assert.ok(trigger.has('data-pending'))
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('role'), 'combobox')
    assert.equal(trigger.get('aria-haspopup'), 'listbox')
    assert.equal(trigger.get('aria-expanded'), 'false')
    assert.equal(trigger.get('aria-controls'), list.get('id'))
    assert.equal(list.get('role'), 'listbox')
    assert.equal(content.get('popover'), 'manual')

    // The native select carries the label's id, the description, the name and validation.
    assert.equal(select.get('id'), 'fruit')
    assert.equal(trigger.get('id') === 'fruit', false)
    assert.equal(select.get('aria-describedby'), 'fruit-help')
    assert.equal(trigger.has('aria-describedby'), false)
    assert.equal(select.get('name'), 'fruit')
    assert.ok(select.has('required'))
    assert.equal(select.has('tabindex'), false)
    assert.equal(select.has('aria-hidden'), false)
    assert.equal(trigger.has('name'), false, 'only the native select submits a value')
  })

  it('lists the items as options, with a placeholder first and labelled groups as optgroups', async () => {
    let html = await renderToString(<Fruit />)

    assert.deepEqual(
      options(html).map((option) => option.get('value')),
      ['', 'apple', 'banana', 'blueberry', 'grapes', 'carrot'],
    )
    assert.deepEqual(optionText(html), ['Select a fruit', 'Apple', 'Banana', 'Blueberry', 'Grapes', 'Carrot'])
    let [placeholder] = options(html)
    assert.ok(placeholder.has('selected'))
    assert.ok(placeholder.has('hidden'), 'the placeholder isn’t offered as a choice')
    assert.ok(options(html)[4].has('disabled'))
    let groups = tags(html, 'optgroup').map((tag) => tag.attributes.get('label'))
    assert.deepEqual(groups, ['Fruits'])
    let trigger = attributes(html, 'slot:select-trigger')
    assert.ok(trigger.has('data-placeholder'))
  })

  it('selects the default value in the server HTML and shows its label in the trigger', async () => {
    let html = await renderToString(<Fruit defaultValue="banana" />)
    let selected = options(html).filter((option) => option.has('selected'))

    assert.deepEqual(
      selected.map((option) => option.get('value')),
      ['banana'],
    )
    let value = html.slice(
      html.indexOf('data-slot="select-value"'),
      html.indexOf('</span>', html.indexOf('data-slot="select-value"')),
    )
    assert.ok(text(`<span ${value}</span>`).includes('Banana'))
    let item = tags(html).find(
      (tag) => tag.attributes.get('data-slot') === 'select-item' && tag.attributes.get('aria-selected') === 'true',
    )
    assert.ok(item)
    assert.ok(item.attributes.has('data-selected'))
    assert.equal(attributes(html, 'slot:select-trigger').has('data-placeholder'), false)
  })

  it('selects a controlled value the same way', async () => {
    let html = await renderToString(<Fruit value="blueberry" onValueChange={() => {}} />)

    assert.deepEqual(
      options(html)
        .filter((option) => option.has('selected'))
        .map((option) => option.get('value')),
      ['blueberry'],
    )
  })

  it('keeps a value without an item, so the form submits what the trigger shows', async () => {
    let html = await renderToString(<Fruit defaultValue="kiwi" />)
    let kiwi = options(html).find((option) => option.get('value') === 'kiwi')

    assert.ok(kiwi)
    assert.ok(kiwi.has('selected'))
    assert.ok(kiwi.has('hidden'))
    assert.equal(kiwi.has('disabled'), false)
    assert.ok(text(html).includes('kiwi'))
  })

  it('keeps a disabled item that is selected in the form, but never offers it', async () => {
    let html = await renderToString(<Fruit defaultValue="grapes" />)
    let grapes = options(html).find((option) => option.get('value') === 'grapes')

    assert.ok(grapes)
    assert.ok(grapes.has('selected'))
    assert.ok(grapes.has('hidden'))
    assert.equal(grapes.has('disabled'), false, 'a disabled option would leave the form')
  })

  it('makes an item without a value the first option, outside its group, so required counts it as no choice', async () => {
    let html = await renderToString(
      <Select name="theme" required>
        <SelectTrigger aria-label="Theme">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Themes</SelectLabel>
            <SelectItem value={null}>Select a theme</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    let source = html.slice(html.indexOf('<select'), html.indexOf('</select>'))

    assert.ok(
      source.indexOf('<option value=""') < source.indexOf('<optgroup'),
      'the null item comes before every group',
    )
    let [first] = options(html)
    assert.equal(first.get('value'), '')
    assert.ok(first.has('selected'))
    assert.equal(first.has('hidden'), false, 'it is a choice that clears the value')
    assert.deepEqual(optionText(html)[0], 'Select a theme')
    // The null item's label shows as the placeholder.
    let value = attributes(html, 'slot:select-value')
    assert.ok(value.has('data-placeholder'))
    assert.ok(text(html).includes('Select a theme'))
  })

  it('renders a multiple select without a placeholder, with every chosen option selected', async () => {
    let html = await renderToString(
      <Select name="fruits" multiple defaultValue={['apple', 'blueberry']}>
        <SelectTrigger aria-label="Fruits">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fruits.map((fruit) => (
            <SelectItem key={fruit.value} value={fruit.value}>
              {fruit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    )

    assert.ok(attributes(html, 'select').has('multiple'))
    assert.equal(attributes(html, 'slot:select-list').get('aria-multiselectable'), 'true')
    assert.deepEqual(
      options(html).map((option) => [option.get('value'), option.has('selected')]),
      [
        ['apple', true],
        ['banana', false],
        ['blueberry', true],
      ],
    )
    assert.ok(text(html).includes('Apple, Blueberry'))
  })

  it('finds items that a component of yours renders, for the native select', async () => {
    function Vegetables() {
      return () => (
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="leek" label="Leek">
            <strong>Leek</strong>
          </SelectItem>
        </SelectGroup>
      )
    }
    let html = await renderToString(
      <Select name="vegetable" defaultValue="leek">
        <SelectTrigger aria-label="Vegetable">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <Vegetables />
        </SelectContent>
      </Select>,
    )

    assert.deepEqual(optionText(html), ['', 'Carrot', 'Leek'])
    assert.deepEqual(
      tags(html, 'optgroup').map((tag) => tag.attributes.get('label')),
      ['Vegetables'],
    )
    assert.ok(options(html)[2].has('selected'))
  })

  it('disables a disabled group’s items, as an optgroup does', async () => {
    let html = await renderToString(
      <Select name="plan">
        <SelectTrigger aria-label="Plan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup disabled>
            <SelectLabel>Legacy</SelectLabel>
            <SelectItem value="basic">Basic</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    let [legacy, current] = tags(html, 'optgroup').map((tag) => tag.attributes)
    let basic = tags(html).find((tag) => tag.attributes.get('data-slot') === 'select-item')!

    assert.ok(legacy.has('disabled'))
    assert.equal(current.has('disabled'), false)
    assert.equal(basic.attributes.get('aria-disabled'), 'true')
    assert.ok(basic.attributes.has('data-disabled'))
  })

  it('names each group by its label and hides separators from assistive technology', async () => {
    let html = await renderToString(<Fruit />)
    let [fruitsGroup, other] = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'select-group')
    let label = attributes(html, 'slot:select-label')

    assert.equal(fruitsGroup.attributes.get('role'), 'group')
    assert.equal(fruitsGroup.attributes.get('aria-labelledby'), label.get('id'))
    assert.equal(other.attributes.has('aria-labelledby'), false)
    assert.equal(attributes(html, 'slot:select-separator').get('aria-hidden'), 'true')
  })

  it('passes disabled, form, autocomplete and size on', async () => {
    let html = await renderToString(
      <Select name="country" form="address" autocomplete="country" disabled>
        <SelectTrigger aria-label="Country" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ch">Switzerland</SelectItem>
        </SelectContent>
      </Select>,
    )
    let select = attributes(html, 'select')
    let trigger = attributes(html, 'slot:select-trigger')

    assert.ok(select.has('disabled'))
    assert.equal(select.get('form'), 'address')
    assert.equal(select.get('autocomplete'), 'country')
    assert.equal(select.get('aria-label'), 'Country')
    assert.ok(trigger.has('disabled'))
    assert.ok(trigger.has('data-disabled'))
    assert.equal(trigger.get('data-size'), 'sm')
    assert.equal(attributes(html, 'slot:select-native').get('data-size'), 'sm')
  })

  it('offers no other choice in a read-only select', async () => {
    let html = await renderToString(<Fruit defaultValue="apple" readOnly />)

    assert.deepEqual(
      options(html)
        .filter((option) => option.get('value') && !option.has('disabled'))
        .map((option) => option.get('value')),
      ['apple'],
    )
    assert.equal(attributes(html, 'slot:select-trigger').get('aria-readonly'), 'true')
  })

  it('gives every select its own ids', async () => {
    let html = await renderToString(
      <div>
        <Fruit />
        <Fruit />
      </div>,
    )
    let ids = tags(html)
      .map((tag) => tag.attributes.get('id'))
      .filter(Boolean)

    assert.equal(new Set(ids).size, ids.length)
    let [first, second] = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'select-trigger')
    assert.notEqual(first.attributes.get('aria-controls'), second.attributes.get('aria-controls'))
  })

  it('shows the label of a value from the items prop before the items render', async () => {
    function Items() {
      return () => <SelectItem value="pie">Pie</SelectItem>
    }
    let html = await renderToString(
      <Select items={[{ value: 'pie', label: 'Pie chart' }]} defaultValue="pie">
        <SelectTrigger aria-label="Chart">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <Items />
        </SelectContent>
      </Select>,
    )

    assert.ok(text(html).includes('Pie chart'))
  })

  it('renders a value function with the current value', async () => {
    let html = await renderToString(
      <Select multiple defaultValue={['apple', 'banana']}>
        <SelectTrigger aria-label="Fruits">
          <SelectValue>{(value: string[]) => `${value.length} fruits selected`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {fruits.map((fruit) => (
            <SelectItem key={fruit.value} value={fruit.value}>
              {fruit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    )

    assert.ok(text(html).includes('2 fruits selected'))
  })
})
