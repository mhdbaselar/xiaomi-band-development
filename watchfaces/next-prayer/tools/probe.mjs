import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const toolkit = process.argv[2]
const root = new URL('../', import.meta.url)
const { layoutSchema } = await import(pathToFileURL(path.join(toolkit, 'core/schema.ts')).href)
const { DATA_SOURCES } = await import(pathToFileURL(path.join(toolkit, 'core/dataSources.ts')).href)
const layout = JSON.parse(await readFile(new URL('layout.json', root), 'utf8'))
assert.equal(layoutSchema.safeParse(layout).success, true, 'Die Ausgangsdatei muss gültig sein.')
const checks = []
function rejected(name, change) {
  const candidate = structuredClone(layout)
  change(candidate)
  const result = layoutSchema.safeParse(candidate)
  assert.equal(result.success, false, `${name}: Das Toolkit hat sich geändert; Machbarkeit neu prüfen.`)
  checks.push({ name, accepted: false, issues: result.error.issues })
}
rejected('Eigene Datenquelle nextPrayer', candidate => { candidate.normal.widgets[1].source = 'nextPrayer' })
rejected('Eigene Datenquelle prayerCountdown', candidate => { candidate.normal.widgets[1].source = 'prayerCountdown' })
rejected('Berechnung am Zahlenwidget', candidate => { candidate.normal.widgets[1].expression = 'nextPrayerAt - now' })
rejected('JavaScript-Widget', candidate => { candidate.normal.widgets.push({ id: 'prayer-script', type: 'script', asset: 'prayers.js', x: 0, y: 0, z: 2 }) })
rejected('Skriptdatei im Layout', candidate => { candidate.script = 'prayers.js' })

const app = new URL('../../../examples/prayer-times/src/common/', import.meta.url)
const source = await readFile(new URL('prayers.js', app), 'utf8')
const { getPrayerState } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const calendar = JSON.parse(await readFile(new URL('calendar.json', app), 'utf8'))
const day = calendar.days[0]
const nextDay = calendar.days[1]
assert.ok(day && nextDay, 'Der Test braucht zwei Kalendertage.')
const at = day.prayers[1].at - 120000
const before = getPrayerState(calendar, at)
const later = getPrayerState(calendar, at + 1000)
assert.equal(before.countdown, '00:02:00')
assert.equal(later.countdown, '00:01:59')
assert.equal(getPrayerState(calendar, day.prayers[1].at).status, 'due')
assert.equal(getPrayerState(calendar, day.prayers[1].at + 60000).next.id, 'asr')
assert.equal(getPrayerState(calendar, day.prayers[4].at + 60000).next.at, nextDay.prayers[0].at)
assert.equal(getPrayerState(calendar, calendar.days.at(-1).end).status, 'unavailable')

const revision = execFileSync('git', ['-C', toolkit, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const { inspectWatchFace, decodeImageBlock, decodeImageListBlock } = await import(pathToFileURL(path.join(toolkit, 'parser/index.ts')).href)
const binary = new Uint8Array(await readFile(new URL('dist/next-prayer-demo.face', root)))
const inspection = inspectWatchFace(binary)
assert.equal(inspection.header.magic, '5aa53412')
assert.equal(inspection.header.id, '122880001')
assert.equal(inspection.header.faceCount, 1)
assert.deepEqual(inspection.warnings, [])
const bindings = inspection.faces.flatMap(face => face.elements.map(element => element.dataSourceName).filter(Boolean))
assert.deepEqual(bindings, ['hour', 'minute'])
const preview = decodeImageBlock(binary, inspection.header.previewOffset)
assert.deepEqual([preview.width, preview.height], [212, 520])
let decodedImages = 1
for (const face of inspection.faces) {
  for (const definition of face.definitions) {
    if (definition.type === 2) {
      const image = decodeImageBlock(binary, definition.offset)
      assert.equal(image.rgba.length, image.width * image.height * 4)
      decodedImages++
    } else if (definition.type === 3) {
      const images = decodeImageListBlock(binary, definition.offset)
      assert.equal(images.length, 11)
      for (const image of images) assert.equal(image.rgba.length, image.width * image.height * 4)
      decodedImages += images.length
    }
  }
}
assert.deepEqual(new Uint8Array(await readFile(new URL('dist/next-prayer-demo.bin', root))), binary)
const report = {
  toolkitRevision: revision,
  result: 'Native clock supported; custom next-prayer logic is not supported by this toolkit revision.',
  deviceTested: false,
  sources: Object.keys(DATA_SOURCES),
  schemaProbes: checks,
  computerOnlyPrayerChecks: ['countdown advances', 'prayer begins', 'next prayer selected', 'tomorrow Fajr selected', 'expired data rejected'],
  binaryChecks: { bytes: binary.length, bindings, decodedImages, warnings: inspection.warnings, faceAndBinIdentical: true },
  packagedPrayerContent: 'Static SVG snapshot. No prayer code or calendar is executed on the band.'
}
await mkdir(new URL('build/', root), { recursive: true })
await writeFile(new URL('build/feasibility.json', root), JSON.stringify(report, null, 2) + '\n')
console.log(`Toolkit ${revision}: ${checks.length} unsupported authoring features confirmed.`)
console.log('Prayer logic on computer: countdown, prayer transition, tomorrow and expiry passed.')
console.log(`Native package: ${binary.length} bytes, ${decodedImages} decoded images, only hour/minute bindings, no parser warnings.`)
console.log('Result: dynamic next-prayer watchface NOT supported by this toolkit revision.')
console.log('Report: build/feasibility.json')
