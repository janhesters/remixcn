// RemixCN Trace examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, Icon, SearchIcon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl, visuallyHidden } from '#remixcn/lib/styles.ts'
import { Badge } from '#remixcn/ui/badge.tsx'
import { Bubble, BubbleContent } from '#remixcn/ui/bubble.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { CodeBlock, CodeBlockContent, CodeBlockLine } from '#remixcn/ui/code-block.tsx'
import type { CodeBlockLineVariant } from '#remixcn/ui/code-block.tsx'
import { collapsibleChangeType } from '#remixcn/ui/collapsible.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import { Message, MessageContent } from '#remixcn/ui/message.tsx'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '#remixcn/ui/sheet.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '#remixcn/ui/trace.tsx'
import type { TraceStatus } from '#remixcn/ui/trace.tsx'

// Examples without a collapsible, dialog or simulated run render on the
// server only. The others handle events, so each is a client entry. Before
// the browser runs one, it shows the rows as they start.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const widthStyles = css({ width: '100%', maxWidth: '24rem' })
const preWrapStyles = css({ whiteSpace: 'pre-wrap' })
const badgesStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(1.5) })
const outputStyles = css({ maxHeight: '16rem' })
const monoStyles = css({ fontFamily: 'var(--font-mono)' })
const onwardStyles = css(mirrorInRtl)
const visuallyHiddenStyles = css(visuallyHidden)
const openStyles = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: space(4),
  width: '100%',
  maxWidth: '24rem',
})
const turnStyles = css({ display: 'flex', flexDirection: 'column', gap: space(2), '& > p': { margin: 0 } })
const sheetListStyles = css({
  display: 'grid',
  gap: space(2),
  margin: 0,
  paddingInline: space(4),
  listStyle: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  overflowWrap: 'anywhere',
})
const diffStyles = css({ marginInline: space(4), marginBlockEnd: space(4) })
const hunkStyles = css({ color: 'var(--muted-foreground)' })
const chatStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(4),
  width: '100%',
  maxWidth: '24rem',
  minHeight: '18rem',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& p': { margin: 0 },
})
const sendStyles = css({ marginBlockStart: 'auto', alignSelf: 'flex-start' })

function TerminalIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 7.5 9.5 12 5 16.5M12 17h7" />
    </Icon>
  )
}

function FileTextIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M9 13h6M9 16.5h6" />
    </Icon>
  )
}

function FilePenIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M11 20.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h7l5 5v2.5" />
      <path d="M14 3.5v5h5M20 14.5l-5.5 5.5-2.5.5.5-2.5 5.5-5.5a1.4 1.4 0 0 1 2 2Z" />
    </Icon>
  )
}

function FilePlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M12 11.5v6M9 14.5h6" />
    </Icon>
  )
}

function FolderSearchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M10.5 19.5h-5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v2" />
      <circle cx="16" cy="15.5" r="3" />
      <path d="m20.5 20-2.4-2.4" />
    </Icon>
  )
}

function GlobeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </Icon>
  )
}

/** A light bulb, for a step of thinking. */
function IdeaIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </Icon>
  )
}

function ArrowUpRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </Icon>
  )
}

function CircleIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="9" />
    </Icon>
  )
}

function GitBranchIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="6" cy="5.5" r="2.5" />
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="7.5" r="2.5" />
      <path d="M6 8v8M18 10a6 6 0 0 1-6 6H8.5" />
    </Icon>
  )
}

function GitCommitIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12h5.5M15.5 12H21" />
    </Icon>
  )
}

/** A chevron after the title, for a row that opens something elsewhere. It mirrors in right-to-left text. */
function OnwardIcon() {
  return () => (
    <TraceIcon mix={onwardStyles}>
      <ChevronRightIcon />
    </TraceIcon>
  )
}

/** A link row to another site, which says it opens a new tab. */
function SourceLink(handle: Handle<{ href: string; title: string }>) {
  return () => (
    <a href={handle.props.href} target="_blank" rel="noreferrer">
      <TraceLine>
        <TraceIcon>
          <GlobeIcon />
        </TraceIcon>
        <TraceTitle>
          {handle.props.title}
          <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
        </TraceTitle>
        <TraceIcon mix={onwardStyles}>
          <ArrowUpRightIcon />
        </TraceIcon>
      </TraceLine>
    </a>
  )
}

function VisuallyHidden(handle: Handle<{ children?: RemixNode }>) {
  return () => <span mix={visuallyHiddenStyles}>{handle.props.children}</span>
}

function Output(handle: Handle<{ children: string; failed?: boolean }>) {
  return () => (
    <CodeBlock size="sm" variant={handle.props.failed ? 'destructive' : 'default'}>
      <CodeBlockContent wrap mix={outputStyles}>
        {handle.props.children}
      </CodeBlockContent>
    </CodeBlock>
  )
}

/** One line on its own: plain text, not a tab stop. */
export function TraceStatic() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceLine>
        <TraceIcon>
          <GitBranchIcon />
        </TraceIcon>
        <TraceTitle>Created branch fix/frozen-lockfile</TraceTitle>
      </TraceLine>
    </Trace>
  )
}

/** Done, failed, running and not started. Each title says its state, and the icons differ by shape. */
export function TraceStatus() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceLine>
        <TraceIcon>
          <CircleCheckIcon />
        </TraceIcon>
        <TraceTitle>Ran pnpm install</TraceTitle>
      </TraceLine>
      <TraceLine status="error">
        <TraceIcon>
          <CircleAlertIcon />
        </TraceIcon>
        <TraceTitle>Failed to run pnpm lint</TraceTitle>
      </TraceLine>
      <TraceLine status="running">
        <TraceIcon>
          <Spinner decorative />
        </TraceIcon>
        <TraceTitle>Running pnpm build</TraceTitle>
      </TraceLine>
      <TraceLine status="pending">
        <TraceIcon>
          <CircleIcon />
        </TraceIcon>
        <TraceTitle>Run pnpm test</TraceTitle>
      </TraceLine>
    </Trace>
  )
}

/** A diff stat, a duration and a count after the titles. A long title wraps. */
export function TraceDescriptionDemo() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceLine>
        <TraceIcon>
          <FilePenIcon />
        </TraceIcon>
        <TraceTitle>Edited components/settings/notification-preferences-form.tsx</TraceTitle>
        <TraceDescription mix={monoStyles}>+48 −12</TraceDescription>
      </TraceLine>
      <TraceLine>
        <TraceIcon>
          <TerminalIcon />
        </TraceIcon>
        <TraceTitle>Ran pnpm test</TraceTitle>
        <TraceDescription>14s</TraceDescription>
      </TraceLine>
      <TraceLine>
        <TraceIcon>
          <SearchIcon />
        </TraceIcon>
        <TraceTitle>Searched for useChat</TraceTitle>
        <TraceDescription>8 results</TraceDescription>
      </TraceLine>
    </Trace>
  )
}

/** Rows next to each other in one list. */
export function TraceGroupDemo() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceLine>
        <TraceIcon>
          <SearchIcon />
        </TraceIcon>
        <TraceTitle>Searched for minimumReleaseAge</TraceTitle>
      </TraceLine>
      <TraceLine>
        <TraceIcon>
          <FileTextIcon />
        </TraceIcon>
        <TraceTitle>Read pnpm-workspace.yaml</TraceTitle>
      </TraceLine>
      <TraceLine>
        <TraceIcon>
          <TerminalIcon />
        </TraceIcon>
        <TraceTitle>Ran pnpm install</TraceTitle>
      </TraceLine>
    </Trace>
  )
}

/** Native links: one to this page, one to another site in a new tab. */
export function TraceLink() {
  return () => (
    <Trace mix={widthStyles}>
      <a href="#trace-link">
        <TraceLine>
          <TraceIcon>
            <FileTextIcon />
          </TraceIcon>
          <TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
          <OnwardIcon />
        </TraceLine>
      </a>
      <SourceLink href="https://example.com/docs/install" title="Install the CLI | example.com" />
    </Trace>
  )
}

/** A row that expands to show a command's output. */
export const TraceCollapsibleDemo = clientEntry(import.meta.url, function TraceCollapsibleDemo() {
  return () => (
    <TraceCollapsible mix={widthStyles}>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceIcon>
            <TerminalIcon />
          </TraceIcon>
          <TraceTitle>Ran node --version</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <Output>{'$ node --version\nv24.18.0'}</Output>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
})

/**
 * A row that starts open, and one its owner controls: the button and the
 * row's own trigger both change it, through the change event.
 */
export const TraceOpen = clientEntry(import.meta.url, function TraceOpen(handle: Handle) {
  let open = false

  function toggle(next: boolean) {
    open = next
    void handle.update()
  }

  return () => (
    <div mix={openStyles}>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <TerminalIcon />
            </TraceIcon>
            <TraceTitle>Ran node --version</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Output>{'$ node --version\nv24.18.0'}</Output>
        </TraceCollapsibleContent>
      </TraceCollapsible>
      <TraceCollapsible open={open} mix={on(collapsibleChangeType, (event) => toggle(event.open))}>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <TerminalIcon />
            </TraceIcon>
            <TraceTitle>Ran pnpm --version</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Output>{'$ pnpm --version\n10.33.4'}</Output>
        </TraceCollapsibleContent>
      </TraceCollapsible>
      <Button variant="outline" size="sm" mix={on('click', () => toggle(!open))}>
        {open ? 'Hide' : 'Show'} the pnpm output
      </Button>
    </div>
  )
})

const searchResults = [
  { title: 'Caching build outputs', href: 'https://example.com/docs/caching' },
  { title: 'Image optimization reference', href: 'https://example.com/docs/images' },
  { title: 'Deploy hooks and cache keys', href: 'https://example.com/docs/deploy-hooks' },
]

/** A row that opens a dialog. The dialog owns its open state, Escape and the return of focus. */
export const TraceDialog = clientEntry(import.meta.url, function TraceDialog() {
  return () => (
    <Trace mix={widthStyles}>
      <Dialog>
        <DialogTrigger>
          <TraceLine>
            <TraceIcon>
              <GlobeIcon />
            </TraceIcon>
            <TraceTitle>Searched the web for cache keys</TraceTitle>
            <OnwardIcon />
          </TraceLine>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Searched the web for cache keys</DialogTitle>
            <DialogDescription>Three results were used in the response.</DialogDescription>
          </DialogHeader>
          <Trace>
            {searchResults.map((result) => (
              <SourceLink key={result.href} href={result.href} title={result.title} />
            ))}
          </Trace>
        </DialogContent>
      </Dialog>
    </Trace>
  )
})

/** A row that opens a sheet with the files it read. Drawer and Popover work the same way. */
export const TraceSheet = clientEntry(import.meta.url, function TraceSheet() {
  return () => (
    <Trace mix={widthStyles}>
      <Sheet>
        <SheetTrigger>
          <TraceLine>
            <TraceIcon>
              <FolderSearchIcon />
            </TraceIcon>
            <TraceTitle>Explored 4 files</TraceTitle>
            <OnwardIcon />
          </TraceLine>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Explored 4 files</SheetTitle>
            <SheetDescription>Files read while preparing the response.</SheetDescription>
          </SheetHeader>
          <ul mix={sheetListStyles}>
            <li>apps/v4/lib/docs.ts</li>
            <li>apps/v4/lib/components.ts</li>
            <li>apps/v4/next.config.mjs</li>
            <li>apps/v4/package.json</li>
          </ul>
        </SheetContent>
      </Sheet>
    </Trace>
  )
})

const sources = [
  { title: 'Install the CLI | example.com', href: 'https://example.com/docs/install' },
  { title: 'create-app | packages.example.com', href: 'https://packages.example.com/create-app' },
  { title: 'Settings: minimumReleaseAge | example.com', href: 'https://example.com/settings#minimum-release-age' },
]

/** A row whose detail is a list of link rows. */
export const TraceSources = clientEntry(import.meta.url, function TraceSources() {
  return () => (
    <TraceCollapsible defaultOpen mix={widthStyles}>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceIcon>
            <GlobeIcon />
          </TraceIcon>
          <TraceTitle>Used {sources.length} sources</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <Trace>
          {sources.map((source) => (
            <SourceLink key={source.href} href={source.href} title={source.title} />
          ))}
        </Trace>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
})

/**
 * A chain of thought: a summary that expands into the steps behind it. The
 * summary's status and title follow its steps, and its kept detail keeps
 * their state while it's closed.
 */
export const TraceSteps = clientEntry(import.meta.url, function TraceSteps() {
  return () => (
    <TraceCollapsible defaultOpen mix={widthStyles}>
      <TraceCollapsibleTrigger>
        <TraceLine status="running">
          <TraceTitle>Looking into the slow deploy</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent keepMounted>
        <Trace>
          <TraceCollapsible>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceIcon>
                  <SearchIcon />
                </TraceIcon>
                <TraceTitle>Searched for the checkout build log</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent mix={badgesStyles}>
              <Badge variant="secondary">docs.example.com</Badge>
              <Badge variant="secondary">status.example.com</Badge>
            </TraceCollapsibleContent>
          </TraceCollapsible>
          <a href="#trace-steps">
            <TraceLine>
              <TraceIcon>
                <FileTextIcon />
              </TraceIcon>
              <TraceTitle>Read the last twelve deploys</TraceTitle>
              <OnwardIcon />
            </TraceLine>
          </a>
          <TraceCollapsible>
            <TraceCollapsibleTrigger>
              <TraceLine status="running">
                <TraceIcon>
                  <SearchIcon />
                </TraceIcon>
                <TraceTitle>Searching for the cache key</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <Output>cache key image optimization</Output>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        </Trace>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
})

const changedFiles = [
  {
    path: 'app/login/page.tsx',
    added: false,
    additions: 2,
    deletions: 2,
    diff: [
      '@@ -14,7 +14,7 @@ export default async function LoginPage({',
      '   searchParams,',
      ' }) {',
      '   const { next } = await searchParams',
      '-  const redirectTo =',
      '-    next && next.startsWith("/") ? next : "/"',
      '+  const redirectTo = safeRedirect(next)',
      '+',
      '   return <LoginForm redirectTo={redirectTo} />',
      ' }',
    ],
  },
  {
    path: 'lib/auth/redirect.ts',
    added: true,
    additions: 7,
    deletions: 0,
    diff: [
      '@@ -0,0 +1,7 @@',
      '+export function safeRedirect(next: string | undefined) {',
      '+  if (!next || !next.startsWith("/") || next.startsWith("//")) {',
      '+    return "/"',
      '+  }',
      '+',
      '+  return next',
      '+}',
    ],
  },
]

function lineVariant(line: string): CodeBlockLineVariant {
  return line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : 'default'
}

function Diff(handle: Handle<{ lines: string[] }>) {
  return () => (
    <CodeBlock mix={diffStyles}>
      <CodeBlockContent>
        {handle.props.lines.map((line, index) =>
          line.startsWith('@@') ? (
            <CodeBlockLine key={index} mix={hunkStyles}>
              {line}
            </CodeBlockLine>
          ) : (
            <CodeBlockLine key={index} variant={lineVariant(line)}>
              {line.slice(1)}
            </CodeBlockLine>
          ),
        )}
      </CodeBlockContent>
    </CodeBlock>
  )
}

/** A commit: a row for each changed file, with its line counts, that opens its diff in a sheet. */
export const TraceCommit = clientEntry(import.meta.url, function TraceCommit() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <GitCommitIcon />
            </TraceIcon>
            <TraceTitle>Committed a1b2c3: Fix the login redirect</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {changedFiles.map((file) => (
              <Sheet key={file.path}>
                <SheetTrigger>
                  <TraceLine>
                    <TraceIcon>{file.added ? <FilePlusIcon /> : <FilePenIcon />}</TraceIcon>
                    <TraceTitle>
                      {file.added ? 'Added' : 'Edited'} {file.path}
                    </TraceTitle>
                    <TraceDescription mix={monoStyles}>
                      +{file.additions} −{file.deletions}
                    </TraceDescription>
                    <OnwardIcon />
                  </TraceLine>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle mix={monoStyles}>{file.path}</SheetTitle>
                    <SheetDescription>
                      {file.additions} additions, {file.deletions} deletions
                    </SheetDescription>
                  </SheetHeader>
                  <Diff lines={file.diff} />
                </SheetContent>
              </Sheet>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
})

const reasoning =
  'I should check which package managers are installed before I scaffold anything. Node comes first, since every other tool needs it, then pnpm, which the workspace file asks for.'

/** A whole turn on three levels: the turn, a summary, and the rows. Text between steps sits between two lists. */
export const TraceTurn = clientEntry(import.meta.url, function TraceTurn() {
  return () => (
    <TraceCollapsible defaultOpen mix={widthStyles}>
      <TraceCollapsibleTrigger>
        <TraceLine status="error">
          <TraceTitle>Worked for 2m 4s, 1 command failed</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent keepMounted mix={turnStyles}>
        <Trace>
          <TraceCollapsible>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceIcon>
                  <IdeaIcon />
                </TraceIcon>
                <TraceTitle>Thought</TraceTitle>
                <TraceDescription>12s</TraceDescription>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent mix={preWrapStyles}>{reasoning}</TraceCollapsibleContent>
          </TraceCollapsible>
          <TraceCollapsible defaultOpen>
            <TraceCollapsibleTrigger>
              <TraceLine status="error">
                <TraceIcon>
                  <TerminalIcon />
                </TraceIcon>
                <TraceTitle>Ran 2 commands, 1 failed</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent keepMounted>
              <Trace>
                <TraceLine>
                  <TraceIcon>
                    <TerminalIcon />
                  </TraceIcon>
                  <TraceTitle>Ran node --version</TraceTitle>
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
                  <TraceCollapsibleContent>
                    <Output failed>command not found: pnpm</Output>
                  </TraceCollapsibleContent>
                </TraceCollapsible>
              </Trace>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        </Trace>
        <p>Node is installed and pnpm is not. Reading the docs config.</p>
        <Trace>
          <a href="#trace-turn">
            <TraceLine>
              <TraceIcon>
                <FileTextIcon />
              </TraceIcon>
              <TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
              <OnwardIcon />
            </TraceLine>
          </a>
        </Trace>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
})

/**
 * Plays timed steps, the way a streamed response arrives, and renders after
 * each. Starting again or leaving the page stops the steps still waiting.
 */
function createPlayer(handle: Handle) {
  let run: AbortController | undefined
  handle.signal.addEventListener('abort', () => run?.abort())

  return {
    play(steps: Array<[delay: number, apply: () => void]>) {
      run?.abort()
      let controller = new AbortController()
      run = controller
      let at = 0
      let timers = steps.map(([delay, apply]) => {
        at += delay
        return setTimeout(() => {
          apply()
          void handle.update()
        }, at)
      })
      controller.signal.addEventListener('abort', () => timers.forEach(clearTimeout))
    },
    stop() {
      run?.abort()
    },
  }
}

/** Calls back for the row's own change only: a nested row's change event bubbles through it too. */
function onOwnChange(handler: (open: boolean) => void) {
  return on<HTMLDivElement, typeof collapsibleChangeType>(collapsibleChangeType, (event) => {
    if (event.target === event.currentTarget) handler(event.open)
  })
}

/**
 * Reasoning: a line until the first words arrive, then a row that opens
 * while it streams. Once the reader opens or closes it, their choice wins.
 */
function ThinkingRow(handle: Handle<{ text: string; running: boolean; title?: string }>) {
  let open: boolean | undefined
  let running = false

  return () => {
    let { text, title = 'Thought' } = handle.props
    // A new run starts with the row following the stream again.
    if (handle.props.running && !running) open = undefined
    running = handle.props.running

    let line = (
      <TraceLine status={running ? 'running' : undefined}>
        <TraceIcon>
          <IdeaIcon />
        </TraceIcon>
        <TraceTitle>{running ? 'Thinking' : title}</TraceTitle>
      </TraceLine>
    )
    if (!text) return line

    return (
      <TraceCollapsible
        open={open ?? running}
        mix={onOwnChange((next) => {
          open = next
          void handle.update()
        })}
      >
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent mix={preWrapStyles}>{text}</TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }
}

interface Command {
  command: string
  output?: string
  error?: string
}

type CommandState = 'running' | 'done'

/**
 * A command: a row from the start, so its line stays in place and an
 * announcing list reads the change from running to done or failed.
 */
function CommandRow(handle: Handle<{ command: Command; state: CommandState }>) {
  return () => {
    let { command, state } = handle.props
    let failed = state === 'done' && command.error !== undefined
    let status: TraceStatus | undefined = state === 'running' ? 'running' : failed ? 'error' : undefined
    let title = state === 'running' ? 'Running' : failed ? 'Failed to run' : 'Ran'
    let output =
      state === 'running' ? `$ ${command.command}` : `$ ${command.command}\n${command.error ?? command.output}`

    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              <TerminalIcon />
            </TraceIcon>
            <TraceTitle>
              {title} {command.command}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Output failed={failed}>{output}</Output>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }
}

function Question(handle: Handle<{ children: string }>) {
  return () => (
    <Message align="end">
      <MessageContent>
        <Bubble align="end" variant="muted">
          <BubbleContent>{handle.props.children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

function Answer(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <Message>
      <MessageContent>{handle.props.children}</MessageContent>
    </Message>
  )
}

function SendButton(handle: Handle<{ busy: boolean; sent: boolean; onSend: () => void; onReset: () => void }>) {
  return () => {
    let { busy, sent, onSend, onReset } = handle.props

    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        focusableWhenDisabled
        mix={[sendStyles, on('click', () => (sent ? onReset() : onSend()))]}
      >
        {sent ? 'Reset' : 'Send message'}
      </Button>
    )
  }
}

const thinkingQuestion = 'Why is the checkout deploy so slow?'
const thinkingText =
  'The build log shows install and compile finish in under a minute. Image optimization takes almost four, and it reruns on every deploy because the cache key includes the commit hash.'
const thinkingAnswer =
  'Image optimization is the bottleneck. Key its cache on the lockfile and the image directory instead of the commit hash.'

/** Streamed reasoning, played from a script: the row opens while it streams and closes when it's done. */
export const TraceThinking = clientEntry(import.meta.url, function TraceThinking(handle: Handle) {
  let player = createPlayer(handle)
  let words = thinkingText.split(' ')
  let phase: 'idle' | 'thinking' | 'answered' = 'idle'
  let shown = 0

  function send() {
    phase = 'thinking'
    shown = 0
    void handle.update()
    player.play([
      [400, () => {}],
      ...words.map((): [number, () => void] => [40, () => void shown++]),
      [400, () => void (phase = 'answered')],
    ])
  }

  function reset() {
    player.stop()
    phase = 'idle'
    void handle.update()
  }

  return () => (
    <div mix={chatStyles}>
      {phase === 'idle' ? null : <Question>{thinkingQuestion}</Question>}
      {phase === 'idle' ? null : (
        <Answer>
          <Trace>
            <ThinkingRow text={words.slice(0, shown).join(' ')} running={phase === 'thinking'} />
          </Trace>
          {phase === 'answered' ? <p>{thinkingAnswer}</p> : null}
        </Answer>
      )}
      <SendButton busy={phase === 'thinking'} sent={phase !== 'idle'} onSend={send} onReset={reset} />
    </div>
  )
})

const toolQuestion = 'Which package managers are installed?'
const toolCommands: Command[] = [
  { command: 'node --version', output: 'v24.18.0' },
  { command: 'npm --version', output: '11.6.2' },
  { command: 'pnpm --version', error: 'command not found: pnpm' },
]
const toolAnswer = 'Node 24 and npm 11 are installed. pnpm is not.'

/**
 * Tool calls, played from a script, in a list that announces each change
 * of status, such as "Ran node --version", to screen readers.
 */
export const TraceToolCalls = clientEntry(import.meta.url, function TraceToolCalls(handle: Handle) {
  let player = createPlayer(handle)
  let started = 0
  let finished = 0
  let answered = false
  let sent = false

  function send() {
    sent = true
    started = finished = 0
    answered = false
    void handle.update()
    player.play([
      ...toolCommands.flatMap((_, index): Array<[number, () => void]> => [
        [300, () => void (started = index + 1)],
        [700, () => void (finished = index + 1)],
      ]),
      [300, () => void (answered = true)],
    ])
  }

  function reset() {
    player.stop()
    sent = false
    started = finished = 0
    void handle.update()
  }

  return () => (
    <div mix={chatStyles}>
      {sent ? <Question>{toolQuestion}</Question> : null}
      {sent ? (
        <Answer>
          <Trace announce>
            {toolCommands.slice(0, started).map((command, index) => (
              <CommandRow key={command.command} command={command} state={index < finished ? 'done' : 'running'} />
            ))}
          </Trace>
          {answered ? <p>{toolAnswer}</p> : null}
        </Answer>
      ) : null}
      <SendButton busy={sent && !answered} sent={sent} onSend={send} onReset={reset} />
    </div>
  )
})

const demoQuestion = 'Why does pnpm install fail in CI?'
const demoReasoning =
  'CI installs with a frozen lockfile, so the install stops when package.json and pnpm-lock.yaml disagree. I should check what the last commit changed, then reproduce the install.'
const demoCommands: Command[] = [
  { command: 'pnpm --version', output: '10.18.0' },
  {
    command: 'git diff --stat HEAD~1 -- package.json pnpm-lock.yaml',
    output: ' package.json | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)',
  },
  {
    command: 'pnpm install --frozen-lockfile',
    error:
      'ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json',
  },
]
const demoSources = [
  { title: 'pnpm install | example.com', href: 'https://example.com/cli/install#frozen-lockfile' },
  { title: 'Continuous integration | example.com', href: 'https://example.com/continuous-integration' },
]
const demoAnswer =
  'The last commit bumped a version in package.json without updating pnpm-lock.yaml, so the frozen install fails. Run pnpm install locally and commit the lockfile.'

/**
 * A whole answer, played from a script: reasoning, three commands, one of
 * which fails, and the sources it used. The list announces each change.
 */
export const TraceDemo = clientEntry(import.meta.url, function TraceDemo(handle: Handle) {
  let player = createPlayer(handle)
  let words = demoReasoning.split(' ')
  let sent = false
  let shown = 0
  let thinking = false
  let started = 0
  let finished = 0
  let answered = false

  function send() {
    sent = thinking = true
    shown = started = finished = 0
    answered = false
    void handle.update()
    player.play([
      [400, () => {}],
      ...words.map((): [number, () => void] => [30, () => void shown++]),
      [300, () => void (thinking = false)],
      ...demoCommands.flatMap((_, index): Array<[number, () => void]> => [
        [200, () => void (started = index + 1)],
        [700, () => void (finished = index + 1)],
      ]),
      [500, () => void (answered = true)],
    ])
  }

  function reset() {
    player.stop()
    sent = thinking = answered = false
    void handle.update()
  }

  return () => (
    <div mix={chatStyles}>
      {sent ? <Question>{demoQuestion}</Question> : null}
      {sent ? (
        <Answer>
          <Trace announce>
            <ThinkingRow text={words.slice(0, shown).join(' ')} running={thinking} title="Thought for 5s" />
            {demoCommands.slice(0, started).map((command, index) => (
              <CommandRow key={command.command} command={command} state={index < finished ? 'done' : 'running'} />
            ))}
          </Trace>
          {answered ? (
            <TraceCollapsible>
              <TraceCollapsibleTrigger>
                <TraceLine>
                  <TraceIcon>
                    <GlobeIcon />
                  </TraceIcon>
                  <TraceTitle>Used {demoSources.length} sources</TraceTitle>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent>
                <Trace>
                  {demoSources.map((source) => (
                    <SourceLink key={source.href} href={source.href} title={source.title} />
                  ))}
                </Trace>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          ) : null}
          {answered ? <p>{demoAnswer}</p> : null}
        </Answer>
      ) : null}
      <SendButton busy={sent && !answered} sent={sent} onSend={send} onReset={reset} />
    </div>
  )
})
