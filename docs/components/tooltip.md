# Tooltip

A short description of its trigger. Hover and keyboard focus open it, Escape and a press elsewhere close it, and touch never opens it. The trigger's `aria-describedby` points at the tooltip's text, which stays in the document while hidden, so the description works before any script runs and while the tooltip is closed.

- Source: `registry/ui/tooltip.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `layer.ts`, `anchor-position.ts` and `hover-intent.ts`.
- Examples: `registry/examples/tooltip-example.tsx`. Run them with `bun run overlays`.
- Upstream: shadcn/ui [`tooltip.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/tooltip.tsx), its [docs](https://ui.shadcn.com/docs/components/base/tooltip), and [Base UI Tooltip](https://base-ui.com/react/components/tooltip.md).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from '#remixcn/ui/tooltip.tsx'

<Tooltip>
  <TooltipTrigger mix={buttonVariants({ variant: 'outline' })}>Archive</TooltipTrigger>
  <TooltipContent>Moves the invoice to the archive</TooltipContent>
</Tooltip>
```

The parts run in the browser inside your client entry, like Button. shadcn asks for a `TooltipProvider` around the app; here it's optional, and goes inside your client entry when you want one.

## API

### `TooltipProvider`

Shares delays among the tooltips inside it, and opens the next one at once while one is open or just closed. Tooltips outside a provider share one group with the same defaults.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `delay` | `number` | `0` | Milliseconds before a tooltip opens on hover, as shadcn's provider sets it |
| `closeDelay` | `number` | `0` | Milliseconds before it closes once the pointer has left |
| `timeout` | `number` | `400` | The next tooltip opens at once if the last one closed less than this ago |

### `Tooltip`

Groups the parts and holds whether the tooltip is open. It renders no element.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | Whether it's open, for a tooltip you control |
| `defaultOpen` | `boolean` | `false` | Whether it starts open |
| `disabled` | `boolean` | `false` | Whether hover and focus leave it closed. A disabled tooltip closes, and its trigger renders `data-trigger-disabled` |
| `disableHoverablePopup` | `boolean` | `false` | Whether it closes as the pointer leaves the trigger, instead of staying while the pointer is on it |

### `TooltipTrigger` and `tooltipTrigger()`

`TooltipTrigger` is a native `<button type="button">` that takes every button prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `delay` | `number` | the provider's `delay` | Milliseconds before it opens on hover. Keyboard focus opens it at once |
| `closeDelay` | `number` | the provider's `closeDelay` | Milliseconds before it closes once the pointer has left |
| `closeOnClick` | `boolean` | `true` | Whether a click closes it until the pointer or focus comes back |
| `describe` | `boolean` | `true` | Whether the trigger's `aria-describedby` points at the tooltip. Turn it off when the tooltip only shows the trigger's own name, as a sidebar collapsed to icons does, so screen readers don't hear it twice |

`tooltipTrigger({ delay, closeDelay, closeOnClick, describe })` makes any focusable element the trigger, such as a link or a Button that stays focusable while disabled: `<Button disabled focusableWhenDisabled mix={tooltipTrigger()}>`. It adds the tooltip's id to the element's `aria-describedby`, keeping yours, and renders `data-popup-open` while open. `disabled` on `TooltipTrigger` disables the native button; disable the tooltip with `Tooltip`'s `disabled`.

### `TooltipContent`

The tooltip, a `<div role="tooltip">` in the top layer with an arrow that points at the trigger. It takes every `div` prop, `mix`, and the placement props of [`PopoverContent`](popover.md#popovercontent), with `side` defaulting to `'top'`, `sideOffset` to `4` and `alignOffset` to `0`. It's as wide as its text, up to 20rem and the room on screen.

Keep it to text. A tooltip only describes its trigger, and nothing in it can take focus; use a Popover for links or buttons.

### `TooltipOpenChangeEvent`

Dispatched on the content before the tooltip opens or closes, with `open`, `reason` and `cause`. Cancelable, and it doesn't bubble. `reason` is `'trigger-hover'`, `'trigger-focus'`, `'trigger-press'`, `'focus-out'`, `'escape-key'`, `'outside-press'`, `'parent-dismissed'`, `'trigger-removed'`, or `'none'` when another tooltip of its group opened. Also exported: `tooltipOpenChangeType` and the types.

## Composition

- **Icon buttons.** Name the action with `aria-label`; the tooltip describes it. Don't repeat the name in the tooltip.
- **Disabled buttons.** Use `focusableWhenDisabled` on a Button with `tooltipTrigger()`, so keyboard users reach the tooltip that says why. shadcn wraps the button in a span instead, which keyboard focus never reaches.
- **Links.** Put `tooltipTrigger()` on a native link. It navigates as always, also on the first tap.
- **Hovering the tooltip.** The pointer can move onto the tooltip without closing it, as WCAG 1.4.13 asks, unless `disableHoverablePopup` is set.
- **Inside a popover.** Escape closes the tooltip first.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `TooltipProvider` on `Tooltip.Provider`, with shadcn's `delay={0}` | `TooltipProvider` | Optional: tooltips outside one share a default group |
| Provider `delay`, `closeDelay`, `timeout` | Same | |
| `Tooltip` on `Tooltip.Root` | `Tooltip` | `open`, `defaultOpen`, `disabled`, `disableHoverablePopup` |
| Root `onOpenChange` | `TooltipOpenChangeEvent` on the content | |
| Root `trackCursorAxis` | Not ported | It follows its trigger |
| Root `actionsRef`, `onOpenChangeComplete`, `handle`, `triggerId`, `defaultTriggerId`, Trigger `payload` | Not ported | One trigger per tooltip, no exit animation |
| `TooltipTrigger` on `Tooltip.Trigger` | `TooltipTrigger` and `tooltipTrigger()` | `tooltipTrigger()` replaces `render` |
| Trigger `delay`, `closeDelay`, `closeOnClick` | Same | Defaults come from the provider |
| Trigger `disabled` | `Tooltip`'s `disabled` | On `TooltipTrigger`, `disabled` is the native button's |
| `data-popup-open`, `data-trigger-disabled` | Same | |
| `TooltipContent` on `Portal`, `Positioner`, `Popup` and `Arrow` | `TooltipContent`, a native popover with its arrow | Same placement props and defaults as shadcn |
| Arrow's position from Floating UI | `--anchor-center-x` and `--anchor-center-y` from `anchor-position.ts` | It points at the trigger's center, 10px from the corners. `data-uncentered` isn't ported |
| `aria-describedby` while open | `aria-describedby` at all times | The hidden text still describes the trigger. `describe: false` leaves it out for a tooltip that repeats the trigger's name |
| Classes in `style-vega.css` | Same measures and colors, and the tighter end padding around a Kbd | An outline in `CanvasText` draws the edge in forced colors, where the arrow hides |
| Fade and zoom | A fade in | As in Popover |
| Docs: Side, With Keyboard Shortcut, Disabled Button, RTL | `TooltipSides`, `TooltipWithKeyboard`, `TooltipDisabled`, the fixture's right-to-left section | `TooltipWithKeyboard` shows the shortcut with Kbd |
| Examples: Basic, With Icon, Long Content, On Link, Formatted | `TooltipBasic`, `TooltipWithIcon`, `TooltipLongContent`, `TooltipOnLink`, `TooltipFormatted` | |
| — | `TooltipToolbar` | A provider with a delay: the next tooltip opens at once |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit:

- The trigger's `aria-describedby` names the tooltip's text in the server HTML, with and without JavaScript, keeping the caller's own descriptions and only those with `describe: false`, and follows the content's `id` as it changes, also inside your own component; the content has `role="tooltip"` and a hidden arrow.
- Hover opens it after its delay, not when the pointer leaves first; keyboard focus opens it at once, also while a hover delay runs; Escape closes it with focus kept, and it reopens only when focus or the pointer comes back.
- The pointer can cross to the tooltip and rest on it, unless it isn't hoverable; a click on the trigger and a press elsewhere close it.
- The provider opens the next tooltip at once and closes the one before.
- A disabled tooltip stays closed; a focusable disabled Button shows its tooltip on keyboard focus.
- Touch opens nothing, and a link trigger follows the first tap.
- Its trigger removed while open closes it; a delay running when it unmounts opens nothing.
- It shows in full inside a box that clips its overflow; its arrow points at the trigger when it shifts from the edge; inline sides mirror in right-to-left text.
- axe-core finds no WCAG 2.2 A or AA violation with one open, in both themes; its edge is drawn in `CanvasText` in forced colors.

Not checked, so not claimed:

- Screen readers weren't tested.
- Safari itself and Windows forced colors weren't tested.
- This isn't an accessibility certification.
