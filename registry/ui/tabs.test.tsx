import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, slots } from '../../test/html.ts'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx'
import type { TabsProps } from './tabs.tsx'

function Settings(handle: Handle<TabsProps & { disabledTab?: string }>) {
  return () => {
    let { disabledTab, ...props } = handle.props
    return (
      <Tabs {...props}>
        <TabsList aria-label="Settings">
          <TabsTrigger value="account" disabled={disabledTab === 'account'}>
            Account
          </TabsTrigger>
          <TabsTrigger value="password" disabled={disabledTab === 'password'}>
            Password
          </TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Profile details</TabsContent>
        <TabsContent value="password">Change your password</TabsContent>
        <TabsContent value="alerts">Choose your alerts</TabsContent>
      </Tabs>
    )
  }
}

function selected(html: string) {
  return slots(html, 'tabs-trigger')
    .filter((tab) => tab.get('aria-selected') === 'true')
    .map((tab) => tab.get('value'))
}

describe('Tabs', () => {
  it('renders a tablist of native buttons and the panel of the selected tab', async () => {
    let html = await renderToString(<Settings id="settings" defaultValue="password" />)
    let list = attributes(html, 'slot:tabs-list')
    let tabs = slots(html, 'tabs-trigger')
    let panels = slots(html, 'tabs-content')

    assert.equal(attributes(html, 'slot:tabs').get('data-orientation'), 'horizontal')
    assert.equal(list.get('role'), 'tablist')
    assert.equal(list.get('aria-orientation'), 'horizontal')
    assert.equal(list.get('aria-label'), 'Settings')
    assert.deepEqual(
      tabs.map((tab) => [tab.get('role'), tab.get('type'), tab.get('aria-selected')]),
      [
        ['tab', 'button', 'false'],
        ['tab', 'button', 'true'],
        ['tab', 'button', 'false'],
      ],
    )
    assert.ok(tabs[1].has('data-active'))
    assert.equal(panels.length, 1)
    assert.equal(panels[0].get('role'), 'tabpanel')
    assert.equal(panels[0].get('tabindex'), '0')
    assert.ok(html.includes('Change your password'))
    assert.ok(!html.includes('Profile details'))
  })

  it('labels the panel by its tab, with ids from the tabs id', async () => {
    let html = await renderToString(<Settings id="settings" defaultValue="password" />)
    let tabs = slots(html, 'tabs-trigger')
    let panel = attributes(html, 'slot:tabs-content')

    assert.ok(tabs.every((tab) => tab.get('id')?.startsWith('settings-')))
    assert.equal(new Set(tabs.map((tab) => tab.get('id'))).size, 3)
    assert.equal(panel.get('aria-labelledby'), tabs[1].get('id'))
    // A tab points at its panel once the browser knows the panel is there.
    assert.ok(tabs.every((tab) => !tab.has('aria-controls')))
  })

  it('selects the first enabled tab without a value', async () => {
    assert.deepEqual(selected(await renderToString(<Settings />)), ['account'])
    assert.deepEqual(selected(await renderToString(<Settings disabledTab="account" />)), ['password'])
    assert.ok((await renderToString(<Settings disabledTab="account" />)).includes('Change your password'))
  })

  it('lets the value prop win over defaultValue', async () => {
    assert.deepEqual(selected(await renderToString(<Settings value="alerts" defaultValue="account" />)), ['alerts'])
  })

  it('keeps hidden panels in the document with keepMounted', async () => {
    let html = await renderToString(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">First</TabsContent>
        <TabsContent value="b" keepMounted>
          Second
        </TabsContent>
      </Tabs>,
    )
    let [first, second] = slots(html, 'tabs-content')

    assert.ok(!first.has('hidden'))
    assert.equal(second.get('hidden'), '')
    assert.ok(second.has('data-hidden'))
    assert.equal(second.get('tabindex'), '-1')
  })

  it('renders a vertical tab list with its orientation', async () => {
    let html = await renderToString(<Settings orientation="vertical" />)

    assert.equal(attributes(html, 'slot:tabs').get('data-orientation'), 'vertical')
    assert.equal(attributes(html, 'slot:tabs-list').get('aria-orientation'), 'vertical')
    assert.ok(slots(html, 'tabs-trigger').every((tab) => tab.get('data-orientation') === 'vertical'))
  })

  it('disables a tab natively and gives the line variant to its tabs', async () => {
    let html = await renderToString(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b" disabled>
            B
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    let [a, b] = slots(html, 'tabs-trigger')

    assert.equal(attributes(html, 'slot:tabs-list').get('data-variant'), 'line')
    assert.equal(a.get('data-variant'), 'line')
    assert.ok(b.has('disabled'))
    assert.ok(b.has('data-disabled'))
  })

  it('gives every instance its own ids', async () => {
    let html = await renderToString(
      <div>
        <Settings />
        <Settings />
      </div>,
    )
    let ids = [...slots(html, 'tabs-trigger'), ...slots(html, 'tabs-content')].map((part) => part.get('id'))

    assert.equal(new Set(ids).size, ids.length)
  })

  it("passes the caller's attributes to each part", async () => {
    let html = await renderToString(
      <Tabs class="tabs" defaultValue="a">
        <TabsList class="list">
          <TabsTrigger value="a" class="tab" data-test="tab">
            A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" class="panel" data-test="panel">
          Text
        </TabsContent>
      </Tabs>,
    )

    for (let [part, name] of [
      ['tabs', 'tabs'],
      ['tabs-list', 'list'],
      ['tabs-trigger', 'tab'],
      ['tabs-content', 'panel'],
    ]) {
      assert.ok(attributes(html, `slot:${part}`).get('class')?.split(' ').includes(name), part)
    }
    assert.equal(attributes(html, 'slot:tabs-trigger').get('data-test'), 'tab')
    assert.equal(attributes(html, 'slot:tabs-content').get('data-test'), 'panel')
  })
})
