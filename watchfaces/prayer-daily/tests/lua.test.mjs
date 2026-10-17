import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { packLuaFace, readLuaFiles } from '../../next-prayer/tools/lua-format.mjs'
import { berlinTimestamp } from '../../../examples/prayer-times/tools/calendar.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const calendar = JSON.parse(await readFile(new URL('../../../examples/prayer-times/src/common/calendar.json', import.meta.url)))
const settings = JSON.parse(await readFile(path.join(root, '../next-prayer/settings.json')))
const binary = await readFile(path.join(root, 'dist/prayer-daily.face'))
const files = readLuaFiles(binary)

function events(day) {
  return day.prayers.flatMap((prayer, index) => {
    const items = [
      { phase: 'adhan', at: prayer.at, next: prayer.id },
      { phase: 'iqama', at: prayer.iqamaAt ?? prayer.at + settings.iqamaFallbackMinutes * 60000,
        next: prayer.id, source: prayer.iqamaAt == null ? 'fallback' : 'mawaqit', adhanAt: prayer.at }
    ]
    if (index === 0) items.push({ phase: 'sunrise', at: berlinTimestamp(day.date, day.sunrise), next: null })
    return items
  }).sort((a, b) => a.at - b.at)
}

function expected(now) {
  const index = calendar.days.findIndex(day => now >= day.start && now < day.end)
  if (index < 0) return { status: 'unavailable', phase: null, next: null, countdown: '--:--:--' }
  const day = calendar.days[index]
  const target = events(day).find(item => now < item.at ||
    (item.phase !== 'adhan' && now < item.at + 60000))
  if (target) {
    const due = now >= target.at
    const seconds = Math.max(0, Math.ceil((target.at - now) / 1000))
    return { status: due ? 'due' : 'upcoming', phase: target.phase, next: target.next,
      tomorrow: false, source: target.source ?? null,
      adhanNow: target.phase === 'iqama' && !due && now < target.adhanAt + 60000,
      countdown: due ? '00:00:00' : [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map(value => String(value).padStart(2, '0')).join(':') }
  }
  const tomorrow = calendar.days[index + 1]
  if (tomorrow && tomorrow.start === day.end) {
    const seconds = Math.ceil((tomorrow.prayers[0].at - now) / 1000)
    return { status: 'upcoming', phase: 'adhan', next: 'fajr', tomorrow: true,
      countdown: [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map(value => String(value).padStart(2, '0')).join(':') }
  }
  return { status: 'missing-next-day', phase: null, next: null, countdown: '--:--:--' }
}

test('embedded Lua code matches sources and package rejects corrupt resources', async () => {
  assert.deepEqual(files.map(f => f.name), ['lua/main.lua', 'lua/prayer_calendar.lua', 'lua/prayer_logic.lua'])
  assert.deepEqual(files[0].data, await readFile(path.join(root, 'lua/main.lua')))
  assert.deepEqual(files[2].data, await readFile(path.join(root, '../next-prayer/lua/prayer_logic.lua')))
  assert.deepEqual(binary, await readFile(path.join(root, 'dist/prayer-daily.bin')))
  const previewOffset = binary.readUInt32LE(0x20)
  assert.deepEqual(packLuaFace({ id: '122880006', name: 'Halle Prayer Daily', files, preview: binary.subarray(previewOffset) }), binary)
  const bad = Buffer.from(binary)
  bad.writeUInt32LE(binary.length, 0x118)
  assert.throws(() => readLuaFiles(bad))
  assert.throws(() => packLuaFace({ id: '122880004', name: 'Test', files: [{ name: '../main.lua', data: 'hi' }], entry: '../main.lua', preview: binary.subarray(previewOffset) }))
})

test('packaged Lua follows Adhan, Iqama and sunrise across boundaries and firmware callbacks', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'prayer-lua-test-'))
  try {
    for (const file of files) await writeFile(path.join(temp, path.basename(file.name)), file.data)
    const timestamps = new Set()
    for (const day of calendar.days) {
      for (const ms of [day.start - 1000, day.start, day.end - 1000, day.end]) timestamps.add(ms)
      for (const item of events(day)) {
        for (const delta of [-3600000, -1000, 0, 1000, 59000, 60000, 61000]) timestamps.add(item.at + delta)
      }
    }
    // Both occurrences of 02:30 during the Berlin autumn clock change.
    for (const date of ['2026-10-25T00:30:00Z', '2026-10-25T00:59:59Z', '2026-10-25T01:00:00Z', '2026-10-25T01:30:00Z']) timestamps.add(Date.parse(date))
    const vectors = [...timestamps].sort((a, b) => a - b).map(now => {
      const state = expected(now)
      return `{at=${now / 1000},status="${state.status}",phase=${state.phase ? '"' + state.phase + '"' : 'nil'},countdown="${state.countdown}",next=${state.next ? '"' + state.next + '"' : 'nil'},tomorrow=${Boolean(state.tomorrow)},source=${state.source ? '"' + state.source + '"' : 'nil'},adhanNow=${Boolean(state.adhanNow)}}`
    })
    await writeFile(path.join(temp, 'vectors.lua'), 'return {' + vectors.join(',\n') + '}')
    const output = execFileSync(process.env.LUA || 'lua', [path.join(root, 'tests/runtime.lua'), temp], {
      encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Berlin' }
    })
    assert.match(output, /Lifecycle and live countdown passed/)
    console.log(output.trim())
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
