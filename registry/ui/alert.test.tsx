import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Alert, AlertAction, AlertDescription, AlertTitle } from './alert.tsx'

describe('Alert', () => {
  it('renders a static callout without a live role by default, so it never interrupts a screen reader', async () => {
    let alert = attributes(await renderToString(<Alert>Invoices are numbered per year.</Alert>), 'slot:alert')

    assert.equal(alert.has('role'), false)
    assert.equal(alert.get('data-variant'), 'default')
  })

  it('announces a destructive alert at once, with role="alert"', async () => {
    let alert = attributes(await renderToString(<Alert variant="destructive">Payment failed.</Alert>), 'slot:alert')

    assert.equal(alert.get('role'), 'alert')
    assert.equal(alert.get('data-variant'), 'destructive')
  })

  it('picks the role by the urgency you set with live', async () => {
    let roles = []
    for (let node of [
      <Alert live="polite">Saved.</Alert>,
      <Alert live="assertive">Session ends in one minute.</Alert>,
      <Alert variant="destructive" live="off">
        This invoice was voided.
      </Alert>,
    ]) {
      roles.push(attributes(await renderToString(node), 'slot:alert').get('role'))
    }

    assert.deepEqual(roles, ['status', 'alert', undefined])
  })

  it('keeps a role the caller passes', async () => {
    let alert = attributes(await renderToString(<Alert role="note">Draft</Alert>), 'slot:alert')

    assert.equal(alert.get('role'), 'note')
  })

  it('renders the title, description and action parts in order', async () => {
    let html = await renderToString(
      <Alert>
        <AlertTitle>Reminder scheduled</AlertTitle>
        <AlertDescription>Acme Labs gets a reminder on 4 November.</AlertDescription>
        <AlertAction>
          <button type="button">Undo</button>
        </AlertAction>
      </Alert>,
    )

    assert.deepEqual(
      tags(html, 'div').map((tag) => tag.attributes.get('data-slot')),
      ['alert', 'alert-title', 'alert-description', 'alert-action'],
    )
    assert.equal(text(html), 'Reminder scheduledAcme Labs gets a reminder on 4 November.Undo')
  })

  it('renders the title as a native heading when you give it a level', async () => {
    let html = await renderToString(<AlertTitle level={2}>Payment failed</AlertTitle>)

    assert.equal(attributes(html, 'h2').get('data-slot'), 'alert-title')
    assert.deepEqual(tags(html, 'div'), [])
  })
})
