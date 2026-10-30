# Trace

A list of lines for the steps an agent takes, such as calling a tool, reading a file or thinking. A line can expand to show more, link to a page, or open a dialog or sheet.

- Source: `registry/ui/trace.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/icons.tsx` and `registry/ui/collapsible.tsx`.
- Examples: `registry/examples/trace-example.tsx`. Run them with `bun run trace-examples` (http://localhost:4429/).
- Upstream: shadcn/ui [`trace.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/trace.tsx), its Trace classes in `apps/v4/registry/styles/style-vega.css`, and its [docs](https://ui.shadcn.com/docs/components/base/trace).

Use Trace for the steps, [Message](message.md) for the reply, and [Marker](marker.md) for notes and dividers between turns. The AI Elements patterns built on Trace, such as Plan, Queue or Tool, aren't part of this port (C-978).

## Usage

```tsx
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '#remixcn/ui/trace.tsx'

<Trace>
  <TraceLine>
    <TraceIcon>
      <SearchIcon />
    </TraceIcon>
    <TraceTitle>Searched for minimumReleaseAge</TraceTitle>
  </TraceLine>
  <TraceCollapsible>
    <TraceCollapsibleTrigger>
      <TraceLine status="error">
        <TraceIcon>
          <TerminalIcon />
        </TraceIcon>
        <TraceTitle>Failed to run pnpm --version</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
    <TraceCollapsibleContent>command not found: pnpm</TraceCollapsibleContent>
  </TraceCollapsible>
</Trace>
```

`TraceLine` is always the line. To make a line do something, wrap it in that thing's trigger or in a link:

```text
Trace
├── TraceLine                      text, not a tab stop
│   ├── TraceIcon
│   ├── TraceTitle
│   ├── TraceDescription
│   └── TraceIcon
├── TraceCollapsible               a row that expands
│   ├── TraceCollapsibleTrigger    a native button with a chevron
│   │   └── TraceLine
│   └── TraceCollapsibleContent
├── <a href> → TraceLine           a link
└── DialogTrigger → TraceLine      a dialog, sheet or drawer
```

## How it runs

The lines, icons, titles and descriptions only render, so they work on a page that only renders on the server. `TraceCollapsible` is RemixCN's [Collapsible](collapsible.md): it works once the browser runs it inside your client entry, as the examples do, and isn't a client entry itself. Before that, the server HTML shows each row as it starts, open or closed, and the triggers do nothing. Hydration keeps that state. A link row is a native link, so it works without JavaScript.

## API

Every part takes its element's props and `mix`.

### `Trace`

A `<div data-slot="trace">` that stacks rows with a gap. It adds no role. It also styles a link or trigger that wraps a `TraceLine` directly inside it: the element becomes a row of text that fits its line, and a button drops its native box. These rules sit in `:where()`, so your own styles on the element win.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `announce` | `boolean` | not set: it follows the nearest outer `Trace`, which is off unless set | Reads status changes aloud. See [Announcing status](#announcing-status) |

### `TraceLine`

A `<span data-slot="trace-line">`: an icon, a title, and maybe a description and a trailing icon. It's text, not a tab stop. Long titles wrap; a description and a trailing icon move under a long title instead of squeezing it.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `status` | `'running' \| 'error' \| 'pending'` | not set: the work is done | Colors the line and, while running, shimmers its title. It renders as `data-status` |
| `statusLabel` | `string` | from `traceStatusLabels` | The words assistive technology hears after the title, such as "failed". `''` leaves them out, for a title that already says it |

| Status | Use for | Looks | Assistive technology hears |
| --- | --- | --- | --- |
| none | Work that is done: "Ran pnpm install" | Muted text | The title |
| `error` | Work that failed. Say so in the title: "Failed to run pnpm lint" | `--destructive` text, on hover too | The title, then "(failed)" |
| `running` | Work in progress, in the present tense: "Running pnpm build" | The title shimmers, still for reduced motion and plain in forced colors | The title, then "(in progress)" |
| `pending` | Work that hasn't started, such as a plan step: "Run pnpm test" | Its icons dim. Its text keeps its contrast | The title, then "(not started)" |

`traceStatuses` lists the statuses, and `traceStatusLabels` holds the default words.

### `TraceIcon`

A `<span data-slot="trace-icon" aria-hidden="true">`, 1rem wide and one line high, so it sits on the first line of a title that wraps. Before the title it names the action. After it, it's the indicator, such as a chevron for a dialog row or an arrow for a link to another site, and sits a little closer. Mirror an icon that points onward with `mirrorInRtl` from `styles.ts`, as the examples' chevrons and arrows do.

### `TraceTitle`

A `<span data-slot="trace-title">`. It names the line, so write a sentence that says what happened: "Edited trace.tsx", not "trace.tsx". It wraps, and breaks a long word such as a path, instead of truncating.

### `TraceDescription`

A `<span data-slot="trace-description">` after the title, for a count, a duration or a diff stat. It uses tabular figures. It moves under a long title instead of squeezing it.

### `TraceCollapsible`

A [Collapsible](collapsible.md) (`data-slot="trace-collapsible"`), with all its props: `open`, `defaultOpen`, `disabled` and `id`. Listen for its change with `on(collapsibleChangeType, …)` from `collapsible.tsx`, as with Collapsible. It renders `data-open` or `data-closed`, and `data-disabled`.

### `TraceCollapsibleTrigger`

A [CollapsibleTrigger](collapsible.md#collapsibletrigger) (`data-slot="trace-collapsible-trigger"`): a native `type="button"` with `aria-expanded`. Put a `TraceLine` in it. It adds a chevron after the line that turns down while the row is open, and takes the `--destructive` color when its line failed. A disabled row's trigger is natively disabled and dimmed.

### `TraceCollapsibleContent`

A [CollapsibleContent](collapsible.md#collapsiblecontent) (`data-slot="trace-collapsible-content"`) around an inner `<div data-slot="trace-collapsible-content-inner">`, which draws a line down its start edge and mutes its text. Your `class` and `mix` style the inner wrapper, as shadcn's `className` does, such as `white-space: pre-wrap` for reasoning or a flex row of badges. Every other prop reaches the panel, such as `keepMounted`, which keeps nested rows and their state while the row is closed, and `hiddenUntilFound`.

## Composition

- **Links.** Wrap the line in a native `<a>`. For a link to another site, add an arrow icon after the title and visually hidden " (opens in a new tab)" text inside the title, as `SourceLink` in the examples does.
- **Dialogs, sheets and drawers.** Wrap the line in `DialogTrigger`, `SheetTrigger` or `DrawerTrigger`. The dialog owns its open state, Escape and the return of focus.
- **Nested rows.** Put a `Trace` inside `TraceCollapsibleContent`. Each row toggles only itself. A row's change event bubbles through the rows around it, so a listener for one row checks `event.target === event.currentTarget`, as `onOwnChange` in the examples does.
- **Open while streaming.** To open a row while it streams and let the reader's click win, keep the reader's choice and pass `open={choice ?? running}`, as `ThinkingRow` in the examples does. This replaces shadcn's `open ?? running` with `onOpenChange`.
- **Static or expandable.** A row with nothing to show is a `TraceLine`. Once it has detail, wrap it in a `TraceCollapsible`.
- **Muted detail.** The detail mutes its text. A block with its own background inside it, such as a Code Block, sets its own text color.

### Announcing status

Colors and the shimmer show a status, and the hidden words after the title say it to assistive technology when someone reads the line. A change of status isn't read aloud by default, so a busy list doesn't talk over everything else.

Inside a [Message Scroller](message-scroller.md), new rows are read as they're added, because its content is a log. Set `announce` on a `Trace` to read changes of status aloud too. The list renders a visually hidden `role="status"` region, which screen readers read politely. When a line's `status` changes, the region says the line's text once the change renders, such as "Ran node --version" or "Failed to run pnpm --version (failed)". Lines that change in the same update are read as one message. The region says nothing when the page loads or when a line first appears. Nested lists follow their outer list; set `announce={false}` on one to keep it quiet.

A line is announced when the same line changes. Keep it in place while its status changes: render a tool call as a `TraceCollapsible` from the start, as `CommandRow` in the examples does. A line that moves into a trigger, or remounts, starts over, and its first status isn't read.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Trace` | `Trace`, a `<div>` | `*:has-[>[data-slot=trace-line]]` becomes `& > :where(:has(> [data-slot="trace-line"]))` in its own rule, with a reset for native buttons that Tailwind's preflight gave upstream |
| — | `announce` on `Trace` | New. The ticket asks for an announcement option instead of an always-on live region |
| `TraceLine` with `status` | Same | `in-[a,button]` becomes `:where(a[href], button:enabled) &` in the line's own rule |
| — | `statusLabel`, `traceStatusLabels`, `traceStatuses` | New: hidden words for the status |
| `data-[status=pending]:opacity-60` | Dims the line's icons only | Text at 60% opacity falls to about 2.4:1 in light mode |
| `data-[status=running]:*:data-[slot=trace-title]:shimmer` | `shimmer()` from `styles.ts` on the title, keyed to the running line | Still for reduced motion, plain in forced colors. Its highlight keeps 4.5:1 |
| `TraceIcon` | Same | `[[data-slot=trace-title]~&]:-ml-1` becomes the icon's own rule. One line high instead of `size-4`, so it sits on a wrapped title's first line |
| `TraceTitle` with `truncate` | Wraps | Truncated text is lost on a narrow screen. A long title keeps the room its icons leave, and a description moves under it |
| `TraceDescription` with `text-muted-foreground/70` | `--muted-foreground` | 70% of the muted color misses 4.5:1 in light mode. It moves under a long title instead of `shrink-0` |
| `TraceCollapsible` on Base UI's Collapsible | On RemixCN's Collapsible | `onOpenChange` becomes `collapsibleChangeType`. Upstream's type that requires `onOpenChange` with `open` has no equivalent: a controlled row changes when its owner renders it |
| `TraceCollapsibleTrigger` with a chevron | Same | The chevron is RemixCN's `ChevronRightIcon`, turns over `--duration-normal`, and mirrors in right-to-left text. Its square icon turns, not its line-high box, so it can't stick out sideways |
| `TraceCollapsibleContent` with `className` on the inner div | `class` and `mix` on the inner div | Height moves with Collapsible's own transition, `--duration-normal` (shadcn's `duration-200`), and is 0s for reduced motion. The detail sets `text-sm` and `leading-relaxed`, so its size doesn't depend on the page |
| `focus-visible:ring-3 ring-ring/50`, `outline-none` | The theme's 2px outline | Stays visible in forced colors |
| `in-[a:hover,button:hover]:text-foreground`, `hover:text-foreground` | Same, only on enabled buttons and links with `href` | |
| `has-[[data-status=error]]:text-destructive` on the trigger | Same | |
| Docs: Demo, Trace Line, Status, Description, Collapsible, Open State, Link, Dialog, Sheet, Group, Sources, Chain of Thought, Commit, Whole Turn, Reasoning, Tool | `TraceDemo`, `TraceStatic`, `TraceStatus`, `TraceDescriptionDemo`, `TraceCollapsibleDemo`, `TraceOpen`, `TraceLink`, `TraceDialog`, `TraceSheet`, `TraceGroupDemo`, `TraceSources`, `TraceSteps`, `TraceCommit`, `TraceTurn`, `TraceThinking`, `TraceToolCalls` | The AI SDK's `useChat` and its scripted transport become timers that stop when the example leaves or starts again. Upstream's kitchen-sink `trace-example.tsx` shows the same compositions: Chat is `TraceDemo`, Rows are `TraceLink`, `TraceDialog`, `TraceSheet` and `TraceCollapsibleDemo`, Task is `TraceSteps` |
| Docs: Accessibility, "Inside a Message Scroller, each line is announced once" | Same, and `announce` | RemixCN's Message Scroller content is a `role="log"` that reads new rows. `announce` adds the changes of status, which a log doesn't read |

### Where it looks different from shadcn

- **Titles wrap.** A long title wraps instead of ending in an ellipsis, and a description or trailing icon that doesn't fit beside it moves under it.
- **Pending text keeps its color.** Only a pending line's icons dim.
- **Descriptions are as dark as the line.** shadcn's are lighter, below 4.5:1.
- **Chevrons mirror.** In right-to-left text, the trigger's chevron and the examples' onward icons point left.
- **The examples use invented sites.** Links point to `example.com` addresses.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Lines are text and no tab stop. Icons are hidden from assistive technology. A row's trigger, link or dialog trigger is named by its line: the title, the hidden status words and the description.
- Enter, Space and clicks open and close a row. Tab reaches link rows and triggers.
- A controlled row changes through its owner, from the row's trigger or another button. Nested rows report only their own changes to a listener that checks the target.
- When a row closes while focus is inside it, also from a nested row, focus moves to its trigger, and Tab skips the closed detail. A kept panel keeps nested rows' state.
- A dialog row opens with Enter and returns focus to the row on Escape.
- With `announce`, status changes are read through one polite region, together when they change at once, and the same words again. Nothing is read on load, when a call starts, or in a list set to `announce={false}`.
- The server renders the first state, and hydration keeps it. Without JavaScript, triggers do nothing and submit nothing, and link rows work.
- Titles, descriptions and detail text reach 4.5:1 in every status and both themes, and a running title keeps 4.5:1 through its whole shimmer.
- The shimmer and the chevron's turn stop for reduced motion. Running titles are plain text in forced colors. Triggers, link rows and dialog rows show the 2px focus ring, also in forced colors.
- Chevrons and onward icons mirror, and lines start on the right, in right-to-left text.
- Long titles, long words and long detail wrap, and a description moves under a long title. The page fits 320px without scrolling sideways, with normal text and at 200%.
- axe-core finds no WCAG 2.2 A or AA violations on the example page in either color scheme, with rows open and a run finished.

Not checked, so not claimed:

- How screen readers (NVDA, JAWS, VoiceOver, TalkBack) read the hidden status words and the announcements. Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated, not tested in Windows.
- This isn't an accessibility certification.
