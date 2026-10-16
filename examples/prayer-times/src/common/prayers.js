// Device-side code: no Intl, network, or Node APIs required.
export function formatCountdown(milliseconds) {
  if (typeof milliseconds !== 'number' || !isFinite(milliseconds)) return '--:--:--'
  var seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  function pad(value) { return value < 10 ? '0' + value : '' + value }
  return pad(Math.floor(seconds / 3600)) + ':' +
    pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60)
}

export function shortDate(date) {
  return date.slice(8, 10) + '.' + date.slice(5, 7) + '.'
}

export function getPrayerState(calendar, now) {
  var days = calendar.days || []
  var dayIndex = -1
  for (var i = 0; i < days.length; i++) {
    if (now >= days[i].start && now < days[i].end) {
      dayIndex = i
      break
    }
  }
  if (dayIndex === -1) {
    return { status: 'unavailable', day: null, next: null, tomorrow: false, countdown: '--:--:--' }
  }
  var day = days[dayIndex]
  for (var p = 0; p < day.prayers.length; p++) {
    var prayer = day.prayers[p]
    // Keep the start of the prayer visible for one minute.
    if (now >= prayer.at && now < prayer.at + 60000) {
      return { status: 'due', day: day, next: prayer, tomorrow: false, countdown: '00:00:00' }
    }
    if (prayer.at > now) {
      return { status: 'upcoming', day: day, next: prayer, tomorrow: false,
        countdown: formatCountdown(prayer.at - now) }
    }
  }
  var tomorrow = days[dayIndex + 1]
  // Never skip a missing day or repeat today's Fajr as tomorrow's prayer.
  if (tomorrow && tomorrow.start === day.end && tomorrow.prayers.length) {
    return { status: 'upcoming', day: day, next: tomorrow.prayers[0], tomorrow: true,
      countdown: formatCountdown(tomorrow.prayers[0].at - now) }
  }
  return { status: 'missing-next-day', day: day, next: null, tomorrow: false, countdown: '--:--:--' }
}
