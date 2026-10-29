import * as assert from 'remix/assert'
import { ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { inertOthers, lockScroll, modal } from '#remixcn/lib/modal.ts'

const root = document.documentElement

function makeScrollable(t: TestContext) {
  let spacer = document.createElement('div')
  spacer.style.height = '3000px'
  document.body.append(spacer)
  t.after(() => {
    spacer.remove()
    scrollTo(0, 0)
  })
}

/** <main> with two sections, a popup inside the second, and an <aside>. */
function page(t: TestContext) {
  let main = document.createElement('main')
  main.innerHTML = '<section data-a><button>A</button></section><section data-b><div data-popup></div><p>B</p></section>'
  let aside = document.createElement('aside')
  aside.setAttribute('inert', '')
  document.body.append(main, aside)
  t.after(() => {
    main.remove()
    aside.remove()
  })
  let $ = (selector: string) => document.querySelector(selector)!
  return { main, aside, $, popup: $('[data-popup]') as HTMLElement }
}

function inertNames() {
  return [...document.querySelectorAll('[inert]')].map((element) => element.tagName.toLowerCase() + (element.getAttributeNames().find((name) => name.startsWith('data-')) ?? ''))
}

describe('lockScroll', () => {
  it('stops page scrolling until the last lock is released, then restores the styles and position', (t) => {
    makeScrollable(t)
    root.style.setProperty('overflow-y', 'scroll', 'important')
    t.after(() => root.style.removeProperty('overflow-y'))
    scrollTo(0, 200)
    let style = root.getAttribute('style')

    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()
    assert.equal(getComputedStyle(root).overflowY, 'hidden')
    assert.equal(scrollY, 200)

    unlockFirst()
    unlockFirst()
    assert.equal(getComputedStyle(root).overflowY, 'hidden')
    unlockSecond()
    assert.equal(root.getAttribute('style'), style)
    assert.equal(scrollY, 200)
  })

  it('keeps the layout from shifting when it hides a scrollbar', (t) => {
    makeScrollable(t)
    let width = root.clientWidth
    let unlock = lockScroll()
    t.after(unlock)

    assert.equal(root.clientWidth, width)
  })
})

describe('inertOthers', () => {
  it('makes everything outside the kept elements inert and restores what was inert before', (t) => {
    let { $, popup } = page(t)
    let release = inertOthers([popup])

    assert.deepEqual(inertNames(), ['sectiondata-a', 'p', 'aside'])
    assert.ok(!popup.closest('[inert]'))
    release()
    assert.deepEqual(inertNames(), ['aside'])
    assert.equal($('[data-a]').hasAttribute('inert'), false)
  })

  it('counts nested modals, so the outer one stays modal when the inner one closes', (t) => {
    let { $, popup } = page(t)
    let releaseOuter = inertOthers([$('[data-b]')])
    let releaseInner = inertOthers([popup])

    assert.deepEqual(inertNames(), ['sectiondata-a', 'p', 'aside'])
    releaseInner()
    assert.deepEqual(inertNames(), ['sectiondata-a', 'aside'])
    releaseOuter()
    releaseOuter()
    assert.deepEqual(inertNames(), ['aside'])
  })
})

describe('inertOthers with sibling modals and changing content', () => {
  function settle() {
    return new Promise((resolve) => setTimeout(resolve))
  }

  /** An outer modal in <main> and an inner one in a sibling portal, as separate body children. */
  function portals(t: TestContext) {
    let main = document.createElement('main')
    main.innerHTML = '<div data-outer><button>Outer</button></div><p>Page</p>'
    let portal = document.createElement('div')
    portal.innerHTML = '<div data-inner><button>Inner</button></div>'
    document.body.append(main, portal)
    t.after(() => {
      main.remove()
      portal.remove()
    })
    return {
      outer: main.querySelector('[data-outer]')!,
      inner: portal.querySelector('[data-inner]')!,
      outerButton: main.querySelector('button')!,
      innerButton: portal.querySelector('button')!,
    }
  }

  it('keeps the newest modal interactive when it sits in a sibling portal, and restores the outer one after', (t) => {
    let { outer, inner, outerButton, innerButton } = portals(t)
    let releaseOuter = inertOthers([outer])
    assert.ok(innerButton.closest('[inert]'))

    let releaseInner = inertOthers([inner])
    assert.equal(innerButton.closest('[inert]'), null)
    innerButton.focus()
    assert.equal(document.activeElement, innerButton)
    assert.ok(outerButton.closest('[inert]'))

    releaseInner()
    assert.equal(outerButton.closest('[inert]'), null)
    assert.ok(innerButton.closest('[inert]'))

    releaseOuter()
    assert.deepEqual(inertNames(), [])
  })

  it('keeps all of a kept element when another kept element sits inside it', (t) => {
    let popup = document.createElement('section')
    popup.innerHTML = '<button>One</button><button>Two</button>'
    document.body.append(popup)
    t.after(() => popup.remove())
    let [one, two] = popup.querySelectorAll('button')

    let release = inertOthers([popup, one])
    assert.equal(two.closest('[inert]'), null)
    two.focus()
    assert.equal(document.activeElement, two)
    release()
  })

  it('applies the newest modal again when an older one closes first', (t) => {
    let { outer, inner, innerButton } = portals(t)
    let releaseOuter = inertOthers([outer])
    let releaseInner = inertOthers([inner])

    releaseOuter()
    assert.equal(innerButton.closest('[inert]'), null)
    assert.ok(outer.closest('[inert]'))
    releaseInner()
    assert.deepEqual(inertNames(), [])
  })

  it('makes content added while open inert, and forgets content removed while open', async (t) => {
    let { $, popup } = page(t)
    let release = inertOthers([popup])

    let late = document.createElement('button')
    document.body.append(late)
    let beside = document.createElement('button')
    popup.after(beside)
    let removed = $('[data-a]')
    removed.remove()
    t.after(() => late.remove())
    await settle()

    assert.ok(late.inert && beside.inert)
    late.focus()
    assert.notEqual(document.activeElement, late)
    assert.equal(removed.hasAttribute('inert'), false)

    release()
    assert.equal(late.inert || beside.inert, false)
    let afterwards = document.createElement('button')
    document.body.append(afterwards)
    t.after(() => afterwards.remove())
    await settle()
    assert.equal(afterwards.inert, false)
  })
})

describe('modal', () => {
  function Popup(handle: Handle<{ open: boolean }>) {
    return () => <div data-popup mix={modal({ open: handle.props.open })} />
  }

  it('locks scrolling and makes the rest inert while open, and cleans up when closed or unmounted while open', async (t) => {
    let { act, root: app, cleanup } = render(<Popup open />)
    t.after(cleanup)
    let others = document.createElement('p')
    document.body.prepend(others)
    t.after(() => others.remove())

    await act(() => app.render(<Popup open={false} />))
    await act(() => app.render(<Popup open />))
    assert.ok(others.inert)
    assert.equal(getComputedStyle(root).overflowY, 'hidden')

    await act(() => app.render(<Popup open={false} />))
    assert.equal(others.inert, false)
    assert.equal(root.style.overflowY, '')

    await act(() => app.render(<Popup open />))
    await act(() => app.render(<span />))
    assert.equal(others.inert, false)
    assert.equal(root.style.overflowY, '')
  })

  it('keeps the rest of the popup interactive when keep names an element inside it', async (t) => {
    let one: Element | null = null
    let { $$, cleanup } = render(
      <div mix={modal({ keep: () => [one] })}>
        <button mix={ref((node) => (one = node))}>One</button>
        <button>Two</button>
      </div>,
    )
    t.after(cleanup)

    assert.equal($$('button')[1].closest('[inert]'), null)
  })

  it('leaves inertness to a native modal dialog and only locks scrolling', async (t) => {
    let others = document.createElement('p')
    document.body.prepend(others)
    t.after(() => others.remove())
    let { cleanup } = render(<dialog mix={modal()} />)
    t.after(cleanup)

    assert.equal(others.inert, false)
    assert.equal(getComputedStyle(root).overflowY, 'hidden')
  })
})
