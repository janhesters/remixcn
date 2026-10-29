# RemixCN

shadcn components for Remix V3: accessible, dependency-free UI components, a shadcn-style registry, CLI and MCP server

RemixCN ports the shadcn/ui component catalog to Remix 3. You copy each component's source into your app and own it, as with shadcn/ui. The components need only `remix`, which your app already has: no React, Tailwind, or headless UI kit.

Site: https://janhesters.github.io/remixcn/ (not live yet)

## Status

The workspace, the component inventory, and the styling foundation are ready. `registry/catalog.json` lists the 67 planned entries and the batch each one lands in. `registry/lib/` holds the theme stylesheet with its light and dark tokens, the shared style conventions, and the icons, and `bun run style-reference` shows them on a synthetic page. No component, site page, CLI command, or MCP server is ready yet, and nothing is published.

## Contributing

`AGENTS.md` describes the layout, the commands, and the contracts every change keeps.

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
```

## Credits

RemixCN adapts shadcn/ui and Base UI and builds on Remix. `SOURCES.md` lists what comes from where, and `THIRD_PARTY_NOTICES.md` holds their licenses.

## License

MIT. See `LICENSE`.
