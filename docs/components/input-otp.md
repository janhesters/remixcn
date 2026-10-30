# Input OTP

A one-time code in one real text input. Slots, groups, separators and a caret draw its value and selection; the input takes the typing, autofill, paste, validation, submission and reset.

- Source: `registry/ui/input-otp.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/aria.ts` and `registry/lib/icons.tsx`.
- Examples: `registry/examples/input-otp-example.tsx`. Run them with `bun run input-group-examples`.
- Upstream: shadcn/ui [`input-otp.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/input-otp.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/input-otp), and the behavior of [input-otp](https://input-otp.rodz.dev) 1.4.2, the version shadcn/ui pins. No input-otp code is a dependency.

## Usage

```tsx
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, REGEXP_ONLY_DIGITS } from '#remixcn/ui/input-otp.tsx'

<FieldLabel for="code">Verification code</FieldLabel>
<InputOTP id="code" name="code" maxLength={6} pattern={REGEXP_ONLY_DIGITS} required>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```

InputOTP runs in the browser inside your client entry: render it from a `clientEntry(…)` component, as the examples do. It can't be an entry itself, since its slots are live children.

## API

### `InputOTP`

A `<div data-slot="input-otp">` around its children and one `<input data-slot="input-otp-input">`, which lies over them with clear text.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `maxLength` | `number` | | Required. How many characters the code has. Typing, pasting and autofill stop there |
| `value` | `string` | | The controlled code. The slots show only this value, and ask for changes with `InputOTPChangeEvent` |
| `defaultValue` | `string` | | The starting code when the input owns it, and the code a form reset returns to. A controlled code without one resets to its first value |
| `pattern` | `string` | | A regular expression each character must match on its own, such as `REGEXP_ONLY_DIGITS`. Typed, pasted and composed characters it refuses are dropped. It is also the input's native `pattern` |
| `pasteTransformer` | `(text: string) => string` | | Changes pasted text before the pattern filters it |
| `tooShortMessage` | `string` | `'Enter at least <minLength> characters.'` | The message for a code shorter than `minLength` where the browser doesn't check its length itself (see Forms). Translate it into your app's language |
| `mask` | `boolean \| string` | | Shows `•`, or this text, in each filled slot, and makes the input `type="password"` |
| `placeholder` | `string` | | One character per slot while the code is empty, and the input's native placeholder |
| `inputMode` | `string` | `'numeric'` without a pattern or with `REGEXP_ONLY_DIGITS`, `'text'` otherwise | The keyboard phones show |
| `autocomplete` | `string` | `'one-time-code'` | So browsers and phones offer a code they received |
| `containerClass` | `string` | | Classes for the box around the slots |
| `containerMix` | | | Mixins for the box, such as `css()` |
| `mix` | | | Go to the input: your refs, events and styles reach the real input |

Every other prop goes to the input: `id`, `name`, `form`, `required`, `minLength`, `disabled`, `readOnly`, `dir` (also on the box), `aria-*` and the rest. Boolean `aria-*` props are written as `"true"` or `"false"`. The input also writes `maxlength`, and `spellcheck="false"` and `autocapitalize="off"` unless you pass your own.

### Events

| Event | Bubbles from | Has | When |
| --- | --- | --- | --- |
| `InputOTPChangeEvent` (`'remixcn:input-otp-change'`) | The input | `value`, `reason`: `'input'`, `'paste'` or `'reset'` | Each time the code changes. It takes the place of input-otp's `onChange` |
| `InputOTPCompleteEvent` (`'remixcn:input-otp-complete'`) | The input | `value` | Once the shown code reaches `maxLength` from a shorter one. It takes the place of `onComplete` |

Listen with `mix={onInputOTPChange((event) => …)}` and `onInputOTPComplete`, on InputOTP or any ancestor. Both carry the input's current value. The input's native `input` events fire as usual, also after a paste, and native `change` events when it loses focus after the user changed the code, by typing or pasting.

### Patterns

`REGEXP_ONLY_DIGITS` (`'^\\d+$'`), `REGEXP_ONLY_CHARS` (`'^[a-zA-Z]+$'`) and `REGEXP_ONLY_DIGITS_AND_CHARS` (`'^[a-zA-Z0-9]+$'`) have input-otp's names and values. `sanitizeOTP(text, { pattern, maxLength })` returns what the input keeps of some text.

### `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`

`InputOTPGroup` is a `<div data-slot="input-otp-group">` that joins its slots into one row. `InputOTPSlot` is a `<div data-slot="input-otp-slot">` that shows the character at its required `index`, a placeholder character, its selection with `data-active="true"`, and the blinking caret while it's active and empty. `aria-invalid` on a slot draws it red, as on shadcn's slot; `aria-invalid` on InputOTP draws every slot red and tells assistive technology too. `InputOTPSeparator` draws a dash. All three are `aria-hidden`: the input holds the code and its name.

A custom slot reads `handle.context.get(InputOTP)`, an `InputOTPContext` with `slots` (each an `InputOTPSlotState`: `char`, `placeholderChar`, `isActive`, `hasFakeCaret`), `isFocused`, `isHovering` and `mask`. It renders `data-slot="input-otp-slot"` and `data-index`, so a press on it selects its character.

## Behavior

- **Typing and selection.** As in input-otp, a caret inside the code selects the character beside it, so typing replaces that character, Backspace deletes it, and the arrow keys step from slot to slot. A caret at the end of a code that isn't full stays, so typing adds a character; a full code selects its last one. Shift with the arrows, and Ctrl or Command with A, select several slots.
- **Pointer.** The input covers the slots, so a press anywhere focuses it. A press on a filled slot selects its character; a press after the code puts the caret at its end.
- **Paste.** Text the browser can paste as it is, such as 123 into an empty code, stays the browser's own paste. Other text loses the characters the pattern refuses, such as the dash in 123-456 or spaces. A paste of a whole code replaces the code; a shorter one goes where the selection is, cut to the room left. A paste without one valid character, or one that leaves the code as it was, changes nothing. The component makes its changes through the browser's editing, as a keystroke would, so the browser fires `input`, and `change` once the user leaves, and Ctrl or Command with Z undoes the paste.
- **Refused characters** never reach the input: the component cancels them in `beforeinput`, so what the user types stays the user's own edit.
- **Input methods.** While an input method composes, the slots show its text as typed. When it commits, the text is normalized with NFKC, so full-width digits become 0 to 9, and filtered, in the next task, so the edit can't disturb the input method. A full-width digit typed without one becomes a digit at once.
- **Leading zeroes.** The code is text, so 007123 stays 007123 in the slots, the events and the form.
- **Forms.** The input submits under its `name`, resets to `defaultValue`, and validates natively: `required`, `minLength` and the pattern of the whole code. Browsers check `minLength` only on text the user typed or pasted. Chromium counts the component's own edits, such as a filtered paste or a committed input method's text, as a script's. So when the browser doesn't report a code shorter than `minLength`, the component does, as a custom validity error with `tooShortMessage`, and clears it once the code is long enough. A form can send itself on `InputOTPCompleteEvent` with `requestSubmit()`, which still validates.
- **Before its script runs.** The server's slots show the starting code under the clear input, which takes the theme's focus ring. Without scripting, or when the component still doesn't run two seconds later, the input shows itself as a plain text box over the slots, so the code stays visible, editable and valid. A code typed before hydration becomes the component's.
- **Forced colors.** The running input is hidden with opacity, since forced colors would paint its clear text over the first slot. The slots, their borders, the ring of the active slot and the caret stay visible.
- **Reduced motion.** The caret stops blinking.
- **Direction.** Slots follow the text direction: in right-to-left text the first slot is on the right. Set `dir="ltr"` on InputOTP to keep a code left to right.
- **Narrow screens.** The slots shrink, down to 0.875rem each. Once they can't shrink further, a group moves to the next line. A group takes its sizes from the slots it renders, also when your own component renders them or their number changes. The input covers every line, so each slot stays inside it and takes presses.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `OTPInput` from input-otp, with `data-slot="input-otp"` on its input | One native `<input data-slot="input-otp-input">` in a `div data-slot="input-otp"` | The box holds the data-slot most parts use; no input-otp package |
| `containerClassName` | `containerClass` and `containerMix` | |
| `className` and other props on the input | `mix` and the other props on the input | |
| `value`, `onChange`, `defaultValue` | `value`, `InputOTPChangeEvent`, `defaultValue` | `defaultValue` is also the native reset value |
| `onComplete` | `InputOTPCompleteEvent` | Dispatched after the render that shows the full code, so a controlled owner has rendered it |
| `maxLength`, `placeholder`, `inputMode="numeric"`, `autoComplete="one-time-code"` | Same | Without a pattern or with digits only, the keyboard is numeric; another pattern gets a text keyboard |
| `pattern`: a typed or pasted value that doesn't match as a whole is refused | Characters the pattern refuses on their own are dropped | The ticket asks to ignore invalid pasted characters; a pattern describes one character |
| `pasteTransformer` | Same | |
| A paste inserts at the selection and is cut, through `input.value` on iOS or with a `pasteTransformer` | Text the browser can paste as it is stays its own paste; other text goes in through the browser's editing, and a whole code replaces the code | So `minLength`, the native `change` event and undo keep working |
| Selection mirroring on `selectionchange`, focus selecting the last character | Same rule | Also synced on `keyup` and `select` |
| `slots[i]`: `char`, `placeholderChar`, `isActive`, `hasFakeCaret`; `isFocused`, `isHovering` | `InputOTPContext` through `handle.context` | The `render` prop isn't ported; a custom slot reads the context |
| A press anywhere puts the caret at the end | A press on a filled slot selects it | |
| `noScriptCSSFallback` in a `<noscript>` | `@media (scripting: none)` and a two-second fail-safe | Also covers a page whose script failed |
| Clear text, `letter-spacing: -.5em`, monospace, transparent selection and autofill, the iOS rules | Same, in `css()` | 16px text keeps phones from zooming in; hidden with opacity in forced colors |
| `pushPasswordManagerStrategy` | Not ported | It widens the input when it detects a password manager's badge; RemixCN measures no third-party UI |
| `textAlign` | Not ported | The text is clear, and slot presses place the selection |
| `syncTimeouts` re-reading the selection and re-firing `input` after autofill | Not ported | The selection syncs on the input's own events |
| `InputOTPGroup`: `flex items-center rounded-md` (a grid of one column per slot here, so it shrinks with its slots), `has-aria-invalid:border-destructive ring-3 ring-destructive/20` | Same, and also when the input is invalid | The halo is a box shadow; the slots' borders and your error text say it in forced colors |
| `InputOTPSlot`: `size-9 border-y border-r first:border-l first:rounded-l-md last:rounded-r-md text-sm shadow-xs dark:bg-input/30` | Same, in logical properties | Slots shrink to 0.875rem on narrow screens, then their group wraps |
| `data-[active=true]:border-ring ring-3 ring-ring/50 z-10` | Border in `--ring` and a 2px outline | The outline stays in forced colors |
| Caret: `animate-caret-blink bg-foreground h-4 w-px duration-1000` | A 1px border, blinking for 1s | Still for reduced motion, visible in forced colors |
| `InputOTPSeparator`: `role="separator"` with an icon library's minus | `aria-hidden` with RemixCN's `MinusIcon` | The code is one value, so its separators are decoration |
| Example: Simple; docs: Usage, Separator | `InputOTPSimple` | |
| Example: Digits Only; docs: Pattern | `InputOTPDigitsOnly` | With a placeholder |
| Example: With Separator | `InputOTPWithSeparator` | |
| Example: Alphanumeric | `InputOTPAlphanumeric` | |
| Example: Disabled | `InputOTPDisabled` | |
| Example: 4 Digits | `InputOTPFourDigits` | |
| Example: Invalid State | `InputOTPInvalid` | `aria-invalid` on the code instead of each slot |
| Example: Form | `InputOTPForm` | Sends itself once complete; Verify checks the length |
| Docs: Controlled | `InputOTPControlled` | With a Clear button |
| Docs: RTL | The fixture's right-to-left panel | |
| — | `InputOTPMasked` | A masked PIN |

## Accessibility checks

Automated: one labelled native input per code with `autocomplete="one-time-code"`; typing, refused characters, the selection rule with the arrow keys, Backspace, End and select-all; slot presses; real clipboard pastes with separators, a capped length and a whole code, a short paste that keeps failing `minLength`, undo, and the native `change` after a paste but not after an unchanged paste or a reset; leading zeroes in the value, the events and the form; complete and change events; input method composition with full-width digits; reset; native validation; controlled values the owner takes, declines or sets; masking and placeholders; a disabled code and fieldset; a code typed before hydration; the plain text box without JavaScript and two seconds after the script failed; cleanup of listeners and timers; the active slot's ring and the caret, also in forced colors; the caret still for reduced motion; contrast in both themes; slots in right-to-left text; no sideways scrolling at 320px, also with text at 200%, with every slot inside its input and taking presses there; and axe-core's WCAG 2.2 A and AA rules in both schemes, before and after hydration. Real input methods, phones' one-time-code autofill, password managers and screen readers weren't run: the input method tests send the composition events a browser sends. This isn't an accessibility certification.
