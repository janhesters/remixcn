import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  compareDates,
  dateParts,
  dayOfWeek,
  daysBetween,
  daysInMonth,
  endOfMonth,
  endOfWeek,
  formatCivilDate,
  formatCivilDateRange,
  isCivilDate,
  isLeapYear,
  maxCivilDate,
  minCivilDate,
  parseCivilDate,
  startOfMonth,
  startOfWeek,
  toCivilDate,
  todayIn,
  toUTCDate,
  weekNumber,
  weekStartOf,
} from '#remixcn/lib/civil-date.ts'

// Runs `run` with the host in another time zone, as a server or a visitor far from UTC would be.
function inTimeZone<T>(timeZone: string, run: () => T): T {
  let previous = process.env.TZ
  process.env.TZ = timeZone
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

const hostZones = ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/St_Johns', 'Asia/Kathmandu']

describe('civil dates', () => {
  it('knows the Gregorian leap years', () => {
    assert.equal(isLeapYear(2024), true)
    assert.equal(isLeapYear(2026), false)
    assert.equal(isLeapYear(1900), false)
    assert.equal(isLeapYear(2000), true)
    assert.equal(isLeapYear(2100), false)
    assert.equal(daysInMonth(2024, 2), 29)
    assert.equal(daysInMonth(2026, 2), 28)
    assert.equal(daysInMonth(1900, 2), 28)
    assert.equal(daysInMonth(2000, 2), 29)
    assert.deepEqual(
      Array.from({ length: 12 }, (_, index) => daysInMonth(2026, index + 1)),
      [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    )
  })

  it('accepts only real days written as YYYY-MM-DD', () => {
    for (let value of ['2026-10-30', '2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) {
      assert.equal(isCivilDate(value), true, value)
    }
    for (let value of [
      '2026-02-29',
      '1900-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-10-00',
      '0000-01-01',
      '2026-1-5',
      '26-10-30',
      '20261030',
      '2026/10/30',
      '2026-10-30T00:00',
      ' 2026-10-30',
      '+002026-10-30',
      '２０２６-10-30',
      '',
      undefined,
      20261030,
    ]) {
      assert.equal(isCivilDate(value), false, String(value))
    }
  })

  it('parses typed ISO dates without guessing other formats', () => {
    assert.equal(parseCivilDate('2026-10-30'), '2026-10-30')
    assert.equal(parseCivilDate('  2024-02-29 \n'), '2024-02-29')
    // Numeric dates that mean different days in different locales are refused.
    assert.equal(parseCivilDate('03/04/2026'), undefined)
    assert.equal(parseCivilDate('04.03.2026'), undefined)
    assert.equal(parseCivilDate('March 4, 2026'), undefined)
    assert.equal(parseCivilDate('2026-02-30'), undefined)
    assert.equal(parseCivilDate(''), undefined)
  })

  it('builds and splits dates by their parts', () => {
    assert.equal(toCivilDate({ year: 2026, month: 3, day: 4 }), '2026-03-04')
    assert.equal(toCivilDate({ year: 33, month: 12, day: 31 }), '0033-12-31')
    assert.deepEqual(dateParts('2026-03-04'), { year: 2026, month: 3, day: 4 })
    assert.throws(() => toCivilDate({ year: 2026, month: 2, day: 29 }), RangeError)
    assert.throws(() => toCivilDate({ year: 10000, month: 1, day: 1 }), RangeError)
    assert.throws(() => toCivilDate({ year: 2026, month: 1.5, day: 1 }), RangeError)
  })

  it('adds days across month, year and leap-day boundaries', () => {
    assert.equal(addDays('2026-10-30', 1), '2026-10-31')
    assert.equal(addDays('2026-10-31', 1), '2026-11-01')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(addDays('2027-01-01', -1), '2026-12-31')
    assert.equal(addDays('2024-02-28', 1), '2024-02-29')
    assert.equal(addDays('2024-02-29', 1), '2024-03-01')
    assert.equal(addDays('2026-02-28', 1), '2026-03-01')
    assert.equal(addDays('2100-02-28', 1), '2100-03-01')
    assert.equal(addDays('2000-02-28', 1), '2000-02-29')
    assert.equal(addDays('2026-01-01', 365), '2027-01-01')
    assert.equal(addDays('2024-01-01', 366), '2025-01-01')
    assert.equal(addDays('2026-10-30', -7), '2026-10-23')
  })

  it('adds months and years, keeping the day where it fits', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
    assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
    assert.equal(addMonths('2026-03-31', -1), '2026-02-28')
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
    assert.equal(addMonths('2026-01-15', -1), '2025-12-15')
    assert.equal(addMonths('2026-10-30', 24), '2028-10-30')
    assert.equal(addMonths('2026-10-30', -22), '2024-12-30')
    assert.equal(addYears('2024-02-29', 1), '2025-02-28')
    assert.equal(addYears('2024-02-29', 4), '2028-02-29')
    assert.equal(addYears('2026-10-30', -1), '2025-10-30')
  })

  it('stays inside the years it can write', () => {
    assert.equal(addDays('9999-12-31', 1), maxCivilDate)
    assert.equal(addDays('0001-01-01', -1), minCivilDate)
    assert.equal(addMonths('9999-12-15', 1), maxCivilDate)
    assert.equal(addYears('0001-06-15', -1), minCivilDate)
  })

  it('compares and counts days', () => {
    assert.equal(compareDates('2026-10-30', '2026-10-31'), -1)
    assert.equal(compareDates('2026-10-30', '2026-10-30'), 0)
    assert.equal(compareDates('2027-01-01', '2026-12-31'), 1)
    assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3)
    assert.equal(daysBetween('2024-03-01', '2024-02-28'), -2)
    assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365)
    assert.equal(clampDate('2026-10-30', '2026-11-01', '2026-12-31'), '2026-11-01')
    assert.equal(clampDate('2027-01-02', '2026-11-01', '2026-12-31'), '2026-12-31')
    assert.equal(clampDate('2026-11-15', undefined, '2026-12-31'), '2026-11-15')
  })

  it('finds the weekday, the month and the week of a day', () => {
    assert.equal(dayOfWeek('1970-01-01'), 4)
    assert.equal(dayOfWeek('2026-10-30'), 5)
    assert.equal(dayOfWeek('2000-01-01'), 6)
    assert.equal(dayOfWeek('0001-01-01'), 1)
    assert.equal(startOfMonth('2026-10-30'), '2026-10-01')
    assert.equal(endOfMonth('2026-02-10'), '2026-02-28')
    assert.equal(endOfMonth('2024-02-10'), '2024-02-29')
    assert.equal(startOfWeek('2026-10-30', 0), '2026-10-25')
    assert.equal(startOfWeek('2026-10-30', 1), '2026-10-26')
    assert.equal(startOfWeek('2026-10-30', 6), '2026-10-24')
    assert.equal(startOfWeek('2026-10-24', 6), '2026-10-24')
    assert.equal(endOfWeek('2026-10-30', 1), '2026-11-01')
    assert.equal(startOfWeek('2027-01-01', 1), '2026-12-28')
  })

  it('numbers ISO weeks, which start on Monday and belong to the year of their Thursday', () => {
    let iso = { weekStartsOn: 1, firstWeekContainsDate: 4 } as const
    assert.equal(weekNumber('2026-10-30', iso), 44)
    assert.equal(weekNumber('2026-01-01', iso), 1)
    assert.equal(weekNumber('2027-01-01', iso), 53)
    assert.equal(weekNumber('2021-01-03', iso), 53)
    assert.equal(weekNumber('2021-01-04', iso), 1)
    assert.equal(weekNumber('2024-12-30', iso), 1)
    assert.equal(weekNumber('2020-12-31', iso), 53)
  })

  it('numbers weeks that start on Sunday with January 1 in week one', () => {
    let us = { weekStartsOn: 0, firstWeekContainsDate: 1 } as const
    assert.equal(weekNumber('2026-01-01', us), 1)
    assert.equal(weekNumber('2026-01-04', us), 2)
    assert.equal(weekNumber('2026-12-26', us), 52)
    // The week of 2027-01-01 already counts as the next year's first.
    assert.equal(weekNumber('2026-12-27', us), 1)
    assert.equal(weekNumber('2026-12-31', us), 1)
    assert.equal(weekNumber('2026-10-30', us), 44)
  })

  it('reads the first day of the week from the locale', () => {
    assert.equal(weekStartOf('en-US'), 0)
    assert.equal(weekStartOf('de-CH'), 1)
    assert.equal(weekStartOf('en-GB'), 1)
    assert.equal(weekStartOf('fa-IR'), 6)
    assert.equal(weekStartOf('not a locale'), 1)
  })

  it('formats a day in the locale without shifting it by the host time zone', () => {
    for (let zone of hostZones) {
      inTimeZone(zone, () => {
        assert.equal(formatCivilDate('2026-01-01', 'en-US', { dateStyle: 'long' }), 'January 1, 2026', zone)
        assert.equal(formatCivilDate('2026-12-31', 'de-CH', { dateStyle: 'long' }), '31. Dezember 2026', zone)
        assert.equal(formatCivilDate('0033-04-03', 'en-US', { year: 'numeric' }), '33', zone)
        assert.equal(toUTCDate('2026-01-01').toISOString(), '2026-01-01T00:00:00.000Z', zone)
      })
    }
  })

  it('formats in the Gregorian calendar the grid shows, whatever the locale prefers', () => {
    assert.equal(formatCivilDate('2026-10-30', 'th-TH', { year: 'numeric', numberingSystem: 'latn' }), '2026')
    assert.equal(formatCivilDate('2026-10-30', 'fa-IR', { month: 'numeric', numberingSystem: 'latn' }), '10')
  })

  it('formats a range of days', () => {
    assert.equal(
      formatCivilDateRange('2026-01-20', '2026-02-09', 'en-US', { dateStyle: 'medium' }),
      // Plain spaces, where Node's ICU writes thin ones and browsers don't.
      'Jan 20 – Feb 9, 2026',
    )
    assert.equal(formatCivilDateRange('2026-01-20', '2026-01-20', 'en-US', { dateStyle: 'medium' }), 'Jan 20, 2026')
  })

  it('tells today in a time zone, not in the host one', () => {
    // 2026-10-30 23:30 in UTC: already Saturday in Kiritimati (UTC+14), still Friday in Pago Pago (UTC-11).
    let now = new Date('2026-10-30T23:30:00Z')
    for (let zone of hostZones) {
      inTimeZone(zone, () => {
        assert.equal(todayIn('UTC', now), '2026-10-30', zone)
        assert.equal(todayIn('Pacific/Kiritimati', now), '2026-10-31', zone)
        assert.equal(todayIn('Pacific/Pago_Pago', now), '2026-10-30', zone)
      })
    }
    assert.equal(
      inTimeZone('Pacific/Kiritimati', () => todayIn(undefined, now)),
      '2026-10-31',
    )
  })
})
