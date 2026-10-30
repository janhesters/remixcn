// The seed component page: the template the other component pages follow,
// with examples that run, their source, and how to install the component.
import {
  ButtonAsLink,
  ButtonForm,
  ButtonLoading,
  ButtonVariantsAndSizes,
} from '../../../../registry/examples/button-example.tsx'
import type { DocsPage } from '../page.ts'
import { A, Code, Example, List, P, Section, Snippet } from '../ui.tsx'

const file = 'registry/examples/button-example.tsx'

const sections = {
  installation: { id: 'installation', title: 'Installation' },
  usage: { id: 'usage', title: 'Usage' },
  examples: { id: 'examples', title: 'Examples' },
  reference: { id: 'reference', title: 'Reference' },
}

const usage = `import { Button, buttonVariants } from '#remixcn/ui/button.tsx'

<Button variant="outline">Archive</Button>
<Button type="submit" name="intent" value="send">Send reminder</Button>
<a href="/invoices" mix={buttonVariants({ variant: 'outline' })}>View invoices</a>`

export const page: DocsPage = {
  path: 'docs/components/button/',
  title: 'Button',
  summary: 'A native button with six variants and eight sizes, and the same look for links.',
  group: 'Components',
  keywords: ['link', 'submit', 'form', 'loading', 'variant', 'buttonVariants'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.installation}>
        <P>Add Button and the theme it reads to your Remix 3 app. You own the copied source from then on.</P>
        <Snippet title="Terminal" code="npx remixcn add button" label="the install command" />
        <P>
          Or copy <Code>registry/ui/button.tsx</Code>, <Code>registry/lib/styles.ts</Code> and{' '}
          <Code>registry/lib/theme.css</Code> into your app by hand.
        </P>
      </Section>
      <Section {...sections.usage}>
        <Snippet title="Usage" code={usage} label="the usage example" />
        <P>
          A button's <Code>type</Code> is <Code>button</Code> unless you say <Code>submit</Code> or <Code>reset</Code>,
          so it never sends a form by accident. Give a link a button's look with <Code>buttonVariants()</Code>: it stays
          a link and works without JavaScript.
        </P>
      </Section>
      <Section {...sections.examples}>
        <P>
          Each example runs on its own. The examples' forms and links stay on this page and say what they would send.
        </P>
        <Example
          id="example-variants"
          title="Variants and sizes"
          description="Every variant at every text size."
          file={file}
          name="ButtonVariantsAndSizes"
        >
          <ButtonVariantsAndSizes />
        </Example>
        <Example
          id="example-link"
          title="As a link"
          description="Links that look like buttons keep their link role and navigate natively."
          file={file}
          name="ButtonAsLink"
        >
          <ButtonAsLink />
        </Example>
        <Example
          id="example-form"
          title="In a form"
          description="Submit, reset and action buttons in one form, each doing what its type says."
          file={file}
          name="ButtonForm"
        >
          <ButtonForm action="/invoices/reminders" draftAction="/invoices/drafts" />
        </Example>
        <Example
          id="example-loading"
          title="Loading"
          description="A button that keeps focus while it saves, and a status that says when it's done."
          file={file}
          name="ButtonLoading"
        >
          <ButtonLoading />
        </Example>
      </Section>
      <Section {...sections.reference}>
        <List>
          <li>
            Props, parts and the source and behavior map:{' '}
            <A href="https://github.com/janhesters/remixcn/blob/main/docs/components/button.md">
              docs/components/button.md
            </A>
            .
          </li>
          <li>
            Adapted from shadcn/ui's{' '}
            <A href="https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/button.tsx">
              Button
            </A>{' '}
            and the behavior of <A href="https://base-ui.com/react/components/button.md">Base UI's Button</A>.
          </li>
        </List>
      </Section>
    </>
  ),
}
