import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Checkbox } from './checkbox.tsx'

function inputTag(html: string) {
  return /<input[^>]*>/.exec(html)?.[0] ?? ''
}

describe('Checkbox on the server', () => {
  it('renders a native checkbox with the form attributes it gets', async () => {
    let html = await renderToString(
      <Checkbox id="terms" name="terms" value="accepted" form="signup" required aria-describedby="terms-help" />,
    )
    let input = inputTag(html)

    for (let attribute of [
      'type="checkbox"',
      'id="terms"',
      'name="terms"',
      'value="accepted"',
      'form="signup"',
      'required',
      'aria-describedby="terms-help"',
      'data-slot="checkbox"',
    ]) {
      assert.ok(input.includes(attribute), `${attribute} in ${input}`)
    }
  })

  it('keeps the type a checkbox', async () => {
    // @ts-expect-error The type isn't a prop: the control is always a checkbox.
    let html = await renderToString(<Checkbox type="radio" />)

    assert.ok(inputTag(html).includes('type="checkbox"'), html)
  })

  it('renders checked and default checked boxes as checked HTML', async () => {
    assert.ok(/\schecked[\s/>]/.test(inputTag(await renderToString(<Checkbox defaultChecked />))))
    assert.ok(/\schecked[\s/>]/.test(inputTag(await renderToString(<Checkbox checked />))))
    assert.ok(!/\schecked[\s/>]/.test(inputTag(await renderToString(<Checkbox />))))
  })

  it('renders the checked value for a mixed box, since HTML has no mixed attribute', async () => {
    let html = await renderToString(<Checkbox indeterminate checked name="all" />)
    let input = inputTag(html)

    assert.ok(/\schecked[\s/>]/.test(input), input)
    assert.ok(!input.includes('indeterminate'), input)
    assert.ok(!input.includes('aria-checked'), input)
  })

  it('draws its indicators as decorative icons beside the input', async () => {
    let html = await renderToString(<Checkbox />)

    assert.ok(html.includes('data-slot="checkbox-indicator"'), html)
    assert.ok(html.includes('data-slot="checkbox-mixed-indicator"'), html)
    assert.equal([...html.matchAll(/<svg[^>]*aria-hidden="true"/g)].length, 2, html)
  })

  it("puts the caller's mixins on the input", async () => {
    let html = await renderToString(<Checkbox mix={css({ accentColor: 'rebeccapurple' })} />)
    let classes = /class="([^"]*)"/.exec(inputTag(html))?.[1].split(' ') ?? []

    assert.equal(classes.length, 2, inputTag(html))
    assert.ok(html.includes('accent-color: rebeccapurple'), html)
  })

  it('renders disabled boxes disabled', async () => {
    assert.ok(/\sdisabled[\s/>]/.test(inputTag(await renderToString(<Checkbox disabled />))))
  })
})
