// RemixCN Questionnaire examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
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
  QuestionnaireSubmitError,
  QuestionnaireTitle,
} from '#remixcn/ui/questionnaire.tsx'
import type {
  QuestionnaireAnswers,
  QuestionnaireItemDefinition,
  QuestionnaireItemStatus,
  QuestionnaireSnapshot,
} from '#remixcn/ui/questionnaire.tsx'

// Every example is a client entry: a questionnaire keeps its answers and its
// current question in the browser, inside your entry. Each one shows what it
// would send in a status line, where your app would send it to its server.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const smallText = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const exampleStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4), width: '100%' })
const resultStyles = css({
  ...smallText,
  margin: 0,
  minHeight: '1lh',
  color: 'var(--muted-foreground)',
  overflowWrap: 'anywhere',
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const labelStyles = css({ ...smallText, display: 'inline-flex', alignItems: 'center', gap: space(2) })
const strongStyles = css({ fontWeight: 500 })
const outline = buttonVariants({ variant: 'outline' })

/** Formats a snapshot's answers on one line, such as "direction: delegation · signals: skipped". */
export function describeAnswers(answers: QuestionnaireSnapshot['answers']) {
  return Object.entries(answers)
    .map(
      ([name, answer]) =>
        `${name}: ${answer === null ? 'skipped' : Array.isArray(answer) ? answer.join(', ') || 'none' : answer}`,
    )
    .join(' · ')
}

function Result(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <p role="status" data-slot="questionnaire-example-result" mix={resultStyles}>
      {handle.props.children}
    </p>
  )
}

function Navigation(handle: Handle<{ submit?: RemixNode; pendingLabel?: RemixNode; children?: RemixNode }>) {
  return () => (
    <QuestionnaireActions>
      {handle.props.children}
      <QuestionnairePrevious />
      <QuestionnaireSkip />
      <QuestionnaireNext />
      <QuestionnaireSubmit pendingLabel={handle.props.pendingLabel}>
        {handle.props.submit ?? 'Save answers'}
      </QuestionnaireSubmit>
    </QuestionnaireActions>
  )
}

const prototypeItems = [
  {
    name: 'direction',
    required: true,
    choices: [{ value: 'delegation' }, { value: 'questions' }, { value: 'both' }],
  },
  { name: 'signals', multiple: true, choices: [{ value: 'progress' }, { value: 'decisions' }, { value: 'risks' }] },
  { name: 'timing', required: true, choices: [{ value: 'week' }, { value: 'cycle' }, { value: 'later' }] },
] as const satisfies readonly QuestionnaireItemDefinition[]

function PrototypeQuestions() {
  return () => (
    <>
      <QuestionnaireItem name="direction">
        <QuestionnaireTitle>What should we prototype next?</QuestionnaireTitle>
        <QuestionnaireDescription>Choose one direction or write another answer.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="delegation">
            <span mix={strongStyles}>Sub-agent delegation</span>
            <QuestionnaireChoiceDescription>
              Show when work is delegated and what comes back.
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="questions">
            <span mix={strongStyles}>Question prompts</span>
            <QuestionnaireChoiceDescription>
              Show choices while the agent waits for input.
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="both">
            <span mix={strongStyles}>Both together</span>
            <QuestionnaireChoiceDescription>Explore one unified interaction pattern.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireInput aria-label="Another direction" placeholder="Type another direction…" />
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireItem name="signals">
        <QuestionnaireTitle>What should every progress update include?</QuestionnaireTitle>
        <QuestionnaireDescription>Select all that apply, or skip this question.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="progress">Progress</QuestionnaireChoice>
          <QuestionnaireChoice value="decisions">Decisions</QuestionnaireChoice>
          <QuestionnaireChoice value="risks">Risks</QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireItem name="timing">
        <QuestionnaireTitle>When should this be revisited?</QuestionnaireTitle>
        <QuestionnaireDescription>Choose when this should be revisited.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="week">This week</QuestionnaireChoice>
          <QuestionnaireChoice value="cycle">Next cycle</QuestionnaireChoice>
          <QuestionnaireChoice value="later">Revisit later</QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
    </>
  )
}

/**
 * Three questions: one answer or your own, several or a skip, and one
 * answer. Letter keys pick answers, and the snapshot shows below.
 */
export const QuestionnaireDemo = clientEntry(import.meta.url, function QuestionnaireDemo(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Plan the next prototype"
        items={prototypeItems}
        shortcuts="letters"
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <PrototypeQuestions />
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

const multipleItems = [
  {
    name: 'signals',
    required: true,
    multiple: true,
    choices: [{ value: 'progress' }, { value: 'decisions' }, { value: 'risks' }],
  },
] as const satisfies readonly QuestionnaireItemDefinition[]

/** Checkboxes for several answers. The snapshot gives them as a list. */
export const QuestionnaireMultiple = clientEntry(import.meta.url, function QuestionnaireMultiple(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Update contents"
        items={multipleItems}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireItem name="signals">
          <QuestionnaireTitle>What should every update include?</QuestionnaireTitle>
          <QuestionnaireDescription>Select all that apply.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="progress">Progress</QuestionnaireChoice>
            <QuestionnaireChoice value="decisions">Decisions</QuestionnaireChoice>
            <QuestionnaireChoice value="risks">Risks</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/** Fixed answers with a freeform one after them. Typing replaces the chosen answer. */
export const QuestionnaireFreeform = clientEntry(import.meta.url, function QuestionnaireFreeform(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Prototype direction"
        items={[{ name: 'prototype', required: true, choices: [{ value: 'delegation' }, { value: 'questions' }] }]}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireItem name="prototype">
          <QuestionnaireTitle>What should we prototype next?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="delegation">Delegation</QuestionnaireChoice>
            <QuestionnaireChoice value="questions">Question prompts</QuestionnaireChoice>
            <QuestionnaireInput aria-label="Another prototype direction" placeholder="Type another direction…" />
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/** An optional question that can be skipped on purpose. Its status shows below it. */
export const QuestionnaireSkipExample = clientEntry(import.meta.url, function QuestionnaireSkipExample(handle: Handle) {
  let status: QuestionnaireItemStatus = 'unanswered'
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Revisit timing"
        defaultItem="timing"
        items={[
          { name: 'scope', required: true, choices: [{ value: 'component' }, { value: 'feature' }] },
          { name: 'timing' },
        ]}
        defaultAnswers={{ scope: 'component' }}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="scope">
          <QuestionnaireTitle>What may the agent change?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="component">Only the component</QuestionnaireChoice>
            <QuestionnaireChoice value="feature">The whole feature</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem
          name="timing"
          onStatusChange={(next) => {
            status = next
            void handle.update()
          }}
        >
          <QuestionnaireTitle>When should this be revisited?</QuestionnaireTitle>
          <QuestionnaireDescription>Skip this if timing hasn’t been decided.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="week">This week</QuestionnaireChoice>
            <QuestionnaireChoice value="cycle">Next cycle</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>
        Timing is {status}. {result}
      </Result>
    </div>
  )
})

const taskItems = [
  { name: 'task', required: true, choices: [{ value: 'inspect' }, { value: 'implement' }, { value: 'review' }] },
] as const satisfies readonly QuestionnaireItemDefinition[]

/** Number keys pick the answers of a question without a description. */
export const QuestionnaireShortcuts = clientEntry(import.meta.url, function QuestionnaireShortcuts(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Next task"
        items={taskItems}
        shortcuts="numbers"
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="task">
          <QuestionnaireTitle>What should the agent do next?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="inspect">Inspect the codebase</QuestionnaireChoice>
            <QuestionnaireChoice value="implement">Implement the change</QuestionnaireChoice>
            <QuestionnaireChoice value="review">Review the result</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

const projectCodes = ['INV-2041', 'INV-2042', 'INV-2050']

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

/**
 * Your own async check: the project code is looked up, here after a pause,
 * as a server would. Next waits, and an unknown code shows its message.
 */
export const QuestionnaireValidation = clientEntry(
  import.meta.url,
  function QuestionnaireValidation(handle: Handle<{ delay?: number }>) {
    let result = ''

    return () => (
      <div mix={exampleStyles}>
        <Questionnaire
          aria-label="Invoice project"
          items={[
            { name: 'code', required: true },
            { name: 'detail', required: true, choices: [{ value: 'summary' }, { value: 'complete' }] },
          ]}
          validate={async ({ item, answers, signal }) => {
            if (item !== 'code') return
            await wait(handle.props.delay ?? 600, signal)
            let code = String(answers.code ?? '')
              .trim()
              .toUpperCase()
            if (!projectCodes.includes(code)) {
              return `No project uses ${code}. Check the code on the invoice, such as INV-2041.`
            }
          }}
          onSubmit={({ answers }) => {
            result = `Saved. ${describeAnswers(answers)}`
            void handle.update()
          }}
        >
          <QuestionnaireProgress />
          <QuestionnaireItem name="code">
            <QuestionnaireTitle>Which project should the invoice go to?</QuestionnaireTitle>
            <QuestionnaireDescription>Enter the project code, such as INV-2041.</QuestionnaireDescription>
            <QuestionnaireInput aria-label="Project code" autocomplete="off" />
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="detail">
            <QuestionnaireTitle>How much detail should the invoice include?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="summary">A concise summary</QuestionnaireChoice>
              <QuestionnaireChoice value="complete">Every line item</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnairePrevious />
            <QuestionnaireNext pendingLabel="Checking…" />
            <QuestionnaireSubmit>Save project</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
        <Result>{result}</Result>
      </div>
    )
  },
)

/**
 * A submit that takes time and can fail. The buttons wait while it runs, a
 * second press sends nothing, and a refused answer sends the person back to
 * its question. Check "Fail the next send" to see a failure that keeps
 * every answer.
 */
export const QuestionnaireSubmitting = clientEntry(
  import.meta.url,
  function QuestionnaireSubmitting(handle: Handle<{ delay?: number }>) {
    let failNext = false
    let sends = 0
    let result = ''

    async function send({ answers }: QuestionnaireSnapshot, signal: AbortSignal) {
      sends += 1
      result = ''
      void handle.update()
      await wait(handle.props.delay ?? 800, signal)
      if (failNext) {
        failNext = false
        void handle.update()
        throw new Error('The planning service didn’t answer. Your answers are still here: send them again.')
      }
      if (answers.window === 'weekend') {
        throw new QuestionnaireSubmitError('Weekend deploys need an on-call reviewer. Choose another time.', {
          item: 'window',
        })
      }
      result = `Sent ${sends === 1 ? 'once' : `after ${sends} tries`}. ${describeAnswers(answers)}`
      void handle.update()
    }

    return () => (
      <div mix={exampleStyles}>
        <label mix={labelStyles}>
          <input
            type="checkbox"
            checked={failNext}
            mix={on('change', (event) => {
              failNext = (event.currentTarget as HTMLInputElement).checked
              void handle.update()
            })}
          />
          Fail the next send
        </label>
        <Questionnaire
          aria-label="Deploy plan"
          items={[
            { name: 'window', required: true, choices: [{ value: 'now' }, { value: 'tonight' }, { value: 'weekend' }] },
            { name: 'approver', required: true },
          ]}
          onSubmit={(snapshot, { signal }) => send(snapshot, signal)}
        >
          <QuestionnaireProgress />
          <QuestionnaireItem name="window">
            <QuestionnaireTitle>When should the agent deploy?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="now">Right away</QuestionnaireChoice>
              <QuestionnaireChoice value="tonight">Tonight at 22:00</QuestionnaireChoice>
              <QuestionnaireChoice value="weekend">Over the weekend</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="approver">
            <QuestionnaireTitle>Who approves the deploy?</QuestionnaireTitle>
            <QuestionnaireDescription>A name or a team, such as Billing on-call.</QuestionnaireDescription>
            <QuestionnaireInput aria-label="Approver" autocomplete="off" />
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireError />
          <Navigation submit="Send plan" pendingLabel="Sending…" />
        </Questionnaire>
        <Result>{result}</Result>
      </div>
    )
  },
)

const checkpointLabels: Record<string, string> = { scope: 'Scope', checks: 'Verification', output: 'Output' }

/**
 * The caller keeps the current question and the answers: the status line
 * reads them, and the buttons below jump to a question.
 */
export const QuestionnaireControlled = clientEntry(import.meta.url, function QuestionnaireControlled(handle: Handle) {
  let item = 'scope'
  let answers: QuestionnaireAnswers = {}
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <p role="status" mix={resultStyles}>
        Current checkpoint: {checkpointLabels[item]}. Answered: {Object.values(answers).filter(Boolean).length} of 3.
      </p>
      <div mix={rowStyles}>
        {Object.entries(checkpointLabels).map(([name, label]) => (
          <Button
            key={name}
            size="sm"
            variant="outline"
            aria-pressed={item === name ? 'true' : 'false'}
            mix={on('click', () => {
              item = name
              void handle.update()
            })}
          >
            {label}
          </Button>
        ))}
      </div>
      <Questionnaire
        aria-label="Agent workflow"
        item={item}
        answers={answers}
        items={[
          { name: 'scope', required: true },
          { name: 'checks', required: true },
          { name: 'output', required: true },
        ]}
        onItemChange={(next) => {
          item = next
          void handle.update()
        }}
        onAnswersChange={(next) => {
          answers = next
          void handle.update()
        }}
        onSubmit={(snapshot) => {
          result = `Saved. ${describeAnswers(snapshot.answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="scope">
          <QuestionnaireTitle>What may the agent change?</QuestionnaireTitle>
          <QuestionnaireDescription>
            The page keeps the current checkpoint while the questionnaire navigates.
          </QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="component">Only the target component</QuestionnaireChoice>
            <QuestionnaireChoice value="tests">Component and related tests</QuestionnaireChoice>
            <QuestionnaireChoice value="feature">The complete feature area</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="checks">
          <QuestionnaireTitle>Which verification level should it use?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="targeted">Targeted tests</QuestionnaireChoice>
            <QuestionnaireChoice value="package">Package tests and typecheck</QuestionnaireChoice>
            <QuestionnaireChoice value="full">Full workspace verification</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="output">
          <QuestionnaireTitle>What should the agent return when finished?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="summary">Concise summary</QuestionnaireChoice>
            <QuestionnaireChoice value="diff">Summary with changed files</QuestionnaireChoice>
            <QuestionnaireChoice value="handoff">Detailed implementation handoff</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation submit="Save workflow" />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/** A saved draft: it starts at the second question with its answers, and Reset brings them back. */
export const QuestionnaireResume = clientEntry(import.meta.url, function QuestionnaireResume(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Migration draft"
        defaultItem="verification"
        items={[
          { name: 'change', required: true },
          { name: 'verification', required: true, multiple: true },
          { name: 'notes' },
        ]}
        defaultAnswers={{
          change: 'incremental',
          verification: ['tests', 'typecheck'],
          notes: 'Keep the existing public API stable.',
        }}
        mix={on('reset', () => {
          result = 'Saved answers restored.'
          void handle.update()
        })}
        onSubmit={({ answers }) => {
          result = `Draft updated. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="change">
          <QuestionnaireTitle>What kind of migration is this?</QuestionnaireTitle>
          <QuestionnaireDescription>This answer was saved during the previous session.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="incremental">Incremental migration</QuestionnaireChoice>
            <QuestionnaireChoice value="cutover">Single cutover</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="verification">
          <QuestionnaireTitle>How should the migration be verified?</QuestionnaireTitle>
          <QuestionnaireDescription>These checks were selected during the previous session.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="tests">Run migration tests</QuestionnaireChoice>
            <QuestionnaireChoice value="typecheck">Run the typecheck</QuestionnaireChoice>
            <QuestionnaireChoice value="manual">Perform a manual smoke test</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="notes">
          <QuestionnaireTitle>Anything else the agent should remember?</QuestionnaireTitle>
          <QuestionnaireDescription>This note was saved with the draft.</QuestionnaireDescription>
          <QuestionnaireInput aria-label="Saved migration note" />
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation submit="Update draft">
          <Button type="reset" variant="ghost">
            Reset changes
          </Button>
        </Navigation>
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/** A question that applies only after an earlier answer: a cloud run adds the environment question. */
export const QuestionnaireConditional = clientEntry(import.meta.url, function QuestionnaireConditional(handle: Handle) {
  let runtime = 'local'
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Execution plan"
        items={[
          { name: 'runtime', required: true },
          { name: 'environment', required: true, disabled: runtime !== 'cloud' },
          { name: 'approval', required: true },
        ]}
        defaultAnswers={{ runtime }}
        onAnswersChange={(answers) => {
          let next = String(answers.runtime ?? 'local')
          if (next === runtime) return
          runtime = next
          void handle.update()
        }}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="runtime">
          <QuestionnaireTitle>Where should the agent run?</QuestionnaireTitle>
          <QuestionnaireDescription>Cloud runs add an environment question to this flow.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="local">Local workspace</QuestionnaireChoice>
            <QuestionnaireChoice value="cloud">Cloud workspace</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="environment">
          <QuestionnaireTitle>Which cloud environment should it use?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="isolated">Isolated sandbox</QuestionnaireChoice>
            <QuestionnaireChoice value="staging">Shared staging</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="approval">
          <QuestionnaireTitle>When should the agent request approval?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="writes">Before writing files</QuestionnaireChoice>
            <QuestionnaireChoice value="commands">Before running commands</QuestionnaireChoice>
            <QuestionnaireChoice value="sensitive">Only for sensitive actions</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation submit="Save plan" />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/** Next and Submit stay disabled until the current question has an answer, from its status. */
export const QuestionnaireNavigationState = clientEntry(
  import.meta.url,
  function QuestionnaireNavigationState(handle: Handle) {
    let item = 'permission'
    let statuses: Record<string, QuestionnaireItemStatus> = { permission: 'unanswered', verification: 'unanswered' }
    let result = ''

    function track(name: string) {
      return (status: QuestionnaireItemStatus) => {
        statuses = { ...statuses, [name]: status }
        void handle.update()
      }
    }

    return () => {
      let unanswered = statuses[item] === 'unanswered'

      return (
        <div mix={exampleStyles}>
          <Questionnaire
            aria-label="Agent permissions"
            item={item}
            items={[
              { name: 'permission', required: true },
              { name: 'verification', required: true },
            ]}
            onItemChange={(next) => {
              item = next
              void handle.update()
            }}
            onSubmit={({ answers }) => {
              result = `Saved. ${describeAnswers(answers)}`
              void handle.update()
            }}
          >
            <QuestionnaireProgress />
            <QuestionnaireItem name="permission" onStatusChange={track('permission')}>
              <QuestionnaireTitle>Which files may the agent edit?</QuestionnaireTitle>
              <QuestionnaireDescription>Next stays disabled until an answer is selected.</QuestionnaireDescription>
              <QuestionnaireChoices>
                <QuestionnaireChoice value="tests">Project files and tests</QuestionnaireChoice>
                <QuestionnaireChoice value="config">Files, tests, and configuration</QuestionnaireChoice>
              </QuestionnaireChoices>
            </QuestionnaireItem>
            <QuestionnaireItem name="verification" onStatusChange={track('verification')}>
              <QuestionnaireTitle>What must pass before completion?</QuestionnaireTitle>
              <QuestionnaireChoices>
                <QuestionnaireChoice value="types">Tests and types</QuestionnaireChoice>
                <QuestionnaireChoice value="all">Tests, types, and visual QA</QuestionnaireChoice>
              </QuestionnaireChoices>
            </QuestionnaireItem>
            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext variant="secondary" disabled={unanswered} />
              <QuestionnaireSubmit disabled={unanswered}>Save permissions</QuestionnaireSubmit>
            </QuestionnaireActions>
          </Questionnaire>
          <Result>{result}</Result>
        </div>
      )
    }
  },
)

const stepsStyles = css({ display: 'flex', gap: space(1.5), marginBlockEnd: space(2) })
const stepStyles = css({
  flex: '1 1 0%',
  height: space(1.5),
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  '&[data-done]': { backgroundColor: 'var(--primary)' },
  // Forced colors drop backgrounds, so the steps keep an outline, and a filled one its own color.
  '@media (forced-colors: active)': {
    border: '1px solid CanvasText',
    '&[data-done]': { backgroundColor: 'Highlight' },
  },
})
const fullWidthStyles = css({ width: '100%' })

/** A progress of your own: a bar per question, and "Checkpoint 2 of 4". */
export const QuestionnaireCustomProgress = clientEntry(
  import.meta.url,
  function QuestionnaireCustomProgress(handle: Handle) {
    let result = ''

    return () => (
      <div mix={exampleStyles}>
        <Questionnaire
          aria-label="Pull request plan"
          items={[
            { name: 'scope', required: true },
            { name: 'strategy', required: true },
            { name: 'tests', required: true },
            { name: 'delivery', required: true },
          ]}
          onSubmit={({ answers }) => {
            result = `Plan ready. ${describeAnswers(answers)}`
            void handle.update()
          }}
        >
          <QuestionnaireProgress aria-label="Plan progress" mix={fullWidthStyles}>
            {({ current, total }) => (
              <>
                <span aria-hidden="true" mix={stepsStyles}>
                  {Array.from({ length: total }, (_, index) => (
                    <span key={index} data-done={index < current ? '' : undefined} mix={stepStyles} />
                  ))}
                </span>
                <span>
                  Checkpoint {current} of {total}
                </span>
              </>
            )}
          </QuestionnaireProgress>
          <QuestionnaireItem name="scope">
            <QuestionnaireTitle>How large is the change?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="small">A small fix</QuestionnaireChoice>
              <QuestionnaireChoice value="medium">Feature-sized change</QuestionnaireChoice>
              <QuestionnaireChoice value="large">Cross-package change</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="strategy">
            <QuestionnaireTitle>How should commits be organized?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="single">Single commit</QuestionnaireChoice>
              <QuestionnaireChoice value="logical">Logical commits</QuestionnaireChoice>
              <QuestionnaireChoice value="squash">Squash before review</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="tests">
            <QuestionnaireTitle>Which tests should run?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="targeted">Targeted tests</QuestionnaireChoice>
              <QuestionnaireChoice value="package">Package suite</QuestionnaireChoice>
              <QuestionnaireChoice value="workspace">Full workspace</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="delivery">
            <QuestionnaireTitle>How should the work be delivered?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="commit">Committed locally</QuestionnaireChoice>
              <QuestionnaireChoice value="branch">Push a review branch</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <Navigation submit="Save plan" />
        </Questionnaire>
        <Result>{result}</Result>
      </div>
    )
  },
)

// The question fades and rises in as it shows. Reduced motion sets the
// duration to 0s, so it just appears. Hidden questions leave at once.
const animatedItemStyles = css({
  '&[data-active]': {
    transitionProperty: 'opacity, translate',
    transitionDuration: 'var(--duration-normal)',
    transitionTimingFunction: 'var(--ease-out)',
  },
  '@starting-style': { '&[data-active]': { opacity: 0, translate: '0 0.5rem' } },
})

/** The current question fades in, while the progress and the buttons stay in place. */
export const QuestionnaireAnimated = clientEntry(import.meta.url, function QuestionnaireAnimated(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Agent run"
        items={[
          { name: 'task', required: true },
          { name: 'review', required: true },
        ]}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="task" mix={animatedItemStyles}>
          <QuestionnaireTitle>What should the agent do?</QuestionnaireTitle>
          <QuestionnaireDescription>Choose the task for this run.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="implement">Implement the requested change</QuestionnaireChoice>
            <QuestionnaireChoice value="debug">Debug the current behavior</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="review" mix={animatedItemStyles}>
          <QuestionnaireTitle>How should the work be reviewed?</QuestionnaireTitle>
          <QuestionnaireDescription>Choose who checks it.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="self">The agent checks its own work</QuestionnaireChoice>
            <QuestionnaireChoice value="person">A person reviews it</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

const cardStyles = css({ width: '100%' })

/**
 * Each question in a card. Its title is the card's heading, so the item
 * names it with aria-labelledby, and the description with aria-describedby.
 */
export const QuestionnaireCard = clientEntry(import.meta.url, function QuestionnaireCard(handle: Handle) {
  let result = ''

  return () => {
    let id = handle.id
    let questions = [
      {
        name: 'direction',
        title: 'What should we prototype next?',
        description: 'Choose one direction.',
        choices: [
          ['delegation', 'Sub-agent delegation'],
          ['questions', 'Question prompts'],
        ],
      },
      {
        name: 'timing',
        title: 'When should this be revisited?',
        description: 'Choose when this should be revisited.',
        choices: [
          ['week', 'This week'],
          ['cycle', 'Next cycle'],
        ],
      },
    ]

    return (
      <div mix={exampleStyles}>
        <Questionnaire
          aria-label="Prototype plan"
          items={questions.map(({ name }) => ({ name, required: true }))}
          shortcuts="numbers"
          onSubmit={({ answers }) => {
            result = `Saved. ${describeAnswers(answers)}`
            void handle.update()
          }}
        >
          {questions.map((question) => (
            <QuestionnaireItem
              key={question.name}
              name={question.name}
              aria-labelledby={`${id}-${question.name}-title`}
              aria-describedby={`${id}-${question.name}-description`}
            >
              <Card mix={cardStyles}>
                <CardHeader>
                  <CardTitle id={`${id}-${question.name}-title`} level={3}>
                    {question.title}
                  </CardTitle>
                  <CardDescription id={`${id}-${question.name}-description`}>{question.description}</CardDescription>
                  <CardAction>
                    <QuestionnaireProgress />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <QuestionnaireChoices>
                    {question.choices.map(([value, label]) => (
                      <QuestionnaireChoice key={value} value={value}>
                        {label}
                      </QuestionnaireChoice>
                    ))}
                  </QuestionnaireChoices>
                  <QuestionnaireError />
                </CardContent>
                <CardFooter>
                  <Navigation />
                </CardFooter>
              </Card>
            </QuestionnaireItem>
          ))}
        </Questionnaire>
        <Result>{result}</Result>
      </div>
    )
  }
})

/**
 * A questionnaire in a dialog. Cancel closes the dialog without an answer,
 * while Skip records one on purpose. Saving closes it.
 */
export const QuestionnaireDialog = clientEntry(import.meta.url, function QuestionnaireDialog(handle: Handle) {
  let open = false
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            open = next
            void handle.update()
          }}
        >
          <DialogTrigger mix={outline}>Open questionnaire</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Plan an agent interface</DialogTitle>
              <DialogDescription>Answer three questions to shape the next prototype.</DialogDescription>
            </DialogHeader>
            <Questionnaire
              aria-label="Plan an agent interface"
              items={prototypeItems}
              onSubmit={({ answers }) => {
                result = `Saved. ${describeAnswers(answers)}`
                open = false
                void handle.update()
              }}
            >
              <QuestionnaireProgress />
              <PrototypeQuestions />
              <DialogFooter>
                <QuestionnaireActions>
                  <DialogClose mix={outline}>Cancel</DialogClose>
                  <QuestionnairePrevious />
                  <QuestionnaireSkip />
                  <QuestionnaireNext />
                  <QuestionnaireSubmit>Save answers</QuestionnaireSubmit>
                </QuestionnaireActions>
              </DialogFooter>
            </Questionnaire>
          </DialogContent>
        </Dialog>
      </div>
      <Result>{result}</Result>
    </div>
  )
})

/** A choice that can't be picked, and says why in the description. */
export const QuestionnaireDisabled = clientEntry(import.meta.url, function QuestionnaireDisabled(handle: Handle) {
  let result = ''

  return () => (
    <div mix={exampleStyles}>
      <Questionnaire
        aria-label="Plan"
        items={[
          {
            name: 'plan',
            required: true,
            choices: [{ value: 'plus' }, { value: 'pro' }, { value: 'enterprise', disabled: true }],
          },
        ]}
        onSubmit={({ answers }) => {
          result = `Saved. ${describeAnswers(answers)}`
          void handle.update()
        }}
      >
        <QuestionnaireItem name="plan">
          <QuestionnaireTitle>Choose a plan</QuestionnaireTitle>
          <QuestionnaireDescription>Enterprise isn’t available on your account.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="plus">
              <span mix={strongStyles}>Plus</span>
              <QuestionnaireChoiceDescription>For individuals and small teams</QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
            <QuestionnaireChoice value="pro">
              <span mix={strongStyles}>Pro</span>
              <QuestionnaireChoiceDescription>For growing businesses</QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
            <QuestionnaireChoice value="enterprise" disabled>
              <span mix={strongStyles}>Enterprise</span>
              <QuestionnaireChoiceDescription>For large teams and enterprises</QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation />
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})

/**
 * No onSubmit: once every question passes, the form posts natively to its
 * action, as any form does. Without a script, every question shows at once
 * and the browser checks the required ones before it posts.
 */
export const QuestionnaireNativeForm = clientEntry(
  import.meta.url,
  function QuestionnaireNativeForm(handle: Handle<{ action: string }>) {
    return () => (
      <Questionnaire
        aria-label="Invoice reminders"
        action={handle.props.action}
        method="post"
        items={[
          { name: 'reminder', required: true, choices: [{ value: 'due' }, { value: 'week' }] },
          { name: 'channels', multiple: true, choices: [{ value: 'email' }, { value: 'sms' }] },
          { name: 'contact', required: true },
        ]}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="reminder">
          <QuestionnaireTitle>When should customers get a reminder?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="due">On the due date</QuestionnaireChoice>
            <QuestionnaireChoice value="week">A week before</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="channels">
          <QuestionnaireTitle>How should it reach them?</QuestionnaireTitle>
          <QuestionnaireDescription>
            Select all that apply, or skip to use the account’s default.
          </QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="email">Email</QuestionnaireChoice>
            <QuestionnaireChoice value="sms">Text message</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="contact">
          <QuestionnaireTitle>Who answers questions about the invoice?</QuestionnaireTitle>
          <QuestionnaireInput type="email" aria-label="Contact email" placeholder="billing@example.com" />
          <QuestionnaireError />
        </QuestionnaireItem>
        <Navigation submit="Save reminders" />
      </Questionnaire>
    )
  },
)

/**
 * Right-to-left text: the choices, keys and buttons follow the direction,
 * and Left and Right swap. Its labels are your own, in Arabic here.
 */
export const QuestionnaireRightToLeft = clientEntry(import.meta.url, function QuestionnaireRightToLeft(handle: Handle) {
  let result = ''

  return () => (
    <div dir="rtl" lang="ar" mix={exampleStyles}>
      <Questionnaire
        aria-label="تذكيرات الفواتير"
        items={[
          { name: 'reminder', required: true, choices: [{ value: 'due' }, { value: 'week' }] },
          { name: 'channel', choices: [{ value: 'email' }, { value: 'sms' }] },
        ]}
        shortcuts="numbers"
        defaultItem="channel"
        defaultAnswers={{ reminder: 'week' }}
        onSubmit={() => {
          result = 'تم الحفظ.'
          void handle.update()
        }}
      >
        <QuestionnaireProgress aria-label="التقدم">
          {({ current, total }) => `السؤال ${current} من ${total}`}
        </QuestionnaireProgress>
        <QuestionnaireItem name="reminder">
          <QuestionnaireTitle>متى نرسل التذكير؟</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="due">في تاريخ الاستحقاق</QuestionnaireChoice>
            <QuestionnaireChoice value="week">قبل أسبوع</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError>اختر إجابة للمتابعة.</QuestionnaireError>
        </QuestionnaireItem>
        <QuestionnaireItem name="channel">
          <QuestionnaireTitle>كيف نصل إلى العميل؟</QuestionnaireTitle>
          <QuestionnaireDescription>يمكنك تخطي هذا السؤال.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="email">
              البريد الإلكتروني
              <QuestionnaireChoiceDescription>نرسل الفاتورة مع التذكير.</QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
            <QuestionnaireChoice value="sms">رسالة نصية</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError>اختر إجابة أو تخطَّ هذا السؤال.</QuestionnaireError>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious>السابق</QuestionnairePrevious>
          <QuestionnaireSkip>تخطٍّ</QuestionnaireSkip>
          <QuestionnaireNext>التالي</QuestionnaireNext>
          <QuestionnaireSubmit>حفظ</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
      <Result>{result}</Result>
    </div>
  )
})
