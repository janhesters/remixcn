import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { laneMatrix, lanes, planLanes, readPassCount, supportedNode } from './lanes.ts'

const allScripts = Object.fromEntries(lanes.map((lane) => [lane.script, 'true']))

function plan(scripts: Record<string, string>, files: string[] = []) {
  return Object.fromEntries(
    planLanes({ scripts, files }).map(({ lane, built, reason }) => [lane.name, reason ?? built]),
  )
}

describe('planLanes', () => {
  it('builds a lane once its script exists and, for a test lane, once it has a test file', () => {
    let files = ['scripts/contracts.test.ts', 'registry/lib/layer.test.browser.tsx', 'test/site.test.e2e.ts']

    assert.deepEqual(plan(allScripts, files), Object.fromEntries(lanes.map((lane) => [lane.name, true])))
  })

  it('names the missing script of an unbuilt lane and the ticket that adds it', () => {
    let { 'build:site': _site, 'build:registry': _registry, ...scripts } = allScripts

    let lanesByName = plan(scripts, ['scripts/contracts.test.ts'])

    assert.equal(lanesByName.site, 'no "build:site" script yet (#34 adds it)')
    assert.equal(lanesByName.registry, 'no "build:registry" script yet (#4 adds it)')
    assert.equal(lanesByName.typecheck, true)
  })

  it('leaves a test lane unbuilt while it has no test files', () => {
    let lanesByName = plan(allScripts, ['scripts/contracts.test.ts', 'registry/ui/button.tsx'])

    assert.equal(lanesByName.test, true)
    assert.equal(lanesByName.browser, 'no *.test.browser.{ts,tsx} files yet')
    assert.equal(lanesByName.e2e, 'no *.test.e2e.{ts,tsx} files yet')
  })

  it("doesn't count browser or end-to-end tests as server tests", () => {
    let lanesByName = plan(allScripts, ['registry/lib/layer.test.browser.tsx', 'test/site.test.e2e.ts'])

    assert.equal(lanesByName.test, 'no *.test.{ts,tsx} files yet')
  })
})

describe('readPassCount', () => {
  it("reads the passing tests from remix test's spec and TAP summaries", () => {
    assert.equal(readPassCount('ℹ tests 3\nℹ pass 2\nℹ fail 1\n'), 2)
    assert.equal(readPassCount('# tests 2\n# pass 0\n# skipped 2\n'), 0)
  })

  it('adds up the summaries of several projects and ignores color codes', () => {
    assert.equal(readPassCount('\u001b[34mℹ pass 4\u001b[39m\nℹ pass 4\nℹ pass 3\n'), 11)
  })

  it('reads nothing from output without a summary', () => {
    assert.equal(readPassCount('No test files remain after filtering for type browser\n'), undefined)
  })
})

describe('laneMatrix', () => {
  let nodes = [supportedNode.oldest, supportedNode.newest]
  let projects = ['chromium', 'firefox', 'webkit']

  it('runs each built lane once on the oldest supported Node', () => {
    let plans = planLanes({ scripts: { lint: 'oxlint' }, files: [] })

    assert.deepEqual(laneMatrix(plans, { nodes, projects }), [{ lane: 'lint', name: 'lint', node: '24.3.0' }])
  })

  it('runs the runtime lanes on every supported Node and the browser lanes in every project', () => {
    let plans = planLanes({ scripts: allScripts, files: ['a.test.ts', 'b.test.e2e.ts'] })
    let entries = laneMatrix(plans, { nodes, projects }).filter((entry) => ['test', 'e2e'].includes(entry.lane))

    assert.deepEqual(entries, [
      { lane: 'test', name: 'test (Node 24.3.0)', node: '24.3.0' },
      { lane: 'test', name: 'test (Node 26.13.0)', node: '26.13.0' },
      { lane: 'e2e', name: 'e2e (chromium)', node: '24.3.0', project: 'chromium' },
      { lane: 'e2e', name: 'e2e (firefox)', node: '24.3.0', project: 'firefox' },
      { lane: 'e2e', name: 'e2e (webkit)', node: '24.3.0', project: 'webkit' },
    ])
  })

  it('leaves unbuilt lanes out', () => {
    let plans = planLanes({ scripts: allScripts, files: ['a.test.ts'] })
    let names = laneMatrix(plans, { nodes, projects }).map((entry) => entry.lane)

    assert.ok(!names.includes('browser'))
    assert.ok(!names.includes('e2e'))
  })
})
