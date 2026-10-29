import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { findSecrets, isSecretFile } from './secrets.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

// The examples are assembled at runtime, so this file holds no credential-shaped text itself.
const examples = {
  'a private key': ['-----BEGIN OPENSSH ', 'PRIVATE KEY-----'].join(''),
  'a GitHub token': `ghp_${'a1B2'.repeat(9)}`,
  'an npm token': `npm_${'Z9y8'.repeat(9)}`,
  'an npm registry auth token': `//registry.npmjs.org/:_auth${'Token'}=${'f'.repeat(32)}`,
  'an AWS access key': `AKIA${'ABCDEFGH23456789'}`,
  'a Slack token': `xoxb-${'1234567890'}-abcdefghij`,
  'a Stripe live key': `sk_live_${'4eC39HqLyjWDarjtT1zdp7dc'}`,
  'a Google API key': `AIza${'SyA-1234567890abcdefghijklmnopqrstu'}`,
  'an Anthropic API key': `sk-ant-${'api03-'}${'x'.repeat(40)}`,
}

describe('findSecrets', () => {
  it('finds each kind of credential and names its line', () => {
    for (let [kind, secret] of Object.entries(examples)) {
      assert.deepEqual(findSecrets(`first line\nconst value = '${secret}'\n`), [{ kind, line: 2 }], kind)
    }
  })

  it('accepts invented fixture data and token placeholders', () => {
    let text = [
      'Customer: Fixture Co., invoice INV-0001, total 200.00',
      '//registry.npmjs.org/:_authToken=${NPM_TOKEN}',
      'GITHUB_TOKEN: ${{ github.token }}',
      'ghp_short',
      'sk-ant-',
    ].join('\n')

    assert.deepEqual(findSecrets(text), [])
  })
})

describe('isSecretFile', () => {
  it('flags environment files, private keys and certificates', () => {
    for (let file of ['.env', 'apps/docs/.env.local', 'id_ed25519', 'certs/site.pem', 'signing.p12']) {
      assert.ok(isSecretFile(file), file)
    }
  })

  it('accepts example environment files and ordinary source', () => {
    for (let file of ['.env.example', 'registry/ui/key.tsx', 'docs/environment.md']) {
      assert.ok(!isSecretFile(file), file)
    }
  })
})

describe('check:secrets', () => {
  function checkSecrets(args: string[]) {
    return spawnSync(process.execPath, ['scripts/check-secrets.ts', ...args], { cwd: root, encoding: 'utf8' })
  }

  it('passes the files git tracks or would add', { timeout: 30_000 }, () => {
    let result = checkSecrets([])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^✓ \d+ repository files hold no credentials$/m)
  })

  it('fails a folder that holds a credential, without printing it', (t) => {
    let directory = mkdtempSync(join(tmpdir(), 'remixcn-secrets-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    mkdirSync(join(directory, 'logs'))
    writeFileSync(join(directory, 'logs/e2e.log'), `ok\nAuthorization: token ${examples['a GitHub token']}\n`)
    writeFileSync(join(directory, 'screenshot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))

    let result = checkSecrets([directory])

    assert.equal(result.status, 1)
    assert.match(result.stderr, /logs\/e2e\.log:2: looks like a GitHub token/)
    assert.doesNotMatch(result.stderr, /screenshot\.png/)
    assert.ok(!result.stderr.includes(examples['a GitHub token']))
  })

  it('reads binary files and logs with NUL bytes too', (t) => {
    let directory = mkdtempSync(join(tmpdir(), 'remixcn-secrets-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    let token = examples['an npm token']
    writeFileSync(join(directory, 'browser.log'), `\0Authorization: ${examples['a GitHub token']}\n`)
    writeFileSync(
      join(directory, 'trace.zip'),
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x00, 0xff, 0x0a]), Buffer.from(token)]),
    )

    let result = checkSecrets([directory])

    assert.equal(result.status, 1)
    assert.match(result.stderr, /browser\.log:1: looks like a GitHub token/)
    assert.match(result.stderr, /trace\.zip:2: looks like an npm token/)
  })
})
