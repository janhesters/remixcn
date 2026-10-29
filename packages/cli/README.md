# remixcn

shadcn components for Remix V3. `remixcn` copies component source from a registry into your Remix 3 app. You own the code from then on, as with shadcn/ui. It needs Node 24.3 or later and installs no npm package: the components need only `remix`, which your app already has.

Site: https://janhesters.github.io/remixcn/

## Set up an app

Run `init` in the root of an existing Remix 3 app, such as one from `npx remix new`:

```sh
npx remixcn init
```

`init` checks that `package.json` lists Remix 3 and that `tsconfig.json` compiles JSX through `remix/component`. Then it:

- writes `components.json` and keeps any field already there;
- maps `#remixcn/ui/*`, `#remixcn/lib/*` and `#remixcn/components/*` under `imports` in `package.json`, unless your aliases already resolve;
- installs `@remixcn/theme`, the tokens stylesheet, with RemixCN's license and the license texts of the projects it adapts.

It prints the next steps: link the theme first in `<head>`, let the asset server serve `app/**/public/**`, and start the browser runtime with `run()` for interactive components.

## Add components

```sh
npx remixcn add button
npx remixcn add button card dialog
npx remixcn add --all
```

`add` installs each item with everything it depends on: helpers, theme tokens, and license texts. Each `#remixcn/ui/...` or `#remixcn/lib/...` import becomes a relative path to the installed file, so the app compiles with `rewriteRelativeImportExtensions` and Remix's asset server.

An item can be:

- a name in the RemixCN registry: `button`;
- `@namespace/name` for a registry in `components.json`: `@remixcn/button` or `@acme/button`;
- an item URL: `https://example.com/r/button.json`;
- a path to an item's JSON file: `./button.json`.

Registries load over HTTPS. Plain `http://` works only for `localhost`, `127.0.0.1`, and `[::1]`, for local fixtures.

| Option | Effect |
| --- | --- |
| `-c, --cwd <dir>` | The app's directory |
| `-a, --all` | Add every item of the `@remixcn` registry |
| `-p, --path <dir>` | Put the named items' component files in `<dir>` |
| `-o, --overwrite` | Replace files that differ from the registry |
| `-y, --yes` | Never ask. A conflict fails instead |
| `--dry-run` | Show every change and write nothing |
| `--json` | Print the result or the error as JSON |

## Safe by default

- `add` checks every item before it writes a file. It refuses invalid JSON, dependency cycles, npm dependencies, Tailwind or CSS-variable config, targets outside the `@ui/`, `@lib/`, and `@components/` directories, and links that lead out of the app.
- Installed source may import only `remix/component` and other RemixCN files, and its CSS uses no Tailwind directives. `add` refuses an item whose files import an npm package, a Node built-in, or a relative file, as the registry build does.
- It writes all files as one change. If one write fails, it undoes the others.
- It never replaces a file you changed without `--overwrite`, or a yes when it asks in a terminal.
- Running the same command again changes nothing.
- It runs no registry script, sends no telemetry, and installs no npm package. Each request has a 15-second limit, a 5 MB limit, and at most 5 redirects.

## Discover items

```sh
npx remixcn list
npx remixcn search --query dialog
npx remixcn view button
```

`list` and `search` read every registry in `components.json` plus `@remixcn`, or the registries you name. They take `-q, --query`, `-t, --type` (such as `ui` or `ui,lib`), `-l, --limit`, `-o, --offset`, and `--json`. `view` prints the items as JSON, as the registry serves them.

## Build a registry

```sh
npx remixcn build [registry.json] --output dist/r
```

`build` checks a RemixCN-format `registry.json` and the `registry/catalog.json` next to it, then writes `registry.json` and one `<name>.json` per item. A failed build writes nothing, and it replaces only an earlier build.

## components.json

```json
{
  "$schema": "https://janhesters.github.io/remixcn/schema/components.json",
  "version": 1,
  "rsc": false,
  "tsx": true,
  "css": "app/ui/public/lib/theme.css",
  "aliases": {
    "ui": "#remixcn/ui",
    "lib": "#remixcn/lib",
    "components": "#remixcn/components"
  },
  "registries": {
    "@remixcn": "https://janhesters.github.io/remixcn/r/{name}.json"
  }
}
```

It follows shadcn's `components.json`, without the Tailwind and React-style settings shadcn's schema requires. `components.schema.json` in this package is the schema. The aliases resolve through `package.json` imports or `tsconfig.json` paths, such as `"ui": "~/ui/public/components/ui"` with `"paths": { "~/*": ["./app/*"] }`. Keep them under `app/**/public/` so the browser can load the files.

shadcn's MCP server reads the `registries` map, so `npx shadcn@latest mcp` lists and searches RemixCN items. shadcn's `add` needs a Tailwind setup and keeps the `#remixcn/` imports, so use `remixcn add` in a Remix app.

## Exit codes

| Code | Name | Meaning |
| --- | --- | --- |
| 0 | | Success |
| 1 | `INTERNAL` | A bug in remixcn. Please report it |
| 2 | `USAGE` | Unknown command, option, or argument |
| 3 | `PROJECT` | Not a supported Remix 3 app, or `components.json` is missing or invalid |
| 4 | `NETWORK` | A registry is unreachable, too slow, or failing |
| 5 | `REGISTRY` | An item or registry is missing, invalid, cyclic, or needs what remixcn doesn't install |
| 6 | `UNSAFE_PATH` | A file would land outside the app, through a link, or twice |
| 7 | `CONFLICT` | Files or settings differ, and nothing was written. Pass `--overwrite` |
| 8 | `WRITE` | A write failed, and remixcn undid the change |
| 9 | `UNAVAILABLE` | The command arrives in a later release, such as `mcp` |

With `--json`, a failure prints `{ "error": { "code", "exitCode", "message", "details" } }` on stdout.

## License

MIT. See `LICENSE`. Installed items carry RemixCN's license and the license texts of shadcn/ui, Base UI, and Remix.
