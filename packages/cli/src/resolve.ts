// Turns the addresses a user gives into registry items: it loads each item
// and its registryDependencies, checks every payload before anything is
// written, and orders them so each item follows what it depends on.
import { isAbsolute, resolve } from 'node:path'

import { CliError } from './errors.ts'
import { checkRegistryUrl, readJsonFile } from './network.ts'
import type { FetchJson } from './network.ts'
import { majorVersion } from './project.ts'
import { isSafeTarget, itemName, shippedTypes } from './registry.ts'

export interface ItemFile {
  path: string
  type: string
  target: string
  content: string
}

/** A registry item that passed checkItem. */
export interface Item {
  name: string
  type: string
  title?: string
  description?: string
  registryDependencies: string[]
  files: ItemFile[]
  docs?: string
  meta?: Record<string, unknown>
  /** The URL or path it came from. */
  source: string
}

export type Source = { kind: 'url' | 'file'; location: string }

export interface AddressContext {
  registries: Record<string, string>
  cwd: string
  /** The item whose registryDependencies hold the address, if any. */
  dependencyOf?: string
}

const allowedFields = new Set([
  '$schema',
  'name',
  'type',
  'title',
  'author',
  'description',
  'dependencies',
  'devDependencies',
  'registryDependencies',
  'files',
  'docs',
  'categories',
  'meta',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocalPath(input: string) {
  return /^\.{1,2}\//.test(input) || isAbsolute(input) || input.endsWith('.json')
}

function urlSource(url: string): Source {
  let problem = checkRegistryUrl(url)
  if (problem) throw new CliError('REGISTRY', problem)
  return { kind: 'url', location: url }
}

/**
 * Reads one address: a name in @remixcn, @namespace/name in a configured
 * registry, an item URL, or a local item file. Registry items may name only
 * namespaced items and URLs, so a remote item never reads a local file.
 */
export function parseAddress(input: string, context: AddressContext): Source {
  let { dependencyOf } = context

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return urlSource(input)

  let namespaced = /^(@[^/]+)\/(.*)$/.exec(input)
  if (namespaced) {
    let [, namespace, name] = namespaced
    let template = context.registries[namespace]
    if (template === undefined) {
      throw new CliError(
        'REGISTRY',
        `Unknown registry ${namespace}${dependencyOf ? `, which ${dependencyOf} depends on` : ''}. Add it under registries in components.json, such as "${namespace}": "https://example.com/r/{name}.json".`,
      )
    }
    if (!itemName.test(name)) {
      throw new CliError(
        dependencyOf ? 'REGISTRY' : 'USAGE',
        `"${input}" is not an item name: use lowercase words joined by hyphens`,
      )
    }
    return urlSource(template.replaceAll('{name}', name))
  }

  if (dependencyOf !== undefined) {
    if (isLocalPath(input)) {
      throw new CliError(
        'REGISTRY',
        `${dependencyOf} depends on a local file (${input}). Registry items may depend only on @namespace/name items and URLs.`,
      )
    }
    throw new CliError(
      'REGISTRY',
      `${dependencyOf} depends on "${input}". A bare name means shadcn/ui's React component, so RemixCN items name dependencies as @namespace/name.`,
    )
  }

  if (isLocalPath(input)) return { kind: 'file', location: resolve(context.cwd, input) }
  if (itemName.test(input)) return parseAddress(`@remixcn/${input}`, context)

  throw new CliError(
    'USAGE',
    `Can't read "${input}" as an item: use a name such as button, @namespace/name, an https:// URL, or a path to an item's JSON file`,
  )
}

/**
 * Checks a registry item payload before remixcn uses it. It throws
 * UNSAFE_PATH when a file would land outside the install directories, and
 * REGISTRY for every other problem.
 */
export function checkItem(value: unknown, source: string, options: { remix?: string } = {}): Item {
  if (!isRecord(value)) throw new CliError('REGISTRY', `${source} is not a registry item`)

  let name = typeof value.name === 'string' && itemName.test(value.name) ? value.name : undefined
  if (name === undefined) throw new CliError('REGISTRY', `${source} has no valid item name`)

  let problems: string[] = []
  let unsafe: string[] = []

  if (typeof value.type !== 'string' || !shippedTypes.includes(value.type)) {
    problems.push(`${name}: type ${String(value.type)} is not one remixcn installs (${shippedTypes.join(', ')})`)
  }

  for (let field of ['dependencies', 'devDependencies'] as const) {
    let packages = value[field]
    if (Array.isArray(packages) && packages.length > 0) {
      problems.push(
        `${name}: needs the npm packages ${packages.join(', ')}, which remixcn does not install: RemixCN items add no runtime packages`,
      )
    } else if (packages !== undefined && !Array.isArray(packages)) problems.push(`${name}: ${field} must be a list`)
  }

  for (let field of Object.keys(value).filter((field) => !allowedFields.has(field))) {
    problems.push(`${name}: ${field} is not supported: RemixCN items install plain source files`)
  }

  let dependencies = value.registryDependencies ?? []
  if (!Array.isArray(dependencies) || !dependencies.every((dependency) => typeof dependency === 'string')) {
    problems.push(`${name}: registryDependencies must be a list of item addresses`)
  }

  for (let field of ['title', 'description', 'docs'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') problems.push(`${name}: ${field} must be text`)
  }
  if (value.meta !== undefined && !isRecord(value.meta)) problems.push(`${name}: meta must be an object`)

  let files: ItemFile[] = []
  if (!Array.isArray(value.files)) problems.push(`${name}: files must be a list`)
  for (let file of Array.isArray(value.files) ? value.files : []) {
    if (!isRecord(file) || typeof file.path !== 'string' || typeof file.type !== 'string') {
      problems.push(`${name}: each file needs a path and a type`)
      continue
    }
    if (typeof file.target !== 'string' || !isSafeTarget(file.target)) {
      unsafe.push(
        `${name}: ${file.path} installs to "${String(file.target)}", but a target must stay inside @ui/, @lib/ or @components/`,
      )
      continue
    }
    if (typeof file.content !== 'string') {
      problems.push(`${name}: ${file.path} has no content`)
      continue
    }
    files.push({ path: file.path, type: file.type, target: file.target, content: file.content })
  }

  if (unsafe.length > 0)
    throw new CliError('UNSAFE_PATH', `${source} would write outside the install directories:`, unsafe)
  if (problems.length > 0) throw new CliError('REGISTRY', `${source} is not an item remixcn can install:`, problems)

  let meta = value.meta as Record<string, unknown> | undefined
  let remix = meta?.remix
  if (options.remix && typeof remix === 'string' && majorVersion(remix) !== majorVersion(options.remix)) {
    throw new CliError('REGISTRY', `${name} is written for remix ${remix}, but the app runs remix ${options.remix}`)
  }

  return {
    name,
    type: value.type as string,
    title: value.title as string | undefined,
    description: value.description as string | undefined,
    registryDependencies: dependencies as string[],
    files,
    docs: value.docs as string | undefined,
    meta,
    source,
  }
}

export interface ResolveContext {
  registries: Record<string, string>
  cwd: string
  fetchJson: FetchJson
  /** The app's remix version, which each item's meta.remix must match. */
  remix?: string
}

/** Loads the JSON at `source`, as the registry serves it. */
export async function loadPayload(source: Source, context: Pick<ResolveContext, 'fetchJson'>): Promise<unknown> {
  return source.kind === 'url' ? await context.fetchJson(source.location) : readJsonFile(source.location)
}

/** Loads and checks one item, without its dependencies. */
export async function loadItem(source: Source, context: Pick<ResolveContext, 'fetchJson' | 'remix'>): Promise<Item> {
  return checkItem(await loadPayload(source, context), source.location, { remix: context.remix })
}

/**
 * Loads the items `inputs` name and everything they depend on. Each item
 * comes after its dependencies, which install in name order, as the
 * registry build's dependencyClosure orders them.
 */
export async function resolveItems(
  inputs: string[],
  context: ResolveContext,
): Promise<{ items: Item[]; requested: Set<string> }> {
  let done = new Map<string, Item>()
  let byName = new Map<string, Item>()
  let order: Item[] = []

  async function visit(source: Source, chain: Array<{ location: string; name: string }>): Promise<Item> {
    let cycleStart = chain.findIndex((entry) => entry.location === source.location)
    if (cycleStart !== -1) {
      let names = chain.slice(cycleStart).map((entry) => entry.name)
      throw new CliError('REGISTRY', `The registry has a dependency cycle: ${[...names, names[0]].join(' → ')}`)
    }

    let existing = done.get(source.location)
    if (existing) return existing

    let item = await loadItem(source, context)
    let sameName = byName.get(item.name)
    if (sameName && sameName.source !== item.source) {
      throw new CliError(
        'REGISTRY',
        `Two items are named ${item.name}: ${sameName.source} and ${item.source}. Add only one of them.`,
      )
    }
    byName.set(item.name, item)

    let dependencies = [...new Set(item.registryDependencies)].sort()
    for (let dependency of dependencies) {
      let dependencySource = parseAddress(dependency, { ...context, dependencyOf: item.name })
      await visit(dependencySource, [...chain, { location: source.location, name: item.name }])
    }

    done.set(source.location, item)
    order.push(item)
    return item
  }

  let requested = new Set<string>()
  for (let input of inputs) {
    let item = await visit(parseAddress(input, context), [])
    requested.add(item.name)
  }

  return { items: order, requested }
}
