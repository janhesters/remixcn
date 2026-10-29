import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  getMessageScroller,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  watchMessageScrollerScrollable,
  watchMessageScrollerVisibility,
} from './message-scroller.tsx'
import type { MessageScrollerApi, MessageScrollerProviderProps } from './message-scroller.tsx'

// Browser tests run without theme.css, so the frame sets the tokens the parts read.
const frame = '--spacing: 0.25rem; font-size: 16px; line-height: 1;'

interface Row {
  id: string
  // A row without a messageId, such as a "load earlier" row.
  plain?: boolean
  height?: number
  anchor?: boolean
  text?: string
  children?: RemixNode
}

interface ChatProps extends Omit<MessageScrollerProviderProps, 'children'> {
  rows: Row[]
  height?: number
  // Turns the browser's own scroll anchoring off, so only the scroller keeps the place.
  noNativeAnchoring?: boolean
  preserveScrollOnPrepend?: boolean
  gap?: string
  outside?: RemixNode
}

const rows = (count: number, from = 1, options: Partial<Row> = {}): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `m${from + index}`, ...options }))

function Chat(handle: Handle<ChatProps>) {
  return () => {
    let {
      rows,
      height = 200,
      noNativeAnchoring,
      preserveScrollOnPrepend,
      gap = '0px',
      outside,
      ...options
    } = handle.props
    let rowStyle = (row: Row) => (row.height === -1 ? undefined : `height: ${row.height ?? 80}px; overflow: hidden`)
    return (
      <MessageScrollerProvider {...options}>
        <div data-frame style={`height: ${height}px; width: 320px`}>
          <MessageScroller>
            <MessageScrollerViewport
              preserveScrollOnPrepend={preserveScrollOnPrepend}
              style={noNativeAnchoring ? 'overflow-anchor: none' : undefined}
            >
              <MessageScrollerContent style={`gap: ${gap}`}>
                {rows.map((row) => (
                  <MessageScrollerItem
                    key={row.id}
                    messageId={row.plain ? undefined : row.id}
                    scrollAnchor={row.anchor}
                    style={rowStyle(row)}
                  >
                    {row.children ?? row.text ?? row.id}
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
            <MessageScrollerButton direction="start" />
          </MessageScroller>
        </div>
        {outside}
      </MessageScrollerProvider>
    )
  }
}

// Hands the test the provider's API, the way a toolbar inside the provider gets it.
function Commands(handle: Handle<{ onApi: (api: MessageScrollerApi) => void }>) {
  return () => {
    handle.props.onApi(getMessageScroller(handle))
    return null
  }
}

function frames(count = 2) {
  return new Promise<void>((resolve) => {
    let step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)))
    step(count)
  })
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div style={frame}>{node}</div>)
  t.after(result.cleanup)
  let $ = <T extends Element = HTMLElement>(selector: string) => result.container.querySelector(selector) as T
  let parts = {
    root: () => $('[data-slot="message-scroller"]'),
    viewport: () => $('[data-slot="message-scroller-viewport"]'),
    content: () => $('[data-slot="message-scroller-content"]'),
    spacer: () => $('[data-slot="message-scroller-spacer"]'),
    row: (id: string) => $(`[data-message-id="${id}"]`),
    end: () => $<HTMLButtonElement>('[data-slot="message-scroller-button"][data-direction="end"]'),
    start: () => $<HTMLButtonElement>('[data-slot="message-scroller-button"][data-direction="start"]'),
  }
  return {
    ...result,
    ...parts,
    async settle() {
      await frames(2)
      await result.act(() => {})
      await frames(1)
      await result.act(() => {})
    },
    async update(next: RemixNode) {
      result.root.render(<div style={frame}>{next}</div>)
      result.root.flush()
      await this.settle()
    },
    // The row's top inside the visible part of the viewport.
    top(id: string) {
      return Math.round(parts.row(id).getBoundingClientRect().top - parts.viewport().getBoundingClientRect().top)
    },
    max() {
      let viewport = parts.viewport()
      return viewport.scrollHeight - viewport.clientHeight
    },
  }
}

type Mounted = ReturnType<typeof mount>

// Scroll events arrive in the next frame. This waits for the scroller to see one.
function scrollTo(viewport: HTMLElement, top: number) {
  if (Math.abs(viewport.scrollTop - top) < 1) return Promise.resolve()
  return new Promise<void>((resolve) => {
    viewport.addEventListener('scroll', () => resolve(), { once: true })
    viewport.scrollTop = top
  })
}

// A reader turning the wheel: the gesture first, then the scroll it causes.
async function wheelTo(chat: Mounted, top: number) {
  chat.viewport().dispatchEvent(new WheelEvent('wheel', { deltaY: top - chat.viewport().scrollTop, bubbles: true }))
  await scrollTo(chat.viewport(), top)
  await chat.settle()
}

async function until(condition: () => boolean, message: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return
    await wait(10)
  }
  assert.fail(message)
}

// One describe for the whole file: remix test's browser runner lists every
// suite above the next file's frame, and WebKit throttles animation frames in
// a frame pushed below the window, which stalled the files after this one.
describe('Message Scroller in the browser', () => {
  // Opening position
  it('opens at the end, shows the viewport and turns on the start button only', async (t) => {
    let chat = mount(t, <Chat rows={rows(5)} />)
    await chat.settle()

    assert.equal(chat.viewport().scrollTop, 200)
    assert.equal(chat.root().hasAttribute('data-pending-scroll'), false)
    assert.equal(chat.viewport().hasAttribute('data-pending-scroll'), false)
    assert.equal(getComputedStyle(chat.viewport()).visibility, 'visible')
    assert.equal(chat.root().getAttribute('data-scrollable'), 'start')
    assert.equal(chat.viewport().getAttribute('data-scrollable'), 'start')

    assert.equal(chat.end().getAttribute('data-active'), 'false')
    assert.equal(chat.end().inert, true)
    assert.equal(chat.end().tabIndex, -1)
    assert.equal(chat.start().getAttribute('data-active'), 'true')
    assert.equal(chat.start().inert, false)
    assert.equal(chat.start().hasAttribute('tabindex'), false)
  })

  it('opens at the start without hiding the viewport', async (t) => {
    let chat = mount(t, <Chat rows={rows(5)} defaultScrollPosition="start" />)
    assert.equal(chat.viewport().hasAttribute('data-pending-scroll'), false)
    await chat.settle()

    assert.equal(chat.viewport().scrollTop, 0)
    assert.equal(chat.root().getAttribute('data-scrollable'), 'end')
    assert.equal(chat.end().getAttribute('data-active'), 'true')
    assert.equal(chat.start().getAttribute('data-active'), 'false')
  })

  it('opens at the last anchored turn with a peek of the row before it, or at the end when that turn fits', async (t) => {
    let long = mount(
      t,
      <Chat
        defaultScrollPosition="last-anchor"
        rows={[...rows(4), { id: 'q', anchor: true, height: 40 }, { id: 'answer', height: 300 }]}
      />,
    )
    await long.settle()
    assert.equal(long.top('q'), 64)
    assert.equal(long.viewport().hasAttribute('data-pending-scroll'), false)

    let short = mount(
      t,
      <Chat
        defaultScrollPosition="last-anchor"
        rows={[...rows(4), { id: 'q', anchor: true, height: 40 }, { id: 'a' }]}
      />,
    )
    await short.settle()
    assert.equal(short.viewport().scrollTop, short.max())

    let none = mount(t, <Chat defaultScrollPosition="last-anchor" rows={rows(6)} />)
    await none.settle()
    assert.equal(none.viewport().scrollTop, none.max())
  })

  it('shows an empty transcript at once, and opens at the end when rows arrive later', async (t) => {
    let chat = mount(t, <Chat rows={[]} />)
    await chat.settle()
    assert.equal(chat.viewport().hasAttribute('data-pending-scroll'), false)

    await chat.update(<Chat rows={rows(6)} />)
    assert.equal(chat.viewport().scrollTop, 280)
  })

  it('opens again where a changed defaultScrollPosition says', async (t) => {
    let chat = mount(t, <Chat rows={rows(6)} defaultScrollPosition="start" />)
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 0)

    await chat.update(<Chat rows={rows(6)} defaultScrollPosition="end" />)
    assert.equal(chat.viewport().scrollTop, 280)
  })

  // Following the end
  it('follows appended rows and a reply growing in place while the reader is at the end', async (t) => {
    let chat = mount(t, <Chat autoScroll rows={rows(4)} />)
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 120)

    await chat.update(<Chat autoScroll rows={rows(5)} />)
    assert.equal(chat.viewport().scrollTop, 200)

    await chat.update(<Chat autoScroll rows={[...rows(4), { id: 'm5', height: 260 }]} />)
    assert.equal(chat.viewport().scrollTop, 380)
    assert.equal(chat.end().getAttribute('data-active'), 'false')
  })

  it('stays put on appends without autoScroll', async (t) => {
    let chat = mount(t, <Chat rows={rows(4)} />)
    await chat.settle()

    await chat.update(<Chat rows={rows(6)} />)
    assert.equal(chat.viewport().scrollTop, 120)
    assert.equal(chat.end().getAttribute('data-active'), 'true')
  })

  it('pauses following once the reader scrolls away, by wheel, touch, key or scrollbar', async (t) => {
    let gestures: Array<[string, (viewport: HTMLElement) => void]> = [
      ['wheel', (viewport) => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }))],
      ['touch', (viewport) => viewport.dispatchEvent(new Event('touchmove', { bubbles: true }))],
      ['key', (viewport) => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))],
      // Dragging the scrollbar sends no event of its own, only the scroll.
      ['scrollbar', () => {}],
    ]

    for (let [name, gesture] of gestures) {
      let chat = mount(t, <Chat autoScroll rows={rows(6)} />)
      await chat.settle()
      // A scroll to the end marks itself as automatic for a moment.
      await wait(200)

      gesture(chat.viewport())
      await scrollTo(chat.viewport(), 100)
      await chat.settle()
      assert.equal(chat.end().getAttribute('data-active'), 'true', name)

      await chat.update(<Chat autoScroll rows={rows(8)} />)
      assert.equal(chat.viewport().scrollTop, 100, name)
      await chat.update(<Chat autoScroll rows={[...rows(7), { id: 'm8', height: 300 }]} />)
      assert.equal(chat.viewport().scrollTop, 100, name)
      chat.cleanup()
    }
  })

  it('pauses following on any upward scroll, also right after a scroll to the end', async (t) => {
    let gestures: Array<[string, (viewport: HTMLElement) => void]> = [
      ['wheel', (viewport) => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }))],
      ['touch', (viewport) => viewport.dispatchEvent(new Event('touchmove', { bubbles: true }))],
      ['key', (viewport) => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))],
      // Dragging the scrollbar sends no event of its own, only the scroll.
      ['scrollbar', () => {}],
    ]

    for (let [name, gesture] of gestures) {
      let api: MessageScrollerApi | undefined
      let outside = <Commands onApi={(value) => (api = value)} />
      let chat = mount(t, <Chat autoScroll rows={rows(6)} outside={outside} />)
      await chat.settle()
      assert.ok(api)
      await chat.update(<Chat autoScroll rows={rows(7)} outside={outside} />)

      api.scrollToEnd()
      assert.equal(chat.viewport().hasAttribute('data-autoscrolling'), true, name)
      gesture(chat.viewport())
      await scrollTo(chat.viewport(), 100)
      await chat.update(<Chat autoScroll rows={rows(8)} outside={outside} />)
      assert.equal(chat.viewport().scrollTop, 100, name)
      chat.cleanup()
    }
  })

  it('pauses following when the reader drags the scrollbar while a reply streams, and keeps the scrollbar visible', async (t) => {
    let reply = (height: number) => [...rows(19), { id: 'm20', height }]
    let height = 100
    let chat = mount(t, <Chat autoScroll rows={reply(height)} />)
    await chat.settle()
    let stream = async (chunks: number) => {
      for (let chunk = 0; chunk < chunks; chunk++) {
        height += 10
        await chat.update(<Chat autoScroll rows={reply(height)} />)
      }
    }

    await stream(4)
    assert.equal(chat.viewport().scrollTop, chat.max())
    // Following isn't marked as an automatic scroll, so the scrollbar stays visible to grab.
    assert.equal(chat.viewport().hasAttribute('data-autoscrolling'), false)

    // A scrollbar drag sends only scroll events, in the middle of the stream.
    let dragged = chat.viewport().scrollTop - 300
    await scrollTo(chat.viewport(), dragged)
    await stream(4)
    assert.equal(chat.viewport().scrollTop, dragged)
    assert.equal(chat.end().getAttribute('data-active'), 'true')
  })

  it('resumes following from the end button', async (t) => {
    let chat = mount(t, <Chat autoScroll rows={rows(6)} />)
    await chat.settle()
    await wheelTo(chat, 40)

    chat.end().click()
    await until(() => chat.viewport().scrollTop === chat.max(), 'the button scrolls to the end')
    await chat.settle()
    assert.equal(chat.end().getAttribute('data-active'), 'false')
    assert.equal(chat.end().inert, true)

    await chat.update(<Chat autoScroll rows={rows(8)} />)
    assert.equal(chat.viewport().scrollTop, chat.max())
  })

  it('arms following at the end once autoScroll turns on, and stops when it turns off', async (t) => {
    let chat = mount(t, <Chat rows={rows(4)} />)
    await chat.settle()

    await chat.update(<Chat autoScroll rows={rows(4)} />)
    await chat.update(<Chat autoScroll rows={rows(5)} />)
    assert.equal(chat.viewport().scrollTop, 200)

    await chat.update(<Chat rows={rows(6)} />)
    assert.equal(chat.viewport().scrollTop, 200)
  })

  it('keeps following when several turns arrive at once', async (t) => {
    let chat = mount(t, <Chat autoScroll rows={rows(4)} />)
    await chat.settle()

    await chat.update(
      <Chat
        autoScroll
        rows={[...rows(4), { id: 'q1', anchor: true }, { id: 'a1' }, { id: 'q2', anchor: true }, { id: 'a2' }]}
      />,
    )
    assert.equal(chat.viewport().scrollTop, chat.max())
  })

  // New turns
  it('starts a new turn near the top and holds it while the reply streams, then follows', async (t) => {
    let history = [{ id: 'q1', anchor: true }, { id: 'a1' }, { id: 'q2', anchor: true }, { id: 'a2' }]
    let chat = mount(t, <Chat autoScroll rows={history} />)
    await chat.settle()

    await chat.update(<Chat autoScroll rows={[...history, { id: 'q3', anchor: true, height: 40 }]} />)
    assert.equal(chat.top('q3'), 64)
    assert.equal(chat.spacer().hidden, false)
    assert.equal(chat.spacer().getBoundingClientRect().height, 96)
    // The spacer is room to scroll, not content below.
    assert.equal(chat.end().getAttribute('data-active'), 'false')

    await chat.update(
      <Chat autoScroll rows={[...history, { id: 'q3', anchor: true, height: 40 }, { id: 'a3', height: 20 }]} />,
    )
    assert.equal(chat.top('q3'), 64)

    await chat.update(
      <Chat autoScroll rows={[...history, { id: 'q3', anchor: true, height: 40 }, { id: 'a3', height: 60 }]} />,
    )
    assert.equal(chat.top('q3'), 64)

    // The reply fills the viewport, so the reader is at the end and following takes over.
    await chat.update(
      <Chat autoScroll rows={[...history, { id: 'q3', anchor: true, height: 40 }, { id: 'a3', height: 220 }]} />,
    )
    assert.equal(chat.spacer().hidden, true)
    assert.equal(chat.viewport().scrollTop, chat.max())
    await chat.update(
      <Chat autoScroll rows={[...history, { id: 'q3', anchor: true, height: 40 }, { id: 'a3', height: 400 }]} />,
    )
    assert.equal(chat.viewport().scrollTop, chat.max())
  })

  it('starts a new turn near the top without autoScroll too, with the peek and margin the provider sets', async (t) => {
    let chat = mount(t, <Chat scrollPreviousItemPeek={24} scrollMargin={8} rows={rows(4)} />)
    await chat.settle()

    await chat.update(
      <Chat scrollPreviousItemPeek={24} scrollMargin={8} rows={[...rows(4), { id: 'q', anchor: true }]} />,
    )
    assert.equal(chat.top('q'), 32)
  })

  it('leaves out the gap before the spacer', async (t) => {
    let chat = mount(t, <Chat gap="32px" rows={rows(3)} />)
    await chat.settle()

    await chat.update(<Chat gap="32px" rows={[...rows(3), { id: 'q', anchor: true, height: 40 }]} />)
    assert.equal(chat.top('q'), 64)
    assert.equal(chat.spacer().style.marginBlockStart, '-32px')
    assert.equal(
      Math.round(chat.content().getBoundingClientRect().bottom - chat.row('q').getBoundingClientRect().bottom),
      96,
    )
  })

  it('starts a turn for a replaced row that becomes an anchor, and never for a row that only changes', async (t) => {
    let history = [{ id: 'q1', anchor: true }, ...rows(4)]
    let chat = mount(t, <Chat rows={[...history, { id: 'typing', height: 40 }]} />)
    await chat.settle()
    let end = chat.viewport().scrollTop

    // A typing row replaced by the reply: no new turn, and no jump back to an earlier one.
    await chat.update(<Chat rows={[...history, { id: 'reply', height: 40 }]} />)
    assert.equal(chat.viewport().scrollTop, end)

    // A row that becomes an anchor in place, such as a toggled setting, isn't a new turn either.
    await chat.update(<Chat rows={[...history, { id: 'reply', height: 40, anchor: true }]} />)
    assert.equal(chat.viewport().scrollTop, end)

    // An optimistic row replaced by the sent message starts its turn.
    await chat.update(<Chat rows={[...history, { id: 'sent', height: 40, anchor: true }]} />)
    assert.equal(chat.top('sent'), 64)
  })

  // Keeping the reader's place
  for (let noNativeAnchoring of [false, true]) {
    let engine = noNativeAnchoring ? 'without the browser anchoring' : 'with the browser anchoring'

    it(`keeps the first visible row in place when older rows arrive above, ${engine}`, async (t) => {
      let chat = mount(t, <Chat noNativeAnchoring={noNativeAnchoring} rows={rows(6, 3)} />)
      await chat.settle()
      await wheelTo(chat, 120)
      assert.equal(chat.top('m4'), -40)

      await chat.update(<Chat noNativeAnchoring={noNativeAnchoring} rows={rows(8, 1)} />)
      assert.equal(chat.top('m4'), -40)
      assert.equal(chat.viewport().scrollTop, 280)

      // At the very top, too.
      await wheelTo(chat, 0)
      await chat.update(<Chat noNativeAnchoring={noNativeAnchoring} rows={[{ id: 'm0', height: 50 }, ...rows(8, 1)]} />)
      assert.equal(chat.top('m1'), 0)
    })

    it(`keeps the first visible row in place when a row above it resizes, such as an image loading, ${engine}`, async (t) => {
      let picture = (height: number) => [{ id: 'm1', height: -1, children: <div style={`height: ${height}px`} /> }]
      let chat = mount(t, <Chat noNativeAnchoring={noNativeAnchoring} rows={[...picture(80), ...rows(6, 2)]} />)
      await chat.settle()
      await wheelTo(chat, 120)
      assert.equal(chat.top('m2'), -40)

      await chat.update(<Chat noNativeAnchoring={noNativeAnchoring} rows={[...picture(200), ...rows(6, 2)]} />)
      assert.equal(chat.top('m2'), -40)
      assert.equal(chat.viewport().scrollTop, 240)

      // A row below the first visible one grows into the space under it.
      await chat.update(
        <Chat
          noNativeAnchoring={noNativeAnchoring}
          rows={[...picture(200), ...rows(1, 2), { id: 'm3', height: 160 }, ...rows(4, 4)]}
        />,
      )
      assert.equal(chat.top('m2'), -40)
    })
  }

  it('keeps the first visible message in place when older rows arrive below a "load earlier" row', async (t) => {
    let load = { id: 'load', plain: true, height: 40 }
    let chat = mount(t, <Chat rows={[load, ...rows(6, 5)]} />)
    await chat.settle()
    await wheelTo(chat, 0)
    assert.equal(chat.top('m5'), 40)

    await chat.update(<Chat rows={[load, ...rows(10, 1)]} />)
    assert.equal(chat.top('m5'), 40)
    assert.equal(chat.viewport().scrollTop, 320)
  })

  it('keeps the place while a real image loads above the reader', async (t) => {
    let image = (src?: string) => ({
      id: 'photo',
      height: -1,
      children: <img alt="Receipt" src={src} style="display: block" />,
    })
    let chat = mount(t, <Chat rows={[...rows(2), image(), ...rows(5, 3)]} />)
    await chat.settle()
    await wheelTo(chat, 200)
    let before = chat.top('m4')

    let svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="150"/>')}`
    await chat.update(<Chat rows={[...rows(2), image(svg), ...rows(5, 3)]} />)
    let photo = chat.row('photo').querySelector('img') as HTMLImageElement
    await until(() => photo.complete && photo.naturalHeight > 0, 'the image loads')
    await chat.settle()

    assert.equal(chat.row('photo').getBoundingClientRect().height, 150)
    assert.equal(chat.top('m4'), before)
  })

  it('lands a jump exactly on a row far away, and opens at the very end of long rows', async (t) => {
    let text = (index: number) => `Line ${index}. `.repeat(1 + (index % 5) * 8)
    let list = Array.from({ length: 80 }, (_, index) => ({ id: `m${index + 1}`, height: -1, text: text(index) }))
    let api: MessageScrollerApi | undefined
    let outside = <Commands onApi={(value) => (api = value)} />
    let chat = mount(t, <Chat defaultScrollPosition="start" rows={list} outside={outside} />)
    await chat.settle()
    assert.ok(api)

    for (let [id, align] of [
      ['m70', 'start'],
      ['m12', 'start'],
      ['m45', 'center'],
    ] as const) {
      api.scrollToMessage(id, { align })
      await chat.settle()
      await frames(3)
      let row = chat.row(id).getBoundingClientRect()
      let box = chat.viewport().getBoundingClientRect()
      let offset = align === 'start' ? row.top - box.top : row.top + row.height / 2 - (box.top + box.height / 2)
      assert.ok(Math.abs(offset) <= 1, `${id} lands at the ${align}, ${offset}px off`)
    }

    let long = mount(t, <Chat rows={list.map((row) => ({ ...row, text: `${row.text} `.repeat(4) }))} />)
    await long.settle()
    await frames(3)
    assert.equal(long.viewport().scrollTop, long.max())
  })

  it('stays at the end when the container grows or shrinks while following', async (t) => {
    let chat = mount(t, <Chat autoScroll rows={rows(6)} />)
    await chat.settle()

    await chat.update(<Chat autoScroll height={120} rows={rows(6)} />)
    assert.equal(chat.viewport().scrollTop, 360)
    await chat.update(<Chat autoScroll height={300} rows={rows(6)} />)
    assert.equal(chat.viewport().scrollTop, 180)
  })

  for (let noNativeAnchoring of [false, true]) {
    let engine = noNativeAnchoring ? 'without the browser anchoring' : 'with the browser anchoring'

    it(`keeps a message the reader jumped to in place when a row above it resizes, ${engine}`, async (t) => {
      let picture = (height: number) => ({ id: 'm1', height: -1, children: <div style={`height: ${height}px`} /> })
      let api: MessageScrollerApi | undefined
      let outside = <Commands onApi={(value) => (api = value)} />
      let chat = mount(
        t,
        <Chat noNativeAnchoring={noNativeAnchoring} rows={[picture(80), ...rows(11, 2)]} outside={outside} />,
      )
      await chat.settle()
      assert.ok(api)

      api.scrollToMessage('m5')
      await chat.settle()
      assert.equal(chat.top('m5'), 0)
      await chat.update(
        <Chat noNativeAnchoring={noNativeAnchoring} rows={[picture(300), ...rows(11, 2)]} outside={outside} />,
      )
      assert.equal(chat.top('m5'), 0)

      // A row above resizing while a smooth jump is on its way: the jump still lands on its message.
      api.scrollToMessage('m9', { behavior: 'smooth' })
      await chat.update(
        <Chat noNativeAnchoring={noNativeAnchoring} rows={[picture(500), ...rows(11, 2)]} outside={outside} />,
      )
      await until(() => chat.top('m9') === 0, `the smooth jump lands on m9, not ${chat.top('m9')}px away`)
      // Once its last scroll event is in, the jump has arrived, and the place stays as after any jump.
      await chat.settle()
      await chat.update(
        <Chat noNativeAnchoring={noNativeAnchoring} rows={[picture(140), ...rows(11, 2)]} outside={outside} />,
      )
      assert.equal(chat.top('m9'), 0)
    })
  }

  it('keeps the top row when the container resizes while the reader reads history', async (t) => {
    let chat = mount(t, <Chat rows={rows(8)} />)
    await chat.settle()
    await wheelTo(chat, 120)

    await chat.update(<Chat height={140} rows={rows(8)} />)
    assert.equal(chat.top('m2'), -40)
  })

  // Commands
  it('scrolls to a message with every alignment and margin', async (t) => {
    let api: MessageScrollerApi | undefined
    let chat = mount(t, <Chat rows={rows(10)} outside={<Commands onApi={(value) => (api = value)} />} />)
    await chat.settle()
    assert.ok(api)

    let cases: Array<[Parameters<MessageScrollerApi['scrollToMessage']>[1], number]> = [
      [undefined, 160],
      [{ align: 'center' }, 260],
      [{ align: 'end' }, 200],
      [{ align: 'start', scrollMargin: 16 }, 304],
    ]
    for (let [index, [options, top]] of cases.entries()) {
      assert.equal(api.scrollToMessage(index === 3 ? 'm5' : index === 0 ? 'm3' : 'm5', options), true)
      await chat.settle()
      assert.equal(chat.viewport().scrollTop, top, JSON.stringify(options))
    }

    // Nearest leaves a row in view alone.
    assert.equal(api.scrollToMessage('m5', { align: 'nearest' }), true)
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 304)

    assert.equal(api.scrollToMessage('missing'), false)
    assert.equal(api.scrollToStart(), true)
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 0)
    assert.equal(api.scrollToEnd(), true)
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 600)
  })

  it('waits for a row that mounts later, and wins over the opening position', async (t) => {
    let api: MessageScrollerApi | undefined
    let outside = <Commands onApi={(value) => (api = value)} />
    let chat = mount(t, <Chat rows={[]} outside={outside} />)
    await chat.settle()
    assert.ok(api)
    assert.equal(api.scrollToMessage('m4'), true)

    await chat.update(<Chat rows={rows(10)} outside={outside} />)
    assert.equal(chat.viewport().scrollTop, 240)
    assert.equal(chat.viewport().hasAttribute('data-pending-scroll'), false)
  })

  it("doesn't start following again after a jump until the reader gestures at the end", async (t) => {
    let api: MessageScrollerApi | undefined
    let outside = <Commands onApi={(value) => (api = value)} />
    let chat = mount(t, <Chat autoScroll rows={rows(8)} outside={outside} />)
    await chat.settle()
    assert.ok(api)

    api.scrollToMessage('m2')
    await chat.settle()
    await chat.update(<Chat autoScroll rows={rows(9)} outside={outside} />)
    assert.equal(chat.viewport().scrollTop, 80)

    await wheelTo(chat, chat.max())
    await chat.update(<Chat autoScroll rows={rows(10)} outside={outside} />)
    assert.equal(chat.viewport().scrollTop, chat.max())
  })

  it('scrolls smoothly from a button, or at once for reduced motion', async (t) => {
    let chat = mount(t, <Chat rows={rows(20)} />)
    await chat.settle()
    await wheelTo(chat, 0)

    chat.end().click()
    assert.ok(chat.viewport().scrollTop < chat.max(), 'smooth scrolling takes a moment')
    await until(() => chat.viewport().scrollTop === chat.max(), 'the button reaches the end')

    let original = window.matchMedia
    window.matchMedia = (query: string) =>
      ({
        ...original.call(window, query),
        matches: query.includes('prefers-reduced-motion: reduce'),
      }) as MediaQueryList
    t.after(() => {
      window.matchMedia = original
    })
    await chat.settle()
    chat.start().click()
    assert.equal(chat.viewport().scrollTop, 0)
  })

  it("lets the caller's click handler cancel the scroll", async (t) => {
    let chat = mount(
      t,
      <MessageScrollerProvider defaultScrollPosition="start">
        <div style="height: 200px">
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                {rows(5).map((row) => (
                  <MessageScrollerItem key={row.id} messageId={row.id} style="height: 80px" />
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton mix={on<HTMLButtonElement, 'click'>('click', (event) => event.preventDefault())} />
          </MessageScroller>
        </div>
      </MessageScrollerProvider>,
    )
    await chat.settle()
    assert.equal(chat.end().getAttribute('data-active'), 'true')

    chat.end().click()
    await chat.settle()
    assert.equal(chat.viewport().scrollTop, 0)
  })

  // Focus
  it('never moves focus while it follows, anchors or keeps the place', async (t) => {
    let composer = <textarea aria-label="Message" />
    let link = { id: 'm2', children: <a href="#invoice">Invoice</a> }
    let history = [...rows(1), link, ...rows(3, 3)]
    let chat = mount(t, <Chat autoScroll rows={history} outside={composer} />)
    await chat.settle()

    let textarea = chat.container.querySelector('textarea') as HTMLTextAreaElement
    textarea.focus()
    await chat.update(<Chat autoScroll rows={[...history, ...rows(2, 6)]} outside={composer} />)
    await chat.update(
      <Chat autoScroll rows={[...history, ...rows(2, 6), { id: 'q', anchor: true }]} outside={composer} />,
    )
    await chat.update(
      <Chat
        autoScroll
        rows={[{ id: 'old' }, ...history, ...rows(2, 6), { id: 'q', anchor: true }]}
        outside={composer}
      />,
    )
    assert.equal(document.activeElement, textarea)

    let anchor = chat.row('m2').querySelector('a') as HTMLAnchorElement
    anchor.focus({ preventScroll: true })
    await chat.update(
      <Chat
        autoScroll
        rows={[{ id: 'old' }, ...history, ...rows(3, 6), { id: 'q', anchor: true }]}
        outside={composer}
      />,
    )
    assert.equal(document.activeElement, anchor)
  })

  it('moves focus from a jump button to the viewport, since the button goes away', async (t) => {
    let chat = mount(t, <Chat rows={rows(8)} />)
    await chat.settle()
    await wheelTo(chat, 0)

    chat.end().focus()
    assert.equal(document.activeElement, chat.end())
    chat.end().click()
    assert.equal(document.activeElement, chat.viewport())
    await until(() => chat.viewport().scrollTop === chat.max(), 'the button reaches the end')
    await chat.settle()
    assert.equal(chat.end().inert, true)
    assert.equal(document.activeElement, chat.viewport())
  })

  // State for other components
  it('renders a watching component again when the edges change', async (t) => {
    let renders = 0
    function Status(handle: Handle) {
      return () => {
        renders++
        let { start, end } = watchMessageScrollerScrollable(handle)
        return <output data-status>{`${start} ${end}`}</output>
      }
    }

    let chat = mount(t, <Chat rows={rows(6)} outside={<Status />} />)
    await chat.settle()
    let status = () => chat.container.querySelector('[data-status]')?.textContent
    assert.equal(status(), 'true false')
    let settled = renders

    // Scrolling within the same state renders nothing again: 5px from the end still counts as at the end.
    await wheelTo(chat, 275)
    assert.equal(renders, settled)

    await wheelTo(chat, 100)
    assert.equal(status(), 'true true')
    await wheelTo(chat, 0)
    assert.equal(status(), 'false true')
  })

  it('reports the rows in view and the current turn only while something watches', async (t) => {
    let created = 0
    let disconnected = 0
    let Original = window.IntersectionObserver
    window.IntersectionObserver = class extends Original {
      constructor(...args: ConstructorParameters<typeof IntersectionObserver>) {
        super(...args)
        created++
      }
      override disconnect() {
        disconnected++
        super.disconnect()
      }
    }
    t.after(() => {
      window.IntersectionObserver = Original
    })

    function Outline(handle: Handle) {
      return () => {
        let { currentAnchorId, visibleMessageIds } = watchMessageScrollerVisibility(handle)
        return <output data-outline>{`${currentAnchorId} ${visibleMessageIds.join(',')}`}</output>
      }
    }
    let list = rows(10).map((row, index) => ({ ...row, anchor: index % 3 === 0 }))

    let plain = mount(t, <Chat rows={list} />)
    await plain.settle()
    assert.equal(created, 0)
    plain.cleanup()

    let chat = mount(t, <Chat rows={list} outside={<Outline />} />)
    await chat.settle()
    let outline = () => chat.container.querySelector('[data-outline]')?.textContent
    await until(() => outline() === 'm7 m9,m10', `the outline shows the turn and the rows in view, not ${outline()}`)
    assert.equal(created, 1)

    // m2 only peeks in above the reading line, 64px down, so it isn't read yet.
    await wheelTo(chat, 100)
    await until(() => outline() === 'm1 m3,m4', `the outline follows the reader, not ${outline()}`)

    await chat.update(<Chat rows={list} />)
    assert.equal(disconnected, 1)
  })

  // Instances and cleanup
  it('keeps two transcripts apart', async (t) => {
    let chat = mount(
      t,
      <div>
        <Chat rows={rows(6)} />
        <Chat rows={rows(6)} />
      </div>,
    )
    await chat.settle()
    let [first, second] = Array.from(
      chat.container.querySelectorAll<HTMLElement>('[data-slot="message-scroller-viewport"]'),
    )
    assert.ok(first && second)
    let buttons = Array.from(chat.container.querySelectorAll('[data-direction="end"]'))

    first.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }))
    await scrollTo(first, 0)
    await chat.settle()

    assert.equal(second.scrollTop, 280)
    assert.deepEqual(
      buttons.map((button) => button.getAttribute('data-active')),
      ['true', 'false'],
    )
  })

  it('stops every observer, listener and frame once the transcript leaves', async (t) => {
    let live = new Set<object>()
    let originals = {
      ResizeObserver: window.ResizeObserver,
      MutationObserver: window.MutationObserver,
      IntersectionObserver: window.IntersectionObserver,
    }
    let track = <T extends new (...args: any[]) => { disconnect(): void }>(Base: T) =>
      class extends Base {
        constructor(...args: any[]) {
          super(...args)
          live.add(this)
        }
        override disconnect() {
          live.delete(this)
          super.disconnect()
        }
      }
    window.ResizeObserver = track(originals.ResizeObserver)
    window.MutationObserver = track(originals.MutationObserver)
    window.IntersectionObserver = track(originals.IntersectionObserver)
    t.after(() => Object.assign(window, originals))

    function Outline(handle: Handle) {
      return () => <output>{watchMessageScrollerVisibility(handle).visibleMessageIds.join(',')}</output>
    }
    let chat = mount(t, <Chat autoScroll rows={rows(6)} outside={<Outline />} />)
    await chat.settle()
    assert.ok(live.size >= 4, 'the scroller observes the viewport, the rows and their visibility')
    await wheelTo(chat, 0)

    // Remix flushes in microtasks, so every frame and timer a click schedules
    // right away is the scroller's: a state commit, a visibility sync and the
    // automatic mark. Leave while they are pending.
    let pending = { frames: new Set<number>(), timers: new Set<unknown>() }
    let browser = {
      raf: window.requestAnimationFrame,
      caf: window.cancelAnimationFrame,
      set: window.setTimeout,
      clear: window.clearTimeout,
    }
    let recording = true
    window.requestAnimationFrame = (callback) => {
      let id = browser.raf.call(window, callback)
      if (recording) pending.frames.add(id)
      return id
    }
    window.cancelAnimationFrame = (id) => {
      pending.frames.delete(id)
      browser.caf.call(window, id)
    }
    window.setTimeout = ((handler: () => void, ms?: number) => {
      let id = browser.set.call(window, handler, ms)
      if (recording) pending.timers.add(id)
      return id
    }) as unknown as typeof window.setTimeout
    window.clearTimeout = (id) => {
      pending.timers.delete(id)
      browser.clear.call(window, id)
    }
    t.after(() =>
      Object.assign(window, {
        requestAnimationFrame: browser.raf,
        cancelAnimationFrame: browser.caf,
        setTimeout: browser.set,
        clearTimeout: browser.clear,
      }),
    )

    chat.end().click()
    recording = false
    assert.ok(pending.frames.size > 0 && pending.timers.size > 0, 'the click schedules work')
    chat.cleanup()

    assert.equal(live.size, 0)
    assert.equal(pending.frames.size, 0)
    assert.equal(pending.timers.size, 0)
  })
})
