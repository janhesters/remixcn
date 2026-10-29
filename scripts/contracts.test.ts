import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  checkBrowserPackage,
  checkCatalog,
  checkCliImport,
  checkCliPackage,
  checkImport,
  checkPackageMetadata,
  checkRegistryFiles,
  checkSourceHeader,
  checkWorkflow,
  findCssImports,
  findFontFaces,
  findTailwindDirectives,
  parseResolutionTrace,
  seoPhrase,
} from './contracts.ts'
import type { Catalog } from './contracts.ts'

describe('parseResolutionTrace', () => {
  it("reads each file's module imports and type references from TypeScript's trace", () => {
    let trace = [
      "======== Resolving type reference directive 'react', containing file '/app/registry/ui/badge.tsx', root directory '/app/node_modules/@types'. ========",
      "======== Type reference directive 'react' was not resolved. ========",
      "======== Resolving module 'remix/component/jsx-runtime' from '/app/registry/ui/badge.tsx'. ========",
      "Module resolution kind is not specified, using 'NodeNext'.",
      "======== Module name 'remix/component/jsx-runtime' was successfully resolved to '/app/node_modules/remix/dist/component/jsx-runtime.d.ts'. ========",
      "======== Resolving module 'react' from '/app/registry/ui/badge.tsx'. ========",
      "======== Resolving module '#remixcn/lib/cx.ts' from '/app/registry/ui/card.tsx'. ========",
      "======== Resolving module './runtime.ts' from '/app/node_modules/remix/dist/component.d.ts'. ========",
    ].join('\n')

    assert.deepEqual(
      parseResolutionTrace(trace),
      new Map([
        ['/app/registry/ui/badge.tsx', ['react', 'remix/component/jsx-runtime']],
        ['/app/registry/ui/card.tsx', ['#remixcn/lib/cx.ts']],
        ['/app/node_modules/remix/dist/component.d.ts', ['./runtime.ts']],
      ]),
    )
  })
})

describe('findCssImports', () => {
  it('finds quoted and url() @import targets', () => {
    let css = `@import "tailwindcss";\n@import url('./tokens.css') layer(base);\n@import url(./reset.css);`

    assert.deepEqual(findCssImports(css), ['tailwindcss', './tokens.css', './reset.css'])
  })

  it('ignores @import inside comments and strings', () => {
    let css = `/* @import "tailwindcss"; */\n.note::before { content: "@import 'tailwindcss';"; }`

    assert.deepEqual(findCssImports(css), [])
  })
})

describe('findTailwindDirectives', () => {
  it('finds Tailwind at-rules in CSS', () => {
    let css = `@tailwind base;\n.button { @apply px-4; }\n.card { color: gray; }`

    assert.deepEqual(findTailwindDirectives(css), ['@tailwind', '@apply'])
  })

  it('finds nothing in plain CSS, comments or strings', () => {
    let css = `@layer base { :root { --radius: 4px; } }\n/* @apply px-4; */\n.tip::after { content: '@tailwind'; }`

    assert.deepEqual(findTailwindDirectives(css), [])
  })
})

describe('findFontFaces', () => {
  it('counts @font-face rules, which load font files', () => {
    let css = `@font-face { font-family: Inter; src: url('./inter.woff2'); }\n.body { font-family: Inter; }`

    assert.equal(findFontFaces(css), 1)
  })

  it('ignores @font-face inside comments and strings', () => {
    let css = `/* @font-face { } */\n.note::before { content: '@font-face'; }\n:root { --font-sans: system-ui; }`

    assert.equal(findFontFaces(css), 0)
  })
})

describe('checkSourceHeader', () => {
  let license = 'License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md'

  it('accepts the installed-source header in line comments', () => {
    let source = [
      '// RemixCN Button: https://janhesters.github.io/remixcn/',
      '// Copyright (c) 2026 Jan Hesters. MIT License.',
      '// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).',
      `// ${license}`,
      "import { css } from 'remix/component'",
    ].join('\n')

    assert.deepEqual(checkSourceHeader(source, 'Button'), [])
  })

  it('accepts the same header as a CSS block comment', () => {
    let source = [
      '/*',
      ' * RemixCN Theme: https://janhesters.github.io/remixcn/',
      ' * Copyright (c) 2026 Jan Hesters. MIT License.',
      ` * ${license}`,
      ' */',
      '@layer base, rmx, app;',
    ].join('\n')

    assert.deepEqual(checkSourceHeader(source, 'Theme'), [])
  })

  it('reports a missing header and one that names another entry', () => {
    assert.deepEqual(checkSourceHeader("import { css } from 'remix/component'", 'Button'), [
      'must start with the installed-source header from SOURCES.md',
    ])

    let source = [
      '// RemixCN Badge: https://janhesters.github.io/remixcn/',
      '// Copyright (c) 2025 Jan Hesters.',
      '// Adapted from shadcn/ui.',
    ].join('\n')

    assert.deepEqual(checkSourceHeader(source, 'Button'), [
      'header must start with "RemixCN Button: https://janhesters.github.io/remixcn/"',
      'header must carry "Copyright (c) 2026 Jan Hesters. MIT License."',
      `header must end with "${license}"`,
    ])
  })
})

describe('checkImport', () => {
  it('allows remix/component and the #remixcn aliases', () => {
    for (let specifier of [
      'remix/component',
      'remix/component/jsx-runtime',
      '#remixcn/ui/button.tsx',
      '#remixcn/lib/cx.ts',
    ]) {
      assert.equal(checkImport(specifier, { allowRelative: false }), undefined, specifier)
    }
  })

  it('names each forbidden family', () => {
    let cases: Array<[string, RegExp]> = [
      ['react', /React/],
      ['react-dom/client', /React/],
      ['tailwindcss', /Tailwind/],
      ['tailwind-merge', /Tailwind/],
      ['@base-ui/react/dialog', /Base UI/],
      ['@radix-ui/react-dialog', /Radix/],
      ['radix-ui', /Radix/],
      ['@floating-ui/dom', /Floating UI/],
      ['@remix-run/ui/accordion', /@remix-run\/ui/],
    ]

    for (let [specifier, family] of cases) {
      assert.match(checkImport(specifier, { allowRelative: false }) ?? '', family)
    }
  })

  it('rejects Node built-ins, other packages and other remix entry points', () => {
    assert.match(checkImport('node:fs', { allowRelative: false }) ?? '', /Node built-in/)
    assert.match(checkImport('clsx', { allowRelative: false }) ?? '', /only remix\/component/)
    assert.match(checkImport('remix/component/server', { allowRelative: false }) ?? '', /only remix\/component/)
  })

  it('rejects relative imports in registry source but allows them elsewhere', () => {
    assert.match(checkImport('../lib/cx.ts', { allowRelative: false }) ?? '', /#remixcn\/lib\//)
    assert.equal(checkImport('./nav.tsx', { allowRelative: true }), undefined)
  })
})

function validCatalog(): Catalog {
  let pin = '96da9cc7f1aa10580a3741664e2a77c721206c00'
  let blob = `https://github.com/shadcn-ui/ui/blob/${pin}/apps/v4`
  return {
    name: 'RemixCN',
    namespace: '@remixcn',
    homepage: 'https://janhesters.github.io/remixcn/',
    upstream: {
      shadcn: { repository: 'https://github.com/shadcn-ui/ui', commit: pin },
    },
    reconciliation: {
      sourceFiles: 3,
      docsPages: 3,
      docsOnlyRecipes: ['typography'],
      sourceOnly: ['sonner'],
      registryWithoutSource: [],
    },
    batches: [
      { id: 1, title: 'Core primitives', description: 'Static components.' },
      { id: 2, title: 'Feedback', description: 'Toasts.' },
    ],
    outOfScope: [{ name: 'Blocks', reason: 'Not in the first release.' }],
    entries: [
      {
        name: 'button',
        title: 'Button',
        kind: 'component',
        batch: 1,
        source: `${blob}/registry/bases/base/ui/button.tsx`,
        docs: 'https://ui.shadcn.com/docs/components/base/button',
        dependsOn: [],
        upstreamImports: ['@base-ui/react'],
        target: 'registry/ui/button.tsx',
      },
      {
        name: 'sonner',
        title: 'Sonner',
        kind: 'component',
        batch: 2,
        source: `${blob}/registry/bases/base/ui/sonner.tsx`,
        docs: 'https://ui.shadcn.com/docs/components/base/toast',
        compatibleWith: 'toast',
        dependsOn: ['toast'],
        upstreamImports: ['sonner'],
        target: 'registry/ui/sonner.tsx',
      },
      {
        name: 'toast',
        title: 'Toast',
        kind: 'component',
        batch: 2,
        source: `${blob}/registry/bases/base/ui/toast.tsx`,
        docs: 'https://ui.shadcn.com/docs/components/base/toast',
        dependsOn: ['button', 'use-timer'],
        upstreamImports: ['@base-ui/react'],
        target: 'registry/ui/toast.tsx',
      },
      {
        name: 'typography',
        title: 'Typography',
        kind: 'recipe',
        batch: 1,
        source: `${blob}/content/docs/components/base/typography.mdx`,
        docs: 'https://ui.shadcn.com/docs/components/base/typography',
        dependsOn: [],
        upstreamImports: [],
        target: 'registry/examples/typography.tsx',
      },
    ],
    helpers: [
      {
        name: 'use-timer',
        title: 'Timer',
        kind: 'helper',
        batch: 2,
        source: `${blob}/registry/bases/base/hooks/use-timer.ts`,
        dependsOn: [],
        upstreamImports: ['react'],
        target: 'registry/lib/use-timer.ts',
      },
    ],
  }
}

describe('checkCatalog', () => {
  it('accepts a consistent catalog', () => {
    assert.deepEqual(checkCatalog(validCatalog()), [])
  })

  it('requires a source pinned to the upstream commit', () => {
    let catalog = validCatalog()
    catalog.entries[0].source = 'https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/button.tsx'

    assert.deepEqual(checkCatalog(catalog), [
      'button: source must link a file at shadcn commit 96da9cc7f1aa10580a3741664e2a77c721206c00',
    ])
  })

  it('lets a helper, but not a component, link a file at another pinned upstream', () => {
    let catalog = validCatalog()
    catalog.upstream.baseUi = { repository: 'https://github.com/mui/base-ui', commit: 'abc123' }
    let baseUiFile =
      'https://github.com/mui/base-ui/blob/abc123/packages/react/src/utils/popups/interactions/useDismiss.ts'
    catalog.helpers[0].source = baseUiFile
    assert.deepEqual(checkCatalog(catalog), [])

    catalog.helpers[0].source =
      'https://github.com/mui/base-ui/blob/master/packages/react/src/utils/popups/interactions/useDismiss.ts'
    catalog.entries[0].source = baseUiFile
    assert.deepEqual(checkCatalog(catalog), [
      'button: source must link a file at shadcn commit 96da9cc7f1aa10580a3741664e2a77c721206c00',
      'use-timer: source must link a file at a pinned upstream commit',
    ])
  })

  it('requires a Components docs page for components and recipes', () => {
    let catalog = validCatalog()
    delete catalog.entries[3].docs

    assert.deepEqual(checkCatalog(catalog), ['typography: docs must link a page of the Components docs'])
  })

  it('requires an existing batch', () => {
    let catalog = validCatalog()
    catalog.entries[3].batch = 9

    assert.deepEqual(checkCatalog(catalog), ['typography: batch 9 does not exist'])
  })

  it('requires dependencies to exist and land in the same or an earlier batch', () => {
    let catalog = validCatalog()
    catalog.entries[0].dependsOn = ['toast', 'calendar']

    assert.deepEqual(checkCatalog(catalog), [
      'button: depends on toast, which lands in a later batch (2)',
      'button: depends on calendar, which is not in the catalog',
    ])
  })

  it('requires unique names', () => {
    let catalog = validCatalog()
    catalog.entries[3].name = 'button'
    catalog.entries[3].target = 'registry/examples/button.tsx'

    assert.ok(checkCatalog(catalog).includes('button: listed more than once'))
  })

  it('requires the target to match the kind', () => {
    let catalog = validCatalog()
    catalog.entries[3].target = 'registry/ui/typography.tsx'

    assert.deepEqual(checkCatalog(catalog), ['typography: a recipe belongs at registry/examples/typography.tsx'])
  })

  it('lets a helper be a TypeScript, TSX or CSS file in registry/lib', () => {
    for (let target of ['registry/lib/use-timer.ts', 'registry/lib/use-timer.tsx', 'registry/lib/use-timer.css']) {
      let catalog = validCatalog()
      catalog.helpers[0].target = target

      assert.deepEqual(checkCatalog(catalog), [], target)
    }

    let catalog = validCatalog()
    catalog.helpers[0].target = 'registry/lib/use-timer.js'

    assert.deepEqual(checkCatalog(catalog), ['use-timer: a helper belongs at registry/lib/use-timer.ts, .tsx or .css'])
  })

  it('requires a compatible entry to exist and be a dependency', () => {
    let catalog = validCatalog()
    catalog.entries[1].dependsOn = []
    catalog.entries[1].compatibleWith = 'toaster'

    assert.deepEqual(checkCatalog(catalog), [
      'sonner: compatible with toaster, which is not in the catalog',
      'sonner: must depend on toaster, the entry it is compatible with',
    ])
  })

  it('keeps out-of-scope collections out of the entries', () => {
    let catalog = validCatalog()
    catalog.outOfScope.push({ name: 'button', reason: 'Not now.' })

    assert.deepEqual(checkCatalog(catalog), ['button: listed as out of scope and as an entry'])
  })

  it('requires the reconciliation counts to match the entries', () => {
    let catalog = validCatalog()
    catalog.reconciliation.sourceFiles = 64
    catalog.reconciliation.docsOnlyRecipes = ['typography', 'data-table']

    assert.deepEqual(checkCatalog(catalog), [
      'reconciliation: 3 component entries, but sourceFiles says 64',
      'reconciliation: recipes are typography, but docsOnlyRecipes says typography, data-table',
    ])
  })

  it('requires every batch to hold an entry', () => {
    let catalog = validCatalog()
    catalog.batches.push({ id: 3, title: 'Empty', description: 'Nothing.' })

    assert.deepEqual(checkCatalog(catalog), ['batch 3 has no entries'])
  })
})

describe('checkRegistryFiles', () => {
  it('accepts files the catalog lists as targets', () => {
    let files = ['registry/ui/button.tsx', 'registry/lib/use-timer.ts', 'registry/ui/button.test.browser.tsx']

    assert.deepEqual(checkRegistryFiles(validCatalog(), files), [])
  })

  it('reports registry files without a catalog entry', () => {
    let files = ['registry/ui/button.tsx', 'registry/ui/banner.tsx']

    assert.deepEqual(checkRegistryFiles(validCatalog(), files), [
      'registry/ui/banner.tsx: not a target in registry/catalog.json',
    ])
  })
})

const keywords = [
  seoPhrase,
  'shadcn',
  'shadcn-ui',
  'remix',
  'remix-v3',
  'registry',
  'ui-components',
  'accessibility',
  'design-system',
]

function validPackage() {
  return {
    name: 'remixcn',
    description: `${seoPhrase}: accessible, dependency-free UI components`,
    keywords,
    homepage: 'https://janhesters.github.io/remixcn/',
    repository: { type: 'git', url: 'git+https://github.com/janhesters/remixcn.git' },
    license: 'MIT',
    engines: { node: '>=24.3.0' },
    bin: { remixcn: './dist/bin.js' },
    files: ['dist'],
    dependencies: {},
  }
}

describe('checkPackageMetadata', () => {
  it('accepts the approved names, phrase, homepage and keywords', () => {
    assert.deepEqual(checkPackageMetadata(validPackage()), [])
  })

  it('reports each missing piece', () => {
    let pkg = {
      ...validPackage(),
      description: 'shadcn for Remix',
      keywords: ['remix'],
      homepage: 'https://remixcn.dev',
      license: 'ISC',
    }

    assert.deepEqual(checkPackageMetadata(pkg), [
      'remixcn: description must contain "shadcn components for Remix V3"',
      'remixcn: keywords miss "shadcn components for Remix V3", shadcn, shadcn-ui, remix-v3, registry, ui-components, accessibility, design-system',
      'remixcn: homepage must be https://janhesters.github.io/remixcn/',
      'remixcn: license must be MIT',
    ])
  })
})

describe('checkCliPackage', () => {
  it('accepts the remixcn executable contract', () => {
    assert.deepEqual(checkCliPackage(validPackage(), { engines: { node: '>=24.3.0' } }), [])
  })

  it('reports runtime dependencies, a missing bin and a different Node range', () => {
    let pkg = {
      ...validPackage(),
      bin: { cn: './dist/bin.js' },
      files: ['src'],
      engines: { node: '>=22' },
      dependencies: { kleur: '4.1.5' },
      peerDependencies: { remix: '3.0.0' },
    }

    assert.deepEqual(checkCliPackage(pkg, { engines: { node: '>=24.3.0' } }), [
      'remixcn: bin must map remixcn to ./dist/bin.js',
      'remixcn: files must include dist',
      'remixcn: engines.node must match the workspace (>=24.3.0)',
      'remixcn: dependencies must be empty (kleur)',
      'remixcn: peerDependencies must be empty (remix)',
    ])
  })
})

describe('checkCliImport', () => {
  it('lets the executable import Node built-ins and its own files', () => {
    for (let specifier of ['node:fs', 'node:util', './cli.ts', './mcp/server.ts']) {
      assert.equal(checkCliImport('packages/cli/src/bin.ts', specifier), undefined, specifier)
    }
    assert.equal(checkCliImport('packages/cli/src/mcp/server.ts', '../cli.ts'), undefined)
  })

  it('reports packages, registry aliases and files outside its source', () => {
    assert.deepEqual(
      ['kleur', 'remix/component', '#remixcn/ui/button.tsx', '../../../registry/catalog.json'].map((specifier) =>
        checkCliImport('packages/cli/src/cli.ts', specifier),
      ),
      [
        '"kleur": the remixcn executable runs on Node and Web built-ins only, so it imports no package',
        '"remix/component": the remixcn executable runs on Node and Web built-ins only, so it imports no package',
        '"#remixcn/ui/button.tsx": the remixcn executable runs on Node and Web built-ins only, so it imports no package',
        '"../../../registry/catalog.json": the published package holds only packages/cli/src, so import nothing outside it',
      ],
    )
  })
})

describe('checkBrowserPackage', () => {
  it('lets a browser package depend on remix only', () => {
    assert.deepEqual(checkBrowserPackage({ name: '@remixcn/docs', dependencies: { remix: '3.0.0' } }), [])
  })

  it('reports any other runtime dependency', () => {
    let pkg = { name: '@remixcn/docs', dependencies: { remix: '3.0.0', react: '19.2.0', tailwindcss: '4.1.0' } }

    assert.deepEqual(checkBrowserPackage(pkg), ['@remixcn/docs: dependencies may only list remix (react, tailwindcss)'])
  })
})

describe('checkWorkflow', () => {
  let sha = 'a'.repeat(40)
  let workflow = `name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${sha} # v7.0.1
      - uses: actions/cache@${sha} # v6.1.0
        with:
          key: bun-\${{ hashFiles('bun.lock') }}
      - run: bun run check test
      - if: failure()
        uses: actions/upload-artifact@${sha} # v7.0.2
        with:
          path: .diagnostics
          retention-days: 7
`

  it('accepts a read-only workflow for pull requests and main with pinned actions', () => {
    assert.deepEqual(checkWorkflow(workflow), [])
  })

  it('reports production triggers, write access, secrets, publishing, paid runners and unpinned actions', () => {
    let risky = workflow
      .replace('  push:\n    branches: [main]\n', '  push:\n  release:\n    types: [published]\n')
      .replace('  contents: read\n', '  contents: write\n  id-token: write\n')
      .replace('runs-on: ubuntu-24.04', 'runs-on: ubuntu-latest-16-cores')
      .replace(`actions/checkout@${sha}`, 'actions/checkout@v7')
      .replace(
        "key: bun-${{ hashFiles('bun.lock') }}",
        "key: bun-${{ hashFiles('bun.lock') }}\n          restore-keys: bun-",
      )
      .replace(
        'run: bun run check test',
        'run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n        environment: production',
      )
      .replace('retention-days: 7', 'retention-days: 90')

    assert.deepEqual(checkWorkflow(risky), [
      'trigger "release": CI runs only for pull requests and pushes',
      'push must run for main only, as "branches: [main]"',
      'permissions must be "contents: read" only, and no job asks for write access ("contents: write", "id-token: write")',
      'runs-on "ubuntu-latest-16-cores": use ubuntu-24.04, a standard hosted runner that is free for public repositories',
      '"actions/checkout@v7": pin each action to a full commit SHA',
      'restore-keys: caches restore their exact key only, so a cache from another lockfile never stands in',
      'workflows read no secrets ("secrets.NPM_TOKEN")',
      'workflows publish and deploy nothing ("npm publish", "environment:")',
      'retention-days 90: keep diagnostics for 14 days at most',
    ])
  })

  it('reports an artifact upload without a retention limit', () => {
    assert.deepEqual(checkWorkflow(workflow.replace('          retention-days: 7\n', '')), [
      'each upload-artifact step sets retention-days (1 upload, 0 limits)',
    ])
  })
})
