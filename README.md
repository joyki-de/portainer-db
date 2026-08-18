# Portainer Dashboard

Ein eigenständiges, leichtgewichtiges Web-Dashboard für [Portainer](https://www.portainer.io/). Ohne Build-Schritt, ohne Framework — nur vanilla HTML, CSS und JavaScript.

## Features

- **Metriken-Übersicht**: Container, Images, Volumes, Networks, Stacks, System-Info
- **Container-Details**: Echtzeit-Charts für CPU, Memory und Network I/O (via uPlot)
- **Light & Dark Mode**: Toggle mit persisted Preference
- **Auto-Refresh**: Konfigurierbares Intervall (10–300 Sekunden)
- **Kein Build nötig**: Dateien direkt im Browser öffnen oder einen einfachen Webserver nutzen

## Voraussetzungen

- Portainer CE oder BE (getestet mit v2.19+)
- Ein moderner Web-Browser (Chrome, Firefox, Edge, Safari)
- Ein Web-Server zum Ausführen (z.B. `python -m http.server`, Nginx, oder `npx serve`)

## Installation

```bash
git clone https://github.com/username/portainer-dashboard.git
cd portainer-dashboard
```

### Einfach starten

```bash
# Python
python3 -m http.server 8080

# oder Node.js
npx serve .

# oder PHP
php -S localhost:8080
```

Dann `http://localhost:8080` im Browser öffnen.

## Konfiguration

Beim ersten Start erscheint das Einstellungs-Panel. Folgende Werte werden benötigt:

| Feld | Beschreibung |
|------|-------------|
| **Portainer URL** | Die URL deiner Portainer-Instanz (z.B. `https://portainer.example.com`) |
| **Authentifizierung** | API Key oder Username/Passwort (JWT) |
| **Environment ID** | Die ID der Docker-Environment (Standard: `1`) |
| **Auto-Refresh** | Aktualisierungsintervall in Sekunden (10–300) |

### API Key erstellen

1. In Portainer unter **My Account → Access Tokens** einen neuen Token erstellen
2. Den generierten Key (`ptr_...`) in die Einstellungen eintragen

### JWT (Username/Passwort)

Alternativ können auch Username und Passwort verwendet werden. Der JWT-Token wird automatisch abgerufen und verwaltet.

## Projektstruktur

```
portainer-dashboard/
├── index.html              # Hauptseite
├── css/
│   ├── theme.css           # Light/Dark Theme Variablen
│   └── style.css           # Layout und Componenten
├── js/
│   ├── config.js           # Config-Verwaltung (localStorage)
│   ├── api.js              # Portainer API Client
│   ├── dashboard.js        # Dashboard-View (Metriken-Cards)
│   ├── containers.js       # Container-Liste
│   ├── container-detail.js # Container-Detail mit uPlot Charts
│   └── app.js              # Router, Theme, Refresh, Init
└── README.md
```

## Views

### Dashboard
Übersicht mit Metriken-Cards: Portainer-Version, System-Info (CPU/RAM), laufende/gestoppte Container, Images, Volumes, Networks, Stacks.

### Container-Liste
Sortierbare Tabelle aller Container. Klick auf einen laufenden Container öffnet die Detail-Ansicht.

### Container-Detail
Echtzeit-Ansicht mit three Liniendiagrammen:
- **CPU %** (0–100%, rot)
- **Memory %** (0–100%, blau)
- **Network I/O** (RX in Cyan, TX in Orange, auto-scaled)

Stats werden alle 2 Sekunden aktualisiert. Verlauf: ~10 Minuten (300 Datenpunkte).

## Technologien

| Technologie | Version | Lizenz |
|------------|---------|--------|
| [uPlot](https://github.com/leeoniya/uPlot) | 1.6.32 | MIT |
| Vanilla JS | ES6+ | - |
| CSS Custom Properties | - | - |

Keine weiteren externen Abhängigkeiten. uPlot wird via CDN geladen.

## API-Endpoints

Das Dashboard verwendet folgende Portainer API-Endpoints:

| Endpoint | Zweck |
|----------|-------|
| `GET /api/system/status` | Portainer Status |
| `GET /api/system/version` | Version & Update-Info |
| `GET /api/endpoints/{id}/docker/info` | System-Info (CPU, RAM, OS) |
| `GET /api/docker/{id}/dashboard` | Container/Image/Volume/Network Counts |
| `GET /api/endpoints/{id}/docker/containers/json` | Container-Liste |
| `GET /api/endpoints/{id}/docker/containers/{cid}/stats` | Container-Stats (CPU, Mem, Net) |
| `GET /api/stacks` | Stack-Liste |
| `POST /api/auth` | JWT-Login (bei Username/Passwort) |

## Browser-Kompatibilität

- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 14+

## Sicherheit

- Credentials werden nur im `localStorage` des Browsers gespeichert
- API-Keys werden **nicht** auf dem Server gespeichert
- Keine externen Requests außer an die konfigurierte Portainer-Instanz
- Für produktive Umgebungen: Dashboard über HTTPS und mit authentifiziertem Zugang bereitstellen

## Lizenz

MIT License
