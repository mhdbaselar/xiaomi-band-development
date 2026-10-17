import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { packLuaFace, readLuaFiles } from '../tools/lua-format.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const calendar = JSON.parse(await readFile(new URL('../../../examples/prayer-times/src/common/calendar.json', import.meta.url)))
const source = await readFile(new URL('../../../examples/prayer-times/src/common/prayers.js', import.meta.url), 'utf8')
const { getPrayerState } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const binary = await readFile(path.join(root, 'dist/next-prayer-lua.face'))
const files = readLuaFiles(binary)

test('embedded Lua code matches sources and package rejects corrupt resources', async () => {
  assert.deepEqual(files.map(f => f.name), ['lua/main.lua', 'lua/prayer_calendar.lua', 'lua/prayer_logic.lua'])
  assert.deepEqual(files[0].data, await readFile(path.join(root, 'lua/main.lua')))
  assert.deepEqual(files[2].data, await readFile(path.join(root, 'lua/prayer_logic.lua')))
  assert.deepEqual(binary, await readFile(path.join(root, 'dist/next-prayer-lua.bin')))
  const previewOffset = binary.readUInt32LE(0x20)
  assert.deepEqual(packLuaFace({ id: '122880002', name: 'Halle Next Prayer', files, preview: binary.subarray(previewOffset) }), binary)
  const bad = Buffer.from(binary)
  bad.writeUInt32LE(binary.length, 0x118)
  assert.throws(() => readLuaFiles(bad))
  assert.throws(() => packLuaFace({ id: '122880002', name: 'Test', files: [{ name: '../main.lua', data: 'hi' }], entry: '../main.lua', preview: binary.subarray(previewOffset) }))
})

test('packaged Lua matches JS at calendar boundaries and updates through firmware callbacks', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'prayer-lua-test-'))
  try {
    for (const file of files) await writeFile(path.join(temp, path.basename(file.name)), file.data)
    const timestamps = new Set()
    for (const day of calendar.days) {
      for (const ms of [day.start - 1000, day.start, day.end - 1000, day.end]) timestamps.add(ms)
      for (const prayer of day.prayers) {
        for (const delta of [-3600000, -1000, 0, 1000, 59000, 60000, 61000]) timestamps.add(prayer.at + delta)
      }
    }
    // Both occurrences of 02:30 during the Berlin autumn clock change.
    for (const date of ['2026-10-25T00:30:00Z', '2026-10-25T00:59:59Z', '2026-10-25T01:00:00Z', '2026-10-25T01:30:00Z']) timestamps.add(Date.parse(date))
    const vectors = [...timestamps].sort((a, b) => a - b).map(now => {
      const state = getPrayerState(calendar, now)
      return `{at=${now / 1000},status="${state.status}",countdown="${state.countdown}",next=${state.next ? '"' + state.next.id + '"' : 'nil'},tomorrow=${Boolean(state.tomorrow)}}`
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
