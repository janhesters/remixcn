import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { run } from './cli.ts'

function capture() {
  let output = { stdout: '', stderr: '' }
  let io = {
    stdout: (text: string) => {
      output.stdout += text
    },
    stderr: (text: string) => {
      output.stderr += text
    },
  }
  return { io, output }
}

describe('remixcn', () => {
  it('prints its version for --version', () => {
    let { io, output } = capture()

    let code = run(['--version'], { ...io, version: '1.2.3' })

    assert.equal(code, 0)
    assert.equal(output.stdout, '1.2.3\n')
    assert.equal(output.stderr, '')
  })

  it('prints usage for --help', () => {
    let { io, output } = capture()

    let code = run(['--help'], { ...io, version: '1.2.3' })

    assert.equal(code, 0)
    assert.match(output.stdout, /^Usage: remixcn /m)
    assert.match(output.stdout, /shadcn components for Remix V3/)
    assert.match(output.stdout, /https:\/\/janhesters\.github\.io\/remixcn\//)
  })

  it('prints usage when it gets no arguments', () => {
    let { io, output } = capture()

    let code = run([], { ...io, version: '1.2.3' })

    assert.equal(code, 0)
    assert.match(output.stdout, /^Usage: remixcn /m)
  })

  it('rejects an unknown command with usage on stderr', () => {
    let { io, output } = capture()

    let code = run(['add', 'button'], { ...io, version: '1.2.3' })

    assert.equal(code, 1)
    assert.equal(output.stdout, '')
    assert.match(output.stderr, /^remixcn: unknown command "add"/)
    assert.match(output.stderr, /^Usage: remixcn /m)
  })
})
