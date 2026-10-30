# Questionnaire

One question at a time in one native form: single and multiple choices as native radios and checkboxes, a freeform answer as a native input, explicit skips, progress, navigation, answer keys, your own async checks, and one snapshot of every answer on submit. It replaces shadcn's Questionnaire and the `@shadcn/react` primitive it wraps.

- Source: `registry/ui/questionnaire.tsx`. Needs `registry/ui/button.tsx`, `registry/ui/input.tsx`, `registry/ui/spinner.tsx`, `registry/lib/icons.tsx`, `registry/lib/styles.ts` and `registry/lib/theme.css`.
- Examples: `registry/examples/questionnaire-example.tsx`. Run them with `bun run questionnaire-examples` (http://localhost:4431/), and `bun run capture:questionnaire-examples` writes the screenshots in `docs/images/questionnaire/`.
- Upstream: shadcn/ui [`questionnaire.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/questionnaire.tsx), its [docs](https://ui.shadcn.com/docs/components/base/questionnaire), and the headless [`@shadcn/react` Questionnaire](https://github.com/shadcn-ui/ui/tree/96da9cc7f1aa10580a3741664e2a77c721206c00/packages/react/src/questionnaire) with [its docs](https://ui.shadcn.com/docs/react/questionnaire) for the behavior.

## How it runs

| Part | Element | Before the script runs | Without JavaScript |
| --- | --- | --- | --- |
| Questionnaire | `<form>`, with a hidden, disabled default button first | The current question shows; the others hide by style | Every question shows, and the browser validates and posts the form |
| QuestionnaireProgress | `<div role="progressbar">` with "Question 1 of 3" | From `items`, or empty until the browser counts the questions | Hidden |
| QuestionnaireItem | `<fieldset>` | `data-active` or `data-inactive` | Shown, unless disabled |
| QuestionnaireTitle | `<legend>` | The same | The same |
| QuestionnaireChoice | `<label>` around a native radio or checkbox | Picks natively; the answer is kept on hydration | Picks and submits natively; a required radio group is `required` |
| QuestionnaireInput | Input, a native text-entry input | Types natively; the text is kept on hydration | Submits natively |
| QuestionnairePrevious, Skip, Next | Button, `type="button"` | Natively disabled | Hidden |
| QuestionnaireSubmit | Button, `type="submit"` | Shows on the last question | Shows, and posts the form |

The questionnaire runs inside a client entry of your app, as every example does. It isn't a client entry itself: an entry's props must serialize to JSON, so it couldn't take your `mix`, `validate` or `onSubmit`, and the server would render its questions to static HTML.

Once it runs, the form is `novalidate`: the questionnaire checks every question itself, so a required control on a hidden question never blocks a submit, and inactive questions and actions are `hidden` and `inert`. The disabled default button keeps Enter in a field from submitting the form, also before the script runs: by the HTML standard, Enter presses the first submit button, and a disabled one does nothing. In the browser, Enter on an answer continues instead.

## Usage

```tsx
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '#remixcn/ui/questionnaire.tsx'

const items = [
  { name: 'direction', required: true, choices: [{ value: 'delegation' }, { value: 'questions' }] },
  { name: 'detail', choices: [{ value: 'focused' }, { value: 'complete' }] },
] as const

<Questionnaire
  aria-label="Plan the next prototype"
  items={items}
  onSubmit={async ({ answers, formData }, { signal }) => {
    let response = await fetch('/plans', { method: 'POST', body: formData, signal })
    if (!response.ok) throw new Error('The plan wasn’t saved. Try again.')
  }}
>
  <QuestionnaireProgress />
  <QuestionnaireItem name="direction">
    <QuestionnaireTitle>What should we prototype next?</QuestionnaireTitle>
    <QuestionnaireDescription>Choose a direction or write your own.</QuestionnaireDescription>
    <QuestionnaireChoices>
      <QuestionnaireChoice value="delegation">Delegation</QuestionnaireChoice>
      <QuestionnaireChoice value="questions">Question prompts</QuestionnaireChoice>
      <QuestionnaireInput aria-label="Another answer" placeholder="Type another answer…" />
    </QuestionnaireChoices>
    <QuestionnaireError />
  </QuestionnaireItem>
  <QuestionnaireItem name="detail">
    <QuestionnaireTitle>How much detail should it include?</QuestionnaireTitle>
    <QuestionnaireChoices>
      <QuestionnaireChoice value="focused">Focused</QuestionnaireChoice>
      <QuestionnaireChoice value="complete">Complete flow</QuestionnaireChoice>
    </QuestionnaireChoices>
    <QuestionnaireError />
  </QuestionnaireItem>
  <QuestionnaireError />
  <QuestionnaireActions>
    <QuestionnairePrevious />
    <QuestionnaireSkip />
    <QuestionnaireNext />
    <QuestionnaireSubmit pendingLabel="Saving…">Save answers</QuestionnaireSubmit>
  </QuestionnaireActions>
</Questionnaire>
```

Pass the same `items` you render, so the server renders the progress, the actions and the answer keys right away. Without `items`, the questionnaire learns the questions from the parts as they render and, once it runs, from the form: the first question is current on the server, and actions after the questions know their position, but a progress before them fills in only in the browser.

## Composition

```text
Questionnaire
├── QuestionnaireProgress
├── QuestionnaireItem
│   ├── QuestionnaireTitle
│   ├── QuestionnaireDescription
│   ├── QuestionnaireChoices
│   │   ├── QuestionnaireChoice
│   │   │   └── QuestionnaireChoiceDescription
│   │   └── QuestionnaireInput
│   └── QuestionnaireError
├── QuestionnaireError, for a failed submit
└── QuestionnaireActions
    ├── QuestionnairePrevious
    ├── QuestionnaireSkip
    ├── QuestionnaireNext
    └── QuestionnaireSubmit
```

- **Names.** Each item's `name` is the question's id: unique in the questionnaire, and the form field name of its answers. You own the names and the answers; the questionnaire never stores, sends or fetches anything itself.
- **Title.** QuestionnaireTitle is the fieldset's `legend`, so make it the item's first child. To put the question in a card's header, use the card's own title with an `id`, and name it in the item's `aria-labelledby`, as the Card example does. Do the same with `aria-describedby` for a description outside the item's own parts.
- **Description and error.** The item names its QuestionnaireDescription, and its QuestionnaireError while it shows, in `aria-describedby`. On the server, it finds them among the children it was given, also inside a card; in the browser, it reads the form.
- **One form.** Questionnaire is the form, so never nest it in another form, and never nest one questionnaire in another. Several questionnaires on one page stay apart: their answers, keys, ids and focus.
- **The host owns the rest.** Closing a dialog, persisting a draft, branching, and what happens after a submit are yours. Closing a dialog cancels the flow; Skip records that an optional question was left unanswered on purpose.
- **Actions per question.** Actions may also sit inside each item, such as in a card's footer: each item's actions follow the current question.

## API

### Questionnaire

The form. Every native form prop passes through, such as `action`, `method` and `aria-label`, and `mix` reaches the form.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `item` | `string` | - | The current question, for a questionnaire you control. Pair it with `onItemChange`. |
| `defaultItem` | `string` | the first enabled question | The question to start at. An unknown or disabled one falls back to the first. |
| `onItemChange` | `(item, { reason }) => void` | - | Called when navigation asks for another question. `reason` is `next`, `previous`, `skip`, `invalid` (a check sent it back), `reset`, or `unavailable` (the current one left the flow). |
| `items` | `readonly QuestionnaireItemDefinition[]` | - | The questions in order: `name`, `required`, `disabled`, `multiple` and the `choices` in order. An item takes `required`, `multiple` and `disabled` from here unless it sets them, and its own props then win everywhere: in the flow, the checks and the snapshot. A question its own `disabled` turns off hands its place to the next one. On the server, only parts after the questions see their own props. |
| `answers` | `QuestionnaireAnswers` | - | The answers, for a questionnaire you control. Pair it with `onAnswersChange`; a change you decline is put back. |
| `defaultAnswers` | `QuestionnaireAnswers` | `{}` | The answers at first, and again after a form reset, such as a saved draft. |
| `onAnswersChange` | `(answers, { item }) => void` | - | Called with every answer after a person picks, types or skips, and with the answers a person changed before the script ran: only those, never what the server rendered. |
| `shortcuts` | `'letters' \| 'numbers'` | - | Gives each enabled choice of the current question a key: A to Z, or 1 to 9, in the order of `items`, or as rendered without them. |
| `noValidate` | `boolean` | - | `false` adds the browser's own checks of each answer, such as an email input's format, and reports them at the answer. `true` also turns off the browser's validation without a script. |
| `validate` | `({ item, answers, signal }) => string \| void \| Promise` | - | Your own check of one answered question. Return an error message, or nothing. Next and Submit wait for it; a rejection shows its message. `signal` aborts when an answer it checks changes, by a person or through `answers`, the form resets, or the questionnaire goes away. |
| `onSubmit` | `(snapshot, { form, submitter, signal }) => void \| Promise` | - | Receives every answer once all pass, and cancels the native submission. It gets exactly the answers your checks passed: an answer that changes while they run, by a person or through `answers`, drops the submit, and the person sends again. The buttons wait while your promise runs, and presses meanwhile do nothing. A rejection keeps the answers and shows its message. Without `onSubmit`, the form submits natively to its `action`. |

`QuestionnaireAnswers` maps names to answers: a string for a choice's value or the freeform text, a list for a multiple question, and `null` for a skip. A missing name, an empty string or an empty list is no answer. A value whose choice is gone, from the form or from `items`, no longer counts, unless the question has a freeform answer that holds it as text: the snapshot and the `FormData` always agree. `questionnaireAnswerStatus(answer)` turns one into `'unanswered'`, `'answered'` or `'skipped'`.

The snapshot holds `answers`, each question that takes part with its value, list or `null`, and `formData`, what the form would send: skipped and disabled questions are absent from it. The form has `data-current`, `data-total`, `data-first`, `data-last`, `data-shortcuts`, `data-running` once it runs, and `data-pending` with `aria-busy="true"` while a check or a submit runs.

### QuestionnaireSubmitError

Throw `new QuestionnaireSubmitError(message, { item })` from `onSubmit` to send the person back to one question, such as an answer the server refused. The question shows the message and focuses its answer. Any other error shows in the questionnaire's own QuestionnaireError, or in the current question's when there is none, and focus stays where the person was.

### QuestionnaireProgress

A `<div role="progressbar">` named "Questionnaire progress", with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` and "Question 1 of 3". Pass `aria-label` for another name, children for other text, or a function child that gets `{ current, total, first, last }`, as the Custom progress example does. It has the same data attributes as the form.

### QuestionnaireItem

A `<fieldset>`. Native fieldset props pass through.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | required | The question's id and the form field name of its answers. |
| `required` | `boolean` | from `items`, or `false` | Asks for an answer. Skip doesn't apply. |
| `multiple` | `boolean` | from `items`, or `false` | Turns the choices into checkboxes. |
| `disabled` | `boolean` | from `items`, or `false` | Leaves the question out of the flow, the progress and the submit, and disables its controls. |
| `invalid` | `boolean` | `false` | Marks the question invalid from your own validator. Put the message in its QuestionnaireError. |
| `onStatusChange` | `(status) => void` | - | Called when the status changes, not on the first render. |

It has `data-name`, `data-active`, `data-status`, `data-required`, `data-multiple`, `data-disabled` and `data-invalid`, and `aria-invalid="true"` while invalid. The current question is focusable with `tabIndex={-1}`, so navigation can move focus to it.

### QuestionnaireTitle, QuestionnaireDescription, QuestionnaireChoices

A `<legend>`, a `<p>` the item describes itself by, and a `<div>` that stacks the answers, with `data-shortcuts`.

### QuestionnaireChoice

A `<label>` around a native radio, or a checkbox in a multiple question, with a drawn dot or check, the children as the label, and the answer key when `shortcuts` is on. It takes `value`, `disabled` and the native label props. It has `data-type`, `data-checked`, `data-unchecked`, `data-disabled`, `data-invalid` and `data-shortcut`. A disabled choice never counts as an answer, gets no key, and never submits. In a required single-answer question, the radios are natively `required` for a page without a script only when the item's children show it has no freeform answer: a component of yours among them might render one, so the radios wait for the browser to look.

### QuestionnaireChoiceDescription

A `<span>` for more about a choice, below its text.

### QuestionnaireInput

A freeform answer: Input, with `data-slot="questionnaire-input"`. It takes the text-entry `type`s and Input's other props, but not `name`, `value` or `defaultValue`: its text comes from the answers. It submits under the question's name while its text is the answer. In a single-answer question, typing replaces the chosen choice, and picking a choice replaces the text, which stays in the box for later; emptying that box keeps the choice. Otherwise the box shows the answer's text, also when your `answers` keep it empty or clear it. Give it a name with a label, `aria-label` or `aria-labelledby`: a placeholder isn't one.

### QuestionnaireError

A `<p>` that stays hidden and empty until its question fails a check, then shows with `role="alert"`, an icon and the message: "Choose an answer to continue.", "Choose an answer or skip this question.", your `validate`'s message, or a refused submit's. Children replace the message. Outside a QuestionnaireItem, it shows a submit that failed. A repeated message is announced again.

### QuestionnaireActions

A `<div>` that wraps the actions onto more lines when they don't fit: Previous at the start, then Skip, and Next or Submit at the end.

### QuestionnairePrevious, QuestionnaireSkip, QuestionnaireNext, QuestionnaireSubmit

Buttons with Button's `variant` and `size`: outline for Previous and Skip, default for Next and Submit. Previous shows from the second question, Skip on an optional one, Next until the last, and Submit on the last; the others are `hidden` and `inert`. Each has `data-visible` or `data-hidden`, `data-status` of the current question, and `data-pending` while its own check or submit runs, when it shows a spinner and its `pendingLabel`. While anything runs, all four are `aria-disabled="true"` and keep focus. `disabled` disables one, and its keys with it, such as the Navigation state example's Next until the question has an answer.

## Behavior

| Key | Does |
| --- | --- |
| Tab, Shift+Tab | Moves between the answers and the actions that show |
| Up, Down | Moves between the answers, from the question, a choice or an empty text box. Radios also select, natively within their group |
| Left, Right | Outside text boxes and radios: the previous question, and the next once the current one has an answer or a skip. They swap in right-to-left text |
| Space | Picks a radio, toggles a checkbox, presses an action |
| Enter | On a picked choice or a filled answer: the next question, or a submit on the last. It never submits from an empty answer |
| Control or Command and Enter | Checks the current question and moves on, or submits on the last |
| A letter or number | With `shortcuts`, picks that choice and focuses it, without moving on. Keys pause while you type |

Navigation moves focus to the new question, whose legend and description name it, and the progress announces the position. A failed check opens the question's error and focuses its picked answer, or its first one. A failed submit goes back to the first question that needs an answer. After a refused submit, focus stays on Submit. A reset puts back the default answers and the first question, and clears the errors. An answer given before the script ran is kept.

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/questionnaire.tsx`, its classes in `apps/v4/registry/styles/style-vega.css`, its examples in `apps/v4/registry/bases/base/examples/questionnaire-example.tsx` and `apps/v4/examples/base/questionnaire-*.tsx`, the Questionnaire pages, and the headless Questionnaire in `packages/react/src/questionnaire/` at the pinned shadcn/ui commit.

| Upstream | RemixCN |
| --- | --- |
| `Questionnaire` on `Questionnaire.Root`, a form with `noValidate` | The same form. It's `novalidate` once it runs; without a script the browser validates, unless you pass `noValidate` |
| `item`, `defaultItem`, `onItemChange(item)` | The same, and `onItemChange` also gets a `reason` |
| `items` collection for server rendering and order | The same, and items take `required`, `multiple` and `disabled` from it; an item's own props win |
| `shortcuts` `"letters"` or `"numbers"` | The same |
| `noValidate` prop and `reportValidity` on the active item | The same `noValidate={false}`, checked per question, so the form itself never blocks on a hidden one |
| `onSubmit(event)` with the native event and `FormData` | `onSubmit(snapshot, details)` with every answer, the `FormData`, the submitter and an abort signal; it may be async |
| No async validation, pending or submit errors | `validate`, `data-pending`, `aria-busy`, waiting buttons with `pendingLabel`, `QuestionnaireSubmitError`, and the questionnaire's own QuestionnaireError |
| `onReset` | Your own `reset` listener in `mix`; `preventDefault()` keeps the questionnaire as it is |
| Development warnings for `items` that don't match the parts | Not ported |
| `QuestionnaireProgress` with `render(props, state)` | A function child with the same state |
| `QuestionnaireItem` with `name`, `required`, `multiple`, `disabled`, `invalid`, `onStatusChange` | The same |
| `QuestionnaireTitle` as `legend`, or `render` with the item's `aria-labelledby` | A `legend`, or your own heading with an id and the item's `aria-labelledby` |
| `QuestionnaireDescription` with `render` | A `p`; your own with an id and the item's `aria-describedby` |
| `QuestionnaireChoices` | The same |
| `QuestionnaireChoice` with `ChoiceInput` (an invisible native input over the row), `ChoiceLabel`, `ChoiceShortcut` and a drawn indicator | A label around a visible native radio or checkbox with `appearance: none`, the dot or check over it, the label and the key. Forced colors draw the system's control |
| `checked`, `defaultChecked`, `onChange` on a choice | `answers`, `defaultAnswers` and `onAnswersChange` on the questionnaire |
| `QuestionnaireChoiceDescription` | The same |
| `QuestionnaireInput` with `value`, `defaultValue`, `onChange`, `type`, `render` | Input with the same text-entry types; its text comes from the answers |
| `QuestionnaireError` with a contextual message, `role="alert"` | The same messages, an icon, a fresh announcement for a repeated message, and a questionnaire-level error outside items |
| `QuestionnaireActions` grid | A wrapping row, so long labels and large text fit a narrow screen |
| `QuestionnairePrevious`, `Skip`, `Next`, `Submit` on `buttonVariants`, `render` state | Button with `variant` and `size`; `data-status` and `data-visible` for the state, and `disabled` keeps the keys from it too |
| `aria-keyshortcuts` on the item, answers and actions | The same, once it runs |
| `ring-3` focus on the row, `data-checked:bg-muted`, `hover:bg-muted/50`, `dark:bg-input/20` | The theme's 2px outline on the row, the same colors through `light-dark()`, a checked row that keeps a 2px edge in forced colors |
| `data-active:animate-in` in the Animated example | `@starting-style` with the motion tokens, so reduced motion shows it at once |
| Examples: Standalone, Card, Dialog, No description, Disabled; docs: demo, multiple, freeform, skip, shortcuts, validation, controlled, resume, conditional, navigation state, progress, animated, card, dialog | `QuestionnaireDemo`, `QuestionnaireMultiple`, `QuestionnaireFreeform`, `QuestionnaireSkipExample`, `QuestionnaireShortcuts`, `QuestionnaireValidation` (an async check instead of Zod), `QuestionnaireControlled`, `QuestionnaireResume`, `QuestionnaireConditional`, `QuestionnaireNavigationState`, `QuestionnaireCustomProgress`, `QuestionnaireAnimated`, `QuestionnaireCard`, `QuestionnaireDialog`, `QuestionnaireDisabled`, plus `QuestionnaireSubmitting`, `QuestionnaireNativeForm` and `QuestionnaireRightToLeft`. A status line replaces the toasts |

## Accessibility checks

Automated (`bun run test`, `bun run test:browser`, `bun run test:e2e`). The browser and end-to-end tests run in Chromium, Firefox and WebKit:

- axe-core: no WCAG 2.2 A or AA violations on the examples, before and after hydration, in light and dark.
- Server HTML: one form, fieldsets with legends, named native radios, checkboxes and inputs, the default answers checked, progress and actions from `items`, descriptions and server-side errors in `aria-describedby`, keys in order, disabled questions out of the flow, and unique ids for two questionnaires. Hydration: no console errors or warnings, no duplicate ids, no nested forms, no references to missing ids, no empty alerts.
- Answers: single, multiple and freeform answers, a freeform answer your own component renders, also through hydration, a freeform answer that replaces a choice and back, an emptied box beside a picked choice, skips, disabled choices, choices removed or replaced under the same question, controlled answers with a declined choice, a declined text edit and a cleared text, answers a person changed before hydration and only those, and a snapshot with its `FormData`.
- Navigation: an item's own `required`, `disabled` and `multiple` over `items`, also on the server, Next on a required and an optional question, Previous that keeps answers, Skip, a submit that goes back to the first question without an answer, a controlled question that focus follows, questions turned off or replaced, a reset, and two questionnaires that stay apart.
- Checks and submits: an async check that waits, ignores presses, shows its message or its rejection, and aborts when the answer changes; a check that ends after the question changed; the browser's own checks with `noValidate={false}`; a pending submit that sends once; a Next or a submit dropped when an answer changes while its checks run, by a person or through `answers`, also a skip taken back; a rejection that keeps the answers, shows an alert and keeps focus, also where the person moved it while the submit ran; a refused answer that sends the person back; a native post after the checks, also without JavaScript.
- Keyboard: Tab, Up and Down, Left and Right (swapped in right-to-left text), Space, Enter, Control or Command and Enter, letter and number keys, keys paused while typing, and keys kept from a Next or Submit you disabled.
- Pointer: a click anywhere on a choice.
- Without JavaScript: every question shows, navigation and keys hide, Enter submits nothing, and the browser validates and posts the form.
- Cleanup: a running check aborts when the questionnaire goes away.
- Focus and colors: the theme's 2px outline on a choice's row and on the question, also in forced colors, where the rows keep their edges, the checked row a 2px edge, and the controls are the system's own; text at 4.5:1 or more in both themes. Reduced motion: no transitions, and the Animated example's question shows at once. Reflow: 320px wide without scrolling sideways, also at 200% text.

Not checked yet:

- Screen readers. Nobody has listened to the questions, the progress or the alerts in NVDA, JAWS, VoiceOver or TalkBack.
- Real touch devices, Safari itself and Windows High Contrast. Forced colors were emulated, and WebKit runs in CI only.
- A page that starts past an unanswered required question, submitted before the script runs: the browser may refuse the submit without showing the hidden question, until the script runs.

These checks show how the component behaves in three browser engines. They're not an accessibility certification.
