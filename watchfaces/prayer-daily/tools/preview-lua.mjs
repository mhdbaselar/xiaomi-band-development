import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { watchFile } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = path.join(root, 'build/lua/app/lua')
const execute = promisify(execFile)
let building = false
let buildAgain = false
let buildError = null
let debounce

async function rebuild() {
  if (building) {
    buildAgain = true
    return
  }
  building = true
  do {
    buildAgain = false
    console.log('Watchface wird neu gebaut …')
    try {
      await execute(process.execPath, [path.join(root, 'tools/build-lua.mjs')], {
        env: process.env, timeout: 30000, maxBuffer: 1024 * 1024
      })
      buildError = null
      console.log('Vorschau aktualisiert. Warte auf Änderungen …')
    } catch (error) {
      buildError = 'Build fehlgeschlagen. Bitte Fehler im Terminal prüfen und die Datei erneut speichern.'
      console.error(error.stderr?.trim() || error.message)
    }
  } while (buildAgain)
  building = false
}

const sources = [
  'lua/main.lua',
  '../next-prayer/lua/prayer_logic.lua',
  '../next-prayer/settings.json',
  '../../examples/prayer-times/src/common/calendar.json',
  '../../examples/prayer-times/tools/calendar.mjs',
  'tools/build-lua.mjs',
  'tests/host.lua',
  'tests/render.lua'
]
for (const source of sources) {
  // Poll the file path so atomic editor saves (replace/rename) keep working.
  watchFile(path.resolve(root, source), { interval: 200 }, (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs && current.size === previous.size && current.ino === previous.ino) return
    clearTimeout(debounce)
    debounce = setTimeout(() => { void rebuild() }, 150)
  })
}
await rebuild()

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    response.setHeader('Cache-Control', 'no-store')
    if (url.pathname === '/') {
      const html = await readFile(new URL('preview.html', import.meta.url))
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return response.end(html)
    }
    if (url.pathname === '/state') {
      if (building || buildError) {
        response.writeHead(503, { 'Content-Type': 'application/json' })
        return response.end(JSON.stringify({ error: building ? 'Vorschau wird aktualisiert …' : buildError }))
      }
      const now = Math.floor(Date.now() / 1000)
      const bounds = { battery: [0, 100], temperature: [-99, 99], weather: [0, 301], steps: [0, 99999], pulse: [20, 300] }
      const metrics = Object.entries(bounds).map(([key, [minimum, maximum]]) => {
        const raw = url.searchParams.get(key)
        const value = raw === null || raw === '' ? NaN : Number(raw)
        return Number.isFinite(value) && value >= minimum && value <= maximum ? String(value) : ''
      })
      const { stdout } = await execute(process.env.LUA || 'lua', [path.join(root, 'tests/render.lua'), app, String(now), ...metrics], {
        env: { ...process.env, TZ: 'Europe/Berlin' }, timeout: 3000, maxBuffer: 32 * 1024
      })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      return response.end(JSON.stringify({ at: now, labels: JSON.parse(stdout) }))
    }
    response.writeHead(404)
    response.end('Not found')
  } catch (error) {
    console.error(error.message)
    response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Lua-Vorschau fehlgeschlagen. Bitte Terminal prüfen.' }))
  }
})
const port = Number(process.env.PRAYER_PREVIEW_PORT || 5175)
server.listen(port, '127.0.0.1', () => console.log(`Lua-Countdown: http://127.0.0.1:${port}/ (nur lokal)`))
