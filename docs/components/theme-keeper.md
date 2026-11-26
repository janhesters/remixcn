# Theme keeper

Lets the user pick Light, Dark or System, applies a saved Light or Dark choice before the first paint, and keeps it through Remix's in-place document updates. It owns the storage and the document state; your app owns the control, its text and its place.

- Source: `registry/lib/theme-keeper.ts`. Needs `registry/lib/theme.css`. Install it with `npx remixcn add theme-keeper`.
- Upstream: shadcn/ui [`theme-provider.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/components/theme-provider.tsx) and [`mode-toggle.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/new-york-v4/examples/mode-toggle.tsx), the [Vite](https://github.com/shadcn-ui/ui/blob/055aa6b7837b1808456a24beb4c97a677864aa82/apps/v4/content/docs/dark-mode/vite.mdx) and [Remix](https://github.com/shadcn-ui/ui/blob/055aa6b7837b1808456a24beb4c97a677864aa82/apps/v4/content/docs/dark-mode/remix.mdx) dark mode guides, and the behavior of [next-themes 0.4.6](https://github.com/pacocoursey/next-themes/blob/3a43743798db3008a0fc59e8bcc9d6e1bb5d4752/next-themes/src/script.ts).

## Usage

These files show an app set up the way `npx remixcn init` sets up a `remix new` app, with the helper installed at `app/ui/public/lib/theme-keeper.ts`. They import it with a relative path, as the installer writes the imports of the files it installs. With `rewriteRelativeImportExtensions` on, as in a `remix new` app, TypeScript refuses a `#remixcn/` alias import that ends in `.ts` (TS2877). Change the paths if your files live elsewhere.

Put the bootstrap first in `<head>`, before the stylesheets and the runtime's scripts. It's a fixed string from the module, with no user input in it, so it's safe as inline script text.

```tsx
// app/actions/document.tsx
import { unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import { themeScript } from '../ui/public/lib/theme-keeper.ts'

interface DocumentProps {
  title: string
  themeHref: string
  script: { href: string; importMap: ImportMapData }
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, themeHref, script, children } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <script innerHTML={unsafeHTML(themeScript)} />
          <title>{title}</title>
          <link rel="stylesheet" href={themeHref} />
          <ImportMap value={script.importMap} />
          <script type="module" src={script.href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
```

Start the keeper in your browser entry, before `run()`, so it holds the choice on every page, also one without the control.

```ts
// app/actions/public/entry.ts
import { run } from 'remix/component'

import { pageTheme } from '../../ui/public/lib/theme-keeper.ts'

pageTheme()

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl)
    return module[exportName]
  },
})

await app.ready()
```

Then read and set the choice from a control in a client entry. The keeper starts in the browser only, so start it in a task.

```tsx
// app/ui/public/components/theme-select.tsx
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { pageTheme, themeChoices } from '../lib/theme-keeper.ts'
import type { ThemeKeeper } from '../lib/theme-keeper.ts'

export const ThemeSelect = clientEntry(import.meta.url, function ThemeSelect(handle: Handle) {
  let keeper: ThemeKeeper | undefined
  handle.queueTask(() => {
    keeper = pageTheme()
    keeper.addEventListener('change', () => void handle.update(), { signal: handle.signal })
    void handle.update()
  })

  return () => (
    <select
      aria-label="Theme"
      disabled={keeper === undefined}
      mix={on('change', (event) => {
        let choice = themeChoices.find((option) => option === (event.target as HTMLSelectElement).value)
        if (choice) keeper?.set(choice)
      })}
    >
      {themeChoices.map((choice) => (
        <option key={choice} value={choice} selected={keeper?.choice === choice}>
          {choice}
        </option>
      ))}
    </select>
  )
})
```

The RemixCN site's theme radios, in `apps/docs/app/public/chrome.tsx`, work the same way, and `test/fixtures/theme-keeper/` runs this control and entry in the end-to-end tests, with the workspace's aliases.

## API

### `themeScript`

The bootstrap's text. It reads `localStorage` under `themeStorageKey` and sets `data-theme="light"` or `"dark"` on `<html>` for a saved Light or Dark choice. Anything else, a missing value, or a storage the browser blocks leaves the attribute off, so `theme.css` follows the device. Without scripting, the device's theme shows.

### `pageTheme()`

The keeper of the page's `<html>` and `localStorage`, made on its first call and shared by every later one. Call it in the browser only; the module itself reads no browser global, so the server can import it to render the bootstrap.

### `createThemeKeeper(root, storage, signal)`

Makes a keeper for any element and storage, until `signal` aborts: then it stops watching the element and other tabs. `pageTheme()` uses it. A keeper is an `EventTarget`:

- `choice`: the saved choice, `'light'`, `'dark'` or `'system'`. It's what the user picked, not the colors: System leaves those to the device.
- `set(choice)`: applies the choice and saves it. When the storage refuses the write, the choice still holds for the open page.
- `change`: dispatched once each time the choice changes, by `set()` or another tab.

It starts in System when the storage is missing, holds anything but the three choices, or can't be read. When Remix's runtime drops or changes `data-theme` in an in-place update, a mutation observer puts the choice back before the next paint. When another tab saves a choice, it follows; when another tab removes it or clears the storage, it resets to System.

### `readSavedTheme(storage)`, `isThemeChoice(value)`, `themeChoices`, `themeStorageKey`

The validation rule the bootstrap and the keeper share, and the storage key, `remixcn-theme`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| next-themes' inline `script` | `themeScript` | Applies only Light or Dark. System leaves the attribute off, since `light-dark()` follows the device |
| `ThemeProvider` from next-themes, through shadcn's `theme-provider.tsx` | `pageTheme()`, `createThemeKeeper()` | No React context: one keeper per page, with an `AbortSignal` for cleanup |
| `useTheme()`: `theme`, `setTheme` | `choice`, `set()`, the `change` event | `resolvedTheme` and `systemTheme` aren't ported; CSS resolves the colors |
| `attribute="class"` | `data-theme` on `<html>` | The attribute `theme.css` reads |
| `storageKey`, `localStorage` | `themeStorageKey`, `localStorage` | Not the Remix guide's cookie session: the choice applies before paint without a request |
| The storage event, `defaultTheme` on a removed value | The storage event, System on a removed value or a cleared storage | Ignores the same key in another storage |
| `enableColorScheme`, `matchMedia` listener | `theme.css` | `[data-theme]` sets `color-scheme`, and the device's preference reaches CSS directly |
| `forcedTheme`, `themes`, `value`, `disableTransitionOnChange`, `nonce` | Not ported | |
| `mode-toggle.tsx`, the `d` shortcut | Not ported | The app owns its control |
