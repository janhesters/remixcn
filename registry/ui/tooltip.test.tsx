import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, tooltipTrigger } from './tooltip.tsx'

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

describe('Tooltip on the server', () => {
  it('describes its trigger with the hidden content, so the description works before any script', async () => {
    let html = await renderToString(
      <Tooltip>
        <TooltipTrigger>Archive</TooltipTrigger>
        <TooltipContent>Moves the invoice to the archive</TooltipContent>
      </Tooltip>,
    )
    let trigger = attributes(html, 'data-slot="tooltip-trigger"')
    let content = attributes(html, 'data-slot="tooltip-content"')
    let arrow = attributes(html, 'data-slot="tooltip-arrow"')

    assert.equal(trigger.get('type'), 'button')
    assert.ok(content.get('id'))
    assert.equal(trigger.get('aria-describedby'), content.get('id'))
    assert.equal(content.get('role'), 'tooltip')
    assert.equal(content.get('popover'), 'manual')
    assert.ok(content.has('data-closed'))
    assert.ok(!content.has('data-open'))
    assert.equal(arrow.get('aria-hidden'), 'true')
    assert.match(html, /Moves the invoice to the archive/)
  })

  it('renders closed until the browser shows it, also when open or open by default', async () => {
    for (let node of [
      <Tooltip open>
        <TooltipTrigger>Archive</TooltipTrigger>
        <TooltipContent>Archive</TooltipContent>
      </Tooltip>,
      <Tooltip defaultOpen>
        <TooltipTrigger>Archive</TooltipTrigger>
        <TooltipContent>Archive</TooltipContent>
      </Tooltip>,
    ]) {
      let html = await renderToString(node)
      assert.ok(!attributes(html, 'tooltip-trigger').has('data-popup-open'))
      assert.ok(attributes(html, 'tooltip-content').has('data-closed'))
    }
  })

  it("keeps the caller's descriptions and ids, and gives every instance its own", async () => {
    let html = await renderToString(
      <TooltipProvider delay={200}>
        <p id="shortcut">Shortcut: A</p>
        <Tooltip>
          <TooltipTrigger aria-describedby="shortcut" id="archive">
            Archive
          </TooltipTrigger>
          <TooltipContent id="archive-tip">Moves the invoice to the archive</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Delete</TooltipTrigger>
          <TooltipContent>Deletes the draft</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Send</TooltipTrigger>
          <TooltipContent>Sends the reminder</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    let ids = tags(html, 'data-slot="tooltip-trigger"').map((trigger) => trigger.get('aria-describedby'))

    assert.equal(ids[0], 'shortcut archive-tip')
    assert.ok(html.includes('id="archive-tip"'))
    assert.equal(new Set(ids).size, 3)
    for (let id of ids.slice(1)) assert.ok(html.includes(`id="${id}"`), `no content with id ${id}`)
  })

  it('describes a link or any other trigger through tooltipTrigger()', async () => {
    let html = await renderToString(
      <Tooltip>
        <a href="/terms" mix={tooltipTrigger()}>
          Payment terms
        </a>
        <TooltipContent>Net 30 for every customer</TooltipContent>
      </Tooltip>,
    )
    let link = attributes(html, 'href="/terms"')

    assert.equal(link.get('data-slot'), 'tooltip-trigger')
    assert.equal(link.get('aria-describedby'), attributes(html, 'tooltip-content').get('id'))
  })

  it('marks the trigger of a disabled tooltip', async () => {
    let html = await renderToString(
      <Tooltip disabled>
        <TooltipTrigger>Archive</TooltipTrigger>
        <TooltipContent>Archive</TooltipContent>
      </Tooltip>,
    )

    assert.ok(attributes(html, 'tooltip-trigger').has('data-trigger-disabled'))
  })
})
