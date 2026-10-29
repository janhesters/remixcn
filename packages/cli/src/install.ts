// Plans where each item file goes in the app and what it holds there: the
// target alias picks the directory, each file must keep the source rules the
// registry build checks, and each #remixcn/ui or #remixcn/lib import becomes a
// relative path to the installed file. Nothing is written here.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

import { CliError } from './errors.ts'
import { isInside } from './project.ts'
import type { Directories } from './project.ts'
import { isPlainPath } from './registry.ts'
import type { Item } from './resolve.ts'
import { checkSourceContent } from './source.ts'

export interface FileContent {
  path: string
  content: string
  /** The item it comes from, or undefined for a config file. */
  item?: string
}

export interface PlannedFile extends FileContent {
  action: 'create' | 'update' | 'unchanged'
}

export interface PlaceOptions {
  root: string
  directories: Directories
  /** The items the user named, which --path moves. */
  requested?: Set<string>
  /** --path: where the requested items' ui and components files go instead. */
  path?: string
}

const scriptFile = /\.[cm]?[jt]sx?$/
const aliasImport = /(['"])#remixcn\/(ui|lib)\/([^'"\n]*)\1/g

function toImportPath(from: string, to: string) {
  let path = relative(dirname(from), to).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
}

/** Decides where each file of `items` installs and the content it gets there. */
export function placeFiles(items: Item[], options: PlaceOptions): FileContent[] {
  let { root, directories } = options
  let placed: Array<{ item: Item; file: Item['files'][number]; path: string }> = []
  let unsafe: string[] = []

  for (let item of items) {
    for (let file of item.files) {
      let [, alias, rest] = /^@(ui|lib|components)\/(.+)$/.exec(file.target) as unknown as [
        string,
        keyof Directories,
        string,
      ]
      let moved = options.path !== undefined && options.requested?.has(item.name) && alias !== 'lib'
      let path = resolve(moved ? (options.path as string) : directories[alias], rest)
      if (!isInside(root, path))
        unsafe.push(`${item.name}: ${file.target} would install to ${path}, outside the project`)
      placed.push({ item, file, path })
    }
  }

  let owners = new Map<string, string>()
  for (let { item, path } of placed) {
    let owner = owners.get(path)
    if (owner !== undefined && owner !== item.name)
      unsafe.push(`${owner} and ${item.name} both install ${relative(root, path)}`)
    owners.set(path, item.name)
  }
  if (unsafe.length > 0) throw new CliError('UNSAFE_PATH', 'These files would not land safely in the project:', unsafe)

  let installed = new Map(placed.map(({ file, path }) => [file.target, path]))
  let problems = placed.flatMap(({ item, file, path }) =>
    checkSourceContent(path, file.content).map((problem) => `${item.name}: ${file.path}: ${problem}`),
  )

  let files = placed.map(({ item, file, path }) => {
    if (!scriptFile.test(path)) return { path, content: file.content, item: item.name }

    let content = file.content.replace(aliasImport, (specifier, quote: string, alias: 'ui' | 'lib', rest: string) => {
      let target = installed.get(`@${alias}/${rest}`) ?? resolve(directories[alias], rest)
      if (!isPlainPath(rest) || (!installed.has(`@${alias}/${rest}`) && !existsSync(target))) {
        problems.push(
          `${item.name}: ${file.path} imports #remixcn/${alias}/${rest}, which neither this install nor the app provides`,
        )
        return specifier
      }
      return `${quote}${toImportPath(path, target)}${quote}`
    })
    return { path, content, item: item.name }
  })

  if (problems.length > 0)
    throw new CliError('REGISTRY', "The items hold source remixcn won't install, so nothing was written:", problems)
  return files
}

function lstat(path: string) {
  try {
    return lstatSync(path)
  } catch {
    return undefined
  }
}

/**
 * Compares each file with what the app holds. A file may only replace a
 * regular file, and only through directories whose real path stays inside
 * the project, so a link can't send a write into another project.
 */
export function inspectFiles(files: FileContent[], root: string): PlannedFile[] {
  let realRoot = realpathSync(root)
  let unsafe: string[] = []

  let planned = files.map((file): PlannedFile => {
    let shown = relative(root, file.path)

    let parent = dirname(file.path)
    while (!lstat(parent)) parent = dirname(parent)
    let realParent = realpathSync(parent)
    if (!isInside(realRoot, realParent)) {
      unsafe.push(`${shown} goes through a link that leaves the project (${realParent})`)
    } else if (!lstat(realParent)?.isDirectory()) unsafe.push(`${relative(root, parent)} is a file, not a directory`)

    let stats = lstat(file.path)
    if (!stats) return { ...file, action: 'create' }
    if (stats.isSymbolicLink()) unsafe.push(`${shown} is a link; remixcn replaces only regular files`)
    else if (stats.isDirectory()) unsafe.push(`${shown} is a directory, not a file`)
    else if (stats.isFile() && readFileSync(file.path, 'utf8') === file.content) return { ...file, action: 'unchanged' }
    return { ...file, action: 'update' }
  })

  if (unsafe.length > 0) throw new CliError('UNSAFE_PATH', 'remixcn will not write these files:', unsafe)
  return planned
}
