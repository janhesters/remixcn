import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog.tsx'

function tags(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map(
    ([, source = '']) =>
      new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])),
  )
}

const deleteInvoice = (
  <AlertDialog>
    <AlertDialogTrigger>Delete invoice</AlertDialogTrigger>
    <AlertDialogContent size="sm">
      <AlertDialogHeader>
        <AlertDialogMedia>!</AlertDialogMedia>
        <AlertDialogTitle>Delete INV-0042?</AlertDialogTitle>
        <AlertDialogDescription>The invoice and its reminders go away for good.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep invoice</AlertDialogCancel>
        <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

describe('Alert Dialog on the server', () => {
  it('renders a closed native dialog with the alertdialog role, named and described by its text', async () => {
    let html = await renderToString(deleteInvoice)
    let [dialog] = tags(html, 'dialog')
    let [title] = tags(html, 'h2')
    let [description] = tags(html, 'p')

    assert.equal(dialog.get('role'), 'alertdialog')
    assert.equal(dialog.has('open'), false)
    assert.equal(dialog.get('data-slot'), 'alert-dialog-content')
    assert.equal(dialog.get('data-size'), 'sm')
    assert.equal(dialog.get('aria-labelledby'), title.get('id'))
    assert.equal(dialog.get('aria-describedby'), description.get('id'))
    assert.equal(title.get('data-slot'), 'alert-dialog-title')
    assert.equal(description.get('data-slot'), 'alert-dialog-description')
    assert.ok(html.includes('data-slot="alert-dialog-media"'))
    assert.ok(html.includes('data-slot="alert-dialog-header"'))
    assert.ok(html.includes('data-slot="alert-dialog-footer"'))
  })

  it('has no corner close button, so the user answers with one of its actions', async () => {
    let html = await renderToString(deleteInvoice)

    assert.equal(html.includes('>Close<'), false)
    assert.equal(tags(html, 'dialog')[0].has('data-close-button'), false)
  })

  it('renders a cancel button that closes natively and an action button that only confirms', async () => {
    let html = await renderToString(deleteInvoice)
    let [dialog] = tags(html, 'dialog')
    let buttons = tags(html, 'button')
    let trigger = buttons.find((button) => button.get('data-slot') === 'alert-dialog-trigger')!
    let cancel = buttons.find((button) => button.get('data-slot') === 'alert-dialog-cancel')!
    let action = buttons.find((button) => button.get('data-slot') === 'alert-dialog-action')!

    assert.equal(trigger.get('commandfor'), dialog.get('id'))
    assert.equal(trigger.get('command'), 'show-modal')
    assert.equal(cancel.get('commandfor'), dialog.get('id'))
    assert.equal(cancel.get('command'), 'close')
    assert.equal(cancel.get('data-variant'), 'outline')
    assert.equal(action.has('command'), false)
    assert.equal(action.has('commandfor'), false)
    assert.equal(action.get('type'), 'button')
    assert.equal(action.get('data-variant'), 'destructive')
  })

  it('keeps the size default and the action a submit button when you say so', async () => {
    let html = await renderToString(
      <AlertDialog>
        <AlertDialogContent>
          <AlertDialogTitle>Send reminder?</AlertDialogTitle>
          <form method="post" action="/reminders">
            <AlertDialogAction type="submit" name="intent" value="send">
              Send
            </AlertDialogAction>
          </form>
        </AlertDialogContent>
      </AlertDialog>,
    )
    let [dialog] = tags(html, 'dialog')
    let [guard, action] = tags(html, 'button')

    assert.equal(dialog.get('data-size'), 'default')
    assert.equal(action.get('type'), 'submit')
    assert.equal(action.get('name'), 'intent')
    assert.equal(action.get('data-slot'), 'alert-dialog-action')
    assert.equal(guard.get('data-slot'), 'alert-dialog-enter-guard')
  })

  it('puts a hidden, disabled submit button before a submit action, so Enter in a field submits nothing without a script', async () => {
    let html = await renderToString(
      <AlertDialog>
        <AlertDialogContent>
          <AlertDialogTitle>Write off INV-0042?</AlertDialogTitle>
          <form method="post" action="/invoices" id="write-off">
            <input name="reason" aria-label="Reason" />
          </form>
          <AlertDialogAction type="submit" form="write-off">
            Write off
          </AlertDialogAction>
          <AlertDialogAction>Archive</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    )
    let buttons = tags(html, 'button')
    let [guard, action] = buttons

    // The HTML standard: Enter in a field clicks the form's default button,
    // its first submit button, and a disabled default button submits nothing.
    assert.equal(guard.get('type'), 'submit')
    assert.ok(guard.has('disabled'))
    assert.ok(guard.has('hidden'))
    assert.equal(guard.get('form'), 'write-off', 'it joins the same form as the action')
    assert.equal(guard.has('name'), false)
    assert.equal(action.get('data-slot'), 'alert-dialog-action')
    assert.equal(
      buttons.filter((button) => button.get('data-slot') === 'alert-dialog-enter-guard').length,
      1,
      'only before a submit action',
    )
  })
})
