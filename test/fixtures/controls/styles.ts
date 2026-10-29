// Layout for the showcase's own sections: the native form and the
// right-to-left panel. Each example in registry/examples brings its own.
import { css } from 'remix/component'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'sm') => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

/** A control beside its label. */
export const row = css({ display: 'flex', alignItems: 'center', gap: space(2), minWidth: 0 })
export const stack = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) })
export const wrap = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
export const label = css({ ...text('sm'), fontWeight: 500, userSelect: 'none', overflowWrap: 'anywhere' })
export const plainLabel = css({ ...text('sm'), userSelect: 'none', overflowWrap: 'anywhere' })
// Long words may break, so large text still fits a narrow screen.
export const description = css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' })
export const fieldset = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(3),
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
  '& legend': { ...text('sm'), fontWeight: 500, padding: 0, marginBlockEnd: space(3) },
})
export const list = css({ ...text('sm'), margin: 0, paddingInlineStart: space(5), display: 'grid', gap: space(1) })
