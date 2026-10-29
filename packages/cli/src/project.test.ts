import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { CliError } from './errors.ts'
import {
  checkComponentsConfig,
  checkRemixProject,
  parseJsonc,
  readComponentsConfig,
  readProject,
  registriesOf,
  resolveAlias,
  resolveDirectories,
} from './project.ts'

let scratch: string[] = []

afterEach(() => {
  for (let directory of scratch) rmSync(directory, { recursive: true, force: true })
  scratch = []
})

const tsconfig = {
  compilerOptions: { strict: true, jsx: 'react-jsx', jsxImportSource: 'remix/component', module: 'NodeNext' },
}

/** Writes a synthetic app: each key is a path, each value its JSON or text. */
function app(files: Record<string, unknown>) {
  let root = mkdtempSync(join(tmpdir(), 'remixcn-project-'))
  scratch.push(root)
  for (let [path, value] of Object.entries({ 'tsconfig.json': tsconfig, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  }
  return root
}

function remixApp(extra: Record<string, unknown> = {}) {
  return app({ 'package.json': { name: 'shop', type: 'module', dependencies: { remix: '3.0.0' } }, ...extra })
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

describe('parseJsonc', () => {
  it('reads tsconfig-style JSON with comments and trailing commas, keeping strings intact', () => {
    let text = '{\n  // a comment\n  "paths": { "~/*": ["./app/*"], }, /* block */ "url": "https://x//y",\n}'

    assert.deepEqual(parseJsonc(text, 'tsconfig.json'), { paths: { '~/*': ['./app/*'] }, url: 'https://x//y' })
  })
})

describe('checkRemixProject', () => {
  it('accepts a Remix 3 app with Remix JSX', () => {
    checkRemixProject(readProject(remixApp()))
  })

  it('prefers the installed remix version over the declared range', () => {
    let root = remixApp({
      'package.json': { name: 'shop', dependencies: { remix: 'latest' } },
      'node_modules/remix/package.json': { name: 'remix', version: '3.0.0' },
    })

    checkRemixProject(readProject(root))
  })

  it('rejects a folder without package.json, an app without remix, and another Remix major', () => {
    let empty = app({})
    assert.match(failure(() => readProject(empty)).message, /No package\.json/)

    let react = app({ 'package.json': { name: 'web', dependencies: { react: '19.0.0' } } })
    let noRemix = failure(() => checkRemixProject(readProject(react)))
    assert.equal(noRemix.code, 'PROJECT')
    assert.match(noRemix.message, /lists no remix dependency/)

    let old = app({ 'package.json': { name: 'web', dependencies: { remix: '^2.15.0' } } })
    assert.match(failure(() => checkRemixProject(readProject(old))).message, /Remix 3 apps.*\^2\.15\.0/)
  })

  it('names the JSX settings a Remix app needs', () => {
    let root = remixApp({ 'tsconfig.json': { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' } } })

    let error = failure(() => checkRemixProject(readProject(root)))

    assert.equal(error.code, 'PROJECT')
    assert.deepEqual(error.details, ['set "jsxImportSource": "remix/component" in tsconfig.json compilerOptions'])
  })

  it('reads JSX settings through a relative extends', () => {
    let root = remixApp({
      'tsconfig.base.json': tsconfig,
      'tsconfig.json': '{ "extends": "./tsconfig.base", /* app */ "compilerOptions": { "noEmit": true } }',
    })

    checkRemixProject(readProject(root))
  })
})

describe('resolveAlias', () => {
  it('resolves package imports and tsconfig paths to directories in the app', () => {
    let root = remixApp({
      'package.json': {
        name: 'shop',
        dependencies: { remix: '3.0.0' },
        imports: { '#remixcn/ui/*': './app/ui/public/components/ui/*', '#app/*': { default: './app/*' } },
      },
      'tsconfig.json': { compilerOptions: { ...tsconfig.compilerOptions, paths: { '~/*': ['./app/*'] } } },
    })
    let project = readProject(root)

    assert.equal(resolveAlias(project, '#remixcn/ui'), join(root, 'app/ui/public/components/ui'))
    assert.equal(resolveAlias(project, '#app/ui/public/lib'), join(root, 'app/ui/public/lib'))
    assert.equal(resolveAlias(project, '~/ui/public/components'), join(root, 'app/ui/public/components'))
    assert.equal(resolveAlias(project, '@/components'), undefined)
  })

  it('resolves tsconfig paths from baseUrl in an extended config', () => {
    let root = remixApp({
      'config/tsconfig.base.json': {
        compilerOptions: { ...tsconfig.compilerOptions, baseUrl: '..', paths: { '@/*': ['src/*'] } },
      },
      'tsconfig.json': { extends: './config/tsconfig.base.json' },
    })

    assert.equal(resolveAlias(readProject(root), '@/components/ui'), join(root, 'src/components/ui'))
  })

  it('picks the longest matching key, as Node and TypeScript do', () => {
    let root = remixApp({
      'package.json': {
        name: 'shop',
        dependencies: { remix: '3.0.0' },
        imports: { '#remixcn/*': './app/remixcn/*', '#remixcn/ui/*': './app/ui/public/ui/*' },
      },
    })

    assert.equal(resolveAlias(readProject(root), '#remixcn/ui'), join(root, 'app/ui/public/ui'))
    assert.equal(resolveAlias(readProject(root), '#remixcn/lib'), join(root, 'app/remixcn/lib'))
  })
})

describe('components.json', () => {
  const config = {
    $schema: 'https://janhesters.github.io/remixcn/schema/components.json',
    version: 1,
    rsc: false,
    tsx: true,
    aliases: { ui: '#remixcn/ui', lib: '#remixcn/lib', components: '#remixcn/components' },
    registries: { '@acme': 'https://acme.example/r/{name}.json' },
  }

  it('reads a RemixCN config and adds the @remixcn registry to the configured ones', () => {
    let root = remixApp({ 'components.json': config })

    let read = readComponentsConfig(root)

    assert.deepEqual(read?.value, config)
    assert.deepEqual(checkComponentsConfig(config), [])
    assert.deepEqual(registriesOf(config), {
      '@remixcn': 'https://janhesters.github.io/remixcn/r/{name}.json',
      '@acme': 'https://acme.example/r/{name}.json',
    })
    assert.equal(readComponentsConfig(remixApp()), undefined)
  })

  it('rejects invalid JSON instead of treating the file as missing', () => {
    let root = remixApp({ 'components.json': '{ "aliases": ' })

    let error = failure(() => readComponentsConfig(root))

    assert.equal(error.code, 'PROJECT')
    assert.match(error.message, /components\.json is not valid JSON/)
  })

  it('names what a config needs for remixcn add', () => {
    assert.deepEqual(checkComponentsConfig({ aliases: {} }), [
      'components.json is not set up for RemixCN: it needs "version": 1. Run remixcn init.',
      'components.json needs aliases.ui, aliases.lib and aliases.components. Run remixcn init.',
    ])
    assert.deepEqual(checkComponentsConfig({ ...config, version: 2 }), [
      'components.json has version 2, which this remixcn does not know. Update remixcn.',
    ])
    assert.deepEqual(checkComponentsConfig({ ...config, rsc: true, tsx: false }), [
      'RemixCN components are not React Server Components: set "rsc": false',
      'RemixCN ships TypeScript source: set "tsx": true',
    ])
  })

  it('rejects registry settings remixcn would otherwise ignore', () => {
    let problems = checkComponentsConfig({
      ...config,
      registries: {
        acme: 'https://acme.example/r/{name}.json',
        '@styled': 'https://acme.example/r/{style}/{name}.json',
        '@auth': { url: 'https://acme.example/r/{name}.json', headers: { authorization: 'Bearer ${TOKEN}' } },
        '@plain': 'http://acme.example/r/{name}.json',
        '@flat': 'https://acme.example/r/button.json',
      },
    })

    assert.deepEqual(problems, [
      'registries: "acme" must start with @, such as @acme',
      'registries.@styled: {style} is not supported; RemixCN registries have one style',
      'registries.@auth: remixcn supports a URL template only, without headers, params or environment variables',
      'registries.@plain: http://acme.example/r/{name}.json: registries load over HTTPS. Plain HTTP works only for localhost, 127.0.0.1 and [::1]',
      'registries.@flat: the URL needs a {name} placeholder',
    ])
  })

  it('resolves the install directories and refuses one outside the app', () => {
    let root = remixApp({
      'package.json': {
        name: 'shop',
        dependencies: { remix: '3.0.0' },
        imports: {
          '#remixcn/ui/*': './app/ui/public/components/ui/*',
          '#remixcn/lib/*': './app/ui/public/lib/*',
          '#out/*': '../elsewhere/*',
        },
      },
      'tsconfig.json': { compilerOptions: { ...tsconfig.compilerOptions, paths: { '~/*': ['./app/*'] } } },
    })
    let project = readProject(root)

    assert.deepEqual(
      resolveDirectories(project, { ...config, aliases: { ...config.aliases, components: '~/ui/public/components' } }),
      {
        ui: join(root, 'app/ui/public/components/ui'),
        lib: join(root, 'app/ui/public/lib'),
        components: join(root, 'app/ui/public/components'),
      },
    )

    let unresolved = failure(() => resolveDirectories(project, config))
    assert.equal(unresolved.code, 'PROJECT')
    assert.deepEqual(unresolved.details, [
      'aliases.components "#remixcn/components" matches no package.json imports or tsconfig.json paths entry',
    ])

    let outside = failure(() =>
      resolveDirectories(project, { ...config, aliases: { ...config.aliases, components: '#out/components' } }),
    )
    assert.equal(outside.code, 'UNSAFE_PATH')
    assert.match(outside.details[0], /outside the project/)
  })
})
