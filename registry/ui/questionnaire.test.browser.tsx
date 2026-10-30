import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

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
  QuestionnaireSubmitError,
  QuestionnaireTitle,
} from './questionnaire.tsx'
import type {
  QuestionnaireAnswers,
  QuestionnaireItemDefinition,
  QuestionnaireProps,
  QuestionnaireSnapshot,
} from './questionnaire.tsx'

const items = [
  { name: 'direction', required: true, choices: [{ value: 'delegation' }, { value: 'questions' }] },
  { name: 'signals', multiple: true, choices: [{ value: 'progress' }, { value: 'risks' }] },
  { name: 'timing', required: true, choices: [{ value: 'week' }, { value: 'later' }] },
] as const satisfies readonly QuestionnaireItemDefinition[]

interface SurveyProps extends Partial<QuestionnaireProps> {
  rtl?: boolean
}

function Survey(handle: Handle<SurveyProps>) {
  return () => {
    let { rtl, ...props } = handle.props
    return (
      <div dir={rtl ? 'rtl' : undefined}>
        <Questionnaire aria-label="Prototype survey" items={items} {...props}>
          <QuestionnaireProgress />
          <QuestionnaireItem name="direction">
            <QuestionnaireTitle>What should we prototype next?</QuestionnaireTitle>
            <QuestionnaireDescription>Choose one direction or write another.</QuestionnaireDescription>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="delegation">Sub-agent delegation</QuestionnaireChoice>
              <QuestionnaireChoice value="questions">Question prompts</QuestionnaireChoice>
              <QuestionnaireInput aria-label="Another direction" />
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="signals">
            <QuestionnaireTitle>What should every update include?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="progress">Progress</QuestionnaireChoice>
              <QuestionnaireChoice value="risks">Risks</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireItem name="timing">
            <QuestionnaireTitle>When should this be revisited?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="week">This week</QuestionnaireChoice>
              <QuestionnaireChoice value="later">Later</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireError />
          <QuestionnaireActions>
            <QuestionnairePrevious />
            <QuestionnaireSkip />
            <QuestionnaireNext />
            <QuestionnaireSubmit pendingLabel="Saving…">Save answers</QuestionnaireSubmit>
            <button type="reset">Start over</button>
          </QuestionnaireActions>
        </Questionnaire>
      </div>
    )
  }
}

// The questionnaire settles in tasks after each commit.
function settle(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mount(node: Parameters<typeof render>[0]) {
  let result = render(node)
  await result.act(() => settle())
  await result.act(() => settle())
  return result
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  let promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function press(key: string, init: KeyboardEventInit = {}) {
  let target = (document.activeElement ?? document.body) as HTMLElement
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function active(container: ParentNode) {
  return container.querySelector<HTMLFieldSetElement>('fieldset[data-active]')?.dataset.name
}

function item(container: ParentNode, name: string) {
  return container.querySelector<HTMLFieldSetElement>(`fieldset[data-name="${name}"]`)!
}

function choice(container: ParentNode, value: string) {
  return container.querySelector<HTMLInputElement>(`input[data-slot="questionnaire-choice-input"][value="${value}"]`)!
}

function action(container: ParentNode, kind: string) {
  return container.querySelector<HTMLButtonElement>(`button[data-slot="questionnaire-${kind}"]`)!
}

function visibleError(container: ParentNode, name?: string) {
  let scope = name ? item(container, name) : container.querySelector('form')!
  let errors = [...scope.querySelectorAll<HTMLElement>('[data-slot="questionnaire-error"]')].filter(
    (error) => !error.hidden && (name ? true : error.dataset.scope === 'questionnaire'),
  )
  return errors.map((error) => error.textContent?.trim() ?? '')
}

function progress(container: ParentNode) {
  return container.querySelector('[data-slot="questionnaire-progress"]')?.textContent
}

async function click(act: (fn: () => unknown) => Promise<void>, element: HTMLElement) {
  await act(() => element.click())
  await act(() => settle())
}

describe('Questionnaire in the browser', () => {
  it('shows one question at a time, and hides and disables the rest for everyone', async (t) => {
    let { container, cleanup } = await mount(<Survey />)
    t.after(cleanup)

    let form = container.querySelector('form')!
    assert.ok(form.noValidate, 'it validates itself once it runs')
    assert.ok(form.hasAttribute('data-running'))
    assert.equal(active(container), 'direction')
    for (let name of ['signals', 'timing']) {
      assert.ok(item(container, name).hidden && item(container, name).inert, name)
    }
    assert.equal(progress(container), 'Question 1 of 3')
    assert.ok(action(container, 'previous').hidden && action(container, 'submit').hidden)
    assert.ok(!action(container, 'next').hidden && !action(container, 'next').disabled)
  })

  it('keeps Next from a required question without an answer, and says why', async (t) => {
    let { container, act, cleanup } = await mount(<Survey />)
    t.after(cleanup)

    action(container, 'next').focus()
    await click(act, action(container, 'next'))

    assert.equal(active(container), 'direction')
    assert.deepEqual(visibleError(container, 'direction'), ['Choose an answer to continue.'])
    let error = item(container, 'direction').querySelector<HTMLElement>('[data-slot="questionnaire-error"]')!
    assert.equal(error.getAttribute('role'), 'alert')
    assert.ok(item(container, 'direction').getAttribute('aria-describedby')!.split(' ').includes(error.id))
    assert.equal(item(container, 'direction').getAttribute('aria-invalid'), 'true')
    assert.equal(choice(container, 'delegation').getAttribute('aria-invalid'), 'true')
    assert.equal(document.activeElement, choice(container, 'delegation'), 'focus goes to the first answer')

    await click(act, choice(container, 'questions'))
    assert.deepEqual(visibleError(container, 'direction'), [], 'the answer clears the error')
    assert.ok(!item(container, 'direction').hasAttribute('aria-invalid'))
  })

  it('moves on with an answer, focuses the next question, and keeps answers on the way back', async (t) => {
    let { container, act, cleanup } = await mount(<Survey />)
    t.after(cleanup)

    await click(act, choice(container, 'questions'))
    await click(act, action(container, 'next'))

    assert.equal(active(container), 'signals')
    assert.equal(document.activeElement, item(container, 'signals'))
    assert.equal(progress(container), 'Question 2 of 3')
    assert.ok(!action(container, 'previous').hidden && !action(container, 'skip').hidden)

    await click(act, action(container, 'previous'))
    assert.equal(active(container), 'direction')
    assert.ok(choice(container, 'questions').checked)
    assert.equal(document.activeElement, item(container, 'direction'))
  })

  it('asks an optional question for an answer or a skip, and records the skip', async (t) => {
    let changes: QuestionnaireAnswers[] = []
    let { container, act, cleanup } = await mount(
      <Survey defaultItem="signals" onAnswersChange={(answers) => void changes.push(answers)} />,
    )
    t.after(cleanup)

    await click(act, action(container, 'next'))
    assert.deepEqual(visibleError(container, 'signals'), ['Choose an answer or skip this question.'])

    await click(act, action(container, 'skip'))
    assert.equal(active(container), 'timing')
    assert.equal(changes.at(-1)?.signals, null)
    assert.equal(item(container, 'signals').dataset.status, 'skipped')
    // A skipped question sends nothing.
    assert.ok(!choice(container, 'progress').hasAttribute('name'))
    assert.ok(action(container, 'skip').hidden, 'a required question has no Skip')

    await click(act, action(container, 'previous'))
    await click(act, choice(container, 'risks'))
    assert.equal(item(container, 'signals').dataset.status, 'answered')
    assert.equal(choice(container, 'risks').getAttribute('name'), 'signals')
  })

  it('collects several choices of a multiple question in their order', async (t) => {
    let submitted: QuestionnaireSnapshot[] = []
    let { container, act, cleanup } = await mount(
      <Survey
        defaultItem="timing"
        defaultAnswers={{ direction: 'delegation' }}
        onSubmit={(snapshot) => void submitted.push(snapshot)}
      />,
    )
    t.after(cleanup)

    await click(act, action(container, 'previous'))
    await click(act, choice(container, 'risks'))
    await click(act, choice(container, 'progress'))
    assert.equal(choice(container, 'risks').type, 'checkbox')
    await click(act, action(container, 'next'))
    await click(act, choice(container, 'week'))
    await click(act, action(container, 'submit'))

    assert.equal(submitted.length, 1)
    assert.deepEqual(submitted[0].answers, { direction: 'delegation', signals: ['progress', 'risks'], timing: 'week' })
    assert.deepEqual(submitted[0].formData.getAll('signals'), ['progress', 'risks'])
  })

  it('lets a freeform answer replace a choice, and a choice replace it again', async (t) => {
    let submitted: QuestionnaireSnapshot[] = []
    let { container, act, cleanup } = await mount(
      <Survey
        defaultAnswers={{ signals: null, timing: 'later' }}
        onSubmit={(snapshot) => void submitted.push(snapshot)}
      />,
    )
    t.after(cleanup)
    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!

    await click(act, choice(container, 'delegation'))
    assert.ok(!input.hasAttribute('name'), 'empty text sends nothing')
    await act(() => {
      input.value = 'Inbox triage'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => settle())
    assert.ok(!choice(container, 'delegation').checked, 'the text replaces the choice')
    assert.equal(input.getAttribute('name'), 'direction')
    assert.ok(input.hasAttribute('data-filled'))

    let form = container.querySelector('form')!
    assert.deepEqual(new FormData(form).getAll('direction'), ['Inbox triage'])

    await click(act, choice(container, 'questions'))
    assert.ok(!input.hasAttribute('name'), 'the choice replaces the text')
    assert.equal(input.value, 'Inbox triage', 'the text stays for later')
    assert.deepEqual(new FormData(form).getAll('direction'), ['questions'])

    await act(() => {
      input.value = 'Inbox triage, again'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => form.requestSubmit())
    await act(() => settle())
    assert.equal(submitted[0]?.answers.direction, 'Inbox triage, again')
  })

  it('sends one snapshot of every answer, and keeps the native submit from leaving the page', async (t) => {
    let submitted: QuestionnaireSnapshot[] = []
    let native = 0
    let { container, act, cleanup } = await mount(
      <Survey
        defaultItem="timing"
        defaultAnswers={{ direction: 'questions', signals: null }}
        onSubmit={(snapshot) => void submitted.push(snapshot)}
      />,
    )
    t.after(cleanup)
    let form = container.querySelector('form')!
    // A submit that wasn't cancelled would leave the page: count it instead.
    let listener = (event: Event) => {
      if (!event.defaultPrevented) native += 1
      event.preventDefault()
    }
    document.addEventListener('submit', listener)
    t.after(() => document.removeEventListener('submit', listener))

    await click(act, choice(container, 'later'))
    await click(act, action(container, 'submit'))

    assert.equal(native, 0)
    assert.equal(submitted.length, 1)
    assert.deepEqual(submitted[0].answers, { direction: 'questions', signals: null, timing: 'later' })
    assert.deepEqual([...submitted[0].formData.keys()], ['direction', 'timing'])
    assert.equal(form.dataset.pending, undefined)
  })

  it('goes back to the first question without an answer when submitting', async (t) => {
    let submitted = 0
    let { container, act, cleanup } = await mount(
      <Survey defaultItem="timing" defaultAnswers={{ timing: 'week' }} onSubmit={() => void (submitted += 1)} />,
    )
    t.after(cleanup)

    await click(act, action(container, 'submit'))

    assert.equal(submitted, 0)
    assert.equal(active(container), 'direction')
    assert.deepEqual(visibleError(container, 'direction'), ['Choose an answer to continue.'])
    assert.equal(document.activeElement, choice(container, 'delegation'))
  })

  it('waits for your async check, ignores presses meanwhile, and shows its message', async (t) => {
    let checks: Array<{ item: string; signal: AbortSignal; result: ReturnType<typeof deferred<string | undefined>> }> =
      []
    let { container, act, cleanup } = await mount(
      <Survey
        validate={({ item, signal }) => {
          let result = deferred<string | undefined>()
          checks.push({ item, signal, result })
          return result.promise
        }}
      />,
    )
    t.after(cleanup)

    await click(act, choice(container, 'questions'))
    action(container, 'next').focus()
    await click(act, action(container, 'next'))
    await click(act, action(container, 'next'))

    let form = container.querySelector('form')!
    assert.equal(checks.length, 1, 'one check at a time')
    assert.equal(checks[0].item, 'direction')
    assert.equal(form.getAttribute('aria-busy'), 'true')
    assert.equal(action(container, 'next').getAttribute('aria-disabled'), 'true')
    assert.ok(action(container, 'next').hasAttribute('data-pending'))
    assert.equal(document.activeElement, action(container, 'next'), 'the pressed button keeps focus')

    await act(() => checks[0].result.resolve('Pick a direction your team staffs this quarter.'))
    await act(() => settle())
    assert.equal(active(container), 'direction')
    assert.deepEqual(visibleError(container, 'direction'), ['Pick a direction your team staffs this quarter.'])
    assert.ok(!form.hasAttribute('aria-busy'))
    assert.equal(document.activeElement, choice(container, 'questions'))

    // A new answer drops the message, and a check that passes moves on.
    await click(act, choice(container, 'delegation'))
    assert.deepEqual(visibleError(container, 'direction'), [])
    await click(act, action(container, 'next'))
    await act(() => checks[1].result.resolve(undefined))
    await act(() => settle())
    assert.equal(active(container), 'signals')
  })

  it('shows a rejected check as the question’s error, and aborts a check whose answer changed', async (t) => {
    let checks: Array<{ signal: AbortSignal; result: ReturnType<typeof deferred<string | undefined>> }> = []
    let { container, act, cleanup } = await mount(
      <Survey
        validate={({ signal }) => {
          let result = deferred<string | undefined>()
          checks.push({ signal, result })
          return result.promise
        }}
      />,
    )
    t.after(cleanup)

    await click(act, choice(container, 'questions'))
    await click(act, action(container, 'next'))
    await act(() => checks[0].result.reject(new Error('The directory is offline. Try again.')))
    await act(() => settle())
    assert.deepEqual(visibleError(container, 'direction'), ['The directory is offline. Try again.'])

    await click(act, action(container, 'next'))
    await click(act, choice(container, 'delegation'))
    assert.ok(checks[1].signal.aborted)
    assert.ok(!container.querySelector('form')!.hasAttribute('aria-busy'))
    await act(() => checks[1].result.resolve(undefined))
    await act(() => settle())
    assert.equal(active(container), 'direction', 'a stale check moves nothing')
  })

  it('submits once while your submit runs, and keeps the answers when it fails', async (t) => {
    let runs: Array<ReturnType<typeof deferred<void>>> = []
    let { container, act, cleanup } = await mount(
      <Survey
        defaultItem="timing"
        defaultAnswers={{ direction: 'questions', signals: ['risks'], timing: 'later' }}
        onSubmit={() => {
          let run = deferred()
          runs.push(run)
          return run.promise
        }}
      />,
    )
    t.after(cleanup)
    let submit = action(container, 'submit')

    submit.focus()
    await click(act, submit)
    await click(act, submit)
    await act(() => press('Enter', { ctrlKey: true }))
    assert.equal(runs.length, 1)
    assert.equal(submit.getAttribute('aria-disabled'), 'true')
    assert.ok(submit.textContent?.includes('Saving…'))
    assert.ok(submit.querySelector('[data-slot="spinner"]'))

    await act(() => runs[0].reject(new Error('The server is busy. Your answers are still here.')))
    await act(() => settle())
    assert.deepEqual(visibleError(container), ['The server is busy. Your answers are still here.'])
    let error = container.querySelector<HTMLElement>('[data-scope="questionnaire"]')!
    assert.equal(error.getAttribute('role'), 'alert')
    assert.equal(document.activeElement, submit, 'focus stays where the person was')
    assert.ok(!submit.hasAttribute('aria-disabled'))
    assert.ok(choice(container, 'later').checked)
    assert.equal(active(container), 'timing')

    await click(act, submit)
    assert.equal(runs.length, 2, 'it can be sent again')
    assert.deepEqual(visibleError(container), [], 'a new attempt clears the old error')
  })

  it('leaves focus where the person moved it while a refused submit ran', async (t) => {
    let run = deferred()
    let { container, act, cleanup } = await mount(
      <Survey
        defaultItem="timing"
        defaultAnswers={{ direction: 'questions', signals: ['risks'], timing: 'later' }}
        onSubmit={() => run.promise}
      />,
    )
    t.after(cleanup)
    let submit = action(container, 'submit')

    submit.focus()
    await click(act, submit)
    assert.equal(submit.getAttribute('aria-disabled'), 'true')
    choice(container, 'later').focus()

    await act(() => run.reject(new Error('The server is busy. Your answers are still here.')))
    await act(() => settle())
    assert.deepEqual(visibleError(container), ['The server is busy. Your answers are still here.'])
    assert.equal(document.activeElement, choice(container, 'later'), 'focus stays on the answer, not on Submit')
  })

  it('sends the person back to the question a failed submit names', async (t) => {
    let { container, act, cleanup } = await mount(
      <Survey
        defaultItem="timing"
        defaultAnswers={{ direction: 'questions', signals: null, timing: 'week' }}
        onSubmit={() => {
          throw new QuestionnaireSubmitError('This direction is already taken.', { item: 'direction' })
        }}
      />,
    )
    t.after(cleanup)

    await click(act, action(container, 'submit'))

    assert.equal(active(container), 'direction')
    assert.deepEqual(visibleError(container, 'direction'), ['This direction is already taken.'])
    assert.equal(document.activeElement, choice(container, 'questions'), 'focus goes to the chosen answer')
  })

  it('resets to the default answers and the first question', async (t) => {
    let { container, act, cleanup } = await mount(<Survey defaultAnswers={{ direction: 'questions' }} />)
    t.after(cleanup)

    await click(act, choice(container, 'delegation'))
    await click(act, action(container, 'next'))
    await click(act, action(container, 'next'))
    assert.deepEqual(visibleError(container, 'signals'), ['Choose an answer or skip this question.'])

    await click(act, container.querySelector<HTMLButtonElement>('button[type="reset"]')!)
    await act(() => settle(10))

    assert.equal(active(container), 'direction')
    assert.ok(choice(container, 'questions').checked && !choice(container, 'delegation').checked)
    assert.deepEqual(visibleError(container, 'signals'), [])
    assert.equal(item(container, 'signals').dataset.status, 'unanswered')
  })

  it('asks a caller that keeps the question, and follows its answer with focus', async (t) => {
    let requests: string[] = []
    let control: { set?: (item: string) => void } = {}
    function Controlled(handle: Handle) {
      let current = 'direction'
      control.set = (next) => {
        current = next
        void handle.update()
      }
      return () => (
        <Survey
          item={current}
          defaultAnswers={{ direction: 'questions' }}
          onItemChange={(next) => void requests.push(next)}
        />
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)

    let focused = document.activeElement
    assert.ok(!container.contains(focused), `no focus on load: ${focused?.outerHTML.slice(0, 120)}`)
    await click(act, action(container, 'next'))
    assert.deepEqual(requests, ['signals'])
    assert.equal(active(container), 'direction', 'the caller decides')

    await act(() => control.set!('timing'))
    await act(() => settle())
    assert.equal(active(container), 'timing')
    assert.equal(document.activeElement, item(container, 'timing'))
  })

  it('asks a caller that keeps the answers, and puts a declined change back', async (t) => {
    let requests: QuestionnaireAnswers[] = []
    let control: { accept: boolean } = { accept: false }
    function Controlled(handle: Handle) {
      let answers: QuestionnaireAnswers = { direction: 'questions' }
      return () => (
        <Survey
          answers={answers}
          onAnswersChange={(next) => {
            requests.push(next)
            if (!control.accept) return
            answers = next
            void handle.update()
          }}
        />
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)

    await click(act, choice(container, 'delegation'))
    assert.equal(requests.at(-1)?.direction, 'delegation')
    assert.ok(choice(container, 'questions').checked && !choice(container, 'delegation').checked)

    control.accept = true
    await click(act, choice(container, 'delegation'))
    assert.ok(choice(container, 'delegation').checked)
    assert.equal(item(container, 'direction').dataset.status, 'answered')
  })

  it('moves through answers with the arrow keys, and between questions from outside them', async (t) => {
    let { container, act, cleanup } = await mount(
      <Survey defaultItem="signals" defaultAnswers={{ direction: 'questions' }} />,
    )
    t.after(cleanup)
    assert.equal(
      item(container, 'signals').getAttribute('aria-keyshortcuts'),
      'Meta+Enter Control+Enter ArrowUp ArrowDown ArrowLeft',
    )

    item(container, 'signals').focus()
    await act(() => press('ArrowDown'))
    assert.equal(document.activeElement, choice(container, 'progress'))
    await act(() => press('ArrowDown'))
    assert.equal(document.activeElement, choice(container, 'risks'))
    await act(() => press('ArrowDown'))
    assert.equal(document.activeElement, choice(container, 'progress'), 'it wraps')
    await act(() => press('ArrowUp'))
    assert.equal(document.activeElement, choice(container, 'risks'))

    // Right needs an answer or a skip.
    await act(() => press('ArrowRight'))
    await act(() => settle())
    assert.equal(active(container), 'signals')
    await act(() => press(' '))
    await click(act, choice(container, 'risks'))
    await act(() => press('ArrowRight'))
    await act(() => settle())
    assert.equal(active(container), 'timing')
    await act(() => press('ArrowLeft'))
    await act(() => settle())
    assert.equal(active(container), 'signals')
  })

  it('swaps Left and Right in right-to-left text', async (t) => {
    let { container, act, cleanup } = await mount(
      <Survey rtl defaultItem="signals" defaultAnswers={{ signals: null }} />,
    )
    t.after(cleanup)

    assert.equal(
      item(container, 'signals').getAttribute('aria-keyshortcuts'),
      'Meta+Enter Control+Enter ArrowUp ArrowDown ArrowRight ArrowLeft',
    )
    item(container, 'signals').focus()
    await act(() => press('ArrowLeft'))
    await act(() => settle())
    assert.equal(active(container), 'timing')
    await act(() => press('ArrowRight'))
    await act(() => settle())
    assert.equal(active(container), 'signals')
  })

  it('continues with Enter on an answer and with Control or Command and Enter anywhere', async (t) => {
    let submitted = 0
    let { container, act, cleanup } = await mount(
      <Survey defaultAnswers={{ signals: ['risks'] }} onSubmit={() => void (submitted += 1)} />,
    )
    t.after(cleanup)

    choice(container, 'delegation').focus()
    let unanswered = press('Enter')
    assert.ok(unanswered.defaultPrevented, 'Enter never submits from an answer')
    await act(() => settle())
    assert.equal(active(container), 'direction', 'an unchecked answer stays')

    await click(act, choice(container, 'delegation'))
    choice(container, 'delegation').focus()
    await act(() => press('Enter'))
    await act(() => settle())
    assert.equal(active(container), 'signals')

    await act(() => press('Enter', { metaKey: true }))
    await act(() => settle())
    assert.equal(active(container), 'timing')
    await click(act, choice(container, 'week'))
    await act(() => press('Enter', { ctrlKey: true }))
    await act(() => settle())
    assert.equal(submitted, 1, 'on the last question it submits')
  })

  it('picks answers by their keys, but not while typing', async (t) => {
    let { container, act, cleanup } = await mount(<Survey shortcuts="letters" />)
    t.after(cleanup)

    assert.deepEqual(
      [...item(container, 'direction').querySelectorAll('[data-slot="questionnaire-choice-shortcut"]')].map(
        (shortcut) => shortcut.textContent,
      ),
      ['A', 'B'],
    )
    assert.equal(choice(container, 'questions').getAttribute('aria-keyshortcuts'), 'B')
    item(container, 'direction').focus()
    await act(() => press('b'))
    await act(() => settle())
    assert.ok(choice(container, 'questions').checked)
    assert.equal(document.activeElement, choice(container, 'questions'))
    assert.equal(active(container), 'direction', 'a key picks, and doesn’t move on')

    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!
    input.focus()
    let typed = press('a')
    assert.ok(!typed.defaultPrevented)
    assert.ok(!choice(container, 'delegation').checked)
  })

  it('leaves a disabled choice out of the answers and the keys', async (t) => {
    let { container, act, cleanup } = await mount(
      <Questionnaire shortcuts="numbers" defaultAnswers={{ plan: 'enterprise' }}>
        <QuestionnaireItem name="plan" required>
          <QuestionnaireTitle>Choose a plan</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="enterprise" disabled>
              Enterprise
            </QuestionnaireChoice>
            <QuestionnaireChoice value="pro">Pro</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireSubmit />
      </Questionnaire>,
    )
    t.after(cleanup)

    assert.ok(choice(container, 'enterprise').disabled)
    assert.equal(item(container, 'plan').dataset.status, 'unanswered', 'a disabled default doesn’t answer it')
    assert.equal(choice(container, 'pro').closest('label')!.dataset.shortcut, '1')
    await click(act, action(container, 'submit'))
    assert.deepEqual(visibleError(container, 'plan'), ['Choose an answer to continue.'])
  })

  it('follows questions that are turned off or replaced, without a render of the root', async (t) => {
    let control: { set?: (state: { remote: boolean; region: string }) => void } = {}
    function Follow(handle: Handle) {
      let state = { remote: true, region: 'region' }
      control.set = (next) => {
        state = next
        void handle.update()
      }
      return () => (
        <>
          <QuestionnaireItem name="runtime" required>
            <QuestionnaireTitle>Where should the agent run?</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="local">Locally</QuestionnaireChoice>
            </QuestionnaireChoices>
          </QuestionnaireItem>
          <QuestionnaireItem key={state.region} name={state.region} disabled={!state.remote}>
            <QuestionnaireTitle>{state.region === 'region' ? 'Which region?' : 'Which city?'}</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="eu">Europe</QuestionnaireChoice>
            </QuestionnaireChoices>
          </QuestionnaireItem>
          <QuestionnaireItem name="notes">
            <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Notes" />
          </QuestionnaireItem>
        </>
      )
    }
    let { container, act, cleanup } = await mount(
      <Questionnaire defaultItem="region" defaultAnswers={{ runtime: 'local' }}>
        <Follow />
        <QuestionnaireProgress />
      </Questionnaire>,
    )
    t.after(cleanup)

    assert.equal(progress(container), 'Question 2 of 3')
    item(container, 'region').focus()

    await act(() => control.set!({ remote: true, region: 'city' }))
    await act(() => settle())
    await act(() => settle())
    assert.equal(active(container), 'city', 'the question in its place')
    assert.equal(document.activeElement, item(container, 'city'))

    await act(() => control.set!({ remote: false, region: 'city' }))
    await act(() => settle())
    await act(() => settle())
    assert.equal(progress(container), 'Question 2 of 2')
    assert.equal(active(container), 'notes')
    assert.ok(item(container, 'city').disabled)
  })

  it('keeps two questionnaires apart', async (t) => {
    let { container, act, cleanup } = await mount(
      <>
        <Survey shortcuts="letters" />
        <Survey shortcuts="letters" />
      </>,
    )
    t.after(cleanup)
    let [first, second] = [...container.querySelectorAll('form')]

    await click(act, choice(first, 'questions'))
    await click(act, action(first, 'next'))
    assert.equal(active(first), 'signals')
    assert.equal(active(second), 'direction')
    assert.ok(!choice(second, 'questions').checked)

    item(second, 'direction').focus()
    await act(() => press('a'))
    assert.ok(choice(second, 'delegation').checked)
    assert.ok(!choice(first, 'delegation').checked)

    let ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    assert.equal(new Set(ids).size, ids.length, ids.join(' '))
  })

  it('keeps the keys from a Next or Submit you disabled', async (t) => {
    let submitted = 0
    let { container, act, cleanup } = await mount(
      <Questionnaire defaultAnswers={{ a: 'one', b: 'two' }} onSubmit={() => void (submitted += 1)}>
        <QuestionnaireItem name="a">
          <QuestionnaireTitle>A</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireItem name="b">
          <QuestionnaireTitle>B</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="two">Two</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnaireNext disabled />
          <QuestionnaireSubmit disabled />
        </QuestionnaireActions>
      </Questionnaire>,
    )
    t.after(cleanup)

    item(container, 'a').focus()
    await act(() => press('Enter', { ctrlKey: true }))
    await act(() => press('ArrowRight'))
    await act(() => settle())
    assert.equal(active(container), 'a')
  })

  it('moves nothing when the question changed while a check ran', async (t) => {
    let checks: Array<ReturnType<typeof deferred<string | undefined>>> = []
    let control: { set?: (item: string) => void } = {}
    function Controlled(handle: Handle) {
      let current = 'direction'
      control.set = (next) => {
        current = next
        void handle.update()
      }
      return () => (
        <Survey
          item={current}
          defaultAnswers={{ direction: 'questions' }}
          onItemChange={(next) => control.set!(next)}
          validate={() => {
            let check = deferred<string | undefined>()
            checks.push(check)
            return check.promise
          }}
        />
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)

    await click(act, action(container, 'next'))
    await act(() => control.set!('timing'))
    await act(() => checks[0].resolve(undefined))
    await act(() => settle())
    assert.equal(active(container), 'timing')
  })

  it('tells each question about its status changes', async (t) => {
    let statuses: string[] = []
    let { container, act, cleanup } = await mount(
      <Questionnaire defaultItem="b">
        <QuestionnaireItem name="a" required>
          <QuestionnaireTitle>A</QuestionnaireTitle>
        </QuestionnaireItem>
        <QuestionnaireItem name="b" onStatusChange={(status) => void statuses.push(status)}>
          <QuestionnaireTitle>B</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireSubmit />
        </QuestionnaireActions>
      </Questionnaire>,
    )
    t.after(cleanup)

    assert.deepEqual(statuses, [], 'nothing on the first render')
    await click(act, choice(container, 'one'))
    await click(act, action(container, 'skip'))
    assert.deepEqual(statuses, ['answered', 'skipped'])
  })

  it('adds the browser’s own checks of an answer with noValidate={false}', async (t) => {
    let { container, act, cleanup } = await mount(
      <Questionnaire noValidate={false}>
        <QuestionnaireItem name="email" required>
          <QuestionnaireTitle>Where should we send the invoice?</QuestionnaireTitle>
          <QuestionnaireInput type="email" aria-label="Email" />
        </QuestionnaireItem>
        <QuestionnaireItem name="copy">
          <QuestionnaireTitle>Anyone else?</QuestionnaireTitle>
          <QuestionnaireInput aria-label="Copy to" />
        </QuestionnaireItem>
        <QuestionnaireNext />
      </Questionnaire>,
    )
    t.after(cleanup)
    let input = container.querySelector<HTMLInputElement>('input[type="email"]')!

    await act(() => {
      input.value = 'ap@'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(act, action(container, 'next'))
    assert.equal(active(container), 'email')
    assert.equal(document.activeElement, input)
    assert.ok(container.querySelector('form')!.noValidate, 'the form itself never blocks a hidden question')

    await act(() => {
      input.value = 'ap@globex.example'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(act, action(container, 'next'))
    assert.equal(active(container), 'copy')
  })

  it('drops a submit whose answers change while its checks run, and checks the new answers', async (t) => {
    let checks: Array<{
      answers: QuestionnaireAnswers
      signal: AbortSignal
      result: ReturnType<typeof deferred<string | undefined>>
    }> = []
    let submitted: QuestionnaireSnapshot[] = []
    let { container, act, cleanup } = await mount(
      <Questionnaire
        defaultAnswers={{ code: 'good' }}
        validate={({ answers, signal }) => {
          let result = deferred<string | undefined>()
          checks.push({ answers, signal, result })
          return result.promise
        }}
        onSubmit={(snapshot) => void submitted.push(snapshot)}
      >
        <QuestionnaireItem name="code" required>
          <QuestionnaireTitle>Which code?</QuestionnaireTitle>
          <QuestionnaireInput aria-label="Code" />
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireSubmit />
      </Questionnaire>,
    )
    t.after(cleanup)
    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!

    await click(act, action(container, 'submit'))
    assert.equal(checks.length, 1)
    await act(() => {
      input.value = 'bad'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => settle())
    assert.ok(checks[0].signal.aborted, 'a changed answer aborts the running check')
    assert.ok(!container.querySelector('form')!.hasAttribute('aria-busy'))
    await act(() => checks[0].result.resolve(undefined))
    await act(() => settle())
    assert.equal(submitted.length, 0, 'nothing is sent for answers that no longer show')

    await click(act, action(container, 'submit'))
    assert.equal(checks[1].answers.code, 'bad')
    await act(() => checks[1].result.resolve(undefined))
    await act(() => settle())
    assert.equal(submitted.length, 1)
    assert.equal(submitted[0].answers.code, 'bad')
    assert.equal(submitted[0].formData.get('code'), 'bad')
  })

  it('lets a question’s own required, disabled and multiple win over items, also in the flow and the snapshot', async (t) => {
    let submitted: QuestionnaireSnapshot[] = []
    let { container, act, cleanup } = await mount(
      <Questionnaire
        items={[{ name: 'a' }, { name: 'b' }, { name: 'c' }]}
        defaultAnswers={{ c: 'one' }}
        onSubmit={(snapshot) => void submitted.push(snapshot)}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="a" disabled>
          <QuestionnaireTitle>A</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireItem name="b" required>
          <QuestionnaireTitle>B</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="c" multiple>
          <QuestionnaireTitle>C</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
            <QuestionnaireChoice value="two">Two</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit />
        </QuestionnaireActions>
      </Questionnaire>,
    )
    t.after(cleanup)

    assert.equal(active(container), 'b', 'the disabled question hands over its place')
    assert.ok(!container.contains(document.activeElement), 'no focus moves on load')
    assert.equal(progress(container), 'Question 1 of 2')
    assert.ok(action(container, 'skip').hidden, 'a required question has no Skip')
    await act(() => press('Enter', { ctrlKey: true }))
    await click(act, action(container, 'skip'))
    assert.equal(active(container), 'b')
    await click(act, action(container, 'next'))
    assert.deepEqual(visibleError(container, 'b'), ['Choose an answer to continue.'])

    await click(act, choice(item(container, 'b'), 'one'))
    await click(act, action(container, 'next'))
    await click(act, choice(item(container, 'c'), 'two'))
    await click(act, action(container, 'submit'))
    assert.deepEqual(submitted[0]?.answers, { b: 'one', c: ['one', 'two'] })
  })

  it('puts back the text of a controlled answer that stays or becomes empty', async (t) => {
    let control: { set?: (answers: QuestionnaireAnswers) => void } = {}
    function Controlled(handle: Handle) {
      let answers: QuestionnaireAnswers = { note: '' }
      control.set = (next) => {
        answers = next
        void handle.update()
      }
      return () => (
        <Questionnaire answers={answers} onAnswersChange={() => {}}>
          <QuestionnaireItem name="note">
            <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Note" />
          </QuestionnaireItem>
        </Questionnaire>
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)
    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!

    await act(() => {
      input.value = 'declined text'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => settle())
    assert.equal(input.value, '', 'a declined edit goes back')

    await act(() => control.set!({ note: 'Keep the API stable.' }))
    await act(() => settle())
    assert.equal(input.value, 'Keep the API stable.')
    assert.equal(input.getAttribute('name'), 'note')
    await act(() => control.set!({ note: '' }))
    await act(() => settle())
    assert.equal(input.value, '', 'a cleared answer clears the box')
    assert.ok(!input.hasAttribute('name'))
  })

  it('keeps a picked choice when the person empties the freeform box beside it', async (t) => {
    let { container, act, cleanup } = await mount(<Survey />)
    t.after(cleanup)
    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!

    await act(() => {
      input.value = 'Inbox triage'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(act, choice(container, 'questions'))
    await act(() => {
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => settle())
    assert.ok(choice(container, 'questions').checked)
    assert.equal(item(container, 'direction').dataset.status, 'answered')
  })

  it('stops counting a choice once it is removed or replaced', async (t) => {
    let submitted: QuestionnaireSnapshot[] = []
    let control: { set?: (values: string[]) => void } = {}
    function Replaced(handle: Handle<{ withItems: boolean }>) {
      let values = ['one']
      control.set = (next) => {
        values = next
        void handle.update()
      }
      return () => (
        <Questionnaire
          items={
            handle.props.withItems
              ? [{ name: 'a', required: true, choices: values.map((value) => ({ value })) }]
              : undefined
          }
          onSubmit={(snapshot) => void submitted.push(snapshot)}
        >
          <QuestionnaireItem name="a" required>
            <QuestionnaireTitle>A</QuestionnaireTitle>
            <QuestionnaireChoices>
              {values.map((value) => (
                <QuestionnaireChoice key={value} value={value}>
                  {value}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireSubmit />
        </Questionnaire>
      )
    }

    for (let withItems of [true, false]) {
      submitted = []
      let { container, act, cleanup } = await mount(<Replaced withItems={withItems} />)
      await click(act, choice(container, 'one'))
      assert.equal(item(container, 'a').dataset.status, 'answered')

      await act(() => control.set!(['two']))
      await act(() => settle())
      await act(() => settle())
      assert.equal(item(container, 'a').dataset.status, 'unanswered', `items: ${withItems}`)
      await click(act, action(container, 'submit'))
      assert.equal(submitted.length, 0, `items: ${withItems}`)
      assert.deepEqual(visibleError(container, 'a'), ['Choose an answer to continue.'])
      cleanup()
    }
    t.after(() => {})
  })

  it('aborts a check when the caller’s answers change while it runs, and sends nothing unchecked', async (t) => {
    let checks: Array<{ item: string; signal: AbortSignal; result: ReturnType<typeof deferred<string | undefined>> }> =
      []
    let submitted: QuestionnaireSnapshot[] = []
    let control: { set?: (answers: QuestionnaireAnswers) => void } = {}
    function Controlled(handle: Handle) {
      let answers: QuestionnaireAnswers = { code: 'good', note: 'ok' }
      control.set = (next) => {
        answers = next
        void handle.update()
      }
      return () => (
        <Questionnaire
          answers={answers}
          onAnswersChange={(next) => control.set!(next)}
          validate={({ item, signal }) => {
            let result = deferred<string | undefined>()
            checks.push({ item, signal, result })
            return result.promise
          }}
          onSubmit={(snapshot) => void submitted.push(snapshot)}
        >
          <QuestionnaireItem name="code" required>
            <QuestionnaireTitle>Which code?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Code" />
          </QuestionnaireItem>
          <QuestionnaireItem name="note" required>
            <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Note" />
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnaireNext />
            <QuestionnaireSubmit />
          </QuestionnaireActions>
        </Questionnaire>
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)

    // Next: the caller replaces the answer being checked.
    await click(act, action(container, 'next'))
    await act(() => control.set!({ code: 'bad', note: 'ok' }))
    await act(() => settle())
    assert.ok(checks[0].signal.aborted, 'Next’s check aborts')
    await act(() => checks[0].result.resolve(undefined))
    await act(() => settle())
    assert.equal(active(container), 'code', 'a stale check moves nothing')

    // Submit: the caller replaces an answer while the checks run.
    await act(() => control.set!({ code: 'good', note: 'ok' }))
    await click(act, action(container, 'next'))
    await act(() => checks[1].result.resolve(undefined))
    await act(() => settle())
    assert.equal(active(container), 'note')
    await click(act, action(container, 'submit'))
    let submitChecks = checks.slice(2)
    assert.equal(submitChecks.length, 2)
    await act(() => control.set!({ code: 'bad', note: 'ok' }))
    await act(() => settle())
    assert.ok(
      submitChecks.every((check) => check.signal.aborted),
      'the submit’s checks abort',
    )
    assert.ok(!container.querySelector('form')!.hasAttribute('aria-busy'))
    for (let check of submitChecks) await act(() => check.result.resolve(undefined))
    await act(() => settle())
    assert.equal(submitted.length, 0, 'bad was never checked, so nothing is sent')
  })

  it('aborts a submit when the caller takes back a skip while its checks run', async (t) => {
    let checks: Array<{ signal: AbortSignal; result: ReturnType<typeof deferred<string | undefined>> }> = []
    let submitted: QuestionnaireSnapshot[] = []
    let control: { set?: (answers: QuestionnaireAnswers) => void } = {}
    function Controlled(handle: Handle) {
      let answers: QuestionnaireAnswers = { code: 'good', note: null }
      control.set = (next) => {
        answers = next
        void handle.update()
      }
      return () => (
        <Questionnaire
          answers={answers}
          defaultItem="note"
          onAnswersChange={(next) => control.set!(next)}
          validate={({ signal }) => {
            let result = deferred<string | undefined>()
            checks.push({ signal, result })
            return result.promise
          }}
          onSubmit={(snapshot) => void submitted.push(snapshot)}
        >
          <QuestionnaireItem name="code" required>
            <QuestionnaireTitle>Which code?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Code" />
          </QuestionnaireItem>
          <QuestionnaireItem name="note">
            <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
            <QuestionnaireInput aria-label="Note" />
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireSubmit />
        </Questionnaire>
      )
    }
    let { container, act, cleanup } = await mount(<Controlled />)
    t.after(cleanup)

    await click(act, action(container, 'submit'))
    assert.equal(checks.length, 1, 'only the answered code is checked')
    await act(() => control.set!({ code: 'good' }))
    await act(() => settle())
    assert.equal(item(container, 'note').dataset.status, 'unanswered')
    assert.ok(checks[0].signal.aborted, 'an unanswered note isn’t the skip the checks saw')
    await act(() => checks[0].result.resolve(undefined))
    await act(() => settle())
    assert.equal(submitted.length, 0)

    await click(act, action(container, 'submit'))
    assert.deepEqual(visibleError(container, 'note'), ['Choose an answer or skip this question.'])
    assert.equal(submitted.length, 0)
  })

  it('keeps a saved freeform answer that a child component renders, through hydration', async (t) => {
    function OwnInput() {
      return () => <QuestionnaireInput aria-label="Another answer" />
    }
    let changes: QuestionnaireAnswers[] = []
    let node = (
      <Questionnaire
        items={[{ name: 'answer', required: true, choices: [{ value: 'fixed' }] }]}
        defaultAnswers={{ answer: 'Saved text' }}
        onAnswersChange={(answers) => void changes.push(answers)}
      >
        <QuestionnaireItem name="answer">
          <QuestionnaireTitle>Which answer?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="fixed">Fixed</QuestionnaireChoice>
            <OwnInput />
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>
    )
    let container = document.createElement('div')
    container.innerHTML = (await renderToString(node)).replace(/<head>[\s\S]*?<\/head>/, '')
    document.body.append(container)
    let input = container.querySelector<HTMLInputElement>('input[data-slot="questionnaire-input"]')!
    assert.equal(input.value, 'Saved text', 'the server renders the saved text')

    let { act, cleanup } = render(node, { container })
    t.after(cleanup)
    await act(() => settle())
    await act(() => settle())

    assert.equal(container.querySelector('input[data-slot="questionnaire-input"]'), input, 'hydrated in place')
    assert.equal(input.value, 'Saved text')
    assert.equal(input.getAttribute('name'), 'answer')
    assert.equal(item(container, 'answer').dataset.status, 'answered')
    assert.deepEqual(changes, [], 'nothing changed, so nothing is reported')
  })

  it('takes the answers a person changed before hydration, and only those', async (t) => {
    let changes: QuestionnaireAnswers[] = []
    let node = (
      <Survey defaultAnswers={{ direction: 'delegation' }} onAnswersChange={(answers) => void changes.push(answers)} />
    )
    let container = document.createElement('div')
    container.innerHTML = (await renderToString(node)).replace(/<head>[\s\S]*?<\/head>/, '')
    document.body.append(container)
    // As a person would before the script ran.
    choice(container, 'questions').checked = true

    let { act, cleanup } = render(node, { container })
    t.after(cleanup)
    await act(() => settle())
    await act(() => settle())

    assert.ok(choice(container, 'questions').checked)
    assert.deepEqual(changes.at(-1), { direction: 'questions' })
    assert.equal(item(container, 'direction').dataset.status, 'answered')
  })

  it('aborts a running check when it goes away', async (t) => {
    let signals: AbortSignal[] = []
    let { container, act, cleanup } = await mount(
      <Survey
        validate={({ signal }) => {
          signals.push(signal)
          return new Promise(() => {})
        }}
      />,
    )
    t.after(() => {})

    await click(act, choice(container, 'questions'))
    await click(act, action(container, 'next'))
    cleanup()
    assert.ok(signals[0].aborted)
  })
})
