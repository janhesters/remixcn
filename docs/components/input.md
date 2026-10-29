# Input

A native input for text, email, numbers, dates, times, files and colors.

- Source: `registry/ui/input.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/lib/aria.ts`.
- Examples: `registry/examples/input-example.tsx`. Run them with `bun run field-examples`.
- Upstream: shadcn/ui [`input.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/input.tsx), its [docs](https://ui.shadcn.com/docs/components/base/input), and [Base UI Input](https://base-ui.com/react/components/input).

## Usage

```tsx
import { Input } from '#remixcn/ui/input.tsx'

<Input id="email" name="email" type="email" autocomplete="email" required />
```

## API

### `Input`

An `<input>` that takes every native prop, `mix`, and:

| Prop | Type | What it does |
| --- | --- | --- |
| `type` | `'text' \| 'email' \| 'password' \| 'number' \| 'search' \| 'tel' \| 'url' \| 'date' \| 'datetime-local' \| 'month' \| 'time' \| 'week' \| 'file' \| 'color'` | The native type. Without one, it's a text box. Checkboxes, radios, ranges and buttons have their own components, and a hidden input needs no styles |
| `list` | `string` | The id of a `<datalist>` whose options the browser suggests |

`name`, `value` or `defaultValue`, `required`, `readOnly`, `disabled`, `autocomplete`, `inputMode`, `pattern`, `min`, `max`, `step`, `minLength`, `maxLength`, `placeholder` and `form` pass through. So the browser validates, autofills, suggests, submits and resets the input, also before any script runs. Boolean `aria-*` props are written as `"true"` or `"false"`, so `aria-invalid={true}` reads as invalid in the server HTML too. It renders `data-slot="input"`.

## Composition

- **Labels.** Give it an id and a `FieldLabel for`, or an `aria-label` when no visible text names it.
- **Starting values.** Use `defaultValue` in server-rendered forms. It is the value a form reset returns to, and hydration keeps what the user typed, or the browser filled in, before it. `value` makes the input controlled: Remix puts it back on every change you don't render.
- **Errors.** Set `aria-invalid` and name the error in `aria-describedby`. See [Field](./field.md).
- **Groups.** In a ButtonGroup, an input joins its neighbors and grows; in a Field, it fills a stacked field and takes the room a row leaves.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Base UI `Input` around `<input>` | A native `<input>` | Base UI adds field state hooks; Field leaves that state to the caller |
| `type` passed through | `InputType`: the text-like native types | Choice, range and button types have their own components |
| `h-9`, `px-2.5`, `py-1`, `border-input`, `rounded-md`, `shadow-xs`, `dark:bg-input/30` | Same tokens, with a minimum height | Grows with text at 200% |
| `text-base md:text-sm` | Same, from 48rem | 16px text keeps phones from zooming in on focus |
| `focus-visible:border-ring` with a 3px `ring-ring/50` | Border in `--ring` and the theme's 2px outline | The outline stays in forced colors |
| `aria-invalid:border-destructive` with a ring | `invalidState` | |
| `disabled:opacity-50 cursor-not-allowed` | `disabledState` | |
| `file:` utilities | `::file-selector-button` | |
| Docs: Basic, Invalid, With Label, With Description, Disabled, Input Types, With Button, With Native Select, Form | `InputBasic`, `InputInvalid`, `InputWithLabel`, `InputWithDescription`, `InputDisabled`, `InputTypes`, `InputWithButton`, `InputWithNativeSelect`, `InputForm` | |
| Example: With Select | Not ported here | It waits for Select; `InputWithNativeSelect` shows the native one |
| — | `InputReadOnly`, `InputWithDatalist` | |

## Accessibility checks

Automated: literal ARIA states in the server HTML, native submission, validation, reset and form association, datalist suggestions, values kept across hydration, a changing invalid state, contrast in both themes, a focus ring and border in forced colors, and axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
