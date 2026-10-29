import { isBuiltin } from 'node:module'

export const seoPhrase = 'shadcn components for Remix V3'
export const homepage = 'https://janhesters.github.io/remixcn/'
export const repositoryUrl = 'git+https://github.com/janhesters/remixcn.git'
export const requiredKeywords = [
  seoPhrase,
  'shadcn',
  'shadcn-ui',
  'remix',
  'remix-v3',
  'registry',
  'ui-components',
  'accessibility',
  'design-system',
]

const moduleTrace = /^======== Resolving module '(.+)' from '(.+)'\. ========$/
const typeReferenceTrace = /^======== Resolving type reference directive '(.+?)', containing file '(.+?)'/

/**
 * Reads each file's imports and type references from `tsc --traceResolution`
 * output. TypeScript's parser finds them, so text in strings, comments and JSX
 * never counts as an import.
 */
export function parseResolutionTrace(trace: string): Map<string, string[]> {
  let imports = new Map<string, string[]>()

  for (let line of trace.split('\n')) {
    let match = moduleTrace.exec(line) ?? typeReferenceTrace.exec(line)
    if (!match) continue

    let [, specifier, file] = match
    let specifiers = imports.get(file) ?? []
    if (!specifiers.includes(specifier)) specifiers.push(specifier)
    imports.set(file, specifiers)
  }

  return imports
}

/** Lists a stylesheet's at-rules with their preludes, skipping comments and strings. */
function findCssAtRules(css: string): Array<{ name: string; prelude: string }> {
  let rules: Array<{ name: string; prelude: string }> = []
  let index = 0

  function skipComment() {
    let end = css.indexOf('*/', index + 2)
    index = end === -1 ? css.length : end + 2
  }

  function readString() {
    let quote = css[index]
    let start = index++
    while (index < css.length && css[index] !== quote && css[index] !== '\n') {
      index += css[index] === '\\' ? 2 : 1
    }
    index++
    return css.slice(start, index)
  }

  while (index < css.length) {
    let char = css[index]

    if (css.startsWith('/*', index)) skipComment()
    else if (char === '"' || char === "'") readString()
    else if (char === '@') {
      let name = /^[\w-]+/.exec(css.slice(index + 1))?.[0] ?? ''
      index += name.length + 1

      let prelude = ''
      while (index < css.length && css[index] !== ';' && css[index] !== '{') {
        if (css.startsWith('/*', index)) skipComment()
        else if (css[index] === '"' || css[index] === "'") prelude += readString()
        else prelude += css[index++]
      }
      rules.push({ name, prelude: prelude.trim() })
    } else index++
  }

  return rules
}

export function findCssImports(css: string): string[] {
  return findCssAtRules(css)
    .filter((rule) => rule.name === 'import')
    .flatMap((rule) => /^(?:url\(\s*)?["']?([^"')\s]+)/.exec(rule.prelude)?.[1] ?? [])
}

const tailwindDirectives = new Set([
  'tailwind',
  'apply',
  'theme',
  'utility',
  'variant',
  'custom-variant',
  'plugin',
  'config',
  'source',
  'reference',
])

export function findTailwindDirectives(css: string): string[] {
  let names = findCssAtRules(css)
    .map((rule) => rule.name)
    .filter((name) => tailwindDirectives.has(name))
  return [...new Set(names)].map((name) => `@${name}`)
}

/** Counts @font-face rules. Registry and docs CSS use system fonts, so they load no font file. */
export function findFontFaces(css: string): number {
  return findCssAtRules(css).filter((rule) => rule.name === 'font-face').length
}

const noticesUrl = 'https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md'
const copyrightLine = 'Copyright (c) 2026 Jan Hesters. MIT License.'
const licenseLine = `License texts: ${noticesUrl}`

/** Reads the comment a file starts with: its `//` lines, or its first `/* *\/` block. */
function readLeadingComment(source: string): string[] {
  let text = source.trimStart()

  if (text.startsWith('/*')) {
    let end = text.indexOf('*/')
    return text
      .slice(2, end === -1 ? text.length : end)
      .split('\n')
      .map((line) => line.replace(/^\s*\*?\s?/, '').trimEnd())
      .filter((line) => line !== '')
  }

  let lines: string[] = []
  for (let line of text.split('\n')) {
    if (!line.startsWith('//')) break
    lines.push(line.replace(/^\/\/\s?/, '').trimEnd())
  }
  return lines
}

/**
 * Checks that a registry file starts with the installed-source header that
 * SOURCES.md defines, naming the catalog entry's title, so the copyright and
 * license notices travel with every copied file.
 */
export function checkSourceHeader(source: string, title: string): string[] {
  let lines = readLeadingComment(source)
  if (lines.length === 0) return ['must start with the installed-source header from SOURCES.md']

  let problems: string[] = []
  let firstLine = `RemixCN ${title}: ${homepage}`

  if (lines[0] !== firstLine) problems.push(`header must start with "${firstLine}"`)
  if (lines[1] !== copyrightLine) problems.push(`header must carry "${copyrightLine}"`)
  if (lines.at(-1) !== licenseLine) problems.push(`header must end with "${licenseLine}"`)

  return problems
}

const forbiddenFamilies: Array<[RegExp, string]> = [
  [/^(react|react-dom|scheduler)(\/|$)/, 'React'],
  [/^(tailwindcss|tailwind-merge)(\/|$)|^@tailwindcss\//, 'Tailwind'],
  [/^@base-ui(-components)?\//, 'Base UI'],
  [/^@radix-ui\/|^radix-ui(\/|$)/, 'Radix'],
  [/^@floating-ui\//, 'Floating UI'],
  [/^@remix-run\/ui(\/|$)/, '@remix-run/ui'],
]

const allowedPackageImports = new Set([
  'remix/component',
  'remix/component/jsx-runtime',
  'remix/component/jsx-dev-runtime',
])

const registryAliasPattern = /^#remixcn\/(ui|lib)\/[a-z0-9-]+\.tsx?$/

/**
 * Checks one import of browser-reachable source. Registry files reach each
 * other only through the #remixcn aliases, so the installer can rewrite them;
 * the docs app may also use relative imports.
 */
export function checkImport(specifier: string, options: { allowRelative: boolean }): string | undefined {
  let family = forbiddenFamilies.find(([pattern]) => pattern.test(specifier))?.[1]
  if (family) return `"${specifier}" brings in ${family}, which browser-reachable source must not use`

  if (isBuiltin(specifier)) return `"${specifier}" is a Node built-in, which browser-reachable source must not use`

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return options.allowRelative
      ? undefined
      : `"${specifier}": import registry files through #remixcn/ui/ or #remixcn/lib/ so the installer can rewrite the path`
  }

  if (allowedPackageImports.has(specifier) || registryAliasPattern.test(specifier)) return undefined

  return `"${specifier}": browser-reachable source imports only remix/component and #remixcn/ui/ or #remixcn/lib/ files`
}

export interface CatalogItem {
  name: string
  title: string
  kind: 'component' | 'recipe' | 'helper'
  batch: number
  source: string
  docs?: string
  example?: string
  behavior?: string
  compatibleWith?: string
  note?: string
  dependsOn: string[]
  upstreamImports: string[]
  target: string
}

export interface UpstreamSource {
  repository: string
  commit: string
  [field: string]: string
}

export interface Catalog {
  name: string
  namespace: string
  homepage: string
  upstream: { shadcn: UpstreamSource; [name: string]: UpstreamSource }
  reconciliation: {
    sourceFiles: number
    docsPages: number
    docsOnlyRecipes: string[]
    sourceOnly: string[]
    registryWithoutSource: string[]
    note?: string
  }
  upstreamImportNotes?: Record<string, string>
  batches: Array<{ id: number; title: string; description: string }>
  outOfScope: Array<{ name: string; reason: string }>
  entries: CatalogItem[]
  helpers: CatalogItem[]
}

const targetDirectories = { component: 'registry/ui', recipe: 'registry/examples', helper: 'registry/lib' }
// Helpers include the theme stylesheet and the icons, so they may be CSS or TSX.
const targetExtensions = { component: ['tsx'], recipe: ['tsx'], helper: ['ts', 'tsx', 'css'] }

function expectedTargets(item: CatalogItem) {
  return targetExtensions[item.kind].map((extension) => `${targetDirectories[item.kind]}/${item.name}.${extension}`)
}

// registry/lib/name.ts, .tsx or .css
function describeTargets([first, ...rest]: string[]) {
  if (rest.length === 0) return first

  let extensions = rest.map((target) => target.slice(target.lastIndexOf('.')))
  return `${[first, ...extensions.slice(0, -1)].join(', ')} or ${extensions.at(-1)}`
}

function checkItem(item: CatalogItem, catalog: Catalog, byName: Map<string, CatalogItem>): string[] {
  let problems: string[] = []
  let { shadcn } = catalog.upstream

  // Components and recipes port shadcn/ui files. Helpers may also port the
  // behavior of another pinned upstream, such as Base UI or Remix.
  let pinned = item.kind === 'helper' ? Object.values(catalog.upstream) : [shadcn]
  if (!pinned.some(({ repository, commit }) => item.source.startsWith(`${repository}/blob/${commit}/`))) {
    problems.push(
      item.kind === 'helper'
        ? `${item.name}: source must link a file at a pinned upstream commit`
        : `${item.name}: source must link a file at shadcn commit ${shadcn.commit}`,
    )
  }

  if (item.kind !== 'helper' && !item.docs?.startsWith('https://ui.shadcn.com/docs/components/')) {
    problems.push(`${item.name}: docs must link a page of the Components docs`)
  }

  if (!catalog.batches.some((batch) => batch.id === item.batch)) {
    problems.push(`${item.name}: batch ${item.batch} does not exist`)
  }

  let targets = expectedTargets(item)
  if (!targets.includes(item.target)) {
    problems.push(`${item.name}: a ${item.kind} belongs at ${describeTargets(targets)}`)
  }

  for (let name of item.dependsOn) {
    let dependency = byName.get(name)
    if (!dependency) problems.push(`${item.name}: depends on ${name}, which is not in the catalog`)
    else if (dependency.batch > item.batch) {
      problems.push(`${item.name}: depends on ${name}, which lands in a later batch (${dependency.batch})`)
    }
  }

  if (item.compatibleWith !== undefined) {
    if (!byName.has(item.compatibleWith)) {
      problems.push(`${item.name}: compatible with ${item.compatibleWith}, which is not in the catalog`)
    }
    if (!item.dependsOn.includes(item.compatibleWith)) {
      problems.push(`${item.name}: must depend on ${item.compatibleWith}, the entry it is compatible with`)
    }
  }

  return problems
}

function sameNames(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().join() === [...right].sort().join()
}

function checkReconciliation(catalog: Catalog): string[] {
  let problems: string[] = []
  let { reconciliation, entries } = catalog
  let components = entries.filter((entry) => entry.kind === 'component')
  let recipes = entries.filter((entry) => entry.kind === 'recipe').map((entry) => entry.name)
  let names = new Set(entries.map((entry) => entry.name))

  if (components.length !== reconciliation.sourceFiles) {
    problems.push(
      `reconciliation: ${components.length} component entries, but sourceFiles says ${reconciliation.sourceFiles}`,
    )
  }

  if (!sameNames(recipes, reconciliation.docsOnlyRecipes)) {
    problems.push(
      `reconciliation: recipes are ${recipes.join(', ')}, but docsOnlyRecipes says ${reconciliation.docsOnlyRecipes.join(', ')}`,
    )
  }

  let docsPages = entries.length - reconciliation.sourceOnly.length
  if (docsPages !== reconciliation.docsPages) {
    problems.push(
      `reconciliation: ${docsPages} entries have their own docs page, but docsPages says ${reconciliation.docsPages}`,
    )
  }

  for (let name of reconciliation.sourceOnly) {
    if (!components.some((entry) => entry.name === name)) {
      problems.push(`reconciliation: sourceOnly ${name} is not a component entry`)
    }
  }

  for (let name of reconciliation.registryWithoutSource) {
    if (names.has(name)) problems.push(`reconciliation: ${name} has no source file, so it can't be an entry`)
  }

  return problems
}

/** Checks the catalog's links, batches, dependencies, targets and reconciliation counts. */
export function checkCatalog(catalog: Catalog): string[] {
  let items = [...catalog.entries, ...catalog.helpers]
  let byName = new Map(items.map((item) => [item.name, item]))
  let problems = items.flatMap((item) => checkItem(item, catalog, byName))

  let seen = new Set<string>()
  for (let { name } of items) {
    if (seen.has(name)) problems.push(`${name}: listed more than once`)
    seen.add(name)
  }

  for (let { name } of catalog.outOfScope) {
    if (byName.has(name)) problems.push(`${name}: listed as out of scope and as an entry`)
  }

  problems.push(...checkReconciliation(catalog))

  for (let batch of catalog.batches) {
    if (!items.some((item) => item.batch === batch.id)) problems.push(`batch ${batch.id} has no entries`)
  }

  return problems
}

/** Reports registry source files that no catalog entry names as its target. */
export function checkRegistryFiles(catalog: Catalog, files: string[]): string[] {
  let targets = new Set([...catalog.entries, ...catalog.helpers].map((item) => item.target))

  return files
    .filter((file) => !/\.test(\.browser|\.e2e)?\.tsx?$/.test(file) && !targets.has(file))
    .map((file) => `${file}: not a target in registry/catalog.json`)
}

export interface PackageJson {
  name: string
  description?: string
  keywords?: string[]
  homepage?: string
  repository?: { type: string; url: string; directory?: string }
  license?: string
  engines?: { node?: string }
  bin?: Record<string, string>
  files?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function quoteKeyword(keyword: string) {
  return keyword.includes(' ') ? `"${keyword}"` : keyword
}

/** Checks the names, SEO phrase, homepage and keywords Jan approved on C-976. */
export function checkPackageMetadata(pkg: PackageJson): string[] {
  let problems: string[] = []

  if (!pkg.description?.includes(seoPhrase)) problems.push(`${pkg.name}: description must contain "${seoPhrase}"`)

  let missing = requiredKeywords.filter((keyword) => !pkg.keywords?.includes(keyword))
  if (missing.length > 0) problems.push(`${pkg.name}: keywords miss ${missing.map(quoteKeyword).join(', ')}`)

  if (pkg.homepage !== homepage) problems.push(`${pkg.name}: homepage must be ${homepage}`)
  if (pkg.repository?.url !== repositoryUrl) problems.push(`${pkg.name}: repository must be ${repositoryUrl}`)
  if (pkg.license !== 'MIT') problems.push(`${pkg.name}: license must be MIT`)

  return problems
}

/** Checks the remixcn executable's package contract: its bin, files, Node range and empty runtime dependencies. */
export function checkCliPackage(pkg: PackageJson, workspace: Pick<PackageJson, 'engines'>): string[] {
  let problems: string[] = []

  if (pkg.name !== 'remixcn') problems.push(`${pkg.name}: name must be remixcn`)
  if (pkg.bin?.remixcn !== './dist/bin.js') problems.push(`${pkg.name}: bin must map remixcn to ./dist/bin.js`)
  if (!pkg.files?.includes('dist')) problems.push(`${pkg.name}: files must include dist`)

  if (pkg.engines?.node !== workspace.engines?.node) {
    problems.push(`${pkg.name}: engines.node must match the workspace (${workspace.engines?.node})`)
  }

  for (let field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    let names = Object.keys(pkg[field] ?? {})
    if (names.length > 0) problems.push(`${pkg.name}: ${field} must be empty (${names.join(', ')})`)
  }

  return problems
}

/** Browser-reachable packages get remix from the consuming app and nothing else. */
export function checkBrowserPackage(pkg: PackageJson): string[] {
  let extra = Object.keys(pkg.dependencies ?? {}).filter((name) => name !== 'remix')
  return extra.length > 0 ? [`${pkg.name}: dependencies may only list remix (${extra.join(', ')})`] : []
}
