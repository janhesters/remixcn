import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { ToggleGroup, ToggleGroupItem } from './toggle-group.tsx'

function buttonTags(html: string) {
  return [...html.matchAll(/<button[^>]*>/g)].map(([tag]) => tag)
}

describe('Toggle Group on the server', () => {
  it('renders a group of native buttons with a literal aria-pressed from its default value', async () => {
    let html = await renderToString(
      <ToggleGroup defaultValue={['italic']} aria-label="Text formatting">
        <ToggleGroupItem value="bold" aria-label="Bold" />
        <ToggleGroupItem value="italic" aria-label="Italic" />
      </ToggleGroup>,
    )
    let [bold, italic] = buttonTags(html)

    assert.match(html, /<div[^>]*role="group"[^>]*>/)
    assert.ok(html.includes('aria-label="Text formatting"'), html)
    for (let tag of [bold, italic]) {
      assert.ok(tag.includes('type="button"') && tag.includes('data-slot="toggle-group-item"'), tag)
    }
    assert.ok(bold.includes('aria-pressed="false"') && italic.includes('aria-pressed="true"'), html)
  })

  it('leaves every item in the tab order until the browser runs it', async () => {
    let html = await renderToString(
      <ToggleGroup aria-label="View">
        <ToggleGroupItem value="grid" aria-label="Grid" />
        <ToggleGroupItem value="list" aria-label="List" />
      </ToggleGroup>,
    )

    assert.ok(!html.includes('tabindex'), html)
  })

  it('follows a controlled value over the default', async () => {
    let html = await renderToString(
      <ToggleGroup value={['list']} defaultValue={['grid']} aria-label="View">
        <ToggleGroupItem value="grid" />
        <ToggleGroupItem value="list" />
      </ToggleGroup>,
    )

    assert.deepEqual(
      buttonTags(html).map((tag) => /aria-pressed="(\w+)"/.exec(tag)?.[1]),
      ['false', 'true'],
    )
  })

  it('names its orientation, spacing, variant, size and mode, and gives them to its items', async () => {
    let html = await renderToString(
      <ToggleGroup aria-label="Align" orientation="vertical" spacing={0} variant="outline" size="sm" multiple disabled>
        <ToggleGroupItem value="top" variant="default" size="lg" />
      </ToggleGroup>,
    )
    let [group] = /<div[^>]*>/.exec(html) ?? ['']
    let [item] = buttonTags(html)

    for (let attribute of [
      'data-orientation="vertical"',
      'data-spacing="0"',
      'data-variant="outline"',
      'data-size="sm"',
      'data-multiple',
      'data-disabled',
      '--gap: 0',
    ]) {
      assert.ok(group.includes(attribute), `${attribute} in ${group}`)
    }
    for (let attribute of [
      'data-orientation="vertical"',
      'data-spacing="0"',
      'data-variant="outline"',
      'data-size="sm"',
    ]) {
      assert.ok(item.includes(attribute), `${attribute} in ${item}`)
    }
    assert.ok(/\sdisabled[\s/>]/.test(item), item)
  })

  it("keeps an item's own variant and size when the group sets none, and spaces items 2 steps apart by default", async () => {
    let html = await renderToString(
      <ToggleGroup aria-label="Rating">
        <ToggleGroupItem value="star" variant="outline" size="lg" />
      </ToggleGroup>,
    )
    let [item] = buttonTags(html)

    assert.ok(item.includes('data-variant="outline"') && item.includes('data-size="lg"'), item)
    assert.ok(html.includes('data-spacing="2"') && html.includes('--gap: 2'), html)
  })

  it("keeps the caller's style beside the gap, as an object or a string", async () => {
    let object = await renderToString(<ToggleGroup aria-label="A" spacing={1} style={{ marginBlock: '1rem' }} />)
    let text = await renderToString(<ToggleGroup aria-label="B" spacing={1} style="margin-block: 1rem" />)

    for (let html of [object, text]) {
      let style = /\sstyle="([^"]*)"/.exec(html)?.[1] ?? ''
      assert.ok(style.includes('margin-block: 1rem') && style.includes('--gap: 1'), html)
    }
  })

  it("puts the caller's mixins on the group and the items, and keeps their roles and types", async () => {
    let html = await renderToString(
      // @ts-expect-error The role isn't a prop: the group is always a group.
      <ToggleGroup role="toolbar" aria-label="Sort" mix={css({ rowGap: '1rem' })}>
        {/* @ts-expect-error The type isn't a prop: an item never submits a form. */}
        <ToggleGroupItem value="newest" type="submit" mix={css({ minWidth: '5rem' })} />
      </ToggleGroup>,
    )

    assert.ok(html.includes('role="group"') && !html.includes('toolbar'), html)
    assert.ok(buttonTags(html)[0].includes('type="button"'), html)
    assert.ok(html.includes('row-gap: 1rem') && html.includes('min-width: 5rem'), html)
  })
})
