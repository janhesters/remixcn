import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group.tsx'
import type { InputGroupAddonAlign, InputGroupButtonSize } from './input-group.tsx'

describe('InputGroup', () => {
  it('renders a group around its parts, without a form or a tab stop of its own', async () => {
    let html = await renderToString(
      <InputGroup aria-label="Search invoices" id="search" class="wide">
        <InputGroupInput name="q" placeholder="Search…" />
        <InputGroupAddon>
          <InputGroupText>Invoices</InputGroupText>
        </InputGroupAddon>
      </InputGroup>,
    )
    let group = attributes(html, 'slot:input-group')

    assert.equal(group.get('role'), 'group')
    assert.equal(group.get('aria-label'), 'Search invoices')
    assert.equal(group.get('id'), 'search')
    assert.ok(group.get('class')?.split(' ').includes('wide'), group.get('class'))
    assert.equal(group.has('tabindex'), false)
    assert.deepEqual(tags(html, 'form'), [])
  })

  it('keeps the data-disabled mark a caller sets', async () => {
    let group = attributes(
      await renderToString(
        <InputGroup data-disabled="true">
          <InputGroupInput disabled aria-label="Search" />
        </InputGroup>,
      ),
      'slot:input-group',
    )

    assert.equal(group.get('data-disabled'), 'true')
  })
})

describe('InputGroupAddon', () => {
  it('starts the line by default', async () => {
    let addon = attributes(await renderToString(<InputGroupAddon>$</InputGroupAddon>), 'slot:input-group-addon')

    assert.equal(addon.get('role'), 'group')
    assert.equal(addon.get('data-align'), 'inline-start')
  })

  it('writes each alignment', async () => {
    let aligns: InputGroupAddonAlign[] = ['inline-start', 'inline-end', 'block-start', 'block-end']
    let html = await renderToString(
      <div>
        {aligns.map((align) => (
          <InputGroupAddon key={align} align={align}>
            {align}
          </InputGroupAddon>
        ))}
      </div>,
    )

    assert.deepEqual(
      tags(html)
        .filter((tag) => tag.attributes.get('data-slot') === 'input-group-addon')
        .map((tag) => tag.attributes.get('data-align')),
      aligns,
    )
  })
})

describe('InputGroupButton', () => {
  it('renders a ghost native button of the extra-small size that submits nothing by default', async () => {
    let button = attributes(await renderToString(<InputGroupButton>Copy</InputGroupButton>), 'button')

    assert.equal(button.get('type'), 'button')
    assert.equal(button.get('data-slot'), 'button')
    assert.equal(button.get('data-variant'), 'ghost')
    assert.equal(button.get('data-size'), 'xs')
  })

  it('keeps the type, variant, size and attributes it is given', async () => {
    let sizes: InputGroupButtonSize[] = ['xs', 'sm', 'icon-xs', 'icon-sm']
    let html = await renderToString(
      <form>
        {sizes.map((size) => (
          <InputGroupButton key={size} size={size} type="submit" variant="default" name="intent" value={size}>
            {size}
          </InputGroupButton>
        ))}
        <InputGroupButton type="reset" aria-label="Clear" disabled>
          ×
        </InputGroupButton>
      </form>,
    )
    let buttons = tags(html, 'button').map((tag) => tag.attributes)

    assert.deepEqual(
      buttons.map((button) => button.get('data-size')),
      [...sizes, 'xs'],
    )
    assert.deepEqual(
      buttons.map((button) => button.get('type')),
      ['submit', 'submit', 'submit', 'submit', 'reset'],
    )
    assert.equal(buttons[0].get('data-variant'), 'default')
    assert.equal(buttons[1].get('value'), 'sm')
    assert.equal(buttons[4].get('aria-label'), 'Clear')
    assert.ok(buttons[4].has('disabled'))
  })
})

describe('InputGroupText', () => {
  it('renders text beside the control', async () => {
    let html = await renderToString(<InputGroupText>https://</InputGroupText>)

    assert.equal(attributes(html, 'span').get('data-slot'), 'input-group-text')
    assert.equal(text(html), 'https://')
  })
})

describe('InputGroupInput', () => {
  it('renders the one native input, marked as the group control', async () => {
    let html = await renderToString(
      <InputGroup>
        <InputGroupInput
          id="website"
          name="website"
          type="url"
          defaultValue="example.com"
          required
          aria-invalid={true}
          aria-describedby="website-hint website-error"
        />
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
      </InputGroup>,
    )
    let inputs = tags(html, 'input')

    assert.equal(inputs.length, 1)
    let input = inputs[0].attributes
    assert.equal(input.get('data-slot'), 'input-group-control')
    assert.equal(input.get('id'), 'website')
    assert.equal(input.get('name'), 'website')
    assert.equal(input.get('type'), 'url')
    assert.equal(input.get('value'), 'example.com')
    assert.ok(input.has('required'))
    assert.equal(input.get('aria-invalid'), 'true')
    assert.equal(input.get('aria-describedby'), 'website-hint website-error')
  })
})

describe('InputGroupTextarea', () => {
  it('renders the one native textarea, marked as the group control', async () => {
    let html = await renderToString(
      <InputGroup>
        <InputGroupTextarea id="comment" name="comment" defaultValue="Thanks!" maxLength={280} aria-invalid={false} />
        <InputGroupAddon align="block-end">
          <InputGroupText>7/280</InputGroupText>
        </InputGroupAddon>
      </InputGroup>,
    )
    let textareas = tags(html, 'textarea')

    assert.equal(textareas.length, 1)
    let textarea = textareas[0].attributes
    assert.equal(textarea.get('data-slot'), 'input-group-control')
    assert.equal(textarea.get('name'), 'comment')
    assert.equal(textarea.get('maxlength'), '280')
    assert.equal(textarea.get('aria-invalid'), 'false')
    assert.ok(text(html).includes('Thanks!'))
  })
})
