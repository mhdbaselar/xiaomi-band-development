import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
const toolkit = path.resolve(process.env.BAND10_TOOLKIT || path.join(project, '../../../band10-toolkit'))
const command = process.argv[2]
if (!['check', 'validate', 'build', 'package', 'inspect', 'inspect-lua', 'preview'].includes(command)) {
  throw new Error('Befehl: check | validate | build | package | inspect | preview')
}
const requireToolkit = createRequire(path.join(toolkit, 'package.json'))
let loader
try {
  loader = requireToolkit.resolve('tsx')
} catch {
  throw new Error(`Toolkit fehlt oder ist nicht installiert: ${toolkit}. Dort npm install ausführen oder BAND10_TOOLKIT setzen.`)
}
const args = command === 'check'
  ? [fileURLToPath(new URL('probe.mjs', import.meta.url)), toolkit]
  : [path.join(toolkit, 'cli/index.ts'), command === 'inspect-lua' ? 'inspect' : command,
    command === 'inspect-lua' ? path.join(project, 'dist/next-prayer-lua.face') : command === 'inspect' ? path.join(project, 'dist/next-prayer-demo.face') : project,
    ...process.argv.slice(3)]
const child = spawn(process.execPath, ['--import', loader, ...args], { stdio: 'inherit', cwd: toolkit })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
