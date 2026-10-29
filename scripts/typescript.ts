import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseResolutionTrace } from './contracts.ts'

export const tsc = join(dirname(fileURLToPath(import.meta.resolve('typescript/package.json'))), 'bin/tsc')

const traceFlags = [
  '--noEmit',
  '--traceResolution',
  '--ignoreConfig',
  '--locale',
  'en',
  '--pretty',
  'false',
  '--skipLibCheck',
  '--module',
  'nodenext',
  '--moduleResolution',
  'nodenext',
  '--allowImportingTsExtensions',
  '--jsx',
  'react-jsx',
  '--jsxImportSource',
  'remix/component',
]

/**
 * Lists the imports of each TypeScript file, relative to `root`, as the pinned
 * TypeScript compiler parses them. Type errors don't matter here; option
 * errors do, because they would hide every import.
 */
export function readScriptImports(root: string, files: string[]): Map<string, string[]> {
  if (files.length === 0) return new Map()

  // Absolute paths make tsc print the same strings the lookup below uses.
  let paths = files.map((file) => resolve(root, file))
  let result = spawnSync(process.execPath, [tsc, ...traceFlags, ...paths], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status === null || /error TS[56]\d{3}/.test(result.stdout)) {
    throw new Error(`tsc could not read the imports:\n${result.stdout}${result.stderr}`)
  }

  let traced = parseResolutionTrace(result.stdout)
  return new Map(files.map((file, index) => [file, traced.get(paths[index]) ?? []]))
}
