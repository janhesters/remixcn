// remixcn add: installs registry items and everything they depend on into a
// Remix app that remixcn init set up, as one change that a failure undoes.
import { relative, resolve } from 'node:path'

import { CliError } from './errors.ts'
import { inspectFiles, placeFiles } from './install.ts'
import type { FileContent, PlannedFile } from './install.ts'
import type { FetchJson } from './network.ts'
import {
  checkComponentsConfig,
  checkRemixProject,
  defaultNamespace,
  isInside,
  readComponentsConfig,
  readProject,
  registriesOf,
  remixVersion,
  resolveDirectories,
} from './project.ts'
import { readIndex } from './discover.ts'
import { resolveItems } from './resolve.ts'
import type { FileSystem } from './transaction.ts'
import { writeAll } from './transaction.ts'

export interface Context {
  /** The directory the user ran remixcn in. Local item paths resolve from here. */
  cwd: string
  fetchJson: FetchJson
  /** Asks the user a yes/no question, or is undefined when nobody can answer. */
  confirm?: (question: string) => Promise<boolean>
  fs?: FileSystem
}

export interface WriteOptions {
  /** The app's directory: --cwd. */
  root: string
  yes: boolean
  overwrite: boolean
  dryRun: boolean
}

export interface AddOptions extends WriteOptions {
  items: string[]
  all: boolean
  path?: string
}

export interface FileResult {
  path: string
  action: PlannedFile['action']
  item?: string
  /** An update that replaces content the user has, rather than adding settings. */
  overwrite?: true
}

export interface InstallResult {
  dryRun: boolean
  items: string[]
  files: FileResult[]
  docs: string[]
}

/** A file that only gains fields, such as components.json in init, is no conflict. */
export interface Change extends FileContent {
  merge?: boolean
}

/**
 * Writes `changes` unless --dry-run. A file that exists with other content is
 * replaced only with --overwrite or the user's answer to one question; without
 * either, nothing is written.
 */
export async function commit(changes: Change[], options: WriteOptions, context: Context): Promise<FileResult[]> {
  let root = resolve(options.root)
  let merges = new Set(changes.filter((change) => change.merge).map((change) => change.path))
  let planned = inspectFiles(changes, root)
  let conflicts = planned
    .filter((file) => file.action === 'update' && !merges.has(file.path))
    .map((file) => relative(root, file.path))

  if (!options.dryRun && conflicts.length > 0 && !options.overwrite) {
    let question = `These ${conflicts.length} file(s) differ from the registry:\n${conflicts.map((path) => `  ${path}\n`).join('')}Overwrite them?`
    let approved = !options.yes && context.confirm ? await context.confirm(question) : false
    if (!approved) {
      throw new CliError(
        'CONFLICT',
        `${conflicts.length} file(s) already exist with other content, so nothing was written. Pass --overwrite to replace them, or --dry-run to see every change.`,
        conflicts,
      )
    }
  }

  if (!options.dryRun)
    writeAll(
      planned.filter((file) => file.action !== 'unchanged'),
      context.fs,
    )

  return planned.map((file) => ({
    path: relative(root, file.path),
    action: file.action,
    ...(file.item !== undefined && { item: file.item }),
    ...(file.action === 'update' && !merges.has(file.path) && { overwrite: true as const }),
  }))
}

/** Reads an app that remixcn init set up: its project files, components.json, registries and install directories. */
export function readSetUpProject(root: string) {
  let project = readProject(root)
  checkRemixProject(project)

  let config = readComponentsConfig(project.root)
  if (!config) throw new CliError('PROJECT', `No components.json in ${project.root}. Run remixcn init first.`)

  let problems = checkComponentsConfig(config.value)
  if (problems.length > 0) throw new CliError('PROJECT', "components.json isn't ready for remixcn add:", problems)

  return {
    project,
    config: config.value,
    registries: registriesOf(config.value),
    directories: resolveDirectories(project, config.value),
  }
}

export async function add(options: AddOptions, context: Context): Promise<InstallResult> {
  let { project, registries, directories } = readSetUpProject(options.root)

  let inputs = options.items
  if (options.all) {
    let index = await readIndex(defaultNamespace, { registries, cwd: context.cwd, fetchJson: context.fetchJson })
    inputs = [...inputs, ...index.items.map((item) => `${defaultNamespace}/${item.name}`)]
  }
  if (inputs.length === 0)
    throw new CliError('USAGE', 'Name the items to add, such as remixcn add button, or pass --all.')

  let path = options.path === undefined ? undefined : resolve(project.root, options.path)
  if (path !== undefined && !isInside(project.root, path)) {
    throw new CliError('UNSAFE_PATH', `--path ${options.path} leaves the project at ${project.root}`)
  }

  let { items, requested } = await resolveItems(inputs, {
    registries,
    cwd: context.cwd,
    fetchJson: context.fetchJson,
    remix: remixVersion(project),
  })
  let files = placeFiles(items, { root: project.root, directories, requested, path })

  return {
    dryRun: options.dryRun,
    items: items.map((item) => item.name),
    files: await commit(files, options, context),
    docs: items.flatMap((item) => (item.docs ? [`${item.name}: ${item.docs}`] : [])),
  }
}
