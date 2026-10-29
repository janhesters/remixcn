# RemixCN contributor guide

RemixCN ports the shadcn/ui component catalog to Remix 3. Users copy each component's source into their app and own it. The components need only `remix`, which the app already has. This guide holds the contracts every change keeps. Read it before you change the workspace.

## Commands

```sh
bun install --frozen-lockfile
bun run typecheck          # tsc --noEmit over the whole workspace
bun run test               # server tests: remix test --type server
bun run check:components   # catalog and browser-reachable source contracts
bun run check:build        # builds packages/cli, checks and runs the remixcn executable
bun run build              # builds packages/cli/dist only
```

Use Node 24.3.0 or later (`engines` in every `package.json`). `remix` stays pinned to `3.0.0`, and `bun.lock` stays committed. Development tools are pinned to exact versions in the root `devDependencies`.

## Read the installed docs

Read `.agents/skills/remix/SKILL.md` for the Remix mental model. It comes unchanged from the `remix new` template that remix 3.0.0 installs (`SOURCES.md` credits it). For exact APIs, the installed package is canonical. Prefer it over memory, online docs, and newer Remix versions:

- `node_modules/remix/INDEX.md` maps tasks and exports to guides and READMEs. Search it first, for example `grep -i 'clientEntry' node_modules/remix/INDEX.md`.
- `node_modules/remix/guides/` holds the workflow guides, such as `04-rendering-ui.md`, `05-interactivity.md`, and `13-testing.md`.
- `node_modules/remix/src/<package>/README.md` documents each export, for example `src/component/README.md`.
- `node_modules/remix/package.json` lists every export. Each `remix/<name>` re-exports a `@remix-run/<name>` package. Bun keeps those under `node_modules/.bun/`, so find a type with `grep -rn 'clientEntry' node_modules/.bun/@remix-run+component@*/node_modules/@remix-run/component/dist/*.d.ts`.

## Layout

| Path | Holds |
| --- | --- |
| `registry/catalog.json` | The component inventory and source map: every entry, its upstream links, its batch, and its target file |
| `registry/ui/<name>.tsx` | One component per file, the source users copy |
| `registry/lib/<name>.ts` | Helpers several components share |
| `registry/examples/<name>.tsx` | Copyable examples and the recipes: Data Table, Date Picker, and Typography |
| `packages/cli/` | The `remixcn` npm package and executable. `src/bin.ts` is the entry. The build emits `dist/bin.js`, which `bin` points to. The local MCP server will start from the same executable |
| `apps/docs/` | The site (C-979, C-981) |
| `test/fixtures/` | Synthetic projects for tool tests: `consumer-app/` is a Remix 3.0.0 app to install into, `registries/` hold small registries that keep or break the contracts, and `imports/` holds the import forms the checks must read |
| `scripts/` | The contract checks behind `check:components` and `check:build`. `contracts.ts` holds their rules, `typescript.ts` reads imports through `tsc`, and `workspace.ts` lists the workspace packages |
| `test/` | Workspace-wide contract tests |

Tests sit beside the code they test as `*.test.ts`. Browser tests will use `*.test.browser.tsx` and end-to-end tests `*.test.e2e.ts`, as `remix test` expects.

## Source-copy model

- A component is source in `registry/`, not a runtime package. The installer copies it into the user's app, and the user owns and edits it from then on.
- `remix` comes from the user's app. Registry source never adds a dependency of its own.
- Don't create a component runtime package or publish components to npm.
- Every component, recipe, and helper has an entry in `registry/catalog.json` whose `target` names its file. `check:components` fails on a registry file without one.

## Aliases

Registry files reach each other only through two import aliases. The root `package.json` `imports` field maps them, so TypeScript, Node, and Remix's asset server resolve them:

- `#remixcn/ui/<name>.tsx` resolves to `registry/ui/<name>.tsx`.
- `#remixcn/lib/<name>.ts` resolves to `registry/lib/<name>.ts`.

Write the extension, as `NodeNext` requires. Don't use relative imports inside `registry/`. The installer rewrites each alias to a relative path from the installed file to the user's component or helper directory. Both directories must be browser-reachable. In a `remix new` app, that means under `app/**/public/`. Only `apps/docs/` uses relative imports between its own files.

The registry namespace is `@remixcn`, so users address an item as `@remixcn/<name>`.

## Browser-reachable source

Everything in `registry/ui`, `registry/lib`, and `registry/examples` runs in the user's browser once installed. So does every file under a `public/` directory in `apps/docs`. That source:

- imports only `remix/component` (and its JSX runtime) and the `#remixcn/` aliases;
- never imports React, Tailwind, Base UI, Radix, Floating UI, or `@remix-run/ui`, and never uses Tailwind directives in CSS;
- never uses Node built-ins or globals, and holds no secrets;
- exports each part by name and wraps only the parts that handle browser events in `clientEntry(...)`, with serializable props.

`check:components` enforces the import rules. It reads imports with the pinned TypeScript compiler, so import text in strings, comments, and JSX doesn't count. `apps/docs/package.json` may list `remix` and nothing else under `dependencies`.

## Dependencies

- Components: none. `remix` comes from the user's app.
- CLI and MCP server: Node and Web built-ins only. `packages/cli/package.json` keeps `dependencies` empty and lists no peer or optional dependencies. `check:build` enforces it.
- Development only, pinned exactly in the root `devDependencies`: TypeScript, `@types/node`, and `remix` for typechecks and tests. Formatting, Playwright, and accessibility test tools may join them when a ticket needs them.

## Names and metadata (C-976)

- Project: RemixCN. Repository: `janhesters/remixcn`. npm package and executable: `remixcn`. Registry namespace: `@remixcn`. Private workspace packages use `@remixcn/<name>`.
- Keep the exact phrase "shadcn components for Remix V3" in `README.md`, in each package description, and as a package keyword.
- Other keywords include `shadcn`, `shadcn-ui`, `remix`, `remix-v3`, `registry`, `ui-components`, `accessibility`, and `design-system`.
- Homepage: https://janhesters.github.io/remixcn/.

`check:build` checks the metadata of the root package and every workspace package.

## The catalog

`registry/catalog.json` reconciles the 64 files in shadcn/ui's `apps/v4/registry/bases/base/ui` at the pinned commit with the 66 Base pages of the Components docs. It adds the Data Table, Date Picker, and Typography recipes. Sonner is a dependency-free entry compatible with Toast: it keeps Sonner's `Toaster` and `toast()` names on top of RemixCN's Toast.

Each entry has a `source` link at the pinned commit, a `docs` link, its `batch`, what it `dependsOn`, the `upstreamImports` the port replaces, and its `target`. A dependency lands in the same batch or an earlier one. Batches 1 to 8 order the follow-up work. Separate AI Elements patterns and the Blocks collection are listed under `outOfScope`, not as entries.

Change the catalog when a ticket changes an entry. `checkCatalog` in `scripts/contracts.ts` keeps it consistent.

## Accepted decisions

Jan decided these on his cards. Follow them, and ask the PM before changing one.

- C-976: the names, phrase, keywords, and homepage above.
- C-977: a neutral component showcase with system fonts, gray surfaces, clear focus, small radii, and light and dark themes.
- C-978: the first release ports the component catalog. The separate AI Elements patterns and the Blocks collection stay out.
- C-979: the docs are component-reference-first.
- C-980: RemixCN is MIT licensed.
- C-981: the site is static, on GitHub Pages under `/remixcn/`.

Every later UI PR, such as a component, the gallery, or the site, still needs screenshots and Jan's interface review.

## Credits and licenses

- `LICENSE` is Jan's MIT license. Never change it.
- `THIRD_PARTY_NOTICES.md` holds the full MIT texts of shadcn/ui, Base UI, and Remix. Add a source's license there before copying its code.
- `SOURCES.md` lists each adapted file, its upstream files and versions, and what changed. It also holds the credit text for the site and the header for installed source. Update it in the PR that adapts a file.

## Boundaries

- Take no production action without Jan's approval. Don't publish a package, deploy or turn on the site, change repository or GitHub Pages settings, or start a paid service. `packages/cli` stays `"private": true` until Jan releases it.
- This repository is public. Keep private app code, data, secrets, and screenshots of private apps out of it. Fixtures and examples use invented data.

## Builds

`packages/cli/dist/` is the only build output, and git ignores it. `check:build` rebuilds it.
