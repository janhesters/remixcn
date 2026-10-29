import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots } from '../../test/html.ts'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible.tsx'

describe('Collapsible', () => {
  it('renders a closed collapsible with a native trigger and no panel', async () => {
    let html = await renderToString(
      <Collapsible id="filters">
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
        <CollapsibleContent>Due this week</CollapsibleContent>
      </Collapsible>,
    )
    let root = attributes(html, 'slot:collapsible')
    let trigger = attributes(html, 'slot:collapsible-trigger')

    assert.equal(root.get('id'), 'filters')
    assert.ok(root.has('data-closed'))
    assert.ok(!root.has('data-open'))
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('id'), 'filters-trigger')
    assert.equal(trigger.get('aria-expanded'), 'false')
    assert.ok(!trigger.has('aria-controls'))
    assert.ok(!trigger.has('data-panel-open'))
    assert.deepEqual(slots(html, 'collapsible-content'), [])
    assert.ok(!html.includes('Due this week'))
  })

  it('renders an open panel that its trigger controls', async () => {
    let html = await renderToString(
      <Collapsible id="filters" defaultOpen>
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
        <CollapsibleContent>Due this week</CollapsibleContent>
      </Collapsible>,
    )
    let root = attributes(html, 'slot:collapsible')
    let trigger = attributes(html, 'slot:collapsible-trigger')
    let content = attributes(html, 'slot:collapsible-content')

    assert.ok(root.has('data-open'))
    assert.equal(trigger.get('aria-expanded'), 'true')
    assert.equal(trigger.get('aria-controls'), 'filters-panel')
    assert.ok(trigger.has('data-panel-open'))
    assert.equal(content.get('id'), 'filters-panel')
    assert.ok(content.has('data-open'))
    assert.ok(!content.has('hidden'))
    assert.ok(html.includes('Due this week'))
  })

  it('lets the open prop win over defaultOpen', async () => {
    let html = await renderToString(
      <Collapsible open={false} defaultOpen>
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
        <CollapsibleContent>Due this week</CollapsibleContent>
      </Collapsible>,
    )

    assert.equal(attributes(html, 'slot:collapsible-trigger').get('aria-expanded'), 'false')
    assert.deepEqual(slots(html, 'collapsible-content'), [])
  })

  it('keeps a closed panel in the document, hidden, with keepMounted or hiddenUntilFound', async () => {
    let html = await renderToString(
      <div>
        <Collapsible id="kept">
          <CollapsibleTrigger>Kept</CollapsibleTrigger>
          <CollapsibleContent keepMounted>Kept text</CollapsibleContent>
        </Collapsible>
        <Collapsible id="found">
          <CollapsibleTrigger>Found</CollapsibleTrigger>
          <CollapsibleContent hiddenUntilFound>Found text</CollapsibleContent>
        </Collapsible>
      </div>,
    )
    let [kept, found] = slots(html, 'collapsible-content')

    assert.equal(kept.get('id'), 'kept-panel')
    assert.equal(kept.get('hidden'), '')
    assert.ok(kept.has('data-closed'))
    assert.equal(found.get('hidden'), 'until-found')
    assert.ok(html.includes('Kept text') && html.includes('Found text'))
  })

  it('disables the trigger natively', async () => {
    let html = await renderToString(
      <Collapsible disabled>
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
      </Collapsible>,
    )

    assert.ok(attributes(html, 'slot:collapsible').has('data-disabled'))
    assert.ok(attributes(html, 'slot:collapsible-trigger').has('disabled'))
  })

  it('gives every instance its own ids when the root has none', async () => {
    let html = await renderToString(
      <div>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>One</CollapsibleTrigger>
          <CollapsibleContent>First</CollapsibleContent>
        </Collapsible>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Two</CollapsibleTrigger>
          <CollapsibleContent>Second</CollapsibleContent>
        </Collapsible>
      </div>,
    )
    let triggers = slots(html, 'collapsible-trigger')
    let contents = slots(html, 'collapsible-content')

    assert.notEqual(contents[0].get('id'), contents[1].get('id'))
    assert.equal(triggers[0].get('aria-controls'), contents[0].get('id'))
    assert.equal(triggers[1].get('aria-controls'), contents[1].get('id'))
    assert.ok(!slots(html, 'collapsible').some((root) => root.has('id')))
  })

  it("passes the caller's attributes, class and type to each part", async () => {
    let html = await renderToString(
      <Collapsible class="settings" data-test="root" defaultOpen>
        <CollapsibleTrigger class="toggle" aria-label="More radius fields" form="radius">
          +
        </CollapsibleTrigger>
        <CollapsibleContent class="fields" data-test="content">
          Fields
        </CollapsibleContent>
      </Collapsible>,
    )
    let root = attributes(html, 'slot:collapsible')
    let trigger = attributes(html, 'slot:collapsible-trigger')
    let content = attributes(html, 'slot:collapsible-content')

    assert.ok(root.get('class')?.split(' ').includes('settings'))
    assert.equal(root.get('data-test'), 'root')
    assert.ok(trigger.get('class')?.split(' ').includes('toggle'))
    assert.equal(trigger.get('aria-label'), 'More radius fields')
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('form'), 'radius')
    assert.ok(content.get('class')?.split(' ').includes('fields'))
    assert.equal(content.get('data-test'), 'content')
  })

  it("keeps the caller's inert on an open panel", async () => {
    let html = await renderToString(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
        <CollapsibleContent inert>
          <input aria-label="Due within" />
        </CollapsibleContent>
      </Collapsible>,
    )

    assert.ok(attributes(html, 'slot:collapsible-content').has('inert'))
  })
})
