import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  getMessageScroller,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  watchMessageScrollerScrollable,
  watchMessageScrollerVisibility,
} from './message-scroller.tsx'
import type { MessageScrollerDefaultScrollPosition, MessageScrollerViewportProps } from './message-scroller.tsx'

interface Tag {
  name: string
  attributes: Map<string, string>
  index: number
}

function tags(html: string): Tag[] {
  return [...html.matchAll(/<([a-z][a-z0-9-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/g)].map((match) => ({
    name: match[1] ?? '',
    index: match.index,
    attributes: new Map(
      [...(match[2] ?? '').matchAll(/\s+([^\s=>]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key ?? '', value ?? '']),
    ),
  }))
}

function slots(html: string, slot: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === slot)
}

function one(html: string, slot: string) {
  let [tag] = slots(html, slot)
  assert.ok(tag, `renders ${slot}`)
  return tag
}

const messages = [
  { id: 'm1', role: 'user', text: 'Can you move the invoice run to Friday?' },
  { id: 'm2', role: 'assistant', text: 'Done. The run starts Friday at 09:00.' },
  { id: 'm3', role: 'user', text: 'And send the reminder a day earlier.' },
]

function Transcript(
  handle: Handle<{ position?: MessageScrollerDefaultScrollPosition; viewport?: MessageScrollerViewportProps }>,
) {
  return () => (
    <MessageScrollerProvider defaultScrollPosition={handle.props.position}>
      <MessageScroller class="chat">
        <MessageScrollerViewport {...handle.props.viewport}>
          <MessageScrollerContent>
            {messages.map((message) => (
              <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === 'user'}>
                {message.text}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
        <MessageScrollerButton direction="start" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

describe('MessageScroller on the server', () => {
  it('renders every row inside a labelled, focusable region and a log', async () => {
    let html = await renderToString(<Transcript />)

    let root = one(html, 'message-scroller')
    let viewport = one(html, 'message-scroller-viewport')
    let content = one(html, 'message-scroller-content')
    assert.ok(root.index < viewport.index && viewport.index < content.index)
    assert.match(root.attributes.get('class') ?? '', /chat/)
    assert.equal(viewport.attributes.get('role'), 'region')
    assert.equal(viewport.attributes.get('aria-label'), 'Messages')
    assert.equal(viewport.attributes.get('tabindex'), '0')
    assert.equal(content.attributes.get('role'), 'log')
    assert.equal(content.attributes.get('aria-relevant'), 'additions')

    let items = slots(html, 'message-scroller-item')
    assert.deepEqual(
      items.map((item) => [item.attributes.get('data-message-id'), item.attributes.get('data-scroll-anchor')]),
      [
        ['m1', 'true'],
        ['m2', 'false'],
        ['m3', 'true'],
      ],
    )
    for (let message of messages) assert.ok(html.includes(message.text))
  })

  it('ends the rows with a hidden spacer that assistive technology skips', async () => {
    let html = await renderToString(<Transcript />)

    let spacer = one(html, 'message-scroller-spacer')
    let items = slots(html, 'message-scroller-item')
    assert.ok(spacer.index > (items.at(-1)?.index ?? Infinity))
    assert.equal(spacer.attributes.has('hidden'), true)
    assert.equal(spacer.attributes.get('aria-hidden'), 'true')
  })

  it('hides the viewport until the browser opens it at the end or the last turn, but not at the start', async () => {
    for (let position of [undefined, 'end', 'last-anchor'] as const) {
      let html = await renderToString(<Transcript position={position} />)
      assert.equal(one(html, 'message-scroller').attributes.has('data-pending-scroll'), true, position)
      assert.equal(one(html, 'message-scroller-viewport').attributes.has('data-pending-scroll'), true, position)
    }

    let html = await renderToString(<Transcript position="start" />)
    assert.equal(one(html, 'message-scroller').attributes.has('data-pending-scroll'), false)
    assert.equal(one(html, 'message-scroller-viewport').attributes.has('data-pending-scroll'), false)
  })

  it('shows a hidden viewport without JavaScript, and after two seconds when its script never runs', async () => {
    let html = await renderToString(<Transcript />)

    assert.match(html, /@media \(scripting: none\)/)
    assert.match(html, /@keyframes remixcn-message-scroller-reveal/)
    assert.match(html, /animation: remixcn-message-scroller-reveal 0s 2s forwards/)
  })

  it('renders the jump buttons hidden, inert and out of the tab order until the browser measures', async () => {
    let html = await renderToString(<Transcript />)

    let buttons = slots(html, 'message-scroller-button')
    assert.deepEqual(
      buttons.map((button) => button.attributes.get('data-direction')),
      ['end', 'start'],
    )
    for (let button of buttons) {
      assert.equal(button.name, 'button')
      assert.equal(button.attributes.get('type'), 'button')
      assert.equal(button.attributes.get('data-active'), 'false')
      assert.equal(button.attributes.has('inert'), true)
      assert.equal(button.attributes.get('tabindex'), '-1')
      assert.equal(button.attributes.get('data-variant'), 'secondary')
      assert.equal(button.attributes.get('data-size'), 'icon-sm')
    }
    assert.match(html, />Scroll to end</)
    assert.match(html, />Scroll to start</)
    assert.equal(
      tags(html).filter((tag) => tag.name === 'svg' && tag.attributes.get('aria-hidden') === 'true').length,
      2,
    )
  })

  it('lets the caller rename the viewport and the log, and pass attributes and mixins to every part', async () => {
    let html = await renderToString(
      <MessageScrollerProvider>
        <MessageScroller data-testid="frame" mix={css({ height: '30rem' })}>
          <MessageScrollerViewport aria-labelledby="chat-title" id="messages">
            <MessageScrollerContent role="feed" aria-relevant="additions text" aria-busy="true">
              <MessageScrollerItem data-testid="row">Row</MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton variant="outline" size="icon" aria-label="Newest messages">
            New
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>,
    )

    assert.equal(one(html, 'message-scroller').attributes.get('data-testid'), 'frame')
    assert.match(html, /height: 30rem/)
    let viewport = one(html, 'message-scroller-viewport')
    assert.equal(viewport.attributes.get('aria-labelledby'), 'chat-title')
    assert.equal(viewport.attributes.has('aria-label'), false)
    assert.equal(viewport.attributes.get('id'), 'messages')
    let content = one(html, 'message-scroller-content')
    assert.equal(content.attributes.get('role'), 'feed')
    assert.equal(content.attributes.get('aria-relevant'), 'additions text')
    assert.equal(content.attributes.get('aria-busy'), 'true')
    let item = one(html, 'message-scroller-item')
    assert.equal(item.attributes.get('data-testid'), 'row')
    assert.equal(item.attributes.get('data-scroll-anchor'), 'false')
    assert.equal(item.attributes.has('data-message-id'), false)
    let button = one(html, 'message-scroller-button')
    assert.equal(button.attributes.get('data-variant'), 'outline')
    assert.equal(button.attributes.get('aria-label'), 'Newest messages')
    assert.doesNotMatch(html, /Scroll to end/)
  })

  it('keeps the viewport out of the tab order only when the caller asks', async () => {
    let html = await renderToString(<Transcript viewport={{ tabIndex: -1, role: 'group' }} />)

    assert.equal(one(html, 'message-scroller-viewport').attributes.get('tabindex'), '-1')
    assert.equal(one(html, 'message-scroller-viewport').attributes.get('role'), 'group')
  })

  it('gives the helpers an empty state on the server', async () => {
    function Status(handle: Handle) {
      return () => {
        let scroller = getMessageScroller(handle)
        let { start, end } = watchMessageScrollerScrollable(handle)
        let { currentAnchorId, visibleMessageIds } = watchMessageScrollerVisibility(handle)
        return (
          <output>
            {String(start)} {String(end)} {String(currentAnchorId)} {visibleMessageIds.length}{' '}
            {typeof scroller.scrollToMessage}
          </output>
        )
      }
    }

    let html = await renderToString(
      <MessageScrollerProvider>
        <Status />
      </MessageScrollerProvider>,
    )

    assert.match(html, /<output>false false null 0 function<\/output>/)
  })

  it('fails the render when a part or a helper is outside a provider', async () => {
    await assert.rejects(
      renderToString(<MessageScroller />),
      /MessageScroller must be inside a MessageScrollerProvider/,
    )
    await assert.rejects(
      renderToString(<MessageScrollerItem />),
      /MessageScrollerItem must be inside a MessageScrollerProvider/,
    )

    function Orphan(handle: Handle) {
      return () => {
        getMessageScroller(handle)
        return null
      }
    }
    await assert.rejects(renderToString(<Orphan />), /getMessageScroller must be inside a MessageScrollerProvider/)
  })
})
