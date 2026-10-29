// Builds the shadcn-format registry the remixcn CLI, MCP clients and the site
// serve: <out>/registry.json, the index, and <out>/<name>.json for each item.
// It checks everything first, so a failed build writes nothing.
// Usage: node scripts/build-registry.ts [workspace directory] [--out directory]
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
import { basename, dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { registryItemSchema, registrySchema } from 'shadcn/schema'

import { findCssImports } from './contracts.ts'
import type { Catalog } from './contracts.ts'
import { buildRegistry, checkRegistry, checkSourcePath } from './registry.ts'
import type { Registry, RegistrySource } from './registry.ts'
import { readScriptImports } from './typescript.ts'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } })
const root = resolve(positionals[0] ?? '.')
const out = resolve(values.out ?? join(root, 'dist/r'))

function fail(problems: string[]): never {
  for (let problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write(`\n${problems.length} problem(s). Nothing was written. AGENTS.md describes the registry contracts.\n`)
  process.exit(1)
}

function readJson(file: string) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'))
}

/** Lists the schema problems of `value`, as shadcn's own CLI would find them. */
function checkSchema(file: string, schema: typeof registrySchema | typeof registryItemSchema, value: unknown) {
  let result = schema.safeParse(value)
  if (result.success) return []

  return result.error.issues.map(
    (issue) => `${file} does not match shadcn's ${schema === registrySchema ? 'registry' : 'registry-item'} schema at ${issue.path.join('.') || 'the root'}: ${issue.message}`,
  )
}

/**
 * Reads each listed file that may ship. A link in its path could reach files
 * outside the workspace, so the file must be where its path says.
 */
function readFiles(registry: Registry) {
  let files = new Map<string, string>()
  let problems: string[] = []
  let realRoot = realpathSync(root)

  for (let item of registry.items) {
    for (let { path } of item.files ?? []) {
      let file = join(root, path)
      if (files.has(path) || checkSourcePath(path) !== undefined || !existsSync(file)) continue

      if (realpathSync(file) === join(realRoot, path) && statSync(file).isFile()) files.set(path, readFileSync(file, 'utf8'))
      else problems.push(`${item.name}: ${path} must be a file inside the workspace, not a link`)
    }
  }

  return { files, problems }
}

function readImports(files: Map<string, string>) {
  let scripts = [...files.keys()].filter((path) => /\.tsx?$/.test(path))
  let imports = readScriptImports(root, scripts)

  for (let [path, content] of files) {
    if (path.endsWith('.css')) imports.set(path, findCssImports(content))
  }

  return imports
}

/** The build replaces only an earlier build: a folder of JSON files. Anything else stays. */
function checkOutputFolder() {
  if (!existsSync(out)) return []

  let others = readdirSync(out, { withFileTypes: true })
    .filter((entry) => !entry.isFile() || !entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
  if (others.length === 0) return []

  return [`${out} holds ${others.join(' and ')}, not just a registry build, so the build won't replace it`]
}

/** Writes the output beside its folder first, then swaps it in, so readers never see half a build. */
function writeOutput(output: Map<string, string>) {
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
    throw error
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(previous, { recursive: true, force: true })
  }
}

let outputFolderProblems = checkOutputFolder()
if (outputFolderProblems.length > 0) fail(outputFolderProblems)

for (let file of ['registry.json', 'registry/catalog.json']) {
  if (!existsSync(join(root, file))) fail([`${file} does not exist`])
}

let registry: Registry
try {
  registry = readJson('registry.json')
} catch (error) {
  fail([`registry.json is not valid JSON: ${(error as Error).message}`])
}

let schemaProblems = checkSchema('registry.json', registrySchema, registry)
if (schemaProblems.length > 0) fail(schemaProblems)

let { files, problems: fileProblems } = readFiles(registry)
if (fileProblems.length > 0) fail(fileProblems.map((problem) => `registry.json: ${problem}`))

let source: RegistrySource = {
  registry,
  catalog: readJson('registry/catalog.json') as Catalog,
  files,
  imports: readImports(files),
}

let problems = checkRegistry(source)
if (problems.length > 0) fail(problems.map((problem) => `registry.json: ${problem}`))

let workspace = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
let output = buildRegistry(source, { remix: workspace.devDependencies.remix })

let outputProblems = [...output].flatMap(([name, text]) =>
  checkSchema(name, name === 'registry.json' ? registrySchema : registryItemSchema, JSON.parse(text)),
)
if (outputProblems.length > 0) fail(outputProblems)

writeOutput(output)

let names = registry.items.map((item) => item.name).sort()
let shown = relative(process.cwd(), out)
process.stdout.write(`✓ Built ${names.length} ${names.length === 1 ? 'item' : 'items'}: ${names.join(', ')}\n`)
process.stdout.write(`✓ ${shown.startsWith('..') ? out : shown} holds registry.json and one <name>.json per item\n`)
