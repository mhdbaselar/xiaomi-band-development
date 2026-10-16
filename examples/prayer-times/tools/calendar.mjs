export const SOURCE_URL = 'https://mawaqit.net/de/msjd-hlh-zlh-halle-saale-06122-germany'
const ZONE = 'Europe/Berlin'
const IDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const LABELS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})

function partsAt(timestamp) {
  return Object.fromEntries(formatter.formatToParts(timestamp)
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
}

export function berlinDate(timestamp) {
  const p = partsAt(timestamp)
  return `${p.year}-${p.month}-${p.day}`
}

function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Datum muss YYYY-MM-DD sein.')
  const value = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new Error(`Ungültiges Datum: ${date}`)
  }
  return value
}

export function addDays(date, count) {
  return new Date(parseDate(date) + count * 86400000).toISOString().slice(0, 10)
}

export function validateTime(time) {
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Ungültige Uhrzeit: ${String(time)}`)
  }
  return time
}

// Resolve each wall-clock time independently. The DST offset at midnight may
// differ from the offset at Fajr on the same day. No Intl needed on the band.
export function berlinTimestamp(date, time) {
  parseDate(date)
  validateTime(time)
  const wall = Date.parse(`${date}T${time}:00Z`)
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const sample = wall + delta
    const p = partsAt(sample)
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`) - sample
  }))
  const matches = [...offsets].map(offset => wall - offset).filter(timestamp => {
    const p = partsAt(timestamp)
    return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time
  })
  if (matches.length !== 1) throw new Error(`Mehrdeutige oder nicht existente Ortszeit: ${date} ${time}`)
  return matches[0]
}

// Parse the public display's JSON without evaluating any downloaded JavaScript.
export function extractConfig(html) {
  const match = /\b(?:var|let|const)\s+confData\s*=\s*/.exec(html)
  if (!match) throw new Error('Keine confData gefunden. Das MAWAQIT-Seitenformat hat sich möglicherweise geändert.')
  const start = match.index + match[0].length
  if (html[start] !== '{') throw new Error('confData ist kein JSON-Objekt.')
  let depth = 0
  let quoted = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1))
  }
  throw new Error('Unvollständige confData.')
}

export function compileCalendar(config, { fetchedAt, count = 30 }) {
  const fetched = Date.parse(fetchedAt)
  if (!Number.isFinite(fetched)) throw new Error('Abrufdatum fehlt oder ist ungültig.')
  if (!Number.isInteger(count) || count < 2 || count > 31) throw new Error('Es werden 2 bis 31 Tage unterstützt.')
  if (config.timezone !== ZONE) throw new Error('Die Moschee muss die Zeitzone Europe/Berlin verwenden.')
  if (!Array.isArray(config.calendar) || config.calendar.length !== 12) throw new Error('Jahreskalender fehlt.')
  if (config.fajrFixationComparedToShuruq != null || config.jumuaAsDuhr) {
    throw new Error('Diese Moschee verwendet noch nicht unterstützte Anpassungen der Gebetszeiten.')
  }
  const first = berlinDate(fetched)
  const year = first.slice(0, 4)
  const days = []
  for (let i = 0; i < count; i++) {
    const date = addDays(first, i)
    // confData has no year field. Never reuse its calendar in the following year.
    if (date.slice(0, 4) !== year) break
    const month = Number(date.slice(5, 7)) - 1
    const day = Number(date.slice(8, 10))
    const times = config.calendar[month]?.[String(day)]
    if (!Array.isArray(times) || times.length !== 6) throw new Error(`Fehlende Gebetszeiten: ${date}`)
    times.forEach(validateTime)
    if (times.some((time, index) => index > 0 && time <= times[index - 1])) {
      throw new Error(`Gebetszeiten sind nicht chronologisch: ${date}`)
    }
    const prayerTimes = [times[0], ...times.slice(2)] // Shuruk is not a prayer.
    // Detect stale HTML / year mismatch / display overrides for the fetched day.
    if (i === 0 && (JSON.stringify(prayerTimes) !== JSON.stringify(config.times) || times[1] !== config.shuruq)) {
      throw new Error('Tagesanzeige und Kalender stimmen nicht überein. Frische Seite abrufen und Abrufdatum prüfen.')
    }
    days.push({
      date,
      start: berlinTimestamp(date, '00:00'),
      end: berlinTimestamp(addDays(date, 1), '00:00'),
      sunrise: times[1],
      prayers: prayerTimes.map((time, index) => ({
        id: IDS[index], label: LABELS[index], time, at: berlinTimestamp(date, time)
      }))
    })
  }
  return {
    schemaVersion: 1,
    mosque: 'Islamisches Kulturcenter Halle (Saale)',
    mosqueId: 12288,
    sourceUrl: SOURCE_URL,
    sourceType: 'public-display-snapshot',
    timezone: ZONE,
    fetchedAt: new Date(fetched).toISOString(),
    jumua: [config.jumua, config.jumua2, config.jumua3].filter(Boolean).map(validateTime),
    days
  }
}
