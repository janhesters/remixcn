import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Avatar, AvatarFallback, AvatarImage } from './avatar.tsx'
import type { AvatarSize, ImageLoadingStatus } from './avatar.tsx'

const photo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="teal"/></svg>',
)}`
const broken = 'data:image/png;base64,AAAA'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

async function waitFor(condition: () => boolean, message: string) {
  let deadline = performance.now() + 3000
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${message}`)
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

/** Reads what a user sees and what assistive technology gets from one avatar. */
function state(root: Element) {
  let image = root.querySelector('img')
  let fallback = root.querySelector('[data-slot="avatar-fallback"]')
  return {
    image: !image
      ? 'none'
      : image.hidden
        ? 'hidden'
        : image.getAttribute('aria-hidden') === 'true'
          ? 'unnamed'
          : 'shown',
    fallback: fallback ? fallback.textContent : null,
  }
}

function avatar(container: HTMLElement, index = 0) {
  let root = container.querySelectorAll('[data-slot="avatar"]')[index]
  assert.ok(root, `no avatar ${index}`)
  return root
}

interface PickerProps {
  initial: string
  next: string
  keyed?: boolean
  statuses?: ImageLoadingStatus[]
}

// Swaps the image source with a button, as a profile form does after an upload.
function Picker(handle: Handle<PickerProps>) {
  let src = handle.props.initial
  let size: AvatarSize = 'default'

  return () => (
    <div>
      <button
        type="button"
        data-action="swap"
        mix={on('click', () => {
          src = src === handle.props.initial ? handle.props.next : handle.props.initial
          void handle.update()
        })}
      >
        Swap
      </button>
      <button
        type="button"
        data-action="resize"
        mix={on('click', () => {
          size = size === 'default' ? 'lg' : 'default'
          void handle.update()
        })}
      >
        Resize
      </button>
      <Avatar size={size}>
        <AvatarImage
          key={handle.props.keyed ? src : undefined}
          src={src}
          alt="Ada Lovelace"
          onLoadingStatusChange={(status) => handle.props.statuses?.push(status)}
        />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
    </div>
  )
}

function click(container: HTMLElement, action: string) {
  ;(container.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click()
}

describe('Avatar in the browser', () => {
  it('shows a loaded image, names the avatar by its alt text, and drops the fallback', async (t) => {
    let statuses: ImageLoadingStatus[] = []
    let { container } = mount(t, <Picker initial={photo} next={broken} statuses={statuses} />)

    await waitFor(() => state(avatar(container)).image === 'shown', 'the image loads')

    assert.deepEqual(state(avatar(container)), { image: 'shown', fallback: null })
    assert.equal(statuses.at(-1), 'loaded')
  })

  it('swaps a failed image for the fallback, so no broken image or alt text shows', async (t) => {
    let statuses: ImageLoadingStatus[] = []
    let { container } = mount(t, <Picker initial={broken} next={photo} statuses={statuses} />)

    await waitFor(() => state(avatar(container)).image === 'hidden', 'the image fails')

    assert.deepEqual(state(avatar(container)), { image: 'hidden', fallback: 'AL' })
    assert.equal(statuses.at(-1), 'error')
  })

  it('follows a changed source, both ways', async (t) => {
    let { container, act } = mount(t, <Picker initial={photo} next={broken} />)
    await waitFor(() => state(avatar(container)).image === 'shown', 'the first image loads')

    await act(() => click(container, 'swap'))
    await waitFor(() => state(avatar(container)).image === 'hidden', 'the new source fails')
    assert.equal(state(avatar(container)).fallback, 'AL')

    await act(() => click(container, 'swap'))
    await waitFor(() => state(avatar(container)).image === 'shown', 'the first source loads again')
    assert.equal(state(avatar(container)).fallback, null)
  })

  it('ignores a late load event for an image it has replaced', async (t) => {
    let { container, act } = mount(t, <Picker initial={photo} next={broken} keyed />)
    await waitFor(() => state(avatar(container)).image === 'shown', 'the first image loads')
    let replaced = avatar(container).querySelector('img')!

    await act(() => click(container, 'swap'))
    await waitFor(() => state(avatar(container)).image === 'hidden', 'the new image fails')
    assert.notEqual(avatar(container).querySelector('img'), replaced)

    await act(() => replaced.dispatchEvent(new Event('load')))

    assert.deepEqual(state(avatar(container)), { image: 'hidden', fallback: 'AL' })
  })

  it('ignores a late load event for the source it had before on the same image', async (t) => {
    let { container, act } = mount(t, <Picker initial={photo} next={broken} />)
    await waitFor(() => state(avatar(container)).image === 'shown', 'the first image loads')
    let image = avatar(container).querySelector('img')!

    await act(() => click(container, 'swap'))
    await waitFor(() => state(avatar(container)).image === 'hidden', 'the new source fails')
    await act(() => image.dispatchEvent(new Event('load')))

    assert.deepEqual(state(avatar(container)), { image: 'hidden', fallback: 'AL' })
  })

  it('keeps its status when the avatar renders again, and keeps its box size while the image loads or fails', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <Picker initial={photo} next={broken} />
        <Picker initial={broken} next={photo} />
      </div>,
    )
    let [loaded, failed] = [avatar(container, 0), avatar(container, 1)]
    let before = failed.getBoundingClientRect()
    await waitFor(() => state(loaded).image === 'shown' && state(failed).image === 'hidden', 'both settle')

    // Each instance keeps its own status.
    assert.deepEqual(
      [state(loaded), state(failed)],
      [
        { image: 'shown', fallback: null },
        { image: 'hidden', fallback: 'AL' },
      ],
    )
    let after = failed.getBoundingClientRect()
    assert.deepEqual([after.width, after.height], [before.width, before.height])
    assert.equal(loaded.getBoundingClientRect().width, after.width)

    await act(() => click(container, 'resize'))

    assert.equal(loaded.getAttribute('data-size'), 'lg')
    assert.deepEqual(state(loaded), { image: 'shown', fallback: null })
  })

  it('shows the fallback again when the image is removed', async (t) => {
    function Removable(handle: Handle) {
      let showImage = true
      return () => (
        <div>
          <button
            type="button"
            data-action="remove"
            mix={on('click', () => {
              showImage = false
              void handle.update()
            })}
          >
            Remove photo
          </button>
          <Avatar>
            {showImage ? <AvatarImage src={photo} alt="Ada Lovelace" /> : null}
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
        </div>
      )
    }
    let { container, act } = mount(t, <Removable />)
    await waitFor(() => state(avatar(container)).image === 'shown', 'the image loads')

    await act(() => click(container, 'remove'))

    assert.deepEqual(state(avatar(container)), { image: 'none', fallback: 'AL' })
  })

  it('keeps the fallback delay next to a style string you pass', async (t) => {
    let { container } = mount(
      t,
      <Avatar>
        <AvatarFallback delay={600} style="color: rgb(255, 0, 0)">
          AL
        </AvatarFallback>
      </Avatar>,
    )
    let fallback = container.querySelector('[data-slot="avatar-fallback"]')!

    assert.equal(getComputedStyle(fallback).animationDuration, '0.6s')
    assert.equal(getComputedStyle(fallback).color, 'rgb(255, 0, 0)')
  })

  it('stacks the image over the fallback in a box of a fixed size', async (t) => {
    let { container } = mount(
      t,
      <Avatar style={{ '--spacing': '4px' }}>
        <AvatarImage src={photo} alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    )
    let root = avatar(container)
    let image = root.querySelector('img')!

    assert.equal(getComputedStyle(image).position, 'absolute')
    assert.deepEqual([root.getBoundingClientRect().width, root.getBoundingClientRect().height], [32, 32])
    await waitFor(() => state(root).image === 'shown', 'the image loads')
    assert.deepEqual([image.getBoundingClientRect().width, image.getBoundingClientRect().height], [32, 32])
  })
})
