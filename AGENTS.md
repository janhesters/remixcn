# RemixCN contributor guide

RemixCN ports the shadcn/ui component catalog to Remix 3. Users copy each component's source into their app and own it. The components need only `remix`, which the app already has. This guide holds the contracts every change keeps. Read it before you change the workspace.

## Commands

```sh
bun install --frozen-lockfile
bun run check              # every built lane, in order, then a summary of passed, failed and not built yet
bun run check test e2e     # only the named lanes; add --project chromium to pick one browser
bun run format             # rewrites code with Prettier
bun run check:format       # Prettier check only, the format lane
bun run lint               # oxlint correctness rules
bun run typecheck          # tsc --noEmit over the workspace and test/fixtures/consumer-app
bun run test               # server tests: remix test --type server
bun run test:browser       # component and helper tests in Chromium, Firefox and WebKit
bun run test:e2e           # end-to-end tests against local servers, in the same browsers
bun run check:components   # catalog and browser-reachable source contracts
bun run check:secrets      # no credentials in the files git tracks or would add
bun run check:build        # builds packages/cli, checks and runs the remixcn executable
bun run build              # builds packages/cli/dist only
bun run build:registry     # checks registry.json, then writes dist/r/registry.json and dist/r/<name>.json
node packages/cli/src/bin.ts --help  # runs the remixcn executable from source
bun run style-reference    # serves the style reference at http://localhost:4400/ (PORT changes it)
bun run capture:style-reference  # rewrites the screenshots in docs/images/style-reference/
bun run button-examples    # serves the Button and Button Group examples at http://localhost:4401/ (PORT changes it)
bun run capture:button-examples  # rewrites the screenshots in docs/images/button/
bun run layout             # serves the Resizable and Scroll Area examples at http://localhost:4402/ (PORT changes it)
bun run capture:layout     # rewrites the screenshots in docs/images/layout/
bun run code-block-examples  # serves the Code Block examples at http://localhost:4428/ (PORT changes it)
bun run capture:code-block-examples  # rewrites the screenshots in docs/images/code-block/
bun run slider-examples    # serves the Slider examples at http://localhost:4410/ (PORT changes it)
bun run capture:slider-examples  # rewrites the screenshots in docs/images/slider/
bun run display-examples   # serves the display and feedback examples at http://localhost:4407/ (PORT changes it)
bun run capture:display-examples  # rewrites the screenshots in docs/images/display/
bun run dialog-examples    # serves the Dialog, Alert Dialog and Sheet examples at http://localhost:4413/ (PORT changes it)
bun run capture:dialog-examples  # rewrites the screenshots in docs/images/dialog/
```

The browser lanes need Playwright's browsers: `bunx playwright install chromium firefox webkit`. On Ubuntu and Debian, add `--with-deps` for their system libraries. WebKit needs Ubuntu's libraries, so elsewhere run `--project chromium` or `--project firefox`, and CI runs WebKit. `capture:style-reference` takes its screenshots in Chromium only.

Use Node 24.3.0 or later (`engines` in every `package.json`). CI runs the oldest supported version, 24.3.0, and the newest LTS release, both pinned in `supportedNode` in `scripts/lanes.ts`. Bun is pinned in the root `packageManager` field. `remix` stays pinned to `3.0.0`, and `bun.lock` stays committed. Development tools are pinned to exact versions in the root `devDependencies`.

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
| `registry.json` | The items that ship, in shadcn's registry format: each item's type, files, install targets and `@remixcn` dependencies |
| `registry/ui/<name>.tsx` | One component per file, the source users copy |
| `registry/lib/<name>.ts` | Helpers several components share. A helper may also be `.tsx`, such as `icons.tsx`, or `.css`, such as `theme.css` |
| `registry/examples/<name>.tsx` | The recipes: Data Table, Date Picker, and Typography |
| `registry/examples/<name>-example.tsx` | A component's copyable examples, named by its entry's `exampleTarget` |
| `packages/cli/` | The `remixcn` npm package and executable. `src/bin.ts` is the entry and `src/cli.ts` parses the commands. The build emits `dist/bin.js`, which `bin` points to. `README.md` documents the commands and exit codes, `components.schema.json` is the `components.json` schema, and `LICENSE` is a copy of the root one. `remixcn mcp` serves the MCP protocol from `src/mcp.ts` and its tools from `src/mcp-tools.ts`. See [The installer](#the-installer) and [The MCP server](#the-mcp-server) |
| `apps/docs/` | The site (C-979, C-981) |
| `test/fixtures/` | Synthetic projects for tool tests: `consumer-app/` is a Remix 3.0.0 app to install into, which the end-to-end tests serve, `registries/` hold small registries that keep or break the contracts (`installable/` is a component with a helper, tokens and license texts), `imports/` holds the import forms the checks must read, `lanes/` hold workspaces whose lanes must fail, `style-reference/` is the style reference page, `button/` serves the Button and Button Group examples with hydration and an `/echo` route that shows what a form sent, `layout/` serves the Resizable and Scroll Area examples with their client entries hydrated, `code-block/` serves the Code Block examples with hydration and an `/echo` route, `slider/` serves the Slider examples with hydration and an `/echo` route that shows what a form sent, `display/` serves the examples of the 15 display and feedback families, from Alert to Typography, the same way, and `dialog/` serves the Dialog, Alert Dialog and Sheet examples with an `/echo` route and a `/starts-open` page |
| `docs/components/` | Each component family's API, composition notes, source and behavior map, and accessibility checks |
| `docs/images/` | Screenshots of synthetic pages for UI reviews, such as `style-reference/`, `button/`, `layout/`, `code-block/`, `slider/`, `display/` and `dialog/` |
| `scripts/` | The checks and the registry build. `lanes.ts` lists the check lanes and `check.ts` runs them. `contracts.ts` holds the rules of `check:components`, `check:build` and the CI workflow, `secrets.ts` those of `check:secrets`, `build-registry.ts` runs the registry build, `typescript.ts` reads imports through `tsc`, and `workspace.ts` lists the workspace packages and files. The registry's rules live in `packages/cli/src/registry.ts`, and the import and CSS rules in `packages/cli/src/source.ts`, because the executable applies them too |
| `test/` | Workspace-wide contract tests, the registry tests that serve a build with `static-server.ts`, shared test helpers, such as `accessibility.ts` for axe-core, `html.ts` for reading server HTML in server tests, and `mcp-client.ts` for shadcn's MCP server, and `cli.test.ts`, which packs `packages/cli` and runs the packed executable |
| `.github/workflows/ci.yml` | CI for pull requests and main |

Tests sit beside the code they test as `*.test.ts`. Browser tests use `*.test.browser.tsx` and end-to-end tests `*.test.e2e.ts`, as `remix test` expects; both run in Chromium, Firefox and WebKit. Browser component tests run without `theme.css`, so they set the tokens they measure on their container. `test/style-reference.test.e2e.ts` drives the style reference, `test/button.test.e2e.ts` the Button examples, `test/layout.test.e2e.ts` the Resizable and Scroll Area examples, with and without JavaScript, `test/code-block.test.e2e.ts` the Code Block examples, `test/slider.test.e2e.ts` the Slider examples, `test/display.test.e2e.ts` the display and feedback examples, and `test/dialog.test.e2e.ts` the Dialog, Alert Dialog and Sheet examples. The installer doesn't copy test files.

## Source-copy model

- A component is source in `registry/`, not a runtime package. The installer copies it into the user's app, and the user owns and edits it from then on.
- `remix` comes from the user's app. Registry source never adds a dependency of its own.
- Don't create a component runtime package or publish components to npm.
- Every component, recipe, and helper has an entry in `registry/catalog.json` whose `target` names its file. A component's examples are its entry's `exampleTarget`. `check:components` fails on a registry file without one.
- Once it ships, it also has an item in `registry.json`. See [The registry build](#the-registry-build).

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
- exports each part by name and wraps only the parts that handle browser events in `clientEntry(...)`, with serializable props. A part that takes your mixins, such as Button, can't be an entry, since Remix serializes an entry's props to JSON. Neither can a part with live children, such as a panel group or a scroll area, since the server renders an entry's component children to static HTML. Such a part runs in the browser inside your client entry, and its server HTML must be safe without it.

`check:components` enforces the import rules. It reads imports with the pinned TypeScript compiler, so import text in strings, comments, and JSX doesn't count. `apps/docs/package.json` may list `remix` and nothing else under `dependencies`.

## Styling

Components style themselves with Remix's `css()` and read the theme's tokens. Three helpers in batch 1 hold the shared parts:

- `registry/lib/theme.css` is the one global stylesheet. It declares the cascade layer order, the tokens, and a small reset. The app links it first in `<head>`, before any other stylesheet. Every component lists `theme` in `dependsOn`.
- `registry/lib/styles.ts` holds style objects for `css()`: `focusRing()`, `invalidState`, `disabledState`, `visuallyHidden`, `transition()`, and `mirrorInRtl`, plus `mergeStyles()` to combine them.
- `registry/lib/icons.tsx` holds the `Icon` wrapper and the icons RemixCN draws itself.

### Layers and overrides

`theme.css` starts with `@layer base, rmx, app;`. Remix puts every `css()` rule in the `rmx` layer and adds its style tags at the end of `<head>`. From the weakest to the strongest:

1. `base`: the tokens and the reset in `theme.css`.
2. `rmx`: every `css()` rule, the component's own and a `css()` the caller passes with `mix`.
3. `app`: the app's own rules in `@layer app`. They beat every component, whatever their specificity.
4. Unlayered CSS beats all layers. Keep app CSS in `app` so this stays a choice.

Inside `rmx`, Remix gives every `css()` rule its own layer, `rmx.<class>`, ordered by where the rule first renders. Specificity counts only inside one rule, and the order of a `mix` array doesn't count. So:

- Compose a component's base styles and states into one `css()` call with `mergeStyles()`. Then `&[aria-invalid="true"]` beats the base border as usual.
- A caller's `css()` wins when it first renders after the component's own rule, as a style object made for that call site does. For a reliable override, the app writes a rule in `@layer app`, or sets a token.
- Don't style a child from a parent selector, such as `'& [data-slot=title]'` in the card's rule: the child's own rule may come later and win. Let the child's own `css()` react instead, to a data attribute on an ancestor (`':where([data-size="sm"]) &'`) or to a custom property the parent sets.

The style reference's Overrides section shows each case, and its browser test checks them.

### Tokens

- Colors keep shadcn's names in kebab case, such as `--background`, `--primary-foreground`, `--chart-1`, and `--sidebar-ring`. Each value is `light-dark(light, dark)`, so the system preference picks it, and `data-theme="light"` or `data-theme="dark"` on any element overrides it for everything inside. An app changes a color with the same form, for example `--primary: light-dark(oklch(…), oklch(…))`.
- Components read tokens and never set them, so a token set on an ancestor reaches every component inside.
- Type, space, radius, and shadow tokens follow Tailwind's theme names, so shadcn's classes translate one to one: `text-sm` is `var(--text-sm)` with `var(--text-sm--line-height)`, `p-4` is `calc(var(--spacing) * 4)`, `rounded-md` is `var(--radius-md)`, and `shadow-xs` is `var(--shadow-xs)`. Sizes are in rem, so text zoom scales them.
- Fonts are system stacks, `--font-sans` and `--font-mono`. Registry and docs CSS load no font: `check:components` rejects `@font-face`.
- Motion uses `--duration-fast`, `--duration-normal`, `--ease-out`, and `--ease-in-out`. Reduced motion sets both durations to `0s`, so animate only with them, through `transition()`.

`registry/lib/theme.test.ts` keeps text at 4.5:1 or more and focus rings and control borders at 3:1 or more in both schemes (WCAG 2.2 AA). The token values are shadcn's Neutral theme, darker or lighter where shadcn's values miss those ratios (`SOURCES.md` lists them).

### Conventions

- Focus: `theme.css` gives every focusable element a 2px outline in `--ring` on `:focus-visible`. Don't remove it without drawing another; use `focusRing()` when the ring belongs on a wrapper. Outlines stay visible in forced colors, and box shadows don't, so the ring is an outline.
- States: mark an invalid control with `aria-invalid="true"` and `invalidState`, and point `aria-describedby` at an error message with an icon and text. Disable with the `disabled` attribute or `aria-disabled="true"` and `disabledState`, and say why in text where it helps. No state relies on color alone.
- Forced colors: native controls stay native. Don't set `forced-color-adjust: none`, and draw borders and focus with `border` and `outline`, which forced colors keeps.
- Native controls: checkboxes, radios, sliders, and progress bars take `--primary` as their accent where they are, so a `data-theme` panel or a `--primary` override reaches them.
- Reflow: size with rem and let layouts shrink below their content: a single grid column is `minmax(0, 1fr)`, a minimum width is `min(100%, …)`, and a long word such as an email address may break. Then a page fits 320px without scrolling sideways, also with text at 200%. The style reference's browser test checks both sizes.
- Direction: use logical properties, such as `paddingInline`, `marginInlineStart`, and `borderInlineStart`, and mirror an icon that points onward with `mirrorInRtl`.
- Groups: a control that may sit in a ButtonGroup merges `buttonGroupItem` from `styles.ts` into its own `css()`. It then joins its neighbors with a `data-slot`, and an input grows into the room the group has. The group never styles its parts.
- Icons: draw them as inline SVG on a 24 by 24 grid with `Icon`, or add them to `icons.tsx`. Mark one that starts or ends a label with `data-icon="inline-start"` or `"inline-end"`, so a Button tightens the padding on that side. They take `currentColor` and `1em` from SVG attributes, which any CSS overrides, so a component sizes them in its own `css()`. Pass `label` only when no visible text says the same. Don't copy icons from an icon library or load one.

### The style reference

`test/fixtures/style-reference/` serves a synthetic page through Remix's renderer and asset server, as an app would: the color tokens, the type scale, the surfaces, the focus and form states, both themes side by side, the overrides, and right-to-left text. It is the style reference for later batches, not the public site. Run `bun run style-reference` to open it, and `bun run capture:style-reference` to capture the desktop and narrow pages in both themes, the focused invalid field in dark mode and in forced colors, and the narrow form states with text at 200%.

## Dependencies

- Components: none. `remix` comes from the user's app.
- CLI and MCP server: Node and Web built-ins only. `packages/cli/package.json` keeps `dependencies` empty and lists no peer or optional dependencies. `check:build` enforces it.
- Development only, pinned exactly in the root `devDependencies`: TypeScript, `@types/node`, and `remix` for typechecks and tests, Prettier and oxlint for formatting and lint, Playwright for the browser lanes and screenshots, `@axe-core/playwright` for accessibility checks, `shadcn` 4.23.0, the version at the pinned shadcn commit, whose schema, validator, MCP server and CLI check the registry, and `@modelcontextprotocol/client` 2.4.0, the MCP SDK version shadcn's server runs on, as the client that drives `remixcn mcp` in tests. A new tool joins them, pinned exactly, when a ticket needs it. Registry source and `packages/cli` never import them.

## Check lanes and CI

`scripts/lanes.ts` lists the check lanes. Each lane runs one root package script and can run alone, so a component author runs only what their change touches.

- A lane is built once its script exists. A test lane also needs a matching test file. Until then it reports `○ not built yet` with the reason, never `✓`.
- A built test lane that passes no tests fails, because an empty or fully skipped suite proves nothing.
- The registry lane runs `build:registry` (#4). The site lane turns on when `build:site` lands with the static site (#34). Use that script name.
- `check.ts` gives each lane's processes a marker. On Linux, it stops any process that outlives its lane and fails the lane. On every system, a lane fails when its output stays open after it exits, because a process it started still holds it.

`.github/workflows/ci.yml` runs for every pull request and every push to main. A plan job lists the built lanes, and each runs as its own job: browser lanes once per Playwright project, and `test` and `build` on both supported Node versions. Unbuilt lanes appear as notices and in the run summary. `test/ci.test.ts` and `checkWorkflow` keep the workflow within these limits:

- It triggers only on pull requests and pushes to main, and has only `contents: read` permission.
- It pins every action to a commit SHA and runs on `ubuntu-24.04`, a standard hosted runner that is free for public repositories.
- It reads no secrets and publishes or deploys nothing.
- Caches hold only downloads: Bun's packages keyed by `bun.lock`, and browsers keyed by the Playwright version. They have no fallback keys, so they can't hide a lockfile or source change.
- A failed job uploads its lane logs from `.diagnostics/` only after `check:secrets` finds no credentials in them. It reads every file, binary or not. GitHub keeps them for 7 days.

Browser and end-to-end tests use invented data and local servers. `t.serve` closes the server and browser after each test. `test/accessibility.ts` runs axe-core's WCAG 2.2 A and AA rules on a page.

## Names and metadata (C-976)

- Project: RemixCN. Repository: `janhesters/remixcn`. npm package and executable: `remixcn`. Registry namespace: `@remixcn`. Private workspace packages use `@remixcn/<name>`.
- Keep the exact phrase "shadcn components for Remix V3" in `README.md`, in each package description, and as a package keyword.
- Other keywords include `shadcn`, `shadcn-ui`, `remix`, `remix-v3`, `registry`, `ui-components`, `accessibility`, and `design-system`.
- Homepage: https://janhesters.github.io/remixcn/.

`check:build` checks the metadata of the root package and every workspace package.

## The catalog

`registry/catalog.json` reconciles the 64 files in shadcn/ui's `apps/v4/registry/bases/base/ui` at the pinned commit with the 66 Base pages of the Components docs. It adds the Data Table, Date Picker, and Typography recipes. Sonner is a dependency-free entry compatible with Toast: it keeps Sonner's `Toaster` and `toast()` names on top of RemixCN's Toast.

Each entry has a `source` link at the pinned commit (a helper that ports Base UI or Remix behavior links their pinned file instead), a `docs` link, its `batch`, what it `dependsOn`, the `upstreamImports` the port replaces, and its `target`. A ported component adds its `exampleTarget`, and its `dependsOn` lists the entries and helpers its file imports. A dependency lands in the same batch or an earlier one. Batches 1 to 8 order the follow-up work. Separate AI Elements patterns and the Blocks collection are listed under `outOfScope`, not as entries.

Change the catalog when a ticket changes an entry. `checkCatalog` in `scripts/contracts.ts` keeps it consistent.

## The registry build

`registry.json` lists the items that ship, in the registry format of shadcn 4.23.0. `bun run build:registry` checks it and writes `dist/r/registry.json`, the index, and `dist/r/<name>.json`, each item with its files' contents. The site serves that folder at `/remixcn/r/`, so shadcn's CLI and MCP server reach an item as `@remixcn/<name>`.

Each item:

- matches its catalog entry: the same name and title, and its one `registry/` file is the entry's `target`. Only the `licenses` item ships no `registry/` file. It ships both `LICENSE` and `THIRD_PARTY_NOTICES.md`, and no other item ships either.
- has the type its schema meaning fits: `registry:ui` for a component, `registry:component` for a recipe, `registry:lib` for a TypeScript helper, `registry:style` for a CSS helper such as the theme tokens, and `registry:file` for `licenses`.
- types each file by where it comes from. TypeScript is `registry:ui`, `registry:component` or `registry:lib`. CSS and the license texts are `registry:file`, which shadcn's CLI copies byte for byte.
- installs each file through a target placeholder for the user's directories: `registry/ui/<file>` to `@ui/<file>`, `registry/lib/<file>` to `@lib/<file>`, `registry/examples/<file>` to `@components/<file>`, and `LICENSE` and `THIRD_PARTY_NOTICES.md` to `@lib/remixcn/`. So every `#remixcn/ui/` or `#remixcn/lib/` import names an installed file, and the installer can rewrite it to a relative path.
- lists in `registryDependencies` each item it imports from, as `@remixcn/<name>`, and reaches `@remixcn/licenses` through them. A bare name would install shadcn/ui's React component.
- lists no npm `dependencies` or `devDependencies`: the app supplies `remix@3.0.0`, and a missing or other Remix is the installer's error. It also sets none of `tailwind`, `cssVars`, `css`, `envVars` or `meta`. The build writes `meta`: the Remix version, the license, and the catalog's upstream source.

The build checks everything before it writes. It fails, and leaves the previous output as it was, on invalid JSON, anything shadcn's schema rejects, a dependency cycle, a name or target used twice, a path or target that leaves its directory, a link, a test or any file outside `registry/ui`, `registry/lib`, `registry/examples` and the license texts, a missing file, a `licenses` item without one of its two texts, an import from an item the importer doesn't list, an npm or Node import, and a Tailwind directive. It never replaces an output folder that holds anything but JSON files. Items, dependencies and keys come in a fixed order, and newlines are LF, so the same source gives the same bytes.

`remixcn build` runs the same build: `packages/cli/src/build.ts` checks and writes the folder, with the contracts of `packages/cli/src/registry.ts`. `scripts/build-registry.ts` calls it and adds what only the pinned development tools can check: TypeScript reads the imports, and shadcn's schema checks registry.json and every output file. The executable reads imports without a compiler: `findScriptImports` in `packages/cli/src/source.ts` tells code from comments, strings, template text, regular expressions and JSX text, and keeps the code inside template and JSX expressions. Like TypeScript, it reads no JSX in a .ts file. Apart from the JSX runtime that tsc adds for every JSX file, it reads the same imports as tsc on every TypeScript file in the workspace.

`test/registry.test.ts` serves a fixture build under `/remixcn/r/` and checks it with shadcn's schema, validator, MCP server and CLI. It also installs a component into the consumer fixture, typechecks it, and compiles it with Remix's asset server. The README's Registry section describes what that test proves, so keep the two in step.

## Shared behavior helpers

Overlays, menus, and selection components build their behavior from the helpers in `registry/lib`, not from their own copies. Each exports plain functions for any DOM and a `createMixin` mixin for the `mix` prop. The mixins run only in the browser, take an `open` option, and undo their changes when the popup closes or unmounts.

| Helper | Gives |
| --- | --- |
| `layer.ts` | The layer stack: topmost Escape, outside presses, nested and parallel layers (`dismissableLayer`, `openLayer`) |
| `focus-scope.ts` | Initial and return focus, with a fallback when the trigger is gone or disabled, and an optional Tab trap for modal popups (`focusScope`, `createFocusScope`) |
| `modal.ts` | Scroll lock and inert surroundings for modal popups that aren't native dialogs (`modal`, `lockScroll`, `inertOthers`) |
| `composite.ts` | Roving focus or active descendant, with orientation, RTL, Home and End, typeahead, and disabled items (`rovingFocus`, `activeDescendant`) |
| `anchor-position.ts` | Placement next to an element or point: CSS anchor positioning, with a measured fallback (`anchorPosition`, `positionFloating`) |

Prefer native `<dialog>` and `popover` features and add a helper for what they lack. Pick roving focus or active descendant per control, never both.

## The installer

`remixcn init` and `remixcn add` copy registry items into a Remix 3 app. `packages/cli/README.md` documents the commands, options and exit codes for users. These contracts keep them safe:

- **components.json.** It follows shadcn's convention without the Tailwind and React-style settings shadcn's schema requires: `$schema` names `components.schema.json`, `version` is `1`, `rsc` is `false`, `tsx` is `true`, `css` names the theme, and `aliases` and `registries` work as in shadcn. Init keeps every other field and its order, and changes a value the user set only with `--overwrite`. shadcn's MCP server reads only `registries`, so it discovers RemixCN items.
- **Aliases.** `aliases.ui`, `lib` and `components` resolve through `package.json` imports (`#remixcn/ui`) or `tsconfig.json` paths (`~/ui/...`), and each must stay inside the app. Init maps the `#remixcn/*` defaults to `app/ui/public/...` only when they don't resolve yet. Target `@ui/<file>` installs in the ui directory, and so on.
- **Items.** A name means `@remixcn/<name>`. Registry items name dependencies only as `@namespace/name` or URLs, never as bare names or local files. The installer checks every payload first and refuses invalid JSON, cycles, two items with one name, npm `dependencies`, Tailwind, CSS-variable, env or other advanced fields, unsafe targets, imports no item provides, and an item whose `meta.remix` has another major version. Every file it copies must keep the rules of [Browser-reachable source](#browser-reachable-source) that the registry build checks: `checkSourceContent` refuses any import but `remix/component` and the `#remixcn/` aliases, and Tailwind directives in CSS.
- **Network.** HTTPS only, or plain HTTP to localhost for fixtures. Each request has a 15-second limit, a 5 MB limit, and at most 5 redirects, none from a remote host to the local machine. It sends no credentials or telemetry and runs nothing it downloads.
- **Writes.** The installer plans every file before it writes one. A file may replace only a regular file, through directories whose real path stays in the app. A changed file needs `--overwrite` or a yes in a terminal. `transaction.ts` stages each file beside its target and swaps them in, and undoes every step when one fails. `--dry-run` writes nothing. Running a command again changes nothing.
- **Imports.** Each `#remixcn/ui/` or `#remixcn/lib/` string in installed TypeScript becomes a relative path to the installed file. CSS and the license texts install byte for byte, with their headers.

`packages/cli/src/*.test.ts` test each module and every command in-process against a fixture registry on localhost. `test/cli.test.ts` packs the package with npm, then runs the packed executable: init and add through both alias styles and every kind of address, a typecheck, a server render and the asset server, and its own MCP server and shadcn's on the result.

## The MCP server

`remixcn mcp` serves seven tools to AI clients on stdin and stdout. `packages/cli/README.md` documents them and the client configs. `src/mcp.ts` holds the protocol and `src/mcp-tools.ts` the tools. These contracts keep it safe:

- **Protocol.** Newline-delimited JSON-RPC 2.0 on Node built-ins, without an MCP SDK. A request whose `_meta` names `io.modelcontextprotocol/protocolVersion` speaks MCP 2026-07-28 and is served on its own, and `server/discover` describes the server. After `initialize`, a request without it speaks 2025-11-25, and `initialize` with any other version gets 2025-11-25 back. Another `_meta` version gets `-32022` with the supported versions, and a request without `_meta` before `initialize` gets `-32602`. The server declares only the `tools` capability: no resources, prompts, logging, sampling, subscriptions, HTTP or auth.
- **Messages.** Stdout carries only protocol messages, and diagnostics go to stderr. A line over 1 MB, invalid JSON, a batch, a bad id, a string id over 256 bytes, or the id of a request still running gets an error and leaves the next message as it was. Each call's arguments are checked against the schema its tool advertises before it runs, and a mismatch is an `isError` result. No response passes 1 MB, counted as the whole JSON-RPC message: a tool response that would becomes an `isError` result, and an error that echoes a long method, tool name or version goes out with those strings shortened. Because ids are short, both always fit. Requests run concurrently. `notifications/cancelled` aborts a call's network requests and drops its response, and the end of input aborts every call and ends the process.
- **Tools.** They keep the names, arguments, pagination, type filters and `isError` results of shadcn's MCP server at the pinned commit, and `mcp-tools.test.ts` compares them with shadcn's own server. They read only `components.json` and registries, through the installer's network rules, never a local file a client names, and they are annotated read-only.
- **Untrusted content.** Registry text is data. Titles, descriptions and paths show on one line, without control or direction characters, and so does each line of an error result, which may quote a rejected item's fields, and source sits in a fence longer than any run of backticks in it. The server's instructions tell the client not to follow instructions in registry content.
- **Commands.** `get_add_command_for_items` only returns text. Each item must be a name, `@namespace/name` or an item URL, without whitespace, quotes, backticks or backslashes, and no argument starts with `-`. Arguments with characters outside `[A-Za-z0-9._/:=-]` are single-quoted, which keeps them literal in POSIX shells and PowerShell.

`packages/cli/src/mcp.test.ts` tests the protocol in memory, `mcp-tools.test.ts` each tool against a synthetic registry, including hostile items and a shell that reads back the command's arguments, and `mcp-stdio.test.ts` the process with the pinned MCP client in both protocol versions.

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
- Every registry file starts with that header, naming its catalog title, or `<title> examples` in a component's example file. CSS files write it as a block comment. `check:components` enforces it.

## Boundaries

- Take no production action without Jan's approval. Don't publish a package, deploy or turn on the site, change repository or GitHub Pages settings, or start a paid service. `packages/cli` stays `"private": true` until Jan releases it.
- This repository is public. Keep private app code, data, secrets, and screenshots of private apps out of it. Fixtures and examples use invented data.

## Builds

`packages/cli/dist/` and `dist/r/` are the only build outputs, and git ignores both. `check:build` rebuilds the first, and `build:registry` the second. `bun run check --diagnostics .diagnostics` writes each lane's log to `.diagnostics/`, which git ignores too.
