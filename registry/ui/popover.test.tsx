import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buttonVariants } from '#remixcn/ui/button.tsx'

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  popoverTrigger,
} from './popover.tsx'

/** Reads the attributes of every tag that has `marker` among its attributes. */
function tags(html: string, marker: string) {
  return [...html.matchAll(/<[\w-]+(\s[^>]*)?>/g)]
    .map((match) => match[1] ?? '')
    .filter((tag) => tag.includes(marker))
    .map((tag) => new Map([...tag.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])))
}

function attributes(html: string, marker: string) {
  let [first] = tags(html, marker)
  assert.ok(first, `no tag with ${marker}`)
  return first
}

function Dimensions() {
  return () => (
    <Popover>
      <PopoverTrigger>Dimensions</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
        </PopoverHeader>
        <PopoverClose>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

describe('Popover on the server', () => {
  it('renders a dialog popover the trigger opens natively until the browser runs it', async () => {
    let html = await renderToString(<Dimensions />)
    let trigger = attributes(html, 'data-slot="popover-trigger"')
    let content = attributes(html, 'data-slot="popover-content"')
    let close = attributes(html, 'data-slot="popover-close"')
    let id = content.get('id')

    assert.ok(id)
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('aria-haspopup'), 'dialog')
    assert.equal(trigger.get('aria-controls'), id)
    // The browser reports the expanded state of a popovertarget button itself.
    assert.equal(trigger.get('popovertarget'), id)
    assert.ok(!trigger.has('aria-expanded'))
    assert.equal(content.get('role'), 'dialog')
    assert.equal(content.get('popover'), 'auto')
    assert.ok(content.has('data-closed'))
    assert.equal(close.get('popovertarget'), id)
    assert.equal(close.get('popovertargetaction'), 'hide')
    assert.equal(close.get('type'), 'button')
  })

  it('names and describes the dialog with its title and description', async () => {
    let html = await renderToString(<Dimensions />)
    let content = attributes(html, 'data-slot="popover-content"')
    let title = attributes(html, 'data-slot="popover-title"')
    let description = attributes(html, 'data-slot="popover-description"')

    assert.match(html, /<h2\s[^>]*data-slot="popover-title"/)
    assert.match(html, /<p\s[^>]*data-slot="popover-description"/)
    assert.ok(title.get('id') && description.get('id'))
    assert.equal(content.get('aria-labelledby'), title.get('id'))
    assert.equal(content.get('aria-describedby'), description.get('id'))
  })

  it("keeps the caller's ids and labels, and leaves out labels it has no part for", async () => {
    let html = await renderToString(
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent id="filters" aria-label="Invoice filters">
          <PopoverTitle id="filters-title">Filters</PopoverTitle>
        </PopoverContent>
      </Popover>,
    )
    let content = attributes(html, 'id="filters"')

    assert.equal(attributes(html, 'popover-trigger').get('aria-controls'), 'filters')
    assert.equal(content.get('aria-labelledby'), 'filters-title')
    assert.equal(content.get('aria-label'), 'Invoice filters')
    assert.ok(!content.has('aria-describedby'))
  })

  it('renders closed until the browser shows it, also when open or open by default', async () => {
    for (let node of [
      <Popover open>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>Filters</PopoverContent>
      </Popover>,
      <Popover defaultOpen>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>Filters</PopoverContent>
      </Popover>,
    ]) {
      let html = await renderToString(node)
      assert.ok(!attributes(html, 'popover-trigger').has('data-popup-open'))
      assert.ok(attributes(html, 'popover-content').has('data-closed'))
    }
  })

  it('makes a styled button the trigger through popoverTrigger(), and gives each instance its own ids', async () => {
    let html = await renderToString(
      <div>
        <Popover>
          <button type="button" mix={[buttonVariants({ variant: 'outline' }), popoverTrigger()]}>
            Filters
          </button>
          <PopoverContent>Filters</PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger>Columns</PopoverTrigger>
          <PopoverContent>Columns</PopoverContent>
        </Popover>
      </div>,
    )
    let [styled, plain] = tags(html, 'aria-haspopup="dialog"')
    let contents = tags(html, 'role="dialog"').map((content) => content.get('id'))

    assert.equal(styled.get('data-slot'), 'button', "the Button's own slot stays")
    assert.equal(styled.get('data-variant'), 'outline')
    assert.deepEqual([styled.get('aria-controls'), plain.get('aria-controls')], contents)
    assert.equal(new Set(contents).size, 2)
  })
})
