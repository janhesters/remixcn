import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  adjustLayout,
  checkPanels,
  fitLayout,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  resolveBounds,
  separatorValues,
} from './resizable.tsx'
import type { PanelBounds, PanelConstraints, ResizableLayout, ResizableMeasure } from './resizable.tsx'

// A group 1000px wide on a page with 16px text, so 1% is 10px and 1rem is 16px.
const measure: ResizableMeasure = {
  panelSpace: 1000,
  rootFontSize: 16,
  fontSize: 16,
  viewportWidth: 1280,
  viewportHeight: 800,
}

function bounds(...panels: Partial<PanelBounds>[]): PanelBounds[] {
  return panels.map((panel, index) => ({
    id: `p${index}`,
    defaultSize: undefined,
    min: 0,
    max: 100,
    collapsible: false,
    collapsedSize: 0,
    ...panel,
  }))
}

// Rounds the numbers of a layout or of bounds to three decimals, so float noise doesn't count.
function rounded<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === 'number' ? Math.round(item * 1000) / 1000 : item]),
  ) as T
}

describe('checkPanels', () => {
  it('accepts percentages, unitless percentages, pixels as numbers or strings, and font and viewport units', () => {
    let panels: PanelConstraints[] = [
      { id: 'a', defaultSize: '25%', minSize: '10', maxSize: 600 },
      { id: 'b', minSize: '200px', maxSize: '40rem' },
      { id: 'c', minSize: '2em', maxSize: '50vw', collapsible: true, collapsedSize: '1vh' },
    ]

    assert.doesNotThrow(() => checkPanels(panels))
  })

  it('rejects a size it cannot read, naming the panel and the prop', () => {
    assert.throws(() => checkPanels([{ id: 'nav', minSize: 'wide' as never }]), /nav.*minSize.*"wide"/)
    assert.throws(() => checkPanels([{ id: 'nav', maxSize: '12pt' as never }]), /nav.*maxSize/)
    assert.throws(() => checkPanels([{ id: 'nav', defaultSize: Number.NaN }]), /nav.*defaultSize/)
    assert.throws(() => checkPanels([{ id: 'nav', defaultSize: -5 }]), /nav.*defaultSize.*negative/)
    assert.throws(() => checkPanels([{ id: 'nav', maxSize: '120%' }]), /nav.*maxSize.*more than 100%/)
  })

  it('rejects bounds that contradict each other in the same unit', () => {
    assert.throws(() => checkPanels([{ id: 'nav', minSize: '60%', maxSize: '40%' }]), /nav.*minSize.*maxSize/)
    assert.throws(() => checkPanels([{ id: 'nav', minSize: 300, maxSize: '200px' }]), /nav.*minSize.*maxSize/)
    assert.throws(
      () => checkPanels([{ id: 'nav', collapsible: true, collapsedSize: '30%', minSize: '20%' }]),
      /nav.*collapsedSize.*minSize/,
    )
    assert.throws(() => checkPanels([{ id: 'nav', defaultSize: '10%', minSize: '20%' }]), /nav.*defaultSize.*minSize/)
    assert.throws(() => checkPanels([{ id: 'nav', defaultSize: '90%', maxSize: '50%' }]), /nav.*defaultSize.*maxSize/)
  })

  it('lets a collapsible panel start collapsed below its minimum', () => {
    assert.doesNotThrow(() =>
      checkPanels([{ id: 'nav', collapsible: true, collapsedSize: '4%', minSize: '20%', defaultSize: '4%' }]),
    )
  })

  it('rejects a group whose minimums or maximums cannot fill it', () => {
    assert.throws(
      () =>
        checkPanels([
          { id: 'a', minSize: '60%' },
          { id: 'b', minSize: '50%' },
        ]),
      /minimum sizes add up to 110%/,
    )
    assert.throws(
      () =>
        checkPanels([
          { id: 'a', maxSize: '30%' },
          { id: 'b', maxSize: '40%' },
        ]),
      /maximum sizes add up to 70%/,
    )
  })

  it('leaves mixed units that only the browser can compare to resolveBounds', () => {
    assert.doesNotThrow(() => checkPanels([{ id: 'a', minSize: '300px', maxSize: '20%' }, { id: 'b' }]))
    assert.doesNotThrow(() =>
      checkPanels([
        { id: 'a', maxSize: '30%' },
        { id: 'b', maxSize: '200px' },
      ]),
    )
  })

  it('rejects two panels with the same id', () => {
    assert.throws(() => checkPanels([{ id: 'a' }, { id: 'a' }]), /two panels with the id "a"/)
  })
})

describe('resolveBounds', () => {
  it('turns every size into a percentage of the panel space', () => {
    let [panel] = resolveBounds(
      [
        { id: 'a', defaultSize: 250, minSize: '10rem', maxSize: '50vw', collapsible: true, collapsedSize: '2em' },
        { id: 'b' },
      ],
      measure,
    )

    assert.deepEqual(rounded(panel), {
      id: 'a',
      defaultSize: 25,
      min: 16,
      max: 64,
      collapsible: true,
      collapsedSize: 3.2,
    })
  })

  it('defaults to no minimum, the whole group as maximum, and a collapsed size of 0', () => {
    assert.deepEqual(resolveBounds([{ id: 'a' }], measure), [
      { id: 'a', defaultSize: undefined, min: 0, max: 100, collapsible: false, collapsedSize: 0 },
    ])
  })

  it('ignores sizes that need a measurement on the server, where the group has no size yet', () => {
    let [panel] = resolveBounds([{ id: 'a', defaultSize: 240, minSize: '10rem', maxSize: '40%' }, { id: 'b' }])

    assert.deepEqual(panel, { id: 'a', defaultSize: undefined, min: 0, max: 40, collapsible: false, collapsedSize: 0 })
  })

  it('keeps a pixel minimum that outgrows a percentage maximum in a small group', () => {
    let [panel] = resolveBounds([{ id: 'a', minSize: 300, maxSize: '20%' }, { id: 'b' }], measure)

    assert.equal(panel.min, 30)
    assert.equal(panel.max, 30)
  })

  it('shrinks pixel minimums that no longer fit, keeping their proportions', () => {
    let small = { ...measure, panelSpace: 300 }
    let panels = resolveBounds(
      [
        { id: 'a', minSize: 200 },
        { id: 'b', minSize: 200 },
      ],
      small,
    )

    assert.deepEqual(
      panels.map((panel) => panel.min),
      [50, 50],
    )
  })

  it('grows maximums that no longer fill the group', () => {
    let wide = { ...measure, panelSpace: 2000 }
    let panels = resolveBounds(
      [
        { id: 'a', maxSize: 500 },
        { id: 'b', maxSize: 500 },
      ],
      wide,
    )

    assert.deepEqual(
      panels.map((panel) => panel.max),
      [50, 50],
    )
  })
})

describe('fitLayout', () => {
  it('starts from the default sizes and shares what is left between panels without one', () => {
    let layout = fitLayout(bounds({ defaultSize: 20 }, {}, {}), {})

    assert.deepEqual(layout, { p0: 20, p1: 40, p2: 40 })
  })

  it('scales default sizes that do not add up to 100%', () => {
    let layout = fitLayout(bounds({ defaultSize: 30 }, { defaultSize: 30 }), {})

    assert.deepEqual(layout, { p0: 50, p1: 50 })
  })

  it('prefers a stored layout over the default sizes', () => {
    let layout = fitLayout(bounds({ defaultSize: 30 }, { defaultSize: 70 }), { p0: 45, p1: 55 })

    assert.deepEqual(layout, { p0: 45, p1: 55 })
  })

  it('keeps every panel within its bounds and gives the difference to its neighbors', () => {
    let layout = fitLayout(bounds({ min: 30 }, { max: 50 }, {}), { p0: 10, p1: 80, p2: 10 })

    assert.deepEqual(rounded(layout), { p0: 30, p1: 50, p2: 20 })
  })

  it('snaps a collapsible panel below its minimum to collapsed or to its minimum, whichever is nearer', () => {
    let panels = bounds({ collapsible: true, collapsedSize: 0, min: 20 }, {})

    assert.deepEqual(fitLayout(panels, { p0: 8, p1: 92 }), { p0: 0, p1: 100 })
    assert.deepEqual(fitLayout(panels, { p0: 12, p1: 88 }), { p0: 20, p1: 80 })
  })

  it('gives an added panel its default size and shrinks the others in proportion', () => {
    let layout = fitLayout(bounds({ id: 'a' }, { id: 'new', defaultSize: 20 }, { id: 'b' }), { a: 25, b: 75 })

    assert.deepEqual(layout, { a: 20, new: 20, b: 60 })
  })

  it('gives an added panel without a default an equal share', () => {
    let layout = fitLayout(bounds({ id: 'a' }, { id: 'b' }, { id: 'new' }), { a: 50, b: 50 })

    assert.deepEqual(rounded(layout), { a: 33.333, b: 33.333, new: 33.333 })
  })

  it("shares a removed panel's space between the others in proportion", () => {
    let layout = fitLayout(bounds({ id: 'a' }, { id: 'c' }), { a: 20, b: 40, c: 40 })

    assert.deepEqual(rounded(layout), { a: 33.333, c: 66.667 })
  })
})

describe('adjustLayout', () => {
  it('grows the panel before a separator and shrinks the one after it', () => {
    let panels = bounds({}, {})

    assert.deepEqual(adjustLayout(panels, { p0: 50, p1: 50 }, 0, 10, 'pointer'), { p0: 60, p1: 40 })
    assert.deepEqual(adjustLayout(panels, { p0: 50, p1: 50 }, 0, -10, 'pointer'), { p0: 40, p1: 60 })
  })

  it('stops at the minimum of the shrinking panel and the maximum of the growing one', () => {
    assert.deepEqual(adjustLayout(bounds({}, { min: 30 }), { p0: 50, p1: 50 }, 0, 40, 'pointer'), { p0: 70, p1: 30 })
    assert.deepEqual(adjustLayout(bounds({ max: 60 }, {}), { p0: 50, p1: 50 }, 0, 40, 'pointer'), { p0: 60, p1: 40 })
  })

  it('takes space from farther panels once the nearest one reaches its minimum', () => {
    let panels = bounds({}, { min: 20 }, {})

    assert.deepEqual(adjustLayout(panels, { p0: 20, p1: 40, p2: 40 }, 0, 50, 'pointer'), { p0: 70, p1: 20, p2: 10 })
  })

  it('moves the separator between the second and third of three panels', () => {
    let panels = bounds({}, {}, {})

    assert.deepEqual(adjustLayout(panels, { p0: 30, p1: 40, p2: 30 }, 1, -10, 'pointer'), { p0: 30, p1: 30, p2: 40 })
  })

  it('keeps the layout when there is no room in that direction', () => {
    let layout = { p0: 70, p1: 30 }

    assert.equal(adjustLayout(bounds({}, { min: 30 }), layout, 0, 10, 'pointer'), layout)
  })

  it('collapses a collapsible panel dragged past half the way from its minimum to its collapsed size', () => {
    let panels = bounds({ collapsible: true, collapsedSize: 4, min: 20 }, {})
    let start = { p0: 30, p1: 70 }

    assert.deepEqual(adjustLayout(panels, start, 0, -15, 'pointer'), { p0: 20, p1: 80 })
    assert.deepEqual(adjustLayout(panels, start, 0, -19, 'pointer'), { p0: 4, p1: 96 })
  })

  it('expands a collapsed panel only once the drag passes the same threshold', () => {
    let panels = bounds({ collapsible: true, collapsedSize: 4, min: 20 }, {})
    let collapsed = { p0: 4, p1: 96 }

    assert.equal(adjustLayout(panels, collapsed, 0, 5, 'pointer'), collapsed)
    assert.deepEqual(adjustLayout(panels, collapsed, 0, 9, 'pointer'), { p0: 20, p1: 80 })
  })

  it('collapses or expands in one key press from the minimum', () => {
    let panels = bounds({ collapsible: true, collapsedSize: 0, min: 25 }, {})

    assert.deepEqual(adjustLayout(panels, { p0: 25, p1: 75 }, 0, -5, 'keyboard'), { p0: 0, p1: 100 })
    assert.deepEqual(adjustLayout(panels, { p0: 0, p1: 100 }, 0, 5, 'keyboard'), { p0: 25, p1: 75 })
  })
})

describe('separatorValues', () => {
  it('reports the size of the panel before the separator and how far it can go', () => {
    let panels = bounds({ min: 20 }, { min: 30 })

    assert.deepEqual(separatorValues(panels, { p0: 40, p1: 60 }, 0), { now: 40, min: 20, max: 70 })
  })

  it('counts a collapsible panel as able to collapse', () => {
    let panels = bounds({ collapsible: true, collapsedSize: 5, min: 20, max: 60 }, {})

    assert.deepEqual(separatorValues(panels, { p0: 40, p1: 60 }, 0), { now: 40, min: 5, max: 60 })
  })
})

// Server output. The group renders its layout before any JavaScript runs.

interface Tag {
  name: string
  attributes: Map<string, string>
}

// The opening tags in the HTML, in document order, with their attributes.
function tags(html: string): Tag[] {
  return [...html.matchAll(/<([a-z][a-z0-9-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/g)].map(([, name, rest]) => ({
    name: name ?? '',
    attributes: new Map(
      [...(rest ?? '').matchAll(/\s+([^\s=>]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key ?? '', value ?? '']),
    ),
  }))
}

function slots(html: string, slot: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === slot)
}

function flexGrow(tag: Tag | undefined) {
  return Number(/flex:\s*([\d.]+) 1 0px/.exec(tag?.attributes.get('style') ?? '')?.[1])
}

async function serverHtml(node: RemixNode) {
  return renderToString(node)
}

describe('ResizablePanelGroup on the server', () => {
  it('lays out its panels from their default sizes, with handles between them', async () => {
    let html = await serverHtml(
      <ResizablePanelGroup orientation="horizontal" aria-label="Workspace">
        <ResizablePanel id="sidebar" defaultSize="25%">
          Sidebar
        </ResizablePanel>
        <ResizableHandle aria-label="Resize the sidebar" />
        <ResizablePanel id="content">Content</ResizablePanel>
      </ResizablePanelGroup>,
    )

    let [group] = slots(html, 'resizable-panel-group')
    assert.equal(group?.attributes.get('data-orientation'), 'horizontal')
    assert.equal(group?.attributes.get('aria-label'), 'Workspace')

    let panels = slots(html, 'resizable-panel')
    assert.deepEqual(
      panels.map((panel) => panel.attributes.get('id')),
      ['sidebar', 'content'],
    )
    assert.deepEqual(panels.map(flexGrow), [25, 75])

    let [separator] = slots(html, 'resizable-handle')
    assert.equal(separator?.attributes.get('role'), 'separator')
    assert.equal(separator?.attributes.get('aria-orientation'), 'vertical')
    assert.equal(separator?.attributes.get('aria-label'), 'Resize the sidebar')
    assert.ok(html.indexOf('Sidebar') < html.indexOf('data-slot="resizable-handle"'))
  })

  it('keeps the handles out of the tab order until the browser runs the group', async () => {
    let html = await serverHtml(
      <ResizablePanelGroup>
        <ResizablePanel />
        <ResizableHandle withHandle />
        <ResizablePanel />
      </ResizablePanelGroup>,
    )

    let [separator] = slots(html, 'resizable-handle')
    for (let attribute of ['tabindex', 'aria-valuenow', 'aria-controls']) {
      assert.equal(separator?.attributes.has(attribute), false, attribute)
    }
    assert.equal(slots(html, 'resizable-handle-icon')[0]?.attributes.get('aria-hidden'), 'true')
  })

  it('stacks vertical groups and nests groups inside panels', async () => {
    let html = await serverHtml(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="one" defaultSize="40%" />
        <ResizableHandle />
        <ResizablePanel id="right">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel id="two" defaultSize="30%" />
            <ResizableHandle />
            <ResizablePanel id="three" />
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>,
    )

    let groups = slots(html, 'resizable-panel-group')
    assert.deepEqual(
      groups.map((group) => group.attributes.get('data-orientation')),
      ['horizontal', 'vertical'],
    )
    assert.deepEqual(slots(html, 'resizable-panel').map(flexGrow), [40, 60, 30, 70])
    assert.deepEqual(
      slots(html, 'resizable-handle').map((separator) => separator.attributes.get('aria-orientation')),
      ['vertical', 'horizontal'],
    )
  })

  it('starts from a default layout, or follows the layout its owner controls', async () => {
    let panels = (props: { layout?: ResizableLayout; defaultLayout?: ResizableLayout }) => (
      <ResizablePanelGroup {...props}>
        <ResizablePanel id="a" defaultSize="50%" minSize="20%" />
        <ResizableHandle />
        <ResizablePanel id="b" defaultSize="50%" />
      </ResizablePanelGroup>
    )

    assert.deepEqual(
      slots(await serverHtml(panels({ defaultLayout: { a: 30, b: 70 } })), 'resizable-panel').map(flexGrow),
      [30, 70],
    )
    assert.deepEqual(
      slots(await serverHtml(panels({ layout: { a: 10, b: 90 } })), 'resizable-panel').map(flexGrow),
      [20, 80],
    )
  })

  it('marks a collapsed panel and takes a panel without size out of reach', async () => {
    let html = await serverHtml(
      <ResizablePanelGroup>
        <ResizablePanel id="nav" collapsible minSize="20%" defaultSize="0%">
          <a href="/inbox">Inbox</a>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="main" />
      </ResizablePanelGroup>,
    )

    let [nav, main] = slots(html, 'resizable-panel')
    assert.equal(nav?.attributes.has('data-collapsed'), true)
    assert.equal(nav?.attributes.has('inert'), true)
    assert.equal(main?.attributes.has('data-collapsed'), false)
    assert.equal(main?.attributes.has('inert'), false)
  })

  it("passes the caller's attributes and mixins to each part", async () => {
    let html = await serverHtml(
      <ResizablePanelGroup class="workspace" mix={css({ minHeight: '12rem' })}>
        <ResizablePanel class="pane" data-testid="first" />
        <ResizableHandle class="grip" />
        <ResizablePanel />
      </ResizablePanelGroup>,
    )

    assert.match(slots(html, 'resizable-panel-group')[0]?.attributes.get('class') ?? '', /workspace/)
    assert.match(slots(html, 'resizable-panel')[0]?.attributes.get('class') ?? '', /pane/)
    assert.equal(slots(html, 'resizable-panel')[0]?.attributes.get('data-testid'), 'first')
    assert.match(slots(html, 'resizable-handle')[0]?.attributes.get('class') ?? '', /grip/)
    assert.match(html, /min-height: 12rem/)
  })

  it('fails the render on impossible sizes, naming the panel', async () => {
    await assert.rejects(
      serverHtml(
        <ResizablePanelGroup>
          <ResizablePanel id="nav" minSize="60%" maxSize="40%" />
          <ResizableHandle />
          <ResizablePanel />
        </ResizablePanelGroup>,
      ),
      /ResizablePanel "nav": minSize 60% is larger than maxSize 40%/,
    )
  })

  it('fails the render when a panel or handle is not a direct child of a group', async () => {
    await assert.rejects(
      serverHtml(<ResizablePanel />),
      /ResizablePanel must be a direct child of a ResizablePanelGroup/,
    )
    await assert.rejects(
      serverHtml(
        <ResizablePanelGroup>
          <ResizablePanel>
            <ResizableHandle />
          </ResizablePanel>
        </ResizablePanelGroup>,
      ),
      /ResizableHandle must be a direct child of a ResizablePanelGroup/,
    )
    await assert.rejects(
      serverHtml(
        <ResizablePanelGroup>
          <ResizablePanel>
            <ResizablePanel />
          </ResizablePanel>
        </ResizablePanelGroup>,
      ),
      /ResizablePanel must be a direct child of a ResizablePanelGroup/,
    )
  })
})
