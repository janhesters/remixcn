import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Toggle, toggleStyles } from './toggle.tsx'

function buttonTag(html: string) {
  return /<button[^>]*>/.exec(html)?.[0] ?? ''
}

describe('Toggle on the server', () => {
  it('renders a native button that never submits, with a literal aria-pressed', async () => {
    let off = buttonTag(await renderToString(<Toggle aria-label="Bold">B</Toggle>))
    let on = buttonTag(await renderToString(<Toggle aria-label="Italic" defaultPressed />))

    for (let attribute of [
      'type="button"',
      'data-slot="toggle"',
      'aria-label="Bold"',
      'aria-pressed="false"',
      'data-state="off"',
    ]) {
      assert.ok(off.includes(attribute), `${attribute} in ${off}`)
    }
    assert.ok(on.includes('aria-pressed="true"') && on.includes('data-state="on"'), on)
  })

  it('keeps the type a button', async () => {
    // @ts-expect-error The type isn't a prop: a toggle never submits a form.
    assert.ok(buttonTag(await renderToString(<Toggle type="submit" />)).includes('type="button"'))
  })

  it('lets a controlled pressed prop win over the default', async () => {
    let tag = buttonTag(await renderToString(<Toggle pressed={false} defaultPressed />))

    assert.ok(tag.includes('aria-pressed="false"'), tag)
  })

  it('names its variant and size, defaulting to the default ones', async () => {
    let plain = buttonTag(await renderToString(<Toggle />))
    let outline = buttonTag(await renderToString(<Toggle variant="outline" size="lg" />))

    assert.ok(plain.includes('data-variant="default"') && plain.includes('data-size="default"'), plain)
    assert.ok(outline.includes('data-variant="outline"') && outline.includes('data-size="lg"'), outline)
  })

  it("puts the caller's mixins on the button, and renders disabled toggles disabled", async () => {
    let tag = buttonTag(await renderToString(<Toggle disabled mix={css({ minWidth: '6rem' })} />))

    assert.ok(/\sdisabled[\s/>]/.test(tag), tag)
    assert.equal(/class="([^"]*)"/.exec(tag)?.[1].split(' ').length, 2, tag)
  })
})

describe('toggleStyles', () => {
  it("gives each size shadcn's height and the outline variant a border", () => {
    let heights = (['sm', 'default', 'lg'] as const).map((size) => toggleStyles({ size }).height)

    assert.deepEqual(heights, ['2rem', '2.25rem', '2.5rem'])
    assert.equal(toggleStyles({ variant: 'outline' }).borderColor, 'var(--input)')
    assert.equal(toggleStyles().borderColor, 'transparent')
  })
})
