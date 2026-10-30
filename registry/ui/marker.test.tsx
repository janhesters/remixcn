import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Marker, MarkerContent, MarkerIcon, markerVariantNames, markerVariants } from './marker.tsx'

describe('Marker', () => {
  it('renders a div with its icon and content, in order, and hides the icon from assistive technology', async () => {
    let html = await renderToString(
      <Marker>
        <MarkerIcon>
          <svg />
        </MarkerIcon>
        <MarkerContent>Explored 4 files</MarkerContent>
      </Marker>,
    )

    assert.deepEqual(
      tags(html)
        .map((tag) => `${tag.name}:${tag.attributes.get('data-slot') ?? ''}`)
        .filter((tag) => !tag.endsWith(':')),
      ['div:marker', 'span:marker-icon', 'span:marker-content'],
    )
    assert.equal(attributes(html, 'slot:marker').get('data-variant'), 'default')
    assert.equal(attributes(html, 'slot:marker').has('role'), false)
    assert.equal(attributes(html, 'slot:marker-icon').get('aria-hidden'), 'true')
    assert.equal(text(html), 'Explored 4 files')
  })

  it('renders each variant, and passes a role such as status through', async () => {
    for (let variant of markerVariantNames) {
      let marker = attributes(await renderToString(<Marker variant={variant} role="status" />), 'div')

      assert.equal(marker.get('data-variant'), variant)
      assert.equal(marker.get('role'), 'status')
    }
  })

  it('gives a native link or button the marker look and attributes, in place of render', async () => {
    let html = await renderToString(
      <>
        <a href="/files" mix={markerVariants()}>
          <MarkerContent>View the files</MarkerContent>
        </a>
        <button type="button" mix={markerVariants({ variant: 'border' })}>
          <MarkerContent>Show the steps</MarkerContent>
        </button>
      </>,
    )

    let link = attributes(html, 'a')
    let button = attributes(html, 'button')
    assert.equal(link.get('data-slot'), 'marker')
    assert.equal(link.get('data-variant'), 'default')
    assert.equal(link.get('href'), '/files')
    assert.equal(button.get('data-variant'), 'border')
    assert.equal(button.get('type'), 'button')
  })

  it('escapes text, so untrusted content never becomes markup', async () => {
    let html = await renderToString(
      <Marker>
        <MarkerContent>{'<img src=x onerror="alert(1)">'}</MarkerContent>
      </Marker>,
    )

    assert.equal(tags(html, 'img').length, 0)
    assert.equal(text(html), '<img src=x onerror="alert(1)">')
  })

  it("keeps a caller's data-slot, attributes and mixins", async () => {
    let html = await renderToString(
      <Marker data-slot="checkpoint" id="restore" aria-label="Synced" variant="separator">
        <MarkerIcon id="icon" />
      </Marker>,
    )

    let marker = attributes(html, 'div')
    assert.equal(marker.get('data-slot'), 'checkpoint')
    assert.equal(marker.get('id'), 'restore')
    assert.equal(marker.get('aria-label'), 'Synced')
    assert.equal(attributes(html, 'span').get('id'), 'icon')
  })
})
