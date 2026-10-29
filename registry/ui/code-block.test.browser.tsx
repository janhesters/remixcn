import { css, on, ref } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
  codeBlockCopiedDuration,
} from './code-block.tsx'

// Browser tests run without theme.css, so the tokens the layout reads are set here.
const tokens = css({
  '--spacing': '0.25rem',
  '--text-sm': '0.875rem',
  '--text-sm--line-height': '1.4285',
  '--text-xs': '0.75rem',
  '--text-xs--line-height': '1.3333',
  '--font-mono': 'monospace',
})

function mount(t: TestContext, node: RemixNode) {
  let errors: unknown[] = []
  let result = render(<div mix={tokens}>{node}</div>)
  result.root.addEventListener('error', (event) => errors.push(event.error))
  t.after(result.cleanup)
  return { ...result, errors }
}

interface Write {
  text: string
  resolve: () => void
  reject: (error: unknown) => void
}

/** Replaces the clipboard's writeText with one whose answer the test gives. */
function holdClipboard(t: TestContext) {
  let writes: Write[] = []
  t.mock.method(
    navigator.clipboard,
    'writeText',
    (text: string) => new Promise<void>((resolve, reject) => writes.push({ text, resolve, reject })),
  )
  return writes
}

// The clipboard answers in a promise, and the button updates after it.
async function settle(act: (fn: () => unknown) => Promise<void>, answer?: () => void) {
  await act(async () => {
    answer?.()
    for (let turn = 0; turn < 10; turn++) await Promise.resolve()
  })
}

function copyButton(container: HTMLElement, index = 0) {
  let button = container.querySelectorAll<HTMLButtonElement>('[data-slot="code-block-copy-button"]')[index]
  assert.ok(button, `no copy button ${index}`)
  return button
}

function statusOf(container: HTMLElement, index = 0) {
  return container.querySelectorAll('[data-slot="code-block-copy-status"]')[index]?.textContent
}

const source = 'line one\r\n\r\n\tindented\n\n\nlast line\n'

describe('CodeBlockCopyButton in the browser', () => {
  it('runs once it is in the browser, then copies the exact value', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value={source} />)
    await settle(act)
    let button = copyButton(container)

    assert.equal(button.disabled, false)
    await act(() => button.click())

    assert.deepEqual(
      writes.map((write) => write.text),
      [source],
    )
  })

  it('shows that it copied only after the clipboard confirms the write', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="bun install" />)
    await settle(act)
    let button = copyButton(container)

    await act(() => button.click())
    assert.equal(button.getAttribute('aria-label'), 'Copy')
    assert.equal(button.hasAttribute('data-copied'), false)
    assert.equal(statusOf(container), '')

    await settle(act, () => writes[0].resolve())
    assert.equal(button.getAttribute('aria-label'), 'Copied')
    assert.ok(button.hasAttribute('data-copied'))
    assert.equal(statusOf(container), 'Copied')
  })

  it('says so when the browser refuses the copy', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="bun install" />)
    await settle(act)
    let button = copyButton(container)

    await act(() => button.click())
    await settle(act, () => writes[0].reject(new DOMException('Write permission denied.', 'NotAllowedError')))

    assert.equal(button.getAttribute('aria-label'), "Couldn't copy")
    assert.ok(button.hasAttribute('data-copy-failed'))
    assert.equal(button.hasAttribute('data-copied'), false)
    assert.equal(statusOf(container), "Couldn't copy")
  })

  it('says so when the page has no clipboard, such as on plain http', async (t) => {
    t.mock.method(navigator.clipboard, 'writeText', () => {
      throw new TypeError('navigator.clipboard is undefined')
    })
    let { container, act, errors } = mount(t, <CodeBlockCopyButton value="bun install" />)
    await settle(act)

    await act(() => copyButton(container).click())
    await settle(act)

    assert.equal(statusOf(container), "Couldn't copy")
    assert.deepEqual(errors, [])
  })

  it('takes its own labels', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(
      t,
      <CodeBlockCopyButton value="x" aria-label="نسخ" copiedLabel="تم النسخ" failedLabel="تعذّر النسخ" />,
    )
    await settle(act)
    let button = copyButton(container)
    assert.equal(button.getAttribute('aria-label'), 'نسخ')

    await act(() => button.click())
    await settle(act, () => writes[0].resolve())
    assert.equal(statusOf(container), 'تم النسخ')

    await act(() => button.click())
    await settle(act, () => writes[1].reject(new Error('denied')))
    assert.equal(statusOf(container), 'تعذّر النسخ')
  })

  it('goes back to Copy after two seconds', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="x" />)
    await settle(act)
    let timers = t.useFakeTimers()
    let button = copyButton(container)

    await act(() => button.click())
    await settle(act, () => writes[0].resolve())
    await act(() => timers.advance(codeBlockCopiedDuration - 1))
    assert.equal(statusOf(container), 'Copied')

    await act(() => timers.advance(1))
    assert.equal(button.getAttribute('aria-label'), 'Copy')
    assert.equal(button.hasAttribute('data-copied'), false)
    assert.equal(statusOf(container), '')
  })

  it('clears the last status before each copy, so a second copy is announced again', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="x" />)
    await settle(act)
    let status = container.querySelector('[data-slot="code-block-copy-status"]')!
    let seen: string[] = []
    new MutationObserver(() => seen.push(status.textContent ?? '')).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    await act(() => copyButton(container).click())
    await settle(act, () => writes[0].resolve())
    await act(() => copyButton(container).click())
    await settle(act, () => writes[1].resolve())

    assert.deepEqual(
      seen.filter((text, index) => text !== seen[index - 1]),
      ['Copied', '', 'Copied'],
    )
  })

  it('copies the value it has when clicked, and drops a copied state when the value changes', async (t) => {
    let writes = holdClipboard(t)
    let { container, act, root } = mount(t, <CodeBlockCopyButton value="first" />)
    await settle(act)
    let timers = t.useFakeTimers()

    await act(() => copyButton(container).click())
    await settle(act, () => writes[0].resolve())
    assert.equal(statusOf(container), 'Copied')

    root.render(
      <div mix={tokens}>
        <CodeBlockCopyButton value="second" />
      </div>,
    )
    root.flush()
    assert.equal(statusOf(container), '')
    assert.equal(copyButton(container).getAttribute('aria-label'), 'Copy')

    // The old timer no longer runs, so it can't end the next copied state early.
    await act(() => copyButton(container).click())
    await settle(act, () => writes[1].resolve())
    await act(() => timers.advance(codeBlockCopiedDuration - 1))
    assert.equal(statusOf(container), 'Copied')
    assert.deepEqual(
      writes.map((write) => write.text),
      ['first', 'second'],
    )
  })

  it('ignores a late answer for a value that changed while it waited', async (t) => {
    let writes = holdClipboard(t)
    let { container, act, root } = mount(t, <CodeBlockCopyButton value="first" />)
    await settle(act)

    await act(() => copyButton(container).click())
    root.render(
      <div mix={tokens}>
        <CodeBlockCopyButton value="second" />
      </div>,
    )
    root.flush()
    await settle(act, () => writes[0].resolve())

    assert.equal(statusOf(container), '')
    assert.equal(copyButton(container).hasAttribute('data-copied'), false)
  })

  it('ignores a late answer for an earlier click', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="x" />)
    await settle(act)

    await act(() => copyButton(container).click())
    await act(() => copyButton(container).click())
    await settle(act, () => writes[1].reject(new Error('denied')))
    await settle(act, () => writes[0].resolve())

    assert.equal(statusOf(container), "Couldn't copy")
  })

  it('cancels its timer when it is removed, and a late answer changes nothing', async (t) => {
    let writes = holdClipboard(t)
    let { container, act, root, errors } = mount(
      t,
      <>
        <CodeBlockCopyButton value="a" />
        <CodeBlockCopyButton value="b" />
      </>,
    )
    await settle(act)
    let timers = t.useFakeTimers()
    let cleared: unknown[] = []
    let clearTimeout = window.clearTimeout
    t.mock.method(window, 'clearTimeout', (id: number) => {
      cleared.push(id)
      clearTimeout(id)
    })
    let started: unknown[] = []
    let setTimeout = window.setTimeout
    t.mock.method(window, 'setTimeout', (callback: () => void, delay: number) => {
      let id = setTimeout(callback, delay)
      if (delay === codeBlockCopiedDuration) started.push(id)
      return id
    })

    await act(() => copyButton(container, 0).click())
    await act(() => copyButton(container, 1).click())
    await settle(act, () => writes[0].resolve())
    assert.equal(started.length, 1)

    root.render(<div mix={tokens} />)
    root.flush()
    assert.ok(cleared.includes(started[0]), 'the copied timer was not cleared')

    await settle(act, () => writes[1].resolve())
    await act(() => timers.advance(codeBlockCopiedDuration))
    assert.equal(started.length, 1)
    assert.deepEqual(errors, [])
  })

  it('keeps its state apart from another copy button', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(
      t,
      <>
        <CodeBlockCopyButton value="install" />
        <CodeBlockCopyButton value="build" />
      </>,
    )
    await settle(act)

    await act(() => copyButton(container, 1).click())
    await settle(act, () => writes[0].resolve())

    assert.deepEqual(
      writes.map((write) => write.text),
      ['build'],
    )
    assert.equal(statusOf(container, 0), '')
    assert.equal(statusOf(container, 1), 'Copied')
  })

  it('never submits or resets the form it sits in', async (t) => {
    holdClipboard(t)
    let submits = 0
    let resets = 0
    let { container, act } = mount(
      t,
      <form
        mix={[
          on('submit', (event) => {
            event.preventDefault()
            submits++
          }),
          on('reset', () => void resets++),
        ]}
      >
        <input name="customer" defaultValue="Acme Labs" />
        <CodeBlockCopyButton value="x" />
      </form>,
    )
    await settle(act)

    await act(() => copyButton(container).click())

    assert.equal(submits, 0)
    assert.equal(resets, 0)
    assert.equal(copyButton(container).type, 'button')
  })

  it("runs the caller's mixins on the native button first, so a click handler can cancel the copy", async (t) => {
    let writes = holdClipboard(t)
    let node: HTMLButtonElement | undefined
    let cancel = true
    let { container, act } = mount(
      t,
      <CodeBlockCopyButton
        value="x"
        mix={[
          ref((element) => (node = element)),
          on('click', (event) => {
            if (cancel) event.preventDefault()
          }),
        ]}
      />,
    )
    await settle(act)

    await act(() => copyButton(container).click())
    assert.equal(node, copyButton(container))
    assert.equal(writes.length, 0)

    cancel = false
    await act(() => copyButton(container).click())
    assert.equal(writes.length, 1)
  })

  it('copies nothing while disabled', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(t, <CodeBlockCopyButton value="x" disabled />)
    await settle(act)

    await act(() => copyButton(container).click())

    assert.ok(copyButton(container).disabled)
    assert.equal(writes.length, 0)
  })
})

/** Returns what a reader gets when they select the code and copy it. */
function selectedText(element: Element) {
  let selection = getSelection()!
  selection.selectAllChildren(element)
  let text = selection.toString()
  selection.removeAllRanges()
  return text
}

describe('CodeBlockContent in the browser', () => {
  it('keeps line numbers and diff markers out of a selection, and keeps blank lines in it', async (t) => {
    let { container } = mount(
      t,
      <CodeBlock>
        <CodeBlockContent lineNumbers>
          <CodeBlockLine>const total = 1</CodeBlockLine>
          <CodeBlockLine />
          <CodeBlockLine variant="removed">const tax = 0</CodeBlockLine>
          <CodeBlockLine variant="added">const tax = 0.2</CodeBlockLine>
        </CodeBlockContent>
      </CodeBlock>,
    )
    let code = container.querySelector('[data-slot="code-block-code"]')!

    assert.equal(selectedText(code).replace(/\n+$/, ''), 'const total = 1\n\nconst tax = 0\nconst tax = 0.2')
  })

  it('numbers lines with a counter that starts at startLine', async (t) => {
    let { container } = mount(
      t,
      <CodeBlockContent lineNumbers startLine={995}>
        {'a\nb'}
      </CodeBlockContent>,
    )
    let pre = container.querySelector('pre')!
    let line = container.querySelector('[data-slot="code-block-line"]')!

    assert.equal(getComputedStyle(pre).counterReset, 'line 994')
    assert.match(getComputedStyle(line, '::before').content, /^counter\(line\)/)
    assert.equal(getComputedStyle(line).counterIncrement, 'line 1')
  })

  it('scrolls long code inside the block without widening the page', async (t) => {
    let long = `export const invoices = [${Array.from({ length: 40 }, (_, index) => `"INV-${index}"`).join(', ')}]`
    let { container } = mount(
      t,
      <div data-frame style={{ width: '320px' }}>
        <CodeBlock>
          <CodeBlockContent>{long}</CodeBlockContent>
        </CodeBlock>
        <CodeBlock>
          <CodeBlockContent lineNumbers>{`${long}\n${long}`}</CodeBlockContent>
        </CodeBlock>
      </div>,
    )
    let frame = container.querySelector<HTMLElement>('[data-frame]')!

    for (let block of frame.querySelectorAll<HTMLElement>('[data-slot="code-block"]')) {
      let pre = block.querySelector('pre')!
      assert.ok(pre.scrollWidth > pre.clientWidth, 'the code does not scroll')
      assert.ok(block.getBoundingClientRect().width <= 320, 'the block grew past its container')
    }
    assert.ok(frame.scrollWidth <= 320, `the frame scrolls sideways: ${frame.scrollWidth}`)
  })

  it('wraps long code instead when asked', async (t) => {
    let long = `curl https://api.example/v1/invoices?status=open&customer=acme-labs&expand=lines,payments,${'x'.repeat(60)}`
    let { container } = mount(
      t,
      <div style={{ width: '320px' }}>
        <CodeBlock>
          <CodeBlockContent wrap lineNumbers>
            {long}
          </CodeBlockContent>
        </CodeBlock>
      </div>,
    )
    let pre = container.querySelector('pre')!

    assert.ok(pre.scrollWidth <= pre.clientWidth, `the code still scrolls: ${pre.scrollWidth} > ${pre.clientWidth}`)
    assert.ok(container.querySelector('[data-slot="code-block-line"]')!.getBoundingClientRect().height > 40)
  })

  it('is a tab stop, so keyboard users can scroll it', async (t) => {
    let { container } = mount(t, <CodeBlockContent>x</CodeBlockContent>)
    let pre = container.querySelector('pre')!

    pre.focus()

    assert.equal(document.activeElement, pre)
    assert.equal(pre.tabIndex, 0)
  })

  it('reads changing props on every render and keeps its elements', async (t) => {
    let { container, root } = mount(
      t,
      <CodeBlock>
        <CodeBlockContent>{'a\nb'}</CodeBlockContent>
      </CodeBlock>,
    )
    let block = container.querySelector<HTMLElement>('[data-slot="code-block"]')!
    let pre = container.querySelector('pre')!

    root.render(
      <div mix={tokens}>
        <CodeBlock variant="destructive" size="sm">
          <CodeBlockContent wrap lineNumbers startLine={10}>
            {'a\nb\nc'}
          </CodeBlockContent>
        </CodeBlock>
      </div>,
    )
    root.flush()

    assert.equal(container.querySelector('[data-slot="code-block"]'), block)
    assert.equal(container.querySelector('pre'), pre)
    assert.equal(block.dataset.variant, 'destructive')
    assert.equal(block.dataset.size, 'sm')
    assert.ok(pre.hasAttribute('data-wrap'))
    assert.ok(pre.hasAttribute('data-numbered'))
    assert.equal(getComputedStyle(pre).counterReset, 'line 9')
    assert.equal(container.querySelectorAll('[data-slot="code-block-line"]').length, 3)

    root.render(
      <div mix={tokens}>
        <CodeBlock>
          <CodeBlockContent>{'a\nb'}</CodeBlockContent>
        </CodeBlock>
      </div>,
    )
    root.flush()

    assert.equal(pre.hasAttribute('data-wrap'), false)
    assert.equal(pre.hasAttribute('data-numbered'), false)
    assert.equal(container.querySelectorAll('[data-slot="code-block-line"]').length, 0)
    assert.equal(pre.textContent, 'a\nb')
  })

  it('shows changing code, line by line, as it streams', async (t) => {
    let { container, root } = mount(t, <CodeBlockContent lineNumbers>{'const a'}</CodeBlockContent>)
    let first = container.querySelector('[data-slot="code-block-line"]')

    for (let code of ['const a = 1', 'const a = 1\n', 'const a = 1\nconst b']) {
      root.render(
        <div mix={tokens}>
          <CodeBlockContent lineNumbers>{code}</CodeBlockContent>
        </div>,
      )
      root.flush()
    }

    let lines = [...container.querySelectorAll('[data-slot="code-block-line"]')]
    assert.equal(lines[0], first)
    assert.deepEqual(
      lines.map((line) => line.textContent),
      ['const a = 1\n', 'const b\n'],
    )
  })
})

describe('CodeBlockActions in the browser', () => {
  it('float at the top end without a header, and show while focus is inside the block', async (t) => {
    let { container, act } = mount(
      t,
      <CodeBlock>
        <CodeBlockActions>
          <CodeBlockCopyButton value="x" />
        </CodeBlockActions>
        <CodeBlockContent>x</CodeBlockContent>
      </CodeBlock>,
    )
    await settle(act)
    let actions = container.querySelector<HTMLElement>('[data-slot="code-block-actions"]')!

    assert.equal(getComputedStyle(actions).position, 'absolute')
    assert.equal(getComputedStyle(actions).opacity, '0')

    copyButton(container).focus()

    assert.equal(getComputedStyle(actions).opacity, '1')
  })

  it('stay in the header row when there is one', async (t) => {
    let { container } = mount(
      t,
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>Terminal</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value="x" />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent>x</CodeBlockContent>
      </CodeBlock>,
    )
    let actions = container.querySelector<HTMLElement>('[data-slot="code-block-actions"]')!

    assert.equal(getComputedStyle(actions).position, 'static')
    assert.equal(getComputedStyle(actions).opacity, '1')
  })

  it('stay visible after a failed copy, so the alert is seen', async (t) => {
    let writes = holdClipboard(t)
    let { container, act } = mount(
      t,
      <CodeBlock>
        <CodeBlockActions>
          <CodeBlockCopyButton value="x" />
        </CodeBlockActions>
        <CodeBlockContent>x</CodeBlockContent>
      </CodeBlock>,
    )
    await settle(act)
    let actions = container.querySelector<HTMLElement>('[data-slot="code-block-actions"]')!

    await act(() => copyButton(container).click())
    await settle(act, () => writes[0].reject(new Error('denied')))
    copyButton(container).blur()

    assert.equal(getComputedStyle(actions).opacity, '1')
  })
})
