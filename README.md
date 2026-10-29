# RemixCN

shadcn components for Remix V3: accessible, dependency-free UI components, a shadcn-style registry, CLI and MCP server

RemixCN ports the shadcn/ui component catalog to Remix 3. You copy each component's source into your app and own it, as with shadcn/ui. The components need only `remix`, which your app already has: no React, Tailwind, or headless UI kit.

Site: https://janhesters.github.io/remixcn/ (not live yet)

## Status

The workspace, the component inventory, the styling foundation, the registry build, and the `remixcn` command line are ready. `registry/catalog.json` lists the 67 planned entries and the batch each one lands in. `registry/lib/` holds the theme stylesheet with its light and dark tokens, the shared style conventions, and the icons, and `bun run style-reference` shows them on a synthetic page. It also holds the shared behavior helpers for the overlay and selection components: focus, dismissal, modal, keyboard navigation, and positioning. `bun run build:registry` turns `registry.json` into a registry in shadcn's format; so far it ships only the license texts. Button and Button Group are ported: `bun run button-examples` shows their examples, and `docs/components/` describes them. No other component, site page, or MCP server is ready yet, and nothing is published: the `remixcn` package isn't on npm, and the registry isn't online.

## Command line

`remixcn` sets up a Remix 3 app and copies items into it, with everything they depend on:

```sh
npx remixcn init
npx remixcn add button
npx remixcn search --query dialog
```

It installs no npm package, never replaces a file you changed without `--overwrite`, and undoes a whole install when one write fails. `packages/cli/README.md` documents every command, option, and exit code.

## Registry

Once the site is live, the registry is at https://janhesters.github.io/remixcn/r/registry.json, and each item at `/remixcn/r/<name>.json`. It follows the registry and registry-item schemas of shadcn 4.23.0. Items install only source files: no npm packages, since your app already has `remix@3.0.0`. Every item also installs RemixCN's license and the license texts of the projects it adapts.

`remixcn add` is the installer for Remix apps. shadcn's MCP server reads the `registries` map that `remixcn init` writes, so it lists, searches, and shows RemixCN items. shadcn's CLI can install them too. The tests check this setup with shadcn 4.23.0:

- In `components.json`, register `"@remixcn": "https://janhesters.github.io/remixcn/r/{name}.json"` and set the aliases `ui` to `#remixcn/ui`, `lib` to `#remixcn/lib` and `components` to `#remixcn/components`.
- In `package.json`, map `#remixcn/ui/*`, `#remixcn/lib/*` and `#remixcn/components/*` under `imports` to directories under `app/**/public/`, so the browser can load them.
- For shadcn's `add`, also set the fields its schema requires and RemixCN doesn't use: `style`, `tailwind` and `aliases.utils`. `remixcn init` doesn't write them, since a Remix app needs no Tailwind.

Two of shadcn's install steps don't fit a Remix app:

- **Imports.** shadcn keeps the `#remixcn/...ts` imports. The `tsconfig.json` of a `remix new` app sets `rewriteRelativeImportExtensions`, and TypeScript then rejects these imports (TS2877). The app compiles once you remove that option. `remixcn add` rewrites them to relative paths instead.
- **License header.** shadcn drops the comment at the top of each TypeScript file, which holds RemixCN's license header. The license texts still arrive as files, since shadcn copies them unchanged.

## Contributing

`AGENTS.md` describes the layout, the commands, and the contracts every change keeps.

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` runs every check that exists so far and says which are not built yet. CI runs the same checks for every pull request.

## Credits

RemixCN adapts shadcn/ui and Base UI and builds on Remix. `SOURCES.md` lists what comes from where, and `THIRD_PARTY_NOTICES.md` holds their licenses.

## License

MIT. See `LICENSE`.
