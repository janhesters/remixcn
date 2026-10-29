// Reads the Remix app remixcn installs into: its package.json, its TypeScript
// settings, and components.json, whose aliases resolve through package.json
// imports or tsconfig.json paths to the directories files install in.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import { CliError } from './errors.ts'
import { checkRegistryUrl } from './network.ts'

export const supportedRemix = '3.0.0'
export const configVersion = 1
export const configSchemaUrl = 'https://janhesters.github.io/remixcn/schema/components.json'
export const defaultNamespace = '@remixcn'
export const defaultRegistryUrl = 'https://janhesters.github.io/remixcn/r/{name}.json'
export const defaultAliases = { ui: '#remixcn/ui', lib: '#remixcn/lib', components: '#remixcn/components' }
export const aliasNames = ['ui', 'lib', 'components'] as const

export type AliasName = (typeof aliasNames)[number]
export type Directories = Record<AliasName, string>

export interface JsonFile<Value> {
  path: string
  text: string
  value: Value
}

export interface ComponentsConfig {
  $schema?: string
  version?: unknown
  rsc?: unknown
  tsx?: unknown
  css?: unknown
  aliases?: Record<string, unknown>
  registries?: Record<string, unknown>
  [field: string]: unknown
}

interface PathMap {
  base: string
  paths: Record<string, unknown>
}

export interface Project {
  root: string
  packageJson: JsonFile<Record<string, any>>
  compilerOptions?: Record<string, unknown>
  paths?: PathMap
}

/** Parses JSON with comments and trailing commas, as tsconfig.json allows. */
export function parseJsonc(text: string, source: string): unknown {
  let output = ''
  for (let index = 0; index < text.length; index++) {
    let char = text[index]
    if (char === '"') {
      let end = index + 1
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1
      output += text.slice(index, end + 1)
      index = end
    } else if (text.startsWith('//', index)) {
      while (index < text.length && text[index] !== '\n') index++
      output += '\n'
    } else if (text.startsWith('/*', index)) {
      let end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 1
      output += ' '
    } else output += char
  }

  try {
    return JSON.parse(output.replace(/,(\s*[}\]])/g, '$1'))
  } catch (error) {
    throw new CliError('PROJECT', `${source} is not valid JSON: ${(error as Error).message}`)
  }
}

function readJsonFile<Value>(path: string, label: string, jsonc = false): JsonFile<Value> {
  let text = readFileSync(path, 'utf8')
  if (jsonc) return { path, text, value: parseJsonc(text, label) as Value }

  try {
    return { path, text, value: JSON.parse(text.replace(/^﻿/, '')) }
  } catch (error) {
    throw new CliError('PROJECT', `${label} is not valid JSON: ${(error as Error).message}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads a tsconfig.json and the relative configs it extends. Later configs
 * win, and `paths` resolve from `baseUrl` or from the config that sets them.
 */
function readTsconfig(
  path: string,
  root: string,
  seen = new Set<string>(),
): { compilerOptions: Record<string, unknown>; paths?: PathMap; baseUrl?: string } {
  if (seen.has(path) || seen.size > 10) return { compilerOptions: {} }
  seen.add(path)

  let label = relative(root, path) || path
  let { value } = readJsonFile<Record<string, unknown>>(path, label, true)
  let merged: { compilerOptions: Record<string, unknown>; paths?: PathMap; baseUrl?: string } = { compilerOptions: {} }

  let bases = Array.isArray(value.extends) ? value.extends : value.extends === undefined ? [] : [value.extends]
  for (let base of bases) {
    if (typeof base !== 'string' || !/^\.\.?\//.test(base)) continue
    let basePath = resolve(dirname(path), base)
    if (!existsSync(basePath) && existsSync(`${basePath}.json`)) basePath = `${basePath}.json`
    if (!existsSync(basePath)) continue
    let parent = readTsconfig(basePath, root, seen)
    merged = {
      compilerOptions: { ...merged.compilerOptions, ...parent.compilerOptions },
      paths: parent.paths ?? merged.paths,
      baseUrl: parent.baseUrl ?? merged.baseUrl,
    }
  }

  let options = isRecord(value.compilerOptions) ? value.compilerOptions : {}
  let baseUrl = typeof options.baseUrl === 'string' ? resolve(dirname(path), options.baseUrl) : merged.baseUrl
  let paths = isRecord(options.paths) ? { base: dirname(path), paths: options.paths } : merged.paths

  return {
    compilerOptions: { ...merged.compilerOptions, ...options },
    baseUrl,
    paths: paths && { base: baseUrl ?? paths.base, paths: paths.paths },
  }
}

/** Reads the app at `cwd`. It needs a package.json; tsconfig.json is read when it exists. */
export function readProject(cwd: string): Project {
  let root = resolve(cwd)
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new CliError('PROJECT', `${root} is not a directory. Pass the app's directory with --cwd.`)
  }

  let packagePath = join(root, 'package.json')
  if (!existsSync(packagePath)) {
    throw new CliError(
      'PROJECT',
      `No package.json in ${root}. Run remixcn in your Remix app's root, or pass it with --cwd.`,
    )
  }

  let packageJson = readJsonFile<Record<string, any>>(packagePath, 'package.json')
  if (!isRecord(packageJson.value)) throw new CliError('PROJECT', 'package.json must hold an object')

  let tsconfigPath = join(root, 'tsconfig.json')
  if (!existsSync(tsconfigPath)) return { root, packageJson }

  let { compilerOptions, paths } = readTsconfig(tsconfigPath, root)
  return { root, packageJson, compilerOptions, paths }
}

function installedRemix(root: string): string | undefined {
  for (let directory = root; ; directory = dirname(directory)) {
    let manifest = join(directory, 'node_modules/remix/package.json')
    if (existsSync(manifest)) {
      try {
        let version = JSON.parse(readFileSync(manifest, 'utf8')).version
        return typeof version === 'string' ? version : undefined
      } catch {
        return undefined
      }
    }
    if (dirname(directory) === directory) return undefined
  }
}

/** The major version of a version or a simple range such as ^3.0.0, or undefined. */
export function majorVersion(version: string): number | undefined {
  let match = /^\s*[v=^~]*(\d+)(\.|\s*$)/.exec(version)
  return match ? Number(match[1]) : undefined
}

/** The remix version the app runs: the installed one, or else the declared one. */
export function remixVersion(project: Project): string | undefined {
  let { dependencies = {}, devDependencies = {} } = project.packageJson.value
  let declared = dependencies.remix ?? devDependencies.remix
  if (typeof declared !== 'string') return undefined
  return installedRemix(project.root) ?? declared
}

/**
 * Checks that the app is one RemixCN supports: Remix 3 from package.json, and
 * TypeScript JSX through remix/component.
 */
export function checkRemixProject(project: Project): void {
  let version = remixVersion(project)
  if (version === undefined) {
    throw new CliError(
      'PROJECT',
      `${project.root} isn't a Remix app: package.json lists no remix dependency. RemixCN supports Remix 3 apps, such as one from npx remix new.`,
    )
  }
  if (majorVersion(version) !== majorVersion(supportedRemix)) {
    throw new CliError('PROJECT', `RemixCN supports Remix 3 apps, but package.json resolves remix to ${version}.`)
  }

  if (!project.compilerOptions) {
    throw new CliError(
      'PROJECT',
      `No tsconfig.json in ${project.root}. RemixCN components are TypeScript with Remix JSX.`,
    )
  }

  let problems: string[] = []
  let { jsx, jsxImportSource } = project.compilerOptions
  if (jsx !== 'react-jsx' && jsx !== 'react-jsxdev')
    problems.push('set "jsx": "react-jsx" in tsconfig.json compilerOptions')
  if (jsxImportSource !== 'remix/component') {
    problems.push('set "jsxImportSource": "remix/component" in tsconfig.json compilerOptions')
  }
  if (problems.length > 0) {
    throw new CliError('PROJECT', "The app's TypeScript doesn't compile Remix JSX:", problems)
  }
}

function patternTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return patternTarget(value[0])
  if (isRecord(value)) return patternTarget(value.default ?? value.import ?? value.browser ?? value.node)
  return undefined
}

/** Matches `alias` as a directory against import-map style keys: exact, or the longest `prefix*`. */
function matchDirectory(map: Record<string, unknown>, alias: string): string | undefined {
  let exact = patternTarget(map[alias])
  if (exact !== undefined && !exact.includes('*')) return exact

  let directory = `${alias}/`
  let best: { prefix: string; target: string } | undefined
  for (let [key, value] of Object.entries(map)) {
    if (!key.endsWith('*') || key.indexOf('*') !== key.length - 1) continue
    let prefix = key.slice(0, -1)
    let target = patternTarget(value)
    if (!directory.startsWith(prefix) || !target?.endsWith('*') || (best && best.prefix.length >= prefix.length))
      continue
    best = { prefix, target }
  }

  return best && best.target.slice(0, -1) + directory.slice(best.prefix.length)
}

/**
 * Resolves an import alias, such as #remixcn/ui or ~/components, to the
 * directory it names: through package.json imports for a #alias, else through
 * tsconfig.json paths.
 */
export function resolveAlias(project: Project, alias: string): string | undefined {
  let imports = project.packageJson.value.imports
  if (alias.startsWith('#') && isRecord(imports)) {
    let target = matchDirectory(imports, alias)
    if (target !== undefined) return resolve(project.root, target)
  }

  if (project.paths) {
    let target = matchDirectory(project.paths.paths, alias)
    if (target !== undefined) return resolve(project.paths.base, target)
  }

  return undefined
}

export function isInside(root: string, path: string): boolean {
  let fromRoot = relative(root, path)
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot))
}

/** Resolves the ui, lib and components aliases to directories inside the app. */
export function resolveDirectories(project: Project, config: ComponentsConfig): Directories {
  let directories: Partial<Directories> = {}
  let unresolved: string[] = []
  let outside: string[] = []

  for (let name of aliasNames) {
    let alias = String(config.aliases?.[name])
    let directory = resolveAlias(project, alias)
    if (directory === undefined) {
      unresolved.push(`aliases.${name} "${alias}" matches no package.json imports or tsconfig.json paths entry`)
    } else if (!isInside(project.root, directory)) {
      outside.push(`aliases.${name} "${alias}" resolves to ${directory}, outside the project`)
    } else directories[name] = directory
  }

  if (outside.length > 0) throw new CliError('UNSAFE_PATH', 'components.json points outside the project:', outside)
  if (unresolved.length > 0) {
    throw new CliError('PROJECT', "components.json has aliases remixcn can't resolve to a directory:", unresolved)
  }
  return directories as Directories
}

/** Reads components.json, or returns undefined when the app has none. */
export function readComponentsConfig(root: string): JsonFile<ComponentsConfig> | undefined {
  let path = join(root, 'components.json')
  if (!existsSync(path)) return undefined

  let file = readJsonFile<ComponentsConfig>(path, 'components.json')
  if (!isRecord(file.value)) throw new CliError('PROJECT', 'components.json must hold an object')
  return file
}

function checkRegistries(registries: unknown): string[] {
  if (registries === undefined) return []
  if (!isRecord(registries)) return ['registries must map namespaces such as @acme to URL templates']

  return Object.entries(registries).flatMap(([namespace, template]) => {
    if (!/^@[a-z0-9][a-z0-9-]*$/.test(namespace)) {
      return [`registries: "${namespace}" must start with @, such as @${namespace.replace(/^@*/, '') || 'acme'}`]
    }
    if (typeof template !== 'string') {
      return [
        `registries.${namespace}: remixcn supports a URL template only, without headers, params or environment variables`,
      ]
    }
    if (template.includes('{style}'))
      return [`registries.${namespace}: {style} is not supported; RemixCN registries have one style`]

    let problem = checkRegistryUrl(template.replaceAll('{name}', 'name'))
    if (problem) return [`registries.${namespace}: ${problem.replaceAll('/name.json', '/{name}.json')}`]
    if (!template.includes('{name}')) return [`registries.${namespace}: the URL needs a {name} placeholder`]
    return []
  })
}

/** Lists what keeps `config` from installing RemixCN items. */
export function checkComponentsConfig(config: ComponentsConfig): string[] {
  let problems: string[] = []

  if (config.version === undefined) {
    problems.push(`components.json is not set up for RemixCN: it needs "version": ${configVersion}. Run remixcn init.`)
  } else if (config.version !== configVersion) {
    problems.push(
      `components.json has version ${String(config.version)}, which this remixcn does not know. Update remixcn.`,
    )
  }

  if (config.rsc !== undefined && config.rsc !== false) {
    problems.push('RemixCN components are not React Server Components: set "rsc": false')
  }
  if (config.tsx !== undefined && config.tsx !== true) problems.push('RemixCN ships TypeScript source: set "tsx": true')

  let aliases = isRecord(config.aliases) ? config.aliases : {}
  if (aliasNames.some((name) => typeof aliases[name] !== 'string' || aliases[name] === '')) {
    problems.push('components.json needs aliases.ui, aliases.lib and aliases.components. Run remixcn init.')
  }

  return [...problems, ...checkRegistries(config.registries)]
}

/** The registries an app can address: @remixcn, then the ones components.json adds or overrides. */
export function registriesOf(config: ComponentsConfig | undefined): Record<string, string> {
  let problems = checkRegistries(config?.registries)
  if (problems.length > 0) throw new CliError('PROJECT', 'components.json has registries remixcn cannot use:', problems)

  return { [defaultNamespace]: defaultRegistryUrl, ...(config?.registries as Record<string, string> | undefined) }
}
