# Toast

Short messages that stack in a corner of the window and close by themselves: a `Toaster` for the page, the `toast` manager to show, update and close toasts from browser code, and the provider, viewport and parts to build your own.

- Source: `registry/ui/toast.tsx`. Needs `registry/ui/button.tsx`, `registry/lib/icons.tsx`, `registry/lib/styles.ts` and `registry/lib/theme.css`.
- Examples: `registry/examples/toast-example.tsx`. Run them with `bun run toast-examples`.
- Upstream: shadcn/ui [`toast.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/toast.tsx), its [docs](https://ui.shadcn.com/docs/components/base/toast), and [Base UI Toast](https://base-ui.com/react/components/toast.md).
- Sonner's names live in [`sonner.md`](sonner.md).

## Usage

Render the `Toaster` once, at the end of `<body>`. It's a client entry, so it hydrates on its own:

```tsx
import { Toaster } from '#remixcn/ui/toast.tsx'

<body>
  {children}
  <Toaster />
</body>
```

Show toasts from browser code, such as an event handler in your client entry:

```tsx
import { on } from 'remix/component'
import { toast } from '#remixcn/ui/toast.tsx'

<Button
  mix={on('click', () => {
    toast.add({ title: 'Invoice sent', description: 'INV-0042 to Acme Labs.' })
  })}
>
  Send
</Button>
```

An action is a button you describe with `actionProps`: its label as `children`, and your handler in `mix`:

```tsx
let id = toast.add({
  title: 'Invoice archived',
  actionProps: { children: 'Undo', mix: [on('click', () => toast.close(id))] },
})
```

`toast.promise()` follows a task in one toast:

```tsx
toast.promise(sendInvoice(), {
  loading: 'Sending invoice…',
  success: (invoice) => ({ title: `${invoice.number} sent` }),
  error: 'Could not send the invoice.',
})
```

## API

### `toast` and `createToastManager()`

`toast` is the manager every `Toaster` uses. `createToastManager()` makes another, for a provider of your own. A manager holds no toasts: each mounted provider it's given to keeps its own, so nothing is shared between requests on the server, and two providers with different managers stay apart.

| Method | What it does |
| --- | --- |
| `add(options)` | Shows a toast and returns its id. With the id of an open toast, it updates that toast in place and restarts its timer. Throws when no provider is mounted for the manager, such as on the server: show toasts from browser code |
| `update(id, options \| (toast) => options)` | Changes an open toast. A closed or unknown toast is ignored, and the function form then never runs |
| `close(id?)` | Closes one toast, or every open toast without an id |
| `promise(promise, { loading, success, error })` | Shows a `loading` toast, then updates it to `success` or `error`. Each option is a string, which becomes the description, options, or a function of the result. Returns a promise that settles as yours does |

The options of `add()` and `update()`:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `id` | `string` | generated | A stable id, `add()` only |
| `title`, `description` | Remix nodes | | The text. The title names the toast, or the description without one |
| `type` | `'success' \| 'info' \| 'warning' \| 'error' \| 'loading'` or your own string | | Sets the icon and `data-type`. A loading toast never closes by itself |
| `timeout` | `number` | the provider's, `5000` | Milliseconds until it closes. `0` or `Infinity` keeps it until it's closed |
| `priority` | `'low' \| 'high'` | `'low'` | `low` is announced politely, as a status. `high` is announced at once, as an alert, and the toast is an `alertdialog` |
| `actionProps` | `Props<'button'>` | | Renders an action button. Put your `on('click')` in `mix` |
| `onClose(reason)` | function | | Runs once when it starts to close. `reason` is `'timeout'` or `'dismiss'` |
| `onRemove()` | function | | Runs once it has left the screen: after its exit, or when its provider unmounts |
| `data` | anything | | Your own data. An update replaces it as a whole |

### `Toaster`

A client entry with a `ToastProvider` for the `toast` manager, a `ToastViewport` and a `ToastList`. Its props are serializable:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `position` | `'top-start' \| 'top-center' \| 'top-end' \| 'bottom-start' \| 'bottom-center' \| 'bottom-end'` | `'bottom-end'` | Where the stack sits. Start and end follow the text direction |
| `timeout` | `number` | `5000` | The default timeout |
| `limit` | `number` | `3` | How many toasts show at once |
| `label` | `string` | `'Notifications'` | The region's name. The hotkey is added to it, as `Notifications (F6)` |
| `hotkey` | `string[]` | `['F6']` | Moves focus to the newest toast and back. Each entry is a modifier, such as `altKey`, or a key code, such as `KeyT` |
| `expanded` | `boolean` | `false` | Keeps the stack open |
| `closeLabel` | `string` | `'Close toast'` | The close buttons' name |

### `ToastProvider`

Keeps the toasts of everything inside it and their timers, in a `ToastStore`. It takes `toastManager`, `timeout`, `limit` and `children`, and reads them on every render: a new manager replaces the old one, and a new limit applies at once. It subscribes to its manager only in the browser, after it mounts, and when it unmounts it stops every timer, unsubscribes, empties its store, and runs each toast's `onRemove` once, but not `onClose`: nobody closed them.

Its descendants read the store with `handle.context.get(ToastProvider)`. This replaces Base UI's `useToastManager()`: the store has the manager's `add`, `update`, `close` and `promise`, which reach only this provider, and `toasts`, newest first. It dispatches `change` after every change, so a component outside the viewport can follow it:

```tsx
function OpenCount(handle: Handle) {
  let store = handle.context.get(ToastProvider)
  store.addEventListener('change', () => handle.update(), { signal: handle.signal })
  return () => <span>{store.toasts.length} open</span>
}
```

### `ToastViewport`

The fixed `<section>` the toasts show in, a region named `Notifications (F6)`. It takes `position`, `label`, `hotkey` and `expanded` as the Toaster does, and every prop of a native `<section>`, including your `mix`. It renders its children again whenever the toasts change, so put your list inside it. Beside it, it renders the two hidden live regions that announce the toasts. A toast without a title or description isn't announced until an update gives it text.

It pauses the timers while a pointer is over the stack, keyboard focus is in it, a pointer presses a toast, the page is hidden, or the window is in the background, and resumes them with the time that was left. Hover and keyboard focus also expand the stack. On a touch screen, a tap expands it until a tap lands outside. It marks itself `data-expanded` and `data-position`, and sets `--toast-frontmost-height`.

### `Toast`

One toast: a `<div>` with `role="dialog"`, or `alertdialog` for high priority, `aria-modal="false"`, named by its title and described by its description. It's focusable. It takes the `toast` object, every prop of a native `<div>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `toast` | `ToastObject` | | The toast from the store |
| `swipeDirection` | `'up' \| 'down' \| 'left' \| 'right'` or a list | toward the edge and the end of the line | The directions a swipe of 40px or more dismisses it in. An empty list turns swiping off. A press on a button, link, form control or an element marked `data-swipe-ignore` never starts a swipe |
| `dismissible` | `boolean` | `true` | Whether Escape and swipes close it |

It renders `data-type`, `data-priority`, `data-front`, `data-expanded`, `data-limited`, `data-ending-style` and `data-swipe-direction`, and the CSS variables `--toast-index`, `--toast-offset-y`, `--toast-height`, `--toast-swipe-movement-x` and `--toast-swipe-movement-y`, as Base UI does. Limited toasts are `inert`. A closing toast takes no pointer, hands focus to the next toast, and then turns `inert` for the rest of its exit, so its buttons can't run.

### Parts

| Part | Renders | Notes |
| --- | --- | --- |
| `ToastContent` | `<div>` | The row of icon, text and buttons. `data-behind` fades it out behind the front toast of a closed stack |
| `ToastTitle` | `<h2>` | The toast's title, or your children. Nothing without either |
| `ToastDescription` | `<p>` | The toast's description, or your children. Nothing without either |
| `ToastAction` | an outline `Button`, size `sm` | Takes the toast's `actionProps`. Their label and props win over yours, as in Base UI. Nothing without a label |
| `ToastClose` | a ghost `Button`, size `icon-sm`, named `Close toast` | Closes its toast. An X unless you give children. Your `mix` runs first, so `event.preventDefault()` keeps the toast open |
| `ToastIcon` | `<span>` with the icon of a known type | Hidden from assistive technology. The error icon is `--destructive`, and the loading ring turns, except for reduced motion |
| `ToastList` | every toast of the provider with the parts above | What the Toaster renders. Takes `closeLabel` |

### Also exported

`toastTypes` and `toastPositions` list the options. `ToastStore`, `applyLimit()`, `layoutToasts()`, `resolvePromiseOption()`, `describeHotkey()` and `matchesHotkey()` are the pure pieces the parts use. The types are `ToastManager`, `ToastOptions`, `ToastUpdate`, `ToastObject`, `ToastPromiseOptions`, `ToastType`, `ToastPriority`, `ToastPosition`, `ToastSwipeDirection`, `ToastCloseReason`, `ToastPauseReason`, `ToastActionProps` and the props of each part.

## Composition

- **Your own list.** Inside a client entry, compose `ToastProvider`, `ToastViewport` and your list, as Base UI's anatomy does. Read `handle.context.get(ToastProvider).toasts` in your list and render a `Toast` with your parts for each, keyed by its id. The toast is named by the element with the title's id, `ToastTitle` by default, or its description's. When you render other content, give that element the title's id from `handle.context.get(Toast).titleId`, as Sonner's custom toasts do, or name the toast with `aria-label`.
- **Several providers.** Give each provider its own manager with `createToastManager()`, or none: a provider without a manager is reached only through context. Two providers given the same manager both show its toasts, as in Base UI. Give each viewport its own label and hotkey.
- **Why the Toaster is an entry.** Remix serializes an entry's props, so the `Toaster` uses the shared `toast` manager and can't take another one from the server. A provider with your own manager goes in your own client entry.
- **No portal.** The viewport is `position: fixed`, so it needs no `ToastPortal`. Render it as the last child of `<body>`, outside any element with a `transform`, which would move its fixed box. A modal dialog makes everything outside it inert, toasts included, as the platform does.
- **Server HTML.** The server renders the empty region and live regions, and no toast: the managers refuse toasts there, so nothing about one request reaches another. Before the Toaster hydrates, `toast.add()` throws.
- **Overrides.** Each part takes your `mix` and attributes. A rule in `@layer app` or a token such as `--popover` restyles every toast.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Toaster`, with the module's `toast` manager | `Toaster`, a client entry, with the module's `toast` manager | The manager holds no toasts; each mounted provider does |
| `toast.add`, `close`, `update`, `promise` (`createToastManager`) | Same methods | `add()` throws when no provider is mounted. `onClose` gets the reason |
| `useToastManager()` | `handle.context.get(ToastProvider)`, a `ToastStore` | Dispatches `change` instead of rendering through a hook |
| `ToastProvider` (`timeout`, `limit`, `toastManager`) | `ToastProvider`, same props | Subscribes in the browser only |
| `ToastPortal` | Not needed | The fixed viewport sits at the end of `<body>` |
| `ToastViewport` (`role="region"`, `aria-live="polite"`, F6) | `ToastViewport` | A region named with its hotkey. Announcements go to two hidden live regions beside it instead of the region itself, so the buttons aren't read out and a render never repeats one. F6 focuses the newest toast instead of the region, so the ring shows |
| `Toast` (`Toast.Root`): roles, Escape, swipe, `inert` when limited, data attributes and CSS variables | `Toast` | Same. `dismissible` is new, for Sonner. Closing toasts take no pointer, hand focus to the next toast, and then turn `inert` until their exit ends |
| `data-starting-style` | CSS `@starting-style` | The entry needs no attribute |
| `ToastContent` (`data-behind`, `data-expanded`) | `ToastContent` | |
| `ToastTitle` (`<h2>`), `ToastDescription` (`<p>`) | Same elements | Labelled through ids the root knows from the toast object |
| `ToastAction` (`actionProps`) | `ToastAction`, `actionProps` as Remix button props | Your handler goes in `mix` instead of `onClick` |
| `ToastClose`, `aria-hidden` while collapsed | `ToastClose`, never hidden | A focusable element must not be `aria-hidden` |
| `ToastIcon` per type, `IconPlaceholder` | `ToastIcon` with RemixCN's icons | |
| `ToastList` (not exported) | `ToastList`, exported | |
| Stacking classes: `--toast-index`, `--peek`, `--scale`, expanded `--offset-y`, swipe exits | The same rules in `css()` | Top positions stack downward. The 500ms transforms derive from `--duration-normal`, so reduced motion makes them 0s |
| `rounded-2xl`, `bg-popover`, `shadow-lg`, `max-w-sm`, `inset-x-4 bottom-4`, `sm:right-4` | `--radius-xl`, `--popover`, `--shadow-lg`, `24rem`, logical insets | C-977's small radii |
| `Toast.Positioner`, `Toast.Arrow`, `positionerProps` (anchored toasts) | Not ported | Neither shadcn's toast nor its docs use them. Anchor a Popover instead |
| Docs: Basic, Types, Action, Promise | `ToastBasic`, `ToastTypes`, `ToastWithAction`, `ToastPromise` | |
| Base UI examples: Undo, Promise, Deduplicated, Custom | `ToastWithAction`, `ToastPromise`, `ToastDeduplicated`, `ToastOwnProvider` | |
| — | `ToastPersistent`, `ToastCloseAll`, `ToastRightToLeft` | An urgent toast that stays, closing all, and right-to-left text |

### Where it looks or works different from shadcn

- **Positions** are logical: `bottom-end` is bottom right in left-to-right text and bottom left in right-to-left text. shadcn only has bottom right.
- **Buttons wrap** below the text on a narrow screen or with large text, instead of squeezing it.
- **The close button stays** in the accessibility tree while the stack is collapsed.
- **No toast before hydration.** `toast.add()` throws instead of keeping the toast for later, so the state never outlives its page.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Each toast is announced once: a status for low priority, an alert for high. Hovering, new data, other toasts and other renders don't repeat it; a new title or description does.
- The region is named with its hotkey. F6 moves focus to the newest toast and back, Escape closes a focused toast, and focus then moves to the next toast or back to where it was.
- Action and close buttons have names, run on Enter and click, and an action never runs on hover, focus or timeout. An action that throws is reported, and the toast and its timer go on.
- Timers pause while a pointer is over the stack or presses a toast, while keyboard focus is in it, while the page is hidden and while the window is in the background. Persistent and loading toasts stay.
- Past the limit, older toasts are hidden and inert until newer ones close.
- Updates to closing toasts, promises that settle after a toast closed, a toast re-added while it closes, and an unmounted provider change nothing else and leave no timer.
- No WCAG 2.2 A or AA violations from axe-core with several toasts open, in both themes. The description is 4.5:1 or more on the toast in both themes.
- The focus ring and the borders show in forced colors.
- Transitions and the loading ring stop for reduced motion.
- The toasts fit a 320px wide screen without scrolling sideways, also with text at 200%.
- In right-to-left text, the start is on the right, and the parts mirror.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested. Live regions vary between them.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- On a short screen with text at 200%, an expanded stack of three toasts can be taller than the window. The older toasts then reach past the edge until newer ones close.
- Toasts that close by themselves are a timing challenge (WCAG 2.2.1). Hover, focus and a hidden page pause them; give anything a person must act on `timeout: 0`.
- This isn't an accessibility certification.
