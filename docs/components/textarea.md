# Textarea

A native textarea that grows with its text where the browser supports it.

- Source: `registry/ui/textarea.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/lib/aria.ts`.
- Examples: `registry/examples/textarea-example.tsx`. Run them with `bun run field-examples`.
- Upstream: shadcn/ui [`textarea.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/textarea.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/textarea).

## Usage

```tsx
import { Textarea } from '#remixcn/ui/textarea.tsx'

<Textarea id="note" name="note" maxLength={500} defaultValue="Thanks for your order." />
```

## API

### `Textarea`

A `<textarea>` that takes every native prop and `mix`: `name`, `value` or `defaultValue`, `rows`, `required`, `readOnly`, `disabled`, `minLength`, `maxLength`, `autocomplete`, `form` and the rest. The server writes `defaultValue` as the textarea's escaped text, which a form reset returns to. Boolean `aria-*` props are written as `"true"` or `"false"`. It renders `data-slot="textarea"`.

It is at least 4rem tall and grows with its text where the browser supports `field-sizing: content`; elsewhere it keeps its rows. The user may resize it up and down, never sideways.

## Composition

- Use `defaultValue` in server-rendered forms, so hydration keeps what the user typed before it.
- Set `aria-invalid` and name the error in `aria-describedby`. See [Field](./field.md).
- The HTML parser drops a newline that starts a textarea's text, and Remix's server writes the text as it is. Start a `defaultValue` with the text, not with a line break.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `field-sizing-content min-h-16 w-full` | Same | A browser without `field-sizing` keeps the rows |
| `px-2.5 py-2`, `border-input`, `rounded-md`, `shadow-xs`, `dark:bg-input/30`, `text-base md:text-sm` | Same tokens | |
| Tailwind's preflight `resize: vertical` | Same | |
| `focus-visible:ring`, `aria-invalid:border-destructive`, `disabled:opacity-50` | The theme's outline, `invalidState`, `disabledState` | |
| Docs: Basic, Invalid, With Label, With Description, Disabled | `TextareaBasic`, `TextareaInvalid`, `TextareaWithLabel`, `TextareaWithDescription`, `TextareaDisabled` | |

## Accessibility checks

Automated: escaped text and literal ARIA states in the server HTML, native submission, validation, reset and form association, values kept across hydration, growth with its text where supported, contrast in both themes, a border and focus ring in forced colors, and axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
