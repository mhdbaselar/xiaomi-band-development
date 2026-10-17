# Halle Prayer Daily – eigenes Band-10-Watchface

Dieses eigenständige Lua-Watchface zeigt oben eine große Uhr mit Datum, in der Mitte den sekundengenauen Gebetscountdown und unten vier kompakte Felder für Wetter, Akku, Schritte und Puls. Über dem Countdown steht je nach nächstem Ereignis **„Fajir in“**, **„Dhuhr in“**, **„Asr in“**, **„Maghrib in“**, **„Isha in“**, **„Iqama in“** oder **„Shuruk in“**. Bei Erreichen der Iqama oder des Sonnenaufgangs erscheint für die bestehende Nullminute „Iqama jetzt“ beziehungsweise „Shuruk jetzt“.

Das [ursprüngliche Gebets-Watchface](../next-prayer/README.md) bleibt im eigenen Projekt erhalten. Beide Pakete haben verschiedene IDs, Namen und Ausgabepfade. Daily nutzt denselben Offline-Kalender für Halle (Saale) aus der [Gebetszeiten-App](../../examples/prayer-times/README.md) sowie die gemeinsame Gebetslogik und Iqama-Einstellung des ursprünglichen Watchfaces. Das Zielgerät ist das Xiaomi Smart Band 10 mit 212 × 520 Pixeln.

Die Zusatzwerte werden über die Firmware-Datenquellen `systemStatusBattery`, `weatherCurrentTemperature`, `weatherCurrentWeather`, `healthStepCount` und `healthHeartRate` bezogen. Wetter zeigt Temperatur in °C und eine kurze Zustandsbeschreibung; der Puls ist der letzte vom Band bereitgestellte Messwert. Das Watchface startet keine zusätzliche Pulsmessung. Bei fehlenden, unbekannten oder ungültigen Daten erscheint `--`. Wetter benötigt die auf dem Band synchronisierten Wetterdaten. Die Kanalnamen entsprechen der [Community-Dokumentation der Firmware-Metriken](https://4pda.to/forum/index.php?showtopic=1092172&st=1920); die Verfügbarkeit auf der eigenen Firmware muss am Band geprüft werden.

Die Reihenfolge am Morgen ist **Fajr-Adhan → Fajr-Iqama → Sonnenaufgang → Dhuhr-Adhan**. Nach den anderen Iqamas folgt der nächste Adhan. Beim Adhan beginnt sofort der Countdown zur Iqama; bei Iqama und Sonnenaufgang wird für eine Minute `00:00:00` angezeigt. Beispiel für den 17. Oktober 2026: Fajr-Adhan 06:10, Iqama mit dem Standardabstand 06:20, Sonnenaufgang 07:39.

Der aktuelle Kalender enthält Adhan und Sonnenaufgang, aber **keine veröffentlichten Iqama-Zeiten**. Deshalb gilt derzeit für alle fünf Gebete der einstellbare Standard von **10 Minuten nach Adhan**. Der gemeinsame Wert steht in [`../next-prayer/settings.json`](../next-prayer/settings.json). Der MAWAQIT-Importer übernimmt bei einem späteren Abruf vorhandene `iqamaCalendar`-Einträge (`+N` Minuten oder `HH:MM`) pro Tag und Gebet. Eine Änderung der Moschee nach dem Import erreicht das Offline-Zifferblatt erst nach erneutem Import, Paketbau und Übertragung. Die [MAWAQIT-API ist nicht öffentlich](https://help.mawaqit.net/en/articles/11991838-can-i-use-your-api); der bestehende Import liest die öffentliche Anzeigeseite.

## Bauen und auf dem Band prüfen

Im Verzeichnis `watchfaces/prayer-daily` mit Node.js 22 oder neuer:

```sh
npm run package
npm run inspect
```

Das Paket liegt unter [`dist/prayer-daily.face`](dist/prayer-daily.face). In Notify als eigenes Zifferblatt importieren und **Halle Prayer Daily** auswählen. Seine ID ist **`122880006`**. Das ursprüngliche **Halle Next Prayer 3** hat weiterhin die ID **`122880004`** und liegt unter [`../next-prayer/dist/next-prayer-lua.face`](../next-prayer/dist/next-prayer-lua.face). Beide Builds schreiben ausschließlich in ihre eigenen Projektordner. Der Paket-Builder verwendet Ressourcen des separat geklonten [`band10-toolkit`](https://github.com/utsabfdahal/band10-toolkit); der Checkout liegt standardmäßig unter `~/Projects/band10-toolkit`. Für einen anderen Pfad kann `BAND10_TOOLKIT` gesetzt werden.

Nach der Übertragung bitte Countdown, Wetter, Akku, Schritte und Puls mit den Band-Apps vergleichen und das Display aus- und einschalten. Ein früherer Band-Test zeigte zunächst ein korrektes Bild; später rückten alle Inhalte nach oben. Jede Textzeile besitzt weiterhin eine feste Position und Größe. Die lokale Testumgebung simuliert das LVGL-Layout der Firmware nicht; die neue Anordnung und Datenquellen sind noch nicht am echten Band geprüft.

Der eingebettete Kalender gilt vom **16. Oktober bis 14. November 2026** (Europe/Berlin). Danach zeigt das Zifferblatt „Kalender erneuern“. Zum Verlängern im Verzeichnis `examples/prayer-times` `npm run update-times` ausführen und anschließend das Watchface neu bauen. Die Lua-Logik läuft auf dem Band und benötigt während der Anzeige keine Netzwerkverbindung.

`npm run package` prüft Paketstruktur, Kalendergrenzen und die Abfolge Adhan/Iqama/Sonnenaufgang sowie Sekunden-Updates, Schlafen und Aufwachen. Die Metriktests prüfen außerdem skalierte Firmware-Werte, fehlende Messwerte und den Schritt-Reset auf null. Die Vorschau liegt unter `build/lua/images/preview.png`; sie verwendet ausdrücklich Beispielwerte für die Band-Metriken. Im installierten Watchface sind keine Beispiel-Messwerte hinterlegt.

## An Notify übertragen

Mit `npm run deploy:notify` wird Daily gebaut, geprüft und per ADB an Notify übergeben. Das Skript drückt automatisch Install und wartet auf den Abschlussstatus. Das Handy muss dafür entsperrt und Notify mit dem Band verbunden sein. Mit `--no-install` wird nur die Vorschau geöffnet. Weitere Optionen stehen in der [Deploy-Anleitung](../../docs/deployment-notify.md).

## Laufende Browser-Vorschau

Mit `npm run preview` wird Daily neu gebaut und die Vorschau unter **http://127.0.0.1:5175/** gestartet. Die Beispielwerte für Wetter, Akku, Schritte und Puls lassen sich dort ändern oder vollständig ausblenden. Uhr und Countdown laufen mit dem echten Lua-Code. Mit `Ctrl+C` wird der Server beendet. Der Browser verwendet eine Ersatzschrift und bildet die Firmware nicht vollständig nach. Die ursprüngliche Vorschau kann daneben auf Port `5174` laufen.
