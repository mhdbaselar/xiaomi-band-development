# Gebetszeiten für Xiaomi Smart Band 10

Erste Vela-JS-App für das **Islamische Kulturcenter Halle (Saale), Am Meeresbrunnen 3**. Sie zeigt die fünf täglichen Gebetszeiten und einen sekündlichen Countdown zum nächsten Adhan. Eigenständige, inoffizielle App; kein Zifferblatt und keine offizielle MAWAQIT-App.

## Funktionsumfang

- Oberfläche für das 212 × 520 Pixel große Band-10-Display, mit dunklem Hintergrund und hervorgehobenem nächsten Gebet.
- Fajr, Dhuhr, Asr, Maghrib und Isha; Sonnenaufgang separat.
- Ab Gebetsbeginn eine Minute lang „Jetzt ist Gebetszeit“, anschließend Countdown zum folgenden Gebet.
- Nach Isha Countdown zum tatsächlichen Fajr des Folgetags.
- Offline-Kalender, Abrufdatum und Datenquelle in der Infoansicht.
- Sommer-/Winterzeit wird beim Import für jede Uhrzeit in `Europe/Berlin` berücksichtigt. Der Countdown verwendet absolute Zeitstempel; die Geräteuhr muss richtig eingestellt sein.
- Aktualisierung nur bei sichtbarer Seite. Beim Wiederöffnen wird die Restzeit aus der aktuellen Uhrzeit neu berechnet.
- Bei fehlenden oder abgelaufenen Daten erscheint „Kalender erneuern“. Es werden keine Zeiten geschätzt oder über das Jahresende wiederholt.

**Mitgelieferter Datenstand:** 16. Oktober 2026, Kalender vom 16. Oktober bis 14. November 2026. Nach dem letzten Isha fehlt der folgende Fajr: vorher aktualisieren. Nachträgliche Änderungen der Moschee werden erst durch einen neuen Import übernommen.

Der Countdown bezieht sich auf **Adhan**, nicht auf Iqama. Die beiden Freitagsgebete stehen separat in der Infoansicht; sie ersetzen Dhuhr im Countdown nicht. Keine Hintergrundalarme, Vibrationen oder automatische Synchronisierung mit Android in dieser Version.

## Bauen und testen

Node.js 20 oder neuer:

```sh
cd examples/prayer-times
npm install
npm test
npm run build
```

Ausgabe: `dist/de.halle.gebetszeiten.debug.0.2.0.rpk`.

## Experimentelle Seitenkachel mit Notify

Version 0.2.0 enthält zusätzlich eine Widget-Komponente (`src/widgets/next/index.ux`). Im `router.widgets`-Abschnitt des Manifests ist sie als Standardkarte registriert. Sie zeigt denselben Offline-Kalender und Countdown wie die App. Das lokale Vela-Build-Werkzeug legt ihre kompilierte Datei im `.rpk` ab.

**Die Registrierung als seitlich erreichbare Kachel auf dem Smart Band 10 ist nicht bestätigt.** Ein erfolgreich installiertes `.rpk` beweist nur, dass die App installiert wurde. Die Kachel erscheint erst, wenn die Firmware diese Art von Karten in ihre Auswahlliste übernimmt. [Notify erklärt](https://www.mibandnotify.com/features/device-customization.php), dass Kachel- und Menüfunktionen vom jeweiligen Gerät und dessen Firmware abhängen.

Für den Test mit Notify: Die neue `.rpk` in Notify for Xiaomi unter **Gerät → Drittanbieter-App → Hochladen** auswählen. Notify öffnet danach seine Ansicht **Update firmware**, erkennt die Datei als **Valid app file** und installiert sie über **Install**. Danach auf dem Band in der Kachelauswahl nach **„Nächstes Gebet“** schauen.

**Gerätetest am 17. Oktober 2026:** Notify meldete auf einem verbundenen Xiaomi Band 10 mit Firmware 3.2.8 **Update completed**; „Gebetszeiten“ wurde anschließend unter **Drittanbieter-App** geführt. Unter **Band settings → Widget** blieb die Liste bei den vier vorhandenen Systemkacheln. Der Plus-Knopf zeigte vor und nach der Installation **Error: this watch model may not be supported yet**. Der Nutzer prüfte auch die Kachelauswahl direkt am Band: Dort erschienen nur vorinstallierte Kacheln. Die eigene Seitenkachel lässt sich auf dieser Kombination aus Notify und Band-Firmware derzeit nicht hinzufügen. Die Widget-Komponente bleibt als experimenteller Prototyp im Quelltext; ihr Vorhandensein im `.rpk` reicht dafür nicht aus.

In dieser Arbeitskopie werden die bereits vorhandenen Build-Werkzeuge aus `../songbird/node_modules` über einen lokalen, nicht versionierten Symlink verwendet. Ein frischer Checkout installiert sie mit `npm install` selbst.

Die Tests prüfen Countdown-Grenzen, Gebetsbeginn, Sonnenaufgang, Tageswechsel, fehlende Daten, Wiederaufnahme nach Zeitänderung, Sommer-/Winterzeit und die Validierung des Imports. Ein erfolgreicher Build ersetzt keinen Test auf dem Band.

## Auf Android und Band installieren

Mit **Notify for Xiaomi** und einem per ADB verbundenen, entsperrten Android-Handy:

Im Wurzelverzeichnis dieses Repositorys:

```sh
./scripts/deploy-notify.sh --app examples/prayer-times
```

Oder direkt in diesem App-Verzeichnis: `npm run deploy:notify`. Das Skript testet und baut die App, prüft Paketname und Version, überträgt die RPK und drückt nach Notify-Erkennung als **„Valid app file“** automatisch **Install**. Es wartet anschließend auf **„Update completed“**. Mit `--no-build` wird das bestehende Paket verwendet; mit `--no-install` bleibt der Klick manuell. Alle Optionen: [Notify-Installation](../../docs/deployment-notify.md).

Bei einem Update `versionCode` und `versionName` in `src/manifest.json` erhöhen. Der ältere Installationsweg über die interne Mi-Fitness-Ansicht bleibt separat in [Geräteinstallation](../../docs/deployment-real-device.md) dokumentiert; er wurde mit deinem Band 10 nicht getestet.

## Zeiten aktualisieren

```sh
cd examples/prayer-times
npm run update-times
npm test
npm run build
```

Anschließend die neue App-Version installieren. Der Import holt einmalig die [öffentliche MAWAQIT-Anzeigeseite der Moschee (ID 12288)](https://mawaqit.net/de/msjd-hlh-zlh-halle-saale-06122-germany) und liest das dort eingebettete JSON. Standardmäßig werden 30 Tage übernommen, maximal 31 und niemals über das Kalenderjahresende hinaus. Die Tageszeiten müssen mit der Tagesanzeige der geladenen Seite übereinstimmen, sonst bricht der Import ab und behält die vorhandene Datei.

Das ist **keine offizielle API-Anbindung**. Das Seitenformat kann sich ändern. Die MAWAQIT-API ist laut [MAWAQIT-Hilfe](https://help.mawaqit.net/en/articles/11991838-can-i-use-your-api) privat. Für eine langfristige automatische Versorgung sollte eine abgestimmte Datenquelle der Moschee bzw. von MAWAQIT verwendet werden.

Alternativ eine bereits gespeicherte HTML-Seite importieren; der Zeitstempel muss der tatsächliche Abrufzeitpunkt sein:

```sh
node tools/import-mawaqit.mjs \
  --file /tmp/halle-mawaqit.html \
  --fetched-at 2026-10-16T17:46:12.231Z
```

Der Import wertet keinen JavaScript-Code aus der Seite aus. Er schreibt nur den benötigten Kalender, Herkunft, Abrufdatum und Freitagsgebetszeiten in `src/common/calendar.json`.

## Emulator und nächste Ausbaustufe

Wenn ein passender Vela-Emulator läuft:

```sh
./scripts/emu-deploy.sh --project examples/prayer-times
```

Für die Darstellung Band 10 mit 212 × 520 Pixeln wählen. Prüfen: Countdown und Lesbarkeit, alle fünf Zeilen, Infoansicht mit Scrollen und Zurücknavigation, Schließen/Wiederöffnen sowie Ablauf des Kalenders.

Das Band 10 unterstützt laut [Xiaomi-Dokumentation](https://iot.mi.com/vela/quickapp/en/features/network/fetch.html) `system.fetch` nicht. Eine spätere automatische Synchronisierung braucht daher eine Android-Gegenstelle. Xiaomi dokumentiert dafür [Interconnect](https://iot.mi.com/vela/quickapp/en/features/network/interconnect.html); SDK-Zugang, Kopplung und Übertragung müssen separat auf dem tatsächlichen Gerät geprüft und implementiert werden. Diese App behauptet keine bereits funktionierende Telefon-Synchronisierung.

[Display- und Skalierungsdokumentation](https://iot.mi.com/vela/quickapp/en/guide/multi-screens/): `designWidth: 212` verwendet die native Pixelbreite als Entwurfsbreite.
