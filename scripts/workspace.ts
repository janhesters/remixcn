import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lists the root package.json and each workspace package.json, relative to
 * `root`. Workspace patterns are directories or `directory/*`, as Bun reads them.
 */
export function listPackageFiles(root: string): string[] {
  let { workspaces = [] } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { workspaces?: string[] }

  let directories = workspaces.flatMap((pattern) => {
    if (!pattern.endsWith('/*')) return [pattern]
    let parent = pattern.slice(0, -2)
    return readdirSync(join(root, parent)).map((name) => `${parent}/${name}`)
  })

  let files = directories.map((directory) => `${directory}/package.json`).filter((file) => existsSync(join(root, file)))
  return ['package.json', ...files.sort()]
}
