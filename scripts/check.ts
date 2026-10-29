// Runs RemixCN's check lanes, or plans them for CI. Run it from the workspace root.
// Usage: node scripts/check.ts [lane ...] [--project <name>] [--diagnostics <dir>]
//        node scripts/check.ts --plan
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { laneMatrix, lanes, planLanes, readPassCount, supportedNode } from './lanes.ts'
import type { Lane, LanePlan } from './lanes.ts'
import { waitForExit } from './processes.ts'
import { listWorkspaceFiles } from './workspace.ts'

const root = process.cwd()
const marker = 'REMIXCN_CHECK_LANE'
/** How long a lane's output may stay open after the lane exited and its leftovers were stopped. */
const outputGraceMs = 2_000
/** How long a stopped leftover may take to exit. SIGKILL only asks the system to end it. */
const stopGraceMs = 5_000

let { values: options, positionals: requested } = parseArgs({
  allowPositionals: true,
  options: { plan: { type: 'boolean' }, project: { type: 'string' }, diagnostics: { type: 'string' } },
})

let { scripts = {} } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}
let plans = planLanes({ scripts, files: listWorkspaceFiles(root) })

/** The Playwright projects the browser lanes run in, from the workspace's config, or remix test's default. */
async function readProjects(): Promise<string[]> {
  let config = join(root, 'playwright.config.ts')
  let { default: settings } = existsSync(config)
    ? ((await import(pathToFileURL(config).href)) as { default: { projects?: Array<{ name: string }> } })
    : { default: {} }
  let names = settings.projects?.map((project) => project.name) ?? []
  return names.length > 0 ? names : ['chromium']
}

function notBuilt(plan: LanePlan) {
  return `not built yet, ${plan.reason}`
}

async function writePlan() {
  let matrix = laneMatrix(plans, {
    nodes: [supportedNode.oldest, supportedNode.newest],
    projects: await readProjects(),
  })

  for (let plan of plans) {
    process.stdout.write(
      `  ${plan.built ? '●' : '○'} ${plan.lane.name}: ${plan.built ? plan.lane.checks : notBuilt(plan)}\n`,
    )
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    for (let plan of plans.filter((plan) => !plan.built)) {
      process.stdout.write(`::notice title=Lane ${plan.lane.name} is not built yet::${plan.reason}\n`)
    }
  }

  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    let rows = plans.map(
      (plan) => `| ${plan.lane.name} | ${plan.lane.checks} | ${plan.built ? 'runs' : notBuilt(plan)} |`,
    )
    let table = ['## Check lanes', '', '| Lane | Checks | Status |', '| --- | --- | --- |', ...rows, '']
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table.join('\n')}\n`)
  }
}

/** Lists the processes that inherited a lane's marker, so they outlived it. Linux only. */
function findMarkedProcesses(value: string): Array<{ pid: number; command: string }> {
  if (!existsSync('/proc')) return []

  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .flatMap((pid) => {
      try {
        if (!readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`${marker}=${value}`)) return []
        return [
          { pid: Number(pid), command: readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim() },
        ]
      } catch {
        return []
      }
    })
}

/** Waits briefly for a lane's processes to exit, then stops the rest and describes them. */
async function stopLeftovers(value: string): Promise<string | undefined> {
  let leftovers = findMarkedProcesses(value)
  for (let attempt = 0; leftovers.length > 0 && attempt < 20; attempt++) {
    await delay(100)
    leftovers = findMarkedProcesses(value)
  }
  if (leftovers.length === 0) return undefined

  for (let { pid } of leftovers) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // It exited on its own in the meantime.
    }
  }
  // Report a process as stopped only once it has exited.
  let pids = leftovers.map(({ pid }) => pid)
  let survivors = await waitForExit(pids, stopGraceMs)
  let count = leftovers.length === 1 ? '1 process' : `${leftovers.length} processes`
  let list = leftovers.map(({ pid, command }) => `${pid} ${command}`).join('; ')
  if (survivors.length > 0) {
    return `left ${count} running, and ${survivors.join(', ')} still runs after SIGKILL: ${list}`
  }
  return `left ${count} running, now stopped: ${list}`
}

async function runLane(lane: Lane): Promise<string | undefined> {
  let project = lane.perProject ? options.project : undefined
  let id = randomUUID()
  let log = options.diagnostics
    ? join(options.diagnostics, `${lane.name}${project ? `-${project}` : ''}.log`)
    : undefined
  if (log) writeFileSync(log, '')

  process.stdout.write(`\n▸ ${lane.name}: ${lane.checks}\n`)

  let env: NodeJS.ProcessEnv = { ...process.env, [marker]: id }
  if (process.stdout.isTTY && !('NO_COLOR' in env)) env.FORCE_COLOR ??= '1'

  let args = ['run', lane.script, ...(project ? ['--project', project] : [])]
  let child = spawn('bun', args, { cwd: root, env, stdio: ['inherit', 'pipe', 'pipe'] })
  let chunks: Buffer[] = []
  for (let [stream, target] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ] as const) {
    stream.on('data', (chunk: Buffer) => {
      target.write(chunk)
      chunks.push(chunk)
      if (log) appendFileSync(log, chunk)
    })
  }
  let closed = new Promise<boolean>((resolve) => child.on('close', () => resolve(true)))
  let code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', resolve)
  })

  // A leftover process may hold the lane's output open, so cleanup starts once
  // the lane exits. Stopping it closes the output. If something the cleanup
  // can't see still holds it, such as on a system without /proc, stop waiting.
  let leftovers = await stopLeftovers(id)
  let outputClosed = await Promise.race([closed, delay(outputGraceMs, false, { ref: false })])
  if (!outputClosed) {
    child.stdout.destroy()
    child.stderr.destroy()
  }

  if (leftovers) return leftovers
  if (!outputClosed) return 'exited, but a process it started still holds its output open'
  if (code !== 0) return `exited with code ${code}`
  // Decoded once at the end, so a character split across chunks stays whole.
  if (lane.tests && !readPassCount(Buffer.concat(chunks).toString('utf8'))) {
    return 'ran no passing tests, so it proves nothing'
  }
  return undefined
}

async function runLanes() {
  let unknown = requested.filter((name) => !lanes.some((lane) => lane.name === name))
  if (unknown.length > 0) {
    process.stderr.write(`unknown lane "${unknown[0]}"; the lanes are ${lanes.map((lane) => lane.name).join(', ')}\n`)
    process.exitCode = 1
    return
  }

  if (options.diagnostics) mkdirSync(options.diagnostics, { recursive: true })

  let selected = requested.length > 0 ? plans.filter((plan) => requested.includes(plan.lane.name)) : plans
  let results: string[] = []
  let failed = 0

  for (let plan of selected) {
    if (!plan.built) {
      results.push(`  ○ ${plan.lane.name}: ${notBuilt(plan)}`)
      continue
    }
    let problem = await runLane(plan.lane)
    if (problem) failed++
    results.push(problem ? `  ✗ ${plan.lane.name}: ${problem}` : `  ✓ ${plan.lane.name}`)
  }

  let unbuilt = selected.filter((plan) => !plan.built).length
  let passed = selected.length - unbuilt - failed
  process.stdout.write(`\n${results.join('\n')}\n\n${passed} passed, ${failed} failed, ${unbuilt} not built yet\n`)
  if (failed > 0) process.exitCode = 1
}

await (options.plan ? writePlan() : runLanes())
