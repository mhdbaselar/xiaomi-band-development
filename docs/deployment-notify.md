# Watchfaces und Band-Apps mit Notify installieren

Das Skript baut das ausgewählte Watchface oder Vela-App-Projekt, prüft das Paket und überträgt es per ADB an **Notify for Xiaomi**. Anschließend drückt es automatisch **Install** und wartet auf **„Update completed“**. Damit ist die Übertragung aus Sicht von Notify abgeschlossen; Darstellung und Funktion können anschließend am Band geprüft werden.

Voraussetzungen: Node.js 22+, npm, Android Platform Tools (`adb`), ein über USB oder WLAN autorisiertes und **entsperrtes** Android-Handy und Notify for Xiaomi (`com.mc.xiaomi1`) im aktuellen Android-Profil. Für Band-Apps wird zusätzlich `unzip` benötigt (unter macOS bereits vorhanden). Notify muss bereits mit dem Band verbunden sein. Die automatische Dateiübergabe verwendet Androids MediaStore.Downloads (Android 10+).

## Start

Im jeweiligen Watchface- oder App-Verzeichnis:

```sh
npm run deploy:notify
```

Oder aus dem Repository-Hauptverzeichnis:

```sh
# Halle Prayer Daily: Uhr, Datum, Gebetscountdown und Band-Metriken
./scripts/deploy-notify.sh --watchface daily

# Ursprüngliches Halle Next Prayer 3
./scripts/deploy-notify.sh --watchface original

# Gebetszeiten als eigenständige Band-App
./scripts/deploy-notify.sh --app examples/prayer-times

# Anderes Vela-App-Projekt (Pfad relativ zum aktuellen Verzeichnis)
./scripts/deploy-notify.sh --app examples/songbird
```

Daily ist die Standardauswahl. Die Paket-IDs bleiben getrennt: `122880006` für Daily und `122880004` für das Original. Beide Builds behalten ihre eigenen Ausgabedateien.

`--app` und `--watchface` schließen sich aus. Bei Band-Apps liest das Skript `src/manifest.json`, führt vorhandene Tests mit `npm run test --if-present` aus und baut mit `npm run build`. Es verwendet gezielt `dist/<package>.debug.<versionName>.rpk`; eine zufällige ältere RPK aus `dist` wird nicht ausgewählt. Paketname, `versionName` und `versionCode` des eingebetteten Manifests müssen zum Projekt passen. Außerdem müssen `app.js` und `META-INF/CERT` im Archiv vorhanden sein. Das ist eine Strukturprüfung, keine kryptografische Signaturprüfung. Bei Updates die App-Version im Manifest erhöhen.

## Weitere Optionen

```sh
# Vorhandenes Paket verwenden
./scripts/deploy-notify.sh --watchface daily --no-build
./scripts/deploy-notify.sh --app examples/prayer-times --no-build

# Nur die Vorschau öffnen und später selbst auf Install drücken
./scripts/deploy-notify.sh --no-install

# Bei mehreren erreichbaren Handys eines gezielt auswählen
adb devices -l
./scripts/deploy-notify.sh --serial DEINE_ADB_SERIENNUMMER

# Nur in Download/XiaomiWatchfaces ablegen, in Notify selbst auswählen
./scripts/deploy-notify.sh --push-only

# Ablauf ohne Build, Handyzugriff oder Übertragung anzeigen
./scripts/deploy-notify.sh --dry-run
```

Ohne `--serial` muss genau ein physisches Android-Handy erreichbar sein; Emulatoren werden ausgelassen. `PHONE_SERIAL` oder `ANDROID_SERIAL` können eine Vorgabe setzen. Liegt ADB außerhalb des Suchpfads, kann `ADB=/absoluter/pfad/zu/adb` gesetzt werden.

Jeder Lauf legt eine eigene Datei in `Download/XiaomiWatchfaces` beziehungsweise `Download/XiaomiApps` an. Der Name enthält die Paketkennung, einen Teil des SHA-256 und eine Laufkennung. Nach dem Übertragen wird die Datei zurückgelesen und der vollständige SHA-256 verglichen. Ein falsches Paket oder eine fehlerhafte Übertragung öffnet den Import nicht. `--no-build`, `--no-install`, `--push-only`, `--serial` und `--dry-run` gelten für beide Pakettypen.

## Automatisch installieren

Die UI-Automatisierung liest nach dem Import einen frischen Android-UI-Dump. Sie prüft den aktivierten Install-Button mit der Ressourcen-ID `com.mc.xiaomi1:id/buttonStartUpdate` und den passenden aktiven Importbildschirm:

| Paket | Notify-Ansicht | Erforderlicher Status |
| --- | --- | --- |
| Watchface (`.face`) | `WatchfaceUploadActivity` mit Vorschau | `Valid watchface` |
| Band-App (`.rpk`) | `UpdateFirmwareActivity` | `Valid app file` |

Notify verwendet für Apps dieselbe Ansicht wie für Firmware-Updates. Das Skript erlaubt dort ausdrücklich nur **„Valid app file“**. Eine Firmware-Datei, eine allgemeine „Valid file“-Meldung oder ein Watchface lösen im App-Modus keinen Klick aus. Die Klickposition wird aus den aktuellen Button-Grenzen ermittelt. Es werden keine festen Bildschirmkoordinaten verwendet. Der Install-Button wird genau einmal gedrückt.

Danach wartet das Skript bis zu drei Minuten auf den Abschlussstatus von Notify. `100%` allein zählt nicht als Abschluss. Bei einer Fehlermeldung, einem gesperrten Handy, einem anderen Bildschirm oder einem fehlenden Abschluss wird ein Fehler gemeldet. Es erfolgt kein erneuter Install-Klick. `--no-install` lässt den bisherigen manuellen Ablauf zu.

Nach einem bestätigten Abschluss wird nach Möglichkeit ein Screenshot unter `<projekt>/build/notify/install-completed.png` gespeichert. Die automatische Watchface- und App-Installation wurde am 17. Oktober 2026 mit Notify 23.9.0 auf dem angeschlossenen Handy und Band 10 (Firmware 3.2.8) einschließlich des Status **„Update completed“** getestet. Der App-Test verwendete `examples/prayer-times` (Gebetszeiten 0.2.0); der Abschluss-Screenshot liegt dort unter `build/notify/install-completed.png`.

## Dateiübergabe unter aktuellem Android

Notify 23.9.0 bietet Dateiimporte für `ACTION_VIEW` und `application/octet-stream`. Das Skript ermittelt vor der Übertragung den zum Pakettyp passenden Import und adressiert ihn ausdrücklich. Die Abfrage enthält den Dateinamen samt Endung: Ohne `.rpk` bietet Notify seinen App-Importer nicht an. Es wechselt nicht auf einen anderen Importer, falls der erwartete fehlt.

Die normale Übergabe legt eine eigene Datei in [MediaStore.Downloads](https://developer.android.com/reference/android/provider/MediaStore.Downloads) an und gibt Notify ein Leserecht nur für deren `content://`-URI. Es werden keine allgemeinen Speicherrechte oder App-Einstellungen geändert. Ein Test mit einer fremden Documents-URI wurde von Android zurückgewiesen; eine eigene MediaStore-URI ließ sich übertragen, korrekt zurücklesen und in Notify öffnen. Die sichtbare Watchface-Vorschau wurde am 17. Oktober 2026 auf dem angeschlossenen Handy bestätigt.

Falls sich die Notify-Importschnittstelle in einer späteren Version ändert, bricht das Skript mit einem Hinweis auf `--push-only` ab. Dieser Modus kopiert die Datei mittels `adb push`; sie wird danach in Notify manuell ausgewählt. Die [Notify-Dokumentation](https://mibandnotify.com/help/tasker_send_intent_tutorial.php) bestätigt den Paketnamen `com.mc.xiaomi1`; Tasker wird für dieses Skript nicht benötigt.

Die automatisierten Tests des Deploy-Ablaufs laufen ohne Handy:

```sh
npm --prefix scripts run test:notify
```
