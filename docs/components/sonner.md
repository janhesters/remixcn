# Sonner

Sonner's `Toaster` and `toast()` on top of RemixCN's [Toast](toast.md), without the `sonner` or `next-themes` packages. Code written for shadcn's Sonner keeps its calls, and the toasts look and behave as Toast's.

- Source: `registry/ui/sonner.tsx`. Needs `registry/ui/toast.tsx`, `registry/ui/button.tsx` and `registry/lib/styles.ts`.
- Examples: `registry/examples/sonner-example.tsx`. Run them with `bun run toast-examples`.
- Upstream: shadcn/ui [`sonner.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/sonner.tsx), its [example](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/sonner-example.tsx), and the API of [Sonner](https://sonner.emilkowal.ski) 2.0.7, the version shadcn/ui pins. RemixCN copies none of Sonner's code. shadcn's Sonner docs page redirects to Toast.

## Usage

```tsx
import { Toaster, toast } from '#remixcn/ui/sonner.tsx'

<body>
  {children}
  <Toaster />
</body>

toast('Event has been created', { description: 'Monday, January 3rd at 6:00pm' })
toast.success('Invoice paid')
toast('Event deleted', { action: { label: 'Undo', onClick: () => restore() } })
```

Call `toast()` from browser code, such as an event handler in your client entry.

## API

### `toast(message, data?)`

Shows a toast with `message` as its title and returns its id.

| Function | What it does |
| --- | --- |
| `toast()`, `toast.message()` | A toast without a type |
| `toast.success()`, `info()`, `warning()`, `error()`, `loading()` | A typed toast, with its icon. A loading toast stays until it's updated or dismissed |
| `toast.promise(promise or function, { loading, success, error, description, finally })` | Shows `loading`, then `success` or `error`. Each is a node, a function of the result, or `{ message, ...data }`. A `Response` that isn't ok counts as an error. The outcome keeps the promise's options, such as its duration, buttons and dismissal, unless it sets its own. Without a message for the outcome, the loading toast closes. Once the loading toast is dismissed, or its Toaster unmounts, the outcome changes nothing, so a later toast with its id stays as it is. Without `loading`, only the outcome shows. Returns `{ id, unwrap() }` |
| `toast.custom((id) => node, data?)` | Renders your content in a toast frame. Its text names the toast. Once the content has rendered, its text and `description` are announced together, once. The description is read by screen readers only |
| `toast.dismiss(id?)` | Dismisses one toast, or all of every Toaster |

`data` takes Sonner's options:

| Option | What it does |
| --- | --- |
| `id` | A stable id. Showing a toast with the id of an open one updates it in place. Numbers become strings |
| `toasterId` | Shows it in the `Toaster` with this `id` |
| `description` | The text below the title |
| `duration` | Milliseconds until it closes. `Infinity` keeps it |
| `important` | Announces it at once, as an alert |
| `dismissible` | `false` hides its close button and ignores Escape and swipes |
| `closeButton` | Shows or hides its close button |
| `icon` | Replaces the type's icon |
| `action`, `cancel` | `{ label, onClick(event) }`. An action closes the toast after `onClick` unless it calls `event.preventDefault()`. A cancel button closes it after `onClick`, and does nothing on a toast that is not dismissible |
| `onDismiss(toast)`, `onAutoClose(toast)` | Run when it's dismissed, or when its time runs out |

### `Toaster`

A client entry over `ToastProvider`, `ToastViewport` and Sonner's list. Its props:

| Prop | Default | What it does |
| --- | --- | --- |
| `id` | | Shows only toasts sent with this `toasterId` |
| `position` | `'bottom-right'` | `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center` or `bottom-right` |
| `expand` | `false` | Keeps the stack open |
| `closeButton` | `false` | A close button on every toast, as in Sonner |
| `duration` | `4000` | The default duration |
| `visibleToasts` | `3` | How many toasts show at once |
| `hotkey` | `['altKey', 'KeyT']` | Moves focus to the newest toast and back. The region is named `Notifications (Alt+T)` |
| `containerAriaLabel` | `'Notifications'` | The region's name |
| `theme` | `'system'` | `light` or `dark` sets `data-theme` on the region |
| `dir` | | The region's text direction |
| `swipeDirections` | toward the edge and the end of the line | `top`, `right`, `bottom`, `left` |
| `toastOptions` | | `duration`, `closeButton` and `closeButtonAriaLabel` for every toast |
| `icons` | | `success`, `info`, `warning`, `error`, `loading` and `close` |

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| shadcn's `Toaster` with `next-themes` and the type icons | `Toaster`, a client entry | `theme` replaces `useTheme()`: the tokens follow the page, and `light` or `dark` set `data-theme`. The icons are Toast's |
| shadcn's `--normal-bg`, `--normal-text`, `--normal-border`, `--border-radius` | Toast's `--popover`, `--popover-foreground`, `--border` and `--radius-xl` | |
| Sonner's `toast()` and its methods | `toast()` with the same methods | Throws without a mounted Toaster instead of keeping the toast; the state stays with the page |
| `toast.promise` returning the id with `unwrap()` | `{ id, unwrap() }` | |
| `toast.getHistory()`, `toast.getToasts()`, `useSonner()` | `handle.context.get(ToastProvider).toasts` | No toast lives outside a mounted Toaster |
| `<Toaster id>` and `toasterId` | Same | Each id has its own manager |
| `position` | Same names, logical sides | Left and right mirror in right-to-left text, as RemixCN's conventions ask |
| `hotkey`, `containerAriaLabel`, `closeButton`, `duration`, `visibleToasts`, `expand`, `swipeDirections`, `dir`, `icons` | Same | |
| `richColors`, `invert` | Not ported | The neutral theme has no success, info or warning colors |
| `className`, `style`, `classNames`, `unstyled`, `toastOptions.className` and `style` | Not ported | Style with `mix`, tokens or a rule in `@layer app` |
| `offset`, `mobileOffset`, `gap` | Not ported | Toast's insets and gaps; change them in `@layer app` |
| Sonner's dark action and gray cancel buttons | `Button` sizes `xs`: default and secondary | |
| Docs: Basic, With Description | `SonnerBasic`, `SonnerWithDescription` | |
| — | `SonnerTypes`, `SonnerWithAction`, `SonnerCustom` | Sonner's types and promise, an action with cancel, and custom content |

## Accessibility checks

Sonner's entry renders Toast's parts, so [Toast's checks](toast.md#accessibility-checks) apply. Also automated, in Chromium, Firefox and WebKit:

- `important` toasts are announced as alerts, others as a status.
- Alt+T moves focus to the newest toast and back.
- Action and cancel buttons close their toast after `onClick` unless it prevents that; a toast that isn't dismissible has no close button and ignores Escape.
- `onAutoClose` runs when the time runs out, `onDismiss` when it's dismissed.
- Toasters with different ids keep their toasts apart.
- A promise keeps its options once it settles, and leaves a later toast with its id alone once its loading toast was dismissed or its Toaster unmounted.
- A custom toast is named by its content and announced once, with its text and description together, by its urgency.

Sonner shows no close button by default, so a keyboard user closes a toast with Escape once it has focus, and a pointer user waits for it or swipes. Set `closeButton` for toasts people must close. The gaps Toast lists apply too.
