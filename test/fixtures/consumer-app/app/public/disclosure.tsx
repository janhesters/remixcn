import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

export const Disclosure = clientEntry(
  import.meta.url,
  function Disclosure(handle: Handle<{ id: string; summary: string; details: string }>) {
    let open = false

    return () => (
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={handle.props.id}
          mix={[
            on('click', () => {
              open = !open
              handle.update()
            }),
          ]}
        >
          {handle.props.summary}
        </button>
        <p id={handle.props.id} hidden={!open}>
          {handle.props.details}
        </p>
      </div>
    )
  },
)
