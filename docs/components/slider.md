# Slider

One or more thumbs on a shared track. Each thumb is a native `<input type="range">`, so it has the slider role, keyboard focus and its own form value, and it works before hydration and without JavaScript. Once the slider hydrates, a small adapter takes over the pointer and the keys, so thumbs keep their order and the range between them follows.

- Source: `registry/ui/slider.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/slider-example.tsx`. Run them with `bun run slider-examples` (http://localhost:4410/).
- Upstream: shadcn/ui [`slider.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/slider.tsx), its [docs](https://ui.shadcn.com/docs/components/base/slider), and [Base UI Slider](https://base-ui.com/react/components/slider.md).

## Usage

In server-rendered UI, render `Slider`. It's a client entry, so it hydrates by itself:

```tsx
import { Slider } from '#remixcn/ui/slider.tsx'

<Slider aria-label="Volume" defaultValue={50} />
<Slider name="price" thumbLabels={['Minimum price', 'Maximum price']} defaultValue={[200, 800]} max={1000} step={10} />
```

Inside a component that already hydrates, such as your own client entry, render `SliderRoot`. It takes mixins:

```tsx
import { onSliderChange, SliderRoot } from '#remixcn/ui/slider.tsx'

export const Temperature = clientEntry(import.meta.url, function Temperature(handle: Handle) {
  let value = [0.3, 0.7]

  return () => (
    <SliderRoot
      aria-label="Temperature"
      thumbLabels={['Lowest temperature', 'Highest temperature']}
      value={value}
      max={1}
      step={0.1}
      mix={onSliderChange((event) => {
        value = [...event.values]
        handle.update()
      })}
    />
  )
})
```

## API

### `Slider` and `SliderRoot`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `number \| number[]` | | The controlled value: one number for one thumb, or one number per thumb. The slider shows only this value and asks for changes with `SliderChangeEvent` |
| `defaultValue` | `number \| number[]` | one thumb at `min` | The starting value when the slider owns it, and the value a form reset returns to |
| `min`, `max` | `number` | `0`, `100` | The range. `min` must be less than `max` |
| `step` | `number` | `1` | Values are `min` plus whole steps. A `max` that isn't a step stops at the last step below it, as a native range input does |
| `largeStep` | `number` | a tenth of the range, at least one step | How far Page Up, Page Down and Shift with an arrow key move a thumb |
| `minStepsBetweenValues` | `number` | `0` | The whole steps two neighbouring thumbs keep between them |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | A vertical slider fills the height of its container, at least 10rem |
| `disabled` | `boolean` | `false` | Disables every thumb natively, so the form leaves the slider out. A disabled `<fieldset>` around the slider does the same |
| `name` | `string` | | The form field name. Each thumb submits its own value under it |
| `form` | `string` | | The id of the form the slider belongs to when it sits outside it |
| `id` | `string` | | The first thumb's id, so `<label for>` names it |
| `aria-label`, `aria-labelledby` | `string` | | Name one thumb, or the group of several thumbs and each thumb without its own label |
| `aria-describedby` | `string` | | Describes every thumb, such as with a hint |
| `thumbLabels` | `string[]` | | One name per thumb. Several thumbs need them to tell them apart |
| `format` | `Intl.NumberFormatOptions` | | Turns each value into `aria-valuetext`, such as `{ style: 'currency', currency: 'USD' }` |
| `locale` | `string` | the runtime's | The locale of `format`. Set it, so the server and the browser render the same text |
| `class`, `style`, `dir`, `data-*` | | | Reach the root element |
| `mix` | mixins | | `SliderRoot` only: your `css()`, `on()`, `ref()` or `onSliderChange()` for the root. A client entry's props must serialize, so `Slider` can't take them |

The slider throws a `SliderError` for a range or value it can't use, with a message that names the prop: a value or bound that isn't a finite number, `min` not below `max`, a `step` or `largeStep` of 0 or less, a `minStepsBetweenValues` that isn't a whole number of 0 or more, an empty array, or more thumbs than the range fits with their minimum steps. On the server the render fails. In the browser, the root reports it through its `error` event.

### Events

The slider tells its ancestors about changes in two ways:

- **Native events** on the thumb that moved, as a native range input does: `input` for every change, and `change` when the user settles on a value. Forms and listeners that already read range inputs keep working.
- **`SliderChangeEvent`** (`remixcn:slider-change`) and **`SliderCommitEvent`** (`remixcn:slider-commit`) bubble from the root with every value at once:

| Property | What it holds |
| --- | --- |
| `values` | One value per thumb, from the lowest to the highest |
| `index` | The thumb that moved, or `-1` for a reset |
| `reason` | Change: `'keyboard'`, `'track-press'`, `'drag'`, `'cancel'`, `'input'` or `'reset'`. Commit: `'keyboard'`, `'track-press'`, `'drag'` or `'input'` |

Listen with `onSliderChange(handler)` and `onSliderCommit(handler)` on the slider or any ancestor that hydrates. A change fires while a thumb moves; a commit fires after each key, and when a press or drag ends. Neither fires when nothing moved. A canceled drag fires a change back to where it started and commits nothing.

### Value helpers

`getSliderRange(options)`, `snapSliderValue(value, range)`, `normalizeSliderValues(value, range)`, `getThumbBounds(values, index, range)` and `moveSliderThumb(values, index, value, range)` hold the rules the component uses. They have no DOM, so a server action can read a submitted form with the same rules:

```ts
let range = getSliderRange({ max: 1000, step: 10, minStepsBetweenValues: 5 })
let [minimum, maximum] = normalizeSliderValues(formData.getAll('price').map(Number), range)
```

## Values, order and reset

- **Order.** Values are always sorted from the lowest to the highest. The first thumb holds the lowest value, so its name, such as "Minimum price", stays right. An unsorted `value` or `defaultValue` is sorted.
- **Snapping.** Every value snaps to the nearest step from `min`, and a value halfway between two steps takes the larger one, as a native range input does. Fractional steps stay exact: 0.1 + 0.2 is 0.3.
- **Clamping.** Values outside `min` and `max` move to the nearest end. Neighbouring thumbs move apart to keep `minStepsBetweenValues`.
- **No crossing.** A thumb moves between its neighbours, minus the minimum steps. Home and End move it to those bounds. A thumb pushed or dragged past a neighbour stops at it. So each thumb keeps its index, its name and its form value. A thumb whose neighbours narrow its bounds tells assistive technology with `aria-valuemin` and `aria-valuemax`, which follow as the neighbours move. Its native `min` and `max` stay those of the whole track, which place the thumb on it. Base UI's `push` and `swap` collision modes aren't ported, because they change which thumb holds which value.
- **Two thumbs on one value.** A press on them waits for the pointer to move: moving up takes the upper thumb, moving down the lower one, so thumbs at `max` never get stuck.
- **Changed props.** The slider reads its props on every render. A new controlled `value` shows at once. A new `min`, `max` or `step` clamps and snaps the current values, also of an uncontrolled slider, without firing events. A controlled slider gets or loses thumbs with its value's length; the existing thumbs keep their inputs.
- **Form values.** Each thumb submits its own value under `name`, so `formData.getAll(name)` lists them from the lowest to the highest. A disabled slider, also one in a disabled `<fieldset>`, submits nothing and takes no input.
- **Reset.** A form reset returns the thumbs to `defaultValue`, or, for a controlled slider without one, to the value it first rendered. The slider then fires a change with reason `'reset'`, so a controlled owner can follow. An owner that ignores it keeps its value. A listener that cancels the reset with `preventDefault()` leaves the slider as it is. Without JavaScript the native reset does the same.
- **Assistive technology** may set a thumb's value and fire native `input` and `change` itself, for example a screen reader's swipe gesture. The slider keeps that value inside the thumb's bounds and reports it with reason `'input'`.

## Keyboard and pointer

| Key | Moves the focused thumb |
| --- | --- |
| Arrow Right, Arrow Up | One step up. In right-to-left text, Arrow Right moves down |
| Arrow Left, Arrow Down | One step down. In right-to-left text, Arrow Left moves up |
| Shift with an arrow, Page Up, Page Down | One large step |
| Home, End | To the lowest or highest value the thumb may take |

Keys with Alt, Control or Meta stay with the browser. The slider keeps a handled key from scrolling the page, also at an end.

- **Press.** A press on the track moves the nearest thumb there and focuses it. The value commits when the press ends.
- **Drag.** The slider captures the pointer, so a drag keeps going outside the track and outside the window. Only the pointer that started the drag moves the thumb.
- **Cancel.** When the browser cancels the pointer, such as when a touch turns into scrolling, the dragged thumb returns to where it started, and nothing commits. The other thumbs keep their values. A horizontal slider lets the page scroll vertically, and a vertical one horizontally.
- **Removal.** Removing the slider during a drag removes its listeners, so a late pointer event changes and commits nothing. A slider that becomes disabled during a drag, by its prop or its `<fieldset>`, cancels it. When a controlled owner removes the dragged thumb, the drag ends where the owner's value is, without restoring old values.

## Without JavaScript and before hydration

The server renders one native range input per thumb with its value, range, name and labels. Before hydration and without JavaScript:

- Keyboard, a drag on a thumb, forms and reset work natively.
- The filled range stays where the server drew it.
- Thumbs of a range can pass each other. The form still sends one value per thumb, so a server should sort or validate them, for example with `normalizeSliderValues`.
- A press on the track doesn't move a thumb.

When the slider hydrates, it takes over the values the user set before.

## Composition and styling

- **Labels.** Name one thumb with `aria-label`, `aria-labelledby`, or `id` with `<label for>`. Name several thumbs with `thumbLabels`, and the group with `aria-label` or `aria-labelledby`, or put the slider in a `<fieldset>` with a `<legend>`.
- **Value text.** Show the values next to the slider by listening for `SliderChangeEvent`, as the Controlled and Form examples do. Use `format` so screen readers hear the same text.
- **Size.** A horizontal slider is as wide as its container. A vertical one is as tall as its container, at least 10rem. Set `--slider-thumb-size` on the root or an ancestor for larger thumbs; the default is 1rem. The control takes presses on a band at least 24px across, WCAG 2.2's minimum target size, so a slider takes 24px of height (or width, when vertical) around its 16px thumbs.
- **Colors.** The track uses `--muted` and the thumb border and filled range `--primary`, so a `--primary` on an ancestor reaches them.
- **Parts.** The root, control, track, range and thumbs carry `data-slot` (`slider`, `slider-control`, `slider-track`, `slider-range`, `slider-thumb`), and `data-orientation`, `data-disabled` and `data-dragging`. A thumb also has `data-index`. The root's `--slider-start` and `--slider-end` hold where the range starts and ends, from 0 to 1. Target them from a rule in `@layer app`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Slider` on Base UI's `Slider.Root` | `Slider` (client entry) and `SliderRoot` | The same markup and behavior. Only `SliderRoot` takes mixins |
| `Slider.Control` | `data-slot="slider-control"`, a `<div>` | Owns the pointer adapter |
| `Slider.Track` | `data-slot="slider-track"` | |
| `Slider.Indicator` | `data-slot="slider-range"` | From the start of the track to a single thumb, or between the outer thumbs |
| `Slider.Thumb` with its nested `<input type="range">` | The native `<input type="range">` itself, `data-slot="slider-thumb"` | Base UI hides the input inside a `<div>` thumb. RemixCN draws the input's own thumb, so it works without JavaScript |
| shadcn's thumb count from `value`, `defaultValue` or `[min, max]` | From `value` or `defaultValue`, else one thumb at `min` | shadcn draws two thumbs for `defaultValue={50}`. Base UI's state has one value there |
| `value`, `defaultValue`, `min`, `max`, `step`, `largeStep`, `minStepsBetweenValues`, `orientation`, `disabled`, `name`, `form`, `format`, `locale` | Same props | `largeStep` defaults to a tenth of the range, at least one step, instead of 10, which is the same for 0 to 100 |
| `onValueChange`, `onValueCommitted` | `SliderChangeEvent`, `SliderCommitEvent`, `onSliderChange()`, `onSliderCommit()`, and native `input` and `change` | Remix passes events, not callbacks, and a client entry's props must serialize. Reasons as Base UI's, plus `cancel` and `reset` |
| `thumbAlignment="edge"` | Always edge-aligned | A native thumb stays inside its input. `center` isn't ported |
| `thumbCollisionBehavior` | Thumbs stop at their neighbours | `push` and `swap` aren't ported; see Values |
| Thumb `getAriaLabel`, `aria-label` per thumb | `thumbLabels` | Functions don't serialize |
| Thumb `getAriaValueText`, `aria-valuetext` | `format` and `locale` | |
| Thumb `index`, `inputRef`, `tabIndex`, per-thumb `disabled` | Not ported | shadcn's `Slider` renders the thumbs itself and doesn't expose them |
| `Slider.Value`, `Slider.Label` | Not ported | shadcn's `Slider` doesn't render them. Use your own text, `aria-labelledby` or a `<fieldset>` |
| `render`, `className` and `style` functions | Not ported | `class`, `style`, `data-*` and `SliderRoot`'s `mix` |
| `Field.Root` states (`data-valid`, `data-touched`, …) | Not ported | Field is ported with its own ticket |
| `cn-slider`: `data-vertical:min-h-40` | `min-height: calc(var(--spacing) * 40)` on a vertical control | |
| `cn-slider-track`: `bg-muted rounded-full h-1.5` / `w-1.5` | Same | Draws its edge in forced colors |
| `cn-slider-range`: `bg-primary` | Same | `Highlight` in forced colors |
| `cn-slider-thumb`: `size-4 rounded-full border border-primary bg-white shadow-sm` | Same, on `::-webkit-slider-thumb` and `::-moz-range-thumb` | The control around them is at least 24px across, so each thumb's pointer target meets WCAG 2.2's 24px |
| `hover:ring-4 focus-visible:ring-4 ring-ring/50` | A 4px halo on hover and while dragging, and the theme's 2px outline in `--ring` on keyboard focus | The outline stays visible in forced colors |
| `data-disabled:opacity-50`, `disabled:pointer-events-none` | Same, on the control | The thumbs dim once, not twice |
| `touch-none` on the control | `touch-action: pan-y` (horizontal) or `pan-x` (vertical) | The page still scrolls across the slider. A scroll cancels the drag |
| Docs: Basic, Range, Multiple Thumbs, Vertical, Controlled, Disabled, RTL | `SliderBasic`, `SliderRange`, `SliderMultiple`, `SliderVertical`, `SliderControlled`, `SliderDisabled`, `SliderRtl` | |
| `field-slider` (Price Range) | `SliderPriceForm` | A form with per-thumb values, reset and currency value text. Uses a `<fieldset>` until Field is ported |

## Accessibility checks

Automated (`bun run check`). The component and end-to-end tests run in Chromium, Firefox and WebKit. Real touches and the accessibility tree are checked in Chromium only, the one engine that lets a test drive them:

- Each thumb is a native range input with its name, value, range, `aria-orientation` for vertical sliders, and `aria-valuetext` from `format`. Several thumbs have their own names and a named group.
- Chromium's accessibility tree gives each thumb of a range the bounds its neighbours leave it, and updates them when a neighbour moves.
- Arrows, Shift, Page Up, Page Down, Home and End move a thumb, with the arrows swapped in right-to-left text. Keys at an end don't scroll the page.
- A press, a mouse drag past the end of the track, a tap, and a canceled touch behave as described above.
- Thumbs never cross, by key, pointer or assistive technology, and keep their inputs and names.
- Forms get one value per thumb in order, reset works and a canceled reset changes nothing, a disabled slider or fieldset submits nothing and ignores keys and the pointer, and the form works without JavaScript.
- The filled range and the thumb border are 3:1 or more against their surface in both themes.
- The focus ring shows on the focused thumb, also in forced colors. The track and range stay visible in forced colors.
- The thumb's halo takes no time with reduced motion.
- axe-core's WCAG 2.2 A and AA rules pass on the example page. Its target-size rule sizes each thumb by its input, which spans the whole track, and sees the inputs of a range as overlapping. They take no pointer, so the test leaves only them out of that rule, and checks the real targets instead: the band each thumb takes is at least 24 by 24 pixels on the example page, and a press beside a thumb on the band moves it.
- The page fits 320px without scrolling sideways, with normal text and at 200%.
- Removing the slider during a drag leaves no listener behind.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested, nor their swipe gestures on a real device.
- Only Chromium's accessibility tree was read for the thumbs' bounds. Firefox's and WebKit's weren't.
- Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated in Chromium and Firefox, not tested in Windows. WebKit has no forced colors mode. Touch was emulated in Chromium, not tested on a phone.
- Vertical sliders need `writing-mode` on range inputs (Chrome 124, Firefox 120 and Safari 17.4 or later). An older browser draws a vertical slider's thumb across its input.
- The empty track keeps shadcn's `--muted`, about 1.1:1 against the page in light mode. The thumb and the filled range carry the value at 3:1 or more.
- Thumbs of a range less than about 24px apart share the band between them, so each one's target is then narrower than 24px. The examples keep them farther apart. Keys move each thumb one step at a time.
- This isn't an accessibility certification.
