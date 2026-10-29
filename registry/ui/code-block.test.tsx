import { renderToString } from 'remix/component/server'
import { unsafeHTML } from 'remix/component'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
  codeBlockLineVariantNames,
  splitCodeLines,
  splitTokenLines,
} from './code-block.tsx'
import type { CodeBlockToken } from './code-block.tsx'

// The server puts the css() rules in <style> tags first. Tests read the markup after them.
async function markup(node: JSX.Element) {
  return (await renderToString(node)).replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/^<head><\/head>/, '')
}

/** Reads the attributes of every tag with this data-slot, in document order. */
function slots(html: string, slot: string) {
  return [...html.matchAll(new RegExp(`<[a-z]+\\s[^>]*data-slot="${slot}"[^>]*>`, 'g'))].map(
    ([tag]) => new Map([...tag.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ''])),
  )
}

function slot(html: string, name: string) {
  let [found] = slots(html, name)
  assert.ok(found, `no data-slot="${name}" in ${html}`)
  return found
}

/** Reads the text of each line, with the entities the server wrote decoded. */
function lineTexts(html: string) {
  return [...html.matchAll(/data-slot="code-block-line-content"[^>]*>/g)].map((match) => {
    // Reads up to the span that closes the line content, past the token spans inside it.
    let rest = html.slice(match.index + match[0].length)
    let depth = 0
    for (let tag of rest.matchAll(/<(\/?)span\b[^>]*>/g)) {
      if (tag[1] === '') depth++
      else if (depth-- === 0) return decode(rest.slice(0, tag.index).replace(/<[^>]+>/g, ''))
    }
    throw new Error(`unclosed line in ${html}`)
  })
}

function decode(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

const malicious = `<script>alert("owned")</script>
<img src=x onerror="alert('owned')">
&amp; ${'${'}document.cookie}`

describe('CodeBlock', () => {
  it('renders every part with its data-slot, and the default variant and size', async () => {
    let html = await markup(
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>Terminal</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value="bun install" />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent>bun install</CodeBlockContent>
        <CodeBlockFooter>Done</CodeBlockFooter>
      </CodeBlock>,
    )
    let root = slot(html, 'code-block')

    assert.equal(root.get('data-variant'), 'default')
    assert.equal(root.get('data-size'), 'default')
    for (let name of [
      'code-block-header',
      'code-block-title',
      'code-block-actions',
      'code-block-copy-button',
      'code-block-content',
      'code-block-code',
      'code-block-footer',
    ]) {
      slot(html, name)
    }
  })

  it('takes the destructive variant and the small size', async () => {
    let root = slot(
      await markup(
        <CodeBlock variant="destructive" size="sm">
          <CodeBlockContent>Error</CodeBlockContent>
        </CodeBlock>,
      ),
      'code-block',
    )

    assert.equal(root.get('data-variant'), 'destructive')
    assert.equal(root.get('data-size'), 'sm')
  })

  it('passes ids, classes, ARIA and data attributes to each part', async () => {
    let html = await markup(
      <CodeBlock id="install" class="docs-block" aria-label="Install" data-test="root">
        <CodeBlockHeader data-test="header">
          <CodeBlockTitle id="install-title">Terminal</CodeBlockTitle>
        </CodeBlockHeader>
        <CodeBlockContent id="install-code" aria-labelledby="install-title">
          bun install
        </CodeBlockContent>
      </CodeBlock>,
    )
    let root = slot(html, 'code-block')
    let content = slot(html, 'code-block-content')

    assert.equal(root.get('id'), 'install')
    assert.ok(root.get('class')?.split(' ').includes('docs-block'), root.get('class'))
    assert.equal(root.get('aria-label'), 'Install')
    assert.equal(root.get('data-test'), 'root')
    assert.equal(slot(html, 'code-block-header').get('data-test'), 'header')
    assert.equal(content.get('id'), 'install-code')
    assert.equal(content.get('aria-labelledby'), 'install-title')
  })
})

describe('CodeBlockContent', () => {
  it('renders the code as text in a focusable, left-to-right pre and code', async () => {
    let html = await markup(<CodeBlockContent>{'let total = 42'}</CodeBlockContent>)
    let pre = slot(html, 'code-block-content')

    assert.match(html, /^<pre\s/)
    assert.match(html, /<code\s[^>]*data-slot="code-block-code"[^>]*>let total = 42<\/code>/)
    assert.equal(pre.get('dir'), 'ltr')
    assert.equal(pre.get('tabindex'), '0')
    assert.equal(pre.has('data-numbered'), false)
    assert.equal(pre.has('data-wrap'), false)
  })

  it('escapes markup in the code, so it renders as text and never runs', async () => {
    for (let node of [
      <CodeBlockContent>{malicious}</CodeBlockContent>,
      <CodeBlockContent lineNumbers>{malicious}</CodeBlockContent>,
      <CodeBlockContent>
        <CodeBlockLine tokens={[{ text: malicious }]} />
      </CodeBlockContent>,
    ]) {
      let html = await markup(node)

      assert.equal(/<script|<img/i.test(html), false, html)
      assert.ok(html.includes('&lt;script&gt;'), html)
      assert.ok(html.includes('&amp;amp;'), html)
    }
  })

  it('offers no raw HTML path, even when a caller passes innerHTML', async () => {
    let raw = { innerHTML: unsafeHTML('<b data-raw>bold</b>') } as object
    let html = await markup(
      <CodeBlockContent {...raw}>
        <CodeBlockLine {...raw}>plain</CodeBlockLine>
      </CodeBlockContent>,
    )

    assert.equal(html.includes('data-raw'), false, html)
    assert.deepEqual(lineTexts(html), ['plain\n'])
  })

  it('splits a string into numbered lines, keeps blank lines and drops one trailing newline', async () => {
    let html = await markup(<CodeBlockContent lineNumbers>{'first\n\n  third\n\n'}</CodeBlockContent>)

    assert.ok(slot(html, 'code-block-content').has('data-numbered'))
    assert.deepEqual(lineTexts(html), ['first\n', '\n', '  third\n', '\n'])
  })

  it('shows Windows and old Mac line endings as line breaks', async () => {
    let html = await markup(<CodeBlockContent lineNumbers>{'one\r\ntwo\rthree'}</CodeBlockContent>)
    let plain = await markup(<CodeBlockContent>{'one\r\ntwo'}</CodeBlockContent>)

    assert.deepEqual(lineTexts(html), ['one\n', 'two\n', 'three\n'])
    assert.ok(plain.includes('>one\ntwo</code>'), plain)
  })

  it('numbers lines from startLine with a counter, so the numbers stay out of the text', async () => {
    let html = await markup(
      <CodeBlockContent lineNumbers startLine={995}>
        {'a\nb'}
      </CodeBlockContent>,
    )

    assert.match(slot(html, 'code-block-content').get('style') ?? '', /counter-reset: line 994/)
    assert.deepEqual(lineTexts(html), ['a\n', 'b\n'])
    assert.equal(html.includes('995'), false, html)
  })

  it('ignores a startLine that is not a whole number', async () => {
    for (let startLine of [Number.NaN, Infinity, 2.7]) {
      let html = await markup(
        <CodeBlockContent lineNumbers startLine={startLine}>
          a
        </CodeBlockContent>,
      )

      assert.match(slot(html, 'code-block-content').get('style') ?? '', /counter-reset: line (0|1);/)
    }
  })

  it('keeps the caller style beside the line counter', async () => {
    let html = await markup(
      <CodeBlockContent lineNumbers style={{ maxHeight: '12rem' }}>
        a
      </CodeBlockContent>,
    )
    let style = slot(html, 'code-block-content').get('style') ?? ''

    assert.match(style, /counter-reset: line 0/)
    assert.match(style, /max-height: 12rem/)
  })

  it('marks wrapping, and lets a caller remove the tab stop', async () => {
    let pre = slot(
      await markup(
        <CodeBlockContent wrap tabIndex={-1}>
          a
        </CodeBlockContent>,
      ),
      'code-block-content',
    )

    assert.ok(pre.has('data-wrap'))
    assert.equal(pre.get('tabindex'), '-1')
  })

  it('renders an empty block as an empty code element', async () => {
    let html = await markup(<CodeBlockContent>{''}</CodeBlockContent>)

    assert.match(html, /<code\s[^>]*data-slot="code-block-code"[^>]*><\/code>/)
  })
})

describe('CodeBlockLine', () => {
  it('renders each variant', async () => {
    let html = await markup(
      <CodeBlockContent>
        {codeBlockLineVariantNames.map((variant) => (
          <CodeBlockLine variant={variant}>{variant}</CodeBlockLine>
        ))}
      </CodeBlockContent>,
    )

    assert.deepEqual(
      slots(html, 'code-block-line').map((line) => line.get('data-variant')),
      ['default', 'added', 'removed', 'highlighted'],
    )
    assert.deepEqual(lineTexts(html), ['default\n', 'added\n', 'removed\n', 'highlighted\n'])
  })

  it('ends with a newline, and holds only that when it is empty, so a copied selection keeps blank lines', async () => {
    let html = await markup(
      <CodeBlockContent>
        <CodeBlockLine />
        <CodeBlockLine>{''}</CodeBlockLine>
        <CodeBlockLine>{[]}</CodeBlockLine>
        <CodeBlockLine tokens={[]} />
        <CodeBlockLine tokens={[{ text: '' }]} />
      </CodeBlockContent>,
    )

    assert.deepEqual(lineTexts(html), ['\n', '\n', '\n', '\n', '\n'])
  })

  it('renders caller tokens as text spans with their colors', async () => {
    let tokens: CodeBlockToken[] = [
      { text: 'const', color: '#cf222e' },
      { text: ' total = ' },
      { text: '42', color: 'light-dark(#0550ae, #79c0ff)' },
      { text: ';', color: 'var(--muted-foreground)' },
    ]
    let html = await markup(<CodeBlockLine tokens={tokens} />)
    let spans = slots(html, 'code-block-token')

    assert.deepEqual(lineTexts(html), ['const total = 42;\n'])
    assert.deepEqual(
      spans.map((span) => span.get('style')),
      ['color: #cf222e;', undefined, 'color: light-dark(#0550ae, #79c0ff);', 'color: var(--muted-foreground);'],
    )
  })

  it('accepts the CSS color functions a highlighter writes', async () => {
    for (let color of ['rgb(36 41 47)', 'rgba(36, 41, 47, 0.8)', 'oklch(0.55 0.2 27 / 90%)', 'hsl(210deg 12% 16%)']) {
      let [span] = slots(await markup(<CodeBlockLine tokens={[{ text: 'x', color }]} />), 'code-block-token')

      assert.equal(span.get('style'), `color: ${color};`)
    }
  })

  it('drops a token color that could add other styles or load a URL, and keeps its text', async () => {
    for (let color of [
      'red; background-image: url(https://tracker.example/pixel)',
      'url(https://tracker.example/pixel)',
      'var(--x); position: fixed',
      'rgb(0 0 0) } body { display: none',
      'expression(alert(1))',
      'light-dark(#fff, url(x))',
      '"#fff"',
    ]) {
      let html = await markup(<CodeBlockLine tokens={[{ text: 'value', color }]} />)
      let [span] = slots(html, 'code-block-token')

      assert.equal(span.has('style'), false, color)
      assert.deepEqual(lineTexts(html), ['value\n'])
    }
  })
})

describe('CodeBlockCopyButton on the server', () => {
  it('is a disabled ghost icon button named Copy until it runs in the browser', async () => {
    let html = await markup(<CodeBlockCopyButton value="bun install" />)
    let button = slot(html, 'code-block-copy-button')

    assert.match(html, /^<button\s/)
    assert.equal(button.get('type'), 'button')
    assert.ok(button.has('disabled'))
    assert.equal(button.get('aria-label'), 'Copy')
    assert.equal(button.get('data-variant'), 'ghost')
    assert.equal(button.get('data-size'), 'icon-xs')
    assert.equal(button.has('data-copied'), false)
    assert.equal(button.has('data-copy-failed'), false)
  })

  it('renders an empty status beside the button for the copy result', async () => {
    let html = await markup(<CodeBlockCopyButton value="bun install" />)
    let status = slot(html, 'code-block-copy-status')

    assert.equal(status.get('role'), 'status')
    assert.match(html, /data-slot="code-block-copy-status"[^>]*><\/span>/)
  })

  it('never becomes a submit or reset button, so it never sends a form', async () => {
    let props = { type: 'submit' } as object
    let button = slot(await markup(<CodeBlockCopyButton value="x" {...props} />), 'code-block-copy-button')

    assert.equal(button.get('type'), 'button')
  })

  it('takes a name for what it copies and the Button look', async () => {
    let button = slot(
      await markup(<CodeBlockCopyButton value="x" aria-label="Copy install command" variant="outline" size="sm" />),
      'code-block-copy-button',
    )

    assert.equal(button.get('aria-label'), 'Copy install command')
    assert.equal(button.get('data-variant'), 'outline')
    assert.equal(button.get('data-size'), 'sm')
  })
})

describe('splitCodeLines', () => {
  it('splits on every line ending and drops one trailing newline', () => {
    assert.deepEqual(splitCodeLines('a\r\nb\rc\n\nd\n'), ['a', 'b', 'c', '', 'd'])
    assert.deepEqual(splitCodeLines('a\n\n'), ['a', ''])
    assert.deepEqual(splitCodeLines(''), [''])
    assert.deepEqual(splitCodeLines('\n'), [''])
  })
})

describe('splitTokenLines', () => {
  it('splits tokens at newlines into lines and keeps each piece in its color', () => {
    let lines = splitTokenLines([
      { text: 'const a', color: '#cf222e' },
      { text: ' = 1\n\nconst b', color: '#0550ae' },
      { text: ' = 2\r\n' },
    ])

    assert.deepEqual(lines, [
      [
        { text: 'const a', color: '#cf222e' },
        { text: ' = 1', color: '#0550ae' },
      ],
      [],
      [{ text: 'const b', color: '#0550ae' }, { text: ' = 2' }],
    ])
  })

  it('counts a Windows line ending split across tokens as one break, and keeps each side in its color', () => {
    assert.deepEqual(
      splitTokenLines([
        { text: 'a\r', color: '#123' },
        { text: '\nb', color: '#456' },
      ]),
      [[{ text: 'a', color: '#123' }], [{ text: 'b', color: '#456' }]],
    )
    assert.deepEqual(
      splitTokenLines([{ text: 'a\r', color: '#123' }, { text: '' }, { text: '\n' }, { text: 'b', color: '#456' }]),
      [[{ text: 'a', color: '#123' }], [{ text: 'b', color: '#456' }]],
    )
  })

  it('still reads a carriage return before a token on the next line as a break', () => {
    assert.deepEqual(
      splitTokenLines([
        { text: 'a\r', color: '#123' },
        { text: 'b', color: '#456' },
      ]),
      [[{ text: 'a', color: '#123' }], [{ text: 'b', color: '#456' }]],
    )
  })

  it('numbers the lines of split Windows line endings like the same code as a string', async () => {
    let tokens = [
      { text: 'let a = 1\r', color: '#123' },
      { text: '\nlet b = 2', color: '#456' },
    ]
    let html = await markup(
      <CodeBlockContent lineNumbers>
        {splitTokenLines(tokens).map((line) => (
          <CodeBlockLine tokens={line} />
        ))}
      </CodeBlockContent>,
    )
    let plain = await markup(
      <CodeBlockContent lineNumbers>{tokens.map((token) => token.text).join('')}</CodeBlockContent>,
    )

    assert.deepEqual(lineTexts(html), lineTexts(plain))
    assert.deepEqual(
      slots(html, 'code-block-token').map((token) => token.get('style')),
      ['color: #123;', 'color: #456;'],
    )
  })

  it('returns one empty line for no tokens', () => {
    assert.deepEqual(splitTokenLines([]), [[]])
  })
})
