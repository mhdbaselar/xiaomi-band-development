import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { SOURCE_URL, extractConfig, compileCalendar } from './calendar.mjs'

async function main() {
  const options = {}
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') {
      console.log('npm run update-times -- [--days 30] [--file /path/mawaqit.html --fetched-at ISO_TIMESTAMP]')
      return
    }
    if (!['--days', '--file', '--fetched-at'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error(`Unbekannte oder unvollständige Option: ${args[i]}`)
    }
    options[args[i].slice(2)] = args[++i]
  }
  if (Boolean(options.file) !== Boolean(options['fetched-at'])) {
    throw new Error('--file und --fetched-at müssen gemeinsam angegeben werden (Datum des HTML-Abrufs).')
  }
  let html
  let fetchedAt
  if (options.file) {
    html = await readFile(options.file, 'utf8')
    fetchedAt = options['fetched-at']
  } else {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) throw new Error(`MAWAQIT antwortet mit HTTP ${response.status}.`)
    html = await response.text()
    fetchedAt = new Date().toISOString()
  }
  if (html.length > 2000000) throw new Error('Unerwartet große Antwort.')
  const calendar = compileCalendar(extractConfig(html), {
    fetchedAt, count: options.days === undefined ? 30 : Number(options.days)
  })
  const destination = fileURLToPath(new URL('../src/common/calendar.json', import.meta.url))
  const temporary = `${destination}.tmp`
  await writeFile(temporary, JSON.stringify(calendar, null, 2) + '\n')
  await rename(temporary, destination)
  console.log(`${calendar.days.length} Tage importiert: ${calendar.days[0].date} bis ${calendar.days.at(-1).date}.`)
  console.log('Quelle: öffentliche MAWAQIT-Anzeige; keine offizielle API. Jetzt App bauen und erneut installieren.')
}

main().catch(error => {
  console.error(`Import abgebrochen: ${error.message}`)
  process.exitCode = 1
})
