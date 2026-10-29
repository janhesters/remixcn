import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { CliError } from './errors.ts'
import { checkItem, parseAddress, resolveItems } from './resolve.ts'

const registries = {
  '@remixcn': 'https://janhesters.github.io/remixcn/r/{name}.json',
  '@acme': 'https://acme.example/r/{name}.json',
}

function item(name: string, registryDependencies: string[] = [], extra: Record<string, unknown> = {}) {
  return {
    name,
    type: 'registry:lib',
    title: name,
    description: `The ${name} helper.`,
    ...(registryDependencies.length > 0 && { registryDependencies }),
    files: [
      {
        path: `registry/lib/${name}.ts`,
        type: 'registry:lib',
        target: `@lib/${name}.ts`,
        content: `export const ${name} = 1\n`,
      },
    ],
    meta: { remix: '3.0.0' },
    ...extra,
  }
}

/** Serves items by URL from a map, counting the requests. */
function served(items: Record<string, unknown>) {
  let requests: string[] = []
  let fetchJson = async (url: string) => {
    requests.push(url)
    if (!(url in items))
      throw new CliError('REGISTRY', `Nothing at ${url} (404). Check the item name and the registry URL.`)
    return items[url]
  }
  return { fetchJson, requests }
}

const remixcn = (name: string) => `https://janhesters.github.io/remixcn/r/${name}.json`

async function rejection(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof CliError, String(error))
    return error
  }
  throw new Error('expected the promise to reject')
}

function failure(run: () => unknown): CliError {
  try {
    run()
  } catch (error) {
    assert.ok(error instanceof CliError, String(error))
    return error
  }
  throw new Error('expected an error')
}

describe('parseAddress', () => {
  it('reads names, namespaces, URLs and local paths', () => {
    let context = { registries, cwd: '/app' }

    assert.deepEqual(parseAddress('button', context), { kind: 'url', location: remixcn('button') })
    assert.deepEqual(parseAddress('@remixcn/button', context), { kind: 'url', location: remixcn('button') })
    assert.deepEqual(parseAddress('@acme/fancy-button', context), {
      kind: 'url',
      location: 'https://acme.example/r/fancy-button.json',
    })
    assert.deepEqual(parseAddress('https://cdn.example/button.json', context), {
      kind: 'url',
      location: 'https://cdn.example/button.json',
    })
    assert.deepEqual(parseAddress('./items/button.json', context), { kind: 'file', location: '/app/items/button.json' })
    assert.deepEqual(parseAddress('/tmp/button.json', context), { kind: 'file', location: '/tmp/button.json' })
  })

  it('rejects an unknown namespace, a malformed name and an insecure URL', () => {
    let context = { registries, cwd: '/app' }

    let unknown = failure(() => parseAddress('@other/button', context))
    assert.equal(unknown.code, 'REGISTRY')
    assert.match(unknown.message, /Unknown registry @other.*registries in components\.json/)

    assert.equal(failure(() => parseAddress('Button!', context)).code, 'USAGE')
    assert.equal(failure(() => parseAddress('@remixcn/../secrets', context)).code, 'USAGE')
    assert.match(failure(() => parseAddress('http://example.com/button.json', context)).message, /HTTPS/)
  })

  it("keeps a registry item's dependencies to namespaces and URLs", () => {
    let context = { registries, cwd: '/app', dependencyOf: 'card' }

    assert.match(
      failure(() => parseAddress('button', context)).message,
      /card depends on "button".*shadcn\/ui's React component/,
    )
    assert.match(failure(() => parseAddress('./button.json', context)).message, /card depends on a local file/)
  })
})

describe('checkItem', () => {
  it('returns a valid item with its dependencies', () => {
    let checked = checkItem(item('cx', ['@remixcn/licenses']), remixcn('cx'), { remix: '3.0.0' })

    assert.equal(checked.name, 'cx')
    assert.deepEqual(checked.registryDependencies, ['@remixcn/licenses'])
    assert.equal(checked.files[0].content, 'export const cx = 1\n')
  })

  it('rejects malformed payloads, npm dependencies and registry config it would otherwise ignore', () => {
    let malformed = failure(() => checkItem([], 'https://x/r/a.json'))
    assert.equal(malformed.code, 'REGISTRY')
    assert.match(malformed.message, /is not a registry item/)

    let problems = failure(() =>
      checkItem(
        {
          ...item('fancy'),
          type: 'registry:hook',
          dependencies: ['clsx'],
          tailwind: { config: {} },
          cssVars: { light: {} },
          envVars: { TOKEN: '' },
          files: [{ path: 'a.ts', type: 'registry:lib', target: '@lib/a.ts' }],
        },
        'https://x/r/fancy.json',
      ),
    )
    assert.equal(problems.code, 'REGISTRY')
    assert.deepEqual(problems.details, [
      'fancy: type registry:hook is not one remixcn installs (registry:ui, registry:component, registry:lib, registry:style, registry:file)',
      'fancy: needs the npm packages clsx, which remixcn does not install: RemixCN items add no runtime packages',
      'fancy: tailwind is not supported: RemixCN items install plain source files',
      'fancy: cssVars is not supported: RemixCN items install plain source files',
      'fancy: envVars is not supported: RemixCN items install plain source files',
      'fancy: a.ts has no content',
    ])
  })

  it('rejects targets that leave the install directories', () => {
    for (let target of [
      '@lib/../../server.ts',
      '/etc/passwd',
      'app/ui/a.ts',
      '@lib/a/./b.ts',
      '@lib/C:\\a.ts',
      '@lib/%2e%2e/a.ts',
    ]) {
      let error = failure(() =>
        checkItem(
          { ...item('evil'), files: [{ path: 'a.ts', type: 'registry:lib', target, content: '' }] },
          'https://x/r/evil.json',
        ),
      )
      assert.equal(error.code, 'UNSAFE_PATH', target)
      assert.match(error.details[0], /must stay inside @ui\/, @lib\/ or @components\//)
    }
  })

  it('rejects an item written for another Remix major', () => {
    let error = failure(() =>
      checkItem(item('cx', [], { meta: { remix: '4.0.0' } }), remixcn('cx'), { remix: '3.0.0' }),
    )

    assert.equal(error.code, 'REGISTRY')
    assert.match(error.message, /cx is written for remix 4\.0\.0, but the app runs remix 3\.0\.0/)
  })
})

describe('resolveItems', () => {
  it('lists each requested item after everything it depends on, once', async () => {
    let { fetchJson, requests } = served({
      [remixcn('button')]: { ...item('button', ['@remixcn/theme', '@remixcn/cx']), type: 'registry:ui' },
      [remixcn('card')]: item('card', ['@remixcn/cx']),
      [remixcn('cx')]: item('cx', ['@remixcn/licenses']),
      [remixcn('theme')]: item('theme', ['@remixcn/licenses']),
      [remixcn('licenses')]: item('licenses'),
    })

    let { items, requested } = await resolveItems(['button', '@remixcn/card'], { registries, cwd: '/app', fetchJson })

    assert.deepEqual(
      items.map((entry) => entry.name),
      ['licenses', 'cx', 'theme', 'button', 'card'],
    )
    assert.deepEqual([...requested], ['button', 'card'])
    assert.equal(requests.filter((url) => url === remixcn('licenses')).length, 1)
  })

  it('reads a local item and fetches its dependencies from the configured registry', async () => {
    let directory = mkdtempSync(join(tmpdir(), 'remixcn-resolve-'))
    try {
      writeFileSync(join(directory, 'card.json'), JSON.stringify(item('card', ['@acme/cx'])))
      let { fetchJson } = served({ 'https://acme.example/r/cx.json': item('cx') })

      let { items } = await resolveItems(['./card.json'], { registries, cwd: directory, fetchJson })

      assert.deepEqual(
        items.map((entry) => entry.name),
        ['cx', 'card'],
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('stops at a dependency cycle and names it', async () => {
    let { fetchJson } = served({
      [remixcn('a')]: item('a', ['@remixcn/b']),
      [remixcn('b')]: item('b', ['@remixcn/c']),
      [remixcn('c')]: item('c', ['@remixcn/a']),
    })

    let error = await rejection(resolveItems(['a'], { registries, cwd: '/app', fetchJson }))

    assert.equal(error.code, 'REGISTRY')
    assert.match(error.message, /dependency cycle: a → b → c → a/)
  })

  it('refuses two different items with the same name', async () => {
    let { fetchJson } = served({
      [remixcn('cx')]: item('cx'),
      'https://acme.example/r/cx.json': item('cx', [], { description: 'Another cx.' }),
    })

    let error = await rejection(resolveItems(['@remixcn/cx', '@acme/cx'], { registries, cwd: '/app', fetchJson }))

    assert.equal(error.code, 'REGISTRY')
    assert.match(error.message, /Two items are named cx/)
  })
})
