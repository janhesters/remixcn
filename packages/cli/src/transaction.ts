// Writes a set of files as one change: every file is staged beside its target
// first, then each target is swapped in. When any step fails, the earlier
// steps are undone, so the app keeps all of its files as they were.
import { randomBytes } from 'node:crypto'
import * as nodeFs from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { CliError } from './errors.ts'

export type FileSystem = Pick<
  typeof nodeFs,
  'existsSync' | 'mkdirSync' | 'writeFileSync' | 'renameSync' | 'rmSync' | 'rmdirSync'
>

export interface Write {
  path: string
  content: string
}

interface Staged {
  path: string
  temp: string
  backup?: string
  committed: boolean
}

export function writeAll(writes: Write[], fs: FileSystem = nodeFs): void {
  let id = `${process.pid}-${randomBytes(4).toString('hex')}`
  let createdDirectories: string[] = []
  let staged: Staged[] = []
  let current = ''

  function createDirectory(directory: string) {
    let missing: string[] = []
    for (let parent = directory; !fs.existsSync(parent); parent = dirname(parent)) missing.unshift(parent)
    for (let path of missing) {
      fs.mkdirSync(path)
      createdDirectories.push(path)
    }
  }

  function rollback(): string[] {
    let leftovers: string[] = []
    for (let entry of [...staged].reverse()) {
      try {
        if (entry.committed) fs.rmSync(entry.path, { force: true })
        if (entry.backup && fs.existsSync(entry.backup)) fs.renameSync(entry.backup, entry.path)
        fs.rmSync(entry.temp, { force: true })
      } catch (error) {
        leftovers.push(`${entry.path}: ${(error as Error).message}`)
      }
    }
    for (let directory of [...createdDirectories].reverse()) {
      try {
        fs.rmdirSync(directory)
      } catch (error) {
        leftovers.push(`${directory}: ${(error as Error).message}`)
      }
    }
    return leftovers
  }

  try {
    for (let write of writes) {
      current = write.path
      createDirectory(dirname(write.path))
      let temp = join(dirname(write.path), `.${basename(write.path)}.remixcn-${id}.tmp`)
      // Staged before the write, so a write that fails halfway still gets removed.
      staged.push({ path: write.path, temp, committed: false })
      try {
        fs.writeFileSync(temp, write.content, { flag: 'wx' })
      } catch (error) {
        // EEXIST: the file belongs to someone else, so rollback must leave it.
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') staged.pop()
        throw error
      }
    }

    for (let entry of staged) {
      current = entry.path
      if (fs.existsSync(entry.path)) {
        entry.backup = `${entry.temp.slice(0, -'.tmp'.length)}.backup`
        fs.renameSync(entry.path, entry.backup)
      }
      fs.renameSync(entry.temp, entry.path)
      entry.committed = true
    }
  } catch (error) {
    let leftovers = rollback()
    let reason = `Could not write ${current}: ${(error as Error).message}.`
    if (leftovers.length > 0) {
      throw new CliError('WRITE', `${reason} remixcn could not undo every change; check these paths:`, leftovers)
    }
    throw new CliError('WRITE', `${reason} remixcn undid every change, so the app is as it was.`)
  }

  for (let entry of staged) {
    if (entry.backup) fs.rmSync(entry.backup, { force: true })
  }
}
