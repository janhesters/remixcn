import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { Toaster, toast } from './sonner.tsx'

/** Reads the attributes of the first tag with this name. */
function attributes(html: string, tag: string) {
  let source = new RegExp(`<${tag}(\\s[^>]*)?>`).exec(html)?.[1] ?? ''
  return new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']))
}

describe('Sonner on the server', () => {
  it("renders Sonner's region: bottom right, named with its Alt+T hotkey, with empty live regions", async () => {
    let html = await renderToString(<Toaster />)
    let region = attributes(html, 'section')

    assert.equal(region.get('data-slot'), 'toast-viewport')
    assert.ok(region.has('data-sonner-toaster'))
    assert.equal(region.get('data-position'), 'bottom-end')
    assert.equal(region.get('aria-label'), 'Notifications (Alt+T)')
    assert.equal(region.has('data-theme'), false)
    assert.match(html, /<div role="status" aria-live="polite" aria-atomic="false"><\/div>/)
  })

  it("maps Sonner's positions to sides that follow the text direction, and reads its theme, label and hotkey", async () => {
    let cases = [
      ['top-left', 'top-start'],
      ['top-center', 'top-center'],
      ['top-right', 'top-end'],
      ['bottom-left', 'bottom-start'],
      ['bottom-center', 'bottom-center'],
      ['bottom-right', 'bottom-end'],
    ] as const

    for (let [position, side] of cases) {
      let region = attributes(await renderToString(<Toaster position={position} />), 'section')
      assert.equal(region.get('data-position'), side, position)
    }

    let region = attributes(
      await renderToString(<Toaster theme="dark" dir="rtl" containerAriaLabel="Alerts" hotkey={['ctrlKey', 'KeyN']} />),
      'section',
    )
    assert.equal(region.get('data-theme'), 'dark')
    assert.equal(region.get('dir'), 'rtl')
    assert.equal(region.get('aria-label'), 'Alerts (Ctrl+N)')
  })

  it('keeps no toast on the server: toast() throws without a mounted Toaster', async () => {
    await renderToString(<Toaster />)

    assert.throws(() => toast('Event has been created'), /No ToastProvider is mounted/)
    assert.throws(() => toast.success('Saved', { toasterId: 'side' }), /No ToastProvider is mounted/)
    assert.equal(toast.dismiss(), undefined)
  })
})
