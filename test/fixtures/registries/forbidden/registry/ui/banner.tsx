import type { Handle } from 'remix/component'

export function Banner(handle: Handle<{ text: string }>) {
  return () => <p>{handle.props.text}</p>
}
