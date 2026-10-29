import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.tsx'

/** Reads the attributes of every tag with this name, in document order. */
function tags(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map(
    ([, source = '']) =>
      new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])),
  )
}

function InvoiceDialog(handle: Handle<{ defaultOpen?: boolean; showCloseButton?: boolean }>) {
  return () => (
    <Dialog defaultOpen={handle.props.defaultOpen}>
      <DialogTrigger>Edit invoice</DialogTrigger>
      <DialogContent showCloseButton={handle.props.showCloseButton}>
        <DialogHeader>
          <DialogTitle>Edit invoice</DialogTitle>
          <DialogDescription>Change the due date of INV-0042.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog on the server', () => {
  it('renders a closed native dialog, named by its title and described by its description', async () => {
    let html = await renderToString(<InvoiceDialog />)
    let [dialog] = tags(html, 'dialog')
    let [title] = tags(html, 'h2')
    let [description] = tags(html, 'p')

    assert.equal(dialog.has('open'), false, 'a closed dialog stays out of the tab order and the accessibility tree')
    assert.equal(dialog.get('data-slot'), 'dialog-content')
    assert.ok(dialog.has('data-closed'))
    assert.ok(dialog.get('id'))
    assert.equal(dialog.get('aria-labelledby'), title.get('id'))
    assert.equal(dialog.get('aria-describedby'), description.get('id'))
    assert.equal(title.get('data-slot'), 'dialog-title')
    assert.equal(description.get('data-slot'), 'dialog-description')
    assert.ok(html.includes('data-slot="dialog-header"'))
    assert.ok(html.includes('data-slot="dialog-footer"'))
  })

  it('renders a trigger that opens the dialog natively, before any script runs', async () => {
    let html = await renderToString(<InvoiceDialog />)
    let [dialog] = tags(html, 'dialog')
    let [trigger] = tags(html, 'button')

    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('data-slot'), 'dialog-trigger')
    assert.equal(trigger.get('aria-haspopup'), 'dialog')
    assert.equal(trigger.get('aria-expanded'), 'false')
    assert.equal(trigger.get('aria-controls'), dialog.get('id'))
    assert.equal(trigger.get('commandfor'), dialog.get('id'))
    assert.equal(trigger.get('command'), 'show-modal')
    assert.equal(trigger.has('data-popup-open'), false)
  })

  it('renders close buttons that close the dialog natively, with a named close button in the corner', async () => {
    let html = await renderToString(<InvoiceDialog />)
    let [dialog] = tags(html, 'dialog')
    let closes = tags(html, 'button').filter((button) => button.get('command') === 'close')

    assert.equal(closes.length, 2)
    for (let close of closes) {
      assert.equal(close.get('type'), 'button')
      assert.equal(close.get('commandfor'), dialog.get('id'))
      assert.equal(close.get('data-slot'), 'dialog-close')
    }
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span[^>]*>Close<\/span><\/button><\/dialog>/)
  })

  it('leaves out the corner close button on request, and adds a footer close button on request', async () => {
    let without = await renderToString(<InvoiceDialog showCloseButton={false} />)
    assert.equal(tags(without, 'button').filter((button) => button.get('command') === 'close').length, 1)

    let footer = await renderToString(
      <Dialog>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Paid</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    )
    let [close] = tags(footer, 'button')
    assert.equal(close.get('command'), 'close')
    assert.equal(close.get('data-variant'), 'outline')
    assert.ok(footer.includes('>Close</button>'))
  })

  it('renders a dialog that starts open as visible content, so it reads without a script', async () => {
    let html = await renderToString(<InvoiceDialog defaultOpen />)
    let [dialog] = tags(html, 'dialog')
    let [trigger] = tags(html, 'button')

    assert.ok(dialog.has('open'))
    assert.ok(dialog.has('data-open'))
    assert.equal(trigger.get('aria-expanded'), 'true')
    assert.ok(trigger.has('data-popup-open'))
  })

  it('passes your attributes to the native dialog, and lets aria-label name it instead of the title', async () => {
    let html = await renderToString(
      <Dialog>
        <DialogContent aria-label="Invoice settings" class="wide" data-test="settings">
          <p>Settings</p>
        </DialogContent>
      </Dialog>,
    )
    let [dialog] = tags(html, 'dialog')

    assert.equal(dialog.get('aria-label'), 'Invoice settings')
    assert.equal(dialog.has('aria-labelledby'), false)
    assert.equal(dialog.get('data-test'), 'settings')
    assert.ok(dialog.get('class')?.split(' ').includes('wide'), dialog.get('class'))
  })

  it('gives each instance its own ids', async () => {
    let html = await renderToString(
      <div>
        <InvoiceDialog />
        <InvoiceDialog />
      </div>,
    )
    let [first, second] = tags(html, 'dialog')
    let triggers = tags(html, 'button').filter((button) => button.get('data-slot') === 'dialog-trigger')

    assert.notEqual(first.get('id'), second.get('id'))
    assert.notEqual(first.get('aria-labelledby'), second.get('aria-labelledby'))
    assert.deepEqual(
      triggers.map((trigger) => trigger.get('commandfor')),
      [first.get('id'), second.get('id')],
    )
  })

  it('names the parts that sit outside a Dialog', async () => {
    await assert.rejects(() => renderToString(<DialogTrigger>Open</DialogTrigger>), /DialogTrigger.*inside.*Dialog/)
  })
})
