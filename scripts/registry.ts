import { checkImport, findTailwindDirectives } from './contracts.ts'
import type { Catalog, CatalogItem } from './contracts.ts'

export const registrySchemaUrl = 'https://ui.shadcn.com/schema/registry.json'
export const registryItemSchemaUrl = 'https://ui.shadcn.com/schema/registry-item.json'

/** The item every item with registry source installs, directly or through a dependency. */
export const licensesItem = 'licenses'

export interface RegistryFile {
  path: string
  type: string
  target?: string
}

/** An entry of the root registry.json, in shadcn's registry-item format. */
export interface RegistryItem {
  name: string
  type: string
  title?: string
  description?: string
  registryDependencies?: string[]
  dependencies?: string[]
  devDependencies?: string[]
  files?: RegistryFile[]
  docs?: string
  categories?: string[]
  [field: string]: unknown
}

export interface Registry {
  $schema?: string
  name: string
  homepage: string
  include?: string[]
  items: RegistryItem[]
}

export interface RegistrySource {
  registry: Registry
  catalog: Pick<Catalog, 'namespace' | 'homepage' | 'entries' | 'helpers'>
  /** The content of each listed file that exists, by path. */
  files: Map<string, string>
  /** The imports of each listed TypeScript and CSS file, by path. */
  imports: Map<string, string[]>
}

const shippedTypes = ['registry:ui', 'registry:component', 'registry:lib', 'registry:style', 'registry:file']
const itemFields = new Set([
  '$schema',
  'name',
  'type',
  'title',
  'description',
  'registryDependencies',
  'dependencies',
  'devDependencies',
  'files',
  'docs',
  'categories',
])
const itemName = /^[a-z0-9]+(-[a-z0-9]+)*$/
const licenseFiles = new Set(['LICENSE', 'THIRD_PARTY_NOTICES.md'])
const registrySource = /^registry\/(ui|lib|examples)\/[a-z0-9]+(-[a-z0-9]+)*\.(tsx?|css)$/
const aliasDirectories = { ui: '@ui', lib: '@lib', examples: '@components' } as const
const aliasImport = /^#remixcn\/(ui|lib)\/(.+)$/

/**
 * A relative path that names a file inside its directory: no parent or empty
 * segments, no backslashes, home, drive or percent-encoded parts.
 */
function isPlainPath(path: string) {
  return !/[\\%~:\0-\x1f]/.test(path) && path.split('/').every((segment) => !['', '.', '..'].includes(segment))
}

/**
 * Checks a listed source path before anything reads it. Items ship
 * registry/ui, registry/lib and registry/examples source and the license
 * texts, and nothing else: no tests, server files, app code or secrets.
 */
export function checkSourcePath(path: string): string | undefined {
  if (!isPlainPath(path)) return `"${path}" must be a plain relative path inside the workspace`

  if (!licenseFiles.has(path) && !registrySource.test(path)) {
    return `"${path}" is not registry source: items ship registry/ui, registry/lib and registry/examples files without tests, and the license texts`
  }
}

/** Where a file installs, as a shadcn target placeholder for the user's ui, lib or components alias. */
function expectedTarget(path: string) {
  if (licenseFiles.has(path)) return `@lib/remixcn/${path}`
  let [, directory, name] = path.split('/') as [string, keyof typeof aliasDirectories, string]
  return `${aliasDirectories[directory]}/${name}`
}

/**
 * Registry and plain CSS files keep their exact content in shadcn's CLI,
 * which rewrites the source of every other type.
 */
function expectedFileType(path: string) {
  if (licenseFiles.has(path) || path.endsWith('.css')) return 'registry:file'
  if (path.startsWith('registry/ui/')) return 'registry:ui'
  if (path.startsWith('registry/examples/')) return 'registry:component'
  return 'registry:lib'
}

function expectedItemType(entry: CatalogItem) {
  if (entry.kind === 'component') return { type: 'registry:ui', kind: 'catalog component' }
  if (entry.kind === 'recipe') return { type: 'registry:component', kind: 'catalog recipe' }
  return entry.target.endsWith('.css')
    ? { type: 'registry:style', kind: 'catalog helper written in CSS' }
    : { type: 'registry:lib', kind: 'catalog helper written in TypeScript' }
}

function isSafeTarget(target: string | undefined) {
  let match = /^@(ui|lib|components)\/(.+)$/.exec(target ?? '')
  return match !== null && isPlainPath(match[2])
}

function dependencyName(dependency: string) {
  return dependency.startsWith('@remixcn/') ? dependency.slice('@remixcn/'.length) : undefined
}

function dependencyNames(item: RegistryItem) {
  return (item.registryDependencies ?? []).flatMap((dependency) => dependencyName(dependency) ?? [])
}

/**
 * Lists the items `name` installs, each after the items it depends on. Each
 * level goes in name order, so the list doesn't depend on how registry.json
 * orders items or dependencies. A cycle stops where it closes.
 */
export function dependencyClosure(items: RegistryItem[], name: string): string[] {
  let byName = new Map(items.map((item) => [item.name, item]))
  let closure: string[] = []
  let seen = new Set<string>()

  function visit(current: string) {
    let item = byName.get(current)
    if (!item || seen.has(current)) return
    seen.add(current)
    for (let dependency of [...new Set(dependencyNames(item))].sort()) visit(dependency)
    closure.push(current)
  }

  visit(name)
  return closure
}

function findCycles(items: RegistryItem[]): string[][] {
  let byName = new Map(items.map((item) => [item.name, item]))
  let cycles = new Map<string, string[]>()
  let done = new Set<string>()

  function visit(name: string, path: string[]) {
    let start = path.indexOf(name)
    if (start !== -1) {
      let cycle = path.slice(start)
      let first = cycle.indexOf([...cycle].sort()[0])
      let rotated = [...cycle.slice(first), ...cycle.slice(0, first)]
      cycles.set(rotated.join(), [...rotated, rotated[0]])
      return
    }
    let item = byName.get(name)
    if (!item || done.has(name)) return
    for (let dependency of [...new Set(dependencyNames(item))].sort()) visit(dependency, [...path, name])
    done.add(name)
  }

  for (let name of [...byName.keys()].sort()) visit(name, [])
  return [...cycles.values()]
}

function checkFile(item: RegistryItem, file: RegistryFile, source: RegistrySource): string[] {
  let pathProblem = checkSourcePath(file.path)
  if (pathProblem) return [`${item.name}: ${pathProblem}`]

  let problems: string[] = []
  let content = source.files.get(file.path)
  if (content === undefined) problems.push(`${item.name}: ${file.path} does not exist`)

  let type = expectedFileType(file.path)
  if (file.type !== type) problems.push(`${item.name}: ${file.path} has type ${type}`)

  if (!isSafeTarget(file.target)) {
    problems.push(`${item.name}: target "${file.target}" must stay inside the @ui/, @lib/ or @components/ directory`)
  } else if (file.target !== expectedTarget(file.path)) {
    problems.push(`${item.name}: ${file.path} installs to ${expectedTarget(file.path)}`)
  }

  if (content !== undefined && file.path.endsWith('.css')) {
    for (let directive of findTailwindDirectives(content)) {
      problems.push(`${item.name}: ${file.path}: ${directive} is a Tailwind directive, which shipped CSS must not use`)
    }
  }

  return problems
}

function checkImports(item: RegistryItem, file: RegistryFile, owners: Map<string, string>, imports: string[]): string[] {
  let dependencies = new Set(dependencyNames(item))

  return imports.flatMap((specifier) => {
    let problem = checkImport(specifier, { allowRelative: false })
    if (problem) return [`${item.name}: ${file.path}: ${problem}`]

    let alias = aliasImport.exec(specifier)
    if (!alias) return []

    let owner = owners.get(`registry/${alias[1]}/${alias[2]}`)
    if (owner === undefined) return [`${item.name}: ${file.path} imports ${specifier}, which no item ships`]
    if (owner !== item.name && !dependencies.has(owner)) {
      return [
        `${item.name}: ${file.path} imports ${specifier} from ${owner}, so it must list @remixcn/${owner} in registryDependencies`,
      ]
    }
    return []
  })
}

function checkCatalogEntry(item: RegistryItem, entry: CatalogItem | undefined): string[] {
  if (!entry) return [`${item.name}: not in registry/catalog.json`]

  let problems: string[] = []
  let expected = expectedItemType(entry)
  if (item.type !== expected.type) problems.push(`${item.name}: a ${expected.kind} has type ${expected.type}`)
  if (item.title && item.title !== entry.title) {
    problems.push(`${item.name}: title "${item.title}" differs from "${entry.title}" in registry/catalog.json`)
  }

  for (let file of item.files ?? []) {
    if (file.path.startsWith('registry/') && file.path !== entry.target) {
      problems.push(`${item.name}: ships ${file.path}, but registry/catalog.json gives it ${entry.target}`)
    }
  }

  return problems
}

function checkItem(item: RegistryItem, source: RegistrySource, owners: Map<string, string>): string[] {
  let problems: string[] = []
  let names = new Set(source.registry.items.map((entry) => entry.name))
  let catalog = new Map([...source.catalog.entries, ...source.catalog.helpers].map((entry) => [entry.name, entry]))

  if (!itemName.test(item.name)) problems.push(`${item.name}: item names are lowercase words joined by hyphens`)
  if (item.name === 'registry') problems.push('registry: the index is registry.json, so no item may take this name')
  if (!shippedTypes.includes(item.type)) {
    problems.push(`${item.name}: type ${item.type} is not one RemixCN ships (${shippedTypes.join(', ')})`)
  }
  if (!item.title || !item.description) problems.push(`${item.name}: needs a title and a description`)

  for (let field of Object.keys(item).filter((field) => !itemFields.has(field))) {
    problems.push(`${item.name}: ${field} is not supported: items ship plain source files and the build writes meta`)
  }

  for (let field of ['dependencies', 'devDependencies'] as const) {
    if (item[field]?.length) {
      problems.push(
        `${item.name}: ${field} must stay empty: the app supplies remix and items add no npm packages (${item[field].join(', ')})`,
      )
    }
  }

  for (let dependency of item.registryDependencies ?? []) {
    let name = dependencyName(dependency)
    if (name === undefined) {
      problems.push(
        `${item.name}: depends on "${dependency}", but registryDependencies name @remixcn items; a bare name installs shadcn/ui's React component`,
      )
    } else if (name === item.name) problems.push(`${item.name}: depends on itself`)
    else if (!names.has(name)) problems.push(`${item.name}: depends on ${dependency}, which registry.json does not list`)
  }

  let files = item.files ?? []
  if (files.length === 0) problems.push(`${item.name}: ships no files`)

  for (let file of files) {
    problems.push(...checkFile(item, file, source))
  }

  let shipsSource = files.some((file) => file.path.startsWith('registry/'))
  if (shipsSource) problems.push(...checkCatalogEntry(item, catalog.get(item.name)))
  else if (files.length > 0 && item.type !== 'registry:file') {
    problems.push(`${item.name}: an item of license texts has type registry:file`)
  }

  let paths = new Set(files.map((file) => file.path))
  if (item.name === licensesItem) {
    for (let missing of [...licenseFiles].filter((path) => !paths.has(path))) {
      problems.push(
        `${item.name}: ships ${[...licenseFiles].join(' and ')}, the license texts every item installs, but misses ${missing}`,
      )
    }
  } else {
    for (let path of [...licenseFiles].filter((path) => paths.has(path))) {
      problems.push(`${item.name}: only @remixcn/${licensesItem} ships ${path}`)
    }
  }

  for (let file of files) {
    let imports = source.imports.get(file.path)
    if (imports && checkSourcePath(file.path) === undefined) problems.push(...checkImports(item, file, owners, imports))
  }

  return problems
}

/**
 * Checks the root registry.json against RemixCN's contracts: names, types,
 * explicit @remixcn dependencies without cycles, safe source paths and
 * install targets, local imports that resolve inside the dependency closure,
 * no npm dependencies, and the license texts with every item.
 */
export function checkRegistry(source: RegistrySource): string[] {
  let { registry, catalog } = source
  let problems: string[] = []
  let namespace = catalog.namespace.replace(/^@/, '')

  if (registry.name !== namespace) problems.push(`registry name must be "${namespace}", the catalog namespace without @`)
  if (registry.homepage !== catalog.homepage) problems.push(`registry homepage must be ${catalog.homepage}`)
  if (registry.include !== undefined) problems.push('registry must list its items itself, without include')

  let owners = new Map<string, string>()
  for (let item of registry.items) {
    for (let file of item.files ?? []) if (!owners.has(file.path)) owners.set(file.path, item.name)
  }

  let seen = new Set<string>()
  for (let item of registry.items) {
    if (seen.has(item.name)) problems.push(`${item.name}: listed more than once`)
    seen.add(item.name)
    problems.push(...checkItem(item, source, owners))
  }

  let installers = new Map<string, string[]>()
  for (let item of registry.items) {
    for (let file of item.files ?? []) {
      if (file.target) installers.set(file.target, [...(installers.get(file.target) ?? []), item.name])
    }
  }
  for (let [target, names] of installers) {
    if (names.length > 1) problems.push(`${target}: both ${names.join(' and ')} install a file there`)
  }

  for (let cycle of findCycles(registry.items)) problems.push(`dependency cycle: ${cycle.join(' → ')}`)

  for (let item of registry.items) {
    let shipsSource = (item.files ?? []).some((file) => file.path.startsWith('registry/'))
    if (shipsSource && !dependencyClosure(registry.items, item.name).includes(licensesItem)) {
      problems.push(
        `${item.name}: installs no license texts: list @remixcn/${licensesItem} in registryDependencies, directly or through a dependency`,
      )
    }
  }

  return problems
}

function normalizeNewlines(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

function toJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Builds a registry that checkRegistry passed into its output files:
 * registry.json, the index, and <name>.json, each item with its files'
 * contents. Keys, items and dependencies come in a fixed order, so the same
 * source always gives the same bytes.
 */
export function buildRegistry(source: RegistrySource, options: { remix: string }): Map<string, string> {
  let { registry, catalog } = source
  let sources = new Map([...catalog.entries, ...catalog.helpers].map((entry) => [entry.name, entry.source]))
  let items = [...registry.items].sort((left, right) => (left.name < right.name ? -1 : 1))

  let payloads = items.map((item) => {
    let dependencies = [...new Set(item.registryDependencies ?? [])].sort()
    let upstream = sources.get(item.name)
    let shipsSource = (item.files ?? []).some((file) => file.path.startsWith('registry/'))

    return {
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      ...(dependencies.length > 0 && { registryDependencies: dependencies }),
      files: (item.files ?? []).map((file) => ({
        path: file.path,
        type: file.type,
        target: file.target,
        content: normalizeNewlines(source.files.get(file.path) ?? ''),
      })),
      ...(item.docs !== undefined && { docs: item.docs }),
      ...(item.categories !== undefined && { categories: [...item.categories] }),
      meta: { remix: options.remix, license: 'MIT', ...(shipsSource && upstream !== undefined && { source: upstream }) },
    }
  })

  let index = {
    $schema: registrySchemaUrl,
    name: registry.name,
    homepage: registry.homepage,
    items: payloads.map((payload) => ({
      ...payload,
      files: payload.files.map(({ content: _content, ...file }) => file),
    })),
  }

  return new Map([
    ['registry.json', toJson(index)],
    ...payloads.map((payload): [string, string] => [
      `${payload.name}.json`,
      toJson({ $schema: registryItemSchemaUrl, ...payload }),
    ]),
  ])
}
