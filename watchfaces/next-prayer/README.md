# Nächstes Gebet – Band-10-Watchface

Das Lua-Watchface zeigt für Halle (Saale) die Uhrzeit, das nächste Gebet und einen sekundengenauen Countdown. Es nutzt den Offline-Kalender der [Gebetszeiten-App](../../examples/prayer-times/README.md). Es ist für das Xiaomi Smart Band 10 mit 212 × 520 Pixeln gebaut.

## Bauen und auf dem Band prüfen

Im Verzeichnis `watchfaces/next-prayer` mit Node.js 22 oder neuer:

```sh
npm run package
npm run inspect
```

Das Paket liegt unter `dist/next-prayer-lua.face`. In Notify als eigenes Zifferblatt importieren und **Halle Next Prayer 2** auswählen. Die neue Paket-ID `122880003` unterscheidet diese Fassung von **Halle Next Prayer** (`122880002`), damit die vorherige Version nicht aus einem Cache erneut erscheint. Der Paket-Builder verwendet Ressourcen des separat geklonten [`band10-toolkit`](https://github.com/utsabfdahal/band10-toolkit); der Checkout liegt standardmäßig unter `~/Projects/band10-toolkit`. Für einen anderen Pfad kann `BAND10_TOOLKIT` gesetzt werden.

Nach der Übertragung bitte den Countdown einige Minuten beobachten, das Display aus- und einschalten und den Wechsel zur nächsten Gebetszeit prüfen. Ein früherer Band-Test zeigte zunächst ein korrektes Bild; später rückten alle Inhalte nach oben. Die neue Fassung gibt jeder Textzeile eine feste Position und Größe. Das ist eine gezielte Reparatur für die vermutete Layout-Ursache, aber erst ein erneuter Band-Test kann sie bestätigen. Die lokale Testumgebung simuliert das LVGL-Layout der Firmware nicht.

Der eingebettete Kalender gilt vom **16. Oktober bis 14. November 2026** (Europe/Berlin). Danach zeigt das Zifferblatt „Kalender erneuern“. Zum Verlängern den Kalender unter `examples/prayer-times/src/common/calendar.json` aktualisieren und das Paket neu bauen. Die Lua-Logik läuft auf dem Band und benötigt während der Anzeige keine Netzwerkverbindung.

`npm run package` prüft Paketstruktur, Kalendergrenzen und Countdown gegen die JavaScript-Logik sowie Sekunden-Updates, Schlafen und Aufwachen. Die Vorschau liegt unter `build/lua/images/preview.png`; sie zeigt nur das Design, keine laufende Band-Sitzung.

Der ältere statische Machbarkeitstest bleibt in `manifest.json`, `layout.json` und `assets/` erhalten. Seine Befehle heißen nun beispielsweise `npm run package:static` und `npm run preview:static`. Das `band10-toolkit` allein unterstützt in diesem Test keine eigene Countdown-Logik; das aktive Zifferblatt verwendet deshalb Lua.
