import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { packLuaFace, readLuaFiles } from '../../next-prayer/tools/lua-format.mjs'
import { berlinTimestamp } from '../../../examples/prayer-times/tools/calendar.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const toolkit = path.resolve(process.env.BAND10_TOOLKIT || path.join(root, '../../../band10-toolkit'))
const toolkitRequire = createRequire(path.join(toolkit, 'package.json'))
const { register } = await import(pathToFileURL(toolkitRequire.resolve('tsx/esm/api')))
register()
const { encodeImageFile, inspectWatchFace, decodeImageBlock } = await import(pathToFileURL(path.join(toolkit, 'parser/index.ts')))
const sharp = toolkitRequire('sharp')
const calendarPath = path.join(root, '../../examples/prayer-times/src/common/calendar.json')
const calendarBytes = await readFile(calendarPath)
const calendar = JSON.parse(calendarBytes)
const settings = JSON.parse(await readFile(path.join(root, '../next-prayer/settings.json')))
assert.ok(Number.isInteger(settings.iqamaFallbackMinutes) && settings.iqamaFallbackMinutes >= 1 && settings.iqamaFallbackMinutes <= 180)
const fallbackSeconds = settings.iqamaFallbackMinutes * 60
assert.equal(calendar.timezone, 'Europe/Berlin')
assert.ok(calendar.days.length > 0)
const names = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const berlinClock = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const quote = value => '"' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r') + '"'
let previousEnd
const days = calendar.days.map(day => {
  assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/)
  if (previousEnd !== undefined) assert.equal(day.start, previousEnd, 'Kalenderlücke')
  previousEnd = day.end
  assert.equal(day.prayers.length, 5)
  const seconds = ms => {
    assert.ok(Number.isSafeInteger(ms) && ms % 1000 === 0)
    assert.ok(ms / 1000 > 0 && ms / 1000 <= 0x7fffffff, 'Zeit außerhalb des getesteten 32-bit-Bereichs')
    return ms / 1000
  }
  const sunrise = seconds(berlinTimestamp(day.date, day.sunrise))
  const prayers = day.prayers.map((prayer, index) => {
    assert.equal(prayer.id, names[index].toLowerCase())
    assert.match(prayer.time, /^\d{2}:\d{2}$/)
    assert.ok(prayer.at >= day.start && prayer.at < day.end)
    if (index) assert.ok(prayer.at > day.prayers[index - 1].at)
    const at = seconds(prayer.at)
    const iqamaAt = prayer.iqamaAt == null ? at + fallbackSeconds : seconds(prayer.iqamaAt)
    const nextAt = index === 0 ? sunrise : index < 4 ? seconds(day.prayers[index + 1].at) : seconds(day.end)
    assert.ok(iqamaAt > at && iqamaAt < nextAt, `Iqama außerhalb des Gebetsfensters: ${day.date} ${prayer.id}`)
    return `{id=${quote(prayer.id)},label=${quote(names[index])},time=${quote(prayer.time)},at=${at},iqamaAt=${iqamaAt},iqamaTime=${quote(berlinClock.format(new Date(iqamaAt * 1000)))},iqamaSource=${quote(prayer.iqamaAt == null ? 'fallback' : 'mawaqit')}}`
  })
  assert.ok(sunrise > seconds(day.prayers[0].at) && sunrise < seconds(day.prayers[1].at))
  return `{date=${quote(day.date)},start=${seconds(day.start)},finish=${seconds(day.end)},sunrise=${quote(day.sunrise)},sunriseAt=${sunrise},prayers={${prayers.join(',')}}}`
})
const validThrough = calendar.days.at(-1).date.slice(8) + '.' + calendar.days.at(-1).date.slice(5, 7) + '.'
const luaCalendar = `-- Generated from the existing MAWAQIT snapshot; Unix seconds.\nreturn {validThrough=${quote(validThrough)},iqamaFallbackMinutes=${settings.iqamaFallbackMinutes},days={\n${days.join(',\n')}\n}}\n`
const build = path.join(root, 'build/lua')
const app = path.join(build, 'app/lua')
const dist = path.join(root, 'dist')
await mkdir(app, { recursive: true })
await mkdir(path.join(build, 'images'), { recursive: true })
await mkdir(dist, { recursive: true })
await writeFile(path.join(app, 'prayer_calendar.lua'), luaCalendar)
await copyFile(path.join(root, 'lua/main.lua'), path.join(app, 'main.lua'))
await copyFile(path.join(root, '../next-prayer/lua/prayer_logic.lua'), path.join(app, 'prayer_logic.lua'))
const lua = process.env.LUA || 'lua'
for (const name of ['main.lua', 'prayer_logic.lua', 'prayer_calendar.lua']) {
  execFileSync(lua, ['-e', 'assert(loadfile(os.getenv("PRAYER_LUA_SOURCE")))'], {
    encoding: 'utf8', env: { ...process.env, PRAYER_LUA_SOURCE: path.join(app, name) }
  })
}

// Render the actual Lua entry point with a host-side LVGL adapter to make the
// packaged preview match the real layout. This is not a firmware emulator.
const previewAt = Math.floor(Date.now() / 1000)
const ui = JSON.parse(execFileSync(lua, [path.join(root, 'tests/render.lua'), app, String(previewAt), '90', '10', '1', '3024', '72'], {
  encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Berlin' }
}))
const xml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="212" height="520"><rect width="212" height="520" rx="106" fill="#000"/>${ui.map(label => `<text x="${label.x + label.w / 2}" y="${label.y + label.size}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${label.size}" fill="#${label.color.toString(16).padStart(6, '0')}">${xml(label.text)}</text>`).join('')}</svg>`
const previewPath = path.join(build, 'images/preview.png')
await sharp(Buffer.from(svg)).png().toFile(previewPath)
const preview = (await encodeImageFile(previewPath, true)).block
const files = await Promise.all(['main.lua', 'prayer_calendar.lua', 'prayer_logic.lua'].map(async name => ({ name: `lua/${name}`, data: await readFile(path.join(app, name)) })))
const binary = packLuaFace({ id: '122880006', name: 'Halle Prayer Daily', files, preview })
const inspection = inspectWatchFace(binary)
assert.deepEqual(inspection.warnings, [])
assert.equal(inspection.faces[0].elements[0].referenceType, 5)
assert.equal(inspection.faces[0].elements[0].referenceIndex, 0)
assert.deepEqual(readLuaFiles(binary), files)
const decoded = decodeImageBlock(binary, inspection.header.previewOffset)
assert.deepEqual([decoded.width, decoded.height], [212, 520])
await writeFile(path.join(dist, 'prayer-daily.face'), binary)
await writeFile(path.join(dist, 'prayer-daily.bin'), binary)
await writeFile(path.join(build, 'prayer-daily.fprj'), `<?xml version="1.0" encoding="utf-8"?>\n<FaceProject DeviceType="466"><Screen Title="Halle Prayer Daily" Bitmap="preview.png"><Widget Shape="34" Name="app_lua%2Fmain.lua" X="0" Y="0" Width="212" Height="520" Alpha="0" Visible_Src="0" /></Screen></FaceProject>\n`)
const report = {
  target: 'Xiaomi Smart Band 10 / o66', userFirmware: '3.2.8', installer: 'Notify',
  hardwareTested: false, runtime: 'Lua + LVGL + dataman',
  metricTopics: ['systemStatusBattery', 'weatherCurrentTemperature', 'weatherCurrentWeather', 'healthStepCount', 'healthHeartRate'],
  bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
  sources: files.map(file => file.name), parserWarnings: inspection.warnings,
  calendar: { from: calendar.days[0].date, through: calendar.days.at(-1).date, fetchedAt: calendar.fetchedAt, source: calendar.sourceUrl, sha256: createHash('sha256').update(calendarBytes).digest('hex') },
  previewAt: new Date(previewAt * 1000).toISOString(),
  previewMetrics: { battery: 90, temperatureC: 10, weatherCode: 1, steps: 3024, heartRate: 72, simulated: true },
  note: 'Lua source is embedded and executed by the watchface runtime; hardware compatibility must be confirmed on the band.'
}
await writeFile(path.join(build, 'report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`Lua watchface: ${binary.length} bytes; 3 embedded Lua files; no parser warnings.`)
console.log(path.join(dist, 'prayer-daily.face'))
