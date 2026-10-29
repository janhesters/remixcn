# Native Select

A native select with a chevron, two sizes, option groups, and default or controlled values in the server HTML.

- Source: `registry/ui/native-select.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/aria.ts` and `registry/lib/icons.tsx`.
- Examples: `registry/examples/native-select-example.tsx`. Run them with `bun run field-examples`.
- Upstream: shadcn/ui [`native-select.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/native-select.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/native-select).

## Usage

```tsx
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '#remixcn/ui/native-select.tsx'

<NativeSelect id="country" name="country" defaultValue="ch">
  <NativeSelectOption value="at">Austria</NativeSelectOption>
  <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
</NativeSelect>
```

## API

### `NativeSelect`

A `<div data-slot="native-select-wrapper">` around a native `<select data-slot="native-select">` and a chevron that assistive technology skips and clicks pass through. The browser draws the list, so it works with the keyboard, on touch screens and before any script runs.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | `'sm' \| 'default'` | `'default'` | 2rem or 2.25rem tall. It replaces the native `size` attribute, as in shadcn |
| `defaultValue` | `string \| readonly string[]` | | The starting choice. Its option is selected in the server HTML, and a form reset returns to it |
| `value` | `string \| readonly string[]` | | The controlled choice. Every render selects its options, and the select returns to it after a change the owner doesn't take, single or multiple |
| `mix`, `class`, `style` | | | Go to the wrapper, which sizes the select, as shadcn's `className` does |

Every other prop goes to the `<select>`: `id`, `name`, `required`, `disabled`, `multiple`, `autocomplete`, `form`, `aria-*` and event handlers. Boolean `aria-*` props are written as `"true"` or `"false"`. Change events bubble, so `mix={on('change', …)}` on the wrapper hears them. Both elements render `data-size`.

### `NativeSelectOption`

An `<option>`. Inside a NativeSelect with a `value` or `defaultValue`, it is selected when its `value` matches, or its text without one. Its own `selected` wins. It takes the system colors `Canvas` and `CanvasText`, so the browser's list stays readable in either scheme.

### `NativeSelectOptGroup`

An `<optgroup>` with a `label`.

## Composition

- **Values.** Remix's server writes no selected option for `<select value>` or `defaultValue`. NativeSelect writes them on the options, so the page shows the right choice before any script runs. In the browser, a default is written only when it differs from the server's, so hydration keeps a choice the user, or the browser's form restore, made before it. A `defaultValue` changed later writes the options' `selected` attributes again, which the browser shows unless the user picked that option.
- **Width.** The wrapper is as wide as the select's text. It fills a stacked Field, and `class` or a `css()` mixin sizes it anywhere else.
- **Errors.** Set `aria-invalid` and name the error in `aria-describedby`. A disabled select dims through its wrapper.
- **Multiple.** `multiple` shows a list box. The chevron hides, since there is no menu to open.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Wrapper `div` with `className`, `<select>` with the other props | Same; `mix`, `class` and `style` go to the wrapper | |
| `size: 'sm' \| 'default'`, `data-size` | Same | |
| `IconPlaceholder` with an icon library's chevron | RemixCN's `ChevronDownIcon` | Placed with logical properties, so it sits at the start of the line in right-to-left text |
| `appearance-none`, `pr-8 pl-2.5`, `h-9` / `h-8`, `shadow-xs`, `dark:bg-input/30`, `dark:hover:bg-input/50` | Same tokens, with minimum heights | |
| `has-[select:disabled]:opacity-50` | Same | The select's own disabled dimming is undone, so it isn't dimmed twice |
| `focus-visible:ring`, `aria-invalid:border-destructive` | The theme's outline, `invalidState` | |
| `NativeSelectOption`, `NativeSelectOptGroup` with `bg-[Canvas] text-[CanvasText]` | Same | Options also read the select's value |
| React's `value` and `defaultValue` on `<select>` | `value` and `defaultValue` written on the options | Works in server HTML |
| Docs: Basic, With Groups, Sizes, With Field, Disabled, Invalid | `NativeSelectBasic`, `NativeSelectWithGroups`, `NativeSelectSizes`, `NativeSelectWithField`, `NativeSelectDisabled`, `NativeSelectInvalid` | |
| — | `NativeSelectControlled` | A controlled value that the text follows |

## Accessibility checks

Automated: the selected option in the server HTML for defaults, controlled and multiple values; reset; a choice made before hydration stays; a controlled value returns when the owner declines a change; form association; the chevron takes no clicks and mirrors in right-to-left text; a focus ring, border and chevron in forced colors; and axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
