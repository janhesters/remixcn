# RemixCN

shadcn components for Remix V3: accessible, dependency-free UI components, a shadcn-style registry, CLI and MCP server

RemixCN ports the shadcn/ui component catalog to Remix 3. You copy each component's source into your app and own it, as with shadcn/ui. The components need only `remix`, which your app already has: no React, Tailwind, or headless UI kit.

Site: https://janhesters.github.io/remixcn/ (not live yet)

## Status

The workspace, the component inventory, the styling foundation, and the registry build are ready. `registry/catalog.json` lists the 67 planned entries and the batch each one lands in. `registry/lib/` holds the theme stylesheet with its light and dark tokens, the shared style conventions, and the icons, and `bun run style-reference` shows them on a synthetic page. It also holds the shared behavior helpers for the overlay and selection components: focus, dismissal, modal, keyboard navigation, and positioning. `bun run build:registry` turns `registry.json` into a registry in shadcn's format; so far it ships only the license texts. No component, site page, CLI command, or MCP server is ready yet, and nothing is published.

## Registry

Once the site is live, the registry is at https://janhesters.github.io/remixcn/r/registry.json, and each item at `/remixcn/r/<name>.json`. It follows the registry and registry-item schemas of shadcn 4.23.0. Items install only source files: no npm packages, since your app already has `remix@3.0.0`. Every item also installs RemixCN's license and the license texts of the projects it adapts.

The `remixcn` installer, still to come, is meant for Remix apps. shadcn's CLI and MCP server can read the registry too. The tests check this setup with shadcn 4.23.0:

- In `components.json`, register `"@remixcn": "https://janhesters.github.io/remixcn/r/{name}.json"` and set the aliases `ui` to `#remixcn/ui`, `lib` to `#remixcn/lib` and `components` to `#remixcn/components`.
- In `package.json`, map `#remixcn/ui/*`, `#remixcn/lib/*` and `#remixcn/components/*` under `imports` to directories under `app/**/public/`, so the browser can load them.

Two of shadcn's install steps don't fit a Remix app:

- **Imports.** shadcn keeps the `#remixcn/...ts` imports. The `tsconfig.json` of a `remix new` app sets `rewriteRelativeImportExtensions`, and TypeScript then rejects these imports (TS2877). The app compiles once you remove that option. The `remixcn` installer will rewrite them to relative paths instead.
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
