import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentImage,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from './attachment.tsx'
import type { AttachmentImageStatus } from './attachment.tsx'

const square =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="teal"/></svg>'
const photo = `data:image/svg+xml,${encodeURIComponent(square)}`
const broken = 'data:image/png;base64,AAAA'

function mount(t: TestContext, node: RemixNode) {
  // theme.css sizes boxes by their border, as every RemixCN app does.
  let reset = document.createElement('style')
  reset.textContent = '*, ::before, ::after { box-sizing: border-box; }'
  document.head.append(reset)
  let result = render(node)
  t.after(() => {
    result.cleanup()
    reset.remove()
  })
  return result
}

async function waitFor(condition: () => boolean, message: string) {
  let deadline = performance.now() + 3000
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${message}`)
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

async function frames(count: number) {
  for (let index = 0; index < count; index++) await new Promise((resolve) => requestAnimationFrame(resolve))
}

/** Records the object URLs the page creates and releases, and restores the real functions after the test. */
function trackObjectUrls(t: TestContext) {
  let created: string[] = []
  let revoked: string[] = []
  let { createObjectURL, revokeObjectURL } = URL
  URL.createObjectURL = (object: Blob | MediaSource) => {
    let url = createObjectURL(object)
    created.push(url)
    return url
  }
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url)
    revokeObjectURL(url)
  }
  t.after(() => Object.assign(URL, { createObjectURL, revokeObjectURL }))
  return { created, revoked }
}

// Browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  '--spacing': '4px',
  '--radius-xl': '12px',
  '--radius-lg': '8px',
  '--radius-md': '6px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
  '--text-xs': '12px',
  '--text-xs--line-height': '16px',
  '--border': 'rgb(220, 220, 220)',
  '--card': 'rgb(255, 255, 255)',
  '--muted': 'rgb(241, 241, 241)',
  '--destructive': 'rgb(220, 40, 40)',
  '--foreground': 'rgb(10, 10, 10)',
}

function image(container: HTMLElement) {
  return container.querySelector<HTMLImageElement>('[data-slot="attachment-image"]')
}

interface PreviewProps {
  initial: { src?: string; file?: Blob }
  next: { src?: string; file?: Blob }
  statuses: AttachmentImageStatus[]
}

// Swaps the preview and removes the attachment, as a composer does.
function Preview(handle: Handle<PreviewProps>) {
  let current = handle.props.initial
  let removed = false

  return () => (
    <div style={tokens}>
      <button
        type="button"
        data-action="swap"
        mix={on('click', () => {
          current = current === handle.props.initial ? handle.props.next : handle.props.initial
          void handle.update()
        })}
      >
        Swap
      </button>
      <button
        type="button"
        data-action="remove"
        mix={on('click', () => {
          removed = true
          void handle.update()
        })}
      >
        Remove
      </button>
      <button
        type="button"
        data-action="swap-and-remove"
        mix={on('click', () => {
          current = current === handle.props.initial ? handle.props.next : handle.props.initial
          void handle.update()
          // Removed before the swap's update is on the page.
          queueMicrotask(() => {
            removed = true
            void handle.update()
          })
        })}
      >
        Swap and remove
      </button>
      {removed ? null : (
        <Attachment>
          <AttachmentMedia variant="image">
            <svg data-fallback="" />
            <AttachmentImage
              {...current}
              alt="Screenshot of the invoice list"
              onLoadingStatusChange={(status) => handle.props.statuses.push(status)}
            />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>invoice-list.png</AttachmentTitle>
          </AttachmentContent>
        </Attachment>
      )}
    </div>
  )
}

function click(container: HTMLElement, action: string) {
  ;(container.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click()
}

describe('Attachment in the browser', () => {
  it('shows a loaded image over the icon, and hides a failed one so the icon shows', async (t) => {
    let statuses: AttachmentImageStatus[] = []
    let { container } = mount(t, <Preview initial={{ src: photo }} next={{ src: broken }} statuses={statuses} />)

    await waitFor(() => image(container)?.dataset.status === 'loaded', 'the image loads')
    let media = container.querySelector('[data-slot="attachment-media"]')!.getBoundingClientRect()
    let shown = image(container)!.getBoundingClientRect()
    assert.deepEqual([shown.width, shown.height], [media.width, media.height])
    assert.equal(image(container)!.hidden, false)

    click(container, 'swap')
    await waitFor(() => image(container)?.dataset.status === 'error', 'the replaced image fails')
    assert.equal(image(container)!.hidden, true)
    assert.equal(image(container)!.alt, 'Screenshot of the invoice list')

    click(container, 'swap')
    await waitFor(() => image(container)?.dataset.status === 'loaded', 'the image loads again')
    assert.equal(image(container)!.hidden, false)
    assert.equal(statuses.at(-1), 'loaded')
    assert.ok(statuses.includes('error'))
  })

  it('previews a local file through an object URL, and releases it when the file is replaced or removed', async (t) => {
    let urls = trackObjectUrls(t)
    let first = new Blob([square], { type: 'image/svg+xml' })
    let second = new Blob([square.replace('teal', 'navy')], { type: 'image/svg+xml' })
    let statuses: AttachmentImageStatus[] = []
    let { container } = mount(t, <Preview initial={{ file: first }} next={{ file: second }} statuses={statuses} />)

    await waitFor(() => image(container)?.dataset.status === 'loaded', 'the local file shows')
    assert.equal(urls.created.length, 1)
    assert.equal(image(container)!.src, urls.created[0])
    assert.deepEqual(urls.revoked, [])

    click(container, 'swap')
    await waitFor(() => urls.created.length === 2 && image(container)?.src === urls.created[1], 'the new file shows')
    await waitFor(() => urls.revoked.length === 1, 'the first URL is released')
    assert.deepEqual(urls.revoked, [urls.created[0]])

    click(container, 'remove')
    await waitFor(() => urls.revoked.length === 2, 'the second URL is released')
    assert.deepEqual(urls.revoked, urls.created)
  })

  it('releases every object URL when it is removed right after its file changed', async (t) => {
    let urls = trackObjectUrls(t)
    let first = new Blob([square], { type: 'image/svg+xml' })
    let second = new Blob([square.replace('teal', 'navy')], { type: 'image/svg+xml' })
    let { container } = mount(t, <Preview initial={{ file: first }} next={{ file: second }} statuses={[]} />)

    await waitFor(() => image(container)?.dataset.status === 'loaded', 'the local file shows')
    click(container, 'swap-and-remove')
    await waitFor(() => image(container) === null, 'the preview is removed')
    await frames(5)

    assert.ok(urls.created.length >= 1)
    assert.deepEqual([...urls.revoked].sort(), [...urls.created].sort())
  })

  it('reports nothing after it is removed, even when the image finishes loading later', async (t) => {
    let statuses: AttachmentImageStatus[] = []
    let file = new Blob([square], { type: 'image/svg+xml' })
    let { container } = mount(t, <Preview initial={{ file }} next={{ file }} statuses={statuses} />)

    // Remove it as soon as its image exists, before it has loaded.
    await waitFor(() => image(container) !== null, 'the preview renders')
    click(container, 'remove')
    let seen = statuses.length
    await frames(10)

    assert.equal(image(container), null)
    assert.equal(statuses.length, seen, `reported ${statuses.slice(seen).join(', ')} after removal`)
  })

  it('treats a file that is not an image as a failed preview', async (t) => {
    let statuses: AttachmentImageStatus[] = []
    let file = new Blob(['not an image'], { type: 'image/png' })
    let { container } = mount(t, <Preview initial={{ file }} next={{ file }} statuses={statuses} />)

    await waitFor(() => image(container)?.dataset.status === 'error', 'the preview fails')
    assert.equal(image(container)!.hidden, true)
  })

  it('wraps a long name on a narrow screen and keeps the remove action in view', async (t) => {
    let name = 'quarterly-revenue-reconciliation-for-every-region-and-every-currency-final-v12.xlsx'
    let { container } = mount(
      t,
      <div style={{ ...tokens, width: '320px' }}>
        <Attachment style={{ width: '100%' }}>
          <AttachmentMedia>
            <svg />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{name}</AttachmentTitle>
            <AttachmentDescription>Spreadsheet · 48 KB</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label={`Remove ${name}`}>
              <svg />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      </div>,
    )
    let card = container.querySelector('[data-slot="attachment"]') as HTMLElement
    let title = container.querySelector('[data-slot="attachment-title"]')!.getBoundingClientRect()
    let action = container.querySelector('[data-slot="attachment-action"]')!.getBoundingClientRect()
    let bounds = card.getBoundingClientRect()

    assert.ok(title.height > 20, 'the name wraps')
    assert.ok(action.right <= bounds.right && action.left >= title.right, 'the action stays beside the name')
    assert.ok(card.scrollWidth <= card.clientWidth + 2, `card content is ${card.scrollWidth}px wide`)
    assert.ok(bounds.width <= 320)
  })

  it('moves the content onto its own line when the card is too narrow for it beside the media', async (t) => {
    let { container } = mount(
      t,
      <div style={{ ...tokens, width: '150px' }}>
        <Attachment style={{ width: '100%' }}>
          <AttachmentMedia>
            <svg />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>sales-dashboard.pdf</AttachmentTitle>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Remove sales-dashboard.pdf">
              <svg />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      </div>,
    )
    let media = container.querySelector('[data-slot="attachment-media"]')!.getBoundingClientRect()
    let content = container.querySelector('[data-slot="attachment-content"]')!.getBoundingClientRect()
    let card = container.querySelector('[data-slot="attachment"]')!.getBoundingClientRect()

    assert.ok(content.top >= media.bottom, 'the content wraps below the media')
    assert.ok(content.width >= 96, `the content is ${content.width}px wide`)
    assert.ok(content.right <= card.right)
  })

  it('keeps the actions above the trigger, so a click on an action never activates the card', async (t) => {
    let opened = 0
    let removed = 0
    let { container } = mount(
      t,
      <div style={tokens}>
        <Attachment>
          <AttachmentMedia>
            <svg />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>research-summary.pdf</AttachmentTitle>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Remove research-summary.pdf" mix={on('click', () => void removed++)}>
              <svg />
            </AttachmentAction>
          </AttachmentActions>
          <AttachmentTrigger aria-label="Preview research-summary.pdf" mix={on('click', () => void opened++)} />
        </Attachment>
      </div>,
    )
    let card = container.querySelector('[data-slot="attachment"]')!.getBoundingClientRect()
    let trigger = container.querySelector('[data-slot="attachment-trigger"]')!.getBoundingClientRect()
    let action = container.querySelector('[data-slot="attachment-action"]')!
    let title = container.querySelector('[data-slot="attachment-title"]')!.getBoundingClientRect()
    let center = (box: DOMRect) => [box.left + box.width / 2, box.top + box.height / 2] as const

    // The trigger fills the card inside its 1px border.
    assert.deepEqual([trigger.width, trigger.height], [card.width - 2, card.height - 2])
    let atAction = document.elementFromPoint(...center(action.getBoundingClientRect()))
    let atTitle = document.elementFromPoint(...center(title))
    assert.ok(action.contains(atAction), `found ${atAction?.outerHTML}`)
    ;(atAction as HTMLElement).click()
    ;(atTitle as HTMLElement).click()
    assert.deepEqual([removed, opened], [1, 1])
  })

  it('puts the actions over the top end of a vertical attachment, mirrored in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        {(['ltr', 'rtl'] as const).map((dir) => (
          <Attachment key={dir} dir={dir} orientation="vertical">
            <AttachmentMedia variant="image">
              <AttachmentImage src={photo} alt="" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>desk.png</AttachmentTitle>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label="Remove desk.png">
                <svg />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        ))}
      </div>,
    )
    let [ltr, rtl] = [...container.querySelectorAll('[data-slot="attachment"]')]
    let place = (root: Element) => {
      let card = root.getBoundingClientRect()
      let actions = root.querySelector('[data-slot="attachment-actions"]')!.getBoundingClientRect()
      return { top: Math.round(actions.top - card.top), start: Math.round(card.right - actions.right) }
    }

    assert.equal(Math.round(ltr.getBoundingClientRect().width), 120)
    // 12px inside the card's 1px border.
    assert.deepEqual(place(ltr), { top: 13, start: 13 })
    let mirrored = rtl.getBoundingClientRect()
    let rtlActions = rtl.querySelector('[data-slot="attachment-actions"]')!.getBoundingClientRect()
    assert.equal(Math.round(rtlActions.left - mirrored.left), 13)
  })

  it('marks idle with a dashed border and error in red, and dims an image until it is done', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        {(['idle', 'uploading', 'error', 'done'] as const).map((state) => (
          <Attachment key={state} state={state}>
            <AttachmentMedia variant="image" />
            <AttachmentContent>
              <AttachmentTitle>{state}</AttachmentTitle>
              <AttachmentDescription>{state}</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </div>,
    )
    let [idle, uploading, error, done] = [...container.querySelectorAll('[data-slot="attachment"]')]
    let style = (root: Element, slot: string) => getComputedStyle(root.querySelector(`[data-slot="${slot}"]`)!)

    assert.equal(getComputedStyle(idle).borderTopStyle, 'dashed')
    assert.equal(getComputedStyle(done).borderTopStyle, 'solid')
    assert.notEqual(getComputedStyle(error).borderTopColor, getComputedStyle(done).borderTopColor)
    assert.notEqual(style(error, 'attachment-description').color, style(done, 'attachment-description').color)
    assert.equal(style(uploading, 'attachment-media').opacity, '0.6')
    assert.equal(style(done, 'attachment-media').opacity, '1')
    assert.equal(style(idle, 'attachment-media').opacity, '1')
    // The title shimmers only while the file uploads or processes.
    assert.equal(style(uploading, 'attachment-title').backgroundClip, 'text')
    assert.notEqual(style(done, 'attachment-title').backgroundClip, 'text')
  })

  it('keeps each attachment in a group at its width, as a snap point in a row that scrolls', async (t) => {
    let { container } = mount(
      t,
      <div style={{ ...tokens, width: '320px' }}>
        <AttachmentGroup>
          {['a.pdf', 'b.pdf', 'c.pdf'].map((name) => (
            <Attachment key={name} style={{ width: '16rem' }}>
              <AttachmentContent>
                <AttachmentTitle>{name}</AttachmentTitle>
              </AttachmentContent>
            </Attachment>
          ))}
        </AttachmentGroup>
      </div>,
    )
    let group = container.querySelector('[data-slot="attachment-group"]') as HTMLElement
    let first = container.querySelector('[data-slot="attachment"]') as HTMLElement

    assert.equal(Math.round(first.getBoundingClientRect().width), 256)
    assert.ok(group.scrollWidth > group.clientWidth, 'the row scrolls')
    assert.equal(group.getBoundingClientRect().width, 320)
    assert.equal(getComputedStyle(first).scrollSnapAlign, 'start')
  })
})
