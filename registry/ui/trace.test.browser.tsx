import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { collapsibleChangeType } from './collapsible.tsx'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from './trace.tsx'
import type { TraceStatus } from './trace.tsx'

// Browser tests run without theme.css, so the container sets the tokens the
// tests measure. Without --duration-normal, panels move in 0s, as with
// reduced motion.
function mount(t: TestContext, node: RemixNode) {
  let container = document.createElement('div')
  container.style.setProperty('--muted-foreground', 'rgb(100, 100, 100)')
  container.style.setProperty('--foreground', 'rgb(0, 0, 0)')
  container.style.setProperty('--destructive', 'rgb(200, 0, 0)')
  container.style.setProperty('--border', 'rgb(220, 220, 220)')
  container.style.setProperty('--spacing', '0.25rem')
  document.body.append(container)

  let result = render(node, { container })
  t.after(result.cleanup)
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function settle(act: (fn: () => unknown) => Promise<void>) {
  // A closing panel leaves after its transition, then renders once more.
  for (let i = 0; i < 3; i++) {
    await act(() => nextFrame())
  }
}

function slot(root: ParentNode, name: string) {
  return root.querySelector(`[data-slot="${name}"]`) as HTMLElement
}

/** The angle of an element's rotation in whole degrees, from its computed transform. */
function rotation(element: Element) {
  let transform = getComputedStyle(element).transform
  if (transform === 'none') return 0
  let matrix = new DOMMatrix(transform)
  return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI)
}

function button(root: ParentNode, name: string) {
  let found = [...root.querySelectorAll('button')].find((node) => node.textContent?.includes(name))
  if (!found) throw new Error(`No button "${name}"`)
  return found
}

/** A step whose status its owner changes, the way a streaming tool call does. */
function Step(handle: Handle<{ status?: TraceStatus; title: string }>) {
  return () => (
    <TraceLine status={handle.props.status}>
      <TraceIcon>
        <svg />
      </TraceIcon>
      <TraceTitle>{handle.props.title}</TraceTitle>
    </TraceLine>
  )
}

describe('Trace in the browser', () => {
  it('opens and closes a row from its trigger, and turns its chevron', async (t) => {
    let { container, act } = mount(
      t,
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>Ran node --version</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>v24.18.0</TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>,
    )
    let trigger = slot(container, 'trace-collapsible-trigger') as HTMLButtonElement
    let chevron = trigger.lastElementChild!.querySelector('svg')!

    assert.equal(rotation(chevron), 0)
    await act(() => trigger.click())

    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(slot(container, 'trace-collapsible-content-inner').textContent, 'v24.18.0')
    assert.equal(rotation(chevron), 90)

    await act(() => trigger.click())
    await settle(act)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(slot(container, 'trace-collapsible-content'), null)
  })

  it('lets its owner control a row through the change event, and nested rows report only their own', async (t) => {
    let seen: string[] = []

    function Controlled(handle: Handle) {
      let open = false

      return () => (
        <TraceCollapsible
          open={open}
          mix={on(collapsibleChangeType, (event) => {
            seen.push(`${(event.target as HTMLElement).dataset.name}:${event.open}`)
            // Nested rows' events bubble here too. Only this row's change is the owner's.
            if (event.target !== event.currentTarget) return
            open = event.open
            void handle.update()
          })}
          data-name="outer"
        >
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>Looking into the slow deploy</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <Trace>
              <TraceCollapsible data-name="inner">
                <TraceCollapsibleTrigger>
                  <TraceLine>
                    <TraceTitle>Read the build log</TraceTitle>
                  </TraceLine>
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent>Image optimization takes four minutes.</TraceCollapsibleContent>
              </TraceCollapsible>
            </Trace>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      )
    }
    let { container, act } = mount(t, <Controlled />)

    await act(() => button(container, 'Looking into').click())
    await act(() => button(container, 'Read the build log').click())

    assert.deepEqual(seen, ['outer:true', 'inner:true'])
    assert.equal(button(container, 'Looking into').getAttribute('aria-expanded'), 'true')
    assert.equal(button(container, 'Read the build log').getAttribute('aria-expanded'), 'true')
    assert.ok(container.textContent?.includes('Image optimization takes four minutes.'))
  })

  it('moves focus out of a row that closes, also from a nested row, and leaves nothing hidden to focus', async (t) => {
    let { container, act } = mount(
      t,
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>Worked for 2m 4s</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted>
          <Trace>
            <TraceCollapsible defaultOpen>
              <TraceCollapsibleTrigger>
                <TraceLine>
                  <TraceTitle>Ran 2 commands</TraceTitle>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent>
                <a href="#log">Open the log</a>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>,
    )
    let outer = button(container, 'Worked for')

    ;(container.querySelector('a') as HTMLAnchorElement).focus()
    await act(() => outer.click())
    await settle(act)

    assert.equal(document.activeElement, outer)
    let panel = slot(container, 'trace-collapsible-content')
    assert.equal(panel.hidden, true)
    assert.ok(container.querySelector('a'), 'the kept panel keeps the nested row and its link')

    // Opening it again shows the nested row as it was.
    await act(() => outer.click())
    assert.equal(button(container, 'Ran 2 commands').getAttribute('aria-expanded'), 'true')
  })

  it('keeps separate state in separate rows', async (t) => {
    let { container, act } = mount(
      t,
      <Trace>
        {['node', 'npm'].map((name) => (
          <TraceCollapsible key={name}>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceTitle>Ran {name} --version</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>{name} output</TraceCollapsibleContent>
          </TraceCollapsible>
        ))}
      </Trace>,
    )

    await act(() => button(container, 'Ran npm').click())

    assert.equal(button(container, 'Ran node').getAttribute('aria-expanded'), 'false')
    assert.equal(button(container, 'Ran npm').getAttribute('aria-expanded'), 'true')
    assert.notEqual(button(container, 'Ran node').id, button(container, 'Ran npm').id)
    assert.equal(container.textContent?.includes('node output'), false)
  })

  it('follows a changing status, and announces it only when the list asks to', async (t) => {
    function Run(handle: Handle<{ announce?: boolean }>) {
      let status: TraceStatus | undefined = 'running'

      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              status = status === 'running' ? 'error' : 'running'
              void handle.update()
            })}
          >
            Advance
          </button>
          <Trace announce={handle.props.announce}>
            <Step status={status} title={status === 'error' ? 'Failed to run pnpm lint' : 'Running pnpm lint'} />
          </Trace>
        </div>
      )
    }

    let quiet = mount(t, <Run />)
    await quiet.act(() => button(quiet.container, 'Advance').click())
    let line = slot(quiet.container, 'trace-line')
    assert.equal(line.dataset.status, 'error')
    assert.equal(slot(quiet.container, 'trace-status').textContent, ' (failed)')
    assert.equal(slot(quiet.container, 'trace-announcer'), null)

    let loud = mount(t, <Run announce />)
    let region = slot(loud.container, 'trace-announcer')
    assert.equal(region.getAttribute('role'), 'status')
    assert.equal(region.textContent, '', 'nothing is announced on the first render')

    await loud.act(() => button(loud.container, 'Advance').click())
    await loud.act(() => Promise.resolve())
    assert.equal(region.textContent, 'Failed to run pnpm lint (failed)')

    await loud.act(() => button(loud.container, 'Advance').click())
    await loud.act(() => Promise.resolve())
    assert.equal(region.textContent, 'Running pnpm lint (in progress)')
  })

  it('announces lines that change together in one message, and leaves out a list that opts out', async (t) => {
    function Run(handle: Handle) {
      let done = false

      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              done = true
              void handle.update()
            })}
          >
            Finish
          </button>
          <Trace announce>
            <Step status={done ? undefined : 'running'} title={done ? 'Ran pnpm install' : 'Running pnpm install'} />
            <Trace>
              <Step status={done ? 'pending' : undefined} title="Run pnpm test" />
            </Trace>
            <Trace announce={false}>
              <Step status={done ? 'error' : undefined} title="Failed to deploy" />
            </Trace>
          </Trace>
        </div>
      )
    }
    let { container, act } = mount(t, <Run />)
    let region = slot(container, 'trace-announcer')

    await act(() => button(container, 'Finish').click())
    await act(() => Promise.resolve())

    assert.equal(region.textContent, 'Ran pnpm install. Run pnpm test (not started)')
    assert.equal(container.querySelectorAll('[data-slot="trace-announcer"]').length, 1)
  })

  it('changes the region when the same words come again, so they are read again', async (t) => {
    function Retry(handle: Handle) {
      let status: TraceStatus = 'running'

      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              status = status === 'running' ? 'error' : 'running'
              void handle.update()
            })}
          >
            Retry
          </button>
          <Trace announce>
            <TraceLine status={status} statusLabel="">
              <TraceTitle>pnpm build</TraceTitle>
            </TraceLine>
          </Trace>
        </div>
      )
    }
    let { container, act } = mount(t, <Retry />)
    let region = slot(container, 'trace-announcer')

    await act(() => button(container, 'Retry').click())
    await act(() => Promise.resolve())
    let first = region.textContent
    await act(() => button(container, 'Retry').click())
    await act(() => Promise.resolve())

    assert.equal(first, 'pnpm build')
    assert.equal(region.textContent?.trim(), 'pnpm build')
    assert.notEqual(region.textContent, first)
  })

  it('colors lines by status with text that keeps its color on hover, and dims only the icons of a pending one', async (t) => {
    let { container } = mount(
      t,
      <Trace>
        <Step title="Ran pnpm install" />
        <Step status="error" title="Failed to run pnpm lint" />
        <Step status="pending" title="Run pnpm test" />
        <TraceLine>
          <TraceTitle>Ran pnpm test</TraceTitle>
          <TraceDescription>14s</TraceDescription>
        </TraceLine>
      </Trace>,
    )
    let [done, failed, pending, timed] = [...container.querySelectorAll('[data-slot="trace-line"]')] as HTMLElement[]
    let icon = (line: HTMLElement) => getComputedStyle(line.querySelector('[data-slot="trace-icon"]')!)

    assert.equal(getComputedStyle(done).color, 'rgb(100, 100, 100)')
    // The end-to-end tests measure the painted contrast of the mixed color.
    assert.notEqual(getComputedStyle(failed).color, 'rgb(100, 100, 100)')
    assert.equal(getComputedStyle(pending).color, 'rgb(100, 100, 100)')
    assert.equal(getComputedStyle(pending).opacity, '1')
    assert.equal(icon(pending).opacity, '0.6')
    assert.equal(icon(done).opacity, '1')
    assert.equal(getComputedStyle(slot(timed, 'trace-description')).color, 'rgb(100, 100, 100)')
    assert.equal(getComputedStyle(slot(timed, 'trace-description')).fontVariantNumeric, 'tabular-nums')
  })

  it('shimmers the title of a running line, and stops once it is done', async (t) => {
    function Run(handle: Handle) {
      let running = true
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              running = false
              void handle.update()
            })}
          >
            Finish
          </button>
          <Step status={running ? 'running' : undefined} title="Running pnpm build" />
        </div>
      )
    }
    let { container, act } = mount(t, <Run />)
    let title = slot(container, 'trace-title')

    // Browser tests can't emulate reduced motion; the end-to-end tests check it.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert.notEqual(getComputedStyle(title).animationName, 'none')
    }

    await act(() => button(container, 'Finish').click())
    assert.equal(getComputedStyle(title).animationName, 'none')
  })

  it('drops the native look of a button or link that wraps a line in a list', async (t) => {
    let { container } = mount(
      t,
      <Trace>
        <a href="#docs">
          <TraceLine>
            <TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
          </TraceLine>
        </a>
        <button type="button">
          <TraceLine>
            <TraceTitle>Explored 4 files</TraceTitle>
          </TraceLine>
        </button>
      </Trace>,
    )
    let link = getComputedStyle(container.querySelector('a')!)
    let trigger = getComputedStyle(container.querySelector('button')!)

    assert.equal(link.display, 'flex')
    assert.match(link.textDecorationLine, /none/)
    assert.equal(trigger.borderTopWidth, '0px')
    assert.equal(trigger.backgroundColor, 'rgba(0, 0, 0, 0)')
    assert.equal(trigger.paddingInlineStart, '0px')
    assert.equal(trigger.cursor, 'pointer')
    assert.equal(trigger.textAlign, 'start')
  })

  it('moves a description and a trailing icon under a long title instead of squeezing it', async (t) => {
    let { container } = mount(
      t,
      <div style={{ width: '12rem' }}>
        <Trace>
          <a href="#diff">
            <TraceLine>
              <TraceIcon>
                <svg />
              </TraceIcon>
              <TraceTitle>Edited app/login/page.tsx</TraceTitle>
              <TraceDescription>+2 −2 lines</TraceDescription>
              <TraceIcon>
                <svg />
              </TraceIcon>
            </TraceLine>
          </a>
          <TraceLine>
            <TraceTitle>Ran pnpm test</TraceTitle>
            <TraceDescription>14s</TraceDescription>
          </TraceLine>
        </Trace>
      </div>,
    )
    let [long, short] = [...container.querySelectorAll('[data-slot="trace-line"]')] as HTMLElement[]
    let box = (line: HTMLElement, name: string) => slot(line, name).getBoundingClientRect()
    let lineBox = long.getBoundingClientRect()

    // The title keeps the line, less its leading icon and the trailing one.
    assert.ok(box(long, 'trace-title').width > lineBox.width * 0.6, `title ${box(long, 'trace-title').width}px`)
    assert.ok(
      box(long, 'trace-description').top >= box(long, 'trace-title').bottom - 1,
      'the description wraps under it',
    )
    assert.ok(box(long, 'trace-description').right <= lineBox.right + 0.5)
    // A short title keeps its description beside it.
    assert.equal(Math.round(box(short, 'trace-description').top), Math.round(box(short, 'trace-title').top))
    assert.ok(box(short, 'trace-description').left - box(short, 'trace-title').right < 12)
  })

  it('keeps the leading icon beside a long title at any text size and width', async (t) => {
    let root = document.documentElement
    let fontSize = root.style.fontSize
    t.after(() => void (root.style.fontSize = fontSize))
    let { container, act } = mount(
      t,
      <div>
        {['9.3rem', '9.7rem', '10.1rem', '11.45rem', '12rem'].map((width) => (
          <div key={width} style={{ width, '--spacing': '0.25rem' }}>
            <Trace>
              <TraceCollapsible>
                <TraceCollapsibleTrigger>
                  <TraceLine>
                    <TraceIcon>
                      <svg />
                    </TraceIcon>
                    <TraceTitle>Searched for the checkout build log</TraceTitle>
                  </TraceLine>
                </TraceCollapsibleTrigger>
              </TraceCollapsible>
              <a href="#deploys">
                <TraceLine>
                  <TraceIcon>
                    <svg />
                  </TraceIcon>
                  <TraceTitle>Read the last twelve deploys</TraceTitle>
                  <TraceIcon>
                    <svg />
                  </TraceIcon>
                </TraceLine>
              </a>
            </Trace>
          </div>
        ))}
      </div>,
    )

    for (let size of ['16px', '32px', '21px']) {
      root.style.fontSize = size
      await act(() => nextFrame())
      for (let line of container.querySelectorAll<HTMLElement>('[data-slot="trace-line"]')) {
        let [icon, title] = [slot(line, 'trace-icon'), slot(line, 'trace-title')].map((n) => n.getBoundingClientRect())
        let label = `${size}, ${line.closest<HTMLElement>('[style]')?.style.width}: ${slot(line, 'trace-title').textContent}`
        assert.ok(Math.abs(icon.top - title.top) < 1, `${label}: the icon sits on the title's first line`)
      }
    }
  })

  it('wraps a long title and long detail inside a narrow list instead of overflowing it', async (t) => {
    let path = 'components/settings/notification-preferences-form-with-a-very-long-name.tsx'
    let { container } = mount(
      t,
      <div style={{ width: '12rem' }}>
        <Trace>
          <TraceCollapsible defaultOpen>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceIcon>
                  <svg />
                </TraceIcon>
                <TraceTitle>Edited {path}</TraceTitle>
                <TraceDescription>+48 −12</TraceDescription>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>{path.repeat(3)}</TraceCollapsibleContent>
          </TraceCollapsible>
        </Trace>
      </div>,
    )
    let list = slot(container, 'trace')
    let wide = [...list.querySelectorAll('*')]
      .filter((node) => node.getBoundingClientRect().right > list.getBoundingClientRect().right + 0.5)
      .map((node) => node.getAttribute('data-slot') ?? node.localName)

    assert.deepEqual(wide, [], wide.join(', '))
    assert.ok(slot(container, 'trace-title').getBoundingClientRect().height > 30, 'the title wraps')
  })
})
