// Keeps a component example on its page. The examples' forms and links point
// at an app's routes, which a static site doesn't have, and Remix's runtime
// would navigate the whole page in place, resetting every other example. The
// guard catches every submit and link click in its own preview, says where
// it would have gone, and leaves the other examples and the page alone. The
// server renders the example inert, so nothing in it acts before the guard
// listens; the guard lets go of it once it does.
import { clientEntry, css, ref } from 'remix/component'
import type { Handle } from 'remix/component'

const statusStyles = css({
  margin: 0,
  minHeight: 'var(--text-sm--line-height)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'anywhere',
  // Empty, it takes no room but stays a live region, so its first message is announced.
  '&:empty': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    minHeight: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
  },
})

/** Describes what a form sends: its fields as name=value, files by their name. */
function describeSubmission(data: FormData): string {
  let fields = [...data].map(([name, value]) => `${name}=${typeof value === 'string' ? value : value.name}`)
  return fields.length === 0 ? 'no fields' : fields.join(', ')
}

export const ExampleGuard = clientEntry(import.meta.url, function ExampleGuard(handle: Handle) {
  let message = ''

  let say = (next: string) => {
    // Clears first, so the same message twice is announced twice.
    message = ''
    void handle.update().then(() => {
      message = next
      void handle.update()
    })
  }

  let guard = ref((node, signal) => {
    let preview = node.closest('[data-docs-preview]')
    if (!preview) return

    preview.addEventListener(
      'submit',
      (event) => {
        let form = event.target as HTMLFormElement
        event.preventDefault()
        let submitter = (event as SubmitEvent).submitter
        say(
          `The example's form stayed on this page. It would send ${describeSubmission(new FormData(form, submitter))}.`,
        )
      },
      { capture: true, signal },
    )

    preview.addEventListener(
      'click',
      (event) => {
        let link = event.target instanceof Element ? event.target.closest('a[href]') : null
        if (!(link instanceof HTMLAnchorElement)) return
        event.preventDefault()
        say(`The example's link stayed on this page. It goes to ${link.getAttribute('href')}.`)
      },
      { capture: true, signal },
    )

    // An in-place navigation to a page with the same example brings the
    // server's inert example back while this guard keeps running, so it lets
    // go again whenever that happens.
    let release = () => {
      preview.removeAttribute('data-pending')
      preview.querySelector(':scope > [data-docs-canvas]')?.removeAttribute('inert')
    }
    release()
    let observer = new MutationObserver(release)
    observer.observe(preview, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['inert', 'data-pending'],
    })
    signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  })

  return () => (
    <p role="status" data-docs-example-status="" mix={[statusStyles, guard]}>
      {message}
    </p>
  )
})
