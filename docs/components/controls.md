# Checkbox, Radio Group, Switch, Toggle and Toggle Group

These five catalog entries port shadcn/ui's Base UI components at the pinned commit to Remix 3 with native HTML. This page is their API reference, their composition notes, and their source and behavior map: what each upstream prop and behavior became, and what RemixCN leaves out and why.

Each entry's copyable examples live in `registry/examples/<name>-example.tsx`, after shadcn's example of the same name. `bun run controls` serves them all on one page (http://localhost:4403/), and `bun run capture:controls` writes the screenshots in `docs/images/controls/`.

## How they run

| Entry | Element | Works without JavaScript |
| --- | --- | --- |
| Checkbox | `<input type="checkbox">` | Yes, except the mixed state |
| Radio Group | `<div role="radiogroup">` around `<input type="radio">` with one name | Yes |
| Switch | `<input type="checkbox" role="switch">` | Yes |
| Toggle | `<button type="button" aria-pressed="true|false">` | Renders its state, but changes it only in the browser |
| Toggle Group | `<div role="group">` around toggle buttons | Renders its state, but changes it and moves focus only in the browser |

Checkboxes, radios and switches are native form controls. Labels, Space, the radio arrow keys, `name`, `value`, `form`, `required`, `disabled`, form submission and form reset all come from the browser. Their components handle no events, so they need no client entry.

Toggle and Toggle Group handle clicks and keys, so they work once the browser runs them: inside a client entry of your app, as the examples are. They aren't client entries themselves, for two reasons found in `remix@3.0.0`:

- A client entry's props must serialize to JSON. Mixins and handlers don't, so an entry couldn't take the caller's `mix`.
- The server renders the component children of a client entry to static HTML before it serializes them. A Toggle Group entry would hydrate with frozen items. Inside a client entry of the app, the items stay live.

Before the browser runs them, every toggle shows its server-rendered pressed state and every toggle group item is in the tab order. A toggle never submits a form: its type is always `button`.

The mixed state of a checkbox needs the browser too. HTML has an `indeterminate` property but no attribute, and ARIA in HTML forbids `aria-checked` on a native checkbox. So the server renders the checked value, and the box looks and is announced as checked or unchecked until the browser sets the property. That matches what the form submits.

## Composing

Every part takes the props of its element and forwards them, with `mix`, to the native element the user interacts with: the input of a Checkbox, Switch or Radio Group Item, the `radiogroup` of a Radio Group, the button of a Toggle or Toggle Group Item, and the `group` of a Toggle Group. So the caller's `css()`, `on()`, `ref()` and other mixins act on that element.

Native events replace shadcn's change callbacks:

```tsx
import { on } from 'remix/component'

import { Checkbox } from './ui/checkbox.tsx'
import { RadioGroup, RadioGroupItem } from './ui/radio-group.tsx'
import { Toggle, toggleChangeType } from './ui/toggle.tsx'
import { ToggleGroup, ToggleGroupItem, toggleGroupChangeType } from './ui/toggle-group.tsx'

<Checkbox mix={on('change', (event) => save(event.currentTarget.checked))} />

<RadioGroup mix={on('change', (event) => choose((event.target as HTMLInputElement).value))}>
  <RadioGroupItem value="monthly" />
  <RadioGroupItem value="yearly" />
</RadioGroup>

<Toggle mix={on(toggleChangeType, (event) => setBold(event.pressed))} aria-label="Bold" />

<ToggleGroup mix={on(toggleGroupChangeType, (event) => setFilter(event.value))} aria-label="Status">
  <ToggleGroupItem value="open">Open</ToggleGroupItem>
  <ToggleGroupItem value="paid">Paid</ToggleGroupItem>
</ToggleGroup>
```

`ToggleChangeEvent` and `ToggleGroupChangeEvent` bubble, so an ancestor can listen too. Both are cancelable: `event.preventDefault()` keeps the current state of an uncontrolled toggle or group. A controlled one (`pressed`, `value`) changes only when its owner renders the new value.

A controlled checkbox, switch or radio group (`checked`, `value`) works the same way: its owner reads the `change` event and renders the new value. When the owner keeps the old value, Remix puts a controlled checkbox or switch back, and the radio group checks the radio of its value again. A form reset restores the defaults (`defaultChecked`, `defaultValue`), so a form with controlled controls listens to its `reset` event.

Style a part with `mix={css(...)}`, a `class`, or a rule in `@layer app`, as `AGENTS.md` describes. `toggleStyles({ variant, size })` returns a toggle's style object, so another element can look like a toggle.

## API

### Checkbox

`Checkbox` takes the props of `<input>` except `type`, `role` and `children`, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `indeterminate` | `boolean` | not set | Shows the mixed state. Clicking clears it, as on any checkbox. Leave it out to manage the property yourself. |

Parts: `data-slot="checkbox-root"` (the wrapper), `checkbox` (the input), `checkbox-indicator` and `checkbox-mixed-indicator` (decorative icons).

### Radio Group

`RadioGroup` takes the props of `<div>` except `role`, plus `name`, `value`, `defaultValue`, `disabled`, `required` and `form`. It hands them to every item. Without a `name`, the radios share a generated one, so they still form one group.

`RadioGroupItem` takes the props of `<input>` except `type`, `role`, `children`, `checked` and `defaultChecked`, and needs `value`. Parts: `radio-group`, `radio-group-item-root`, `radio-group-item` (the input) and `radio-group-indicator` (the dot).

### Switch

`Switch` takes the props of `<input>` except `type`, `role` and `children`, plus `size: 'sm' | 'default'` (default `'default'`). Parts: `switch-root`, `switch` (the input, the track) and `switch-thumb`.

### Toggle

`Toggle` takes the props of `<button>` except `type` and `aria-pressed`, plus:

| Prop | Type | Default |
| --- | --- | --- |
| `pressed` | `boolean` | not set: the toggle keeps its own state |
| `defaultPressed` | `boolean` | `false` |
| `variant` | `'default' \| 'outline'` | `'default'` |
| `size` | `'default' \| 'sm' \| 'lg'` | `'default'` |

It also exports `toggleStyles`, `ToggleChangeEvent` and `toggleChangeType` (`'remixcn:toggle-change'`). It renders `data-slot="toggle"`, `data-state="on|off"`, `data-variant` and `data-size`.

### Toggle Group

`ToggleGroup` takes the props of `<div>` except `role`, plus:

| Prop | Type | Default |
| --- | --- | --- |
| `value` | `string[]` | not set: the group keeps its own value |
| `defaultValue` | `string[]` | `[]` |
| `multiple` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `loopFocus` | `boolean` | `true` |
| `variant` | `'default' \| 'outline'` | not set: each item keeps its own |
| `size` | `'default' \| 'sm' \| 'lg'` | not set: each item keeps its own |
| `spacing` | `number`, in spacing steps | `2`; `0` joins the items into one bar |

`ToggleGroupItem` takes the props of `<button>` except `type`, `aria-pressed` and `value`, plus `value` (required), `variant` and `size`. It also exports `ToggleGroupChangeEvent` and `toggleGroupChangeType` (`'remixcn:toggle-group-change'`).

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/<name>.tsx`, its example and the `cn-*` classes of `apps/v4/registry/styles/style-vega.css` at the pinned shadcn/ui commit, and the Base UI parts they wrap (the `behavior` links in `registry/catalog.json`). RemixCN copies no Base UI code: it maps the behavior to the platform.

### Checkbox

| Upstream | RemixCN |
| --- | --- |
| `Checkbox.Root`, a `<span role="checkbox">` beside a hidden input | A visible native checkbox with `appearance: none`, drawn as shadcn's 16px box |
| `Checkbox.Indicator` with a check icon | Two decorative icons beside the input: a check while checked and a dash while mixed, shown by `:checked` and `:indeterminate` |
| `checked`, `defaultChecked`, `name`, `value`, `form`, `required`, `disabled`, `id` | The native attributes of the input |
| `indeterminate` | The `indeterminate` prop, set as the input's property in the browser (see How they run) |
| `onCheckedChange` | The native `change` event |
| `inputRef` | `mix={ref(...)}` on the input |
| `uncheckedValue` | Not ported. A native checkbox submits nothing while unchecked; read a missing name as "off" on the server |
| `readOnly` | Not ported. Browsers ignore `readonly` on checkboxes; show a fixed value as `disabled` and submit it with a hidden input |
| `parent` (Checkbox Group) | Not ported: Checkbox Group isn't a catalog entry. The "Select all" example builds a parent box from `checked` and `indeterminate` |
| `render`, `nativeButton` | Not needed: the control is the native input |
| `data-checked`, `data-unchecked`, `data-indeterminate`, `data-disabled` | The `:checked`, `:indeterminate` and `:disabled` pseudo-classes |
| `data-valid`, `data-invalid` from Base UI's Field | `aria-invalid="true"` and `invalidState`, with an error message the caller links with `aria-describedby` |
| `focus-visible:ring-3`, `aria-invalid:ring-3` | The theme's 2px outline, which stays in forced colors. An invalid box keeps its red border while checked |
| `after:-inset-x-3 after:-inset-y-2`, a larger hit area | Not ported: Firefox draws no pseudo-elements on inputs. The label is the larger target |
| Forced colors | The system draws its own checkbox (`appearance: auto`), mixed state included |

### Radio Group

| Upstream | RemixCN |
| --- | --- |
| `RadioGroup`, a `<div role="radiogroup">` | The same element, with `aria-required` when required |
| `Radio.Root`, a `<span role="radio">` beside a hidden input | A visible native radio with `appearance: none` |
| `Radio.Indicator` with a dot | A decorative dot beside the input, shown by `:checked` |
| `value`, `defaultValue`, `name`, `disabled`, `required`, `form` | Passed to every radio as `checked`, `defaultChecked`, `name`, `disabled`, `required` and `form` |
| `onValueChange` | The native `change` event, which bubbles to the group |
| Controlled `value` | A click unchecks the selected radio before the owner decides. Remix restores only the clicked radio, so a controlled group checks the radio of its value again after each change |
| Keyboard: arrows move and select, Tab enters at the selected radio | The browser's own radio keys. So is the arrow direction in right-to-left text, and what happens at the ends: Chromium and Firefox wrap around, WebKit stays put |
| `readOnly`, `inputRef`, `render`, `nativeButton` | As for Checkbox: not ported, `ref()`, and not needed |
| Forced colors | The system draws its own radio |

### Switch

| Upstream | RemixCN |
| --- | --- |
| `Switch.Root`, a `<span role="switch">` beside a hidden input | A native checkbox with `role="switch"`, drawn as shadcn's track |
| `Switch.Thumb` | A decorative thumb beside the input. It moves with `:checked`, and the other way in right-to-left text |
| `size: 'sm' \| 'default'` | The same, 24 by 14px or 32 by 18.4px |
| `checked`, `defaultChecked`, `onCheckedChange`, `name`, `value`, `form`, `required`, `disabled`, `id` | As for Checkbox |
| `uncheckedValue`, `readOnly` | Not ported, as for Checkbox |
| Forced colors | The track keeps a border, highlighted once checked, and the thumb's position shows the state |

### Toggle

| Upstream | RemixCN |
| --- | --- |
| `Toggle`, a `<button>` with `aria-pressed` | A `<button type="button">` with a literal `aria-pressed="true"` or `"false"`. Remix renders a boolean `aria-pressed` as an empty attribute, so the component writes the string |
| `pressed`, `defaultPressed`, `disabled` | The same. `aria-disabled="true"` also stops a toggle |
| `onPressedChange` | `ToggleChangeEvent`, bubbling and cancelable |
| `value` | The native `value` of the button. It identifies a toggle and is never submitted |
| `variant`, `size` and `toggleVariants` | `variant`, `size` and `toggleStyles()` |
| `aria-pressed:bg-muted` | The muted background, plus a 2px bar along the bottom edge, so the state doesn't rest on color. In forced colors the bar is a thick highlight border |
| `has-data-[icon=inline-start]` padding | Not ported: the icon slots belong to Button, which lands with Button's own ticket |

### Toggle Group

| Upstream | RemixCN |
| --- | --- |
| `ToggleGroup`, a `<div role="group">` | The same element, with `data-orientation`, `data-spacing`, `data-variant`, `data-size`, `data-multiple` and `data-disabled` |
| `value`, `defaultValue`, `multiple`, `disabled`, `orientation`, `loopFocus` | The same. In single mode, pressing the pressed item releases it, as in Base UI |
| `onValueChange` | `ToggleGroupChangeEvent`, bubbling and cancelable |
| `variant`, `size`, `spacing` from a React context | The same props, read through Remix's `handle.context`. The group's variant and size win over an item's own |
| Base UI's composite focus | The shared `rovingFocus` helper of `registry/lib/composite.ts`. One tab stop: the last focused item, else the first pressed, else the first one that can take focus. The arrow keys of the orientation move between those items, mirrored in right-to-left text, with Home and End, and wrap unless `loopFocus` is false. Disabled, inert and hidden items are skipped, also when a component below the group changes them. The tab stop is checked again before Tab moves focus, so a style sheet that hides an item can't keep Tab out. Nested groups keep their own focus |
| Joined items (`spacing={0}`) with `rounded-l-md`, `border-l-0` | Logical corners and borders, so the bar is also right in right-to-left text |

### Examples

The examples follow shadcn's, with three changes. They use plain `<label>`, `<fieldset>` and `<table>` markup where shadcn uses Field, Label and Table, which other tickets port. Toggle's "With button" rows and Toggle Group's "With input and select" are left out, since Button, Input and Select land with other tickets. And each example shows its state beyond color: checks, dots, thumbs, the pressed bar, and in "Formatting", "Select all" and "Filter" the result itself.

## Accessibility checks

The tests check these in Chromium, Firefox and WebKit, through Playwright:

- Names and states in the accessibility tree before any script runs and after hydration, without hydration errors.
- axe-core's WCAG 2.2 A and AA rules, before and after hydration.
- Labels, Space, Enter, the radio arrow keys, the toggle group's arrow keys, Home, End and Tab.
- Native submission, reset, `required` and `disabled`, and that toggles never submit or add a value.
- The focus ring on every control, also in forced colors, and the forced-colors rendering above.
- Light and dark themes, reduced motion, right-to-left text, and a 320px viewport with text at 200%.

Not checked yet, so not claimed:

- Screen readers: VoiceOver, NVDA, JAWS and TalkBack.
- Real forced-colors modes, such as Windows contrast themes, beyond the browsers' emulation.
- Touch targets: the boxes, radios and small switch are smaller than 24px. They rely on WCAG 2.5.8's spacing exception and on their labels.
