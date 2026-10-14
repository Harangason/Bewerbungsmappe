# Lernstudio-Zweit
# Martin Drexler · CV-Portfolio

Eigenständige lokale Lebenslauf-Webseite im Layout des Lernstudios.

Die Startseite ist ein persönliches Deckblatt mit Begrüßung, Kurzprofil, Stärken, Qualifikationen, Kontakt und klickbarem Inhaltsverzeichnis. Die bisherige Seite bleibt über die Abschnittslinks erreichbar. Über **← Deckblatt** geht es zurück zur Startseite. Direkter Einstieg in die ausführlichen Unterlagen: **http://localhost:25001/#motivation**.

## Start

Diesen Ordner öffnen und `start.ps1` ausführen. Die Seite öffnet sich unter **http://localhost:25001**. Alternativ im Terminal dieses Ordners starten:

```powershell
node server.mjs
```

Das ursprüngliche Lernstudio bleibt unter **http://localhost:25000** erreichbar. Beide Seiten können gleichzeitig geöffnet werden. Das Portfolio wird lokal auf `127.0.0.1` bereitgestellt; es gibt keine externe API und keine Speicherung von Besucherdaten.

Über **Drucken / PDF** kann die CV-Seite im Browser gedruckt oder als PDF gespeichert werden.

Über **DE / EN** in der Kopfzeile lässt sich die gesamte Seite zwischen Deutsch und Englisch umschalten. Die Sprachwahl wird lokal im Browser gespeichert. Direktlinks: **http://localhost:25001/?lang=de** und **http://localhost:25001/?lang=en**. Die Druckansicht verwendet die aktuell gewählte Sprache. **Meine Motivation / My Motivation** steht vor dem Profil.
