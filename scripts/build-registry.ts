// Builds the shadcn-format registry the remixcn CLI, MCP clients and the site
// serve: <out>/registry.json, the index, and <out>/<name>.json for each item.
// It checks everything first, so a failed build writes nothing. It runs the
// build `remixcn build` runs, and adds the checks of the pinned development
// tools: TypeScript reads the imports, and shadcn's schema checks input and output.
// Usage: node scripts/build-registry.ts [workspace directory] [--out directory]
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { registryItemSchema, registrySchema } from 'shadcn/schema'

import { buildRegistryFolder } from '../packages/cli/src/build.ts'
import { CliError } from '../packages/cli/src/errors.ts'
import { readScriptImports } from './typescript.ts'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } })
const root = resolve(positionals[0] ?? '.')
const out = resolve(values.out ?? join(root, 'dist/r'))

/** Lists the schema problems of `value`, as shadcn's own CLI would find them. */
function checkSchema(file: string, schema: typeof registrySchema | typeof registryItemSchema, value: unknown) {
  let result = schema.safeParse(value)
  if (result.success) return []

  return result.error.issues.map(
    (issue) =>
      `${file} does not match shadcn's ${schema === registrySchema ? 'registry' : 'registry-item'} schema at ${issue.path.join('.') || 'the root'}: ${issue.message}`,
  )
}

let workspace = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
let names: string[]

try {
  names = buildRegistryFolder({
    root,
    out,
    remix: workspace.devDependencies.remix,
    readScriptImports: (directory, files) =>
      readScriptImports(
        directory,
        [...files.keys()].filter((path) => /\.tsx?$/.test(path)),
      ),
    checkInput: (registry) => checkSchema('registry.json', registrySchema, registry),
    checkOutput: (output) =>
      [...output].flatMap(([name, text]) =>
        checkSchema(name, name === 'registry.json' ? registrySchema : registryItemSchema, JSON.parse(text)),
      ),
  })
} catch (error) {
  if (!(error instanceof CliError)) throw error
  for (let problem of error.details) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write(`\n${error.message} AGENTS.md describes the registry contracts.\n`)
  process.exit(1)
}

let shown = relative(process.cwd(), out)
process.stdout.write(`✓ Built ${names.length} ${names.length === 1 ? 'item' : 'items'}: ${names.join(', ')}\n`)
process.stdout.write(`✓ ${shown.startsWith('..') ? out : shown} holds registry.json and one <name>.json per item\n`)
