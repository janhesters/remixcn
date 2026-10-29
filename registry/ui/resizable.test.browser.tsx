import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  resizableLayoutChangedType,
  resizableLayoutChangeType,
} from './resizable.tsx'
import type { ResizableLayout, ResizablePanelGroupProps } from './resizable.tsx'

// A 1001px row: one 1px handle leaves 1000px to the panels, so 1% is 10px.
const frame = 'width: 1001px; height: 200px;'

function mount(t: TestContext, node: RemixNode, style = frame) {
  let result = render(<div style={style}>{node}</div>)
  t.after(result.cleanup)
  return result
}

// The group measures and turns its handles on after the first commit.
async function settle(act: (fn: () => void) => Promise<void>) {
  await act(() => {})
  await act(() => {})
}

function sizes(container: ParentNode) {
  return [...container.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')].map(
    (panel) => Math.round(Number.parseFloat(panel.style.flexGrow) * 10) / 10,
  )
}

function separators(container: ParentNode) {
  return [...container.querySelectorAll<HTMLElement>('[data-slot="resizable-handle"]')]
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }))
}

function pointer(target: EventTarget, type: string, x: number, y = 100) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    }),
  )
}

function Workspace(handle: Handle<Partial<ResizablePanelGroupProps> & { sidebar?: Record<string, unknown> }>) {
  return () => {
    let { sidebar, ...group } = handle.props
    return (
      <ResizablePanelGroup {...group}>
        <ResizablePanel id="sidebar" defaultSize="30%" minSize="20%" maxSize="60%" {...sidebar}>
          Sidebar
        </ResizablePanel>
        <ResizableHandle aria-label="Resize the sidebar" />
        <ResizablePanel id="content" minSize="20%">
          Content
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }
}

describe('Resizable in the browser', () => {
  it('turns each handle into a focusable separator that describes the panel before it', async (t) => {
    let { act, container } = mount(t, <Workspace />)
    await settle(act)

    let [separator] = separators(container)
    assert.equal(separator?.tabIndex, 0)
    assert.equal(separator?.getAttribute('aria-controls'), 'sidebar')
    assert.equal(separator?.getAttribute('aria-valuenow'), '30')
    assert.equal(separator?.getAttribute('aria-valuemin'), '20')
    assert.equal(separator?.getAttribute('aria-valuemax'), '60')
    assert.deepEqual(sizes(container), [30, 70])
  })

  it('moves by 5% with the arrow keys and to the bounds with Home and End', async (t) => {
    let { act, container } = mount(t, <Workspace />)
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    separator.focus()

    await act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(container), [35, 65])
    await act(() => key(separator, 'ArrowLeft'))
    await act(() => key(separator, 'ArrowLeft'))
    assert.deepEqual(sizes(container), [25, 75])
    await act(() => key(separator, 'End'))
    assert.deepEqual(sizes(container), [60, 40])
    await act(() => key(separator, 'Home'))
    assert.deepEqual(sizes(container), [20, 80])
    assert.equal(separator.getAttribute('aria-valuenow'), '20')
  })

  it('uses the up and down arrows in a vertical group, and ignores the others', async (t) => {
    let { act, container } = mount(t, <Workspace orientation="vertical" />, 'width: 300px; height: 1001px;')
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    assert.equal(separator.getAttribute('aria-orientation'), 'horizontal')

    await act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(container), [30, 70])
    await act(() => key(separator, 'ArrowDown'))
    assert.deepEqual(sizes(container), [35, 65])
    await act(() => key(separator, 'ArrowUp'))
    assert.deepEqual(sizes(container), [30, 70])
  })

  it('mirrors the left and right arrows and the drag in right-to-left text', async (t) => {
    let { act, container } = mount(t, <Workspace />, `${frame} direction: rtl;`)
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]

    // The sidebar is on the right, so moving the line left widens it.
    await act(() => key(separator, 'ArrowLeft'))
    assert.deepEqual(sizes(container), [35, 65])

    let x = separator.getBoundingClientRect().x
    await act(() => pointer(separator, 'pointerdown', x))
    await act(() => pointer(separator, 'pointermove', x - 100))
    await act(() => pointer(separator, 'pointerup', x - 100))
    assert.deepEqual(sizes(container), [45, 55])
  })

  it('collapses and restores a collapsible panel with Enter', async (t) => {
    let { act, container } = mount(t, <Workspace sidebar={{ collapsible: true, defaultSize: '40%' }} />)
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let sidebar = container.querySelector('#sidebar') as HTMLElement

    await act(() => key(separator, 'Enter'))
    assert.deepEqual(sizes(container), [0, 100])
    assert.equal(sidebar.hasAttribute('data-collapsed'), true)
    assert.equal(sidebar.inert, true)
    assert.equal(separator.getAttribute('aria-valuenow'), '0')

    await act(() => key(separator, 'Enter'))
    assert.deepEqual(sizes(container), [40, 60])
    assert.equal(sidebar.inert, false)
  })

  it('collapses the panel after the handle with Enter when only that one is collapsible', async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel id="editor" />
        <ResizableHandle />
        <ResizablePanel id="inspector" collapsible minSize="20%" defaultSize="35%" />
      </ResizablePanelGroup>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]

    await act(() => key(separator, 'Enter'))
    assert.deepEqual(sizes(container), [100, 0])
    await act(() => key(separator, 'Enter'))
    assert.deepEqual(sizes(container), [65, 35])
  })

  it('collapses a collapsible panel dragged past halfway below its minimum', async (t) => {
    let { act, container } = mount(t, <Workspace sidebar={{ collapsible: true, collapsedSize: '4%' }} />)
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let x = separator.getBoundingClientRect().x

    await act(() => pointer(separator, 'pointerdown', x))
    await act(() => pointer(separator, 'pointermove', x - 150))
    assert.deepEqual(sizes(container), [20, 80])
    await act(() => pointer(separator, 'pointermove', x - 200))
    assert.deepEqual(sizes(container), [4, 96])
    await act(() => pointer(separator, 'pointerup', x - 200))
    assert.equal(container.querySelector('#sidebar')?.hasAttribute('data-collapsed'), true)
  })

  it('drags with the pointer, reporting the layout as it changes and once when done', async (t) => {
    let changes: ResizableLayout[] = []
    let done: ResizableLayout[] = []
    let { act, container } = mount(
      t,
      <div
        mix={[
          on(resizableLayoutChangeType, (event) => void changes.push(event.layout)),
          on(resizableLayoutChangedType, (event) => void done.push(event.layout)),
        ]}
      >
        <Workspace />
      </div>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let x = separator.getBoundingClientRect().x

    await act(() => pointer(separator, 'pointerdown', x))
    assert.equal(document.activeElement, separator)
    assert.equal(separator.hasAttribute('data-dragging'), true)
    await act(() => pointer(document, 'pointermove', x + 50))
    await act(() => pointer(document, 'pointermove', x + 100))
    // Past the sidebar's 60% maximum, the line stops.
    await act(() => pointer(document, 'pointermove', x + 900))
    await act(() => pointer(document, 'pointerup', x + 900))

    assert.deepEqual(sizes(container), [60, 40])
    assert.deepEqual(
      changes.map((layout) => Math.round(layout.sidebar ?? 0)),
      [35, 40, 60],
    )
    assert.equal(done.length, 1)
    assert.equal(Math.round(done[0]?.sidebar ?? 0), 60)
    assert.equal(separator.hasAttribute('data-dragging'), false)

    // Moves after the release do nothing.
    await act(() => pointer(document, 'pointermove', x))
    assert.deepEqual(sizes(container), [60, 40])
  })

  it('puts the layout back when the browser cancels the pointer or Escape is pressed', async (t) => {
    let done = 0
    let { act, container } = mount(
      t,
      <div mix={on(resizableLayoutChangedType, () => void done++)}>
        <Workspace />
      </div>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let x = separator.getBoundingClientRect().x

    await act(() => pointer(separator, 'pointerdown', x))
    await act(() => pointer(document, 'pointermove', x + 100))
    assert.deepEqual(sizes(container), [40, 60])
    await act(() => pointer(document, 'pointercancel', x + 100))
    assert.deepEqual(sizes(container), [30, 70])

    await act(() => pointer(separator, 'pointerdown', x))
    await act(() => pointer(document, 'pointermove', x - 50))
    await act(() => key(separator, 'Escape'))
    assert.deepEqual(sizes(container), [30, 70])
    await act(() => pointer(document, 'pointermove', x - 100))
    assert.deepEqual(sizes(container), [30, 70])
    assert.equal(done, 0)
  })

  it('ignores other mouse buttons, a disabled group and a disabled handle', async (t) => {
    function Groups() {
      return () => (
        <>
          <Workspace disabled />
          <ResizablePanelGroup>
            <ResizablePanel />
            <ResizableHandle disabled />
            <ResizablePanel />
          </ResizablePanelGroup>
        </>
      )
    }
    let { act, container } = mount(t, <Groups />)
    await settle(act)
    let [first, second] = separators(container) as [HTMLElement, HTMLElement]

    for (let separator of [first, second]) {
      assert.equal(separator.hasAttribute('tabindex'), false)
      assert.equal(separator.getAttribute('aria-disabled'), 'true')
      await act(() => key(separator, 'ArrowRight'))
    }
    assert.deepEqual(sizes(container), [30, 70, 50, 50])

    let { act: act2, container: other } = mount(t, <Workspace />)
    await settle(act2)
    let [separator] = separators(other) as [HTMLElement]
    let x = separator.getBoundingClientRect().x
    separator.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 2, clientX: x, bubbles: true }),
    )
    await act2(() => pointer(document, 'pointermove', x + 100))
    assert.deepEqual(sizes(other), [30, 70])
  })

  it('keeps its layout when a listener cancels the change', async (t) => {
    let { act, container } = mount(
      t,
      <div mix={on(resizableLayoutChangeType, (event) => event.preventDefault())}>
        <Workspace />
      </div>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]

    await act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(container), [30, 70])
  })

  it('follows a layout its owner controls and updates from the change events', async (t) => {
    function Controlled(handle: Handle<{ follow: boolean }>) {
      let layout: ResizableLayout = { sidebar: 25, content: 75 }
      return () => (
        <div>
          <output>{Math.round(layout.sidebar ?? 0)}%</output>
          <button
            type="button"
            mix={on('click', () => {
              layout = { sidebar: 50, content: 50 }
              void handle.update()
            })}
          >
            Half
          </button>
          <Workspace
            layout={layout}
            mix={on(resizableLayoutChangeType, (event) => {
              if (!handle.props.follow) return
              layout = event.layout
              void handle.update()
            })}
          />
        </div>
      )
    }

    let followed = mount(t, <Controlled follow />)
    await settle(followed.act)
    let [separator] = separators(followed.container) as [HTMLElement]
    await followed.act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(followed.container), [30, 70])
    assert.equal(followed.container.querySelector('output')?.textContent, '30%')
    await followed.act(() => followed.container.querySelector('button')?.click())
    assert.deepEqual(sizes(followed.container), [50, 50])

    let fixed = mount(t, <Controlled follow={false} />)
    await settle(fixed.act)
    let [other] = separators(fixed.container) as [HTMLElement]
    await fixed.act(() => key(other, 'ArrowRight'))
    assert.deepEqual(sizes(fixed.container), [25, 75])
  })

  it('reports a finished key or double click once a controlled layout has rendered it, and not when it is ignored', async (t) => {
    function Owned(handle: Handle<{ follow: boolean; done: ResizableLayout[] }>) {
      let layout: ResizableLayout = { a: 30, b: 70 }
      return () => (
        <ResizablePanelGroup
          layout={layout}
          mix={[
            on(resizableLayoutChangeType, (event) => {
              if (!handle.props.follow) return
              layout = event.layout
              void handle.update()
            }),
            on(resizableLayoutChangedType, (event) => void handle.props.done.push(event.layout)),
          ]}
        >
          <ResizablePanel id="a" defaultSize="30%" />
          <ResizableHandle />
          <ResizablePanel id="b" />
        </ResizablePanelGroup>
      )
    }

    let done: ResizableLayout[] = []
    let followed = mount(t, <Owned follow done={done} />)
    await settle(followed.act)
    let [separator] = separators(followed.container) as [HTMLElement]

    await followed.act(() => key(separator, 'ArrowRight'))
    await settle(followed.act)
    assert.deepEqual(sizes(followed.container), [35, 65])
    assert.deepEqual(
      done.map((layout) => Math.round(layout.a ?? 0)),
      [35],
    )

    await followed.act(() => separator.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })))
    await settle(followed.act)
    assert.deepEqual(sizes(followed.container), [30, 70])
    assert.deepEqual(
      done.map((layout) => Math.round(layout.a ?? 0)),
      [35, 30],
    )

    let ignored: ResizableLayout[] = []
    let fixed = mount(t, <Owned follow={false} done={ignored} />)
    await settle(fixed.act)
    let [other] = separators(fixed.container) as [HTMLElement]
    await fixed.act(() => key(other, 'ArrowRight'))
    await settle(fixed.act)
    assert.deepEqual(sizes(fixed.container), [30, 70])
    assert.deepEqual(ignored, [])
  })

  it("lets the caller's own handlers cancel a key or a double click first", async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel defaultSize="30%" />
        <ResizableHandle
          mix={[
            on('keydown', (event) => {
              if (event.key === 'ArrowRight') event.preventDefault()
            }),
            on('dblclick', (event) => event.preventDefault()),
          ]}
        />
        <ResizablePanel />
      </ResizablePanelGroup>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]

    await act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(container), [30, 70])
    await act(() => key(separator, 'ArrowLeft'))
    await act(() => separator.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })))
    assert.deepEqual(sizes(container), [25, 75])
  })

  it('moves focus between the handles of a group with F6', async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel />
        <ResizableHandle />
        <ResizablePanel />
        <ResizableHandle />
        <ResizablePanel />
      </ResizablePanelGroup>,
    )
    await settle(act)
    let [first, second] = separators(container) as [HTMLElement, HTMLElement]
    first.focus()

    await act(() => key(first, 'F6'))
    assert.equal(document.activeElement, second)
    await act(() => key(second, 'F6'))
    assert.equal(document.activeElement, first)
    await act(() => key(first, 'F6', { shiftKey: true }))
    assert.equal(document.activeElement, second)
  })

  it('resets a panel to its default size on a double click', async (t) => {
    let { act, container } = mount(t, <Workspace />)
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]

    await act(() => key(separator, 'End'))
    await act(() => separator.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })))
    assert.deepEqual(sizes(container), [30, 70])
  })

  it('resizes nested groups on their own', async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel id="one" />
        <ResizableHandle />
        <ResizablePanel id="right">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel id="two" />
            <ResizableHandle />
            <ResizablePanel id="three" />
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>,
    )
    await settle(act)
    let [outer, inner] = separators(container) as [HTMLElement, HTMLElement]

    await act(() => key(inner, 'ArrowDown'))
    assert.deepEqual(sizes(container), [50, 50, 55, 45])
    assert.equal(inner.getAttribute('aria-controls'), 'two')
    await act(() => key(outer, 'ArrowLeft'))
    assert.deepEqual(sizes(container), [45, 55, 55, 45])
  })

  it('applies a default size in pixels once the browser has measured the group', async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel id="nav" defaultSize={240} />
        <ResizableHandle />
        <ResizablePanel id="main" />
      </ResizablePanelGroup>,
    )
    await settle(act)

    assert.deepEqual(sizes(container), [24, 76])
    assert.equal(separators(container)[0]?.getAttribute('aria-valuenow'), '24')
  })

  it('refits pixel bounds when the group changes size', async (t) => {
    let { act, container } = mount(
      t,
      <ResizablePanelGroup>
        <ResizablePanel id="nav" minSize={300} />
        <ResizableHandle />
        <ResizablePanel id="main" />
      </ResizablePanelGroup>,
    )
    await settle(act)
    assert.deepEqual(sizes(container), [50, 50])

    let frameElement = container.firstElementChild as HTMLElement
    frameElement.style.width = '501px'
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await settle(act)

    assert.deepEqual(sizes(container), [60, 40])
    assert.equal(separators(container)[0]?.getAttribute('aria-valuemin'), '60')
  })

  it('keeps the other panels when one comes or goes', async (t) => {
    function Editor(handle: Handle) {
      let preview = false
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              preview = !preview
              void handle.update()
            })}
          >
            Toggle preview
          </button>
          <ResizablePanelGroup>
            <ResizablePanel id="files" defaultSize="20%" />
            <ResizableHandle />
            <ResizablePanel id="code" />
            {preview ? <ResizableHandle /> : null}
            {preview ? <ResizablePanel id="preview" defaultSize="30%" /> : null}
          </ResizablePanelGroup>
        </div>
      )
    }

    let { act, container } = mount(t, <Editor />)
    await settle(act)
    let toggle = container.querySelector('button') as HTMLButtonElement
    let [separator] = separators(container) as [HTMLElement]
    await act(() => key(separator, 'ArrowRight'))
    assert.deepEqual(sizes(container), [25, 75])

    await act(() => toggle.click())
    await settle(act)
    // The preview takes its 30%, and files and code share the rest as 25 to 75.
    assert.deepEqual(sizes(container), [17.5, 52.5, 30])
    assert.equal(separators(container).length, 2)

    await act(() => toggle.click())
    assert.deepEqual(sizes(container), [25, 75])
  })

  it('stops a drag when its handle goes away while the group stays', async (t) => {
    function Editor(handle: Handle) {
      let preview = true
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              preview = false
              void handle.update()
            })}
          >
            Close preview
          </button>
          <ResizablePanelGroup>
            <ResizablePanel id="code" />
            {preview ? <ResizableHandle /> : null}
            {preview ? <ResizablePanel id="preview" /> : null}
          </ResizablePanelGroup>
        </div>
      )
    }

    let changes = 0
    let { act, container } = mount(
      t,
      <div mix={on(resizableLayoutChangeType, () => void changes++)}>
        <Editor />
      </div>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let x = separator.getBoundingClientRect().x

    await act(() => pointer(separator, 'pointerdown', x))
    await act(() => (container.querySelector('button') as HTMLButtonElement).click())
    await act(() => pointer(document, 'pointermove', x - 300))
    await act(() => pointer(document, 'pointerup', x - 300))

    assert.deepEqual(sizes(container), [100])
    assert.equal(changes, 0)
    assert.equal(container.querySelector('[data-slot="resizable-panel-group"]')?.hasAttribute('data-dragging'), false)
  })

  it("keeps the first layout's proportions when a panel joins before any handle has moved", async (t) => {
    function Editor(handle: Handle) {
      let preview = false
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              preview = !preview
              void handle.update()
            })}
          >
            Toggle preview
          </button>
          <ResizablePanelGroup>
            <ResizablePanel id="files" defaultSize="20%" />
            <ResizableHandle />
            <ResizablePanel id="code" />
            {preview ? <ResizableHandle /> : null}
            {preview ? <ResizablePanel id="preview" defaultSize="30%" /> : null}
          </ResizablePanelGroup>
        </div>
      )
    }

    let { act, container } = mount(t, <Editor />)
    await settle(act)
    let toggle = container.querySelector('button') as HTMLButtonElement
    assert.deepEqual(sizes(container), [20, 80])

    await act(() => toggle.click())
    await settle(act)
    assert.deepEqual(sizes(container), [14, 56, 30])

    await act(() => toggle.click())
    await settle(act)
    assert.deepEqual(sizes(container), [20, 80])
  })

  it('keeps the current proportions through successive panel changes', async (t) => {
    function Editor(handle: Handle) {
      let files = true
      let preview = false
      let toggle = (name: string, change: () => void) => (
        <button
          type="button"
          mix={on('click', () => {
            change()
            void handle.update()
          })}
        >
          {name}
        </button>
      )
      return () => (
        <div>
          {toggle('Toggle files', () => (files = !files))}
          {toggle('Toggle preview', () => (preview = !preview))}
          <ResizablePanelGroup>
            {files ? <ResizablePanel key="files" id="files" defaultSize="20%" /> : null}
            {files ? <ResizableHandle key="files-handle" /> : null}
            <ResizablePanel key="code" id="code" />
            {preview ? <ResizableHandle key="preview-handle" /> : null}
            {preview ? <ResizablePanel key="preview" id="preview" defaultSize="30%" /> : null}
          </ResizablePanelGroup>
        </div>
      )
    }

    let { act, container } = mount(t, <Editor />)
    await settle(act)
    let [files, preview] = [...container.querySelectorAll('button')] as [HTMLButtonElement, HTMLButtonElement]

    await act(() => preview.click())
    await settle(act)
    assert.deepEqual(sizes(container), [14, 56, 30])

    // The preview isn't new any more: code and preview share the files' 14% as 56 to 30.
    await act(() => files.click())
    await settle(act)
    assert.deepEqual(sizes(container), [65.1, 34.9])
  })

  it('stops listening once the group is removed in the middle of a drag', async (t) => {
    let observers = { observed: 0, disconnected: 0 }
    let Original = window.ResizeObserver
    window.ResizeObserver = class extends Original {
      observe(target: Element, options?: ResizeObserverOptions) {
        observers.observed++
        super.observe(target, options)
      }
      disconnect() {
        observers.disconnected++
        super.disconnect()
      }
    }
    t.after(() => {
      window.ResizeObserver = Original
    })

    let changes = 0
    let listener = () => void changes++
    document.addEventListener(resizableLayoutChangeType, listener)
    t.after(() => document.removeEventListener(resizableLayoutChangeType, listener))

    let { act, container, cleanup } = render(
      <div style={frame}>
        <Workspace />
      </div>,
    )
    await settle(act)
    let [separator] = separators(container) as [HTMLElement]
    let x = separator.getBoundingClientRect().x
    await act(() => pointer(separator, 'pointerdown', x))
    cleanup()

    pointer(document, 'pointermove', x + 100)
    pointer(document, 'pointerup', x + 100)
    assert.equal(changes, 0)
    assert.equal(observers.observed, 1)
    assert.equal(observers.disconnected, 1)
  })
})
