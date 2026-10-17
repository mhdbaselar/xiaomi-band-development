import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectNotifyUI, isImporterForeground, installNotify } from '../notify-install.mjs'
import { notifyUI, foreground, importer } from './fixtures/notify-ui.mjs'

test('finds the enabled Install button by resource ID and its current bounds', () => {
  const state = inspectNotifyUI(notifyUI({ bounds: '[20,80][220,160]' }))
  assert.equal(state.ready, true)
  assert.deepEqual(state.button, { x: 120, y: 120 })
  assert.equal(inspectNotifyUI(notifyUI({ enabled: false })).ready, false)
  assert.equal(inspectNotifyUI(notifyUI({ button: 'Cancel' })).ready, false)
  assert.equal(inspectNotifyUI(notifyUI({ packageName: 'another.app' })).ready, false)
  assert.equal(inspectNotifyUI(notifyUI({ bounds: '[0,0][0,0]' })).ready, false)
  const duplicate = notifyUI().replace('</hierarchy>', '<node package="com.mc.xiaomi1" resource-id="com.mc.xiaomi1:id/buttonStartUpdate" text="Install"/></hierarchy>')
  assert.equal(inspectNotifyUI(duplicate).ready, false)
  assert.throws(() => inspectNotifyUI('<hierarchy>'), /Unvollständiger/)
})

test('distinguishes an explicit completion from 100% progress and supports German labels', () => {
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Installing', progress: 100 })).completed, false)
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Update completed', progress: 100 })).completed, true)
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Update not completed' })).completed, false)
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Installation abgeschlossen' })).completed, true)
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Gültiges Zifferblatt!', button: 'Installieren' })).ready, true)
  assert.equal(inspectNotifyUI(notifyUI({ status: 'Invalid watchface!' })).failed, true)
})

test('accepts only the active WatchfaceUploadActivity', () => {
  assert.equal(isImporterForeground(foreground, importer), true)
  assert.equal(isImporterForeground(foreground.replace('/.ui', '/com.mc.xiaomi1.ui'), importer), true)
  assert.equal(isImporterForeground(foreground.replace('watchfaces.WatchfaceUploadActivity', 'updateFirmware.UpdateFirmwareActivity'), importer), false)
  assert.equal(isImporterForeground('com.mc.xiaomi1/.ui.watchfaces.WatchfaceUploadActivity', importer), false)
})

function harness(states, active = foreground) {
  let time = 0
  const taps = []
  let reads = 0
  return {
    taps,
    settings: {
      component: importer, foreground: () => active,
      readUI: () => states[Math.min(reads++, states.length - 1)],
      tap: (x, y) => taps.push([x, y]), log() {}, now: () => time,
      wait: async ms => { time += ms }, readyTimeoutMs: 3000, timeoutMs: 3000
    }
  }
}

test('clicks once and waits for Notify to confirm the upload', async () => {
  const run = harness([notifyUI(), notifyUI({ status: 'Installing', progress: 50 }),
    notifyUI({ status: 'Update completed', enabled: false, progress: 100 })])
  assert.equal((await installNotify(run.settings)).installed, true)
  assert.equal(run.taps.length, 1)
})

test('does not click a locked, invalid, stale or different screen', async () => {
  for (const states of [ ['<invalid/>'], [notifyUI({ status: 'Invalid watchface!' })],
    [notifyUI({ status: 'Update completed' })], [notifyUI({ enabled: false })] ]) {
    const run = harness(states)
    await assert.rejects(installNotify(run.settings))
    assert.equal(run.taps.length, 0)
  }
  const switched = harness([notifyUI()], 'topResumedActivity=ActivityRecord{abc u0 another.app/.Main t1}')
  await assert.rejects(installNotify(switched.settings), /nicht im Vordergrund/)
  assert.equal(switched.taps.length, 0)
})

test('a failed or unconfirmed upload never triggers another install click', async () => {
  const failed = harness([notifyUI(), notifyUI({ status: 'Update failed' })])
  await assert.rejects(installNotify(failed.settings), /Installationsfehler/)
  assert.equal(failed.taps.length, 1)
  const timedOut = harness([notifyUI(), notifyUI({ status: 'Installing', progress: 100 })])
  await assert.rejects(installNotify(timedOut.settings), /kein zweites Mal/)
  assert.equal(timedOut.taps.length, 1)
})
