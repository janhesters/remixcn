import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buttonVariants } from '#remixcn/ui/button.tsx'

import { HoverCard, HoverCardContent, HoverCardTrigger, hoverCardTrigger } from './hover-card.tsx'

/** Reads the attributes of the first tag that has `marker` among its attributes. */
function attributes(html: string, marker: string) {
  let tag = [...html.matchAll(/<[\w-]+(\s[^>]*)?>/g)].map((match) => match[1] ?? '').find((tag) => tag.includes(marker))
  assert.ok(tag !== undefined, `no tag with ${marker}`)
  return new Map([...tag.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']))
}

describe('Hover Card on the server', () => {
  it('renders a native link and the hidden card, closed until the browser opens it', async () => {
    for (let node of [
      <HoverCard>
        <HoverCardTrigger href="/customers/acme">Acme Labs</HoverCardTrigger>
        <HoverCardContent>Customer since 2021</HoverCardContent>
      </HoverCard>,
      <HoverCard defaultOpen>
        <HoverCardTrigger href="/customers/acme">Acme Labs</HoverCardTrigger>
        <HoverCardContent>Customer since 2021</HoverCardContent>
      </HoverCard>,
    ]) {
      let html = await renderToString(node)
      let trigger = attributes(html, 'data-slot="hover-card-trigger"')
      let content = attributes(html, 'data-slot="hover-card-content"')

      assert.match(html, /<a\s[^>]*href="\/customers\/acme"/)
      assert.ok(!trigger.has('data-popup-open'))
      assert.equal(content.get('popover'), 'manual')
      assert.ok(content.has('data-closed'))
      assert.ok(!content.has('role'), 'a hover card is extra content for sighted users, not a dialog')
      assert.match(html, /Customer since 2021/)
    }
  })

  it("passes the caller's attributes, and makes any element a trigger through hoverCardTrigger()", async () => {
    let html = await renderToString(
      <HoverCard>
        <button type="button" mix={[buttonVariants({ variant: 'outline' }), hoverCardTrigger({ delay: 100 })]}>
          Preview
        </button>
        <HoverCardContent id="preview-card" class="wide" data-test="card">
          Preview
        </HoverCardContent>
      </HoverCard>,
    )
    let button = attributes(html, 'type="button"')
    let content = attributes(html, 'id="preview-card"')

    assert.equal(button.get('data-slot'), 'button', "the Button's own slot stays")
    assert.equal(content.get('data-test'), 'card')
    assert.ok(content.get('class')?.split(' ').includes('wide'))
  })
})
