import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Switch } from './switch.tsx'

function inputTag(html: string) {
  return /<input[^>]*>/.exec(html)?.[0] ?? ''
}

describe('Switch on the server', () => {
  it('renders a native checkbox with the switch role and the form attributes it gets', async () => {
    let input = inputTag(
      await renderToString(<Switch id="airplane" name="airplane" value="on" required defaultChecked />),
    )

    for (let attribute of [
      'type="checkbox"',
      'role="switch"',
      'id="airplane"',
      'name="airplane"',
      'value="on"',
      'required',
    ]) {
      assert.ok(input.includes(attribute), `${attribute} in ${input}`)
    }
    assert.ok(/\schecked[\s/>]/.test(input), input)
    assert.ok(!input.includes('aria-checked'), input)
  })

  it('names its size on the root and the input, and defaults to the default size', async () => {
    let small = await renderToString(<Switch size="sm" />)
    let regular = await renderToString(<Switch />)

    assert.ok(small.includes('data-slot="switch-root" data-size="sm"'), small)
    assert.ok(inputTag(small).includes('data-size="sm"'), small)
    assert.ok(regular.includes('data-size="default"'), regular)
  })

  it('draws the thumb as a decorative element', async () => {
    let html = await renderToString(<Switch />)

    assert.match(html, /<span data-slot="switch-thumb"[^>]*aria-hidden="true"/)
  })

  it("puts the caller's mixins on the input and keeps the role", async () => {
    // @ts-expect-error The role isn't a prop: the control is always a switch.
    let input = inputTag(await renderToString(<Switch role="checkbox" mix={css({ accentColor: 'teal' })} />))

    assert.ok(input.includes('role="switch"'), input)
    assert.equal(/class="([^"]*)"/.exec(input)?.[1].split(' ').length, 2, input)
  })
})
