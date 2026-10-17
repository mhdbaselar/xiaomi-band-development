const appPackage = 'com.mc.xiaomi1'
const resource = name => `${appPackage}:id/${name}`
const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
const completedLabels = new Set([
  'update completed', 'update abgeschlossen', 'aktualisierung abgeschlossen',
  'installation abgeschlossen', 'übertragung abgeschlossen'
])

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }
    if (named[entity]) return named[entity]
    const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10)
    return Number.isInteger(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity
  })
}

export function inspectNotifyUI(xml) {
  if (!/<hierarchy(?:\s|>)/.test(xml) || !xml.trim().endsWith('</hierarchy>')) throw new Error('Unvollständiger UI-Dump.')
  const nodes = [...xml.matchAll(/<node\b([^>]*?)\/?\s*>/g)].map(match =>
    Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(attr => [attr[1], decode(attr[2])])))
    .filter(node => node.package === appPackage)
  const byId = name => nodes.filter(node => node['resource-id'] === resource(name))
  const statuses = byId('textViewStatus')
  const status = statuses.length === 1 ? statuses[0].text || '' : ''
  const statusText = normalize(status).replace(/[.!]+$/, '')
  const completed = completedLabels.has(statusText)
  const failed = /\b(failed|error|invalid|cancelled|canceled|aborted)\b|fehlgeschlagen|fehler|ungültig|ungueltig|abgebrochen/i.test(statusText)
  const buttons = byId('buttonStartUpdate')
  const button = buttons.length === 1 ? buttons[0] : undefined
  const bounds = button?.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)?.slice(1).map(Number)
  const validBounds = bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1]
  const validWatchface = /^(valid watchface|gültiges zifferblatt|gültiges watchface|gueltiges zifferblatt)$/.test(statusText)
  const ready = validWatchface && byId('imageViewPreview').length === 1 &&
    byId('containerWatchfaceSettings').length === 1 && button?.enabled === 'true' &&
    button?.clickable === 'true' && ['install', 'installieren'].includes(normalize(button.text || '')) && validBounds
  const progressText = byId('textViewProgress')[0]?.text || ''
  const percent = progressText.match(/^(\d{1,3})\s*%$/)
  return {
    status, completed, failed, ready: Boolean(ready),
    progress: percent && Number(percent[1]) <= 100 ? Number(percent[1]) : undefined,
    button: ready ? { x: Math.floor((bounds[0] + bounds[2]) / 2), y: Math.floor((bounds[1] + bounds[3]) / 2) } : undefined
  }
}

export function isImporterForeground(output, expected) {
  const canonical = component => component.replace('/.', `/${appPackage}.`)
  return output.split(/\r?\n/).some(line => {
    if (!/\b(?:topResumedActivity|mResumedActivity)\b/.test(line)) return false
    const component = line.match(/\b(com\.mc\.xiaomi1\/[\w.$]+)/)?.[1]
    return component && canonical(component) === canonical(expected)
  })
}

export async function installNotify({ readUI, foreground, tap, component, log = console.log,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
  readyTimeoutMs = 25000, timeoutMs = 180000 }) {
  let state
  const readyDeadline = now() + readyTimeoutMs
  while (now() < readyDeadline) {
    try { state = inspectNotifyUI(readUI()) } catch { state = undefined }
    if (state?.failed) throw new Error(`Notify lehnt das Watchface ab: ${state.status}`)
    if (state?.completed) throw new Error('Notify zeigt bereits einen früheren Abschluss. Der neue Import wurde nicht eindeutig geladen; kein Install-Klick ausgeführt.')
    if (state?.ready) break
    await wait(1000)
  }
  if (!state?.ready) throw new Error('Kein eindeutiger aktiver Install-Button gefunden. Handy entsperren und Notify prüfen. Es wurde nichts angeklickt.')
  if (!isImporterForeground(foreground(), component)) throw new Error('Der Notify-Watchface-Import ist nicht im Vordergrund. Es wurde nichts angeklickt.')
  tap(state.button.x, state.button.y)
  log('Install automatisch gedrückt. Warte auf den Abschluss in Notify …')
  const deadline = now() + timeoutMs
  let lastProgress
  while (now() < deadline) {
    try { state = inspectNotifyUI(readUI()) } catch { state = undefined }
    if (state?.failed) throw new Error(`Notify meldet einen Installationsfehler: ${state.status}`)
    if (state?.completed) return { installed: true, status: state.status }
    if (state?.progress !== undefined && state.progress !== lastProgress) {
      lastProgress = state.progress
      log(`Notify-Upload: ${lastProgress}%`)
    }
    await wait(1000)
  }
  throw new Error('Install wurde einmal gedrückt, aber Notify hat den Abschluss nicht rechtzeitig bestätigt. Handy prüfen; es wird kein zweites Mal geklickt.')
}
