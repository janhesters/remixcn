import { stripVTControlCharacters } from 'node:util'

/** The Node versions CI runs: the `engines` floor and the newest LTS release. */
export const supportedNode = { oldest: '24.3.0', newest: '26.13.0' }

/**
 * One independently runnable check. A lane is built once its package script
 * exists and, for a test lane, once at least one file matches its tests.
 */
export interface Lane {
  name: string
  script: string
  checks: string
  tests?: { pattern: RegExp; label: string }
  /** Runs once per Playwright project. */
  perProject?: boolean
  /** Runs on every supported Node version, because it runs the code under test. */
  perNode?: boolean
  /** The ticket that adds the lane's script. */
  addedBy?: string
}

export const lanes: Lane[] = [
  { name: 'format', script: 'check:format', checks: 'Prettier formatting' },
  { name: 'lint', script: 'lint', checks: 'oxlint correctness rules' },
  { name: 'typecheck', script: 'typecheck', checks: 'TypeScript over the workspace and the consumer fixture' },
  {
    name: 'test',
    script: 'test',
    checks: 'server tests',
    tests: { pattern: /\.test\.tsx?$/, label: '*.test.{ts,tsx}' },
    perNode: true,
  },
  {
    name: 'browser',
    script: 'test:browser',
    checks: 'browser component tests',
    tests: { pattern: /\.test\.browser\.tsx?$/, label: '*.test.browser.{ts,tsx}' },
    perProject: true,
  },
  {
    name: 'e2e',
    script: 'test:e2e',
    checks: 'end-to-end tests against local servers',
    tests: { pattern: /\.test\.e2e\.tsx?$/, label: '*.test.e2e.{ts,tsx}' },
    perProject: true,
  },
  { name: 'components', script: 'check:components', checks: 'the catalog and browser-reachable imports' },
  { name: 'secrets', script: 'check:secrets', checks: 'no credentials in the repository' },
  { name: 'build', script: 'check:build', checks: 'the remixcn executable and package contracts', perNode: true },
  { name: 'registry', script: 'build:registry', checks: 'the shadcn-compatible registry build', addedBy: '#4' },
  { name: 'site', script: 'build:site', checks: 'the static site build', addedBy: '#34' },
]

export interface LanePlan {
  lane: Lane
  built: boolean
  reason?: string
}

/** Decides which lanes are built from the root package scripts and the workspace's files. */
export function planLanes(workspace: { scripts: Record<string, string>; files: string[] }): LanePlan[] {
  return lanes.map((lane) => {
    if (!(lane.script in workspace.scripts)) {
      let addedBy = lane.addedBy ? ` (${lane.addedBy} adds it)` : ''
      return { lane, built: false, reason: `no "${lane.script}" script yet${addedBy}` }
    }

    let { tests } = lane
    if (tests && !workspace.files.some((file) => tests.pattern.test(file))) {
      return { lane, built: false, reason: `no ${tests.label} files yet` }
    }

    return { lane, built: true }
  })
}

/**
 * Adds up the passing tests in `remix test` output, from its spec (`ℹ pass 3`)
 * or TAP (`# pass 3`) summaries. Returns undefined when there is no summary.
 */
export function readPassCount(output: string): number | undefined {
  let counts = [...stripVTControlCharacters(output).matchAll(/^[ℹ#] pass (\d+)$/gm)].map((match) => Number(match[1]))
  return counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) : undefined
}

export interface MatrixEntry {
  lane: string
  name: string
  node: string
  project?: string
}

/** Lists the CI jobs for the built lanes. `nodes[0]` is the Node version a lane runs on by default. */
export function laneMatrix(plans: LanePlan[], options: { nodes: string[]; projects: string[] }): MatrixEntry[] {
  let [oldest] = options.nodes

  return plans
    .filter((plan) => plan.built)
    .flatMap(({ lane }): MatrixEntry[] => {
      if (lane.perProject) {
        return options.projects.map((project) => ({
          lane: lane.name,
          name: `${lane.name} (${project})`,
          node: oldest,
          project,
        }))
      }
      if (lane.perNode) {
        return options.nodes.map((node) => ({ lane: lane.name, name: `${lane.name} (Node ${node})`, node }))
      }
      return [{ lane: lane.name, name: lane.name, node: oldest }]
    })
}
