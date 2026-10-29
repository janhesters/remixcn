import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Button } from './button.tsx'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupTextVariants,
  buttonGroupVariants,
} from './button-group.tsx'

/** Reads the attributes of the first tag with this name. */
function attributes(html: string, tag: string) {
  let source = new RegExp(`<${tag}(\\s[^>]*)?>`).exec(html)?.[1] ?? ''
  return new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']))
}

describe('ButtonGroup', () => {
  it('renders a labelled group in a row by default, without a tab stop of its own', async () => {
    let group = attributes(
      await renderToString(
        <ButtonGroup aria-label="Invoice actions">
          <Button variant="outline">Archive</Button>
          <Button variant="outline">Report</Button>
        </ButtonGroup>,
      ),
      'div',
    )

    assert.equal(group.get('role'), 'group')
    assert.equal(group.get('aria-label'), 'Invoice actions')
    assert.equal(group.get('data-slot'), 'button-group')
    assert.equal(group.get('data-orientation'), 'horizontal')
    assert.equal(group.has('tabindex'), false)
  })

  it('stacks its parts in a column when vertical, and passes caller attributes on', async () => {
    let group = attributes(
      await renderToString(
        <ButtonGroup orientation="vertical" aria-labelledby="zoom" id="zoom-controls" class="toolbar">
          <Button size="icon" aria-label="Zoom in">
            +
          </Button>
        </ButtonGroup>,
      ),
      'div',
    )

    assert.equal(group.get('data-orientation'), 'vertical')
    assert.equal(group.get('aria-labelledby'), 'zoom')
    assert.equal(group.get('id'), 'zoom-controls')
    assert.ok(group.get('class')?.split(' ').includes('toolbar'), group.get('class'))
  })

  it('gives another element the group look and the attributes its parts join on', async () => {
    let group = attributes(
      await renderToString(
        <nav aria-label="Pages" mix={buttonGroupVariants({ orientation: 'vertical' })}>
          <a href="/1">1</a>
        </nav>,
      ),
      'nav',
    )

    assert.equal(group.get('data-slot'), 'button-group')
    assert.equal(group.get('data-orientation'), 'vertical')
    assert.ok(group.get('class'))
  })
})

describe('ButtonGroupSeparator', () => {
  it('renders a vertical separator by default, for a row of buttons', async () => {
    let separator = attributes(await renderToString(<ButtonGroupSeparator />), 'div')

    assert.equal(separator.get('role'), 'separator')
    assert.equal(separator.get('aria-orientation'), 'vertical')
    assert.equal(separator.get('data-orientation'), 'vertical')
    assert.equal(separator.get('data-slot'), 'button-group-separator')
  })

  it('turns horizontal for a column of buttons', async () => {
    let separator = attributes(await renderToString(<ButtonGroupSeparator orientation="horizontal" />), 'div')

    assert.equal(separator.get('aria-orientation'), 'horizontal')
    assert.equal(separator.get('data-orientation'), 'horizontal')
  })
})

describe('ButtonGroupText', () => {
  it('renders text inside the group', async () => {
    let html = await renderToString(<ButtonGroupText>Due in 14 days</ButtonGroupText>)
    let text = attributes(html, 'div')

    assert.equal(text.get('data-slot'), 'button-group-text')
    assert.ok(html.includes('>Due in 14 days</div>'), html)
  })

  it('styles a native label as group text, so it keeps labelling its field', async () => {
    let html = await renderToString(
      <label for="amount" mix={buttonGroupTextVariants()}>
        Amount
      </label>,
    )
    let label = attributes(html, 'label')

    assert.equal(label.get('for'), 'amount')
    assert.equal(label.get('data-slot'), 'button-group-text')
    assert.ok(label.get('class'))
  })
})
