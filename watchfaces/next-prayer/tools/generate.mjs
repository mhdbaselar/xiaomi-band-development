import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const app = new URL('../../../examples/prayer-times/src/common/', import.meta.url)
const calendar = JSON.parse(await readFile(new URL('calendar.json', app), 'utf8'))
const source = await readFile(new URL('prayers.js', app), 'utf8')
const { getPrayerState } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
// Deliberate fixed fixture. This computation runs on the computer, never on the band.
const at = '2026-10-16T10:08:00+02:00'
const state = getPrayerState(calendar, Date.parse(at))
if (state.status !== 'upcoming') throw new Error('Der Kalender enthält den festen Demozeitpunkt nicht mehr.')

const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
async function svg(name, width, height, body) {
  const url = new URL(`assets/${name}.svg`, root)
  await mkdir(new URL('./', url), { recursive: true })
  await writeFile(url, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#000000"/>${body}</svg>\n`)
}
function text(value, x, y, size, color = '#eeeae2') {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size}" fill="${color}">${xml(value)}</text>`
}

// Simple font-independent clock glyphs; source SVGs remain editable.
const segments = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abfgcd']
const bars = {
  a: [5, 0, 19, 4], b: [24, 5, 4, 18], c: [24, 28, 4, 18],
  d: [5, 47, 19, 4], e: [0, 28, 4, 18], f: [0, 5, 4, 18], g: [5, 24, 19, 4]
}
for (const [index, active] of [...segments, 'g'].entries()) {
  await svg(`digits/${index === 10 ? 'minus' : index}`, 28, 51,
    [...active].map(key => {
      const [x, y, width, height] = bars[key]
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#eeeae2"/>`
    }).join(''))
}
await svg('location', 152, 22, text('HALLE · SAALE', 76, 17, 12, '#a0afa8'))
await svg('colon', 6, 51, '<circle cx="3" cy="17" r="2" fill="#eeeae2"/><circle cx="3" cy="35" r="2" fill="#eeeae2"/>')
await svg('prayer', 172, 176,
  '<rect x="54" y="0" width="64" height="2" rx="1" fill="#85c9ad"/>' +
  text('NÄCHSTES GEBET', 86, 34, 12, '#a0afa8') +
  text(state.next.label, 86, 75, 30, '#85c9ad') +
  text(state.next.time, 86, 116, 32) +
  text(`Beispiel: in ${state.countdown}`, 86, 157, 13, '#a0afa8'))
await svg('demo', 164, 74,
  text('DEMO · FESTE GEBETSDATEN', 82, 16, 10, '#e9ba73') +
  text('16.10.2026 · 10:08 Uhr', 82, 38, 12, '#a0afa8') +
  text('Countdown läuft nicht', 82, 61, 12, '#a0afa8'))

const image = (id, x, y) => ({ id, type: 'image', asset: `assets/${id}.svg`, x, y, z: 1 })
const number = (source, x) => ({ id: source, type: 'number', source, digitSet: 'clock', digits: 2, align: 'left', spacing: 3, leadingZero: true, x, y: 101, z: 1 })
const layout = {
  formatVersion: 1,
  canvas: { width: 212, height: 520, clip: 'pill' },
  assets: { digitSets: { clock: { digits: Array.from({ length: 10 }, (_, i) => `assets/digits/${i}.svg`), minus: 'assets/digits/minus.svg' } } },
  normal: { background: '#000000', widgets: [image('location', 30, 57), number('hour', 37), image('colon', 103, 101), number('minute', 116), image('prayer', 20, 183), image('demo', 24, 382)] }
}
await writeFile(new URL('layout.json', root), JSON.stringify(layout, null, 2) + '\n')
await writeFile(new URL('snapshot.json', root), JSON.stringify({
  kind: 'static-demo-only', at, timezone: calendar.timezone,
  sourceUrl: calendar.sourceUrl, fetchedAt: calendar.fetchedAt,
  prayer: state.next, countdown: state.countdown
}, null, 2) + '\n')
console.log(`Demo erzeugt: ${state.next.label} ${state.next.time}, statisch bei ${at}.`)
