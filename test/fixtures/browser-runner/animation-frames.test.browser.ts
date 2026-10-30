import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// Runs after a file whose results fill the runner's window. Once a frame
// outside the window shows content, WebKit stops its animation frames, and
// Firefox slows them to one a second, so component tests crawl until the
// runner's progress timeout.
const frame = window.frameElement as HTMLIFrameElement
const runner = window.parent

/** Counts animation frames until `target`, or until `limitMs` passes. */
function countAnimationFrames(target: number, limitMs: number) {
  return new Promise<number>((resolve) => {
    let count = 0
    let timer = setTimeout(() => resolve(count), limitMs)
    let tick = () => {
      count++
      if (count < target) return void requestAnimationFrame(tick)
      clearTimeout(timer)
      resolve(count)
    }
    requestAnimationFrame(tick)
  })
}

describe('after a window of results', () => {
  it('sits below the first window of the page', () => {
    let top = frame.getBoundingClientRect().top + runner.scrollY

    assert.ok(top >= runner.innerHeight, `the frame starts at ${top}px, inside the first ${runner.innerHeight}px`)
  })

  it('shows the whole frame in the window', () => {
    let { top, bottom } = frame.getBoundingClientRect()

    assert.ok(
      top >= 0 && bottom <= runner.innerHeight,
      `the frame spans ${top}px to ${bottom}px of a ${runner.innerHeight}px window`,
    )
  })

  it('renders a control and gets 30 animation frames within 5 seconds', async (t) => {
    let button = document.createElement('button')
    button.textContent = 'Invented control'
    document.body.append(button)
    t.after(() => button.remove())

    assert.equal(await countAnimationFrames(30, 5_000), 30)
  })
})
