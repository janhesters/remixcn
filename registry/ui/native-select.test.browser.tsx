import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './native-select.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

const tokens = {
  '--input': 'rgb(120, 120, 120)',
  '--destructive': 'rgb(200, 0, 0)',
  '--spacing': '4px',
}

function select(container: HTMLElement, name: string) {
  let found = container.querySelector(`select[name="${name}"]`)
  assert.ok(found instanceof HTMLSelectElement, `no select named ${name}`)
  return found
}

function choose(element: HTMLSelectElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function Countries() {
  return () => [
    <NativeSelectOption key="ch" value="ch">
      Switzerland
    </NativeSelectOption>,
    <NativeSelectOption key="de" value="de">
      Germany
    </NativeSelectOption>,
    <NativeSelectOption key="at" value="at">
      Austria
    </NativeSelectOption>,
  ]
}

// The owner changes the starting country with a button.
function DefaultCountry(handle: Handle) {
  let country = 'de'

  return () => (
    <form>
      <NativeSelect name="country" defaultValue={country}>
        <Countries />
      </NativeSelect>
      <button
        type="button"
        mix={on('click', () => {
          country = 'at'
          void handle.update()
        })}
      >
        Austria
      </button>
    </form>
  )
}

// The owner keeps the country, and accepts every change except Austria.
function ControlledCountry(handle: Handle) {
  let country = 'ch'

  return () => (
    <div>
      <NativeSelect
        name="country"
        value={country}
        mix={on('change', (event) => {
          let next = (event.target as HTMLSelectElement).value
          if (next !== 'at') country = next
          void handle.update()
        })}
      >
        <Countries />
      </NativeSelect>
      <output>{country}</output>
      <button
        type="button"
        mix={on('click', () => {
          country = 'de'
          void handle.update()
        })}
      >
        Germany
      </button>
    </div>
  )
}

// The owner keeps the tags and declines every choice that marks an invoice paid.
function Tags(handle: Handle) {
  let tags = ['urgent']

  return () => (
    <div>
      <NativeSelect
        name="tags"
        multiple
        value={tags}
        mix={on('change', (event) => {
          let picked = [...(event.target as HTMLSelectElement).selectedOptions].map((option) => option.value)
          if (!picked.includes('paid')) tags = picked
          void handle.update()
        })}
      >
        <NativeSelectOption value="urgent">Urgent</NativeSelectOption>
        <NativeSelectOption value="draft">Draft</NativeSelectOption>
        <NativeSelectOption value="paid">Paid</NativeSelectOption>
      </NativeSelect>
      <button
        type="button"
        mix={on('click', () => {
          tags = ['draft', 'paid']
          void handle.update()
        })}
      >
        Settle
      </button>
    </div>
  )
}

function selectedValues(element: HTMLSelectElement) {
  return [...element.selectedOptions].map((option) => option.value)
}

/** Picks options of a multiple select as a user would, which fires input and change. */
function pick(element: HTMLSelectElement, values: string[]) {
  for (let option of element.options) option.selected = values.includes(option.value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('NativeSelect in the browser', () => {
  it('starts on defaultValue and a form reset returns to it', async (t) => {
    let { container, act } = mount(t, <DefaultCountry />)
    let country = select(container, 'country')

    assert.equal(country.value, 'de')
    await act(() => choose(country, 'ch'))
    await act(() => container.querySelector('form')!.reset())
    assert.equal(country.value, 'de')
  })

  it('moves to a new starting value, which a form reset then returns to', async (t) => {
    let { container, act } = mount(t, <DefaultCountry />)
    let country = select(container, 'country')

    await act(() => choose(country, 'ch'))
    await act(() => container.querySelector('button')!.click())
    assert.equal(country.value, 'at')
    assert.deepEqual(
      [...country.options].filter((option) => option.defaultSelected).map((option) => option.value),
      ['at'],
    )

    await act(() => choose(country, 'ch'))
    await act(() => container.querySelector('form')!.reset())
    assert.equal(country.value, 'at')
  })

  it('shows only the controlled value: it follows the owner and returns when the owner declines a change', async (t) => {
    let { container, act } = mount(t, <ControlledCountry />)
    let country = select(container, 'country')

    assert.equal(country.value, 'ch')
    await act(() => choose(country, 'de'))
    assert.equal(container.querySelector('output')!.textContent, 'de')
    assert.equal(country.value, 'de')

    await act(() => choose(country, 'at'))
    await act(() => {})
    assert.equal(container.querySelector('output')!.textContent, 'de')
    assert.equal(country.value, 'de')
  })

  it('follows a controlled multiple value', async (t) => {
    let { container, act } = mount(t, <Tags />)
    let tags = select(container, 'tags')

    assert.deepEqual(selectedValues(tags), ['urgent'])
    await act(() => container.querySelector('button')!.click())
    assert.deepEqual(selectedValues(tags), ['draft', 'paid'])
  })

  it('returns to a controlled multiple value when the owner declines a change, and follows one it takes', async (t) => {
    let { container, act } = mount(t, <Tags />)
    let tags = select(container, 'tags')

    await act(() => pick(tags, ['urgent', 'draft']))
    assert.deepEqual(selectedValues(tags), ['urgent', 'draft'])

    await act(() => pick(tags, ['urgent', 'draft', 'paid']))
    await act(() => {})
    assert.deepEqual(selectedValues(tags), ['urgent', 'draft'], 'the declined choice is gone')
  })

  it('submits as a native select, inside groups and from outside its form, but not when disabled', async (t) => {
    let { container } = mount(
      t,
      <div>
        <form id="native-select-test-form">
          <NativeSelect name="region" defaultValue="fr">
            <NativeSelectOptGroup label="North America">
              <NativeSelectOption value="us">United States</NativeSelectOption>
            </NativeSelectOptGroup>
            <NativeSelectOptGroup label="Europe">
              <NativeSelectOption value="fr">France</NativeSelectOption>
            </NativeSelectOptGroup>
          </NativeSelect>
          <NativeSelect name="locked" defaultValue="ch" disabled>
            <Countries />
          </NativeSelect>
          <NativeSelect name="plan" required>
            <NativeSelectOption value="">Select a plan</NativeSelectOption>
            <NativeSelectOption value="pro">Pro</NativeSelectOption>
          </NativeSelect>
        </form>
        <NativeSelect name="currency" form="native-select-test-form" defaultValue="EUR">
          <NativeSelectOption>CHF</NativeSelectOption>
          <NativeSelectOption>EUR</NativeSelectOption>
        </NativeSelect>
      </div>,
    )
    let form = container.querySelector('form')!

    assert.equal(form.checkValidity(), false, 'the required select has no choice yet')
    select(container, 'plan').value = 'pro'
    assert.deepEqual(
      [...new FormData(form)].map(([name, value]) => `${name}=${value}`),
      ['region=fr', 'plan=pro', 'currency=EUR'],
    )
  })

  it('dims the whole control when disabled and turns the border red when invalid', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <NativeSelect name="country">
          <Countries />
        </NativeSelect>
        <NativeSelect name="locked" disabled>
          <Countries />
        </NativeSelect>
        <NativeSelect name="plan" aria-invalid={true}>
          <Countries />
        </NativeSelect>
      </div>,
    )
    let wrapper = (name: string) => select(container, name).parentElement!

    assert.equal(getComputedStyle(wrapper('country')).opacity, '1')
    assert.equal(getComputedStyle(wrapper('locked')).opacity, '0.5')
    assert.equal(getComputedStyle(select(container, 'locked')).opacity, '1', 'the wrapper alone dims it')
    assert.equal(getComputedStyle(select(container, 'country')).borderTopColor, 'rgb(120, 120, 120)')
    assert.equal(getComputedStyle(select(container, 'plan')).borderTopColor, 'rgb(200, 0, 0)')
  })

  it("runs the caller's mixins on the wrapper, which hears the select's changes", async (t) => {
    let changes: string[] = []
    let { container, act } = mount(
      t,
      <NativeSelect
        name="country"
        mix={[
          on('change', (event) => void changes.push((event.target as HTMLSelectElement).value)),
          css({ width: '15rem' }),
        ]}
      >
        <Countries />
      </NativeSelect>,
    )
    let country = select(container, 'country')

    await act(() => choose(country, 'at'))

    assert.deepEqual(changes, ['at'])
    assert.equal(country.parentElement!.getBoundingClientRect().width, 240)
    assert.equal(country.getBoundingClientRect().width, 240)
  })

  it('keeps the chevron out of the way of clicks, at the end of the line in either direction', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <NativeSelect name="ltr" mix={css({ width: '12rem' })}>
          <Countries />
        </NativeSelect>
        <div dir="rtl">
          <NativeSelect name="rtl" mix={css({ width: '12rem' })}>
            <Countries />
          </NativeSelect>
        </div>
      </div>,
    )
    for (let [name, end] of [
      ['ltr', 'right'],
      ['rtl', 'left'],
    ] as const) {
      let element = select(container, name)
      let field = element.getBoundingClientRect()
      let icon = element.parentElement!.querySelector('[data-slot="native-select-icon"]')!.getBoundingClientRect()

      assert.equal(document.elementFromPoint(icon.x + icon.width / 2, icon.y + icon.height / 2), element)
      assert.ok(
        Math.abs(field[end] - icon[end]) <= 12,
        `${name}: the icon sits ${Math.abs(field[end] - icon[end])}px from the ${end} edge`,
      )
      assert.ok(Math.abs(field.y + field.height / 2 - (icon.y + icon.height / 2)) <= 1, `${name}: the icon is centered`)
    }
  })
})
