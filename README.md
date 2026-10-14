# Bewerbung Online
# Martin Drexler · CV-Portfolio

Eigenständige lokale Lebenslauf-Webseite im Layout des Lernstudios.

Die Startseite ist ein persönliches Deckblatt mit Begrüßung, Kurzprofil, Stärken, Qualifikationen, Kontakt und klickbarem Inhaltsverzeichnis. Die Motivation hat eine eigene Seite unter **http://localhost:25001/motivation**. Ein interaktiver Workflow zeigt Problemklärung, Schnittstellenabstimmung, Vorgaben, Konzeptentwicklung, Software und Tools sowie Prüfung und Verbesserung. Die Weiterbildung und eigenen Projekte werden als Fortsetzung dieser Arbeitsweise erklärt. Die Darstellung bleibt aus Vertraulichkeitsgründen auf Methodenebene. Der Lebenslauf bleibt über die Abschnittslinks erreichbar, direkt unter **http://localhost:25001/#profil**. Über **← Deckblatt** geht es zurück zur Startseite.

## Start

Diesen Ordner öffnen und `start.ps1` ausführen. Die Seite öffnet sich unter **http://localhost:25001**. Alternativ im Terminal dieses Ordners starten:

```powershell
node server.mjs
```

Das ursprüngliche Lernstudio bleibt unter **http://localhost:25000** erreichbar. Beide Seiten können gleichzeitig geöffnet werden. Das Portfolio wird lokal auf `127.0.0.1` bereitgestellt; es gibt keine externe API und keine Speicherung von Besucherdaten.

Über **Drucken / PDF** kann die CV-Seite im Browser gedruckt oder als PDF gespeichert werden.

Über **DE / EN** in der Kopfzeile lässt sich die gesamte Seite zwischen Deutsch und Englisch umschalten. Die Sprachwahl wird lokal im Browser gespeichert und zwischen Deckblatt, Motivation und Lebenslauf mitgenommen. Direktlinks: **http://localhost:25001/?lang=de** und **http://localhost:25001/?lang=en**. Die Druckansicht verwendet die aktuell gewählte Sprache; auf der Motivationsseite werden alle Workflow-Schritte gedruckt.
# Bewerbungsmappe
