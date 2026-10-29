import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { RadioGroup, RadioGroupItem } from './radio-group.tsx'

function inputTags(html: string) {
  return [...html.matchAll(/<input[^>]*>/g)].map(([tag]) => tag)
}

function isChecked(tag: string) {
  return /\schecked[\s/>]/.test(tag)
}

describe('Radio Group on the server', () => {
  it('renders a radiogroup of native radios that share its name', async () => {
    let html = await renderToString(
      <RadioGroup name="density" defaultValue="comfortable" aria-label="Density">
        <RadioGroupItem value="default" id="r1" />
        <RadioGroupItem value="comfortable" id="r2" />
      </RadioGroup>,
    )
    let [first, second] = inputTags(html)

    assert.match(html, /<div[^>]*role="radiogroup"[^>]*>/)
    assert.match(html, /data-slot="radio-group"/)
    assert.ok(html.includes('aria-label="Density"'), html)
    for (let tag of [first, second]) {
      assert.ok(tag.includes('type="radio"') && tag.includes('name="density"'), tag)
    }
    assert.ok(first.includes('value="default"') && first.includes('id="r1"'), first)
    assert.deepEqual([isChecked(first), isChecked(second)], [false, true])
  })

  it('names the radios of a group without a name after the group, so they still form one group', async () => {
    let html = await renderToString(
      <div>
        <RadioGroup aria-label="Plan">
          <RadioGroupItem value="free" />
          <RadioGroupItem value="pro" />
        </RadioGroup>
        <RadioGroup aria-label="Billing">
          <RadioGroupItem value="monthly" />
        </RadioGroup>
      </div>,
    )
    let names = inputTags(html).map((tag) => /name="([^"]+)"/.exec(tag)?.[1])

    assert.ok(names.every(Boolean), String(names))
    assert.equal(names[0], names[1])
    assert.notEqual(names[0], names[2])
  })

  it('checks the radio whose value matches a controlled value', async () => {
    let html = await renderToString(
      <RadioGroup value="pro" defaultValue="free" aria-label="Plan">
        <RadioGroupItem value="free" />
        <RadioGroupItem value="pro" />
      </RadioGroup>,
    )

    assert.deepEqual(inputTags(html).map(isChecked), [false, true])
  })

  it('passes disabled, required and form from the group to every radio', async () => {
    let html = await renderToString(
      <RadioGroup name="battery" form="settings" disabled required aria-label="Battery">
        <RadioGroupItem value="high" />
        <RadioGroupItem value="low" />
      </RadioGroup>,
    )

    assert.match(html, /role="radiogroup"[^>]*aria-required="true"/)
    for (let tag of inputTags(html)) {
      for (let attribute of [' disabled', ' required', 'form="settings"']) assert.ok(tag.includes(attribute), tag)
    }
  })

  it('disables a single radio and marks an invalid one', async () => {
    let [free, pro] = inputTags(
      await renderToString(
        <RadioGroup aria-label="Plan">
          <RadioGroupItem value="free" disabled />
          <RadioGroupItem value="pro" aria-invalid="true" />
        </RadioGroup>,
      ),
    )

    assert.ok(free.includes(' disabled'), free)
    assert.ok(!pro.includes(' disabled') && pro.includes('aria-invalid="true"'), pro)
  })

  it("puts the caller's mixins on the group and on each radio, and keeps the roles", async () => {
    let html = await renderToString(
      // @ts-expect-error The role isn't a prop: the group is always a radiogroup.
      <RadioGroup role="list" aria-label="Plan" mix={css({ gap: '2rem' })}>
        <RadioGroupItem value="free" mix={css({ accentColor: 'teal' })} />
      </RadioGroup>,
    )

    assert.match(html, /role="radiogroup"/)
    assert.ok(!html.includes('role="list"'), html)
    assert.ok(html.includes('gap: 2rem') && html.includes('accent-color: teal'), html)
    assert.match(html, /<span data-slot="radio-group-indicator"[^>]*aria-hidden="true"/)
  })
})
