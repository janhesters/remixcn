# Label

A native label that names its control and dims with a disabled one.

- Source: `registry/ui/label.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/label-example.tsx`. Run them with `bun run field-examples`.
- Upstream: shadcn/ui [`label.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/label.tsx), its [docs](https://ui.shadcn.com/docs/components/base/label), and [Base UI Label](https://base-ui.com/react/components/label.md).

## Usage

```tsx
import { Label } from '#remixcn/ui/label.tsx'

<Label for="username">Username</Label>
<Input id="username" name="username" />
```

## API

### `Label`

A `<label>` that takes every native prop and `mix`. `for` and shadcn's `htmlFor` both point it at a control's id. It renders `data-slot="label"`.

It dims to half opacity right after a disabled control, around one, inside a disabled `<fieldset>`, and inside a `Field` marked `disabled`.

## Composition

- Point `for` at the control's id, or put the control inside the label. Either way a click focuses or toggles the control, and the label's text names it.
- Inside a Field, use [FieldLabel](./field.md), which adds the field's layout and choice cards.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `<label>` with `flex items-center gap-2 text-sm leading-none font-medium select-none` | Same | Long words break |
| `peer-disabled:opacity-50 cursor-not-allowed` | Right after a disabled control, or around one | Tailwind's `peer` class becomes the `+` and `:has()` selectors |
| `group-data-[disabled=true]:opacity-50 pointer-events-none` | Inside a `Field` with `data-disabled="true"` | Also inside a disabled `<fieldset>` |
| Docs: With Checkbox, With Input, Disabled, With Textarea | `LabelWithCheckbox`, `LabelWithInput`, `LabelDisabled`, `LabelWithTextarea` | With RemixCN's Checkbox |

## Accessibility checks

Automated: a click focuses or toggles the control through `for` or by wrapping it, labels name their controls in the browser's accessibility tree, the dimmed states, and axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
