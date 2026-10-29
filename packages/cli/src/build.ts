// Builds a RemixCN registry folder: <out>/registry.json, the index, and
// <out>/<name>.json for each item. It checks everything first, so a failed
// build writes nothing, and it swaps the new folder in whole.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { CliError } from './errors.ts'
import { buildRegistry, checkRegistry, checkSourcePath } from './registry.ts'
import type { Catalog, Registry, RegistrySource } from './registry.ts'
import { allowsJsx, findCssImports, findScriptImports } from './source.ts'

export interface RegistryBuild {
  /** The folder that holds registry.json and registry/catalog.json. */
  root: string
  out: string
  /** The Remix version the items are written for, recorded in each item's meta. */
  remix: string
  /** Reads the imports of each TypeScript file. The default needs no compiler. */
  readScriptImports?: (root: string, files: Map<string, string>) => Map<string, string[]>
  /** Checks registry.json before anything else reads it. */
  checkInput?: (registry: unknown) => string[]
  /** Checks the output before it is written. */
  checkOutput?: (output: Map<string, string>) => string[]
}

function fail(problems: string[], code: 'REGISTRY' | 'CONFLICT' = 'REGISTRY'): never {
  throw new CliError(code, `${problems.length} problem(s). Nothing was written.`, problems)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks the shape the registry contracts read, so a malformed registry.json fails with a reason. */
export function checkRegistryShape(registry: unknown): string[] {
  if (!isRecord(registry)) return ['registry.json must hold an object']

  let problems: string[] = []
  for (let field of ['name', 'homepage'] as const) {
    if (typeof registry[field] !== 'string') problems.push(`registry.json: ${field} must be text`)
  }
  if (!Array.isArray(registry.items)) return [...problems, 'registry.json: items must be a list']

  registry.items.forEach((item: unknown, index) => {
    let at = `registry.json: items.${index}`
    if (!isRecord(item)) return problems.push(`${at} must be an object`)
    for (let field of ['name', 'type'] as const)
      if (typeof item[field] !== 'string') problems.push(`${at}.${field} must be text`)
    for (let field of ['title', 'description', 'docs'] as const) {
      if (item[field] !== undefined && typeof item[field] !== 'string') problems.push(`${at}.${field} must be text`)
    }
    for (let field of ['registryDependencies', 'dependencies', 'devDependencies', 'categories'] as const) {
      let list = item[field]
      if (list !== undefined && !(Array.isArray(list) && list.every((entry) => typeof entry === 'string'))) {
        problems.push(`${at}.${field} must be a list of text`)
      }
    }
    if (item.files !== undefined && !Array.isArray(item.files)) return problems.push(`${at}.files must be a list`)
    ;(item.files ?? []).forEach((file: unknown, fileIndex: number) => {
      if (
        !isRecord(file) ||
        typeof file.path !== 'string' ||
        typeof file.type !== 'string' ||
        typeof file.target !== 'string'
      ) {
        problems.push(`${at}.files.${fileIndex} needs a path, a type and a target`)
      }
    })
  })

  return problems
}

/**
 * Reads each listed file that may ship. A link in its path could reach files
 * outside the workspace, so the file must be where its path says.
 */
function readFiles(root: string, registry: Registry) {
  let files = new Map<string, string>()
  let problems: string[] = []
  let realRoot = realpathSync(root)

  for (let item of registry.items) {
    for (let { path } of item.files ?? []) {
      let file = join(root, path)
      if (files.has(path) || checkSourcePath(path) !== undefined || !existsSync(file)) continue

      if (realpathSync(file) === join(realRoot, path) && statSync(file).isFile())
        files.set(path, readFileSync(file, 'utf8'))
      else problems.push(`${item.name}: ${path} must be a file inside the workspace, not a link`)
    }
  }

  return { files, problems }
}

function readScriptImportsWithoutCompiler(_root: string, files: Map<string, string>) {
  return new Map(
    [...files]
      .filter(([path]) => /\.tsx?$/.test(path))
      .map(([path, content]) => [path, findScriptImports(content, { jsx: allowsJsx(path) })]),
  )
}

/** The build replaces only an earlier build: a folder of JSON files. Anything else stays. */
function checkOutputFolder(out: string) {
  if (!existsSync(out)) return []

  let others = readdirSync(out, { withFileTypes: true })
    .filter((entry) => !entry.isFile() || !entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
  if (others.length === 0) return []

  return [`${out} holds ${others.join(' and ')}, not just a registry build, so the build won't replace it`]
}

/** Writes the output beside its folder first, then swaps it in, so readers never see half a build. */
function writeOutput(out: string, output: Map<string, string>) {
  mkdirSync(dirname(out), { recursive: true })
  let staging = mkdtempSync(join(dirname(out), `.${basename(out)}-`))
  let previous = `${staging}-previous`

  try {
    for (let [name, text] of output) writeFileSync(join(staging, name), text)
    chmodSync(staging, 0o755)
    if (existsSync(out)) renameSync(out, previous)
    renameSync(staging, out)
  } catch (error) {
    if (existsSync(previous) && !existsSync(out)) renameSync(previous, out)
    throw new CliError('WRITE', `Could not write ${out}: ${(error as Error).message}. The previous build is unchanged.`)
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(previous, { recursive: true, force: true })
  }
}

/** Checks and builds the registry at `build.root`, then writes it to `build.out`. Returns the item names. */
export function buildRegistryFolder(build: RegistryBuild): string[] {
  let { root, out } = build

  let outputFolderProblems = checkOutputFolder(out)
  if (outputFolderProblems.length > 0) fail(outputFolderProblems, 'CONFLICT')

  for (let file of ['registry.json', 'registry/catalog.json']) {
    if (!existsSync(join(root, file))) fail([`${file} does not exist`])
  }

  let registry: Registry
  let catalog: Catalog
  try {
    registry = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  } catch (error) {
    fail([`registry.json is not valid JSON: ${(error as Error).message}`])
  }
  try {
    catalog = JSON.parse(readFileSync(join(root, 'registry/catalog.json'), 'utf8'))
  } catch (error) {
    fail([`registry/catalog.json is not valid JSON: ${(error as Error).message}`])
  }
  if (
    !isRecord(catalog) ||
    typeof catalog.namespace !== 'string' ||
    typeof catalog.homepage !== 'string' ||
    !Array.isArray(catalog.entries) ||
    !Array.isArray(catalog.helpers)
  ) {
    fail(['registry/catalog.json needs a namespace, a homepage, entries and helpers'])
  }

  let inputProblems = (build.checkInput ?? checkRegistryShape)(registry)
  if (inputProblems.length > 0) fail(inputProblems)

  let { files, problems: fileProblems } = readFiles(root, registry)
  if (fileProblems.length > 0) fail(fileProblems.map((problem) => `registry.json: ${problem}`))

  let imports = (build.readScriptImports ?? readScriptImportsWithoutCompiler)(root, files)
  for (let [path, content] of files) {
    if (path.endsWith('.css')) imports.set(path, findCssImports(content))
  }

  let source: RegistrySource = { registry, catalog, files, imports }
  let problems = checkRegistry(source)
  if (problems.length > 0) fail(problems.map((problem) => `registry.json: ${problem}`))

  let output = buildRegistry(source, { remix: build.remix })
  let outputProblems = build.checkOutput?.(output) ?? []
  if (outputProblems.length > 0) fail(outputProblems)

  writeOutput(out, output)
  return registry.items.map((item) => item.name).sort()
}
