# PI-RATEN GAMESHOW!

Eine komplett lokale Gameshow für das iPad 10 im Querformat. Ein HTML-Dokument, separates CSS und JavaScript-Module unter `/js/`. Keine Laufzeit-Abhängigkeiten, kein Build, kein Server-Backend und keine externen Anfragen während des Spiels.

## Starten

```sh
npm start
```

Am Computer unter http://localhost:8080 öffnen. Alternativ den gesamten Ordner unverändert bei einem statischen HTTPS-Host bereitstellen. Das iPad braucht **HTTPS**, damit Kamera und Service Worker funktionieren; eine unverschlüsselte LAN-IP reicht nicht. Auf dem Computer gilt localhost als sichere Umgebung.

## Auf dem iPad installieren

1. HTTPS-Adresse in Safari öffnen und auf **„OFFLINE BEREIT“** unten links warten (etwa 10 MB inklusive Musik).
2. Teilen → **Zum Home-Bildschirm** → als Web-App hinzufügen.
3. Vom Home-Bildschirm im Querformat starten, einmal Kamera erlauben und eine Runde ausprobieren.
4. Für die Probe Flugmodus einschalten, die installierte App vollständig schließen und wieder öffnen.

Die installierte App hat keine Browserleisten. iPadOS bestimmt die Darstellung der Systemstatusleiste; das Fullscreen-Manifest und die Apple-Web-App-Metadaten sind gesetzt. Die automatische Ausrichtungssperre ist auf iPadOS nicht garantiert; bei Hochformat bittet die App darum, das Gerät zu drehen.

## Spielen

Nach „Pi ist … 3.“ werden die Nachkommastellen erraten. Richtige Ziffer = ein Punkt; falsche Ziffer = ein Herz weniger, die aktuelle Position bleibt gleich. Drei Fehler beenden die Runde. Dann folgen die Punkteanimation, eine sichtbare Kamera mit fünf Sekunden Countdown, ein Foto und der animierte Aufstieg in der Bestenliste. Bei gleichen Punkten steht der ältere Eintrag zuerst. 10.000 Nachkommastellen sind enthalten; wer alle schafft, beendet die Runde erfolgreich.

Musik läuft nur während einer Runde. Soundeffekte begleiten Eingaben, Countdown, Foto und Bestenliste. Der Tonknopf schaltet alles stumm und merkt sich die Einstellung. Tastaturziffern funktionieren zusätzlich zu den Touch-Tasten.

## Daten und Kamera

Fotos (160 × 160 JPEG), Punkte und Zeitstempel liegen ausschließlich in `localStorage`. Die Kamera wird vor jeder Runde aktiviert und nach dem Foto oder Abbruch abgeschaltet. Ohne funktionierende Kamera beginnt keine Runde; es gibt keinen Ersatzavatar. Kamera- oder Speicherfehler bieten einen Wiederholungsbutton. Es werden keine alten Highscores automatisch entfernt. Browserdaten löschen oder die App entfernen kann lokale Ergebnisse löschen. Safari und die Home-Bildschirm-App können getrennte Speicherbereiche verwenden: für die Party immer die installierte App benutzen.

Die App fordert bei unterstützten Browsern einen Screen Wake Lock an. Ein Countdown pausiert im Hintergrund. Offline-Dateien liegen im Cache Storage des Service Workers, Spielstände ausschließlich im localStorage. Bei Updates die Cache-Version in `sw.js` erhöhen.

## Dateien

- `js/game.js`, `js/pi.js`: Spielregeln und vorberechnete Nachkommastellen
- `js/app.js`: Bildschirmablauf und Interaktionen
- `js/camera.js`: Frontkamera, Zuschnitt und JPEG-Foto
- `js/storage.js`: Speichern und stabiles Ranking
- `js/leaderboard.js`, `js/effects.js`: Aufstieg und Showeffekte
- `js/audio.js`, `assets/audio/`: lokale Musik und Sounds
- `sw.js`, `manifest.webmanifest`: Offline-Cache und Installation

Musik: **„Cipher“ von Kevin MacLeod**, CC BY 4.0; Soundeffekte: **Kenney Interface Sounds**, CC0. Vollständige Quellen und Credits in `assets/audio/CREDITS.txt` und in der Spielhilfe.

## Prüfen

```sh
npm test
```

Tests prüfen Spielregeln, Pi-Ziffern, Ranking, Speicherfehler und die Offline-Dateiliste. Zusätzlich auf dem echten iPad Kamera, Ton, Home-Bildschirm-Start und Flugmodus testen.
