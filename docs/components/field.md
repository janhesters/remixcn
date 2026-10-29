# Field

Native fieldsets, legends, labels, descriptions, separators and error alerts that lay out a form control with its label and messages, stacked, in a row or responsive.

- Source: `registry/ui/field.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/icons.tsx`, `registry/ui/label.tsx` and `registry/ui/separator.tsx`.
- Examples: `registry/examples/field-example.tsx`. Run them with `bun run field-examples`.
- Upstream: shadcn/ui [`field.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/field.tsx), its [docs](https://ui.shadcn.com/docs/components/base/field), and [Base UI Field](https://base-ui.com/react/components/field) for the behavior it describes.

## Usage

```tsx
import { describedBy, Field, FieldDescription, FieldError, fieldErrorMessages, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'

let invalid = fieldErrorMessages(errors.email).length > 0

<Field invalid={invalid}>
  <FieldLabel for="email">Billing email</FieldLabel>
  <Input
    id="email"
    name="email"
    type="email"
    required
    aria-invalid={invalid}
    aria-describedby={describedBy('email-hint', invalid && 'email-error')}
  />
  <FieldDescription id="email-hint">The invoice and its reminders go here.</FieldDescription>
  <FieldError id="email-error" errors={errors.email} />
</Field>
```

## What Field does and doesn't do

Field lays out and labels. The native elements carry the semantics: `<fieldset>` and `<legend>` group choices, `<label for>` names a control, and the controls validate, submit and reset themselves, also before any script runs.

Field never adds a `<form>`, an id, a validation state or a submission of its own. The caller owns them:

- **Ids.** Give each control, description and error an id that stays the same on the server and in the browser, and wire them with `for`, `aria-describedby` and `aria-labelledby`. Don't derive them from `handle.id`, which differs between the two.
- **State.** Set `invalid` on the Field and `aria-invalid` on the control together, from the same messages: `fieldErrorMessages()` returns the messages `FieldError` shows, so `invalid` is true exactly when an error renders.
- **References.** `describedBy()` joins only the ids of messages that are shown, so a cleared error never leaves `aria-describedby` pointing at a missing element.

## API

Every part takes the native props of its element and `mix`. Each renders shadcn's `data-slot`.

### `FieldSet`

A `<fieldset>` that stacks its fields. `disabled` disables every control inside it, natively. Its minimum width is 0, so it reflows on a narrow screen.

### `FieldLegend`

A `<legend>` that names its FieldSet. Make it the fieldset's first child.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'legend' \| 'label'` | `'legend'` | A section heading, or the look of a field label for a group of choices |

### `FieldGroup`

A `<div>` that stacks fields. It is the container that responsive fields measure. A `data-slot="checkbox-group"` you pass tightens its gap, as in shadcn.

### `Field`

A `<div role="group">`. Name the group with `aria-labelledby` when it helps; a group without a name is skipped by screen readers.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `orientation` | `'vertical' \| 'horizontal' \| 'responsive'` | `'vertical'` | Stacks the parts, puts them in a row, or stacks them until its FieldGroup is 28rem wide |
| `invalid` | `boolean` | | Colors the field red. Writes `data-invalid="true"` |
| `disabled` | `boolean` | | Dims the field. Writes `data-disabled="true"`. Disable the control itself too |

shadcn's `data-invalid` and `data-disabled` work as well and are written as `"true"`. False leaves the attribute out.

### `FieldContent`

A `<div>` that stacks a label and its description beside a control in a row.

### `FieldLabel`

A [Label](./label.md) for a field's control. Around a whole `Field` with a checkbox or radio, it is a choice card: a bordered box that is one large target, with a hover tint, a focus ring and a tint while its control is checked.

### `FieldTitle`

A `<div>` that looks like a label but names nothing, such as the title of a choice card. It keeps shadcn's `data-slot="field-label"`, so it lays out like a label. Name the control with `aria-labelledby` pointing at it.

### `FieldDescription`

A `<p>` of help text. Give it an id and name it in the control's `aria-describedby`.

### `FieldSeparator`

A meaningful [Separator](./separator.md) line between fields, with optional text such as "Or continue with" between two lines. `data-content` is `"true"` when it has text; empty or blank children count as none.

### `FieldError`

A `<div role="alert">` with an icon and the message, or nothing at all.

| Prop | Type | What it does |
| --- | --- | --- |
| `errors` | `ReadonlyArray<{ message?: string \| null } \| null \| undefined>` | Validation issues, such as a Standard Schema result's issues. It shows their messages trimmed, once each, in the order they first appear: one as text, several as a list |
| `children` | | Shown instead of `errors` when they hold text. Empty elements and fragments, such as `<span> </span>`, don't count, however deep, so a styled reason whose text clears falls back to `errors` or renders nothing. A component counts, since its text is unknown until it renders |

Without a message it renders nothing, so an empty alert never exists. Messages are text, so the renderer escapes them.

### `fieldErrorMessages(errors)`

Returns the messages `FieldError` would show. Use it to set `invalid` and `aria-invalid`.

### `describedBy(...ids)`

Joins the ids it gets, once each, skipping `false`, `null`, `undefined` and blank ones. Returns `undefined` without ids, so the attribute goes away.

## Composition

- **Layout in a row.** A horizontal field, and a responsive one from 28rem, puts its parts in a row. Beside an input, textarea or select, the text and the control share the row evenly, so the controls of several rows line up; each keeps at least 8rem, and the row wraps before either gets narrower, so a narrow screen never scrolls sideways. Beside a checkbox or radio, the text stays on its line. Controls lay themselves out with `fieldItem` from `styles.ts`; merge it into your own control's `css()` to join in.
- **Choices.** Group checkboxes and radios in a `FieldSet` with a `FieldLegend variant="label"`. A [Radio Group](./controls.md) gives its radios one `name`, so arrow keys move the choice and the group is one Tab stop. A Field recognizes a native checkbox or radio, or the wrapper of Checkbox, Switch and RadioGroupItem, and keeps it beside its label at any width.
- **Choice cards.** Wrap a horizontal `Field` in a `FieldLabel`. The label's content becomes the control's name, so point the control's `aria-labelledby` at its `FieldTitle` and `aria-describedby` at its `FieldDescription`. A `<label>` may hold only phrasing content by the HTML standard; browsers handle the `<div>`s inside it, as in shadcn, but a validator reports them.
- **Errors for a group.** Put the `FieldError` in the `FieldSet` and name it in the fieldset's `aria-describedby`.
- **Errors for the whole form.** A refused save or a lost connection isn't a field's fault. Show it in an [Alert](./alert.md) and name it in the form's `aria-describedby`, and mark no field invalid. The invoice example does this.

### Validation on the server and in the browser

React forms validate with hooks. A Remix form validates natively, and the examples show the whole loop:

1. Native attributes, such as `required`, `type="email"` and `min`, make the browser check the form before it sends it, also without JavaScript.
2. The server checks again and adds its own rules. It renders the page with `values`, field `errors` and a `formError`, so the server HTML already holds `aria-invalid="true"`, the error ids and `autofocus` on the first field it rejected.
3. Once hydrated, a client entry listens for `invalid` in the capture phase, calls `preventDefault()` to replace the browser's bubble with a `FieldError`, focuses the first invalid field, and clears an error on `input` as soon as `validity.valid`.

See `FieldInvoiceForm` in the examples and `validateInvoice` in `test/fixtures/field/server.tsx`.

### Fields that come and go

Give each row an id when it is created, from a counter that never reuses one, as `FieldRecipients` does. Removing a row then never moves another row's error or description onto it. Move focus to the new row, or to the Add button when a row goes away.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `FieldSet`, `FieldLegend` with `variant` | Same | The fieldset's minimum width is 0 |
| `FieldGroup` with `@container/field-group` | Same, `container-name: field-group` | A `data-slot="checkbox-group"` tightens the gap; a nested group gets gap 4 |
| `Field` with `role="group"`, `orientation`, `fieldVariants` | Same parts and orientations | Rows wrap when they can't fit, with 8rem floors, instead of overflowing. The `*:w-full` and `*:data-[slot=field-label]:flex-auto` child selectors move into each part's own rule (`fieldItem`), because Remix orders `css()` rules by where they first render |
| `data-invalid`, `data-disabled` | `invalid` and `disabled` props, which write `"true"` | shadcn's attributes still work |
| `FieldContent`, `FieldTitle` (`data-slot="field-label"`), `FieldDescription` | Same | Long words break |
| `FieldLabel` with `has-data-checked` tints and a ring | Same, with `:has(input:checked)` and a 2px outline | The ring is an outline, so it stays in forced colors |
| `FieldSeparator` with an absolute line behind text on `bg-background` | A flex row: the Separator line, the text, and a decorative line after it | No background, so it fits any surface |
| `FieldError` with `errors`, `useMemo`, a `Map` dedupe | `fieldErrorMessages()`, computed each render | Messages are trimmed and blank ones dropped. One message isn't wrapped in a list. An icon starts the message, so the error doesn't rely on color |
| — | `describedBy()` | Keeps `aria-describedby` free of missing ids |
| Example: Input, Textarea, Native Select, Checkbox, Radio, Switch, Slider, Horizontal Fields | `FieldInputs`, `FieldTextareas`, `FieldNativeSelects`, `FieldCheckboxes`, `FieldRadios`, `FieldSwitches`, `FieldSliders`, `FieldHorizontal` | With RemixCN's Checkbox, Radio Group, Switch and Slider |
| Example: Select, OTP Input Fields | Not ported here | They wait for the Select and Input OTP ports |
| — | `FieldResponsive`, `FieldSignIn`, `FieldInvoiceForm`, `FieldRecipients` | Responsive rows, the separator, server and browser validation with a form-level error, and changing fields |

## Accessibility checks

Automated (`bun run test`, `test:browser`, `test:e2e`):

- Server HTML: native fieldsets, legends and labels; `aria-invalid` is always `"true"` or `"false"`; `data-invalid` and `data-disabled` are `"true"` or absent; no empty alert; every id is unique and every `for`, `aria-describedby`, `aria-labelledby`, `list` and `form` reference exists.
- Errors appear, list, clear and move between several changing fields without empty alerts, false invalid flags or stale references. Rows added and removed keep their own ids.
- A click on a label or anywhere on a choice card focuses or toggles its control. Field sets name their radio groups. Tab follows the document order, skips disabled fields and stops on read-only ones.
- Validation works without JavaScript, from the server's HTML, and once hydrated, with focus on the first invalid field. A refused save marks no field invalid.
- Labels, legends, descriptions, errors and values are 4.5:1 or more in both themes; focus rings, borders, separators and the chevron stay visible in forced colors; transitions take 0s with reduced motion; rows mirror in right-to-left text; the page fits 320px with text at 200%; and it passes axe-core's WCAG 2.2 A and AA rules in both color schemes.

Not checked, so not claimed: screen readers weren't run, so how each announces an alert that appears with its text is untested. Forced colors were emulated in Chromium and Firefox only. This isn't an accessibility certification.
