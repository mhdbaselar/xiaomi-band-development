import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = path.join(root, 'build/lua/app/lua')
await readFile(path.join(app, 'main.lua')) // npm run build first
const execute = promisify(execFile)
const html = await readFile(new URL('preview.html', import.meta.url))
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    response.setHeader('Cache-Control', 'no-store')
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return response.end(html)
    }
    if (url.pathname === '/state') {
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
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Lua-Vorschau fehlgeschlagen. Bitte Terminal prüfen.')
  }
})
const port = Number(process.env.PRAYER_PREVIEW_PORT || 5175)
server.listen(port, '127.0.0.1', () => console.log(`Lua-Countdown: http://127.0.0.1:${port}/ (nur lokal)`))
