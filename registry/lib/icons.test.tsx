import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { CheckIcon, ChevronRightIcon, CircleAlertIcon, Icon } from './icons.tsx'

function attributes(html: string) {
  let tag = /<svg([^>]*)>/.exec(html)?.[1] ?? ''
  return new Map([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))
}

describe('icons', () => {
  it('hides a decorative icon from assistive technology', async () => {
    let svg = attributes(await renderToString(<CheckIcon />))

    assert.equal(svg.get('aria-hidden'), 'true')
    assert.equal(svg.has('role'), false)
    assert.equal(svg.has('aria-label'), false)
  })

  it('names an icon that carries meaning on its own', async () => {
    let svg = attributes(await renderToString(<CircleAlertIcon label="Error" />))

    assert.equal(svg.get('role'), 'img')
    assert.equal(svg.get('aria-label'), 'Error')
    assert.equal(svg.has('aria-hidden'), false)
  })

  it('scales with the font size and takes the text color, so forced colors and themes apply', async () => {
    for (let icon of [<CheckIcon />, <ChevronRightIcon />, <CircleAlertIcon />]) {
      let svg = attributes(await renderToString(icon))

      assert.equal(svg.get('width'), '1em')
      assert.equal(svg.get('height'), '1em')
      assert.equal(svg.get('viewBox'), '0 0 24 24')
      assert.equal(svg.get('stroke'), 'currentColor')
      assert.equal(svg.get('fill'), 'none')
    }
  })

  it('wraps your own paths the same way', async () => {
    let html = await renderToString(
      <Icon>
        <path d="M4 12h16" />
      </Icon>,
    )

    assert.equal(attributes(html).get('aria-hidden'), 'true')
    assert.ok(html.includes('<path d="M4 12h16"'), html)
  })
})
