import * as assert from 'remix/assert'
import { renderToStream } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { Snippet } from './ui.tsx'

// Resolves client entries as the render middleware does, so the props travel
// to the browser in the page's JSON, as they do on the site.
async function render(node: JSX.Element) {
  let stream = renderToStream(node, {
    resolveClientEntry: (entryId, component) => ({
      href: `/assets/${entryId.split('#')[0]!.split('/').at(-1)}`,
      exportName: entryId.split('#')[1] || component.name,
    }),
  })
  return new Response(stream).text()
}

const hostile = '</script><script>window.pwned = true</script>\n<img src=x onerror="alert(1)">\n<!-- -->&amp;'

describe('Snippet', () => {
  it('renders hostile code as text, in the pane and in the props the browser hydrates', async () => {
    let html = await render(
      <html>
        <body>
          <Snippet title="Untrusted" code={hostile} label="the untrusted code" />
        </body>
      </html>,
    )

    assert.doesNotMatch(html, /<script>window\.pwned/)
    assert.doesNotMatch(html, /<img src=x/)
    assert.match(html, /&lt;\/script&gt;&lt;script&gt;window\.pwned = true&lt;\/script&gt;/)

    let data = /<script type="application\/json" id="rmx-data">([\s\S]*?)<\/script>/.exec(html)?.[1]
    assert.ok(data, 'the page carries the client entry props')
    assert.ok(JSON.stringify(JSON.parse(data)).includes(JSON.stringify(hostile)), 'the props keep the code exactly')
  })
})
