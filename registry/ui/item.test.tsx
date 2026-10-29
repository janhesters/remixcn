import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  itemSizes,
  itemVariantNames,
  itemVariants,
} from './item.tsx'

describe('Item', () => {
  it('renders every part with its data-slot, in order', async () => {
    let html = await renderToString(
      <Item>
        <ItemHeader>Header</ItemHeader>
        <ItemMedia variant="icon">
          <svg aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Acme Labs</ItemTitle>
          <ItemDescription>3 open invoices</ItemDescription>
        </ItemContent>
        <ItemActions>
          <button type="button">Remind</button>
        </ItemActions>
        <ItemFooter>Footer</ItemFooter>
      </Item>,
    )

    assert.deepEqual(
      tags(html)
        .map((tag) => tag.attributes.get('data-slot'))
        .filter(Boolean),
      [
        'item',
        'item-header',
        'item-media',
        'item-content',
        'item-title',
        'item-description',
        'item-actions',
        'item-footer',
      ],
    )
    assert.equal(attributes(html, 'slot:item-description').get('data-slot'), 'item-description')
    assert.equal(tags(html, 'p')[0].attributes.get('data-slot'), 'item-description')
    assert.equal(text(html), 'HeaderAcme Labs3 open invoicesRemindFooter')
  })

  it('renders each variant and size, and no role outside a group', async () => {
    for (let variant of itemVariantNames) {
      for (let size of itemSizes) {
        let item = attributes(await renderToString(<Item variant={variant} size={size} />), 'div')

        assert.equal(item.get('data-variant'), variant)
        assert.equal(item.get('data-size'), size)
        assert.equal(item.has('role'), false)
      }
    }
  })

  it('makes a group a list whose items are list items', async () => {
    let html = await renderToString(
      <ItemGroup>
        <Item>Acme Labs</Item>
        <ItemSeparator />
        <Item>Globex</Item>
      </ItemGroup>,
    )
    let [group, first, separator, second] = tags(html, 'div')

    assert.equal(group.attributes.get('role'), 'list')
    assert.equal(group.attributes.get('data-slot'), 'item-group')
    assert.equal(first.attributes.get('role'), 'listitem')
    assert.equal(second.attributes.get('role'), 'listitem')
    // A list holds only list items, so the line between them is decorative.
    assert.equal(separator.attributes.get('role'), 'none')
    assert.equal(separator.attributes.get('data-slot'), 'item-separator')
    assert.equal(separator.attributes.get('data-orientation'), 'horizontal')
  })

  it('keeps a role the caller passes', async () => {
    let html = await renderToString(
      <ItemGroup role="group" aria-label="Customers">
        <Item role="group">Acme Labs</Item>
      </ItemGroup>,
    )

    assert.deepEqual(
      tags(html, 'div').map((tag) => tag.attributes.get('role')),
      ['group', 'group'],
    )
  })

  it('gives a native link the item look with itemVariants(), so the whole row is one link', async () => {
    let link = attributes(
      await renderToString(
        <a href="/customers/acme" mix={itemVariants({ variant: 'outline', size: 'sm' })}>
          Acme Labs
        </a>,
      ),
      'a',
    )

    assert.equal(link.get('href'), '/customers/acme')
    assert.equal(link.get('data-slot'), 'item')
    assert.equal(link.get('data-variant'), 'outline')
    assert.equal(link.get('data-size'), 'sm')
  })

  it('renders the media variants and a title heading', async () => {
    for (let variant of ['default', 'icon', 'image'] as const) {
      let media = attributes(await renderToString(<ItemMedia variant={variant} />), 'div')

      assert.equal(media.get('data-variant'), variant)
    }
    assert.equal(
      attributes(await renderToString(<ItemTitle level={3}>Acme Labs</ItemTitle>), 'h3').get('data-slot'),
      'item-title',
    )
  })
})
