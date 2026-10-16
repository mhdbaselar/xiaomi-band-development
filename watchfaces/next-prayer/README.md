# Nächstes Gebet – Watchface-Machbarkeitstest

**Ergebnis vom 16. Oktober 2026:** Das unveränderte `band10-toolkit` kann ein natives Band-10-Zifferblatt mit Uhrzeitanbindung exportieren. Ein automatisch wechselndes nächstes Gebet und ein berechneter Countdown lassen sich mit seinen derzeitigen Datenquellen und Widgets nicht umsetzen. Das ist eine Grenze dieses Toolkit-Stands, kein Nachweis, dass die Band-Firmware grundsätzlich keine eigene Logik unterstützt.

Dieses Projekt enthält ein kleines, baubares Test-Zifferblatt mit einer nativen Stunden-/Minutenanzeige und einem **festen Gebetsbeispiel**. Auf dem Zifferblatt stehen ausdrücklich „DEMO · FESTE GEBETSDATEN“ und „Countdown läuft nicht“. Es ist kein einsatzfertiges Gebetszifferblatt.

## Einrichtung

Die beiden Repositories liegen nebeneinander:

```text
~/Projects/
├── band10-toolkit/
└── xiaomi-band-development/
    ├── examples/prayer-times/
    └── watchfaces/next-prayer/
```

Getesteter Toolkit-Commit: [`549abf5046ce207327ca82fdc20b0320c27a3830`](https://github.com/utsabfdahal/band10-toolkit/tree/549abf5046ce207327ca82fdc20b0320c27a3830), Node.js 22.15.1, npm 10.9.2.

Das Toolkit ist bereits geklont und installiert. Für eine neue Umgebung:

```sh
cd ~/Projects
git clone https://github.com/utsabfdahal/band10-toolkit.git
cd band10-toolkit
git checkout 549abf5046ce207327ca82fdc20b0320c27a3830
npm install
```

`npm ci` scheiterte mit dem ursprünglichen Lockfile an fehlenden Einträgen für `@emnapi/core` und `@emnapi/runtime`. `npm install` hat diese lokal ergänzt; deshalb ist `package-lock.json` im Toolkit geändert. Toolkit-Quellcode wurde nicht angepasst.

## Bauen und prüfen

Im Verzeichnis `watchfaces/next-prayer`:

```sh
npm run validate
npm run package
npm run inspect
npm run check
npm run preview
```

Es ist kein eigenes `npm install` in diesem Watchface-Ordner erforderlich. Die Befehle verwenden die Abhängigkeiten des benachbarten Toolkits. Bei anderem Speicherort kann `BAND10_TOOLKIT=/absoluter/pfad/band10-toolkit` gesetzt werden.

`npm run preview` öffnet einen lokalen Server, normalerweise unter <http://127.0.0.1:5173/>. Die Vorschau simuliert die Geräteuhr; ihre Gebetsdaten bleiben absichtlich fest. Änderungen im Studio müssen über „Export JSON“ übernommen werden; die Vorschau schreibt nicht automatisch das ursprüngliche `layout.json` zurück.

Ausgaben:

- `dist/next-prayer-demo.face` und `.bin`: identische native Testpakete.
- `build/preview.png`: Vorschau mit 212 × 520 Pixeln.
- `build/feasibility.json`: Ergebnisse der Schema-, Gebetslogik- und Binärprüfungen.
- `build/fprj/` und `build/gmf/`: Zwischenformate.

Build, Package und Preview erstellen `build/` neu. `npm run check` nach dem letzten dieser Befehle erneut ausführen, um den Bericht zu behalten. `build/` und `dist/` sind bereits über die zentrale `.gitignore` ausgeschlossen.

## Was der Test nachweist

1. Ein gültiges Layout mit nativen Stunden-/Minutenquellen wird akzeptiert und ohne Validierungswarnungen exportiert.
2. Eigene Quellen `nextPrayer` und `prayerCountdown`, eine Berechnung am Zahlenwidget sowie Skript-Widgets und ein Skriptfeld im Layout werden vom echten Toolkit-Schema abgelehnt.
3. Die vorhandene Funktion `getPrayerState` aus der Gebetszeiten-App funktioniert auf dem Rechner: Sekundenwechsel, Gebetsbeginn, Wechsel zum folgenden Gebet, Fajr am Folgetag und abgelaufene Daten.
4. Das gebaute Paket lässt sich wieder einlesen: richtige Kennung, Auflösung und ID, keine Parserwarnungen, alle Bildressourcen dekodierbar, ausschließlich `hour`-/`minute`-Anbindungen. `.face` und `.bin` sind identisch.

Die Gebetslogik wird **nur auf dem Rechner** ausgeführt. Weder `prayers.js` noch der Kalender werden als ausführbare Logik in das Zifferblatt übernommen. Die Quellprüfung bestätigt außerdem: `builder/gmf.ts` bildet Widgets auf feste Firmware-Datenquellen ab; `builder/native.ts` bietet keinen Exportpfad für eigene Skripte.

Eine Bildliste kann einen einzelnen vorhandenen Wert, etwa den Kalendertag, auf vorbereitete Bilder abbilden. Sie stellt keine dokumentierte Kombination aus Datum, Uhrzeit und Kalender und keine freie Subtraktion für einen Countdown bereit. Ein Monatsplan als Bildliste wäre ein anderes, begrenztes Produkt und würde das Ziel „nächstes Gebet“ nicht erfüllen.

## Quelldateien und nächste Schritte

- `manifest.json` und `layout.json`: editierbares Zifferblattprojekt.
- `assets/`: eigene SVG-Assets.
- `snapshot.json`: Herkunft und fester Bezugszeitpunkt des Gebetsbeispiels, **16.10.2026 um 10:08 Uhr Europe/Berlin**.
- `tools/generate.mjs`: erzeugt Demo-Assets und Layout aus dem vorhandenen App-Kalender. `npm run generate` überschreibt diese Dateien und benötigt noch den genannten Tag im Kalender. Der Generator dient der Reproduktion des Tests, nicht der täglichen Aktualisierung.
- `tools/probe.mjs`: ausführbarer Machbarkeitstest gegen das installierte Toolkit und das gebaute Paket.

Die [bestehende Vela-App](../../examples/prayer-times/README.md) bleibt die vorhandene Umsetzung der Countdown-Logik. Für ein echtes dynamisches Watchface brauchen wir als nächsten Forschungsbaustein ein nachweislich auf dem Band 10 funktionierendes Beispiel mit eigener Skript-/Zeitlogik und einen passenden Exportweg. Ein zusätzliches Feld in der Browser-Vorschau allein würde das nicht lösen.

**Gerätestatus:** Das Testpaket wurde nicht auf dein Band übertragen oder dort getestet. Die Toolkit-README meldet erfolgreiche Hardwaretests des Autors, während `docs/limitations.md` noch einen älteren, ungetesteten Stand nennt. Unsere Aussage beschränkt sich auf lokale Validierung, Paketprüfung und sichtbare Browser-Vorschau.

Quellen zum geprüften Stand: [Datenquellen](https://github.com/utsabfdahal/band10-toolkit/blob/549abf5046ce207327ca82fdc20b0320c27a3830/core/dataSources.ts), [Schema](https://github.com/utsabfdahal/band10-toolkit/blob/549abf5046ce207327ca82fdc20b0320c27a3830/core/schema.ts), [GMF-Export](https://github.com/utsabfdahal/band10-toolkit/blob/549abf5046ce207327ca82fdc20b0320c27a3830/builder/gmf.ts), [nativer Packer](https://github.com/utsabfdahal/band10-toolkit/blob/549abf5046ce207327ca82fdc20b0320c27a3830/builder/native.ts), [Funktionsgrenzen](https://github.com/utsabfdahal/band10-toolkit/blob/549abf5046ce207327ca82fdc20b0320c27a3830/docs/limitations.md).
