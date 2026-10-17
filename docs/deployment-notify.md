# Watchfaces an Notify übertragen

Das Skript baut das ausgewählte Watchface einschließlich Tests, prüft die Paket-ID, überträgt es per ADB und öffnet die Watchface-Vorschau in **Notify for Xiaomi**. Dort wird der Bluetooth-Upload auf das Band bestätigt. Ein erfolgreicher Skriptlauf bedeutet, dass der Import geöffnet wurde; er bestätigt keine abgeschlossene Band-Installation.

Voraussetzungen: Node.js 22+, npm, Android Platform Tools (`adb`), ein über USB oder WLAN autorisiertes Android-Handy und Notify for Xiaomi (`com.mc.xiaomi1`) im aktuellen Android-Profil. Notify sollte bereits mit dem Band verbunden sein. Die automatische Dateiübergabe verwendet Androids MediaStore.Downloads (Android 10+).

## Start

Im jeweiligen Watchface-Verzeichnis:

```sh
npm run deploy:notify
```

Oder aus dem Repository-Hauptverzeichnis:

```sh
# Halle Prayer Daily: Uhr, Datum, Gebetscountdown und Band-Metriken
./scripts/deploy-notify.sh --watchface daily

# Ursprüngliches Halle Next Prayer 3
./scripts/deploy-notify.sh --watchface original
```

Daily ist die Standardauswahl. Die Paket-IDs bleiben getrennt: `122880006` für Daily und `122880004` für das Original. Beide Builds behalten ihre eigenen Ausgabedateien.

## Weitere Optionen

```sh
# Vorhandenes Paket verwenden
./scripts/deploy-notify.sh --watchface daily --no-build

# Bei mehreren erreichbaren Handys eines gezielt auswählen
adb devices -l
./scripts/deploy-notify.sh --serial DEINE_ADB_SERIENNUMMER

# Nur in Download/XiaomiWatchfaces ablegen, in Notify selbst auswählen
./scripts/deploy-notify.sh --push-only

# Ablauf ohne Build, Handyzugriff oder Übertragung anzeigen
./scripts/deploy-notify.sh --dry-run
```

Ohne `--serial` muss genau ein physisches Android-Handy erreichbar sein; Emulatoren werden ausgelassen. `PHONE_SERIAL` oder `ANDROID_SERIAL` können eine Vorgabe setzen. Liegt ADB außerhalb des Suchpfads, kann `ADB=/absoluter/pfad/zu/adb` gesetzt werden.

Jeder Lauf legt eine eigene Datei in `Download/XiaomiWatchfaces` an. Der Name enthält Variante, Paket-ID, einen Teil des SHA-256 und eine Laufkennung. Nach dem Übertragen wird die Datei zurückgelesen und der vollständige SHA-256 verglichen. Ein falsches Paket oder eine fehlerhafte Übertragung öffnet den Import nicht.

## Dateiübergabe unter aktuellem Android

Notify 23.9.0 bietet auf dem geprüften Handy einen exportierten `WatchfaceUploadActivity`-Import für `ACTION_VIEW` und `application/octet-stream`. Das Skript ermittelt diesen Import vor der Übertragung und adressiert ihn ausdrücklich, damit die Datei nicht beim Firmware-Importer landet.

Die normale Übergabe legt eine eigene Datei in [MediaStore.Downloads](https://developer.android.com/reference/android/provider/MediaStore.Downloads) an und gibt Notify ein Leserecht nur für deren `content://`-URI. Es werden keine allgemeinen Speicherrechte oder App-Einstellungen geändert. Ein Test mit einer fremden Documents-URI wurde von Android zurückgewiesen; eine eigene MediaStore-URI ließ sich übertragen, korrekt zurücklesen und in Notify öffnen. Die sichtbare Watchface-Vorschau wurde am 17. Oktober 2026 auf dem angeschlossenen Handy bestätigt.

Falls sich die Notify-Importschnittstelle in einer späteren Version ändert, bricht das Skript mit einem Hinweis auf `--push-only` ab. Dieser Modus kopiert die Datei mittels `adb push`; sie wird danach in Notify manuell ausgewählt. Die [Notify-Dokumentation](https://mibandnotify.com/help/tasker_send_intent_tutorial.php) bestätigt den Paketnamen `com.mc.xiaomi1`; Tasker wird für dieses Skript nicht benötigt.

Die automatisierten Tests des Deploy-Ablaufs laufen ohne Handy:

```sh
node --test scripts/tests/deploy-notify.test.mjs
```
