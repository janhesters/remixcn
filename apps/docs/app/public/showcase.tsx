// The home page's showcase: three cards built from the registry's Button,
// Card, Field, Input, Checkbox, Tabs and Toggle, with made-up people and state
// that stays on the page. The invite form never sends: the browser checks its
// fields, and a submit only says what it would have sent. The server renders
// the showcase inert, so before it runs, without scripting, or if its script
// never loads, nothing in it can submit or take focus, and a note says it
// runs with JavaScript. It binds no keyboard shortcuts.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '../../../../registry/lib/icons.tsx'
import type { IconProps } from '../../../../registry/lib/icons.tsx'
import { Button } from '../../../../registry/ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../../registry/ui/card.tsx'
import { Checkbox } from '../../../../registry/ui/checkbox.tsx'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '../../../../registry/ui/field.tsx'
import { Input } from '../../../../registry/ui/input.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../registry/ui/tabs.tsx'
import { Toggle, toggleChangeType } from '../../../../registry/ui/toggle.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'sm' | 'base') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})
const hidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
} as const

const styles = {
  frame: css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: space(4),
    padding: space(4),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--muted)',
    '@media (width >= 40rem)': { padding: space(6) },
  }),
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))',
    alignItems: 'start',
    gap: space(4),
  }),
  status: css({
    flex: '1 1 100%',
    margin: 0,
    ...text('sm'),
    color: 'var(--muted-foreground)',
    overflowWrap: 'anywhere',
    // Empty, it takes no room but stays a live region, so its first message is announced.
    '&:empty': { ...hidden, flex: 'none' },
  }),
  muted: css({ margin: 0, ...text('sm'), color: 'var(--muted-foreground)' }),
  panel: css({ paddingBlockStart: space(4) }),
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) }),
  toggles: css({ display: 'flex', flexWrap: 'wrap', gap: space(1) }),
  note: css({
    ...text('base'),
    margin: 0,
    padding: space(3),
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-md)',
    overflowWrap: 'anywhere',
  }),
  // Shows at once without scripting, and after two seconds while the showcase
  // still hasn't run, such as when its script never loads.
  pendingNote: css({
    '@keyframes remixcn-docs-showcase-note': {
      to: { position: 'static', visibility: 'visible', height: 'auto', overflow: 'visible' },
    },
    margin: 0,
    ...text('sm'),
    color: 'var(--muted-foreground)',
    position: 'absolute',
    insetInline: 0,
    visibility: 'hidden',
    height: 0,
    overflow: 'hidden',
    ':where([data-pending]) > &': { animation: 'remixcn-docs-showcase-note 0s 2s forwards' },
    '@media (scripting: none)': { position: 'static', visibility: 'visible', height: 'auto', overflow: 'visible' },
  }),
}

/** A status line that announces each message, also the same one twice. */
function createStatus(handle: Handle) {
  let message = ''
  return {
    get message() {
      return message
    },
    say(next: string) {
      message = ''
      void handle.update().then(() => {
        message = next
        void handle.update()
      })
    },
    clear() {
      message = ''
      void handle.update()
    },
  }
}

interface Invite {
  name: string
  email: string
  admin: boolean
}

/** What the invite form would have sent, in words. */
function describeInvite({ name, email, admin }: Invite): string {
  return `${name} would get an invite at ${email}${admin ? ', as an admin' : ''}. Nothing was sent.`
}

/** A native form: the browser checks the required fields and the email, and a submit stays on the page. */
function InviteCard(handle: Handle) {
  let status = createStatus(handle)

  return () => (
    <Card role="region" aria-labelledby="showcase-invite-title">
      <CardHeader>
        <CardTitle level={3} id="showcase-invite-title">
          Invite a teammate
        </CardTitle>
        <CardDescription>Add someone to the Northwind workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="showcase-invite"
          aria-labelledby="showcase-invite-title"
          mix={[
            on('submit', (event) => {
              event.preventDefault()
              let data = new FormData(event.currentTarget)
              status.say(
                describeInvite({
                  name: String(data.get('name') ?? '').trim(),
                  email: String(data.get('email') ?? '').trim(),
                  admin: data.has('admin'),
                }),
              )
            }),
            on('reset', () => status.clear()),
          ]}
        >
          <FieldGroup>
            <Field>
              <FieldLabel for="showcase-invite-name">Name</FieldLabel>
              <Input id="showcase-invite-name" name="name" required autocomplete="off" placeholder="Ada Lovelace" />
            </Field>
            <Field>
              <FieldLabel for="showcase-invite-email">Email</FieldLabel>
              <Input
                id="showcase-invite-email"
                name="email"
                type="email"
                required
                autocomplete="off"
                placeholder="ada@northwind.example"
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="showcase-invite-admin" name="admin" aria-describedby="showcase-invite-admin-hint" />
              <FieldContent>
                <FieldLabel for="showcase-invite-admin">Make them an admin</FieldLabel>
                <FieldDescription id="showcase-invite-admin-hint">
                  Admins can invite and remove people.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="showcase-invite">
          Send invite
        </Button>
        <Button type="reset" form="showcase-invite" variant="outline">
          Clear
        </Button>
        <p role="status" data-docs-showcase-status="" mix={styles.status}>
          {status.message}
        </p>
      </CardFooter>
    </Card>
  )
}

type Channel = 'email' | 'mobile'

const channels: { value: Channel; title: string; legend: string }[] = [
  { value: 'email', title: 'Email', legend: 'Email me when' },
  { value: 'mobile', title: 'Mobile', legend: 'Notify my phone when' },
]

const topics = [
  { value: 'mentions', title: 'Someone mentions me' },
  { value: 'joins', title: 'A teammate joins' },
  { value: 'summary', title: 'The weekly summary is ready' },
]

/** The choices of both tabs in one line, such as "On: 2 by email, 1 on mobile." */
function summarizeNotifications(counts: Record<Channel, number>): string {
  return `On: ${counts.email} by email, ${counts.mobile} on mobile.`
}

/** Tabs with a set of checkboxes each. The choices live here, so each tab keeps its own. */
function NotificationsCard(handle: Handle) {
  let chosen: Record<Channel, Set<string>> = {
    email: new Set(['mentions', 'summary']),
    mobile: new Set(['mentions']),
  }

  return () => (
    <Card role="region" aria-labelledby="showcase-notifications-title">
      <CardHeader>
        <CardTitle level={3} id="showcase-notifications-title">
          Notifications
        </CardTitle>
        <CardDescription>Choose what reaches you, and where.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs id="showcase-channels" defaultValue="email">
          <TabsList aria-label="Channel">
            {channels.map((channel) => (
              <TabsTrigger key={channel.value} value={channel.value}>
                {channel.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {channels.map((channel) => (
            <TabsContent key={channel.value} value={channel.value} tabindex={-1} mix={styles.panel}>
              <FieldSet>
                <FieldLegend variant="label">{channel.legend}</FieldLegend>
                <FieldGroup data-slot="checkbox-group">
                  {topics.map((topic) => {
                    let id = `showcase-${channel.value}-${topic.value}`
                    return (
                      <Field key={topic.value} orientation="horizontal">
                        <Checkbox
                          id={id}
                          checked={chosen[channel.value].has(topic.value)}
                          mix={on('change', (event) => {
                            if (event.currentTarget.checked) chosen[channel.value].add(topic.value)
                            else chosen[channel.value].delete(topic.value)
                            void handle.update()
                          })}
                        />
                        <FieldLabel for={id}>{topic.title}</FieldLabel>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </FieldSet>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
      <CardFooter>
        <p data-docs-showcase-summary="" mix={styles.muted}>
          {summarizeNotifications({ email: chosen.email.size, mobile: chosen.mobile.size })}
        </p>
      </CardFooter>
    </Card>
  )
}

function BoldIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </Icon>
  )
}

function ItalicIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M11 5h7M6 19h7M14.5 5l-5 14" />
    </Icon>
  )
}

function UnderlineIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />
    </Icon>
  )
}

const formats = {
  bold: { label: 'Bold', icon: BoldIcon, style: css({ fontWeight: 700 }) },
  italic: { label: 'Italic', icon: ItalicIcon, style: css({ fontStyle: 'italic' }) },
  underline: {
    label: 'Underline',
    icon: UnderlineIcon,
    style: css({ textDecoration: 'underline', textUnderlineOffset: '0.2em' }),
  },
}

type Format = keyof typeof formats
const formatNames = Object.keys(formats) as Format[]

/** Toggles that format a note, so each pressed state shows in the text too. */
function NoteCard(handle: Handle) {
  let pressed = new Set<Format>(['bold'])

  return () => (
    <Card role="region" aria-labelledby="showcase-note-title">
      <CardHeader>
        <CardTitle level={3} id="showcase-note-title">
          Format a note
        </CardTitle>
        <CardDescription>Each toggle changes the note below.</CardDescription>
      </CardHeader>
      <CardContent mix={styles.stack}>
        <div
          role="group"
          aria-label="Formatting"
          mix={[
            styles.toggles,
            on(toggleChangeType, (event) => {
              let format = formatNames.find((name) => name === (event.target as HTMLButtonElement).value)
              if (!format) return
              if (event.pressed) pressed.add(format)
              else pressed.delete(format)
              void handle.update()
            }),
          ]}
        >
          {formatNames.map((format) => {
            let FormatIcon = formats[format].icon
            return (
              <Toggle
                key={format}
                value={format}
                variant="outline"
                aria-label={formats[format].label}
                pressed={pressed.has(format)}
              >
                <FormatIcon />
              </Toggle>
            )
          })}
        </div>
        <p data-docs-showcase-note="" mix={[styles.note, ...[...pressed].map((format) => formats[format].style)]}>
          The standup moves to 10:30 on Thursday.
        </p>
      </CardContent>
    </Card>
  )
}

export const Showcase = clientEntry(import.meta.url, function Showcase(handle: Handle) {
  let running = false
  let starting = false

  return () => {
    // The server and hydration render it inert; it lets go once it listens.
    if (!starting && typeof document !== 'undefined') {
      starting = true
      handle.queueTask(() => {
        running = true
        void handle.update()
      })
    }

    return (
      <div data-docs-showcase="" data-pending={running ? undefined : ''} mix={styles.frame}>
        {/* Above the cards, so a reader sees it before trying them. */}
        {running ? null : <p mix={styles.pendingNote}>The showcase runs with JavaScript.</p>}
        <div data-docs-showcase-canvas="" inert={running ? undefined : true} mix={styles.grid}>
          <InviteCard />
          <NotificationsCard />
          <NoteCard />
        </div>
      </div>
    )
  }
})
