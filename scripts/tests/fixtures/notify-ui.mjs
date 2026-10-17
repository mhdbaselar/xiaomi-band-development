// Minimal fixture using resource IDs observed on Notify for Xiaomi 23.9.0.
export function notifyUI({ status = 'Valid watchface!', button = 'Install', enabled = true,
  progress, kind = 'watchface', packageName = 'com.mc.xiaomi1', bounds = '[258,1197][821,1377]' } = {}) {
  const escaped = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  const node = (id, text = '', attributes = '') =>
    `<node package="${packageName}" resource-id="com.mc.xiaomi1:id/${id}" text="${escaped(text)}" ${attributes}/>`
  return `<hierarchy rotation="0">${kind === 'watchface' ? node('imageViewPreview') + node('containerWatchfaceSettings') : ''}${
    node('buttonStartUpdate', button, `enabled="${enabled}" clickable="true" bounds="${bounds}"`)
  }${node('textViewStatus', status)}${progress === undefined ? '' : node('textViewProgress', `${progress}%`)}</hierarchy>`
}

export const foreground = 'topResumedActivity=ActivityRecord{abc u0 com.mc.xiaomi1/.ui.watchfaces.WatchfaceUploadActivity t42}'
export const importer = 'com.mc.xiaomi1/.ui.watchfaces.WatchfaceUploadActivity'
export const appImporter = 'com.mc.xiaomi1/.ui.updateFirmware.UpdateFirmwareActivity'
export const appForeground = `topResumedActivity=ActivityRecord{abc u0 ${appImporter} t42}`
