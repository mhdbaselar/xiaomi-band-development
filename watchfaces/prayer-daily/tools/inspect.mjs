import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const toolkit = path.resolve(process.env.BAND10_TOOLKIT || path.join(root, '../../../band10-toolkit'))
const requireToolkit = createRequire(path.join(toolkit, 'package.json'))
const loader = requireToolkit.resolve('tsx')
const child = spawn(process.execPath, ['--import', loader, path.join(toolkit, 'cli/index.ts'),
  'inspect', path.join(root, 'dist/prayer-daily.face'), ...process.argv.slice(2)], {
  stdio: 'inherit', cwd: toolkit
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
