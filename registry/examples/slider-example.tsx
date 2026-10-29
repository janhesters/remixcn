// RemixCN Slider examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import { onSliderChange, Slider, SliderRoot } from '#remixcn/ui/slider.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const smallText = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }

const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3), width: '100%' })
const headingRowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space(2),
})
const labelStyles = css({ ...smallText, fontWeight: 500 })
const valueStyles = css({ ...smallText, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' })
const verticalRowStyles = css({ display: 'flex', alignItems: 'center', gap: space(6), height: space(40) })
const formStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4), margin: 0 })
const fieldsetStyles = css({ display: 'grid', gap: space(3), minWidth: 0, margin: 0, padding: 0, border: 0 })
const legendStyles = css({ ...smallText, padding: 0, fontWeight: 500 })
const actionsStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2) })
// The form draws plain native buttons, so the examples need only Slider.
const buttonStyles = css(
  mergeStyles(
    {
      ...smallText,
      minHeight: space(9),
      paddingInline: space(3),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--background)',
      fontWeight: 500,
      cursor: 'pointer',
      '&:hover': { backgroundColor: 'var(--muted)' },
    },
    transition('background-color'),
  ),
)

/** One thumb from 0 to 100. */
export function SliderBasic() {
  return () => <Slider aria-label="Volume" defaultValue={50} max={100} step={1} />
}

/** Two thumbs, each with its own name. */
export function SliderRange() {
  return () => (
    <Slider
      aria-label="Price range"
      thumbLabels={['Minimum price', 'Maximum price']}
      defaultValue={[25, 50]}
      max={100}
      step={5}
    />
  )
}

/** Three thumbs that keep a step apart. */
export function SliderMultiple() {
  return () => (
    <Slider
      aria-label="Delivery windows"
      thumbLabels={['First delivery', 'Second delivery', 'Last delivery']}
      defaultValue={[10, 20, 70]}
      max={100}
      step={10}
      minStepsBetweenValues={1}
    />
  )
}

/** Two vertical sliders. Their row sets the height. */
export function SliderVertical() {
  return () => (
    <div mix={verticalRowStyles}>
      <Slider aria-label="Bass" defaultValue={[50]} max={100} step={1} orientation="vertical" />
      <Slider aria-label="Treble" defaultValue={[25]} max={100} step={1} orientation="vertical" />
    </div>
  )
}

/** A disabled slider leaves its form value out. */
export function SliderDisabled() {
  return () => <Slider aria-label="Volume" defaultValue={[50]} max={100} step={1} disabled />
}

/** Right-to-left text puts min on the right. The arrows follow the direction. */
export function SliderRtl() {
  return () => (
    <div dir="rtl" lang="ar">
      <Slider aria-label="مستوى الصوت" defaultValue={[75]} max={100} step={1} />
    </div>
  )
}

/**
 * A controlled range. The client entry keeps the value and renders each
 * change, so the text beside the label follows the thumbs.
 */
export const SliderControlled = clientEntry(import.meta.url, function SliderControlled(handle: Handle) {
  let value = [0.3, 0.7]

  return () => (
    <div mix={stackStyles}>
      <div mix={headingRowStyles}>
        <span id="slider-demo-temperature" mix={labelStyles}>
          Temperature
        </span>
        <span mix={valueStyles} data-value="temperature">
          {value.join(', ')}
        </span>
      </div>
      <SliderRoot
        aria-labelledby="slider-demo-temperature"
        thumbLabels={['Lowest temperature', 'Highest temperature']}
        value={value}
        min={0}
        max={1}
        step={0.1}
        mix={onSliderChange((event) => {
          value = [...event.values]
          handle.update()
        })}
      />
    </div>
  )
})

/**
 * A price filter in a form. Each thumb submits its own value under one name,
 * from the lowest to the highest, and Reset returns both thumbs to their
 * default values. Screen readers hear the values in dollars.
 */
export const SliderPriceForm = clientEntry(
  import.meta.url,
  function SliderPriceForm(handle: Handle<{ action: string; defaultValue?: number[] }>) {
    let range = handle.props.defaultValue ?? [200, 800]

    return () => (
      <form
        action={handle.props.action}
        method="get"
        mix={[
          formStyles,
          onSliderChange((event) => {
            range = [...event.values]
            handle.update()
          }),
        ]}
      >
        <fieldset mix={fieldsetStyles}>
          <legend mix={legendStyles}>Price range</legend>
          <p mix={valueStyles} id="price-range-summary" data-value="price">
            Set your budget range (${range[0]} – ${range[1]}).
          </p>
          <Slider
            name="price"
            aria-describedby="price-range-summary"
            thumbLabels={['Minimum price', 'Maximum price']}
            defaultValue={handle.props.defaultValue ?? [200, 800]}
            max={1000}
            step={10}
            minStepsBetweenValues={5}
            format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            locale="en-US"
          />
        </fieldset>
        <div mix={actionsStyles}>
          <button type="submit" mix={buttonStyles}>
            Apply
          </button>
          <button type="reset" mix={buttonStyles}>
            Reset
          </button>
        </div>
      </form>
    )
  },
)
