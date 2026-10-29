import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { Button, buttonSizes, buttonVariantNames, buttonVariants } from './button.tsx'

/** Reads the attributes of the first tag with this name. */
function attributes(html: string, tag: string) {
  let source = new RegExp(`<${tag}(\\s[^>]*)?>`).exec(html)?.[1] ?? ''
  return new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']))
}

describe('Button', () => {
  it('renders a native button that never submits a form by accident', async () => {
    let button = attributes(await renderToString(<Button>Preview</Button>), 'button')

    assert.equal(button.get('type'), 'button')
    assert.equal(button.get('data-slot'), 'button')
    assert.equal(button.get('data-variant'), 'default')
    assert.equal(button.get('data-size'), 'default')
  })

  it('keeps an explicit submit or reset type, and the submitter name and value', async () => {
    let html = await renderToString(
      <form>
        <Button type="submit" name="intent" value="send" formAction="/reminders/send" formNoValidate>
          Send
        </Button>
        <Button type="reset">Clear</Button>
      </form>,
    )
    let [submit, reset] = html.split('</button>').map((part) => attributes(part, 'button'))

    assert.equal(submit.get('type'), 'submit')
    assert.equal(submit.get('name'), 'intent')
    assert.equal(submit.get('value'), 'send')
    assert.equal(submit.get('formaction'), '/reminders/send')
    assert.ok(submit.has('formnovalidate'))
    assert.equal(reset.get('type'), 'reset')
  })

  it('passes ARIA, data, id, form and class attributes to the native button', async () => {
    let button = attributes(
      await renderToString(
        <Button size="icon" aria-label="Add invoice" id="add" form="invoice" class="toolbar-button" data-test="add">
          +
        </Button>,
      ),
      'button',
    )

    assert.equal(button.get('aria-label'), 'Add invoice')
    assert.equal(button.get('id'), 'add')
    assert.equal(button.get('form'), 'invoice')
    assert.equal(button.get('data-test'), 'add')
    assert.ok(button.get('class')?.split(' ').includes('toolbar-button'), button.get('class'))
  })

  it('disables natively on the server, also when it should keep focus once hydrated', async () => {
    for (let node of [
      <Button disabled>Archive</Button>,
      <Button disabled focusableWhenDisabled type="submit">
        Saving
      </Button>,
    ]) {
      let button = attributes(await renderToString(node), 'button')

      assert.ok(button.has('disabled'))
      assert.equal(button.has('aria-disabled'), false)
    }
  })

  it('disables an aria-disabled button natively on the server, so it never submits before it runs in the browser', async () => {
    let button = attributes(
      await renderToString(
        <Button type="submit" aria-disabled="true">
          Pay
        </Button>,
      ),
      'button',
    )

    assert.ok(button.has('disabled'))
    assert.equal(button.get('aria-disabled'), 'true')
  })

  it('renders one rule per variant and size, in the rmx layer', async () => {
    let html = await renderToString(
      <html>
        <head />
        <body>
          {buttonVariantNames.flatMap((variant) =>
            buttonSizes.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {variant} {size}
              </Button>
            )),
          )}
        </body>
      </html>,
    )

    let rules = [...html.matchAll(/<style data-rmx-style="([^"]+)">(.*?)<\/style>/gs)]
    assert.equal(rules.length, buttonVariantNames.length * buttonSizes.length)
    for (let [, selector, rule] of rules) assert.ok(rule.startsWith(`@layer rmx.${selector} {`), rule)
  })

  it('gives a native link the button styles without changing its role', async () => {
    let html = await renderToString(
      <a href="/invoices" mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Invoices
      </a>,
    )
    let link = attributes(html, 'a')

    assert.equal(link.get('href'), '/invoices')
    assert.equal(link.get('data-slot'), 'button')
    assert.equal(link.get('data-variant'), 'outline')
    assert.equal(link.get('data-size'), 'sm')
    assert.equal(link.has('role'), false)
    assert.equal(link.has('type'), false)
    assert.ok(link.get('class'), html)
  })

  it('shares one rule between a Button and a link of the same variant and size', async () => {
    let html = await renderToString(
      <html>
        <head />
        <body>
          <Button variant="ghost">Cancel</Button>
          <a href="/" mix={buttonVariants({ variant: 'ghost' })}>
            Home
          </a>
        </body>
      </html>,
    )

    assert.equal(attributes(html, 'button').get('class'), attributes(html, 'a').get('class'))
  })
})
