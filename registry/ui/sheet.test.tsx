import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet.tsx'

function tags(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map(
    ([, source = '']) =>
      new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])),
  )
}

describe('Sheet on the server', () => {
  it('renders a closed native dialog on the right edge, named and described by its header', async () => {
    let html = await renderToString(
      <Sheet>
        <SheetTrigger>Filters</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filter invoices</SheetTitle>
            <SheetDescription>Show only the invoices you need.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    )
    let [dialog] = tags(html, 'dialog')
    let [title] = tags(html, 'h2')
    let [description] = tags(html, 'p')
    let buttons = tags(html, 'button')

    assert.equal(dialog.has('open'), false)
    assert.equal(dialog.has('role'), false)
    assert.equal(dialog.get('data-slot'), 'sheet-content')
    assert.equal(dialog.get('data-side'), 'right')
    assert.equal(dialog.get('aria-labelledby'), title.get('id'))
    assert.equal(dialog.get('aria-describedby'), description.get('id'))
    assert.equal(title.get('data-slot'), 'sheet-title')
    assert.equal(description.get('data-slot'), 'sheet-description')
    assert.ok(html.includes('data-slot="sheet-header"'))
    assert.ok(html.includes('data-slot="sheet-footer"'))
    assert.deepEqual(
      buttons.map((button) => [button.get('data-slot'), button.get('command'), button.get('commandfor')]),
      [
        ['sheet-trigger', 'show-modal', dialog.get('id')],
        ['sheet-close', 'close', dialog.get('id')],
        ['sheet-close', 'close', dialog.get('id')],
      ],
    )
    assert.match(html, /<span[^>]*>Close<\/span><\/button><\/dialog>/)
  })

  it('renders each side, and leaves out the close button on request', async () => {
    for (let side of ['top', 'right', 'bottom', 'left'] as const) {
      let html = await renderToString(
        <Sheet>
          <SheetContent side={side} showCloseButton={false}>
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      assert.equal(tags(html, 'dialog')[0].get('data-side'), side)
      assert.equal(html.includes('<button'), false)
    }
  })
})
