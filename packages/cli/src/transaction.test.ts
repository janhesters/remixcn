import * as fs from 'node:fs'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { CliError } from './errors.ts'
import { writeAll } from './transaction.ts'

let scratch: string[] = []

afterEach(() => {
  for (let directory of scratch) rmSync(directory, { recursive: true, force: true })
  scratch = []
})

function directory() {
  let root = mkdtempSync(join(tmpdir(), 'remixcn-transaction-'))
  scratch.push(root)
  return root
}

/** Lists every file and directory under `root` with each file's content. */
function snapshot(root: string) {
  return Object.fromEntries(
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .sort()
      .map((path) => {
        let full = join(root, path)
        return [relative(root, full), fs.statSync(full).isDirectory() ? '<dir>' : readFileSync(full, 'utf8')]
      }),
  )
}

/**
 * The real file system, except that the `failAt`th call of `method` throws.
 * A partial write first writes half its content, as a full disk would.
 */
function failing(method: 'renameSync' | 'writeFileSync' | 'mkdirSync', failAt: number, partial = false) {
  let calls = 0
  return {
    ...fs,
    [method]: (...args: unknown[]) => {
      if (++calls === failAt) {
        if (partial) {
          let [path, content, options] = args as [string, string, fs.WriteFileOptions]
          fs.writeFileSync(path, content.slice(0, content.length / 2), options)
        }
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      }
      return (fs[method] as (...args: unknown[]) => unknown)(...args)
    },
  } as typeof fs
}

describe('writeAll', () => {
  it('creates files and their directories, and replaces existing files', () => {
    let root = directory()
    writeFileSync(join(root, 'old.ts'), 'old\n')

    writeAll([
      { path: join(root, 'app/ui/public/lib/cx.ts'), content: 'cx\n' },
      { path: join(root, 'old.ts'), content: 'new\n' },
    ])

    assert.deepEqual(snapshot(root), {
      app: '<dir>',
      'app/ui': '<dir>',
      'app/ui/public': '<dir>',
      'app/ui/public/lib': '<dir>',
      'app/ui/public/lib/cx.ts': 'cx\n',
      'old.ts': 'new\n',
    })
  })

  for (let [method, failAt, partial] of [
    ['mkdirSync', 2],
    ['writeFileSync', 3],
    ['writeFileSync', 1, true],
    ['writeFileSync', 2, true],
    ['renameSync', 1],
    ['renameSync', 2],
    ['renameSync', 4],
  ] as const) {
    it(`leaves the app as it was when call ${failAt} of ${method} fails${partial ? ' halfway' : ''}`, () => {
      let root = directory()
      mkdirSync(join(root, 'app'))
      writeFileSync(join(root, 'app/existing.ts'), 'mine\n')
      writeFileSync(join(root, 'package.json'), '{}\n')
      let before = snapshot(root)

      let error: unknown
      try {
        writeAll(
          [
            { path: join(root, 'app/ui/public/components/ui/button.tsx'), content: 'button\n' },
            { path: join(root, 'app/existing.ts'), content: 'theirs\n' },
            { path: join(root, 'app/ui/public/lib/cx.ts'), content: 'cx\n' },
          ],
          failing(method, failAt, partial),
        )
      } catch (caught) {
        error = caught
      }

      assert.ok(error instanceof CliError, String(error))
      assert.equal(error.code, 'WRITE')
      assert.match(error.message, /permission denied.*undid every change/)
      assert.deepEqual(snapshot(root), before)
    })
  }
  it("leaves a staging file it didn't create", () => {
    let root = directory()
    let foreign = ''
    let taken = {
      ...fs,
      writeFileSync: (path: string) => {
        foreign = path
        fs.writeFileSync(path, 'not ours\n')
        throw Object.assign(new Error('EEXIST: file already exists'), { code: 'EEXIST' })
      },
    } as unknown as typeof fs

    assert.throws(() => writeAll([{ path: join(root, 'cx.ts'), content: 'cx\n' }], taken), /EEXIST/)
    assert.equal(readFileSync(foreign, 'utf8'), 'not ours\n')
  })
})
