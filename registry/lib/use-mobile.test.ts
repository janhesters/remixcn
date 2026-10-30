import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { MOBILE_BREAKPOINT, isMobile, mobileQuery, watchMobile } from './use-mobile.ts'

/** A window whose viewport matches the query or not, with change listeners we can count and call. */
function fakeView(matches: boolean) {
  let listeners = new Set<(event: { matches: boolean }) => void>()
  let queries: string[] = []
  let view = {
    matchMedia(query: string) {
      queries.push(query)
      return {
        get matches() {
          return matches
        },
        addEventListener(
          type: string,
          listener: (event: { matches: boolean }) => void,
          options?: { signal?: AbortSignal },
        ) {
          assert.equal(type, 'change')
          listeners.add(listener)
          options?.signal?.addEventListener('abort', () => listeners.delete(listener))
        },
      } as unknown as MediaQueryList
    },
  }
  return {
    view,
    queries,
    listeners,
    resize(next: boolean) {
      matches = next
      for (let listener of listeners) listener({ matches: next })
    },
  }
}

describe('use-mobile', () => {
  it("asks for shadcn's 768px breakpoint in rem, so the browser's text size moves it with the CSS", () => {
    assert.equal(MOBILE_BREAKPOINT, '48rem')
    assert.equal(mobileQuery, '(width < 48rem)')
  })

  it('tells whether the viewport is narrower than the breakpoint', () => {
    let narrow = fakeView(true)
    let wide = fakeView(false)

    assert.equal(isMobile(narrow.view), true)
    assert.equal(isMobile(wide.view), false)
    assert.deepEqual(narrow.queries, [mobileQuery])
  })

  it('says a viewport without matchMedia, such as on the server, is not narrow', () => {
    assert.equal(isMobile(undefined), false)
    assert.equal(isMobile({} as Window), false)
  })

  it('reports each change until the signal aborts, and returns where it starts', () => {
    let screen = fakeView(false)
    let seen: boolean[] = []
    let controller = new AbortController()

    let start = watchMobile((mobile) => seen.push(mobile), controller.signal, screen.view)
    screen.resize(true)
    screen.resize(false)
    controller.abort()
    screen.resize(true)

    assert.equal(start, false)
    assert.deepEqual(seen, [true, false])
    assert.equal(screen.listeners.size, 0)
  })

  it('adds no listener for a signal that already aborted', () => {
    let screen = fakeView(true)
    let controller = new AbortController()
    controller.abort()

    assert.equal(
      watchMobile(() => assert.fail('called'), controller.signal, screen.view),
      true,
    )
    assert.equal(screen.listeners.size, 0)
  })
})
