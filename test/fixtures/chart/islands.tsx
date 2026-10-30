// Client entries only this fixture needs: a chart with long translated
// labels, and a chart whose data a form-free button replaces, empties and
// fills with zeros, so the browser tests see one chart take new props.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '#remixcn/ui/chart.tsx'
import type { ChartConfig } from '#remixcn/ui/chart.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3), width: '100%' })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2) })

const germanConfig = {
  monat: { label: 'Monat' },
  arbeitsplatz: { label: 'Arbeitsplatzrechner und Notebooks', color: 'var(--chart-2)' },
  mobil: { label: 'Mobilgeräte, Tablets und Fernsehgeräte mit Internetzugang', color: 'var(--chart-4)' },
} satisfies ChartConfig

const germanMonths = [
  { monat: 'Januar', arbeitsplatz: 18600, mobil: 8000 },
  { monat: 'Februar', arbeitsplatz: 30500, mobil: 20000 },
  { monat: 'März', arbeitsplatz: 23700, mobil: 12000 },
  { monat: 'April', arbeitsplatz: 7300, mobil: 19000 },
  { monat: 'Mai', arbeitsplatz: 20900, mobil: 13000 },
  { monat: 'Juni', arbeitsplatz: 21400, mobil: 14000 },
  { monat: 'Juli', arbeitsplatz: 25100, mobil: 17000 },
  { monat: 'August', arbeitsplatz: 19800, mobil: 21000 },
  { monat: 'September', arbeitsplatz: 27600, mobil: 16000 },
  { monat: 'Oktober', arbeitsplatz: 22300, mobil: 18000 },
  { monat: 'November', arbeitsplatz: 26400, mobil: 15000 },
  { monat: 'Dezember', arbeitsplatz: 31200, mobil: 23000 },
]

/** German labels far longer than the English ones, in the legend, the tooltip, the axes and the table. */
export const LongLabels = clientEntry(import.meta.url, function LongLabels() {
  return () => (
    <ChartContainer config={germanConfig} locale="de-CH">
      <BarChart
        data={germanMonths}
        aria-label="Besuche nach Gerät und Monat"
        summary="Besuche nach Gerät für jeden Monat des Jahres."
        keyboardHint="Die Pfeiltasten lesen jeden Wert vor."
        emptyLabel="Keine Daten"
      >
        <CartesianGrid vertical={false} />
        <YAxis tickLine={false} axisLine={false} />
        <XAxis dataKey="monat" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="arbeitsplatz" radius={2} />
        <Bar dataKey="mobil" radius={2} />
      </BarChart>
    </ChartContainer>
  )
})

const lineConfig = {
  day: { label: 'Day' },
  paid: { label: 'Paid', color: 'var(--chart-2)' },
  open: { label: 'Open', color: 'var(--chart-4)' },
} satisfies ChartConfig

const datasets = {
  week: [
    { day: 'Mon', paid: 12, open: 4 },
    { day: 'Tue', paid: 18, open: 6 },
    { day: 'Wed', paid: 9, open: 11 },
    { day: 'Thu', paid: 21, open: 3 },
    { day: 'Fri', paid: 15, open: 8 },
  ],
  negative: [
    { day: 'Mon', paid: -12, open: 4 },
    { day: 'Tue', paid: 18, open: -6 },
    { day: 'Wed', paid: -9, open: 11 },
  ],
  zero: [
    { day: 'Mon', paid: 0, open: 0 },
    { day: 'Tue', paid: 0, open: 0 },
  ],
  gap: [
    { day: 'Mon', paid: 12, open: 4 },
    { day: 'Tue', paid: null, open: 6 },
    { day: 'Wed', paid: 9, open: null },
    { day: 'Thu', paid: 21, open: 3 },
  ],
  empty: [],
} satisfies Record<string, { day: string; paid: number | null; open: number | null }[]>

type Dataset = keyof typeof datasets

/** One line chart whose data the buttons replace, so it takes new props in place. */
export const ChangingData = clientEntry(import.meta.url, function ChangingData(handle: Handle) {
  let shown: Dataset = 'week'

  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        {(Object.keys(datasets) as Dataset[]).map((name) => (
          <Button
            key={name}
            variant={shown === name ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={shown === name ? 'true' : 'false'}
            data-dataset={name}
            mix={on('click', () => {
              shown = name
              void handle.update()
            })}
          >
            {name}
          </Button>
        ))}
      </div>
      <ChartContainer config={lineConfig}>
        <LineChart data={datasets[shown]} margin={{ left: 12, right: 12 }} aria-label="Invoices per day">
          <CartesianGrid vertical={false} />
          <YAxis tickLine={false} axisLine={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line dataKey="paid" strokeWidth={2} />
          <Line dataKey="open" strokeWidth={2} />
        </LineChart>
      </ChartContainer>
    </div>
  )
})
