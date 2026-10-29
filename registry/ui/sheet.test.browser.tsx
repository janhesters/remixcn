import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet.tsx'
import type { SheetSide } from './sheet.tsx'

// Browser tests run without theme.css, so the tokens the layout reads are set here.
const tokens = css({ '--spacing': '0.25rem', '--radius-md': '0.25rem', '--text-sm': '0.875rem' })

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div mix={tokens}>{node}</div>)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
  })
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function button(name: string, root: ParentNode = document) {
  let found = [...root.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

const sides: SheetSide[] = ['top', 'right', 'bottom', 'left']

function FiltersSheet(side: SheetSide, paragraphs: number) {
  return (
    <Sheet>
      <SheetTrigger>Filters</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Filter invoices</SheetTitle>
          <SheetDescription>Show only the invoices you need.</SheetDescription>
        </SheetHeader>
        {Array.from({ length: paragraphs }, (_, index) => (
          <p key={index}>Invoice note {index + 1}: paid on time, reminder sent once, archived after a year.</p>
        ))}
        <SheetFooter>
          <SheetClose>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet in the browser', () => {
  for (let side of sides) {
    it(`opens as a modal dialog on the ${side} edge, named by its title`, async (t) => {
      let { $, act } = mount(t, FiltersSheet(side, 1))
      let dialog = $('dialog') as HTMLDialogElement

      await act(() => button('Filters').click())
      await nextFrame()
      assert.ok(dialog.matches(':modal'))
      let rect = dialog.getBoundingClientRect()
      let edges = { top: rect.top, left: rect.left, bottom: innerHeight - rect.bottom, right: innerWidth - rect.right }
      assert.ok(Math.abs(edges[side]) < 1, `touches the ${side} edge: ${JSON.stringify(edges)}`)
      assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent, 'Filter invoices')

      await act(() => button('Done').click())
      assert.equal(dialog.open, false)
    })
  }

  for (let side of sides) {
    it(`keeps the close button in view and the name in place while long content scrolls, on the ${side} edge`, async (t) => {
      let { $, act } = mount(t, FiltersSheet(side, 60))
      let dialog = $('dialog') as HTMLDialogElement

      await act(() => button('Filters').click())
      await nextFrame()
      assert.ok(dialog.scrollHeight > dialog.clientHeight, 'the content is longer than the sheet')
      let labelledBy = dialog.getAttribute('aria-labelledby')

      dialog.scrollTop = dialog.scrollHeight
      await nextFrame()
      let close = button('Close', dialog)
      let sheet = dialog.getBoundingClientRect()
      let corner = close.getBoundingClientRect()
      assert.ok(
        corner.top >= sheet.top && corner.bottom <= sheet.bottom,
        `the close button stays inside the visible sheet: ${corner.top}–${corner.bottom} in ${sheet.top}–${sheet.bottom}`,
      )
      let hit = document.elementFromPoint(corner.left + corner.width / 2, corner.top + corner.height / 2)
      assert.ok(close.contains(hit), 'nothing covers the close button')
      assert.equal(dialog.getAttribute('aria-labelledby'), labelledBy)

      await act(() => close.click())
      assert.equal(dialog.open, false)
    })
  }

  it('slides from its edge and fades as it opens', async (t) => {
    let { $, act } = mount(t, FiltersSheet('left', 1))
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Filters').click())
    let style = getComputedStyle(dialog)
    assert.ok(style.transitionProperty.includes('translate'), style.transitionProperty)
    assert.ok(style.transitionProperty.includes('opacity'), style.transitionProperty)
  })
})
