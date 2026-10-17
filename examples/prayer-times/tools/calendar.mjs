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

function iqamaTimestamp(date, value, adhan) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error(`Ungültige Iqama: ${String(value)}`)
  if (/^\+\d{1,3}$/.test(value)) {
    const minutes = Number(value.slice(1))
    if (minutes < 1 || minutes > 180) throw new Error(`Ungültiger Iqama-Abstand: ${value}`)
    return adhan + minutes * 60000
  }
  const instant = berlinTimestamp(date, validateTime(value))
  if (instant <= adhan) throw new Error(`Iqama liegt nicht nach dem Adhan: ${date} ${value}`)
  return instant
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

export function compileCalendar(config, { fetchedAt }) {
  const fetched = Date.parse(fetchedAt)
  if (!Number.isFinite(fetched)) throw new Error('Abrufdatum fehlt oder ist ungültig.')
  if (config.timezone !== ZONE) throw new Error('Die Moschee muss die Zeitzone Europe/Berlin verwenden.')
  if (!Array.isArray(config.calendar) || config.calendar.length !== 12) throw new Error('Jahreskalender fehlt.')
  if (config.iqamaCalendar != null && (!Array.isArray(config.iqamaCalendar) || config.iqamaCalendar.length !== 12)) {
    throw new Error('Iqama-Jahreskalender hat ein unerwartetes Format.')
  }
  if (config.fajrFixationComparedToShuruq != null || config.jumuaAsDuhr) {
    throw new Error('Diese Moschee verwendet noch nicht unterstützte Anpassungen der Gebetszeiten.')
  }
  const first = berlinDate(fetched)
  const year = first.slice(0, 4)
  const days = []
  // confData has no year field. Use every published day from the fetch date
  // through this year, but never attach these times to the following year.
  let lastAvailable = null
  for (let date = first; date.slice(0, 4) === year; date = addDays(date, 1)) {
    const month = Number(date.slice(5, 7)) - 1
    const day = Number(date.slice(8, 10))
    if (config.calendar[month]?.[String(day)] != null) lastAvailable = date
  }
  if (lastAvailable === null) throw new Error(`Fehlende Gebetszeiten: ${first}`)
  for (let date = first; date <= lastAvailable; date = addDays(date, 1)) {
    const month = Number(date.slice(5, 7)) - 1
    const day = Number(date.slice(8, 10))
    const times = config.calendar[month]?.[String(day)]
    if (!Array.isArray(times) || times.length !== 6) throw new Error(`Fehlende Gebetszeiten: ${date}`)
    times.forEach(validateTime)
    if (times.some((time, index) => index > 0 && time <= times[index - 1])) {
      throw new Error(`Gebetszeiten sind nicht chronologisch: ${date}`)
    }
    const prayerTimes = [times[0], ...times.slice(2)] // Shuruk is not a prayer.
    const iqamaTimes = config.iqamaCalendar?.[month]?.[String(day)]
    if (iqamaTimes != null && (!Array.isArray(iqamaTimes) || iqamaTimes.length !== 5)) {
      throw new Error(`Ungültige Iqama-Tagesdaten: ${date}`)
    }
    // Detect stale HTML / year mismatch / display overrides for the fetched day.
    if (date === first && (JSON.stringify(prayerTimes) !== JSON.stringify(config.times) || times[1] !== config.shuruq)) {
      throw new Error('Tagesanzeige und Kalender stimmen nicht überein. Frische Seite abrufen und Abrufdatum prüfen.')
    }
    days.push({
      date,
      start: berlinTimestamp(date, '00:00'),
      end: berlinTimestamp(addDays(date, 1), '00:00'),
      sunrise: times[1],
      prayers: prayerTimes.map((time, index) => {
        const at = berlinTimestamp(date, time)
        const iqamaAt = iqamaTimes ? iqamaTimestamp(date, iqamaTimes[index], at) : null
        return { id: IDS[index], label: LABELS[index], time, at,
          ...(iqamaAt == null ? {} : { iqamaAt }) }
      })
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
