// Checks registry and docs browser source against RemixCN's contracts.
// Usage: node scripts/check-components.ts [workspace directory]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  checkBrowserPackage,
  checkCatalog,
  checkImport,
  checkRegistryFiles,
  checkSourceHeader,
  findCssImports,
  findFontFaces,
  findTailwindDirectives,
} from './contracts.ts'
import type { Catalog, PackageJson } from './contracts.ts'
import { readScriptImports } from './typescript.ts'

const root = process.argv[2] ?? '.'
const sourceExtension = /\.(tsx?|css)$/
const testFile = /\.test(\.browser|\.e2e)?\.tsx?$/

function listSource(directory: string): string[] {
  if (!existsSync(join(root, directory))) return []

  return readdirSync(join(root, directory), { recursive: true, encoding: 'utf8' })
    .map((file) => `${directory}/${file.replaceAll('\\', '/')}`)
    .filter((file) => sourceExtension.test(file) && !testFile.test(file) && !/\/(node_modules|dist)\//.test(file))
    .sort()
}

function checkSource(file: string, imports: Map<string, string[]>, allowRelative: boolean): string[] {
  let problems: string[]

  if (file.endsWith('.css')) {
    let css = readFileSync(join(root, file), 'utf8')
    problems = findCssImports(css).flatMap((specifier) => checkImport(specifier, { allowRelative }) ?? [])
    problems.push(
      ...findTailwindDirectives(css).map(
        (directive) => `${directive} is a Tailwind directive, which browser-reachable source must not use`,
      ),
    )
    if (findFontFaces(css) > 0) problems.push('@font-face loads a font file; browser-reachable source uses system fonts')
  } else {
    problems = (imports.get(file) ?? []).flatMap((specifier) => checkImport(specifier, { allowRelative }) ?? [])
  }

  return problems.map((problem) => `${file}: ${problem}`)
}

let catalog = JSON.parse(readFileSync(join(root, 'registry/catalog.json'), 'utf8')) as Catalog
let registryFiles = ['registry/ui', 'registry/lib', 'registry/examples'].flatMap(listSource)
let docsFiles = listSource('apps/docs').filter((file) => file.includes('/public/'))
let imports = readScriptImports(
  root,
  [...registryFiles, ...docsFiles].filter((file) => !file.endsWith('.css')),
)

function checkHeader(file: string): string[] {
  let item = [...catalog.entries, ...catalog.helpers].find((entry) => entry.target === file)
  if (!item) return []

  return checkSourceHeader(readFileSync(join(root, file), 'utf8'), item.title).map((problem) => `${file}: ${problem}`)
}

let problems = [
  ...checkCatalog(catalog).map((problem) => `registry/catalog.json: ${problem}`),
  ...checkRegistryFiles(catalog, registryFiles),
  ...registryFiles.flatMap(checkHeader),
  ...registryFiles.flatMap((file) => checkSource(file, imports, false)),
  ...docsFiles.flatMap((file) => checkSource(file, imports, true)),
]

let docsPackage = join(root, 'apps/docs/package.json')
if (existsSync(docsPackage)) {
  let pkg = JSON.parse(readFileSync(docsPackage, 'utf8')) as PackageJson
  problems.push(...checkBrowserPackage(pkg).map((problem) => `apps/docs/package.json: ${problem}`))
}

if (problems.length > 0) {
  for (let problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write(`\n${problems.length} problem(s). AGENTS.md describes the contracts.\n`)
  process.exitCode = 1
} else {
  let entries = catalog.entries.length
  let helpers = catalog.helpers.length
  let batches = catalog.batches.length
  let files = registryFiles.length + docsFiles.length
  process.stdout.write(`✓ registry/catalog.json: ${entries} entries and ${helpers} helpers in ${batches} batches\n`)
  process.stdout.write(`✓ ${files} browser-reachable files import only remix/component and #remixcn aliases\n`)
}
