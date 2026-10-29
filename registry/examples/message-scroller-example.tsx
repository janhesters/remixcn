// RemixCN Message Scroller examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Message Scroller examples, after shadcn's message-scroller-example.tsx and
// the demos on its Message Scroller page, with an invented billing assistant.
// The replies are scripted: the examples fetch nothing and call no AI. The
// scroller needs the browser, so each example is a client entry. Without it,
// every message is still in the page and the transcript scrolls natively.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { ArrowDownIcon } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import {
  getMessageScroller,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  watchMessageScrollerScrollable,
  watchMessageScrollerVisibility,
} from '#remixcn/ui/message-scroller.tsx'

// Layout for the examples, the way an app would frame its own chat and draw
// its own messages. The scroller brings only the scrolling.
const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const styles = {
  /** shadcn's Card with h-140, here shorter and as wide as its column. */
  card: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    height: '28rem',
    minWidth: 0,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--card)',
    color: 'var(--card-foreground)',
    overflow: 'hidden',
  }),
  short: css({ height: '22rem' }),
  header: css({
    display: 'grid',
    gap: space(1),
    padding: space(4),
    borderBlockEnd: '1px solid var(--border)',
    '& h4': { ...text('sm'), margin: 0, fontWeight: 600 },
    '& p': { ...text('xs'), margin: 0, color: 'var(--muted-foreground)' },
  }),
  transcript: css({ padding: space(4), gap: space(6) }),
  message: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: space(1),
    '&[data-role="user"]': { alignItems: 'flex-end' },
  }),
  author: css({ ...text('xs'), color: 'var(--muted-foreground)' }),
  bubble: css({
    ...text('sm'),
    maxWidth: 'min(100%, 32rem)',
    margin: 0,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    ':where([data-role="user"]) > &': {
      maxWidth: '80%',
      paddingBlock: space(2),
      paddingInline: space(3),
      border: '1px solid transparent',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)',
    },
  }),
  marker: css({
    ...text('xs'),
    display: 'flex',
    alignItems: 'center',
    gap: space(2),
    margin: 0,
    color: 'var(--muted-foreground)',
    '&[data-variant="separator"]': {
      justifyContent: 'center',
      '&::before, &::after': { content: '""', flex: '1 1 0', borderBlockStart: '1px solid var(--border)' },
    },
  }),
  // The button wraps below the field when large text leaves no room beside it.
  composer: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: space(2),
    padding: space(3),
    borderBlockStart: '1px solid var(--border)',
  }),
  input: css({
    ...text('sm'),
    flex: '1 1 12rem',
    minWidth: 0,
    minHeight: space(9),
    margin: 0,
    paddingBlock: space(2),
    paddingInline: space(3),
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    resize: 'none',
  }),
  toolbar: css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2), padding: space(3) }),
  status: css({ ...text('xs'), margin: 0, marginInlineStart: 'auto', color: 'var(--muted-foreground)' }),
  // The outline is a row of links on a narrow screen and a column beside the transcript on a wide one.
  split: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    minHeight: 0,
    '@media (min-width: 48rem)': {
      gridTemplateColumns: 'minmax(0, 10rem) minmax(0, 1fr)',
      gridTemplateRows: 'minmax(0, 1fr)',
    },
  }),
  outline: css({
    ...text('xs'),
    display: 'flex',
    flexWrap: 'wrap',
    gap: space(1),
    margin: 0,
    padding: space(2),
    listStyle: 'none',
    '@media (min-width: 48rem)': {
      flexDirection: 'column',
      flexWrap: 'nowrap',
      borderInlineEnd: '1px solid var(--border)',
    },
    '& button': {
      width: '100%',
      padding: `${space(1.5)} ${space(2)}`,
      border: '1px solid transparent',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
      font: 'inherit',
      textAlign: 'start',
      cursor: 'pointer',
    },
    '& button[aria-current="true"]': {
      borderColor: 'var(--border)',
      backgroundColor: 'var(--muted)',
      color: 'var(--foreground)',
      fontWeight: 500,
    },
  }),
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'marker'
  text: string
}

/** One row of a transcript: the scroller's item around the app's own message. */
function MessageRow(handle: Handle<{ message: ChatMessage; author?: string }>) {
  return () => {
    let { message, author } = handle.props
    if (message.role === 'marker') {
      return (
        <MessageScrollerItem messageId={message.id} scrollAnchor>
          <p data-variant="separator" mix={styles.marker}>
            {message.text}
          </p>
        </MessageScrollerItem>
      )
    }
    return (
      <MessageScrollerItem messageId={message.id} scrollAnchor={message.role === 'user'}>
        <div data-role={message.role} mix={styles.message}>
          <span mix={styles.author}>{author ?? (message.role === 'user' ? 'You' : 'Billing assistant')}</span>
          <p mix={styles.bubble}>{message.text}</p>
        </div>
      </MessageScrollerItem>
    )
  }
}

const opening: ChatMessage[] = [
  { id: 'm1', role: 'user', text: 'Hi! Can you help me with this month’s invoices?' },
  { id: 'm2', role: 'assistant', text: 'Of course. Ask me about runs, reminders or late payments.' },
]

const script = [
  {
    question: 'Which invoices are still open for Northwind Studio?',
    answer:
      'Northwind Studio has three open invoices:\n\n• INV-2026-014, 1,237.50 CHF, due 4 November\n• INV-2026-019, 825.00 CHF, due 12 November\n• INV-2026-023, 2,062.50 CHF, due 30 November\n\nThe first one is due in less than a week. Do you want me to draft a friendly reminder for it, or wait until the due date passes and send the usual one?',
  },
  {
    question: 'Draft the reminder for the first one, please.',
    answer:
      'Here is a draft:\n\n“Hello Northwind team, a quick note that invoice INV-2026-014 over 1,237.50 CHF is due on 4 November. You will find it attached again. Thank you, and do let us know if anything is unclear.”\n\nI saved it as a draft. Nothing is sent until you send it.',
  },
  { question: 'Thanks, that is all for now.', answer: 'You are welcome. Have a good day!' },
]

/**
 * A chat that follows the reply while you stay at the end. Sending starts the
 * question near the top, with a peek of the message before it, and the reply
 * streams into the room below. Scroll up while it streams, and it stays where
 * you are, with a button back to the end.
 */
export const MessageScrollerDemo = clientEntry(import.meta.url, function MessageScrollerDemo(handle: Handle) {
  let messages = [...opening]
  let step = 0
  let status: 'ready' | 'thinking' | 'streaming' = 'ready'
  let timer: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(timer))

  function stream(id: string, answer: string) {
    let words = answer.split(' ')
    let shown = 0
    status = 'streaming'
    messages = [...messages, { id, role: 'assistant', text: '' }]
    let tick = () => {
      shown += 3
      messages = messages.map((message) =>
        message.id === id ? { ...message, text: words.slice(0, shown).join(' ') } : message,
      )
      if (shown < words.length) timer = setTimeout(tick, 40)
      else status = 'ready'
      void handle.update()
    }
    tick()
  }

  function send(event: SubmitEvent) {
    event.preventDefault()
    let turn = script[step]
    if (!turn || status !== 'ready') return
    step++
    messages = [...messages, { id: `q${step}`, role: 'user', text: turn.question }]
    status = 'thinking'
    void handle.update()
    let id = `r${step}`
    timer = setTimeout(() => stream(id, turn.answer), 500)
  }

  return () => {
    let next = script[step]
    let busy = status !== 'ready'
    return (
      <section aria-labelledby="demo-title" mix={styles.card}>
        <header mix={styles.header}>
          <h4 id="demo-title">How can I help you today?</h4>
          <p>Status: {status}</p>
        </header>
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport aria-label="Billing assistant messages">
              <MessageScrollerContent aria-busy={status === 'streaming' ? 'true' : undefined} mix={styles.transcript}>
                {messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
                {status === 'thinking' ? (
                  <MessageScrollerItem key="thinking">
                    <p role="status" mix={styles.marker}>
                      Thinking…
                    </p>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <form mix={[styles.composer, on<HTMLFormElement, 'submit'>('submit', send)]}>
          <textarea
            aria-label="Message"
            readOnly
            rows={2}
            value={busy || !next ? '' : next.question}
            placeholder={next ? 'The assistant is answering…' : 'That’s the end of the demo.'}
            mix={styles.input}
          />
          <Button type="submit" disabled={busy || !next} focusableWhenDisabled>
            Send
          </Button>
        </form>
      </section>
    )
  }
})

const older = (count: number, before: number): ChatMessage[] =>
  Array.from({ length: count }, (_, index) => {
    let number = before - count + index
    return {
      id: `h${number}`,
      role: number % 2 === 0 ? 'user' : 'assistant',
      text:
        number % 2 === 0
          ? `Can you check invoice INV-2026-${String(number).padStart(3, '0')}?`
          : `INV-2026-${String(number - 1).padStart(3, '0')} was paid on time. Nothing to do.`,
    } satisfies ChatMessage
  })

/**
 * Older messages load above without moving the one you're reading. The
 * "load earlier" row has no messageId, so it's never the row held in place.
 */
export const MessageScrollerLoadHistory = clientEntry(
  import.meta.url,
  function MessageScrollerLoadHistory(handle: Handle) {
    let first = 40
    let messages = older(8, first)
    let loading = false
    let timer: ReturnType<typeof setTimeout> | undefined
    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    function loadEarlier() {
      if (loading || first <= 2) return
      loading = true
      void handle.update()
      // Stands in for a request to your own server.
      timer = setTimeout(() => {
        first -= 8
        messages = [...older(8, first), ...messages]
        loading = false
        void handle.update()
      }, 300)
    }

    return () => (
      <section aria-labelledby="history-title" mix={[styles.card, styles.short]}>
        <header mix={styles.header}>
          <h4 id="history-title">Invoice questions</h4>
          <p>{messages.length} messages loaded</p>
        </header>
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport aria-label="Invoice question messages">
              <MessageScrollerContent mix={styles.transcript}>
                <MessageScrollerItem key="load">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || first <= 2}
                    focusableWhenDisabled
                    mix={on('click', loadEarlier)}
                  >
                    {loading ? 'Loading…' : first <= 2 ? 'No earlier messages' : 'Load earlier messages'}
                  </Button>
                </MessageScrollerItem>
                {messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </section>
    )
  },
)

const saved: ChatMessage[] = [
  { id: 's1', role: 'user', text: 'What did we invoice Lumen Labs in September?' },
  { id: 's2', role: 'assistant', text: 'Two invoices: the retainer, 4,500.00 CHF, and the workshop, 1,800.00 CHF.' },
  { id: 's3', role: 'marker', text: 'Yesterday' },
  { id: 's4', role: 'user', text: 'Summarize the open payments for the quarterly report.' },
  {
    id: 's5',
    role: 'assistant',
    text: Array.from(
      { length: 9 },
      (_, index) =>
        `• Customer ${index + 1}: ${(index + 2) * 310}.00 CHF open, oldest invoice ${index * 4 + 6} days past its due date.`,
    ).join('\n'),
  },
]

/**
 * A saved thread opens at the last question, with the reply below it, not at
 * the very end. The marker for yesterday is an anchor too. The viewport stays
 * hidden until the browser has scrolled it, so it doesn't jump.
 */
export const MessageScrollerOpeningPosition = clientEntry(import.meta.url, function MessageScrollerOpeningPosition() {
  return () => (
    <section aria-labelledby="saved-title" mix={[styles.card, styles.short]}>
      <header mix={styles.header}>
        <h4 id="saved-title">Quarterly report</h4>
        <p>Opens at the last question</p>
      </header>
      <MessageScrollerProvider defaultScrollPosition="last-anchor">
        <MessageScroller>
          <MessageScrollerViewport aria-label="Quarterly report messages">
            <MessageScrollerContent mix={styles.transcript}>
              {saved.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="start" />
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  )
})

const thread = Array.from({ length: 6 }, (_, index): ChatMessage[] => [
  { id: `t${index}q`, role: 'user', text: `Question ${index + 1}: what changed in run ${index + 1}?` },
  {
    id: `t${index}a`,
    role: 'assistant',
    text: `Run ${index + 1} added ${index + 2} customers and moved the due dates of ${index + 1} invoices.\n\nNothing else changed. The totals match the previous run, and every reminder went out on time.`,
  },
]).flat()

/** Jumps to the first or the latest message, as a toolbar outside the frame would. */
function Toolbar(handle: Handle) {
  return () => {
    let scroller = getMessageScroller(handle)
    let { start, end } = watchMessageScrollerScrollable(handle)
    return (
      <div mix={styles.toolbar}>
        <Button
          variant="outline"
          size="sm"
          mix={on('click', () => void scroller.scrollToStart({ behavior: 'smooth' }))}
        >
          First message
        </Button>
        <Button variant="outline" size="sm" mix={on('click', () => void scroller.scrollToEnd({ behavior: 'smooth' }))}>
          Latest message
        </Button>
        <p mix={styles.status}>{end ? 'More below' : start ? 'At the latest message' : 'Everything is in view'}</p>
      </div>
    )
  }
}

/** Lists the questions and marks the one you're reading, from the scroller's visibility. */
function Outline(handle: Handle) {
  return () => {
    let scroller = getMessageScroller(handle)
    let { currentAnchorId } = watchMessageScrollerVisibility(handle)
    return (
      <nav aria-label="Questions">
        <ul mix={styles.outline}>
          {thread
            .filter((message) => message.role === 'user')
            .map((message, index) => (
              <li key={message.id}>
                <button
                  type="button"
                  aria-current={currentAnchorId === message.id ? 'true' : undefined}
                  mix={on('click', () => void scroller.scrollToMessage(message.id, { behavior: 'smooth' }))}
                >
                  Question {index + 1}
                </button>
              </li>
            ))}
        </ul>
      </nav>
    )
  }
}

/**
 * Controls outside the frame drive the transcript: a toolbar with jumps and a
 * status line, and an outline that marks the current question.
 */
export const MessageScrollerCommands = clientEntry(import.meta.url, function MessageScrollerCommands() {
  return () => (
    <MessageScrollerProvider defaultScrollPosition="start">
      <section aria-labelledby="commands-title" mix={styles.card}>
        <header mix={styles.header}>
          <h4 id="commands-title">Run history</h4>
          <p>Jump to any question</p>
        </header>
        <div mix={styles.split}>
          <Outline />
          <MessageScroller>
            <MessageScrollerViewport aria-label="Run history messages">
              <MessageScrollerContent mix={styles.transcript}>
                {thread.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </div>
        <Toolbar />
      </section>
    </MessageScrollerProvider>
  )
})

const arabic: ChatMessage[] = [
  { id: 'r1', role: 'user', text: 'هل يمكنك مراجعة فواتير هذا الشهر؟' },
  { id: 'r2', role: 'assistant', text: 'بالتأكيد. هناك ثلاث فواتير مفتوحة، أقدمها مستحقة في الرابع من نوفمبر.' },
  { id: 'r3', role: 'user', text: 'أرسل تذكيراً للفاتورة الأولى.' },
  { id: 'r4', role: 'assistant', text: 'حفظت مسودة التذكير. لن يُرسل شيء قبل أن ترسله أنت.' },
  { id: 'r5', role: 'user', text: 'وما مجموع المبالغ المفتوحة؟' },
  { id: 'r6', role: 'assistant', text: 'المجموع ٤٬١٢٥ فرنكاً سويسرياً موزعة على ثلاث فواتير.' },
]

/** An Arabic thread: the messages, the authors and the jump buttons follow the text direction. */
export const MessageScrollerRightToLeft = clientEntry(import.meta.url, function MessageScrollerRightToLeft() {
  return () => (
    <section aria-labelledby="rtl-title" mix={[styles.card, styles.short]}>
      <header mix={styles.header}>
        <h4 id="rtl-title">الفواتير</h4>
        <p>مساعد الفوترة</p>
      </header>
      <MessageScrollerProvider defaultScrollPosition="start">
        <MessageScroller>
          <MessageScrollerViewport aria-label="الرسائل">
            <MessageScrollerContent mix={styles.transcript}>
              {arabic.map((message) => (
                <MessageRow key={message.id} message={message} author={message.role === 'user' ? 'أنت' : 'المساعد'} />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label="انتقل إلى آخر رسالة">
            <ArrowDownIcon />
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  )
})
