#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readLuaFiles } from '../watchfaces/next-prayer/tools/lua-format.mjs'
import { installNotify } from './notify-install.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const notifyPackage = 'com.mc.xiaomi1'
const variants = {
  daily: { directory: 'prayer-daily', artifact: 'prayer-daily.face', id: '122880006', name: 'Halle Prayer Daily' },
  original: { directory: 'next-prayer', artifact: 'next-prayer-lua.face', id: '122880004', name: 'Halle Next Prayer 3' }
}

export const help = `Watchface bauen, per ADB übertragen und mit Notify installieren.

Aufruf:
  ./scripts/deploy-notify.sh [Optionen]
  npm run deploy:notify -- [Optionen]  (im jeweiligen Watchface-Projekt)

Optionen:
  --watchface daily|original  Watchface auswählen (Standard: daily)
  --serial SERIAL            Android-Handy auswählen; sonst genau ein erreichbares Handy
  --no-build                 Vorhandenes Paket verwenden
  --no-install               Nur die Vorschau öffnen, Install nicht automatisch drücken
  --push-only                Nur übertragen, Notify nicht öffnen
  --dry-run                  Plan anzeigen, ohne Build oder Gerätezugriff
  -h, --help                 Hilfe anzeigen

Umgebung:
  ADB                       Pfad zur adb-Datei (Standard: adb im PATH)
  PHONE_SERIAL              Vorgabe für --serial (alternativ ANDROID_SERIAL)

Das Handy muss entsperrt und Notify for Xiaomi mit dem Band verbunden sein.
Install wird einmal automatisch gedrückt; das Skript wartet auf Notify-Abschluss.
`

export function parseArgs(argv) {
  const options = { watchface: 'daily', build: true, install: true, pushOnly: false, dryRun: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--watchface' || arg === '--serial') {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`Wert für ${arg} fehlt.`)
      options[arg === '--watchface' ? 'watchface' : 'serial'] = value
    } else if (arg === '--no-build') options.build = false
    else if (arg === '--no-install') options.install = false
    else if (arg === '--push-only') options.pushOnly = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unbekannte Option: ${arg}. Siehe --help.`)
  }
  if (!variants[options.watchface]) throw new Error('--watchface muss daily oder original sein.')
  return options
}

export function selectDevice(output, serial) {
  const devices = output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^(\S+)\s+(device|offline|unauthorized)(?:\s|$)/)
    return match ? [{ serial: match[1], state: match[2] }] : []
  })
  if (serial) {
    const selected = devices.find(device => device.serial === serial)
    if (!selected) throw new Error(`ADB-Gerät ${serial} ist nicht verbunden.`)
    if (selected.state !== 'device') throw new Error(`ADB-Gerät ${serial}: ${selected.state}. Verbindung und USB-Debugging auf dem Handy prüfen.`)
    return selected.serial
  }
  const ready = devices.filter(device => device.state === 'device' && !device.serial.startsWith('emulator-'))
  if (ready.length > 1) throw new Error('Mehrere Android-Handys erreichbar. Bitte mit --serial eines auswählen.')
  if (ready.length === 0) throw new Error('Kein erreichbares Android-Handy. USB-/WLAN-Debugging verbinden und die ADB-Anfrage auf dem Handy erlauben.')
  return ready[0].serial
}

const shellQuote = value => "'" + String(value).replaceAll("'", "'\\''") + "'"

function runCommand(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd, encoding: options.encoding === null ? null : 'utf8', timeout: options.timeout || 30000,
      input: options.input,
      maxBuffer: 4 * 1024 * 1024,
      stdio: options.inherit ? 'inherit' : [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
    }) || ''
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${command} wurde nicht gefunden. Node.js/npm und Android Platform Tools (adb) müssen installiert sein.`)
    const details = String(error.stderr || error.stdout || error.message).trim().slice(0, 1600)
    throw new Error(`${command} fehlgeschlagen: ${details}`)
  }
}

export async function deployNotify(options, { root = repositoryRoot, run = runCommand, log = console.log, env = process.env } = {}) {
  const variant = variants[options.watchface]
  if (!variant) throw new Error('Unbekanntes Watchface.')
  const project = path.join(root, 'watchfaces', variant.directory)
  const artifact = path.join(project, 'dist', variant.artifact)
  if (options.dryRun) {
    log(`Watchface: ${variant.name} (ID ${variant.id})`)
    log(`Build: ${options.build ? `npm run package in ${project}` : 'übersprungen'}`)
    log(`Paket: ${artifact}`)
    log(`Ziel: Download/XiaomiWatchfaces/${variant.directory}-${variant.id}-<sha256>-<run>.face`)
    log(options.pushOnly ? 'Danach: nur Dateiübertragung.' : options.install ?
      'Danach: Notify öffnen, Install automatisch drücken und auf Abschluss warten.' : 'Danach: nur Notify-Vorschau öffnen.')
    return { dryRun: true }
  }

  if (options.build) {
    log(`Baue und prüfe ${variant.name} …`)
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'package'], { cwd: project, inherit: true, timeout: 120000 })
  }
  let binary
  try { binary = await readFile(artifact) }
  catch { throw new Error(`Paket fehlt: ${artifact}. Ohne --no-build erneut aufrufen.`) }
  if (binary.length < 0x100 || binary.subarray(0, 4).toString('hex') !== '5aa53412') {
    throw new Error('Die Datei ist kein gültiges Lua-Watchface-Paket.')
  }
  if (binary.toString('ascii', 0x28, 0x31) !== variant.id) {
    throw new Error(`Falsche Paket-ID. Für ${options.watchface} wird ${variant.id} erwartet.`)
  }
  const files = readLuaFiles(binary)
  if (!files.some(file => file.name === 'lua/main.lua')) throw new Error('Lua-Einstiegspunkt fehlt.')
  const sha256 = createHash('sha256').update(binary).digest('hex')
  const filename = `${variant.directory}-${variant.id}-${sha256.slice(0, 12)}-${randomUUID().slice(0, 8)}.face`
  const remote = `/sdcard/Download/XiaomiWatchfaces/${filename}`
  const downloads = 'content://media/external_primary/downloads'
  const adb = env.ADB || 'adb'
  const serial = selectDevice(run(adb, ['devices', '-l']), options.serial || env.PHONE_SERIAL || env.ANDROID_SERIAL)
  const command = (args, settings = {}) => run(adb, ['-s', serial, ...args], settings)
  // adb shell joins its arguments before invoking the phone's shell. Quote
  // every remote token; host processes always receive an argument array.
  const shell = args => command(['shell', args.map(shellQuote).join(' ')])
  log(`Handy: ${serial}`)
  if (options.pushOnly) {
    shell(['mkdir', '-p', '/sdcard/Download/XiaomiWatchfaces'])
    command(['push', artifact, remote])
    const transferred = shell(['sha256sum', remote]).trim().split(/\s/)[0]
    if (transferred.toLowerCase() !== sha256) throw new Error('Die übertragene Datei stimmt nicht mit dem lokalen Paket überein.')
    log(`Übertragen und SHA-256 geprüft: ${remote}`)
    return { serial, remote, sha256, opened: false, installed: false }
  }
  const user = shell(['am', 'get-current-user']).trim()
  if (!/^\d+$/.test(user)) throw new Error('Das aktuelle Android-Profil konnte nicht bestimmt werden.')
  const installed = shell(['pm', 'path', '--user', user, notifyPackage])
  if (!/^package:/m.test(installed)) throw new Error('Notify for Xiaomi (com.mc.xiaomi1) ist im aktuellen Android-Profil nicht installiert.')
  const handlers = shell(['cmd', 'package', 'query-activities', '--brief', '--user', user,
    '-a', 'android.intent.action.VIEW', '-d', downloads, '-t', 'application/octet-stream', '-p', notifyPackage])
  const component = handlers.split(/\r?\n/).map(line => line.trim()).find(line =>
    /^com\.mc\.xiaomi1\/[A-Za-z0-9._$]*WatchfaceUploadActivity$/.test(line))
  if (!component) throw new Error('Diese Notify-Version bietet keinen erkannten Watchface-Dateiimport. Mit --push-only übertragen und in Notify manuell importieren.')
  // Create an owned MediaStore download and write through its content URI.
  // ADB cannot grant another provider's Documents URI. This owned URI can be
  // shared with Notify without MANAGE_EXTERNAL_STORAGE or a helper APK.
  shell(['content', 'insert', '--uri', downloads, '--user', user,
    '--bind', `_display_name:s:${filename}`, '--bind', 'mime_type:s:application/octet-stream',
    '--bind', 'relative_path:s:Download/XiaomiWatchfaces/'])
  const row = shell(['content', 'query', '--uri', downloads, '--user', user, '--projection', '_id',
    '--where', `_display_name='${filename}' AND relative_path='Download/XiaomiWatchfaces/'`])
  const ids = [...row.matchAll(/\b_id=(\d+)/g)].map(match => match[1])
  if (ids.length !== 1) throw new Error('Android konnte keine eindeutige Download-Datei anlegen. Mit --push-only übertragen und manuell in Notify importieren.')
  const uri = `${downloads}/${ids[0]}`
  const write = ['content', 'write', '--uri', uri, '--user', user].map(shellQuote).join(' ')
  command(['shell', '-T', write], { input: binary, timeout: 60000 })
  const read = ['content', 'read', '--uri', uri, '--user', user].map(shellQuote).join(' ')
  const transferred = command(['exec-out', read], { encoding: null, timeout: 60000 })
  if (createHash('sha256').update(transferred).digest('hex') !== sha256) {
    throw new Error('Die übertragene Datei stimmt nicht mit dem lokalen Paket überein. Notify wurde nicht geöffnet.')
  }
  log(`Übertragen und SHA-256 geprüft: ${remote}`)

  let result
  try {
    result = shell(['am', 'start', '-W', '--user', user, '-a', 'android.intent.action.VIEW',
      '-d', uri, '-t', 'application/octet-stream', '-n', component, '-f', '0x10000001'])
  } catch (error) {
    throw new Error(`Die geprüfte Datei liegt unter ${remote}. Notify bitte manuell öffnen und importieren.\n${error.message}`)
  }
  if (!/^Status:\s*ok\s*$/m.test(result) || /(?:Error:|Exception|Permission Denial)/i.test(result)) {
    throw new Error(`Die Datei liegt unter ${remote}, aber Notify konnte sie nicht öffnen. Bitte dort manuell importieren.\n${result.trim()}`)
  }
  if (!options.install) {
    log(`Notify-Import für ${variant.name} geöffnet. Die Installation auf dem Band jetzt auf dem Handy bestätigen.`)
    return { serial, remote, uri, sha256, opened: true, installed: false }
  }
  const uiPath = `/data/local/tmp/notify-deploy-${randomUUID()}.xml`
  let installation
  try {
    installation = await installNotify({
      component, log,
      readUI: () => {
        const dumped = shell(['uiautomator', 'dump', uiPath])
        if (!/dumped to:/.test(dumped)) throw new Error('Android konnte keinen frischen UI-Dump erstellen.')
        return command(['exec-out', 'cat', uiPath])
      },
      foreground: () => shell(['dumpsys', 'activity', 'activities']),
      tap: (x, y) => shell(['input', 'tap', String(x), String(y)])
    })
  } finally {
    try { shell(['rm', '-f', uiPath]) } catch { /* Preserve the original result if cleanup fails. */ }
  }
  let screenshot
  try {
    const png = command(['exec-out', 'screencap', '-p'], { encoding: null })
    if (Buffer.isBuffer(png) && png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      const directory = path.join(project, 'build/notify')
      await mkdir(directory, { recursive: true })
      screenshot = path.join(directory, 'install-completed.png')
      await writeFile(screenshot, png)
    }
  } catch { /* A screenshot failure must not change a confirmed installation result. */ }
  log(`Notify bestätigt die Installation von ${variant.name}: ${installation.status}`)
  return { serial, remote, uri, sha256, opened: true, installed: true, screenshot }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) console.log(help)
    else await deployNotify(options)
  } catch (error) {
    console.error(`Fehler: ${error.message}`)
    process.exitCode = 1
  }
}
