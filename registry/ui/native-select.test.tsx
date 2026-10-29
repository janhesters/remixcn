import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './native-select.tsx'

function selected(html: string) {
  return tags(html, 'option')
    .filter((option) => option.attributes.has('selected'))
    .map((option) => option.attributes.get('value'))
}

describe('NativeSelect', () => {
  it('renders a native select in a wrapper with a chevron that assistive technology skips', async () => {
    let html = await renderToString(
      <NativeSelect name="currency">
        <NativeSelectOption value="chf">CHF</NativeSelectOption>
      </NativeSelect>,
    )
    let slot = (name: string) => tags(html).find((tag) => tag.attributes.get('data-slot') === name)!
    let [wrapper, select, icon] = ['native-select-wrapper', 'native-select', 'native-select-icon'].map(slot)

    assert.equal(wrapper.name, 'div')
    assert.equal(wrapper.attributes.get('data-size'), 'default')
    assert.equal(select.name, 'select')
    assert.equal(select.attributes.get('data-size'), 'default')
    assert.equal(select.attributes.get('name'), 'currency')
    assert.equal(select.attributes.has('size'), false)
    assert.equal(icon.attributes.get('aria-hidden'), 'true')
    assert.equal(text(html), 'CHF')
  })

  it('marks the small size on the wrapper and the select', async () => {
    let html = await renderToString(<NativeSelect size="sm" />)

    assert.equal(attributes(html, 'slot:native-select-wrapper').get('data-size'), 'sm')
    assert.equal(attributes(html, 'select').get('data-size'), 'sm')
  })

  it('selects the option of defaultValue in the server HTML, so the page and a form reset show it', async () => {
    let html = await renderToString(
      <NativeSelect name="country" defaultValue="de">
        <NativeSelectOption value="">Select a country</NativeSelectOption>
        <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
        <NativeSelectOption value="de">Germany</NativeSelectOption>
      </NativeSelect>,
    )

    assert.deepEqual(selected(html), ['de'])
    assert.equal(attributes(html, 'select').has('defaultvalue'), false)
  })

  it('selects the option of a controlled value, inside groups too', async () => {
    let html = await renderToString(
      <NativeSelect name="region" value="fr">
        <NativeSelectOptGroup label="North America">
          <NativeSelectOption value="us">United States</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="Europe">
          <NativeSelectOption value="fr">France</NativeSelectOption>
        </NativeSelectOptGroup>
      </NativeSelect>,
    )

    assert.deepEqual(selected(html), ['fr'])
    assert.equal(attributes(html, 'select').has('value'), false)
    assert.deepEqual(
      tags(html, 'optgroup').map((group) => [group.attributes.get('label'), group.attributes.get('data-slot')]),
      [
        ['North America', 'native-select-optgroup'],
        ['Europe', 'native-select-optgroup'],
      ],
    )
  })

  it('selects several options of a multiple select, and options by their text when they have no value', async () => {
    let html = await renderToString(
      <NativeSelect name="tags" multiple defaultValue={['Urgent', 'Paid']}>
        <NativeSelectOption>Urgent</NativeSelectOption>
        <NativeSelectOption>Draft</NativeSelectOption>
        <NativeSelectOption>Paid</NativeSelectOption>
      </NativeSelect>,
    )
    let options = tags(html, 'option')

    assert.deepEqual(
      options.map((option) => option.attributes.has('selected')),
      [true, false, true],
    )
    assert.ok(attributes(html, 'select').has('multiple'))
  })

  it("keeps an option's own selected and disabled attributes", async () => {
    let html = await renderToString(
      <NativeSelect defaultValue="ch">
        <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
        <NativeSelectOption value="at" selected>
          Austria
        </NativeSelectOption>
        <NativeSelectOption value="li" disabled>
          Liechtenstein
        </NativeSelectOption>
      </NativeSelect>,
    )

    assert.deepEqual(selected(html), ['ch', 'at'])
    assert.ok(tags(html, 'option')[2].attributes.has('disabled'))
    assert.equal(tags(html, 'option')[0].attributes.get('data-slot'), 'native-select-option')
  })

  it('selects nothing itself without a value', async () => {
    let html = await renderToString(
      <NativeSelect>
        <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
        <NativeSelectOption value="de">Germany</NativeSelectOption>
      </NativeSelect>,
    )

    assert.deepEqual(selected(html), [])
  })

  it('puts the native attributes and ARIA on the select, and mix, class and style on the wrapper', async () => {
    let html = await renderToString(
      <NativeSelect
        id="currency"
        name="currency"
        form="invoice-form"
        required
        disabled
        autocomplete="transaction-currency"
        aria-invalid={true}
        aria-describedby="currency-hint"
        data-test="currency"
        class="wide"
        style={{ width: '12rem' }}
        mix={css({ letterSpacing: '1px' })}
      />,
    )
    let wrapper = attributes(html, 'slot:native-select-wrapper')
    let select = attributes(html, 'select')

    assert.equal(select.get('id'), 'currency')
    assert.equal(select.get('form'), 'invoice-form')
    assert.ok(select.has('required'))
    assert.ok(select.has('disabled'))
    assert.equal(select.get('autocomplete'), 'transaction-currency')
    assert.equal(select.get('aria-invalid'), 'true')
    assert.equal(select.get('aria-describedby'), 'currency-hint')
    assert.equal(select.get('data-test'), 'currency')
    assert.equal(select.has('style'), false)
    assert.ok(wrapper.get('class')?.split(' ').includes('wide'))
    assert.equal(wrapper.get('style'), 'width: 12rem;')
    assert.equal(wrapper.has('id'), false)
  })
})
