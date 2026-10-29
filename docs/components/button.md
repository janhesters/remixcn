# Button

A native `<button>` with shadcn's variants and sizes, and `buttonVariants()` to give a native link or any other element the same look.

- Source: `registry/ui/button.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/button-example.tsx`. Run them with `bun run button-examples`.
- Upstream: shadcn/ui [`button.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/button.tsx), its [docs](https://ui.shadcn.com/docs/components/base/button), and [Base UI Button](https://base-ui.com/react/components/button.md).

## Usage

```tsx
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'

<Button variant="outline">Archive</Button>
<Button type="submit" name="intent" value="send">Send reminder</Button>
<a href="/invoices" mix={buttonVariants({ variant: 'outline' })}>View invoices</a>
```

## API

### `Button`

Takes every prop of a native `<button>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'outline' \| 'secondary' \| 'ghost' \| 'destructive' \| 'link'` | `'default'` | The look |
| `size` | `'default' \| 'xs' \| 'sm' \| 'lg' \| 'icon' \| 'icon-xs' \| 'icon-sm' \| 'icon-lg'` | `'default'` | Height and padding. The icon sizes are squares for an icon without text |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Only `submit` and `reset` touch a form, so a button in a form never submits it by accident |
| `focusableWhenDisabled` | `boolean` | `false` | Keeps a disabled button focusable while it runs in the browser, for a loading state |
| `mix` | mixins | | Your `on()`, `ref()`, `css()` and other mixins. They all reach the native button |

The button renders `data-slot="button"`, `data-variant` and `data-size`, so an app rule can target one variant.

`disabled` disables the button natively. With `focusableWhenDisabled`, or when you mark it `aria-disabled="true"` yourself, a disabled button stays in the tab order while it runs in the browser: it renders `aria-disabled="true"` instead and cancels its clicks before your handlers run, so it neither submits, resets nor calls them.

Button runs in the browser inside a client entry, like any component that handles events. It isn't a client entry itself, because your mixins can't cross from the server to the browser: Remix serializes an entry's props to JSON. So before hydration, and on a page that only renders on the server, a disabled or aria-disabled button is disabled natively. It never submits there, but it leaves the tab order. That's fine on a static page, where nothing changes the disabled state while a button has focus.

### `buttonVariants(options?)`

Returns the mixins that give any element a button's look, plus `data-slot`, `data-variant` and `data-size`. Takes `{ variant, size }`. Put it in `mix`, alone or in an array.

### Also exported

`buttonVariantNames` and `buttonSizes` list the options. `ButtonVariant`, `ButtonSize`, `ButtonVariantOptions` and `ButtonProps` are the types.

## Composition

- **Links.** Use `buttonVariants()` on a native `<a href>`. It keeps its link role, opens in a new tab with a modifier key, and works without JavaScript. Don't render a link through `Button`.
- **Icons.** Put an icon before or after the label and mark it with `data-icon="inline-start"` or `"inline-end"`, which the RemixCN icons accept. The button then tightens the padding on that side. Mirror an arrow that points onward with `mirrorInRtl` from `styles.ts`, for example `mix={css({ '& svg': mirrorInRtl })}`.
- **Icon only.** Name the action with `aria-label`, such as `aria-label="Delete invoice INV-0042"`. The icons hide themselves from assistive technology.
- **Forms.** Set `type="submit"` with `name` and `value` to tell the server which button sent the form. `formAction`, `formMethod` and `formNoValidate` override the form for that button. `type="reset"` restores the defaults.
- **Loading.** Set `disabled` and `focusableWhenDisabled` while it works, so focus stays on the button. Base UI suggests naming the button through `aria-labelledby` with the changing label, and a `role="status"` message says when it's done. The Loading example shows it.
- **Disabled.** Say why in text next to the button, and point `aria-describedby` at it.
- **Overrides.** A `css()` you pass with `mix` renders after the button's own rule, so it wins. A token such as `--primary` on an ancestor reaches every button inside. A rule in `@layer app` beats every component rule.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Button` on Base UI's `Button` | `Button`, a native `<button>` | |
| Base UI's default `type="button"` | Same default | Base UI's usage guidelines ask for an explicit `type="submit"` too |
| `disabled` | Native `disabled` | |
| `focusableWhenDisabled` | Same prop | Base UI sets `aria-disabled` and skips your handlers. RemixCN does so while it runs in the browser and cancels the click, which also stops submit and reset. A button you mark `aria-disabled` behaves the same. Before hydration, and outside a client entry, both are natively disabled |
| `render` and `nativeButton={false}` | Not ported | `buttonVariants()` on the native element replaces them. shadcn's docs advise against rendering links through Button, because Base UI adds `role="button"` |
| `buttonVariants` (cva class names) | `buttonVariants()`, returning mixins | Adds the data attributes, so a link in a Button Group joins its neighbors |
| Variants and sizes in `style-vega.css` | Same names and measures | Tailwind classes become theme tokens, such as `h-9` to `calc(var(--spacing) * 9)` |
| `focus-visible:ring-3` | The theme's 2px outline in `--ring` | Stays visible in forced colors. Destructive buttons draw it in `--destructive` |
| `aria-invalid:border-destructive` | `invalidState` from `styles.ts` | |
| `disabled:opacity-50 disabled:pointer-events-none` | `disabledState` from `styles.ts` | Dims `aria-disabled` too and shows the not-allowed cursor |
| `active:not-aria-[haspopup]:translate-y-px` | Same, skipped while disabled | |
| `aria-expanded:bg-muted` and friends | Same | For menu and popover triggers in later batches |
| `[&_svg]` sizing, `has-data-[icon=…]` padding | Same | |
| `in-data-[slot=button-group]:rounded-md` | Same, through an ancestor selector in the button's own rule | |
| `dark:` colors | `light-dark()` | So `data-theme` picks them too, not only the system preference |
| Docs: Size, Default, Outline, Secondary, Ghost, Destructive, Link, Icon, With Icon, Invalid | `ButtonVariantsAndSizes`, `ButtonWithIcons`, `ButtonIconOnly`, `ButtonInvalid` | |
| Docs: Rounded | `ButtonOverrides` | A caller `css()` instead of the `rounded-full` class |
| Docs: Spinner | `ButtonLoading` | Draws its own ring. Spinner is ported with its own ticket |
| Docs: As Link | `ButtonAsLink` | |
| Docs: RTL | The fixture's Direction section | |
| Docs: Button Group | See `button-group.md` | |
| Docs: Cursor | Not needed | Buttons show the pointer cursor, as in the style reference |
| — | `ButtonForm`, `ButtonDisabled` | Submit, reset and action buttons, and disabled buttons with a reason |

### Where it looks different from shadcn

- **Destructive text** mixes a quarter of `--foreground` into the red. shadcn's red on its own red tint is 4.15:1 in light mode and 4.35:1 on hover in dark mode, below 4.5:1.
- **Long labels wrap** instead of overflowing, but only when the button would be wider than its container. A button never grows past its container, and the text sizes use a minimum height instead of a fixed one.
- **A focused aria-disabled button** draws its ring in `--foreground`, because half opacity would fade the usual ring to about 1.9:1.
- **In forced colors**, an aria-disabled button turns `GrayText`, as a natively disabled one does.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- A button in a form doesn't submit it; a submit button sends its name and value; `formAction`, `formMethod` and `formNoValidate` reach the server; a reset button resets.
- Enter and Space activate buttons; Enter follows a link; a native disabled button ignores clicks.
- Without JavaScript, forms still submit, and a `focusableWhenDisabled` button is natively disabled.
- Rendered by a server-only page, outside any client entry, `aria-disabled` and `focusableWhenDisabled` buttons stay natively disabled after hydration and don't submit.
- A focused button that turns disabled or aria-disabled keeps its focus and never passes through native `disabled`.
- A loading button keeps focus, cancels repeated clicks, and announces when it's done.
- Every button and link on the example page has a name; icons inside buttons are hidden.
- Text is 4.5:1 or more in every variant, at rest and on hover, in both themes. A focused aria-disabled button's ring is 3:1 or more in both themes.
- The focus ring shows, also in forced colors.
- Transitions and the loading ring stop for reduced motion.
- The page fits 320px without scrolling sideways, with normal text and at 200%.
- Arrows, padding and joins mirror in right-to-left text.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- Touch targets: the `xs` and `icon-xs` sizes are 24px tall, the WCAG 2.2 AA minimum. Use larger sizes for touch-first screens.
- This isn't an accessibility certification.
