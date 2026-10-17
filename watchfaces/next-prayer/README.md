# Nächstes Gebet – Band-10-Watchface

Das Lua-Watchface zeigt für Halle (Saale) die Uhrzeit und einen sekundengenauen Countdown bis zum nächsten Adhan, zur Iqama oder zum Sonnenaufgang. Es nutzt den Offline-Kalender der [Gebetszeiten-App](../../examples/prayer-times/README.md). Es ist für das Xiaomi Smart Band 10 mit 212 × 520 Pixeln gebaut.

Die Reihenfolge am Morgen ist **Fajr-Adhan → Fajr-Iqama → Sonnenaufgang → Dhuhr-Adhan**. Nach den anderen Iqamas folgt der nächste Adhan. Beim Adhan beginnt sofort der Countdown zur Iqama; bei Iqama und Sonnenaufgang wird für eine Minute `00:00:00` angezeigt. Beispiel für den 17. Oktober 2026: Fajr-Adhan 06:10, Iqama mit dem Standardabstand 06:20, Sonnenaufgang 07:39.

Der aktuelle Kalender enthält Adhan und Sonnenaufgang, aber **keine veröffentlichten Iqama-Zeiten**. Deshalb gilt derzeit für alle fünf Gebete der einstellbare Standard von **10 Minuten nach Adhan**. Der Wert steht in [`settings.json`](settings.json); das Zifferblatt kennzeichnet ihn als „Standard“. Der MAWAQIT-Importer übernimmt bei einem späteren Abruf vorhandene `iqamaCalendar`-Einträge (`+N` Minuten oder `HH:MM`) pro Tag und Gebet. Solche Werte werden auf dem Zifferblatt als „MAWAQIT“ gekennzeichnet. Eine Änderung der Moschee nach dem Import erreicht das Offline-Zifferblatt erst nach erneutem Import, Paketbau und Übertragung. Die [MAWAQIT-API ist nicht öffentlich](https://help.mawaqit.net/en/articles/11991838-can-i-use-your-api); der bestehende Import liest die öffentliche Anzeigeseite.

## Bauen und auf dem Band prüfen

Für die Übergabe an Notify gibt es zusätzlich `npm run deploy:notify`: Es baut und prüft dieses ursprüngliche Watchface, öffnet dessen Import auf dem per ADB verbundenen Android-Handy, drückt Install und wartet auf den Abschlussstatus. Das Handy muss entsperrt sein. `--no-install` öffnet nur die Vorschau. Weitere Optionen stehen in der [Deploy-Anleitung](../../docs/deployment-notify.md).

Im Verzeichnis `watchfaces/next-prayer` mit Node.js 22 oder neuer:

```sh
npm run package
npm run inspect
```

Das Paket liegt unter `dist/next-prayer-lua.face`. In Notify als eigenes Zifferblatt importieren und **Halle Next Prayer 3** auswählen. Die neue Paket-ID `122880004` unterscheidet diese Fassung von der vorherigen (`122880003`), damit Notify keine alte Version aus einem Cache erneut lädt. Der Paket-Builder verwendet Ressourcen des separat geklonten [`band10-toolkit`](https://github.com/utsabfdahal/band10-toolkit); der Checkout liegt standardmäßig unter `~/Projects/band10-toolkit`. Für einen anderen Pfad kann `BAND10_TOOLKIT` gesetzt werden.

Nach der Übertragung bitte den Countdown einige Minuten beobachten, das Display aus- und einschalten und den Wechsel zur nächsten Gebetszeit prüfen. Ein früherer Band-Test zeigte zunächst ein korrektes Bild; später rückten alle Inhalte nach oben. Die neue Fassung gibt jeder Textzeile eine feste Position und Größe. Das ist eine gezielte Reparatur für die vermutete Layout-Ursache, aber erst ein erneuter Band-Test kann sie bestätigen. Die lokale Testumgebung simuliert das LVGL-Layout der Firmware nicht.

Der eingebettete Kalender gilt vom **16. Oktober bis 14. November 2026** (Europe/Berlin). Danach zeigt das Zifferblatt „Kalender erneuern“. Zum Verlängern im Verzeichnis `examples/prayer-times` `npm run update-times` ausführen und anschließend das Watchface neu bauen. Die Lua-Logik läuft auf dem Band und benötigt während der Anzeige keine Netzwerkverbindung.

`npm run package` prüft Paketstruktur, Kalendergrenzen und die Abfolge Adhan/Iqama/Sonnenaufgang sowie Sekunden-Updates, Schlafen und Aufwachen. Die Vorschau liegt unter `build/lua/images/preview.png`; sie zeigt nur das Design, keine laufende Band-Sitzung.

Der ältere statische Machbarkeitstest bleibt in `manifest.json`, `layout.json` und `assets/` erhalten. Seine Befehle heißen nun beispielsweise `npm run package:static` und `npm run preview:static`. Das `band10-toolkit` allein unterstützt in diesem Test keine eigene Countdown-Logik; das aktive Zifferblatt verwendet deshalb Lua.
