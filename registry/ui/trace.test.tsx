import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots, tags, text } from '../../test/html.ts'

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
  traceStatusLabels,
  traceStatuses,
} from './trace.tsx'

/** The tags that carry a data-slot, as name:slot, in document order. */
function slotTags(html: string) {
  return tags(html)
    .filter((tag) => tag.attributes.has('data-slot'))
    .map((tag) => `${tag.name}:${tag.attributes.get('data-slot')}`)
}

describe('Trace', () => {
  it('renders a list of lines without roles, and hides the icons from assistive technology', async () => {
    let html = await renderToString(
      <Trace>
        <TraceLine>
          <TraceIcon>
            <svg />
          </TraceIcon>
          <TraceTitle>Ran pnpm test</TraceTitle>
          <TraceDescription>14s</TraceDescription>
        </TraceLine>
      </Trace>,
    )

    assert.deepEqual(slotTags(html), [
      'div:trace',
      'span:trace-line',
      'span:trace-icon',
      'span:trace-title',
      'span:trace-description',
    ])
    assert.ok(!html.includes('role='))
    assert.equal(attributes(html, 'slot:trace-icon').get('aria-hidden'), 'true')
    assert.ok(!attributes(html, 'slot:trace-line').has('data-status'))
    assert.equal(text(html), 'Ran pnpm test14s')
  })

  it('marks a status on the line and says it in hidden text after the title', async () => {
    for (let status of traceStatuses) {
      let html = await renderToString(
        <TraceLine status={status}>
          <TraceTitle>Build</TraceTitle>
        </TraceLine>,
      )

      assert.equal(attributes(html, 'slot:trace-line').get('data-status'), status)
      assert.deepEqual(slotTags(html), ['span:trace-line', 'span:trace-title', 'span:trace-status'])
      assert.equal(text(html), `Build (${traceStatusLabels[status]})`)
    }
    assert.deepEqual(traceStatusLabels, { running: 'in progress', error: 'failed', pending: 'not started' })
  })

  it('takes its own status words, or none when the title already says it', async () => {
    let html = await renderToString(
      <div>
        <TraceLine status="error" statusLabel="needs a retry">
          <TraceTitle>pnpm lint</TraceTitle>
        </TraceLine>
        <TraceLine status="running" statusLabel="">
          <TraceTitle>Running pnpm build</TraceTitle>
        </TraceLine>
        <TraceLine statusLabel="done">
          <TraceTitle>Ran pnpm install</TraceTitle>
        </TraceLine>
      </div>,
    )

    assert.equal(text(html), 'pnpm lint (needs a retry)Running pnpm buildRan pnpm install')
    assert.equal(slots(html, 'trace-status').length, 1)
  })

  it('renders a closed row as a native button with a chevron and no detail', async () => {
    let html = await renderToString(
      <TraceCollapsible id="node">
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>Ran node --version</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>v24.18.0</TraceCollapsibleContent>
      </TraceCollapsible>,
    )
    let trigger = attributes(html, 'slot:trace-collapsible-trigger')

    assert.deepEqual(slotTags(html), [
      'div:trace-collapsible',
      'button:trace-collapsible-trigger',
      'span:trace-line',
      'span:trace-title',
      'span:trace-icon',
    ])
    assert.ok(attributes(html, 'slot:trace-collapsible').has('data-closed'))
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('id'), 'node-trigger')
    assert.equal(trigger.get('aria-expanded'), 'false')
    assert.equal(attributes(html, 'slot:trace-icon').get('aria-hidden'), 'true')
    assert.ok(!html.includes('v24.18.0'))
  })

  it('renders an open row with its detail in an inner wrapper, and lets open win over defaultOpen', async () => {
    let html = await renderToString(
      <div>
        <TraceCollapsible id="open" defaultOpen>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>Ran node --version</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>v24.18.0</TraceCollapsibleContent>
        </TraceCollapsible>
        <TraceCollapsible open={false} defaultOpen>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>Ran pnpm --version</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>10.33.4</TraceCollapsibleContent>
        </TraceCollapsible>
      </div>,
    )
    let [first, second] = slots(html, 'trace-collapsible-trigger')

    assert.equal(first.get('aria-expanded'), 'true')
    assert.equal(first.get('aria-controls'), 'open-panel')
    assert.equal(attributes(html, 'slot:trace-collapsible-content').get('id'), 'open-panel')
    assert.deepEqual(slotTags(html).slice(5, 7), [
      'div:trace-collapsible-content',
      'div:trace-collapsible-content-inner',
    ])
    assert.ok(html.includes('v24.18.0'))
    assert.equal(second.get('aria-expanded'), 'false')
    assert.ok(!html.includes('10.33.4'))
  })

  it("puts the caller's class and mixins on the detail's inner wrapper, and other props on the panel", async () => {
    let html = await renderToString(
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>Used 3 sources</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted class="sources" data-test="panel">
          Links
        </TraceCollapsibleContent>
      </TraceCollapsible>,
    )
    let panel = attributes(html, 'slot:trace-collapsible-content')
    let inner = attributes(html, 'slot:trace-collapsible-content-inner')

    assert.equal(panel.get('hidden'), '')
    assert.equal(panel.get('data-test'), 'panel')
    assert.ok(!panel.get('class')?.split(' ').includes('sources'))
    assert.ok(inner.get('class')?.split(' ').includes('sources'))
  })

  it("passes the caller's props through, and disables a row natively", async () => {
    let html = await renderToString(
      <Trace id="steps" aria-label="Steps" data-test="trace">
        <TraceCollapsible disabled data-test="row">
          <TraceCollapsibleTrigger aria-describedby="why">
            <TraceLine data-test="line">
              <TraceTitle>Ran pnpm test</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
        </TraceCollapsible>
      </Trace>,
    )

    assert.equal(attributes(html, 'slot:trace').get('id'), 'steps')
    assert.equal(attributes(html, 'slot:trace').get('aria-label'), 'Steps')
    assert.equal(attributes(html, 'slot:trace-collapsible').get('data-test'), 'row')
    assert.ok(attributes(html, 'slot:trace-collapsible').has('data-disabled'))
    assert.ok(attributes(html, 'slot:trace-collapsible-trigger').has('disabled'))
    assert.equal(attributes(html, 'slot:trace-collapsible-trigger').get('aria-describedby'), 'why')
    assert.equal(attributes(html, 'slot:trace-line').get('data-test'), 'line')
  })

  it('keeps a native link or button that wraps a line as it is', async () => {
    let html = await renderToString(
      <Trace>
        <a href="https://example.com/docs" target="_blank" rel="noreferrer">
          <TraceLine>
            <TraceTitle>Read the docs</TraceTitle>
          </TraceLine>
        </a>
        <button type="button" aria-haspopup="dialog">
          <TraceLine>
            <TraceTitle>Searched the web</TraceTitle>
          </TraceLine>
        </button>
      </Trace>,
    )

    assert.equal(attributes(html, 'a').get('href'), 'https://example.com/docs')
    assert.equal(attributes(html, 'a').get('target'), '_blank')
    assert.equal(attributes(html, 'button').get('type'), 'button')
    assert.equal(attributes(html, 'button').get('aria-haspopup'), 'dialog')
  })

  it('renders a polite status region only when asked to announce, once for nested lists', async () => {
    let quiet = await renderToString(
      <Trace>
        <TraceLine status="running">
          <TraceTitle>Running pnpm build</TraceTitle>
        </TraceLine>
      </Trace>,
    )
    let announcing = await renderToString(
      <Trace announce>
        <TraceLine status="running">
          <TraceTitle>Running pnpm build</TraceTitle>
        </TraceLine>
        <Trace>
          <TraceLine>
            <TraceTitle>Ran pnpm install</TraceTitle>
          </TraceLine>
        </Trace>
      </Trace>,
    )
    let regions = slots(announcing, 'trace-announcer')

    assert.deepEqual(slots(quiet, 'trace-announcer'), [])
    assert.equal(regions.length, 1)
    assert.equal(regions[0].get('role'), 'status')
    // The region starts empty, so nothing is read when the page loads.
    assert.equal(text(announcing), 'Running pnpm build (in progress)Ran pnpm install')
  })
})
