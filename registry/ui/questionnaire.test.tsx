import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Questionnaire,
  QuestionnaireActions,
  questionnaireAnswerStatus,
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
  QuestionnaireTitle,
} from './questionnaire.tsx'
import type { QuestionnaireItemDefinition, QuestionnaireProps } from './questionnaire.tsx'

const items = [
  { name: 'direction', required: true, choices: [{ value: 'delegation' }, { value: 'questions' }] },
  { name: 'signals', multiple: true, choices: [{ value: 'progress' }, { value: 'risks' }] },
  { name: 'timing', required: true, choices: [{ value: 'week' }, { value: 'later' }] },
] as const satisfies readonly QuestionnaireItemDefinition[]

function Navigation() {
  return () => (
    <QuestionnaireActions>
      <QuestionnairePrevious />
      <QuestionnaireSkip />
      <QuestionnaireNext />
      <QuestionnaireSubmit>Save answers</QuestionnaireSubmit>
    </QuestionnaireActions>
  )
}

// A caller's own component between the root and its questions.
function Questions() {
  return () => (
    <>
      <QuestionnaireItem name="direction">
        <QuestionnaireTitle>What should we prototype next?</QuestionnaireTitle>
        <QuestionnaireDescription>Choose one direction or write another.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="delegation">
            Sub-agent delegation
            <QuestionnaireChoiceDescription>Show what comes back.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
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
    </>
  )
}

function Survey(handle: Handle<Partial<QuestionnaireProps>>) {
  return () => (
    <Questionnaire aria-label="Prototype survey" items={items} {...handle.props}>
      <QuestionnaireProgress />
      <Questions />
      <Navigation />
    </Questionnaire>
  )
}

function fieldsets(html: string) {
  return tags(html, 'fieldset')
}

function slot(html: string, name: string) {
  return tags(html).filter((tag) => tag.attributes.get('data-slot') === name)
}

function inputs(html: string, name: string) {
  return tags(html, 'input').filter((tag) => tag.attributes.get('name') === name)
}

describe('Questionnaire on the server', () => {
  it('renders one native form with a fieldset per question, and the current one active', async () => {
    let html = await renderToString(<Survey />)
    let form = attributes(html, 'form')
    let [direction, signals, timing] = fieldsets(html)

    assert.equal(tags(html, 'form').length, 1)
    assert.equal(form.get('data-slot'), 'questionnaire')
    // The browser validates a form submitted without a script.
    assert.ok(!form.has('novalidate'), html)
    assert.equal(direction.attributes.get('data-name'), 'direction')
    assert.ok(direction.attributes.has('data-active') && !direction.attributes.has('data-inactive'))
    for (let item of [signals, timing]) {
      assert.ok(item.attributes.has('data-inactive') && !item.attributes.has('data-active'))
      // Hidden by style until the script runs, so a page without one can show every question.
      assert.ok(!item.attributes.has('hidden') && !item.attributes.has('inert'), JSON.stringify([...item.attributes]))
    }
    assert.equal(tags(html, 'legend').length, 3)
    assert.ok(text(html).includes('What should we prototype next?'))
  })

  it('puts a disabled default button first, so Enter in a field submits nothing', async () => {
    let html = await renderToString(<Survey />)
    let [first] = tags(html, 'button')

    assert.equal(first.attributes.get('data-slot'), 'questionnaire-default-button')
    assert.equal(first.attributes.get('type'), 'submit')
    assert.ok(first.attributes.has('disabled') && first.attributes.has('hidden'))
  })

  it('names the answers after their question: radios, checkboxes and the freeform input', async () => {
    let html = await renderToString(<Survey />)

    assert.deepEqual(
      inputs(html, 'direction').map((input) => input.attributes.get('type')),
      ['radio', 'radio', 'text'],
    )
    assert.deepEqual(
      inputs(html, 'signals').map((input) => [input.attributes.get('type'), input.attributes.get('value')]),
      [
        ['checkbox', 'progress'],
        ['checkbox', 'risks'],
      ],
    )
    // A required single-answer question with radios only needs one natively, for a page without a script.
    assert.ok(inputs(html, 'timing').every((input) => input.attributes.has('required')))
    // With a freeform answer, either may answer it, so neither is required on its own.
    assert.ok(inputs(html, 'direction').every((input) => !input.attributes.has('required')))
    assert.ok(inputs(html, 'signals').every((input) => !input.attributes.has('required')))
  })

  it('takes required, multiple and disabled from items, and lets the item override them', async () => {
    let html = await renderToString(
      <Questionnaire
        items={[
          { name: 'a', required: true },
          { name: 'b', multiple: true },
        ]}
      >
        <QuestionnaireItem name="a">
          <QuestionnaireTitle>A</QuestionnaireTitle>
        </QuestionnaireItem>
        <QuestionnaireItem name="b" multiple={false}>
          <QuestionnaireTitle>B</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="one">One</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>,
    )
    let [a, b] = fieldsets(html)

    assert.ok(a.attributes.has('data-required'))
    assert.ok(!b.attributes.has('data-multiple'))
    assert.equal(inputs(html, 'b')[0].attributes.get('type'), 'radio')
  })

  it('renders the progress and the actions of the first question from items', async () => {
    let html = await renderToString(<Survey />)
    let progress = attributes(html, 'slot:questionnaire-progress')
    let [previous] = slot(html, 'questionnaire-previous')
    let [skip] = slot(html, 'questionnaire-skip')
    let [next] = slot(html, 'questionnaire-next')
    let [submit] = slot(html, 'questionnaire-submit')

    assert.equal(progress.get('role'), 'progressbar')
    assert.equal(progress.get('aria-label'), 'Questionnaire progress')
    assert.deepEqual(
      ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].map((name) => progress.get(name)),
      ['1', '3', '1', 'Question 1 of 3'],
    )
    assert.ok(text(html).includes('Question 1 of 3'))
    assert.ok(previous.attributes.has('data-hidden') && skip.attributes.has('data-hidden'))
    assert.ok(next.attributes.has('data-visible') && submit.attributes.has('data-hidden'))
    // Navigation needs the script: it's natively disabled until then. Submit works without one.
    for (let action of [previous, skip, next]) assert.ok(action.attributes.has('disabled'))
    assert.ok(!submit.attributes.has('disabled'))
    assert.equal(submit.attributes.get('type'), 'submit')
    assert.equal(next.attributes.get('type'), 'button')
    // None is hidden by attribute, and no key is promised before the script runs.
    for (let action of [previous, skip, next, submit]) {
      assert.ok(!action.attributes.has('hidden') && !action.attributes.has('aria-keyshortcuts'))
    }
  })

  it('starts at the default question, and shows Previous and Skip for an optional one', async () => {
    let html = await renderToString(<Survey defaultItem="signals" />)
    let [previous] = slot(html, 'questionnaire-previous')
    let [skip] = slot(html, 'questionnaire-skip')

    assert.ok(fieldsets(html)[1].attributes.has('data-active'))
    assert.ok(text(html).includes('Question 2 of 3'))
    assert.ok(previous.attributes.has('data-visible') && skip.attributes.has('data-visible'))
  })

  it('shows Submit on the last question', async () => {
    let html = await renderToString(<Survey defaultItem="timing" />)
    let [next] = slot(html, 'questionnaire-next')
    let [submit] = slot(html, 'questionnaire-submit')

    assert.ok(next.attributes.has('data-hidden') && submit.attributes.has('data-visible'))
    assert.ok(text(html).includes('Save answers'))
  })

  it('falls back to the first question for an unknown or disabled default', async () => {
    for (let defaultItem of ['unknown', 'signals']) {
      let html = await renderToString(
        <Survey defaultItem={defaultItem} items={[items[0], { ...items[1], disabled: true }, items[2]]} />,
      )
      assert.ok(fieldsets(html)[0].attributes.has('data-active'), defaultItem)
    }
  })

  it('follows a controlled question over the default', async () => {
    let html = await renderToString(<Survey item="timing" defaultItem="signals" />)

    assert.ok(fieldsets(html)[2].attributes.has('data-active'))
  })

  it('checks the default answers natively: a choice, several choices, and text', async () => {
    let html = await renderToString(
      <Survey defaultAnswers={{ direction: 'Inbox triage', signals: ['risks'], timing: 'week' }} />,
    )

    assert.deepEqual(
      inputs(html, 'direction').map((input) => input.attributes.has('checked') || input.attributes.get('value')),
      ['delegation', 'questions', 'Inbox triage'],
    )
    assert.deepEqual(
      inputs(html, 'signals').map((input) => input.attributes.has('checked')),
      [false, true],
    )
    assert.ok(inputs(html, 'timing')[0].attributes.has('checked'))
  })

  it('renders controlled answers over the defaults', async () => {
    let html = await renderToString(<Survey answers={{ timing: 'later' }} defaultAnswers={{ timing: 'week' }} />)

    assert.deepEqual(
      inputs(html, 'timing').map((input) => input.attributes.has('checked')),
      [false, true],
    )
  })

  it('marks each question with its status', async () => {
    let html = await renderToString(<Survey defaultAnswers={{ direction: 'questions', signals: null }} />)

    assert.deepEqual(
      fieldsets(html).map((item) => item.attributes.get('data-status')),
      ['answered', 'skipped', 'unanswered'],
    )
  })

  it('describes each question by its description', async () => {
    let html = await renderToString(<Survey />)
    let [direction] = fieldsets(html)
    let [description] = slot(html, 'questionnaire-description')

    assert.ok(description.attributes.get('id'))
    assert.equal(direction.attributes.get('aria-describedby'), description.attributes.get('id'))
    assert.ok(!fieldsets(html)[1].attributes.has('aria-describedby'))
  })

  it('keeps the errors hidden and empty until a question is invalid', async () => {
    let html = await renderToString(<Survey />)

    for (let error of slot(html, 'questionnaire-error')) {
      assert.ok(error.attributes.has('hidden') && !error.attributes.has('role'))
    }
    assert.ok(!text(html).includes('Choose an answer'))
  })

  it('shows an error your own check found, and describes the question by it', async () => {
    let html = await renderToString(
      <Questionnaire defaultAnswers={{ email: 'no-at-sign' }}>
        <QuestionnaireItem name="email" required invalid>
          <QuestionnaireTitle>Where should we send the invoice?</QuestionnaireTitle>
          <QuestionnaireInput type="email" aria-label="Email" />
          <QuestionnaireError>Enter an email address like name@example.com.</QuestionnaireError>
        </QuestionnaireItem>
      </Questionnaire>,
    )
    let item = attributes(html, 'fieldset')
    let error = attributes(html, 'slot:questionnaire-error')

    assert.equal(error.get('role'), 'alert')
    assert.ok(!error.has('hidden'))
    assert.equal(item.get('aria-describedby'), error.get('id'))
    assert.equal(item.get('aria-invalid'), 'true')
    assert.ok(text(html).includes('Enter an email address like name@example.com.'))
    assert.equal(attributes(html, 'input').get('value'), 'no-at-sign')
  })

  it('leaves a disabled question out of the flow and disables its controls', async () => {
    let html = await renderToString(<Survey items={[items[0], { ...items[1], disabled: true }, items[2]]} />)
    let signals = fieldsets(html)[1]

    assert.ok(text(html).includes('Question 1 of 2'))
    assert.ok(signals.attributes.has('disabled') && signals.attributes.has('data-disabled'))
  })

  it('hands the place of a question its own prop disables to the next one', async () => {
    let html = await renderToString(
      <Questionnaire items={[{ name: 'a' }, { name: 'b' }]}>
        <QuestionnaireItem name="a" disabled>
          <QuestionnaireTitle>A</QuestionnaireTitle>
        </QuestionnaireItem>
        <QuestionnaireItem name="b" required>
          <QuestionnaireTitle>B</QuestionnaireTitle>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnaireSkip />
          <QuestionnaireSubmit />
        </QuestionnaireActions>
      </Questionnaire>,
    )
    let [a, b] = fieldsets(html)

    assert.ok(a.attributes.has('data-disabled') && !a.attributes.has('data-active'))
    assert.ok(b.attributes.has('data-active'))
    // Parts after the questions know their own props: b is required and the last.
    assert.ok(slot(html, 'questionnaire-skip')[0].attributes.has('data-hidden'))
    assert.ok(slot(html, 'questionnaire-submit')[0].attributes.has('data-visible'))
  })

  it('leaves a default answer out once its choice is gone from items', async () => {
    let html = await renderToString(
      <Questionnaire items={[{ name: 'a', choices: [{ value: 'two' }] }]} defaultAnswers={{ a: 'one' }}>
        <QuestionnaireItem name="a">
          <QuestionnaireTitle>A</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="two">Two</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>,
    )

    assert.equal(fieldsets(html)[0].attributes.get('data-status'), 'unanswered')
  })

  it('keeps a saved freeform answer that a child component renders', async () => {
    function OwnInput() {
      return () => <QuestionnaireInput aria-label="Another answer" />
    }
    let html = await renderToString(
      <Questionnaire
        items={[{ name: 'answer', required: true, choices: [{ value: 'fixed' }] }]}
        defaultAnswers={{ answer: 'Saved text' }}
      >
        <QuestionnaireItem name="answer">
          <QuestionnaireTitle>Which answer?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="fixed">Fixed</QuestionnaireChoice>
            <OwnInput />
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>,
    )
    let [radio, input] = inputs(html, 'answer')

    assert.equal(input.attributes.get('value'), 'Saved text')
    assert.equal(fieldsets(html)[0].attributes.get('data-status'), 'answered')
    // A freeform answer may hide in the component, so the radio alone isn't required.
    assert.ok(!radio.attributes.has('required'))
  })

  it('assigns answer keys in the order of items, skipping disabled choices', async () => {
    let html = await renderToString(
      <Questionnaire shortcuts="letters" items={[{ name: 'plan', choices: [{ value: 'pro' }, { value: 'plus' }] }]}>
        <QuestionnaireItem name="plan">
          <QuestionnaireTitle>Plan</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="plus">Plus</QuestionnaireChoice>
            <QuestionnaireChoice value="enterprise" disabled>
              Enterprise
            </QuestionnaireChoice>
            <QuestionnaireChoice value="pro">Pro</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>,
    )

    assert.deepEqual(
      slot(html, 'questionnaire-choice').map((choice) => choice.attributes.get('data-shortcut') ?? null),
      ['B', null, 'A'],
    )
    assert.equal(slot(html, 'questionnaire-choice-shortcut').length, 2)
    assert.ok(tags(html, 'input')[1].attributes.has('disabled'))
  })

  it('assigns number keys in the rendered order without items', async () => {
    let html = await renderToString(
      <Questionnaire shortcuts="numbers">
        <QuestionnaireItem name="plan">
          <QuestionnaireTitle>Plan</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="plus">Plus</QuestionnaireChoice>
            <QuestionnaireChoice value="pro">Pro</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
      </Questionnaire>,
    )

    assert.deepEqual(
      slot(html, 'questionnaire-choice').map((choice) => choice.attributes.get('data-shortcut')),
      ['1', '2'],
    )
    assert.equal(attributes(html, 'form').get('data-shortcuts'), 'numbers')
  })

  it('without items, activates the first question and counts the questions for parts after them', async () => {
    let html = await renderToString(
      <Questionnaire>
        <QuestionnaireProgress />
        <Questions />
        <Navigation />
      </Questionnaire>,
    )
    let progress = attributes(html, 'slot:questionnaire-progress')
    let [next] = slot(html, 'questionnaire-next')

    assert.ok(fieldsets(html)[0].attributes.has('data-active'))
    assert.ok(
      fieldsets(html)
        .slice(1)
        .every((item) => item.attributes.has('data-inactive')),
    )
    // Progress renders before the questions, so the browser fills it in.
    assert.ok(!progress.has('aria-valuenow'))
    assert.ok(next.attributes.has('data-visible'))
  })

  it('gives two questionnaires on one page their own ids', async () => {
    let html = await renderToString(
      <div>
        <Survey />
        <Survey />
      </div>,
    )
    let ids = tags(html)
      .map((tag) => tag.attributes.get('id'))
      .filter(Boolean)

    assert.ok(ids.length >= 2)
    assert.equal(new Set(ids).size, ids.length, ids.join(' '))
  })

  it('keeps ids and their references whole for a name with spaces', async () => {
    let html = await renderToString(
      <Questionnaire>
        <QuestionnaireItem name="project code" required invalid>
          <QuestionnaireTitle>Which project?</QuestionnaireTitle>
          <QuestionnaireDescription>Such as INV-2041.</QuestionnaireDescription>
          <QuestionnaireInput aria-label="Project code" />
          <QuestionnaireError>No project uses that code.</QuestionnaireError>
        </QuestionnaireItem>
      </Questionnaire>,
    )
    let ids = new Set(tags(html).map((tag) => tag.attributes.get('id')))
    let references = attributes(html, 'fieldset').get('aria-describedby')!.split(' ')

    assert.equal(references.length, 2)
    assert.ok(
      references.every((id) => ids.has(id)),
      references.join(' '),
    )
    assert.equal(inputs(html, 'project code').length, 1)
  })

  it('names the parts outside a questionnaire', async () => {
    await assert.rejects(
      renderToString(<QuestionnaireProgress />),
      /QuestionnaireProgress must be used within a Questionnaire/,
    )
    await assert.rejects(
      renderToString(
        <Questionnaire>
          <QuestionnaireChoice value="a">A</QuestionnaireChoice>
        </Questionnaire>,
      ),
      /QuestionnaireChoice must be used within a QuestionnaireItem/,
    )
  })

  it('reads a status from an answer', () => {
    assert.equal(questionnaireAnswerStatus(undefined), 'unanswered')
    assert.equal(questionnaireAnswerStatus('  '), 'unanswered')
    assert.equal(questionnaireAnswerStatus([]), 'unanswered')
    assert.equal(questionnaireAnswerStatus(null), 'skipped')
    assert.equal(questionnaireAnswerStatus('week'), 'answered')
    assert.equal(questionnaireAnswerStatus(['', 'risks']), 'answered')
  })
})
