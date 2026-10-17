import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileCalendar, berlinTimestamp, extractConfig } from '../tools/calendar.mjs'

// Load exactly the device's ES module, without making the Vela build ESM-only.
const source = await readFile(new URL('../src/common/prayers.js', import.meta.url), 'utf8')
const { getPrayerState, formatCountdown } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const calendar = JSON.parse(await readFile(new URL('../src/common/calendar.json', import.meta.url), 'utf8'))
const today = calendar.days[0]
const tomorrow = calendar.days[1]

test('before Fajr, between prayers, and during the prayer minute', () => {
  const fajr = today.prayers[0]
  assert.equal(getPrayerState(calendar, today.start).next.id, 'fajr')
  assert.equal(getPrayerState(calendar, fajr.at - 1).countdown, '00:00:01')
  assert.equal(getPrayerState(calendar, fajr.at).status, 'due')
  assert.equal(getPrayerState(calendar, fajr.at + 59999).next.id, 'fajr')
  assert.equal(getPrayerState(calendar, fajr.at + 60000).next.id, 'dhuhr')
})

test('sunrise is excluded from next-prayer selection', () => {
  const sunrise = berlinTimestamp(today.date, today.sunrise)
  assert.equal(getPrayerState(calendar, sunrise - 60000).next.id, 'dhuhr')
})

test('after Isha uses tomorrow’s actual Fajr; midnight changes the day', () => {
  const state = getPrayerState(calendar, today.prayers[4].at + 60000)
  assert.equal(getPrayerState(calendar, today.end - 1).day.date, today.date)
  if (tomorrow) {
    assert.equal(state.tomorrow, true)
    assert.equal(state.next.at, tomorrow.prayers[0].at)
    assert.equal(getPrayerState(calendar, today.end).day.date, tomorrow.date)
  } else {
    assert.equal(state.status, 'missing-next-day')
    assert.equal(getPrayerState(calendar, today.end).status, 'unavailable')
  }
})

test('reopening after sleep or a clock change recomputes from wall-clock time', () => {
  getPrayerState(calendar, today.start)
  assert.equal(getPrayerState(calendar, today.prayers[3].at - 1000).next.id, 'maghrib')
  assert.equal(getPrayerState(calendar, today.prayers[1].at - 1000).next.id, 'dhuhr')
  if (tomorrow) assert.equal(getPrayerState(calendar, tomorrow.start).day.date, tomorrow.date)
})

test('missing and expired days never produce invented prayer times', () => {
  const limited = { days: [today] }
  assert.equal(getPrayerState(limited, today.prayers[4].at + 60000).status, 'missing-next-day')
  assert.equal(getPrayerState(limited, today.end).status, 'unavailable')
  assert.equal(getPrayerState(limited, today.start - 1).next, null)
  assert.equal(getPrayerState({ days: [] }, today.start).countdown, '--:--:--')
  assert.equal(getPrayerState({ days: [today, { ...today, start: today.end + 86400000 }] }, today.prayers[4].at + 60000).next, null)
})

test('countdown rounds up, has no negative values, and supports over 24 hours', () => {
  assert.equal(formatCountdown(3661000), '01:01:01')
  assert.equal(formatCountdown(1), '00:00:01')
  assert.equal(formatCountdown(-500), '00:00:00')
  assert.equal(formatCountdown(25 * 3600000), '25:00:00')
  assert.equal(formatCountdown(NaN), '--:--:--')
})

test('Berlin DST uses the actual offsets, independently of the host timezone', () => {
  assert.equal(berlinTimestamp('2026-10-24', '06:21'), Date.parse('2026-10-24T04:21:00Z'))
  assert.equal(berlinTimestamp('2026-10-25', '05:22'), Date.parse('2026-10-25T04:22:00Z'))
  assert.equal(berlinTimestamp('2026-10-26', '00:00') - berlinTimestamp('2026-10-25', '00:00'), 25 * 3600000)
  assert.equal(berlinTimestamp('2026-03-30', '00:00') - berlinTimestamp('2026-03-29', '00:00'), 23 * 3600000)
  assert.throws(() => berlinTimestamp('2026-03-29', '02:30'), /Ortszeit/)
  assert.throws(() => berlinTimestamp('2026-10-25', '02:30'), /Ortszeit/)
  assert.throws(() => berlinTimestamp('2026-02-30', '05:00'), /Datum/)
  assert.throws(() => berlinTimestamp('2026-01-01', '25:00'), /Uhrzeit/)
})

function fixture() {
  const times = ['06:08', '07:37', '12:58', '15:43', '18:18', '19:48']
  return {
    timezone: 'Europe/Berlin', times: [times[0], ...times.slice(2)], shuruq: times[1],
    calendar: Array.from({ length: 12 }, () => Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [String(index + 1), [...times]])
    )), jumua: '13:30', jumua2: '15:00'
  }
}

test('importer validates calendar data and daily display agreement', () => {
  const config = fixture()
  const options = { fetchedAt: '2026-10-16T12:00:00Z' }
  const compiled = compileCalendar(config, options)
  assert.equal(compiled.days.length, 77)
  assert.equal(compiled.days.at(-1).date, '2026-12-31')
  assert.equal(compiled.days[0].prayers.length, 5)
  assert.equal(compiled.days[0].prayers[1].time, '12:58')
  config.calendar[9]['17'][0] = 'bad'
  assert.throws(() => compileCalendar(config, options), /Uhrzeit/)
  const stale = fixture()
  stale.times[0] = '06:00'
  assert.throws(() => compileCalendar(stale, options), /stimmen nicht/)
  const unordered = fixture()
  unordered.calendar[9]['17'][2] = '05:00'
  assert.throws(() => compileCalendar(unordered, options), /chronologisch/)
  assert.throws(() => compileCalendar({ ...fixture(), jumuaAsDuhr: true }, options), /Anpassungen/)
})

test('importer uses every consecutive published day and rejects gaps', () => {
  const config = fixture()
  config.calendar[9] = Object.fromEntries(['16', '17', '18'].map(day => [day, config.calendar[9][day]]))
  config.calendar[10] = {}
  config.calendar[11] = {}
  const options = { fetchedAt: '2026-10-16T12:00:00Z' }
  assert.deepEqual(compileCalendar(config, options).days.map(day => day.date), [
    '2026-10-16', '2026-10-17', '2026-10-18'
  ])
  delete config.calendar[9]['17']
  assert.throws(() => compileCalendar(config, options), /Fehlende Gebetszeiten: 2026-10-17/)
})

test('importer keeps published Iqama times and offsets without inventing missing ones', () => {
  const config = fixture()
  config.iqamaCalendar = Array.from({ length: 12 }, () => ({}))
  config.iqamaCalendar[9]['16'] = ['+10', '13:15', null, '+5', '+10']
  const options = { fetchedAt: '2026-10-16T12:00:00Z' }
  const compiled = compileCalendar(config, options)
  const prayers = compiled.days[0].prayers
  assert.equal(prayers[0].iqamaAt, prayers[0].at + 600000)
  assert.equal(prayers[1].iqamaAt, berlinTimestamp('2026-10-16', '13:15'))
  assert.equal(prayers[2].iqamaAt, undefined)
  assert.equal(prayers[3].iqamaAt, prayers[3].at + 300000)
  assert.equal(compiled.days[1].prayers[0].iqamaAt, undefined)
  config.iqamaCalendar[9]['16'][0] = '+999'
  assert.throws(() => compileCalendar(config, options), /Iqama-Abstand/)
  config.iqamaCalendar[9]['16'][0] = '05:00'
  assert.throws(() => compileCalendar(config, options), /nicht nach dem Adhan/)
})

test('calendar stops at year boundary instead of inventing next year’s times', () => {
  const compiled = compileCalendar(fixture(), { fetchedAt: '2026-12-31T12:00:00Z' })
  assert.equal(compiled.days.length, 1)
  assert.equal(compiled.days[0].date, '2026-12-31')
})

test('HTML extraction handles quoted braces and rejects executable JavaScript', () => {
  const config = { name: 'A } " B', calendar: [] }
  assert.deepEqual(extractConfig(`<script>const confData = ${JSON.stringify(config)}; run();</script>`), config)
  assert.throws(() => extractConfig('const confData = { value: execute() };'), SyntaxError)
  assert.throws(() => extractConfig('<html>Maintenance</html>'), /Keine confData/)
  assert.throws(() => extractConfig('let confData = {'), /Unvollständige/)
})
