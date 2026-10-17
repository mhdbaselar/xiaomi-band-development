import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deployNotify, parseArgs, selectDevice } from '../deploy-notify.mjs'
import { packLuaFace } from '../../watchfaces/next-prayer/tools/lua-format.mjs'
import { notifyUI, foreground } from './fixtures/notify-ui.mjs'

async function fixture(id = '122880006') {
  const root = await mkdtemp(path.join(tmpdir(), 'notify deploy '))
  const directory = path.join(root, 'watchfaces/prayer-daily/dist')
  await mkdir(directory, { recursive: true })
  const binary = packLuaFace({ id, name: 'Test Daily', preview: Buffer.alloc(4),
    files: [{ name: 'lua/main.lua', data: Buffer.from('return {}') }] })
  const artifact = path.join(directory, 'prayer-daily.face')
  await writeFile(artifact, binary)
  return { root, artifact, binary, sha256: createHash('sha256').update(binary).digest('hex') }
}

function phone({ sha256, binary, handlers = true } = {}) {
  const calls = []
  let uiReads = 0
  const run = (command, args, options) => {
    calls.push({ command, args, options })
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5554 device\nphone-one device model:Test\n'
    const remote = args.at(-1)
    if (remote.includes("'am' 'get-current-user'")) return '0\n'
    if (remote.includes("'pm' 'path'")) return 'package:/data/app/notify/base.apk\n'
    if (remote.includes("'query-activities'")) return handlers ?
      'com.mc.xiaomi1/.ui.updateFirmware.UpdateFirmwareActivity\ncom.mc.xiaomi1/.ui.watchfaces.WatchfaceUploadActivity\n' : 'No activities found\n'
    if (remote.includes("'sha256sum'")) return `${sha256}  watchface.face\n`
    if (remote.includes("'content' 'query'")) return 'Row: 0 _id=987\n'
    if (remote.includes("'content' 'read'")) return binary
    if (remote.includes("'uiautomator' 'dump'")) return 'UI hierchary dumped to: /data/local/tmp/notify.xml\n'
    if (args[2] === 'exec-out' && args[3] === 'cat') return uiReads++ === 0 ? notifyUI() :
      notifyUI({ status: 'Update completed', enabled: false, progress: 100 })
    if (remote.includes("'dumpsys' 'activity' 'activities'")) return foreground
    if (remote.includes("'am' 'start'")) return 'Status: ok\nActivity: com.mc.xiaomi1/.ui.watchfaces.WatchfaceUploadActivity\n'
    return ''
  }
  return { run, calls }
}

test('builds, targets one physical phone, checks transferred bytes and pins the watchface importer', async () => {
  const data = await fixture()
  const device = phone(data)
  const messages = []
  try {
    const result = await deployNotify(parseArgs([]), { ...data, ...device, env: {}, log: message => messages.push(message) })
    assert.equal(result.opened, true)
    assert.equal(result.installed, true)
    assert.equal(device.calls[0].command, process.platform === 'win32' ? 'npm.cmd' : 'npm')
    assert.equal(device.calls[0].options.cwd, path.join(data.root, 'watchfaces/prayer-daily'))
    const write = device.calls.find(call => call.args[3] === '-T')
    assert.equal(write.args[1], 'phone-one')
    assert.deepEqual(write.options.input, data.binary, 'Watchface bytes must be passed through stdin without shell interpolation')
    assert.match(result.remote, /prayer-daily-122880006-[a-f0-9]{12}-[a-f0-9]{8}\.face$/)
    const launch = device.calls.find(call => call.args.at(-1).includes("'am' 'start'"))
    assert.match(launch.args.at(-1), /'-n' 'com\.mc\.xiaomi1\/\.ui\.watchfaces\.WatchfaceUploadActivity'/)
    assert.doesNotMatch(launch.args.at(-1), /UpdateFirmware/)
    assert.match(launch.args.at(-1), /content:\/\/media\/external_primary\/downloads\/987/)
    assert.match(launch.args.at(-1), /'0x10000001'/)
    assert.equal(device.calls.filter(call => call.args.at(-1).includes("'input' 'tap'")).length, 1)
    assert.match(messages.at(-1), /Update completed/)
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('does not open Notify after a corrupt transfer', async () => {
  const data = await fixture()
  const device = phone({ sha256: '0'.repeat(64), binary: Buffer.from('corrupt bytes') })
  try {
    await assert.rejects(deployNotify(parseArgs(['--no-build']), { ...data, ...device, env: {}, log() {} }), /stimmt nicht/)
    assert.ok(!device.calls.some(call => call.args.at(-1).includes("'am' 'start'")))
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('rejects the wrong variant before any device access', async () => {
  const data = await fixture('122880004')
  try {
    await assert.rejects(deployNotify(parseArgs(['--no-build']), {
      ...data, run() { assert.fail('No device access expected') }, log() {}, env: {}
    }), /Falsche Paket-ID/)
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('requires an explicit serial for multiple phones and rejects offline or unauthorized selections', () => {
  assert.throws(() => selectDevice('one device\ntwo device\n'), /Mehrere/)
  assert.throws(() => selectDevice('one offline\n', 'one'), /offline/)
  assert.throws(() => selectDevice('one unauthorized\n', 'one'), /unauthorized/)
  assert.throws(() => selectDevice('emulator-5554 device\n'), /Kein erreichbares/)
  assert.equal(selectDevice('one device\ntwo device\n', 'two'), 'two')
})

test('push-only stages a verified file without launching or querying Notify', async () => {
  const data = await fixture()
  const device = phone(data)
  try {
    const result = await deployNotify(parseArgs(['--no-build', '--push-only']), { ...data, ...device, env: {}, log() {} })
    assert.equal(result.opened, false)
    assert.ok(!device.calls.some(call => /query-activities|'am' 'start'|'pm' 'path'/.test(call.args.at(-1))))
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('no-install keeps the manual preview workflow without UI automation', async () => {
  const data = await fixture()
  const device = phone(data)
  try {
    const result = await deployNotify(parseArgs(['--no-build', '--no-install']), { ...data, ...device, env: {}, log() {} })
    assert.equal(result.opened, true)
    assert.equal(result.installed, false)
    assert.ok(!device.calls.some(call => /'uiautomator'|'input' 'tap'/.test(call.args.at(-1))))
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('does not transfer to an unrecognized importer', async () => {
  const data = await fixture()
  const device = phone({ ...data, handlers: false })
  try {
    await assert.rejects(deployNotify(parseArgs(['--no-build']), { ...data, ...device, env: {}, log() {} }), /keinen erkannten Watchface-Dateiimport/)
    assert.ok(!device.calls.some(call => call.args[2] === 'push' || call.args.at(-1).includes("'content' 'insert'")))
  } finally { await rm(data.root, { recursive: true, force: true }) }
})

test('dry-run works without artifacts, builds or an Android connection', async () => {
  const output = []
  await deployNotify(parseArgs(['--watchface', 'original', '--dry-run']), {
    root: '/not-built', run() { assert.fail('No external commands expected') }, log: message => output.push(message)
  })
  assert.match(output.join('\n'), /122880004/)
  assert.match(output.join('\n'), /next-prayer-lua.face/)
  assert.throws(() => parseArgs(['--watchface']), /Wert/)
  assert.throws(() => parseArgs(['--watchface', 'unknown']), /daily oder original/)
})
