// remixcn list, search and view: reads registry indexes and items without
// changing the app. They work before remixcn init, with the @remixcn registry.
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { CliError } from './errors.ts'
import { checkRegistryUrl, readJsonFile } from './network.ts'
import type { FetchJson } from './network.ts'
import { readComponentsConfig, registriesOf } from './project.ts'
import { itemName } from './registry.ts'
import { checkItem, loadPayload, parseAddress } from './resolve.ts'

export interface DiscoverContext {
  registries: Record<string, string>
  cwd: string
  fetchJson: FetchJson
}

export interface IndexItem {
  name: string
  type: string
  title?: string
  description?: string
  registry: string
  addCommandArgument: string
}

export interface SearchOptions {
  registries: string[]
  query?: string
  types?: string[]
  limit: number
  offset: number
}

export interface SearchResult {
  items: IndexItem[]
  pagination: { total: number; offset: number; limit: number; hasMore: boolean }
}

/** The registries `root` can address: @remixcn and those in its components.json, if it has one. */
export function registriesAt(root: string): Record<string, string> {
  return registriesOf(readComponentsConfig(resolve(root))?.value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An item's URL in a registry URL, as shadcn builds it: the last "registry" in the path becomes the item's name. */
function itemUrl(name: string, registry: string): string {
  let url = new URL(registry)
  let index = url.pathname.lastIndexOf('registry')
  if (index === -1) return new URL(`${name}.json`, url).href
  url.pathname = url.pathname.slice(0, index) + name + url.pathname.slice(index + 'registry'.length)
  url.search = url.search.replace(/\bregistry\b/g, name)
  return url.href
}

/**
 * Reads a registry index: a configured namespace, whose {name} becomes
 * "registry" as in shadcn, a registry.json URL, or a local registry.json.
 */
export async function readIndex(registry: string, context: DiscoverContext): Promise<{ items: IndexItem[] }> {
  let location: string
  let value: unknown
  let address: (name: string) => string

  if (registry.startsWith('@')) {
    let template = context.registries[registry]
    if (template === undefined) {
      throw new CliError('REGISTRY', `Unknown registry ${registry}. Add it under registries in components.json.`)
    }
    location = template.replaceAll('{name}', 'registry')
    value = await context.fetchJson(location)
    address = (name) => `${registry}/${name}`
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(registry)) {
    let problem = checkRegistryUrl(registry)
    if (problem) throw new CliError('REGISTRY', problem)
    location = registry
    value = await context.fetchJson(location)
    address = (name) => itemUrl(name, registry)
  } else if (/^\.{1,2}\//.test(registry) || isAbsolute(registry) || registry.endsWith('.json')) {
    location = resolve(context.cwd, registry)
    value = readJsonFile(location)
    address = (name) => join(dirname(location), `${name}.json`)
  } else {
    throw new CliError(
      'USAGE',
      `Can't read "${registry}" as a registry: use a namespace such as @remixcn, a registry.json URL, or a path`,
    )
  }

  if (!isRecord(value) || !Array.isArray(value.items))
    throw new CliError('REGISTRY', `${location} is not a registry index`)

  let items = value.items.map((item: unknown): IndexItem => {
    if (
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      !itemName.test(item.name) ||
      typeof item.type !== 'string'
    ) {
      throw new CliError('REGISTRY', `${location} lists an item without a valid name and type`)
    }
    return {
      name: item.name,
      type: item.type,
      ...(typeof item.title === 'string' && { title: item.title }),
      ...(typeof item.description === 'string' && { description: item.description }),
      registry: registry.startsWith('@') ? registry : location,
      addCommandArgument: address(item.name),
    }
  })

  return { items }
}

function matches(item: IndexItem, terms: string[]) {
  let text = `${item.name} ${item.title ?? ''} ${item.description ?? ''}`.toLowerCase()
  return terms.every((term) => text.includes(term))
}

function rank(item: IndexItem, terms: string[]) {
  let [first = ''] = terms
  if (item.name === terms.join('-')) return 0
  if (item.name.startsWith(first)) return 1
  if (item.name.includes(first)) return 2
  return 3
}

/** Lists the items of `options.registries`, or of every registry the app can address, that match the query. */
export async function search(options: SearchOptions, context: DiscoverContext): Promise<SearchResult> {
  let registries = options.registries.length > 0 ? options.registries : Object.keys(context.registries)
  let terms = (options.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  let types = (options.types ?? []).map((type) => (type.startsWith('registry:') ? type : `registry:${type}`))

  let found: IndexItem[] = []
  for (let registry of registries) {
    let { items } = await readIndex(registry, context)
    found.push(...items.filter((item) => matches(item, terms) && (types.length === 0 || types.includes(item.type))))
  }

  if (terms.length > 0)
    found = found
      .map((item, order) => ({ item, order }))
      .sort((left, right) => rank(left.item, terms) - rank(right.item, terms) || left.order - right.order)
      .map(({ item }) => item)

  let items = found.slice(options.offset, options.offset + options.limit)
  return {
    items,
    pagination: {
      total: found.length,
      offset: options.offset,
      limit: options.limit,
      hasMore: options.offset + items.length < found.length,
    },
  }
}

/** Loads each addressed item as the registry serves it, after checking that remixcn could install it. */
export async function view(addresses: string[], context: DiscoverContext): Promise<unknown[]> {
  if (addresses.length === 0) throw new CliError('USAGE', 'Name the items to view, such as remixcn view button.')

  let payloads: unknown[] = []
  for (let address of addresses) {
    let source = parseAddress(address, context)
    let payload = await loadPayload(source, context)
    checkItem(payload, source.location)
    payloads.push(payload)
  }
  return payloads
}
