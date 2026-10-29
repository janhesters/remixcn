# Code Block

Code, terminal output, logs and diffs in a native `<pre>` and `<code>`, with an optional header, line numbers, line variants, tokens from your own highlighter, and a copy button.

- Source: `registry/ui/code-block.tsx`. Needs `registry/ui/button.tsx`, `registry/lib/icons.tsx`, `registry/lib/styles.ts` and `registry/lib/theme.css`.
- Examples: `registry/examples/code-block-example.tsx`. Run them with `bun run code-block-examples`.
- Upstream: shadcn/ui [`code-block.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/code-block.tsx), its [docs](https://ui.shadcn.com/docs/components/base/code-block), and its [examples](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/code-block-example.tsx).

## Usage

```tsx
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '#remixcn/ui/code-block.tsx'

<CodeBlock>
  <CodeBlockHeader>
    <CodeBlockTitle>Terminal</CodeBlockTitle>
    <CodeBlockActions>
      <CodeBlockCopyButton value={output} />
    </CodeBlockActions>
  </CodeBlockHeader>
  <CodeBlockContent>{output}</CodeBlockContent>
</CodeBlock>
```

## How it runs

Every part but the copy button is static HTML: the code, the line numbers, the variants and the scrolling all work without JavaScript.

`CodeBlockCopyButton` handles clicks, so it works once the browser runs it: inside a client entry of your app, as the examples are. It isn't a client entry itself, because it takes your mixins, which can't cross from the server to the browser. Until it runs, and on a page that only renders on the server, it's disabled. So it never looks ready while a click would do nothing.

## Composition

```text
CodeBlock
├── CodeBlockHeader
│   ├── CodeBlockTitle
│   └── CodeBlockActions
│       └── CodeBlockCopyButton
├── CodeBlockActions (floating, when there is no header)
├── CodeBlockContent
│   └── CodeBlockLine
└── CodeBlockFooter
```

- **Content.** `CodeBlockContent` takes a string or `CodeBlockLine` parts. A string renders as one text node, so it stays cheap while code streams in. With `lineNumbers`, a string is split into lines. Use `CodeBlockLine` for line variants and tokens.
- **Text, never HTML.** Remix escapes every string, so markup in the code renders as text and never runs. `CodeBlockContent` and `CodeBlockLine` leave out `innerHTML`, so code can't arrive as raw HTML through them.
- **Copying.** `CodeBlockCopyButton` copies its `value` exactly, line endings and blank lines included. Pass the same text you render.
- **Selections.** Line numbers and diff markers are generated content, so a selection leaves them out. Every line ends with a newline, which renders nothing, so a copied selection keeps its line breaks and blank lines. Firefox puts no break between the lines' boxes without it.
- **Floating actions.** Without a header, put `CodeBlockActions` directly inside `CodeBlock`. It floats at the top end, on its own surface, and shows while the pointer is over the block, while focus is inside it, on touch screens, and after a refused copy.
- **Actions.** `CodeBlockActions` holds any buttons. For a wrap toggle, keep the state yourself, pass it to `wrap`, and say it with `aria-pressed="true"` or `"false"`, as the Actions example does.
- **Show more.** Cap the content with a `css()` you pass in `mix`, such as `{ maxHeight: '10rem', overflowY: 'hidden' }`, and put a `Button` with `aria-expanded` and `aria-controls` in `CodeBlockFooter`. The Show more example shows it.
- **Height.** Cap the height with `mix={css({ maxHeight: '12rem' })}`. The content scrolls inside the block.
- **Streaming.** Render each new value as it arrives. Disable the copy button until the code is complete, and set `aria-busy="true"` on the content meanwhile, as the Streaming example does.
- **Title links.** To link the title to a file, wrap `CodeBlockTitle` in an `<a href>`. The header lets it shrink.
- **Overrides.** Each part renders `data-slot`, and the block `data-variant` and `data-size`, so an app rule in `@layer app` can target them. A `css()` you pass with `mix` renders after the part's own rule.

## Highlighting

RemixCN adds no highlighter. Run any highlighter you like, such as on the server or at build time, and pass its tokens to `CodeBlockLine`:

```tsx
import { CodeBlockContent, CodeBlockLine, splitTokenLines } from '#remixcn/ui/code-block.tsx'
import type { CodeBlockToken } from '#remixcn/ui/code-block.tsx'

// From your highlighter: one flat list, newlines included.
let tokens: CodeBlockToken[] = [
  { text: 'let', color: 'light-dark(#a40e26, #ff7b72)' },
  { text: ' total = ' },
  { text: '42', color: 'light-dark(#0550ae, #79c0ff)' },
  { text: '\n' },
]

<CodeBlockContent lineNumbers>
  {splitTokenLines(tokens).map((line, index) => (
    <CodeBlockLine key={index} tokens={line} />
  ))}
</CodeBlockContent>
```

- A token's text always renders as text.
- A token's `color` may be a hex color, a CSS color function such as `rgb()` or `oklch()`, a named color, `var(--token)`, or `light-dark()` of two of those. `light-dark()` follows the color scheme and `data-theme`. Any other value is dropped and the text keeps the block's color, so a token can't add other styles, end the style attribute, or load a URL.
- `splitTokenLines()` splits a flat list at newlines, keeps each piece in its color, and drops one trailing newline. It reads `\r\n` and `\r` too, also when a highlighter splits `\r\n` across two tokens, so the lines match the same code as a string. `splitCodeLines()` does the same for a string.
- Check your colors: on a removed or highlighted line they must still reach 4.5:1. The examples darken GitHub's light keyword red for that.
- You can also pass your own nodes as `CodeBlockLine` children. Remix escapes their text too.

## API

### `CodeBlock`

Takes every prop of a `<div>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'destructive'` | `'default'` | The tone: destructive for errors and failed output |
| `size` | `'default' \| 'sm'` | `'default'` | `sm` has tighter padding and smaller text, for tool output |

Renders `data-slot="code-block"`, `data-variant` and `data-size`.

### `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockActions`, `CodeBlockFooter`

Each takes every prop of a `<div>` and renders its `data-slot`: `code-block-header`, `code-block-title`, `code-block-actions` and `code-block-footer`. A title's icon sits inline before its text; a long title wraps.

### `CodeBlockContent`

Takes every prop of a `<pre>` but `innerHTML`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `children` | string or `CodeBlockLine` parts | | The code |
| `wrap` | `boolean` | `false` | Wraps long lines instead of scrolling |
| `lineNumbers` | `boolean` | `false` | Numbers each line. A string is split into lines |
| `startLine` | `number` | `1` | The number of the first line. A fraction is cut to a whole number; `NaN` and infinity count as `1` |
| `tabIndex` | `number` | `0` | Makes the content a tab stop, so keyboard users can scroll it. Pass `-1` to remove it |
| `dir` | `string` | `'ltr'` | Code reads left to right, also on a right-to-left page |

Renders `data-slot="code-block-content"`, and `data-wrap` and `data-numbered` when set. The `<code>` inside has `data-slot="code-block-code"`.

### `CodeBlockLine`

Takes every prop of a `<span>` but `innerHTML`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'added' \| 'removed' \| 'highlighted'` | `'default'` | Added and removed lines show a `+` or `−` marker as well as a tint |
| `tokens` | `CodeBlockToken[]` | | The line's highlighted tokens. Takes the place of children |

Renders `data-slot="code-block-line"` and `data-variant`, with the text in `code-block-line-content` and each token in `code-block-token`.

### `CodeBlockCopyButton`

Takes every prop of `Button` but `type`, `value`, `children` and `focusableWhenDisabled`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string` | required | The exact text to copy |
| `aria-label` | `string` | `'Copy'` | Its name while it waits for a click, such as `'Copy install command'` |
| `copiedLabel` | `string` | `'Copied'` | Its name and the status after a copy |
| `failedLabel` | `string` | `"Couldn't copy"` | Its name and the status when the browser refuses the copy |
| `variant`, `size` | Button's | `'ghost'`, `'icon-xs'` | Its look |
| `disabled` | `boolean` | `false` | Such as while the code still streams |
| `mix` | mixins | | Your mixins. They run before the copy, so `event.preventDefault()` in a click handler cancels it |

- It's always `type="button"`, so it never submits or resets a form.
- It shows the copied state, a check icon and `data-copied`, only once the clipboard confirms the write, and for two seconds (`codeBlockCopiedDuration`).
- When the browser refuses, or the page has no clipboard, such as on plain http, it shows an alert icon and `data-copy-failed` until the next copy or a new value.
- A status beside it, `data-slot="code-block-copy-status"` with `role="status"`, says "Copied" or "Couldn't copy". Each copy clears it first, so a second copy is announced again.
- A new `value` drops the copied or failed state and its timer. An answer from the clipboard for an earlier click or an earlier value, and a timer after removal, change nothing.

### Also exported

`splitCodeLines()`, `splitTokenLines()`, `codeBlockCopiedDuration`, and the lists `codeBlockVariantNames`, `codeBlockSizes` and `codeBlockLineVariantNames`. The types are `CodeBlockToken`, `CodeBlockProps`, `CodeBlockContentProps`, `CodeBlockLineProps`, `CodeBlockCopyButtonProps`, `CodeBlockVariant`, `CodeBlockSize` and `CodeBlockLineVariant`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `CodeBlock` with `variant` and `size` | Same | `dark:bg-input/30` becomes 15% of `--input`; see below |
| `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockActions`, `CodeBlockFooter` | Same parts and data attributes | The title wraps instead of truncating |
| `CodeBlockContent` with `wrap`, `lineNumbers`, `startLine`, `tabIndex={0}`, `dir="ltr"` | Same props and defaults | Drops `innerHTML`. Reads `\r\n` and `\r` as line breaks. A `startLine` that isn't a whole number can't write a style |
| `CodeBlockLine` with `added`, `removed`, `highlighted` | Same variants and markers | Every line ends with a newline. Upstream puts one only in empty lines, so Firefox selections join the lines |
| `CodeBlockCopyButton`, a ghost `icon-xs` Button | Same look, on RemixCN's Button | See the copy rows below |
| `navigator.clipboard.writeText(value)`, then `setCopied(true)` | Same write; the copied state waits for it | |
| `.catch(() => {})` | A visible alert icon, the name and status "Couldn't copy", and floating actions that stay visible | New: the brief asks to report a refused copy |
| `aria-label={copied ? "Copied" : "Copy"}` and a polite live region | Same, with `role="status"`, your own labels, and a cleared status before each copy | |
| The 2-second `setTimeout` in a `useEffect` | A timer in setup scope, cleared on removal (`handle.signal`) and on a new value | Late clipboard answers are dropped too |
| `onClick` and `...props` on the Button | `mix` and every other Button prop | Your click handler can cancel the copy. `type` is always `button` |
| — | Disabled until it runs in the browser | New: a server-only page shows it disabled rather than dead |
| `useHighlightedCode(code, language)` and `lib/highlighter.tsx` (Shiki) | `CodeBlockLine`'s `tokens` with `splitTokenLines()` | Not ported: Shiki is a package. Bring any highlighter's tokens. The catalog's `highlighter` and `use-highlighted-code` helpers are marked not shipped |
| `highlightCode()` on the server | Run your highlighter on the server and pass its tokens | Tokens serialize to JSON, so a client entry can take them as props |
| ANSI colors (`"ansi"`) | Not ported | Comes with the highlighter |
| `scroll-fade-x`, `scroll-fade-y` | Not ported | The fade lowers the contrast of the first and last characters. Firefox has no scroll-driven animations, so it would fade both edges at rest. The native scrollbar shows that code scrolls |
| `scrollbar-thin` | `scrollbar-width: thin` | |
| `has-[…:focus-visible]:ring-3` on the block | The theme's 2px outline around the block while its content has keyboard focus | Stays visible in forced colors |
| `[[data-slot=code-block]>&]:*:[button]:bg-background ring-1` | The floating actions get the surface and ring instead of each button | So a caller's own buttons sit on it too, and no rule depends on render order |
| `pointer-coarse:opacity-100` | `(hover: none), (pointer: coarse)` | |
| `content: counter(line) / ''` for line numbers | Same, behind `@supports` | Screen readers skip the numbers |
| `group-data-[size=sm]` and `group-has-data-[slot=…]` classes | Each part's own rule reacts to its block's attributes | |
| Docs: Basic, Header, Actions, Floating Actions, Line Numbers, Start Line, Wrap, Highlighted Lines, Diff, Height, Show More, Max Height, Size, Destructive, Syntax Highlighting, RTL | `CodeBlockPlain`, `CodeBlockWithHeader`, `CodeBlockWithActions`, `CodeBlockFloatingActions`, `CodeBlockLineNumbers`, `CodeBlockStartLine`, `CodeBlockWrap`, `CodeBlockHighlightedLines`, `CodeBlockDiff`, `CodeBlockHeight`, `CodeBlockShowMore`, `CodeBlockSmall`, `CodeBlockDestructive`, `CodeBlockHighlighted`, `CodeBlockRtl` | |
| Examples: Empty, Small Destructive, Wrap and Line Numbers, Diff Wrap and Highlighting, Header Edges, Single Line and Empty, Small Combinations, Streaming | `CodeBlockEmpty`, `CodeBlockSmallDestructive`, `CodeBlockWrapLineNumbers`, `CodeBlockDiffWrap`, `CodeBlockHeaderEdges`, `CodeBlockSingleLine`, `CodeBlockSmallCombinations`, `CodeBlockStreaming` | Streaming starts complete; Replay streams it again |
| Docs: Trace, Tabs, Message, Typeset, Markdown; examples: Card and Dialog, Chat Answer | Not yet | They need Trace, Tabs, Message, Card, Dialog or Streamdown, which other tickets port or which stay out |
| Docs: Languages, Terminal Output (ANSI) | Not ported | They need the highlighter |
| — | `CodeBlockUntrusted`, `CodeBlockInForm` | Untrusted output as text, and a copy button in a form |

### Where it looks different from shadcn

- **Titles wrap** instead of truncating, so a narrow screen or large text still shows the whole file name.
- **The dark block tint** is 15% of `--input`, not 30%. RemixCN's `--input` is lighter than shadcn's, to reach 3:1 as a border, so 30% would equal `--muted` and hide highlighted and added lines.
- **Removed lines** draw their `−` marker in red mixed with a quarter of `--foreground`, and their line numbers in `--muted-foreground` with a fifth of `--foreground`, to reach 4.5:1 on the red tint.
- **Floating actions** sit on one shared surface instead of a surface per button.
- **No scroll fade.** Code keeps full contrast to its edges.
- **In forced colors**, marked lines keep a bar at their start, since the tints disappear there.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Markup in the code, in lines and in tokens renders as text and never runs, also without JavaScript. Token colors that could add styles or load a URL are dropped.
- The copy button copies the exact value, line endings and blank lines included; Chromium's real clipboard reads it back.
- It shows and announces "Copied" only after the write succeeds, announces "Couldn't copy" when it's refused or there's no clipboard, clears the status before each copy, and goes back after two seconds.
- A new value drops the copied state and its timer; late answers for an earlier click or value change nothing; removal clears the timer.
- It copies with a click, Enter or Space, never submits or resets its form, copies nothing while disabled, and lets a caller's click handler cancel the copy. Several copy buttons keep their own state.
- Without JavaScript, and outside a client entry after hydration, copy buttons are disabled.
- Floating actions show on hover, when focus is inside the block, on touch screens, and after a refused copy; keyboard users reach them with Tab.
- The content is a tab stop that scrolls with the arrow keys; long code scrolls inside the block, and wrapped code doesn't scroll.
- A selection of numbered and diff lines copies without numbers or markers and keeps blank lines.
- Changing props, streaming code, Show more (`aria-expanded`, `aria-controls`) and the wrap toggle (`aria-pressed`) update in place.
- Code, titles, line numbers, diff markers and the examples' tokens are 4.5:1 or more in both themes; highlighted and added lines differ from the block in both.
- A focus ring shows around the block while its code has keyboard focus, also in forced colors; marked lines keep a bar in forced colors.
- Floating actions fade with the motion tokens, and not at all for reduced motion.
- The header and floating actions mirror in right-to-left text, while code and line numbers stay left to right.
- The page fits 320px without scrolling sideways, with normal text and at 200%.
- axe-core finds no WCAG 2.2 A or AA violations on the example page, before and after a copy.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested, so how they announce the status, the changing button name, and generated line numbers and markers is unverified.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows. Reading the real clipboard back was checked in Chromium only; Firefox and WebKit copy through a recording stub.
- Copying a selection was checked through `Selection.toString()`, not through the system clipboard.
- The touch-screen rule was checked where the engine's touch emulation matches `(hover: none), (pointer: coarse)`, and otherwise only as a rule in the style sheet. No real touch device was tested.
- The copy button's `icon-xs` size is 24px, the WCAG 2.2 AA minimum. Pass a larger `size` for touch-first screens.
- This isn't an accessibility certification.
