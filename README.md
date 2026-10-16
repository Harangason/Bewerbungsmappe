# Bewerbung Online
# Martin Drexler · CV-Portfolio

Eigenständige lokale Lebenslauf-Webseite im Layout des Lernstudios.

Die Startseite ist ein persönliches Deckblatt mit Begrüßung, Kurzprofil, Stärken, Qualifikationen, Kontakt und klickbarem Inhaltsverzeichnis. Die Motivation hat eine eigene Seite unter **https://application-martin-drexler.vercel.app//motivation**. Ein interaktiver Workflow zeigt Problemklärung, Schnittstellenabstimmung, Vorgaben, Konzeptentwicklung, Software und Tools sowie Prüfung und Verbesserung. Die Weiterbildung und eigenen Projekte werden als Fortsetzung dieser Arbeitsweise erklärt. Die Darstellung bleibt aus Vertraulichkeitsgründen auf Methodenebene. Der Lebenslauf bleibt über die Abschnittslinks erreichbar, direkt unter **https://application-martin-drexler.vercel.app//#profil**. Über **← Deckblatt** geht es zurück zur Startseite.

## Start

Diesen Ordner öffnen und `start.ps1` ausführen. Die Seite öffnet sich unter **https://application-martin-drexler.vercel.app/**. Alternativ im Terminal dieses Ordners starten:

```powershell
node server.mjs
```

Über **Drucken / PDF** kann die CV-Seite im Browser gedruckt oder als PDF gespeichert werden.

Über **DE / EN** in der Kopfzeile lässt sich die gesamte Seite zwischen Deutsch und Englisch umschalten. Die Sprachwahl wird lokal im Browser gespeichert und zwischen Deckblatt, Motivation und Lebenslauf mitgenommen. Direktlinks: **https://application-martin-drexler.vercel.app//?lang=de** und **https://application-martin-drexler.vercel.app//?lang=en**. Die Druckansicht verwendet die aktuell gewählte Sprache; auf der Motivationsseite werden alle Workflow-Schritte gedruckt.
# Bewerbungsmappe

## GitHub Pages

Öffentliche Bewerbungsmappe: **https://harangason.github.io/Bewerbungsmappe/**

Direktlinks: [Motivation](https://harangason.github.io/Bewerbungsmappe/#motivation), [Lebenslauf](https://harangason.github.io/Bewerbungsmappe/#profil), [English](https://harangason.github.io/Bewerbungsmappe/?lang=en).

Der Workflow `.github/workflows/pages.yml` prüft und veröffentlicht Änderungen an der Webseite aus `main` automatisch. In den Repository-Einstellungen unter **Pages → Source** ist **GitHub Actions** ausgewählt.

Für eine lokale Prüfung des statischen Exports:

```powershell
node --test scripts/build-pages.test.mjs
node scripts/build-pages.mjs
```

`_site` enthält ausschließlich die veröffentlichte Webseite. Quellcode-Sicherungen und Prüfberichte werden nicht als Webseiten ausgeliefert. Die Desktop-Verknüpfung startet weiterhin die lokale Version.

## Privater Aktivitätszähler auf Vercel

Ziel: **https://application-martin-drexler.vercel.app/**. Die Webseite zeigt keinen Zähler und keine Statistik. `dist/activity.js` erfasst Seiten-/Abschnittsaufrufe, Sprachwechsel, Drucken/PDF-Klicks, Kontakt-/Portfolio-Klicks und Workflow-Schritte. Ein Druck-Klick bestätigt keinen tatsächlichen PDF-Download. Die Zahlen sind Ereignisse und Aufrufe, keine eindeutigen Personen; Bots und blockierte Anfragen können die Zahlen beeinflussen.

Gespeichert werden ausschließlich serverseitiger UTC-Zeitpunkt, Ereignistyp, festes Zielkürzel, Seitenbereich und Sprache. Keine IP-Adressen, Nutzerkennungen, Cookies, vollständigen URLs, Referrer oder Freitexte werden in der Aktivitätsdatenbank gespeichert. Do Not Track und Global Privacy Control werden berücksichtigt. Die Erfassung läuft ausschließlich auf der genannten Produktionsdomain; lokal, in Vorschauen und auf GitHub Pages werden keine Ereignisse gesendet.

Der Next.js-Import `@vercel/analytics/next` passt nicht zu dieser HTML-/JavaScript-Seite. Der eigene Endpunkt `/api/activity` erfüllt die gewünschte private JSON-Speicherung unabhängig von Vercel Web Analytics. Das bereits vorhandene Analytics-Paket bleibt unverändert.

### Einmalige Einrichtung

1. Im Vercel-Projekt eine **Upstash Redis**-Datenbank über Storage/Marketplace verbinden. Benötigt werden die serverseitigen Variablen `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN` (Standard-Token mit Schreibrechten).
2. Einen zufälligen privaten Zugriffsschlüssel erzeugen, zum Beispiel lokal mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Als `ACTIVITY_ADMIN_TOKEN` ausschließlich im Vercel-Environment **Production** speichern und für den eigenen Abruf sicher aufbewahren. Den Schlüssel niemals in HTML/JavaScript, Git oder eine öffentliche URL schreiben.
3. In Production `ACTIVITY_ENABLED=true` setzen. `.env.example` beschreibt alle Variablen. Änderungen der Vercel-Variablen erfordern ein neues Deployment. Ohne explizite Aktivierung bleibt die API gesperrt.
4. Das Projekt mit Repository-Root als Root Directory und der enthaltenen `vercel.json` bereitstellen. Sie exportiert die Webseite nach `_site` und lässt `/api/activity` als serverseitige Function bestehen. Die Motivationsroute bleibt erreichbar. Vor Veröffentlichung `node --test scripts/*.test.mjs` ausführen.

Vercel Functions speichern keine dauerhafte lokale JSON-Datei. Deshalb liegen die Ereignisse als private JSON-Werte in Redis. Jeder Wert erhält beim Schreiben ein Ablaufdatum **drei Kalendermonate** nach dem Ereignis (UTC; Monatsenden werden auf den letzten gültigen Tag gekürzt). Die automatische Ablaufzeit funktioniert ohne weiteren Besuch oder Cronjob. Ein Index enthält nur zufällige Ereignisschlüssel und Zeitpunkte, wird bei neuen Ereignissen bereinigt und läuft spätestens mit dem letzten Ereignis ab. Es gibt keinen lebenslangen Gesamtzähler; auch die Export-Summen beziehen sich nur auf den gewählten Zeitraum innerhalb der letzten drei Monate.

### Eigene Besuche ausschließen

In der Browserkonsole der Produktionsseite einmal ausführen, danach neu laden:

```javascript
localStorage.setItem('portfolio-activity-exclude', 'true');
```

Das gilt für diesen Browser/dieses Profil; zuvor erfasste Besuche bleiben bis zum Ablauf enthalten. Mit `localStorage.removeItem('portfolio-activity-exclude')` lässt sich die Erfassung wieder einschalten.

### JSON privat abrufen

Der Endpunkt liefert nur mit `Authorization: Bearer <ACTIVITY_ADMIN_TOKEN>` Daten. Ein normaler Browseraufruf ohne Schlüssel erhält **401**. Die Antwort darf weder im Browser noch im CDN zwischengespeichert werden. Es gibt keinen öffentlichen Statistik-Link auf der Webseite.

Den gleichen privaten Schlüssel lokal über die Umgebungsvariable `ACTIVITY_ADMIN_TOKEN` bereitstellen, zum Beispiel über eine lokal gehaltene, von Git ausgeschlossene `.env.local`:

```text
ACTIVITY_ADMIN_TOKEN=hier_den_eigenen_schluessel_eintragen
```

Dann im Projektordner ausführen (Node.js 22 oder neuer):

```powershell
node --env-file=.env.local scripts/export-activity.mjs
```

Das speichert Zähler und Ereignisse unter `private/activity.json`. Der Ordner ist von Git und vom Webseitenexport ausgeschlossen. Lokale Downloads sind eigene Kopien und werden durch die serverseitige Aufbewahrungsfrist nicht gelöscht; die Exportdatei wird beim nächsten Abruf überschrieben.

Das JSON enthält `generatedAt`, `retentionMonths`, `from`, `to`, `summary` mit `totalEvents`, `pageviews`, `byDay`, `byType`, `bySection` sowie `events`. Bei mehr als 10000 Ereignissen wird der Export mit einer klaren Fehlermeldung abgelehnt, statt Daten still abzuschneiden. Kleinere Zeiträume lassen sich über optionale ISO-Zeitstempel abrufen:

```powershell
node --env-file=.env.local scripts/export-activity.mjs 2026-10-01T00:00:00Z 2026-10-15T23:59:59.999Z
```

Der öffentliche Schreibendpunkt validiert feste Ereigniswerte, akzeptiert nur den Produktions-Origin und begrenzt die Ereignisgröße. Ein globales Limit von 2000 Ereignissen pro Minute bremst Fehlaufrufe; Browser-Origin-Prüfungen ersetzen keinen Botschutz.
