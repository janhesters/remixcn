import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from './message.tsx'

describe('Message', () => {
  it('renders the group, row, avatar, content, header and footer with their data-slot, in order', async () => {
    let html = await renderToString(
      <MessageGroup>
        <Message>
          <MessageAvatar>
            <span>OL</span>
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>Olivia</MessageHeader>
            <p>The retry finished.</p>
            <MessageFooter>Delivered</MessageFooter>
          </MessageContent>
        </Message>
      </MessageGroup>,
    )

    assert.deepEqual(
      tags(html)
        .map((tag) => tag.attributes.get('data-slot'))
        .filter(Boolean),
      ['message-group', 'message', 'message-avatar', 'message-content', 'message-header', 'message-footer'],
    )
    assert.equal(attributes(html, 'slot:message').get('data-align'), 'start')
    assert.equal(text(html), 'OLOliviaThe retry finished.Delivered')
  })

  it('renders each alignment, and no role, so the conversation keeps its own semantics', async () => {
    for (let align of ['start', 'end'] as const) {
      let message = attributes(await renderToString(<Message align={align} />), 'div')

      assert.equal(message.get('data-align'), align)
      assert.equal(message.has('role'), false)
    }
  })

  it('passes a role, a label and other attributes through', async () => {
    let html = await renderToString(
      <MessageGroup role="list" aria-label="Messages from Olivia">
        <Message role="listitem" id="message-7" aria-labelledby="message-7-sender">
          <MessageContent>
            <MessageHeader id="message-7-sender">Olivia</MessageHeader>
          </MessageContent>
        </Message>
      </MessageGroup>,
    )

    assert.equal(attributes(html, 'slot:message-group').get('role'), 'list')
    assert.equal(attributes(html, 'slot:message').get('role'), 'listitem')
    assert.equal(attributes(html, 'slot:message').get('aria-labelledby'), 'message-7-sender')
    assert.equal(attributes(html, 'slot:message-header').get('id'), 'message-7-sender')
  })

  it('escapes sender names and text, so untrusted content never becomes markup', async () => {
    let html = await renderToString(
      <Message>
        <MessageContent>
          <MessageHeader>{'<b onmouseover="alert(1)">Mallory</b>'}</MessageHeader>
        </MessageContent>
      </Message>,
    )

    assert.equal(tags(html, 'b').length, 0)
    assert.equal(text(html), '<b onmouseover="alert(1)">Mallory</b>')
  })
})
