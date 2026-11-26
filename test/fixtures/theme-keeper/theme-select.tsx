// The theme control from docs/components/theme-keeper.md, so the tests run
// the usage the docs show. It imports the helper through the workspace's
// alias, where the docs import the installed file by its relative path.
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { pageTheme, themeChoices } from '#remixcn/lib/theme-keeper.ts'
import type { ThemeKeeper } from '#remixcn/lib/theme-keeper.ts'

export const ThemeSelect = clientEntry(import.meta.url, function ThemeSelect(handle: Handle) {
  let keeper: ThemeKeeper | undefined
  handle.queueTask(() => {
    keeper = pageTheme()
    keeper.addEventListener('change', () => void handle.update(), { signal: handle.signal })
    void handle.update()
  })

  return () => (
    <select
      aria-label="Theme"
      disabled={keeper === undefined}
      mix={on('change', (event) => {
        let choice = themeChoices.find((option) => option === (event.target as HTMLSelectElement).value)
        if (choice) keeper?.set(choice)
      })}
    >
      {themeChoices.map((choice) => (
        <option key={choice} value={choice} selected={keeper?.choice === choice}>
          {choice}
        </option>
      ))}
    </select>
  )
})
